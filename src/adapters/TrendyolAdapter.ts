import { Product } from '@prisma/client';
import { BaseAdapter } from './BaseAdapter';

export class TrendyolAdapter extends BaseAdapter {
  name = 'Trendyol';
  rateLimitRPM = 150;
  private readonly baseUrl = 'https://api.trendyol.com/sapigw';

  async publish(product: Product): Promise<string> {
    const batchRequestId = await this.publishBatch([product]);
    return batchRequestId as string;
  }

  async publishBatch(products: Product[]): Promise<string> {
    const apiKey = process.env.TRENDYOL_API_KEY;
    const apiSecret = process.env.TRENDYOL_API_SECRET;
    const supplierId = process.env.TRENDYOL_SUPPLIER_ID;

    if (!apiKey || !apiSecret || !supplierId) {
      throw new Error('Trendyol API credentials missing');
    }

    const userAgent = encodeURIComponent(`MarketplaceSync/1.0 (SupplierId: ${supplierId})`);

    const response = await fetch(`${this.baseUrl}/suppliers/${supplierId}/v2/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        items: products.map(p => this.normalize(p)),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Trendyol API error: ${error}`);
    }

    const data = await response.json();
    return data.batchRequestId;
  }

  async getPublishStatus(batchRequestId: string): Promise<{ status: 'SUCCESS' | 'FAILED' | 'POLLING'; error?: string }> {
    const apiKey = process.env.TRENDYOL_API_KEY;
    const apiSecret = process.env.TRENDYOL_API_SECRET;
    const supplierId = process.env.TRENDYOL_SUPPLIER_ID;

    const response = await fetch(`${this.baseUrl}/suppliers/${supplierId}/products/batch-requests/${batchRequestId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      },
    });

    if (!response.ok) return { status: 'POLLING' };

    const data = await response.json();
    // Trendyol batch status: COMPLETED, FAILED, PROCESSING
    if (data.status === 'COMPLETED') return { status: 'SUCCESS' };
    if (data.status === 'FAILED') return { status: 'FAILED', error: data.errorMessage || 'Batch failed' };
    return { status: 'POLLING' };
  }

  normalize(product: Product): any {
    return {
      barcode: product.barcode || product.sku,
      title: product.title,
      productMainId: product.sku,
      brandId: 1, // This should be mapped
      categoryId: 1, // This should be mapped
      quantity: product.stock,
      stockCode: product.sku,
      listPrice: Number(product.price),
      salePrice: Number(product.price),
      vatRate: 20,
      cargoCompanyId: 1,
      images: product.images.map(url => ({ url })),
      attributes: [], // This will be filled from ProductAttribute
      description: product.description || '',
    };
  }
}
