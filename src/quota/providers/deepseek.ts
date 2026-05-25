import type { BalanceData, QuotaData, ProviderConfig } from "../types.js";
import { QuotaProvider, BalanceProvider, resolveEnvVar } from "../provider.js";

/** DeepSeek 余额 API 返回的单个币种余额 */
interface BalanceInfo {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
}

/** DeepSeek 余额 API 响应格式 */
interface BalanceResponse {
  is_available: boolean;
  balance_infos: BalanceInfo[];
}

/**
 * DeepSeek 余额 Provider
 *
 * DeepSeek 是 API 按量计费模式，无 coding plan / token plan 额度概念。
 * 通过官方余额接口查询剩余金额：
 *   GET https://api.deepseek.com/user/balance
 *
 * 同时实现 QuotaProvider（fetchQuota 返回 null，表示无 plan quota）
 * 和 BalanceProvider（fetchBalance 返回余额数据）。
 */
export class DeepSeekQuotaProvider implements QuotaProvider, BalanceProvider {
  readonly name = "deepseek";

  private apiKey: string | undefined;
  private baseUrl = "https://api.deepseek.com";

  init(config: ProviderConfig, _credentials: Record<string, unknown>): void {
    const apiKeyRaw = config.apiKey as string | undefined;
    this.apiKey = resolveEnvVar(apiKeyRaw) ?? process.env.DEEPSEEK_API_KEY;
  }

  /** DeepSeek 无 plan-based quota，返回 null */
  async fetchQuota(): Promise<QuotaData | null> {
    return null;
  }

  async fetchBalance(): Promise<BalanceData | null> {
    if (!this.apiKey) {
      console.warn("[DeepSeekQuotaProvider] Missing apiKey");
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/user/balance`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        console.error(`[DeepSeekQuotaProvider] API error: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as BalanceResponse;

      if (!data.is_available || !data.balance_infos || data.balance_infos.length === 0) {
        console.warn("[DeepSeekQuotaProvider] Account not available or no balance info");
        return null;
      }

      return this.mapResponseToBalanceData(data);
    } catch (error) {
      console.error("[DeepSeekQuotaProvider] Fetch failed:", error);
      return null;
    }
  }

  /** 将 API 响应映射为 BalanceData */
  private mapResponseToBalanceData(data: BalanceResponse): BalanceData {
    const info = data.balance_infos[0];
    return {
      currency: info.currency,
      totalBalance: parseFloat(info.total_balance),
      grantedBalance: parseFloat(info.granted_balance),
      toppedUpBalance: parseFloat(info.topped_up_balance),
    };
  }
}
