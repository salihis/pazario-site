import { ProductData } from './XMLParser';
import { Marketplace } from '@prisma/client';

export interface PriceResult {
  marketplace: string;
  price: number;
  commission: number;
  profit: number;
}

export class PriceRuleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceRuleNotFoundError';
  }
}

export class InvalidRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRuleError';
  }
}

export interface PriceCalculationResult {
  finalPrice: number;
  ara1BaseEk: number;
  ara2Kar: number;
  ara3Kargo: number;
  minPriceApplied: boolean;
}

export class PriceEngine {
  public async calculate(options: {
    basePrice: number;
    marketplace: Marketplace;
    productId: string;
    syncJobId: string;
  }): Promise<PriceCalculationResult> {
    // Mock calculation
    const finalPrice = options.basePrice * 1.2;
    return {
      finalPrice,
      ara1BaseEk: options.basePrice + 10,
      ara2Kar: (options.basePrice + 10) * 1.25,
      ara3Kargo: (options.basePrice + 10) * 1.25 + 15,
      minPriceApplied: false,
    };
  }

  public async simulate(basePrice: number, marketplace: Marketplace): Promise<number> {
    // Mock simulation
    return basePrice * 1.15;
  }
  async calculateBatch(product: ProductData, productId: string, syncJobId: string): Promise<PriceResult[]> {
    const marketplaces = [Marketplace.TRENDYOL, Marketplace.HEPSIBURADA, Marketplace.N11, Marketplace.AMAZON];
    const results: PriceResult[] = [];
    for (const m of marketplaces) {
      const calc = await this.calculate({
        basePrice: product.price,
        marketplace: m,
        productId,
        syncJobId,
      });
      results.push({
        marketplace: m,
        price: calc.finalPrice,
        commission: calc.finalPrice * this.getCommissionRate(m),
        profit: calc.finalPrice - product.price,
      });
    }
    return results;
  }

  private getCommissionRate(marketplace: string): number {
    switch (marketplace) {
      case 'TRENDYOL': return 0.15;
      case 'HEPSIBURADA': return 0.12;
      case 'N11': return 0.10;
      case 'AMAZON': return 0.08;
      default: return 0.10;
    }
  }
}
