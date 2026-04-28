const API_BASE_PATH = "/api/v1";

export function apiPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (
    normalizedPath === API_BASE_PATH ||
    normalizedPath.startsWith(`${API_BASE_PATH}/`) ||
    normalizedPath.startsWith(`${API_BASE_PATH}?`)
  ) {
    return normalizedPath;
  }

  return `${API_BASE_PATH}${normalizedPath}`;
}

export function apiUrl(path: string, baseUrl?: string): string {
  if (!baseUrl) {
    return apiPath(path);
  }

  const trimmedBaseUrl = baseUrl.replace(/\/$/, "");
  const baseWithoutApiPath = trimmedBaseUrl.endsWith(API_BASE_PATH)
    ? trimmedBaseUrl.slice(0, -API_BASE_PATH.length)
    : trimmedBaseUrl;

  return `${baseWithoutApiPath}${apiPath(path)}`;
}
