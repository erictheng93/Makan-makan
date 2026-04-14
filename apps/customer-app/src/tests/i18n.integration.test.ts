/**
 * Module integration test: exercises interaction between i18n module and locale
 * consistency checker across all supported languages. This is NOT an end-to-end
 * API integration test — it does not hit routes or D1.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  i18n,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  switchLanguage,
} from "@/i18n";
import type { SupportedLanguage } from "@/i18n";

// Helper to avoid TS2589

const tGlobal = (key: string, params?: Record<string, any>): string =>
  params ? (i18n.global as any).t(key, params) : (i18n.global as any).t(key);

const ALL_LOCALES: SupportedLanguage[] = [
  "zh-TW",
  "zh-CN",
  "en-US",
  "vi-VN",
  "ms-MY",
  "id-ID",
];

/**
 * Helper: assert a list of keys exist and are non-empty in all 6 locales.
 */
function assertKeysInAllLocales(keys: string[]) {
  ALL_LOCALES.forEach((locale) => {
    switchLanguage(locale);
    keys.forEach((key) => {
      const val = tGlobal(key);
      expect(val, `${key} missing in ${locale}`).not.toBe(key);
      expect(val, `${key} empty in ${locale}`).toBeTruthy();
    });
  });
}

describe("i18n Integration Tests", () => {
  beforeEach(() => {
    i18n.global.locale.value = DEFAULT_LANGUAGE;
  });

  // ---------------------------------------------------------------
  // 1. Auth Section
  // ---------------------------------------------------------------
  describe("Auth Section", () => {
    const authKeys = [
      "auth.login",
      "auth.register",
      "auth.memberLogin",
      "auth.memberRegister",
      "auth.username",
      "auth.password",
      "auth.displayName",
      "auth.email",
      "auth.phone",
      "auth.usernamePlaceholder",
      "auth.passwordPlaceholder",
      "auth.passwordPlaceholderWithMin",
      "auth.displayNamePlaceholder",
      "auth.emailPlaceholder",
      "auth.phonePlaceholder",
      "auth.confirmPassword",
      "auth.confirmPasswordPlaceholder",
      "auth.forgotPassword",
      "auth.noAccount",
      "auth.hasAccount",
      "auth.registerNow",
      "auth.loginNow",
      "auth.guestBrowse",
      "auth.loggingIn",
      "auth.registering",
      "auth.loginFailed",
      "auth.loginError",
      "auth.registerFailed",
      "auth.registerError",
      "auth.usernameRequired",
      "auth.usernameMinLength",
      "auth.passwordRequired",
      "auth.passwordMinLength",
      "auth.displayNameRequired",
      "auth.confirmPasswordRequired",
      "auth.passwordMismatch",
      "auth.invalidEmail",
      "auth.invalidPhone",
      "auth.forgotPasswordTitle",
      "auth.forgotPasswordDesc",
      "auth.emailAddress",
      "auth.sendResetLink",
      "auth.sending",
      "auth.backToLogin",
      "auth.backToLoginArrow",
      "auth.resetLinkSent",
      "auth.resetLinkFailed",
      "auth.checkEmailInfo",
      "auth.noEmailReceived",
      "auth.checkSpam",
      "auth.confirmEmailCorrect",
      "auth.waitAndRetry",
      "auth.emailRequired",
      "auth.invalidEmailAddress",
      "auth.resetPassword",
      "auth.newPassword",
      "auth.newPasswordPlaceholder",
      "auth.resetting",
      "auth.resetSuccess",
      "auth.resetPasswordMessage",
      "auth.resetPasswordFailed",
      "auth.goToLogin",
      "auth.verifyingLink",
      "auth.linkInvalid",
      "auth.resendLink",
      "auth.tokenInvalid",
      "auth.tokenVerifyError",
      "auth.missingToken",
      "auth.passwordStrength.weak",
      "auth.passwordStrength.medium",
      "auth.passwordStrength.good",
      "auth.passwordStrength.strong",
      "auth.passwordStrength.veryStrong",
      "auth.verifyEmail",
      "auth.verifying",
      "auth.verifyingDesc",
      "auth.verifySuccess",
      "auth.verifyFailed",
      "auth.verifyError",
      "auth.verifyNowYouCan",
      "auth.verifyFullOrdering",
      "auth.verifyManageProfile",
      "auth.verifyOrderHistory",
      "auth.verifyExclusive",
      "auth.startOrdering",
      "auth.viewProfile",
      "auth.possibleReasons",
      "auth.linkExpired",
      "auth.linkUsed",
      "auth.linkInvalidReason",
      "auth.resendVerification",
      "auth.missingVerifyToken",
      "auth.resendVerificationSuccess",
      "auth.resendFailed",
    ];

    it("should have all auth keys in all 6 locales", () => {
      assertKeysInAllLocales(authKeys);
    });

    it("should translate auth.login correctly", () => {
      switchLanguage("zh-TW");
      expect(tGlobal("auth.login")).toBe("登入");
      switchLanguage("en-US");
      expect(tGlobal("auth.login")).toBe("Login");
    });

    it("should translate auth.memberLogin correctly", () => {
      switchLanguage("zh-TW");
      expect(tGlobal("auth.memberLogin")).toBe("會員登入");
      switchLanguage("en-US");
      expect(tGlobal("auth.memberLogin")).toBe("Member Login");
    });

    it("should handle auth.resetPasswordDesc with username param", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("auth.resetPasswordDesc", {
          username: "testuser",
        });
        expect(result).toContain("testuser");
        expect(result).not.toBe("auth.resetPasswordDesc");
      });
    });
  });

  // ---------------------------------------------------------------
  // 2. Toast Section
  // ---------------------------------------------------------------
  describe("Toast Section", () => {
    const toastKeys = [
      "toast.orderSubmitSuccess",
      "toast.orderSubmitFailed",
      "toast.cartCannotBeEmpty",
      "toast.scanSuccess",
      "toast.cameraInitFailed",
      "toast.flashToggleFailed",
      "toast.couponFailed",
      "toast.couponValidationError",
      "toast.couponCodeRequired",
      "toast.couponCodeTooLong",
      "toast.couponCodeInvalidChars",
      "toast.deliveryAddressRequired",
      "toast.invalidPhoneNumber",
      "toast.orderCancelFailed",
      "toast.appLoadFailed",
      "toast.unexpectedError",
      "toast.cameraNotSupported",
      "toast.orderSent",
      "toast.orderSendFailed",
      "toast.orderCancelled",
      "toast.cancelOrderFailed",
      "toast.scanFailed",
      "toast.invalidQRFormat",
      "toast.qrValidationFailed",
      "toast.unsupportedQRType",
      "toast.qrProcessError",
      "toast.cameraAccessFailed",
      "toast.cameraPermissionRequired",
      "toast.noCameraFound",
      "toast.browserNoCamera",
      "toast.errorReportCopied",
      "toast.verificationSuccess",
      "toast.preparingMenu",
      "toast.restaurantLoadFailed",
      "toast.invalidQRCode",
      "toast.shopModeNotEnabled",
      "toast.phoneVerifyError",
      "toast.orderConfirmed",
      "toast.orderPreparing",
      "toast.orderReady",
      "toast.orderDelivered",
    ];

    it("should have all toast keys in all 6 locales", () => {
      assertKeysInAllLocales(toastKeys);
    });

    it("should handle toast.itemRemoved with name param", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("toast.itemRemoved", { name: "Pizza" });
        expect(result).toContain("Pizza");
        expect(result).not.toBe("toast.itemRemoved");
      });
    });

    it("should handle toast.itemAdded with name and quantity params", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("toast.itemAdded", {
          name: "Burger",
          quantity: 2,
        });
        expect(result).toContain("Burger");
        expect(result).toContain("2");
        expect(result).not.toBe("toast.itemAdded");
      });
    });

    it("should handle toast.scanTypeDetected with type param", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("toast.scanTypeDetected", { type: "QR" });
        expect(result).toContain("QR");
        expect(result).not.toBe("toast.scanTypeDetected");
      });
    });

    it("should handle toast.orderStatusUpdated with status param", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("toast.orderStatusUpdated", {
          status: "Ready",
        });
        expect(result).toContain("Ready");
        expect(result).not.toBe("toast.orderStatusUpdated");
      });
    });
  });

  // ---------------------------------------------------------------
  // 3. OrderTracking Section
  // ---------------------------------------------------------------
  describe("OrderTracking Section", () => {
    const orderTrackingKeys = [
      "orderTracking.title",
      "orderTracking.orderNumber",
      "orderTracking.loadingOrder",
      "orderTracking.loadFailed",
      "orderTracking.reload",
      "orderTracking.orderProgress",
      "orderTracking.orderTimeline",
      "orderTracking.orderDetails",
      "orderTracking.orderTime",
      "orderTracking.customerName",
      "orderTracking.tableNumber",
      "orderTracking.orderedItems",
      "orderTracking.orderNotes",
      "orderTracking.cancelOrder",
      "orderTracking.continueOrdering",
      "orderTracking.confirmCancel",
      "orderTracking.confirmCancelMessage",
      "orderTracking.confirmCancelBtn",
      "orderTracking.keepOrder",
      "orderTracking.reconnecting",
      // Nested timeline
      "orderTracking.timeline.created",
      "orderTracking.timeline.createdDesc",
      "orderTracking.timeline.confirmed",
      "orderTracking.timeline.confirmedDesc",
      "orderTracking.timeline.preparing",
      "orderTracking.timeline.preparingDesc",
      "orderTracking.timeline.ready",
      "orderTracking.timeline.readyDesc",
      "orderTracking.timeline.served",
      "orderTracking.timeline.servedDesc",
      "orderTracking.timeline.cancelled",
      "orderTracking.timeline.cancelledDesc",
      // Nested status
      "orderTracking.status.pending",
      "orderTracking.status.confirmed",
      "orderTracking.status.preparing",
      "orderTracking.status.ready",
      "orderTracking.status.served",
      "orderTracking.status.cancelled",
      "orderTracking.status.paid",
    ];

    it("should have all orderTracking keys in all 6 locales", () => {
      assertKeysInAllLocales(orderTrackingKeys);
    });

    it("should handle orderTracking.estimatedMinutes with minutes param", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("orderTracking.estimatedMinutes", {
          minutes: 15,
        });
        expect(result).toContain("15");
        expect(result).not.toBe("orderTracking.estimatedMinutes");
      });
    });
  });

  // ---------------------------------------------------------------
  // 4. OrderHistory Section
  // ---------------------------------------------------------------
  describe("OrderHistory Section", () => {
    const orderHistoryKeys = [
      "orderHistory.title",
      "orderHistory.personalCenter",
      "orderHistory.logout",
      "orderHistory.statusFilter",
      "orderHistory.allStatus",
      "orderHistory.statusPending",
      "orderHistory.statusConfirmed",
      "orderHistory.statusPreparing",
      "orderHistory.statusCompleted",
      "orderHistory.statusServed",
      "orderHistory.statusPaid",
      "orderHistory.statusCancelled",
      "orderHistory.startDate",
      "orderHistory.endDate",
      "orderHistory.resetFilter",
      "orderHistory.noOrders",
      "orderHistory.noOrdersDesc",
      "orderHistory.startOrdering",
      "orderHistory.restaurant",
      "orderHistory.table",
      "orderHistory.paid",
      "orderHistory.unpaid",
      "orderHistory.viewDetails",
      "orderHistory.cancelOrder",
      "orderHistory.prevPage",
      "orderHistory.nextPage",
      "orderHistory.confirmCancelOrder",
      "orderHistory.confirmLogout",
      "orderHistory.customerCancelled",
    ];

    it("should have all orderHistory keys in all 6 locales", () => {
      assertKeysInAllLocales(orderHistoryKeys);
    });

    it("should handle orderHistory.itemCount with count param", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("orderHistory.itemCount", { count: 5 });
        expect(result).toContain("5");
        expect(result).not.toBe("orderHistory.itemCount");
      });
    });

    it("should handle orderHistory.pageInfo with params", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("orderHistory.pageInfo", {
          current: 1,
          total: 3,
          count: 25,
        });
        expect(result).toContain("1");
        expect(result).toContain("3");
        expect(result).toContain("25");
      });
    });
  });

  // ---------------------------------------------------------------
  // 5. ShopCart Section
  // ---------------------------------------------------------------
  describe("ShopCart Section", () => {
    const shopCartKeys = [
      "shopCart.title",
      "shopCart.empty",
      "shopCart.pickupMethod",
      "shopCart.takeaway",
      "shopCart.delivery",
      "shopCart.deliveryAddress",
      "shopCart.deliveryAddressPlaceholder",
      "shopCart.contactPhone",
      "shopCart.contactPhonePlaceholder",
      "shopCart.deliveryNotes",
      "shopCart.deliveryNotesPlaceholder",
      "shopCart.estimatedPickup",
      "shopCart.estimatedTime",
      "shopCart.notes",
      "shopCart.subtotal",
      "shopCart.deliveryFee",
      "shopCart.total",
      "shopCart.pickupNumber",
      "shopCart.confirmOrder",
      "shopCart.processing",
    ];

    it("should have all shopCart keys in all 6 locales", () => {
      assertKeysInAllLocales(shopCartKeys);
    });
  });

  // ---------------------------------------------------------------
  // 6. ErrorBoundary Section
  // ---------------------------------------------------------------
  describe("ErrorBoundary Section", () => {
    const errorBoundaryKeys = [
      "errorBoundary.reload",
      "errorBoundary.goHome",
      "errorBoundary.showDetails",
      "errorBoundary.persistentIssue",
      "errorBoundary.reportIssue",
      "errorBoundary.networkErrorTitle",
      "errorBoundary.networkErrorMessage",
      "errorBoundary.notFoundTitle",
      "errorBoundary.notFoundMessage",
      "errorBoundary.permissionTitle",
      "errorBoundary.permissionMessage",
      "errorBoundary.defaultTitle",
      "errorBoundary.defaultMessage",
      "errorBoundary.copyErrorReport",
    ];

    it("should have all errorBoundary keys in all 6 locales", () => {
      assertKeysInAllLocales(errorBoundaryKeys);
    });
  });

  // ---------------------------------------------------------------
  // 7. ManualInput Section
  // ---------------------------------------------------------------
  describe("ManualInput Section", () => {
    const manualInputKeys = [
      "manualInput.title",
      "manualInput.restaurantName",
      "manualInput.restaurantNamePlaceholder",
      "manualInput.helpTitle",
      "manualInput.helpDesc",
      "manualInput.verifying",
      "manualInput.searching",
      "manualInput.noResults",
      "manualInput.restaurantRequired",
    ];

    it("should have all manualInput keys in all 6 locales", () => {
      assertKeysInAllLocales(manualInputKeys);
    });
  });

  // ---------------------------------------------------------------
  // 8. QRScanView Section
  // ---------------------------------------------------------------
  describe("QRScanView Section", () => {
    const qrScanViewKeys = [
      "qrScanView.title",
      "qrScanView.instruction",
      "qrScanView.manualInputLink",
      "qrScanView.scanFailed",
      "qrScanView.processing",
      "qrScanView.startingCamera",
      "qrScanView.aimAtQR",
    ];

    it("should have all qrScanView keys in all 6 locales", () => {
      assertKeysInAllLocales(qrScanViewKeys);
    });
  });

  // ---------------------------------------------------------------
  // 9. ShopMenu Section
  // ---------------------------------------------------------------
  describe("ShopMenu Section", () => {
    const shopMenuKeys = [
      "shopMenu.loadingMenu",
      "shopMenu.loadFailed",
      "shopMenu.reload",
      "shopMenu.searchPlaceholder",
      "shopMenu.recommended",
      "shopMenu.noItemsInCategory",
      "shopMenu.noResults",
      "shopMenu.tryOtherKeywords",
      "shopMenu.viewCart",
      "shopMenu.shopOrdering",
    ];

    it("should have all shopMenu keys in all 6 locales", () => {
      assertKeysInAllLocales(shopMenuKeys);
    });
  });

  // ---------------------------------------------------------------
  // 10. PhoneVerification Section
  // ---------------------------------------------------------------
  describe("PhoneVerification Section", () => {
    const phoneVerificationKeys = [
      "phoneVerification.title",
      "phoneVerification.enterLastDigits",
      "phoneVerification.forIdentification",
      "phoneVerification.lastDigits",
      "phoneVerification.placeholder",
      "phoneVerification.example",
      "phoneVerification.startOrdering",
      "phoneVerification.verifyingStatus",
      "phoneVerification.whyNeeded",
      "phoneVerification.whyNeededDesc",
    ];

    it("should have all phoneVerification keys in all 6 locales", () => {
      assertKeysInAllLocales(phoneVerificationKeys);
    });
  });

  // ---------------------------------------------------------------
  // 11. MenuItemCard and MenuItemModal Sections
  // ---------------------------------------------------------------
  describe("MenuItemCard Section", () => {
    const menuItemCardKeys = [
      "menuItemCard.featured",
      "menuItemCard.unavailable",
      "menuItemCard.soldOut",
      "menuItemCard.addToCart",
      "menuItemCard.selectSpec",
    ];

    it("should have all menuItemCard keys in all 6 locales", () => {
      assertKeysInAllLocales(menuItemCardKeys);
    });

    it("should handle menuItemCard.orderedCount with count param", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("menuItemCard.orderedCount", { count: 42 });
        expect(result).toContain("42");
        expect(result).not.toBe("menuItemCard.orderedCount");
      });
    });
  });

  describe("MenuItemModal Section", () => {
    const menuItemModalKeys = [
      "menuItemModal.featured",
      "menuItemModal.quantity",
      "menuItemModal.notesLabel",
      "menuItemModal.notesPlaceholder",
      "menuItemModal.unavailable",
      "menuItemModal.soldOut",
    ];

    it("should have all menuItemModal keys in all 6 locales", () => {
      assertKeysInAllLocales(menuItemModalKeys);
    });
  });

  // ---------------------------------------------------------------
  // 12. OrderItem Section
  // ---------------------------------------------------------------
  describe("OrderItem Section", () => {
    const orderItemKeys = [
      "orderItem.unknownItem",
      "orderItem.notes",
      "orderItem.statusPending",
      "orderItem.statusPreparing",
      "orderItem.statusReady",
      "orderItem.statusServed",
    ];

    it("should have all orderItem keys in all 6 locales", () => {
      assertKeysInAllLocales(orderItemKeys);
    });
  });

  // ---------------------------------------------------------------
  // 13. Group Section
  // ---------------------------------------------------------------
  describe("Group Section", () => {
    const groupKeys = [
      "group.sharedCart",
      "group.members",
      "group.unknownMember",
      "group.me",
      "group.online",
      "group.emptyCart",
      "group.startAdding",
      "group.splitMethod",
      "group.total",
      "group.myShare",
      "group.perPerson",
      "group.customShares",
      "group.sharesMustEqual100",
      "group.selectPayer",
      "group.split.equal",
      "group.split.equalDesc",
      "group.split.by_item",
      "group.split.byItem",
      "group.split.byItemDesc",
      "group.split.custom",
      "group.split.customDesc",
      "group.split.single_payer",
      "group.split.singlePayer",
      "group.split.singlePayerDesc",
    ];

    it("should have all group keys in all 6 locales", () => {
      assertKeysInAllLocales(groupKeys);
    });
  });

  // ---------------------------------------------------------------
  // 14. Navigation Section (route titles)
  // ---------------------------------------------------------------
  describe("Navigation Section", () => {
    const navigationKeys = [
      "navigation.home",
      "navigation.menu",
      "navigation.cart",
      "navigation.orders",
      "navigation.profile",
      "navigation.about",
      "navigation.privacy",
      "navigation.terms",
      "navigation.contact",
      "navigation.help",
      "navigation.appTitle",
      "navigation.login",
      "navigation.register",
      "navigation.forgotPassword",
      "navigation.resetPassword",
      "navigation.verifyEmail",
      "navigation.myOrders",
      "navigation.orderDetail",
      "navigation.profileCenter",
      "navigation.browseMenu",
      "navigation.scanQR",
      "navigation.orderTypeSelect",
      "navigation.verifyPhone",
      "navigation.shopMenu",
      "navigation.shoppingCart",
      "navigation.orderTracking",
      "navigation.error",
      "navigation.pageNotFound",
    ];

    it("should have all navigation keys in all 6 locales", () => {
      assertKeysInAllLocales(navigationKeys);
    });

    it("should translate navigation.home correctly", () => {
      switchLanguage("zh-TW");
      expect(tGlobal("navigation.home")).toBe("首頁");
      switchLanguage("en-US");
      expect(tGlobal("navigation.home")).toBe("Home");
    });
  });

  // ---------------------------------------------------------------
  // 15. Format Section (day names, status text)
  // ---------------------------------------------------------------
  describe("Format Section", () => {
    const formatKeys = [
      "format.businessHoursNotSet",
      "format.monday",
      "format.tuesday",
      "format.wednesday",
      "format.thursday",
      "format.friday",
      "format.saturday",
      "format.sunday",
      "format.closed",
      "format.unknown",
      "format.notSet",
      "format.spiceNone",
      "format.spiceMild",
      "format.spiceLight",
      "format.spiceMedium",
      "format.spiceHot",
      "format.orderPending",
      "format.orderConfirmed",
      "format.orderPreparing",
      "format.orderReady",
      "format.orderDelivered",
      "format.orderPaid",
      "format.orderCancelled",
      "format.unknownStatus",
    ];

    it("should have all format keys in all 6 locales", () => {
      assertKeysInAllLocales(formatKeys);
    });

    it("should handle format.noItems with item param", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("format.noItems", { item: "test" });
        expect(result).not.toBe("format.noItems");
      });
    });

    it("should translate day names correctly in en-US", () => {
      switchLanguage("en-US");
      expect(tGlobal("format.monday")).toBe("Mon");
      expect(tGlobal("format.sunday")).toBe("Sun");
    });

    it("should translate day names correctly in zh-TW", () => {
      switchLanguage("zh-TW");
      expect(tGlobal("format.monday")).toBe("週一");
      expect(tGlobal("format.sunday")).toBe("週日");
    });
  });

  // ---------------------------------------------------------------
  // 16. Errors Section (API error messages)
  // ---------------------------------------------------------------
  describe("Errors Section", () => {
    const errorsKeys = [
      "errors.general",
      "errors.generalDesc",
      "errors.network",
      "errors.networkDesc",
      "errors.notFound",
      "errors.notFoundDesc",
      "errors.unauthorized",
      "errors.unauthorizedDesc",
      "errors.serverError",
      "errors.serverErrorDesc",
      "errors.timeout",
      "errors.timeoutDesc",
      "errors.validation",
      "errors.validationDesc",
      "errors.restaurantNotFound",
      "errors.tableNotFound",
      "errors.menuNotAvailable",
      "errors.orderFailed",
      "errors.paymentFailed",
      "errors.invalidRestaurantOrTable",
      "errors.routeLoadFailed",
      "errors.unknown",
      "errors.requestFailed",
      "errors.badRequest",
      "errors.forbidden",
      "errors.notFoundResource",
      "errors.conflict",
      "errors.tooManyRequests",
      "errors.internalServerError",
      "errors.badGateway",
      "errors.serviceUnavailable",
      "errors.gatewayTimeout",
    ];

    it("should have all errors keys in all 6 locales", () => {
      assertKeysInAllLocales(errorsKeys);
    });

    it("should translate errors.general correctly", () => {
      switchLanguage("zh-TW");
      expect(tGlobal("errors.general")).toBe("發生錯誤");
      switchLanguage("en-US");
      expect(tGlobal("errors.general")).toBe("An Error Occurred");
    });
  });

  // ---------------------------------------------------------------
  // 17. Privacy Section
  // ---------------------------------------------------------------
  describe("Privacy Section", () => {
    const privacyKeys = [
      "privacy.title",
      "privacy.dataCollection.title",
      "privacy.dataCollection.description",
      "privacy.dataUsage.title",
      "privacy.dataUsage.description",
      "privacy.dataProtection.title",
      "privacy.dataProtection.description",
      "privacy.contact.title",
      "privacy.contact.description",
    ];

    it("should have all privacy keys in all 6 locales", () => {
      assertKeysInAllLocales(privacyKeys);
    });
  });

  // ---------------------------------------------------------------
  // 18. Terms Section
  // ---------------------------------------------------------------
  describe("Terms Section", () => {
    const termsKeys = [
      "terms.title",
      "terms.usage.title",
      "terms.usage.description",
      "terms.responsibility.title",
      "terms.responsibility.description",
      "terms.disclaimer.title",
      "terms.disclaimer.description",
      "terms.changes.title",
      "terms.changes.description",
    ];

    it("should have all terms keys in all 6 locales", () => {
      assertKeysInAllLocales(termsKeys);
    });
  });

  // ---------------------------------------------------------------
  // 19. About Section
  // ---------------------------------------------------------------
  describe("About Section", () => {
    const aboutKeys = [
      "about.title",
      "about.description",
      "about.features.title",
      "about.features.qrOrder",
      "about.features.tracking",
      "about.features.payment",
      "about.features.customization",
      "about.features.management",
      "about.contact.title",
      "about.contact.description",
    ];

    it("should have all about keys in all 6 locales", () => {
      assertKeysInAllLocales(aboutKeys);
    });
  });

  // ---------------------------------------------------------------
  // 20. Profile Section
  // ---------------------------------------------------------------
  describe("Profile Section", () => {
    const profileKeys = [
      "profile.title",
      "profile.pageTitle",
      "profile.name",
      "profile.email",
      "profile.phone",
      "profile.preferences",
      "profile.language",
      "profile.notifications",
      "profile.orderHistory",
      "profile.favorites",
      "profile.logout",
      "profile.notSet",
      "profile.quickActions",
      "profile.viewOrderHistory",
      "profile.browseMenu",
      "profile.viewRestaurantMenu",
      "profile.accountSettings",
      "profile.logoutAccount",
    ];

    it("should have all profile keys in all 6 locales", () => {
      assertKeysInAllLocales(profileKeys);
    });

    it("should translate profile.title correctly", () => {
      switchLanguage("zh-TW");
      expect(tGlobal("profile.title")).toBe("個人資料");
      switchLanguage("en-US");
      expect(tGlobal("profile.title")).toBe("Profile");
    });
  });

  // ---------------------------------------------------------------
  // 21. Parameterized Translations Across All 6 Locales
  // ---------------------------------------------------------------
  describe("Parameterized Translations", () => {
    it("should handle cart.itemCount with count param in all locales", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("cart.itemCount", { count: 7 });
        expect(result, `cart.itemCount in ${locale}`).toContain("7");
        expect(result).not.toBe("cart.itemCount");
      });
    });

    it("should handle validation.minLength with min param in all locales", () => {
      ALL_LOCALES.forEach((locale) => {
        switchLanguage(locale);
        const result = tGlobal("validation.minLength", { min: 10 });
        expect(result, `validation.minLength in ${locale}`).toContain("10");
        expect(result).not.toBe("validation.minLength");
      });
    });

    it("should render specific parameterized values correctly", () => {
      switchLanguage("zh-TW");
      expect(tGlobal("validation.minLength", { min: 6 })).toBe(
        "至少需要 6 個字元",
      );

      switchLanguage("zh-CN");
      expect(tGlobal("validation.minLength", { min: 6 })).toBe(
        "至少需要 6 个字符",
      );

      switchLanguage("en-US");
      expect(tGlobal("validation.minLength", { min: 6 })).toBe(
        "Minimum 6 characters required",
      );

      switchLanguage("vi-VN");
      expect(tGlobal("validation.minLength", { min: 6 })).toBe(
        "Ít nhất 6 ký tự là bắt buộc",
      );

      switchLanguage("ms-MY");
      expect(tGlobal("validation.minLength", { min: 6 })).toBe(
        "Minimum 6 aksara diperlukan",
      );

      switchLanguage("id-ID");
      expect(tGlobal("validation.minLength", { min: 6 })).toBe(
        "Minimal 6 karakter diperlukan",
      );
    });
  });

  // ---------------------------------------------------------------
  // 22. ms-MY and id-ID Specific Validation
  // ---------------------------------------------------------------
  describe("ms-MY and id-ID Specific Validation", () => {
    it("should have non-empty translations for ms-MY core keys", () => {
      switchLanguage("ms-MY");
      expect(tGlobal("common.confirm")).toBeTruthy();
      expect(tGlobal("common.cancel")).toBeTruthy();
      expect(tGlobal("common.loading")).toBeTruthy();
      expect(tGlobal("home.title")).toBeTruthy();
      expect(tGlobal("menu.title")).toBeTruthy();
      expect(tGlobal("cart.title")).toBeTruthy();
      expect(tGlobal("order.title")).toBeTruthy();
      expect(tGlobal("auth.login")).toBeTruthy();
      expect(tGlobal("auth.register")).toBeTruthy();
      expect(tGlobal("errors.general")).toBeTruthy();
    });

    it("should have non-empty translations for id-ID core keys", () => {
      switchLanguage("id-ID");
      expect(tGlobal("common.confirm")).toBeTruthy();
      expect(tGlobal("common.cancel")).toBeTruthy();
      expect(tGlobal("common.loading")).toBeTruthy();
      expect(tGlobal("home.title")).toBeTruthy();
      expect(tGlobal("menu.title")).toBeTruthy();
      expect(tGlobal("cart.title")).toBeTruthy();
      expect(tGlobal("order.title")).toBeTruthy();
      expect(tGlobal("auth.login")).toBeTruthy();
      expect(tGlobal("auth.register")).toBeTruthy();
      expect(tGlobal("errors.general")).toBeTruthy();
    });

    it("should have ms-MY translations that are different from en-US", () => {
      switchLanguage("en-US");
      const enConfirm = tGlobal("common.confirm");
      const enLoading = tGlobal("common.loading");

      switchLanguage("ms-MY");
      const msConfirm = tGlobal("common.confirm");
      const msLoading = tGlobal("common.loading");

      // ms-MY should have its own translations, not just copies of en-US
      expect(msConfirm).toBeTruthy();
      expect(msLoading).toBeTruthy();
      // At least one should differ from English
      const hasDifference = msConfirm !== enConfirm || msLoading !== enLoading;
      expect(hasDifference).toBe(true);
    });

    it("should have id-ID translations that are different from en-US", () => {
      switchLanguage("en-US");
      const enConfirm = tGlobal("common.confirm");
      const enLoading = tGlobal("common.loading");

      switchLanguage("id-ID");
      const idConfirm = tGlobal("common.confirm");
      const idLoading = tGlobal("common.loading");

      expect(idConfirm).toBeTruthy();
      expect(idLoading).toBeTruthy();
      const hasDifference = idConfirm !== enConfirm || idLoading !== enLoading;
      expect(hasDifference).toBe(true);
    });

    it("should have ms-MY and id-ID with all new sections", () => {
      const sectionPrefixes = [
        "auth.login",
        "toast.orderSubmitSuccess",
        "orderTracking.title",
        "orderHistory.title",
        "shopCart.title",
        "errorBoundary.reload",
        "manualInput.title",
        "qrScanView.title",
        "shopMenu.loadingMenu",
        "phoneVerification.title",
        "menuItemCard.featured",
        "menuItemModal.featured",
        "orderItem.unknownItem",
        "group.sharedCart",
        "format.monday",
        "privacy.title",
        "terms.title",
        "about.title",
        "profile.title",
      ];

      (["ms-MY", "id-ID"] as SupportedLanguage[]).forEach((locale) => {
        switchLanguage(locale);
        sectionPrefixes.forEach((key) => {
          const val = tGlobal(key);
          expect(val, `${key} missing in ${locale}`).not.toBe(key);
          expect(val, `${key} empty in ${locale}`).toBeTruthy();
        });
      });
    });
  });

  // ---------------------------------------------------------------
  // 23. Additional Sections: Messages, OrderTypeLanding, ErrorView
  // ---------------------------------------------------------------
  describe("Messages Section", () => {
    const messagesKeys = ["messages.networkError", "messages.sessionExpired"];

    it("should have all messages keys in all 6 locales", () => {
      assertKeysInAllLocales(messagesKeys);
    });
  });

  describe("OrderTypeLanding Section", () => {
    const keys = [
      "orderTypeLanding.selectMethod",
      "orderTypeLanding.takeaway",
      "orderTypeLanding.takeawayDesc",
      "orderTypeLanding.delivery",
      "orderTypeLanding.deliveryDesc",
      "orderTypeLanding.continue",
    ];

    it("should have all orderTypeLanding keys in all 6 locales", () => {
      assertKeysInAllLocales(keys);
    });
  });

  describe("ErrorView Section", () => {
    const keys = ["errorView.retry", "errorView.goHome"];

    it("should have all errorView keys in all 6 locales", () => {
      assertKeysInAllLocales(keys);
    });
  });
});
