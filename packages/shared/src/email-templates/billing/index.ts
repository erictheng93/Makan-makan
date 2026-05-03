export type BillingTemplateKind = "trial_3d" | "trial_0d" | "payment_failed";

const SUBJECTS: Record<BillingTemplateKind, string> = {
  trial_3d: "Your MakanMasak trial ends in 3 days",
  trial_0d: "Your MakanMasak trial has ended",
  payment_failed: "MakanMasak billing payment failed",
};

export function renderBillingEmail(
  kind: BillingTemplateKind,
  data: { restaurantName?: string; actionUrl?: string } = {},
) {
  const restaurantName = data.restaurantName ?? "your restaurant";
  const action = data.actionUrl ? `\nManage billing: ${data.actionUrl}` : "";

  if (kind === "payment_failed") {
    return {
      subject: SUBJECTS[kind],
      text: `We could not complete billing for ${restaurantName}. Please update the payment method to keep modules active.${action}`,
    };
  }

  if (kind === "trial_0d") {
    return {
      subject: SUBJECTS[kind],
      text: `The MakanMasak trial for ${restaurantName} has ended. The subscription has moved to the basic plan.${action}`,
    };
  }

  return {
    subject: SUBJECTS[kind],
    text: `The MakanMasak trial for ${restaurantName} ends in 3 days.${action}`,
  };
}
