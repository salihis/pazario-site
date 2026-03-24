import { describe, it, expect } from "vitest";
import { XMLParser, XMLParseError } from "../src/services/XMLParser";

describe("XMLParser", () => {
  const parser = new XMLParser();

  it("should parse Google Shopping RSS format", async () => {
    const xml = `
      <rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
        <channel>
          <item>
            <g:id>SKU-001</g:id>
            <g:title>iPhone 15 Pro</g:title>
            <g:description>Latest Apple Phone</g:description>
            <g:price>72000.00 TRY</g:price>
            <g:brand>Apple</g:brand>
            <g:gtin>1234567890123</g:gtin>
            <g:availability>in stock</g:availability>
            <g:image_link>https://example.com/img1.jpg</g:image_link>
          </item>
        </channel>
      </rss>
    `;
    const products = await parser.parse(xml);
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe("SKU-001");
    expect(products[0].name).toBe("iPhone 15 Pro");
    expect(products[0].price).toBe(72000);
  });

  it("should parse custom <products> format", async () => {
    const xml = `
      <products>
        <product>
          <id>P-100</id>
          <title>Samsung S24</title>
          <price>65.000,00 TL</price>
          <stock>10</stock>
          <images>
            <image>https://example.com/img2.jpg</image>
          </images>
        </product>
      </products>
    `;
    const products = await parser.parse(xml);
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe("P-100");
    expect(products[0].price).toBe(65000);
  });

  it("should parse Turkish price format correctly", async () => {
    const prices = [
      { input: "1.299,99 TL", expected: 1299.99 },
      { input: "1299.99 TRY", expected: 1299.99 },
      { input: "₺ 1.299,99", expected: 1299.99 },
      { input: "1299,99", expected: 1299.99 },
    ];

    for (const { input, expected } of prices) {
      const xml = `<products><product><id>1</id><price>${input}</price></product></products>`;
      const products = await parser.parse(xml);
      expect(products[0].price).toBe(expected);
    }
  });

  it("should throw XMLParseError for invalid XML", async () => {
    const xml = `<products><product><id>1</id><price>100</product></products>`; // Missing closing tag
    await expect(parser.parse(xml)).rejects.toThrow(XMLParseError);
  });

  it("should handle empty feed with warning", async () => {
    const xml = `<products></products>`;
    const products = await parser.parse(xml);
    expect(products).toHaveLength(0);
  });

  it("should fix bare & characters and HTML entities", async () => {
    const xml = `
      <products>
        <product>
          <id>1</id>
          <title>R & B Music &amp; Soul</title>
          <price>100</price>
        </product>
      </products>
    `;
    const products = await parser.parse(xml);
    expect(products[0].name).toBe("R & B Music & Soul");
  });
});
