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

export type PlanKey = keyof typeof PLANS;

export function isPlanKey(value: string): value is PlanKey {
  return value in PLANS;
}

export function creditsForPlan(plan: PlanKey) {
  return PLANS[plan].credits;
}

export function checkoutPriceForPlan(plan: PlanKey) {
  return { price: PLANS[plan].price, unitAmount: PLANS[plan].unitAmount };
}
