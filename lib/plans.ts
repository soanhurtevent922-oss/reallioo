export const PLANS = {
  starter: {
    key: "starter",
    name: "STARTER",
    price: "9,99 €",
    cadence: "/mois",
    credits: 40,
    creditsLabel: "40 créations / mois",
    env: "STRIPE_PRICE_STARTER",
    mode: "subscription",
  },
  creator: {
    key: "creator",
    name: "CRÉATEUR",
    price: "19,99 €",
    cadence: "/mois",
    credits: 120,
    creditsLabel: "120 créations / mois",
    env: "STRIPE_PRICE_CREATOR",
    mode: "subscription",
    featured: true,
  },
  lifetime: {
    key: "lifetime",
    name: "À VIE",
    price: "99,99 €",
    cadence: "une fois",
    credits: 200,
    creditsLabel: "200 créations incluses",
    env: "STRIPE_PRICE_LIFETIME",
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
