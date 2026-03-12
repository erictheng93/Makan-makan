// Stripe 專用的支付方式映射
export const STRIPE_PAYMENT_METHOD_MAP = {
    credit_card: "card",
    debit_card: "card",
    alipay: "alipay",
    wechat_pay: "wechat_pay",
    grabpay: "grabpay",
    sepa_debit: "sepa_debit",
    ideal: "ideal",
    sofort: "sofort",
    bancontact: "bancontact",
    p24: "p24",
    eps: "eps",
    giropay: "giropay",
    oxxo: "oxxo",
};
// 各國支援的 Stripe 支付方式
export const STRIPE_COUNTRY_METHODS = {
    TW: ["card", "alipay"],
    MY: ["card", "grabpay", "alipay"],
    VN: ["card", "alipay"],
};
// Stripe 貨幣的最小單位
export const STRIPE_CURRENCY_UNITS = {
    TWD: 1, // 台幣：1 元 = 1 單位
    MYR: 100, // 馬來西亞令吉：1 令吉 = 100 分
    VND: 1, // 越南盾：1 盾 = 1 單位
};
