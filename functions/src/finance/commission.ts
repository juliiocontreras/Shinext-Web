export type ProviderMode = "independent" | "shinext_partner";

export function commissionRateForMode(mode: ProviderMode | string | null | undefined): number {
  return mode === "shinext_partner" ? 0.2 : 0.15;
}

export function calculateServiceEconomics(
  clientPriceInput: number,
  mode: ProviderMode | string | null | undefined,
) {
  const clientPrice = Math.round(Number(clientPriceInput) * 100) / 100;
  if (!Number.isFinite(clientPrice) || clientPrice <= 0) {
    throw new Error("clientPrice must be a positive amount");
  }

  const commissionRate = commissionRateForMode(mode);
  const shinextCommission = Math.round(clientPrice * commissionRate * 100) / 100;
  const workerEarning = Math.round((clientPrice - shinextCommission) * 100) / 100;

  return {
    clientPrice,
    commissionRate,
    shinextCommission,
    workerEarning,
  };
}
