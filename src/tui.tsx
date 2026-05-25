/** @jsxImportSource @opentui/solid */
import { Show, createSignal, createEffect } from "solid-js";
import type { JSX } from "solid-js";
import type { TuiPlugin, TuiPluginModule, TuiPluginApi } from "@opencode-ai/plugin/tui";
import { BalanceView } from "./balance-view.jsx";
import { Collapsible } from "./components.jsx";
import { UsageView } from "./usage.jsx";
import { SessionInfoView } from "./session-info.jsx";
import { TokensUsageView } from "./tokens-usage.jsx";
import { QuotaService } from "./quota/service.js";
import { findLastAssistantMessage } from "./utils.js";

const id = "opencode-tui-usage-plugin";

const tui: TuiPlugin = async (api) => {
  const quotaService = new QuotaService();

  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_ctx: unknown, _props: { session_id: string }) {
          return (
            <box gap={0}>
              <BalanceView
                quotaService={quotaService}
                api={api}
                sessionId={_props.session_id}
              />
              <QuotaSection
                quotaService={quotaService}
                api={api}
                sessionId={_props.session_id}
              />
              <Collapsible title="Session" color="#ffd93d" defaultOpen={true}>
                <SessionInfoView api={api} sessionId={_props.session_id} />
              </Collapsible>
              <Collapsible title="Usage Tokens" color="#a29bfe" defaultOpen={false}>
                <TokensUsageView
                  api={api}
                  sessionId={_props.session_id}
                />
              </Collapsible>
            </box>
          );
      },
    },
  });

};

/**
 * Usage Quota 区域组件
 *
 * 将 provider 检测逻辑（含 setActiveProvider 副作用）放在 createEffect 中，
 * 而非在 sidebar_content 渲染函数中执行，避免 Solid 渲染时副作用。
 *
 * 按量计费的 provider（如 DeepSeek）不展示此区域。
 */
function QuotaSection(props: {
  quotaService: QuotaService;
  api: TuiPluginApi;
  sessionId: string;
}): JSX.Element {
  const [show, setShow] = createSignal(true);

  createEffect(() => {
    const messages = props.api.state.session.messages(props.sessionId);
    const lastMsg = findLastAssistantMessage(messages);
    if (lastMsg) {
      props.quotaService.setActiveProvider(lastMsg.providerID);
      setShow(!props.quotaService.supportsBalance());
    } else {
      setShow(false);
    }
  });

  return (
    <Show when={show()}>
      <Collapsible title="Usage Quota" color="#6bcf7f" defaultOpen={true}>
        <UsageView
          quotaService={props.quotaService}
          api={props.api}
          sessionId={props.sessionId}
        />
      </Collapsible>
    </Show>
  );
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
};

export default plugin;
