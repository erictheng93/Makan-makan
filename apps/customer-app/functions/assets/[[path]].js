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

  if (response.status === 404 || isHtmlResponse(response)) {
    return assetNotFoundResponse();
  }

  return response;
}
