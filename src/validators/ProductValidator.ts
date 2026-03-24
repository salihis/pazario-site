import { Marketplace } from "@prisma/client";
import { ParsedProduct } from "../parser/XMLParser";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MarketplaceRules {
  required: (keyof ParsedProduct)[];
  maxTitleLength: number;
  maxDescriptionLength?: number;
  minDescriptionLength?: number;
  minPrice: number;
  minImages: number;
  maxImages: number;
  barcodeFormat?: RegExp;
  skuFormat?: RegExp;
}

export class ProductValidator {
  private static readonly RULES: Record<Marketplace, MarketplaceRules> = {
    TRENDYOL: {
      required: ["title", "barcode", "price", "stock", "brand", "images", "category"],
      maxTitleLength: 250,
      minPrice: 1,
      minImages: 1,
      maxImages: 8,
      barcodeFormat: /^[0-9]{8,13}$/,
    },
    HEPSIBURADA: {
      required: ["title", "sku", "price", "stock", "images", "category"],
      maxTitleLength: 255,
      minPrice: 1,
      minImages: 1,
      maxImages: 10,
      skuFormat: /^[a-zA-Z0-9\-_]{1,50}$/,
    },
    N11: {
      required: ["title", "price", "stock", "images", "category", "description"],
      maxTitleLength: 200,
      minDescriptionLength: 50,
      minPrice: 1,
      minImages: 1,
      maxImages: 5,
    },
    PAZARAMA: {
      required: ["title", "barcode", "price", "stock", "brand", "images"],
      maxTitleLength: 300,
      minPrice: 1,
      minImages: 1,
      maxImages: 10,
      barcodeFormat: /^[0-9]{8,14}$/,
    },
    AMAZON: {
      required: ["title", "sku", "price", "stock", "images", "brand"],
      maxTitleLength: 200,
      minPrice: 1,
      minImages: 1,
      maxImages: 9,
    },
  };

  /**
   * Validate product for a specific marketplace
   */
  public static validate(product: ParsedProduct, marketplace: Marketplace): ValidationResult {
    const rules = this.RULES[marketplace];
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Required Fields
    rules.required.forEach((field) => {
      const val = product[field];
      if (val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
        errors.push(`Eksik zorunlu alan: ${field}`);
      }
    });

    // 2. Title Length
    if (product.title.length > rules.maxTitleLength) {
      errors.push(`Başlık çok uzun: ${product.title.length} karakter (Max: ${rules.maxTitleLength})`);
    }

    // 3. Description Length (N11 specific or others)
    if (rules.minDescriptionLength && (product.description?.length || 0) < rules.minDescriptionLength) {
      errors.push(`Açıklama çok kısa: ${product.description?.length || 0} karakter (Min: ${rules.minDescriptionLength})`);
    }

    // 4. Barcode Format
    if (rules.barcodeFormat && product.barcode && !rules.barcodeFormat.test(product.barcode)) {
      errors.push(`Geçersiz barkod formatı: ${product.barcode}`);
    }

    // 5. SKU Format
    if (rules.skuFormat && product.sku && !rules.skuFormat.test(product.sku)) {
      errors.push(`Geçersiz SKU formatı: ${product.sku}`);
    }

    // 6. Image Count
    if (product.images.length < rules.minImages) {
      errors.push(`Yetersiz görsel: ${product.images.length} (Min: ${rules.minImages})`);
    }
    if (product.images.length > rules.maxImages) {
      warnings.push(`Görsel sayısı fazla: ${product.images.length} (Max: ${rules.maxImages}). İlk ${rules.maxImages} görsel kullanılacak.`);
    }

    // 7. Price Validation
    if (product.price <= 0) {
      errors.push(`Geçersiz fiyat: ${product.price}`);
    }

    // 8. Quality Checks (Warnings)
    this.runQualityChecks(product, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate product for all marketplaces
   */
  public static validateAll(product: ParsedProduct, marketplaces: Marketplace[]): Record<Marketplace, ValidationResult> {
    const results: any = {};
    marketplaces.forEach((mp) => {
      results[mp] = this.validate(product, mp);
    });
    return results;
  }

  /**
   * Run quality checks (Warnings)
   */
  private static runQualityChecks(product: ParsedProduct, warnings: string[]): void {
    // HTML tags in title
    if (/<[a-z][\s\S]*>/i.test(product.title)) {
      warnings.push("Başlıkta HTML etiketleri tespit edildi.");
    }

    // Punctuation-only description
    if (product.description && /^[\s\p{P}]+$/u.test(product.description)) {
      warnings.push("Açıklama sadece noktalama işaretlerinden oluşuyor.");
    }

    // HTTP images (not HTTPS)
    const hasHttpImages = product.images.some((img) => img.startsWith("http://"));
    if (hasHttpImages) {
      warnings.push("Bazı görseller HTTPS değil, HTTP protokolü kullanıyor.");
    }

    // Zero stock
    if (product.stock === 0) {
      warnings.push("Stok 0, ürün pasif olarak yüklenecek.");
    }

    // High price
    if (product.price > 1000000) {
      warnings.push(`Fiyat çok yüksek: ${product.price.toLocaleString()} TL. Lütfen kontrol edin.`);
    }
  }
}
