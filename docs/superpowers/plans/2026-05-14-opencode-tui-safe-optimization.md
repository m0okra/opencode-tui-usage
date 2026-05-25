# OpenCode TUI Safe Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely improve the OpenCode TUI usage plugin's maintainability, local performance, and state clarity without changing existing feature behavior.

**Architecture:** Keep the current Solid.js + `@opentui/solid` component structure and provider architecture intact. Apply small, isolated edits in `usage.tsx`, `context-usage.tsx`, `opencode-go.ts`, and `tui.tsx`, then validate with TypeScript and build checks.

**Tech Stack:** TypeScript, Solid.js signals/effects, `@opentui/solid` JSX components, OpenCode TUI plugin API, npm scripts (`lint`, `build`).

---

## File Structure

- Modify `src/usage.tsx`
  - Remove unused `EmptyState` props.
  - Surface a clearer error when `fetchQuota()` returns no usable quota.
  - Replace nested ternary rendering with `<Show>` branches.
  - Cache `result()` inside the successful quota branch.
- Modify `src/context-usage.tsx`
  - Replace full forward scan with reverse early-exit scan for the latest valid assistant context token message.
  - Cache `contextData()` in the `<Show>` render function.
- Modify `src/quota/providers/opencode-go.ts`
  - Remove unnecessary browser-only headers from the OpenCode-Go fetch request.
- Modify `src/tui.tsx`
  - Remove production `console.log` registration message.
- Do not modify `src/tokens-usage.tsx` in this iteration.
  - The approved design allows only light cleanup if necessary, but current changes already cover the safe optimization goals. Avoid touching token aggregation to reduce regression risk.

---

### Task 1: Clean up Usage empty/error state and fetch result handling

**Files:**
- Modify: `src/usage.tsx:2-112`

- [ ] **Step 1: Confirm current typecheck baseline**

Run:

```bash
npm run lint
```

Expected: command exits successfully. If it fails before edits, stop and record the pre-existing failure.

- [ ] **Step 2: Update imports and `EmptyStateProps`**

In `src/usage.tsx`, change the Solid import to include `Show`:

```typescript
import { createSignal, createEffect, onCleanup, Show } from "solid-js";
```

Replace the current `EmptyStateProps` interface with:

```typescript
/** 空状态显示的属性 */
interface EmptyStateProps {
  provider: string | null;
  supported: boolean;
  error: string | null;
}
```

- [ ] **Step 3: Preserve existing EmptyState rendering logic**

Keep `EmptyState` body behavior the same. It should remain exactly capable of rendering these states:

```tsx
function EmptyState(props: EmptyStateProps): JSX.Element {
  if (!props.provider) {
    return <text fg="#888">No LLM activity detected</text>;
  }

  if (!props.supported) {
    return (
      <box flexDirection="column" gap={0}>
        <text fg="#ff6b6b">not support provider: {props.provider}</text>
        <text fg="#74b9ff">github.com/Yinxe/opencode-tui-usage</text>
      </box>
    );
  }

  if (props.error) {
    return (
      <box flexDirection="column" gap={0}>
        <text fg="#ff6666">Error fetching quota</text>
        <text fg="#888">{props.error}</text>
      </box>
    );
  }

  return <text fg="#888">No quota data available</text>;
}
```

- [ ] **Step 4: Set a clearer error when quota fetch returns no quota**

In `doRefresh()`, replace the `.then()` block at `src/usage.tsx:98-105` with:

```typescript
    props.quotaService.fetchQuota().then((data) => {
      if (requestId !== currentRequestId) return;
      if (data && data.quota) {
        setResult(data);
      } else {
        setFetchError("Provider returned no quota data");
        setResult(null);
      }
      setLoading(false);
    }).catch((error) => {
```

Do not change the `.catch()` branch except where TypeScript formatting requires it.

- [ ] **Step 5: Remove unused props from EmptyState call site**

Later in `src/usage.tsx`, the `EmptyState` call should pass only these props:

