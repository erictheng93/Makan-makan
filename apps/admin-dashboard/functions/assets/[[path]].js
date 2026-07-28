// Vite emits every file here with a content hash in its name, so a given URL
// can never change contents. Serving them through this Function costs that
// caching unless it is restated: Pages rewrites the response to
// `max-age=0, must-revalidate`, which would put a conditional request on the
// wire for every script and stylesheet on every page load.
const IMMUTABLE_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

function isHtmlResponse(response) {
  return response.headers
    .get("Content-Type")
    ?.toLowerCase()
    .startsWith("text/html");
}

function assetNotFoundResponse() {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function onRequest({ request, env }) {
  const response = await env.ASSETS.fetch(request);

  // An asset path that resolves to the SPA shell means the file is not there.
  // Pages answers 200 with index.html, which caches as a success and pins the
  // wrong body to a hashed URL until it expires (#69).
  if (response.status === 404 || isHtmlResponse(response)) {
    return assetNotFoundResponse();
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", IMMUTABLE_ASSET_CACHE_CONTROL);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
