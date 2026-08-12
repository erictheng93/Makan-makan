// Access tokens must remain ephemeral. The HttpOnly refresh cookie is the only
// credential that survives a page reload.
let customerAccessToken: string | null = null;

export const setCustomerAccessToken = (token: string): void => {
  customerAccessToken = token;
};

export const clearCustomerAccessToken = (): void => {
  customerAccessToken = null;
};

export const hasCustomerAccessToken = (): boolean =>
  customerAccessToken !== null;

export const getCustomerAccessToken = (): string | null => customerAccessToken;
