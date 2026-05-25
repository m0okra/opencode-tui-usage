/** @jsxImportSource @opentui/solid */
import type { JSX } from "solid-js";
import { createSignal, createEffect } from "solid-js";
import { Show } from "solid-js";
import { ProgressBar } from "./components.jsx";
import { formatNumber, formatPercent } from "./formatters.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";

export interface ContextUsageViewProps {
  api: TuiPluginApi;
  sessionId: string;
}

interface ContextData {
  tokens: number;
  limit: number;
  percent: number;
}

/**
 * Context Usage 视图组件
 * 显示当前会话最新一条 assistant 消息的 context tokens 使用情况
 *
 * Context Tokens 计算方式：
 * contextTokens = input + output + reasoning + cache.read + cache.write
 *
 * 注意：AI 回复期间 tokens 可能为 0，此时跳过该消息
 */
export function ContextUsageView(props: ContextUsageViewProps): JSX.Element {
  const [contextData, setContextData] = createSignal<ContextData | null>(null);

  createEffect(() => {
    const sessionId = props.sessionId;
    const messages = props.api.state.session.messages(sessionId);

    if (!messages || messages.length === 0) {
      setContextData(null);
      return;
    }

    // 反向遍历，找到最新一条有有效 tokens 的 assistant 消息（early exit）
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant" || !msg.tokens) continue;

      // 计算总 tokens（input + output + reasoning + cache）
      const tokens =
        msg.tokens.input +
        msg.tokens.output +
        msg.tokens.reasoning +
        msg.tokens.cache.read +
        msg.tokens.cache.write;

      // AI 回复期间 tokens 可能为 0，跳过
      if (tokens <= 0) continue;

      // 从 provider 列表中查找对应模型的 context limit
      const provider = props.api.state.provider.find((p) => p.id === msg.providerID);
      if (!provider) continue;

      const model = provider.models[msg.modelID];
      const limit = model?.limit?.context ?? 0;
      if (limit === 0) continue;

      const percent = Math.min(100, (tokens / limit) * 100);
      setContextData({ tokens, limit, percent });
      return;
    }

    setContextData(null);
  });

  return (
    <Show when={contextData()} keyed>
      {(data: ContextData) => (
        <box flexDirection="column" gap={0}>
          <box flexDirection="row" gap={2}>
            <text fg="#a29bfe">Context:</text>
            <text>
              {formatNumber(data.tokens)} / {formatNumber(data.limit)} ({formatPercent(data.percent)})
            </text>
          </box>
          <ProgressBar value={data.percent} color="#a29bfe" width={20} />
        </box>
      )}
    </Show>
  );
}
