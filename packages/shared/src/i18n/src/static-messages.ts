/**
 * Static message loader for customer-app
 * All locale messages are imported at build time for instant availability
 */

// en-US
import enUSCommon from "./locales/en-US/common.json";
import enUSCustomer from "./locales/en-US/customer.json";

// zh-TW
import zhTWCommon from "./locales/zh-TW/common.json";
import zhTWCustomer from "./locales/zh-TW/customer.json";

// zh-CN
import zhCNCommon from "./locales/zh-CN/common.json";
import zhCNCustomer from "./locales/zh-CN/customer.json";

// vi-VN
import viVNCommon from "./locales/vi-VN/common.json";
import viVNCustomer from "./locales/vi-VN/customer.json";

// ms-MY
import msMYCommon from "./locales/ms-MY/common.json";
import msMYCustomer from "./locales/ms-MY/customer.json";

// id-ID
import idIDCommon from "./locales/id-ID/common.json";
import idIDCustomer from "./locales/id-ID/customer.json";

import type { SupportedLocale } from "./types";

function mergeMessages(
  common: Record<string, any>,
  customer: Record<string, any>,
) {
  return { ...common, ...customer };
}

export function getCustomerMessages(): Record<
  SupportedLocale,
  Record<string, any>
> {
  return {
    "en-US": mergeMessages(enUSCommon, enUSCustomer),
    "zh-TW": mergeMessages(zhTWCommon, zhTWCustomer),
    "zh-CN": mergeMessages(zhCNCommon, zhCNCustomer),
    "vi-VN": mergeMessages(viVNCommon, viVNCustomer),
    "ms-MY": mergeMessages(msMYCommon, msMYCustomer),
    "id-ID": mergeMessages(idIDCommon, idIDCustomer),
  };
}

export function getAdminMessages(): Record<string, Record<string, any>> {
  // Placeholder for future admin-dashboard integration
  return {
    "en-US": enUSCommon,
    "zh-TW": zhTWCommon,
  };
}
