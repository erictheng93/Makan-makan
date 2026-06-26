let authTokenProvider: () => string | null = () => null;

export function setAuthTokenProvider(provider: () => string | null): void {
  authTokenProvider = provider;
}

export function getAuthToken(): string | null {
  return authTokenProvider();
}
