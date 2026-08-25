export const PLANS = {
  starter: {
    key: "starter",
    name: "STARTER",
    price: "19,99 €",
    unitAmount: 1999,
    cadence: "/mois",
    credits: 40,
    creditsLabel: "40 créations / mois",
    mode: "subscription",
  },
  creator: {
    key: "creator",
    name: "CRÉATEUR",
    price: "34,99 €",
    unitAmount: 3499,
    cadence: "/mois",
    credits: 120,
    creditsLabel: "120 créations / mois",
    mode: "subscription",
    featured: true,
  },
  lifetime: {
    key: "lifetime",
    name: "À VIE",
    price: "250 €",
    unitAmount: 25000,
    cadence: "une fois",
    credits: 200,
    creditsLabel: "200 créations incluses",
    mode: "payment",
  },
} as const;

export const STARTER_PROMO_END = "2026-09-15T21:59:59.999Z";
export const STARTER_PROMO_PRICE = "10,99 €";
export const STARTER_PROMO_UNIT_AMOUNT = 1099;

export type PlanKey = keyof typeof PLANS;

export function isPlanKey(value: string): value is PlanKey {
  return value in PLANS;
}

export function creditsForPlan(plan: PlanKey) {
  return PLANS[plan].credits;
}

export function isStarterPromoActive(now = new Date()) {
  return now.getTime() <= new Date(STARTER_PROMO_END).getTime();
}

export function checkoutPriceForPlan(plan: PlanKey, now = new Date()) {
  if (plan === "starter" && isStarterPromoActive(now)) {
    return { price: STARTER_PROMO_PRICE, unitAmount: STARTER_PROMO_UNIT_AMOUNT, promotional: true };
  }
  return { price: PLANS[plan].price, unitAmount: PLANS[plan].unitAmount, promotional: false };
}
