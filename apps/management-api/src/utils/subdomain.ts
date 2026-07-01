import { pinyin } from "pinyin-pro";

export function createSubdomainBase(businessName: string): string {
  const romanizedName = pinyin(businessName, {
    toneType: "none",
    separator: " ",
    nonZh: "consecutive",
    traditional: true,
    v: true,
  });

  return romanizedName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}