```tsx
        <EmptyState
          provider={currentProvider()}
          supported={providerSupported()}
          error={fetchError()}
        />
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS with no TypeScript errors. If TypeScript reports unused imports or props, fix them before moving on.

---

### Task 2: Replace Usage nested ternary with Solid `<Show>` branches

**Files:**
- Modify: `src/usage.tsx:176-269`

- [ ] **Step 1: Replace the return JSX body inside the outer `<box>`**

In `src/usage.tsx`, keep the outer component setup unchanged. Replace the conditional section starting at the current `{loading() ? (` through the final `)}` before `</box>` with this `<Show>`-based rendering:

```tsx
      <Show when={loading()}>
        <>
          <box flexDirection="column" gap={0}>
            <box flexDirection="row" gap={1}>
              <text fg="#6bcf7f">Rolling:</text>
              <text fg="#888">Loading...</text>
            </box>
            <ProgressBar value={0} color="#6bcf7f" />
          </box>
          <box flexDirection="column" gap={0}>
            <box flexDirection="row" gap={1}>
              <text fg="#ffd93d">Weekly:</text>
              <text fg="#888">Loading...</text>
            </box>
            <ProgressBar value={0} color="#ffd93d" />
          </box>
          <box flexDirection="column" gap={0}>
            <box flexDirection="row" gap={1}>
              <text fg="#4da6ff">Monthly:</text>
              <text fg="#888">Loading...</text>
            </box>
            <ProgressBar value={0} color="#4da6ff" />
          </box>
          <text fg="#888">Refreshing...</text>
        </>
      </Show>

      <Show when={!loading() && result()?.quota}>
        {(quota) => {
          const currentResult = result();
          const rolling = quota().rolling;
          const weekly = quota().weekly;
          const monthly = quota().monthly;

          return (
            <>
              <Show when={rolling} fallback={<text fg="#888">Rolling: N/A</text>}>
                {(rollingQuota) => (
                  <box flexDirection="column" gap={0}>
                    <box flexDirection="row" gap={1}>
                      <text fg="#6bcf7f">Rolling:</text>
                      <text>{rollingQuota().usage}%</text>
                      <text fg="#888">reset {rollingQuota().reset}</text>
                    </box>
                    <ProgressBar
                      value={rollingQuota().usage}
                      color="#6bcf7f"
                    />
                  </box>
                )}
              </Show>

              <Show when={weekly} fallback={<text fg="#888">Weekly: N/A</text>}>
                {(weeklyQuota) => (
                  <box flexDirection="column" gap={0}>
                    <box flexDirection="row" gap={1}>
                      <text fg="#ffd93d">Weekly:</text>
                      <text>{weeklyQuota().usage}%</text>
                      <text fg="#888">reset {weeklyQuota().reset}</text>
                    </box>
                    <ProgressBar
                      value={weeklyQuota().usage}
                      color="#ffd93d"
                    />
                  </box>
                )}
              </Show>

              <box flexDirection="column" gap={0}>
                <box flexDirection="row" gap={1}>
                  <text fg="#4da6ff">Monthly:</text>
                  <Show
                    when={monthly}
                    fallback={
                      <>
                        <text fg="#888">0%</text>
                        <text fg="#888">reset ∞</text>
                      </>
                    }
                  >
                    {(monthlyQuota) => (
                      <>
                        <text>{monthlyQuota().usage}%</text>
                        <text fg="#888">reset {monthlyQuota().reset}</text>
                      </>
                    )}
                  </Show>
                </box>
                <ProgressBar
                  value={monthly?.usage ?? 0}
                  color="#4da6ff"
                />
              </box>
              <text fg="#888">
                {formatDuration(refreshCountdown())} Refresh #{currentResult?.refreshCount ?? 0}
              </text>
            </>
          );
        }}
      </Show>

      <Show when={!loading() && !result()?.quota}>
        <EmptyState
          provider={currentProvider()}
          supported={providerSupported()}
          error={fetchError()}
        />
      </Show>
