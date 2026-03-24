import { describe, it, expect } from "vitest";
import { ProductValidator } from "../src/validators/ProductValidator";
import { Marketplace } from "@prisma/client";
import { ParsedProduct } from "../src/parser/XMLParser";

describe("ProductValidator", () => {
  const validProduct: ParsedProduct = {
    id: "SKU-001",
    sku: "SKU-001",
    barcode: "1234567890123",
    title: "iPhone 15 Pro",
    description: "Latest Apple Phone with amazing camera and performance. This is a long description to satisfy N11 rules.",
    brand: "Apple",
    category: "Elektronik > Telefon",
    price: 72000,
    listPrice: null,
    currency: "TRY",
    stock: 10,
    images: ["https://example.com/img1.jpg"],
    attributes: {},
    contentHash: "abc",
  };

  it("should pass valid product for all marketplaces", () => {
    const results = ProductValidator.validateAll(validProduct, [
      Marketplace.TRENDYOL,
      Marketplace.HEPSIBURADA,
      Marketplace.N11,
      Marketplace.PAZARAMA,
    ]);

    expect(results.TRENDYOL.valid).toBe(true);
    expect(results.HEPSIBURADA.valid).toBe(true);
    expect(results.N11.valid).toBe(true);
    expect(results.PAZARAMA.valid).toBe(true);
  });

  it("should fail Trendyol if barcode is missing", () => {
    const invalid = { ...validProduct, barcode: null };
    const result = ProductValidator.validate(invalid, Marketplace.TRENDYOL);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("barcode"))).toBe(true);
  });

  it("should fail Pazarama if barcode format is invalid", () => {
    const invalid = { ...validProduct, barcode: "123" }; // Too short
    const result = ProductValidator.validate(invalid, Marketplace.PAZARAMA);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("barkod formatı"))).toBe(true);
  });

  it("should fail N11 if description is too short", () => {
    const invalid = { ...validProduct, description: "Short" };
    const result = ProductValidator.validate(invalid, Marketplace.N11);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Açıklama çok kısa"))).toBe(true);
  });

  it("should fail if price is negative", () => {
    const invalid = { ...validProduct, price: -100 };
    const result = ProductValidator.validate(invalid, Marketplace.TRENDYOL);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("fiyat"))).toBe(true);
  });

  it("should fail if no images provided", () => {
    const invalid = { ...validProduct, images: [] };
    const result = ProductValidator.validate(invalid, Marketplace.TRENDYOL);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("görsel"))).toBe(true);
  });

  it("should fail if title is too long for Trendyol", () => {
    const invalid = { ...validProduct, title: "A".repeat(251) };
    const result = ProductValidator.validate(invalid, Marketplace.TRENDYOL);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Başlık çok uzun"))).toBe(true);
  });

  it("should give warning for HTML in title", () => {
    const warning = { ...validProduct, title: "<b>iPhone</b>" };
    const result = ProductValidator.validate(warning, Marketplace.TRENDYOL);
    expect(result.warnings.some(w => w.includes("HTML etiketleri"))).toBe(true);
  });

  it("should give warning for zero stock", () => {
    const warning = { ...validProduct, stock: 0 };
    const result = ProductValidator.validate(warning, Marketplace.TRENDYOL);
    expect(result.warnings.some(w => w.includes("Stok 0"))).toBe(true);
  });

  it("should give warning for high price", () => {
    const warning = { ...validProduct, price: 2000000 };
    const result = ProductValidator.validate(warning, Marketplace.TRENDYOL);
    expect(result.warnings.some(w => w.includes("Fiyat çok yüksek"))).toBe(true);
  });
});
