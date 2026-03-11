/** Check if a hostname belongs to Cloudflare Images CDN */
export function isCloudflareImagesHostname(hostname: string): boolean {
  return (
    hostname === "imagedelivery.net" ||
    hostname.endsWith(".imagedelivery.net") ||
    hostname === "images.cloudflare.com" ||
    hostname.endsWith(".images.cloudflare.com")
  );
}
