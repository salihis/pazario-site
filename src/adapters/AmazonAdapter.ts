import { Product } from '@prisma/client';
import { BaseAdapter } from './BaseAdapter';

export class AmazonAdapter extends BaseAdapter {
  name = 'Amazon';
  rateLimitRPM = 60;

  async publish(product: Product): Promise<string> {
    console.log(`Publishing product ${product.id} to Amazon`);
    // Mock feedId
    return `amazon_feed_${Date.now()}`;
  }

  normalize(product: Product): any {
    return {
      sku: product.sku,
      productName: product.title,
      description: product.description || '',
      brand: product.brand || 'Generic',
      price: Number(product.price),
      quantity: product.stock,
      images: product.images,
    };
  }
}
