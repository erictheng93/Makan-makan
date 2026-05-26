import { describe, expect, it } from "vitest";
import {
  buildMenuItemImportTemplate,
  parseMenuItemImport,
} from "./menuItemImport";

const categories = [
  { id: 1, name: "主食", sortOrder: 0 },
  { id: 2, name: "飲料", sortOrder: 1 },
];

describe("menu item import parsing", () => {
  it("parses CSV rows into create menu item inputs", () => {
    const result = parseMenuItemImport(
      [
        "name,category,price,description,imageUrl,isFeatured,isAvailable,sortOrder,tags,keywords",
        '"蚵仔煎","主食",7000,"招牌小吃",,true,true,1,"小吃;招牌","蚵仔煎 夜市"',
        '"紅茶","2",2500,"古早味紅茶",https://example.com/tea.jpg,false,true,2,"飲料",""',
      ].join("\n"),
      categories,
    );

    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        name: "蚵仔煎",
        categoryId: 1,
        price: 7000,
        description: "招牌小吃",
        isFeatured: true,
        isAvailable: true,
        sortOrder: 1,
        tags: ["小吃", "招牌"],
        keywords: "蚵仔煎 夜市",
      },
      {
        name: "紅茶",
        categoryId: 2,
        price: 2500,
        description: "古早味紅茶",
        imageUrl: "https://example.com/tea.jpg",
        isFeatured: false,
        isAvailable: true,
        sortOrder: 2,
        tags: ["飲料"],
        keywords: "飲料",
      },
    ]);
  });

  it("reports row-level errors before import", () => {
    const result = parseMenuItemImport(
      [
        "name,category,price,imageUrl,sortOrder",
        ",不存在,-1,not-a-url,-1",
      ].join("\n"),
      categories,
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([
      "第 2 列：name 必填。",
      "第 2 列：category 找不到對應分類。",
      "第 2 列：price 必須是 0 以上整數分。",
      "第 2 列：imageUrl 必須是有效 URL。",
      "第 2 列：sortOrder 必須是 0 以上整數。",
    ]);
  });

  it("builds a spreadsheet-friendly CSV template", () => {
    const template = buildMenuItemImportTemplate("主食");

    expect(template).toContain(
      "name,category,price,description,imageUrl,isFeatured,isAvailable,sortOrder,tags,keywords",
    );
    expect(template).toContain("蚵仔煎");
    expect(template).toContain("主食");
  });
});
