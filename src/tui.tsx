/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { Collapsible } from "./components.jsx";
import { UsageView } from "./usage.jsx";
import { SessionInfoView } from "./session-info.jsx";
import { TokensUsageView } from "./tokens-usage.jsx";
import { ContextUsageView } from "./context-usage.jsx";
import { QuotaService } from "./quota/service.js";

const id = "opencode-tui-usage-plugin";

const tui: TuiPlugin = async (api) => {
  const quotaService = new QuotaService();

  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_ctx: unknown, _props: { session_id: string }) {
          return (
            <box gap={0}>
              <Collapsible title="Usage Quota" color="#6bcf7f" defaultOpen={false}>
                <UsageView
                  quotaService={quotaService}
                  api={api}
                  sessionId={_props.session_id}
                />
              </Collapsible>
              <Collapsible title="Session" color="#ffd93d" defaultOpen={false}>
                <SessionInfoView api={api} sessionId={_props.session_id} />
              </Collapsible>
              <Collapsible title="Context" color="#a29bfe" defaultOpen={false}>
                <ContextUsageView
                  api={api}
                  sessionId={_props.session_id}
                />
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