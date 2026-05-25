# OpenCode TUI 插件安全优化设计

## 背景

这是一个基于 Solid.js + `@opentui/solid` 的 OpenCode TUI 插件，核心职责是在侧边栏展示额度、会话信息、Context tokens 和累计 token 统计。

当前代码结构已经清晰，但存在几类低风险可优化点：

- 部分状态分支可读性偏弱，尤其是 `usage.tsx` 中的嵌套条件渲染
- 某些数据计算可以更早退出，减少不必要的遍历
- OpenCode-Go provider 请求里保留了过多浏览器 header
- 一些重复读取 signal / 非空断言可以收敛
- 空状态和错误状态的表达可以更准确

本次优化目标是不改变现有功能、不引入新依赖、不调整数据模型，只做安全、局部、可回滚的改进。

## 目标

1. 提升代码可读性和维护性
2. 减少不必要的计算和重复读取
3. 让错误/空状态更准确，但不改变业务逻辑
4. 保持构建、类型检查和运行行为稳定

## 非目标

- 不重构整体插件架构
- 不修改 quota provider 接口
- 不新增 provider
- 不改变 `sidebar_content` 的渲染顺序
- 不对 `tokens-usage.tsx` 做高风险的统计逻辑重写

## 设计方案

### 1. `usage.tsx` 的安全整理

对 `UsageView` 做局部整理：

- 用 `<Show>` 替换嵌套三元表达式，保持分支语义不变
- 在可见分支内先缓存 `result()`，避免重复 signal 调用和大量 `result()!`
- 移除 `EmptyState` 中未使用的 props
- 在 `fetchQuota()` 返回空值时保留现有空态，但补充更准确的错误状态表达

这部分只做渲染与状态表达优化，不改 quota 拉取逻辑。

### 2. `context-usage.tsx` 的早退出优化

将最新 assistant 消息的查找从全量正向扫描改为反向扫描：

- 从数组尾部向前找第一条有效 assistant 消息
- 仍然跳过 `tokens <= 0` 的消息
- 保持“最新一条有效 assistant 消息”语义不变

这可以减少会话较长时的计算量，且符合消息追加式时间序列的特征。

### 3. `opencode-go.ts` 的请求头收敛

保留最小必要 header，移除浏览器特有且不必要的 header：

- `sec-fetch-*`
- `user-agent`
- `referer`
- `accept-language`

只保留真正需要的认证/业务头，减少维护成本和潜在兼容风险。

### 4. `tokens-usage.tsx` 的小幅维护性整理

仅做低风险整理：

- 保持现有统计逻辑不变
- 如有明显重复结构，可收敛为更清晰的局部辅助函数或 `Show` 分支

不在本轮做增量聚合或缓存重构，避免引入统计回归。

### 5. 日志与死代码清理

- 保留必要的 `console.warn` / `console.error`
- 移除生产环境不需要的 `console.log`
- 清理明显未使用的本地 props 或重复代码

## 影响范围

预计涉及文件：

- `src/usage.tsx`
- `src/context-usage.tsx`
- `src/quota/providers/opencode-go.ts`
- `src/tokens-usage.tsx`（仅轻量整理，如确有必要）

## 风险与缓解

### 风险 1：条件渲染分支调整导致显示差异

缓解：仅做语法层面的 `<Show>` 替换，并在同一语义分支内渲染原有内容。

### 风险 2：反向扫描是否改变“最新消息”的判定

缓解：保留“最新一条有效 assistant 消息”语义，并继续跳过 0 tokens 消息。

### 风险 3：移除 header 后请求失败

缓解：仅删除浏览器特有头，保留认证与业务必需头；构建后用现有 provider 配置验证。

## 验证方式

1. 运行 `npm run lint`
2. 运行 `npm run build`
3. 在 OpenCode 中加载插件，确认侧边栏顺序与内容一致
4. 切换到已配置的 provider 会话，确认额度仍能正常展示
5. 检查长会话下 Context 和 usage 的显示是否保持正确

## 结论

本次优化以“零行为变化的安全清理”为原则，优先改善可读性和局部性能，不碰高风险统计重构。若后续仍需性能提升，可在单独迭代中针对 `tokens-usage.tsx` 做更深入的缓存/增量计算。
