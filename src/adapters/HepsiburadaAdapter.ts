import { Product } from '@prisma/client';
import { BaseAdapter } from './BaseAdapter';

export class HepsiburadaAdapter extends BaseAdapter {
  name = 'Hepsiburada';
  rateLimitRPM = 120;

  async publish(product: Product): Promise<string> {
    console.log(`Publishing product ${product.id} to Hepsiburada`);
    // Mock trackingId
    return `hb_tracking_${Date.now()}`;
  }

  normalize(product: Product): any {
    return {
      sku: product.sku,
      merchantSku: product.sku,
      productName: product.title,
      description: product.description || '',
      brand: product.brand || 'Diğer',
      categoryId: 1,
      price: Number(product.price),
      stock: product.stock,
      images: product.images,
      attributes: {},
    };
  }
}
