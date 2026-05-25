/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { JSX } from "solid-js";
import { createSignal, createEffect, Show } from "solid-js";
import { TreeItem, ProgressBar } from "./components.jsx";
import { formatNumber, formatPercent } from "./formatters.js";
import { cachedSignal, findLastAssistantMessage } from "./utils.js";

/** 会话信息数据结构 */
interface SessionData {
  sessionId: string;
  branch: string | undefined;
  provider: string;
  model: string;
  messageCount: number;
  todoCount: number;
  diffCount: number;
}

/** 上下文信息数据结构 */
interface ContextInfo {
  tokens: number;
  limit: number;
  percent: number;
}

/**
 * Session Info 视图组件
 * 显示当前会话的基本信息：Session ID、Branch、Provider、Model、消息数、上下文用量等
 */
export function SessionInfoView(props: {
  api: TuiPluginApi;
  sessionId: string;
}): JSX.Element {
  const [data, setData] = cachedSignal<SessionData | null>("session.data", null);
  const [contextInfo, setContextInfo] = cachedSignal<ContextInfo | null>("session.context", null);

  // 主数据抽取
  createEffect(() => {
    const sessionId = props.sessionId;

    const messages = props.api.state.session.messages(sessionId);
    const todos = props.api.state.session.todo(sessionId);
    const diff = props.api.state.session.diff(sessionId);
    const vcs = props.api.state.vcs;

    const lastModelInfo = findLastAssistantMessage(messages);

    setData({
      sessionId,
      branch: vcs?.branch,
      provider: lastModelInfo?.providerID ?? "None",
      model: lastModelInfo?.modelID ?? "None",
      messageCount: messages.length,
      todoCount: todos.length,
      diffCount: diff.length,
    });
  });

  // Context 数据抽取
  createEffect(() => {
    const sessionId = props.sessionId;
    const messages = props.api.state.session.messages(sessionId);

    if (!messages || messages.length === 0) {
      setContextInfo(null);
      return;
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant" || !msg.tokens) continue;

      const tokens =
        msg.tokens.input +
        msg.tokens.output +
        msg.tokens.reasoning +
        msg.tokens.cache.read +
        msg.tokens.cache.write;

      if (tokens <= 0) continue;

      const provider = props.api.state.provider.find((p) => p.id === msg.providerID);
      if (!provider) continue;

      const model = provider.models[msg.modelID];
      const limit = model?.limit?.context ?? 0;
      if (limit === 0) continue;

      setContextInfo({
        tokens,
        limit,
        percent: Math.min(100, (tokens / limit) * 100),
      });
      return;
    }

    setContextInfo(null);
  });

  return (
    <Show when={data()} fallback={<text>Loading...</text>}>
      {() => {
        const d = data()!;
        return (
          <>
            <TreeItem label="Id" value={d.sessionId.slice(0, 8) + "..."} labelColor="#6bcf7f" />
            <TreeItem label="Branch" value={d.branch ?? "N/A"} labelColor="#ffd93d" />
            <TreeItem label="Provider" value={d.provider} labelColor="#ff6b6b" />
            <TreeItem label="Model" value={d.model} labelColor="#74b9ff" />
            <TreeItem label="Messages" value={d.messageCount} labelColor="#a29bfe" />
            <TreeItem label="TODOs" value={d.todoCount} labelColor="#fd79a8" />
            <TreeItem label="Changes" value={d.diffCount} isLast={!contextInfo()} labelColor="#00cec9" />
            <Show when={contextInfo()} keyed>
              {(ctx: ContextInfo) => (
                <>
                  <TreeItem
                    label="Context"
                    value={`${formatNumber(ctx.tokens)} / ${formatNumber(ctx.limit)} (${formatPercent(ctx.percent)})`}
                    isLast
                    labelColor="#a29bfe"
                  />
                  <box flexDirection="row" gap={0}>
                    <box width={12} />
                    <ProgressBar value={ctx.percent} color="#a29bfe" width={20} />
                  </box>
                </>
              )}
            </Show>
          </>
        );
      }}
    </Show>
  );
}
