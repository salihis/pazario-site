import { ProductData } from './XMLParser';
import { Marketplace } from '@prisma/client';

export class CategoryMappingService {
  public static async resolveCategory(rawCategory: string, marketplace: Marketplace): Promise<{ categoryId: string; mappingId: string }> {
    // Mock resolution
    return { categoryId: '12345', mappingId: 'mock-mapping-id' };
  }

  public static getConfidenceLevel(rawCategory: string, mappedCategory: string): number {
    // Mock confidence
    return 0.95;
  }

  async resolveAll(product: ProductData): Promise<Record<string, string>> {
    const marketplaces = [Marketplace.TRENDYOL, Marketplace.HEPSIBURADA, Marketplace.N11, Marketplace.AMAZON];
    const mappings: Record<string, string> = {};
    
    for (const m of marketplaces) {
      const res = await CategoryMappingService.resolveCategory(product.categoryRaw || '', m);
      mappings[m] = res.categoryId;
    }
    
    return mappings;
  }
}
