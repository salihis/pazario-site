import { PrismaClient } from '@prisma/client';
import { ProductData } from './XMLParser';

const prisma = new PrismaClient();

export interface DetectionResult {
  newProducts: ProductData[];
  changedProducts: ProductData[];
  unchangedIds: string[];
}

export class ChangeDetectionService {
  public static async detectChanges(products: ProductData[], sourceId: string): Promise<DetectionResult> {
    const service = new ChangeDetectionService();
    return service.detect(products, sourceId);
  }

  async detect(products: ProductData[], sourceId: string): Promise<DetectionResult> {
    const ids = products.map(p => p.id);
    
    // Fix: 1000 ürün için N+1 sorgu yerine tek bir query
    const existingProducts = await prisma.product.findMany({
      where: { 
        externalId: { in: ids },
        sourceId: sourceId
      },
      select: { id: true, externalId: true, price: true, stock: true },
    });

    const existingMap = new Map(existingProducts.map(p => [p.externalId, p]));
    
    const newProducts: ProductData[] = [];
    const changedProducts: ProductData[] = [];
    const unchangedIds: string[] = [];

    for (const p of products) {
      const existing = existingMap.get(p.id);
      if (!existing) {
        newProducts.push(p);
      } else if (Number(existing.price) !== p.price || existing.stock !== p.stock) {
        changedProducts.push(p);
      } else {
        unchangedIds.push(existing.id);
      }
    }

    return { newProducts, changedProducts, unchangedIds };
  }
}
