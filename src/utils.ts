import { createSignal } from "solid-js";

/**
 * CRITICAL: sidebar_content 是回调函数（非 Solid 组件），
 * 每次消息更新都会重建整个组件树，所有 createSignal 状态归零。
 *
 * cachedSignal 将 signal 数据自动同步到模块级 Map，
 * 重挂时从缓存恢复，避免 UI 闪烁和重复请求。
 *
 * 所有侧边栏组件的数据 signal 必须使用 cachedSignal，
 * 禁止使用裸 createSignal 存储异步获取的数据。
 */
const _cache = new Map<string, unknown>();

type Signal<T> = readonly [() => T, (value: T) => T];

export function cachedSignal<T>(key: string, fallback: T): Signal<T> {
  const stored = _cache.get(key) as T | undefined;
  const [get, set] = createSignal<T>(stored ?? fallback);
  return [
    get,
    (value: T): T => {
      _cache.set(key, value);
      return set(() => value);
    },
  ] as const;
}

/**
 * 从消息列表中查找最后一条有效的 assistant 消息
 * 返回 providerID 和 modelID
 */
export function findLastAssistantMessage(
  messages: readonly { role: string; [key: string]: unknown }[]
): { providerID: string; modelID: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    if (!("providerID" in msg) || typeof msg.providerID !== "string") {
      continue;
    }

    const modelID =
      "modelID" in msg && typeof msg.modelID === "string"
        ? msg.modelID
        : "";

    return {
      providerID: msg.providerID as string,
      modelID,
    };
  }
  return null;
}
