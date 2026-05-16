/**
 * Audience Payment Calculator
 */

export function calculateAudiencePayment(params: {
  impressions: number;
  baseCPM: number;
  cityTier?: number;
  timeMultiplier?: number;
  demandMultiplier?: number;
}): { totalCost: number; cpmEffective: number } {
  const cityTier = params.cityTier ?? 1;
  const timeMultiplier = params.timeMultiplier ?? 1;
  const demandMultiplier = params.demandMultiplier ?? 1;

  const effectiveCPM = params.baseCPM * cityTier * timeMultiplier * demandMultiplier;
  const totalCost = (params.impressions * effectiveCPM) / 1000;

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    cpmEffective: Math.round(effectiveCPM * 100) / 100,
  };
}

export function calculateOwnerEarnings(params: {
  grossRevenue: number;
  ownerPercent?: number;
  deductGST?: boolean;
}): {
  ownerAmount: number;
  platformAmount: number;
  gstAmount?: number;
  netPayable?: number;
} {
  const ownerPercent = params.ownerPercent ?? 70;
  const ownerAmount = params.grossRevenue * (ownerPercent / 100);
  const platformAmount = params.grossRevenue - ownerAmount;

  if (params.deductGST) {
    const gstAmount = platformAmount * 0.18;
    return {
      ownerAmount,
      platformAmount,
      gstAmount: Math.round(gstAmount * 100) / 100,
      netPayable: Math.round((ownerAmount - gstAmount) * 100) / 100,
    };
  }

  return { ownerAmount, platformAmount };
}
