/** @jsxImportSource @opentui/solid */
import type { JSX } from "solid-js";
import { createSignal, createEffect, Show, For } from "solid-js";
import { TreeItem } from "./components.jsx";
import { formatNumber, formatCost } from "./formatters.js";
import { cachedSignal } from "./utils.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { AssistantMessage } from "@opencode-ai/sdk/v2";

/** 单个模型的 token 统计 */
export interface TokenStats {
  providerID: string;
  modelID: string;
  totalCost: number;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  messageCount: number;
}

export interface TokensUsageViewProps {
  api: TuiPluginApi;
  sessionId: string;
}

/**
 * Tokens Usage 视图组件
 * 统计当前会话中所有 assistant 消息的 token 消耗
 * 按模型分组显示累计数据
 */
export function TokensUsageView(props: TokensUsageViewProps): JSX.Element {
  const [stats, setStats] = cachedSignal<TokenStats[]>("tokens.stats", []);
  const [totals, setTotals] = cachedSignal<{
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
  } | null>("tokens.totals", null);
  const [isLoading, setIsLoading] = cachedSignal<boolean>("tokens.loading", true);

  createEffect(() => {
    const sessionId = props.sessionId;
    const messages = props.api.state.session.messages(sessionId);

    if (!messages || messages.length === 0) {
      setStats([]);
      setTotals(null);
      setIsLoading(false);
      return;
    }

    // 按 (providerID, modelID) 分组统计
    const grouped = new Map<string, TokenStats>();

    messages.forEach((msg) => {
      if (msg.role !== "assistant") return;

      const assistantMsg = msg as AssistantMessage;
      if (!assistantMsg.tokens) return;

      // 以 providerID::modelID 作为分组 key
      const key = `${assistantMsg.providerID || "unknown"}::${assistantMsg.modelID || "unknown"}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          providerID: assistantMsg.providerID || "unknown",
          modelID: assistantMsg.modelID || "unknown",
          totalCost: 0,
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          messageCount: 0,
        });
      }

      // 累加各项数据
      const stat = grouped.get(key)!;
      stat.totalCost += assistantMsg.cost || 0;
      stat.input += assistantMsg.tokens.input || 0;
      stat.output += assistantMsg.tokens.output || 0;
      stat.reasoning += assistantMsg.tokens.reasoning || 0;
      stat.cacheRead += assistantMsg.tokens.cache?.read || 0;
      stat.cacheWrite += assistantMsg.tokens.cache?.write || 0;
      stat.messageCount += 1;
    });

    // 计算总计
    let totalInput = 0,
      totalOutput = 0,
      totalReasoning = 0;
    let totalCacheRead = 0,
      totalCacheWrite = 0,
      totalCost = 0;

    grouped.forEach((stat) => {
      totalInput += stat.input;
      totalOutput += stat.output;
      totalReasoning += stat.reasoning;
      totalCacheRead += stat.cacheRead;
      totalCacheWrite += stat.cacheWrite;
      totalCost += stat.totalCost;
    });

    setStats(Array.from(grouped.values()));
    setTotals({
      input: totalInput,
      output: totalOutput,
      reasoning: totalReasoning,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      cost: totalCost,
    });
    setIsLoading(false);
  });

  return (
    <box flexDirection="column" gap={0}>
      <Show when={isLoading()}>
        <text fg="#888">...</text>
      </Show>

      <Show when={!isLoading() && stats().length === 0}>
        <text fg="#888">-</text>
      </Show>

      <Show when={!isLoading() && stats().length > 0}>
        <box flexDirection="column" gap={0}>
          <TreeItem label="Input" value={formatNumber(totals()?.input ?? 0)} labelColor="#6bcf7f" />
          <TreeItem label="Output" value={formatNumber(totals()?.output ?? 0)} labelColor="#fd79a8" />
          <TreeItem label="Reasoning" value={formatNumber(totals()?.reasoning ?? 0)} labelColor="#fdcb6e" />
          <TreeItem label="Cache" value={`R:${formatNumber(totals()?.cacheRead ?? 0)} W:${formatNumber(totals()?.cacheWrite ?? 0)}`} labelColor="#00cec9" />
          <TreeItem label="Cost" value={formatCost(totals()?.cost ?? 0)} isLast labelColor="#ffd93d" />
        </box>
      </Show>

      <Show when={!isLoading() && stats().length > 0}>
        <For each={stats()}>
          {(stat) => (
            <box flexDirection="column" gap={0}>
              <text fg="#74b9ff">{stat.modelID || "unknown"}:</text>
              <TreeItem indent={1} label="Input" value={formatNumber(stat.input)} labelColor="#6bcf7f" />
              <TreeItem indent={1} label="Output" value={formatNumber(stat.output)} labelColor="#fd79a8" />
              <TreeItem indent={1} label="Reasoning" value={formatNumber(stat.reasoning)} labelColor="#fdcb6e" />
              <TreeItem indent={1} label="Cache" value={formatNumber(stat.cacheRead + stat.cacheWrite)} labelColor="#00cec9" />
              <TreeItem indent={1} label="Cost" value={`${formatCost(stat.totalCost)} (${stat.messageCount} msg)`} isLast labelColor="#ffd93d" />
            </box>
          )}
        </For>
      </Show>
    </box>
  );
}
