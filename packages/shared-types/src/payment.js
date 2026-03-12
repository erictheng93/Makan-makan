export class PaymentProvider {
    constructor(config) {
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config
        });
    }
    convertAmount(amount, fromCurrency, toCurrency) {
        // 基礎貨幣轉換邏輯（實際應該使用即時匯率API）
        if (fromCurrency === toCurrency)
            return amount;
        // 暫時使用固定匯率（實際應該動態取得）
        const rates = {
            TWD: 31.0, // 1 USD = 31 TWD
            MYR: 4.7, // 1 USD = 4.7 MYR
            VND: 24000, // 1 USD = 24000 VND
        };
        return Math.round(amount * (rates[toCurrency] / rates[fromCurrency]));
    }
    formatAmount(amount, currency) {
        const formatters = {
            TWD: new Intl.NumberFormat("zh-TW", {
                style: "currency",
                currency: "TWD",
            }),
            MYR: new Intl.NumberFormat("ms-MY", {
                style: "currency",
                currency: "MYR",
            }),
            VND: new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
            }),
        };
        return formatters[currency].format(amount);
    }
}
