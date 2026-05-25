/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js";
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
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
          // 判断当前 provider 是否为按量计费类型（如 DeepSeek）
          const messages = api.state.session.messages(_props.session_id);
          const lastMsg = findLastAssistantMessage(messages);
          const isBalanceOnly = lastMsg
            ? quotaService.setActiveProvider(lastMsg.providerID) && quotaService.supportsBalance()
            : false;

          return (
            <box gap={0}>
              <BalanceView
                quotaService={quotaService}
                api={api}
                sessionId={_props.session_id}
              />
              <Show when={!isBalanceOnly}>
                <Collapsible title="Usage Quota" color="#6bcf7f" defaultOpen={true}>
                  <UsageView
                    quotaService={quotaService}
                    api={api}
                    sessionId={_props.session_id}
                  />
                </Collapsible>
              </Show>
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

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
};

export default plugin;