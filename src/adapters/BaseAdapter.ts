import { Product, Marketplace } from '@prisma/client';

export interface PublishResult {
  success: boolean;
  marketplaceOrderId?: string;
  error?: string;
}

export interface StatusResult {
  status: string;
  trackingNumber?: string;
}

export interface PriceStockItem {
  sku: string;
  price: number;
  stock: number;
}

export abstract class BaseAdapter {
  abstract readonly name: string;
  abstract readonly rateLimitRPM: number;

  abstract publish(product: Product): Promise<string | void>; // Returns externalJobId if async
  
  async publishBatch?(products: Product[]): Promise<string | void> {
    // Default implementation: call publish for each product
    for (const product of products) {
      await this.publish(product);
    }
  }

  async getPublishStatus?(externalJobId: string): Promise<{ status: 'SUCCESS' | 'FAILED' | 'POLLING'; error?: string }> {
    return { status: 'SUCCESS' };
  }

  abstract normalize(product: Product): any;
  async getOrders?(options: { startDate: number; endDate: number; page: number }): Promise<any>;

  protected _truncate(str: string, max: number): string {
    return str.length > max ? str.substring(0, max) : str;
  }

  protected _stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ');
  }
}