```

- [ ] **Step 2: Check behavior-preserving branches**

Verify these render states are still represented:

- Loading state renders Rolling/Weekly/Monthly loading placeholders and `Refreshing...`.
- Successful quota state renders Rolling, Weekly, Monthly, progress bars, and refresh countdown.
- Missing Rolling renders `Rolling: N/A`.
- Missing Weekly renders `Weekly: N/A`.
- Missing Monthly renders `0%` and `reset ∞` with progress value `0`.
- Empty/error/unsupported states render `EmptyState`.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS. If Solid's `<Show>` child types complain about accessor usage, adjust only the child callback variable usage while preserving the same output.

---

### Task 3: Optimize Context latest-message lookup and cache display signal

**Files:**
- Modify: `src/context-usage.tsx:39-94`

- [ ] **Step 1: Replace forward scan with reverse early-exit scan**

In `src/context-usage.tsx`, replace the variables and `for (const msg of messages)` loop at `src/context-usage.tsx:39-72` with:

```typescript
    let latestTokens = 0;
    let limit = 0;

    // 从最新消息向前查找，保留“最新一条有效 assistant tokens”的语义
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg || msg.role !== "assistant" || !msg.tokens) continue;

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
      if (!provider) {
        continue;
      }

      const model = provider.models[msg.modelID];
      latestTokens = tokens;
      limit = model?.limit?.context ?? 0;
      break;
    }
```

- [ ] **Step 2: Replace render block to avoid repeated `contextData()!` reads**

Replace the current return JSX with:

```tsx
  return (
    <Show when={contextData()} fallback={<></>}>
      {(data) => (
        <box flexDirection="column" gap={0}>
          <box flexDirection="row" gap={2}>
            <text fg="#a29bfe">Context:</text>
            <text>
              {formatNumber(data().tokens)} / {formatNumber(data().limit)} ({formatPercent(data().percent)})
            </text>
          </box>
          <ProgressBar value={data().percent} color="#a29bfe" width={20} />
        </box>
      )}
    </Show>
  );
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS.

---

### Task 4: Prune OpenCode-Go request headers

**Files:**
- Modify: `src/quota/providers/opencode-go.ts:40-54`

- [ ] **Step 1: Replace fetch headers with minimal required headers**

In `src/quota/providers/opencode-go.ts`, replace the `headers` object with:

```typescript
        headers: {
          accept: "*/*",
          cookie: this.cookie,
          "x-server-id": this.serviceId,
          "x-server-instance": "server-fn:3",
        },
```

This removes browser-only request metadata while keeping authentication and RPC routing headers.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS.

---

### Task 5: Remove production registration log

**Files:**
- Modify: `src/tui.tsx:40`

- [ ] **Step 1: Delete `console.log`**

Remove this line from `src/tui.tsx`:

```typescript
  console.log(`[${id}] Plugin registered`);
```

Keep the `id` constant because it is still used in the exported plugin object.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS.

---

### Task 6: Final validation and review

**Files:**
- Validate all modified files.

- [ ] **Step 1: Run full typecheck**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and updated `dist/` output generated by TypeScript if the project emits build files.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff -- src/usage.tsx src/context-usage.tsx src/quota/providers/opencode-go.ts src/tui.tsx docs/superpowers/specs/2026-05-14-opencode-tui-safe-optimization-design.md docs/superpowers/plans/2026-05-14-opencode-tui-safe-optimization.md
```

Expected diff characteristics:

- No changes to `sidebar_content` ordering.
- No changes to `QuotaProvider`, `QuotaService`, or quota data types.
- No changes to token aggregation logic in `src/tokens-usage.tsx`.
- No new runtime dependencies.
- Only `console.warn` and `console.error` remain in production source.

- [ ] **Step 4: Optional manual smoke test**

If OpenCode is available, restart OpenCode with the plugin loaded and verify:

- Sidebar order remains: Usage Quota, Session, Context, Usage Tokens.
- A session with no assistant messages shows `No LLM activity detected` in Usage Quota.
- Unsupported provider still shows `not support provider: <provider>`.
- Configured provider still shows quota bars.
- Context line appears only when a valid assistant message has non-zero tokens and a context limit.

---

## Self-Review

- Spec coverage: The plan covers `usage.tsx` safety cleanup, `context-usage.tsx` early exit, OpenCode-Go header pruning, logging cleanup, and validation. It intentionally avoids high-risk `tokens-usage.tsx` aggregation changes as specified.
- Placeholder scan: No unresolved placeholder markers remain.
- Type consistency: File paths, imports, component names, signal names, and prop names match the current source files.
