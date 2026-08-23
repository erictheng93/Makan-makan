export function buildDeployPageUrl(host, path, cacheBuster = Date.now()) {
  const target = new URL(path, `https://${host}`);
  target.searchParams.set("cb", String(cacheBuster));
  return target.toString();
}

export function recordBadAsset(badAssets, url, status = "failed") {
  const assetUrl = new URL(url);
  if (!/\/assets\//.test(assetUrl.pathname)) return false;

  badAssets.push(`${status} ${assetUrl.pathname.split("/").pop()}`);
  return true;
}
