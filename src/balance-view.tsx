/** @jsxImportSource @opentui/solid */
import type { JSX } from "solid-js";
import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { BalanceData } from "./quota/types.js";
import { formatDuration } from "./formatters.js";
import { findLastAssistantMessage } from "./utils.js";

/** 余额刷新间隔（秒） */
const REFRESH_INTERVAL = 60;

export interface BalanceViewProps {
  quotaService: {
    fetchBalance(): Promise<BalanceData | null>;
    setActiveProvider(providerName: string): boolean;
    isProviderSupported(providerName: string): boolean;
    supportsBalance(): boolean;
  };
  api: TuiPluginApi;
  sessionId: string;
}

/**
 * Balance 余额视图组件
 * 用于按量计费（pay-as-you-go）的 Provider 显示账户余额
 * 仅当当前 Provider 支持余额查询时显示
 */
export function BalanceView(props: BalanceViewProps): JSX.Element {
  const [balance, setBalance] = createSignal<BalanceData | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [currentProvider, setCurrentProvider] = createSignal<string | null>(null);
  const [hasBalance, setHasBalance] = createSignal(false);
  const [refreshCountdown, setRefreshCountdown] = createSignal(REFRESH_INTERVAL);
  let refreshCount = 0;

  // 请求 ID 计数器，用于处理竞态条件
  let currentRequestId = 0;

  // Effect 1: 检测 session 消息，提取 provider
  createEffect(() => {
    const sessionId = props.sessionId;
    const messages = props.api.state.session.messages(sessionId);

    if (!messages || messages.length === 0) {
      setCurrentProvider(null);
      return;
    }

    const lastMsg = findLastAssistantMessage(messages);
    if (!lastMsg) {
      setCurrentProvider(null);
      return;
    }

    if (lastMsg.providerID !== currentProvider()) {
      setCurrentProvider(lastMsg.providerID);
    }
  });

  // Effect 2: 监听 provider 变化，触发余额获取
  createEffect(() => {
    const providerID = currentProvider();

    if (!providerID) {
      setBalance(null);
      setHasBalance(false);
      return;
    }

    const supported = props.quotaService.setActiveProvider(providerID);
    if (!supported) {
      setBalance(null);
      setHasBalance(false);
      return;
    }

    if (!props.quotaService.supportsBalance()) {
      setBalance(null);
      setHasBalance(false);
      return;
    }

    setHasBalance(true);
    doFetch();
  });

  // Effect 3: 倒计时定时器，归零时触发刷新
  createEffect(() => {
    if (!hasBalance()) return;

    setRefreshCountdown(REFRESH_INTERVAL);
    const id = setInterval(() => {
      setRefreshCountdown((r) => {
        if (r <= 1) {
          doFetch();
          return REFRESH_INTERVAL;
        }
        return r - 1;
      });
    }, 1000);

    onCleanup(() => clearInterval(id));
  });

  const doFetch = () => {
    const requestId = ++currentRequestId;
    refreshCount++;
    setLoading(true);

    props.quotaService.fetchBalance().then((data) => {
      if (requestId !== currentRequestId) return;
      if (data) {
        setBalance(data);
      }
      setLoading(false);
    }).catch((error) => {
      if (requestId !== currentRequestId) return;
      console.error("[BalanceView] Fetch failed:", error);
      setLoading(false);
    });
  };

  return (
    <Show when={hasBalance()}>
      <Show when={loading() && !balance()}>
        <text fg="#888">Loading...</text>
      </Show>
      <Show when={balance()} keyed>
        {(data: BalanceData) => (
          <box flexDirection="column" gap={0}>
            <box flexDirection="row" gap={1}>
              <text fg="#ffd93d">Balance:</text>
              <text>
                ¥{data.totalBalance.toFixed(2)} ({data.currency})
              </text>
            </box>
            <text fg="#888">{formatDuration(refreshCountdown())} Refresh #{refreshCount}</text>
          </box>
        )}
      </Show>
    </Show>
  );
}
