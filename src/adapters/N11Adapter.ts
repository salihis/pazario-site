import { Product } from '@prisma/client';
import { BaseAdapter } from './BaseAdapter';

export class N11Adapter extends BaseAdapter {
  name = 'N11';
  rateLimitRPM = 100;

  async publish(product: Product): Promise<string> {
    console.log(`Publishing product ${product.id} to N11`);
    // Mock taskId
    return `n11_task_${Date.now()}`;
  }

  normalize(product: Product): any {
    return {
      sellerStockCode: product.sku,
      title: product.title,
      subtitle: product.title.substring(0, 50),
      description: product.description || '',
      category: { id: 1 },
      price: Number(product.price),
      currencyType: 1,
      images: product.images.map(url => ({ url, order: 1 })),
      stockItems: [{ quantity: product.stock, sellerStockCode: product.sku }],
    };
  }
}
