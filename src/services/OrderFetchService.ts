import { Marketplace, OrderStatus, PrismaClient } from '@prisma/client';
import prisma from '../../services/Database.js';
import { encrypt } from '../lib/encryption.js';
import { TrendyolAdapter } from '../adapters/TrendyolAdapter.js';
import { N11Adapter } from '../adapters/N11Adapter.js';
import { PazaramaAdapter } from '../adapters/PazaramaAdapter.js';

export interface FetchSummary {
  results: {
    marketplace: Marketplace;
    fetched: number;
    newOrders: number;
    errors: string[];
  }[];
  totalNew: number;
  durationMs: number;
}

export class OrderFetchService {
  public async fetchAll(): Promise<FetchSummary> {
    const startTime = Date.now();
    const marketplaces = Object.values(Marketplace);
    
    const results = await Promise.allSettled(
      marketplaces.map(m => this.fetchFrom(m))
    );

    const summary: FetchSummary = {
      results: [],
      totalNew: 0,
      durationMs: 0,
    };

    results.forEach((res, index) => {
      const marketplace = marketplaces[index];
      if (res.status === 'fulfilled') {
        summary.results.push(res.value);
        summary.totalNew += res.value.newOrders;
      } else {
        summary.results.push({
          marketplace,
          fetched: 0,
          newOrders: 0,
          errors: [res.reason.message],
        });
      }
    });

    summary.durationMs = Date.now() - startTime;
    return summary;
  }

  public async fetchFrom(marketplace: Marketplace) {
    const result = {
      marketplace,
      fetched: 0,
      newOrders: 0,
      errors: [] as string[],
    };

    try {
      // 1. Get last fetch time
      const lastLog = await prisma.orderFetchLog.findFirst({
        where: { marketplace, status: 'SUCCESS' },
        orderBy: { lastFetchedAt: 'desc' },
      });

      const now = new Date();
      const lastFetchAt = lastLog ? lastLog.lastFetchedAt : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 2. Get Adapter
      const adapter = this.getAdapter(marketplace);
      if (!adapter) {
        throw new Error(`Adapter not found for ${marketplace}`);
      }

      // 3. Fetch orders (paginated)
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await adapter.getOrders({
          startDate: lastFetchAt.getTime(),
          endDate: now.getTime(),
          page,
        });

        const rawOrders = this.extractOrders(marketplace, response);
        if (!rawOrders || rawOrders.length === 0) {
          hasMore = false;
          break;
        }

        result.fetched += rawOrders.length;

        for (const raw of rawOrders) {
          const normalized = this.normalizeOrder(marketplace, raw);
          
          // a. Check if exists
          const existing = await prisma.order.findUnique({
            where: { marketplaceOrderId: normalized.marketplaceOrderId },
          });

          if (!existing) {
            // b. Create new
            await this.createOrder(normalized, marketplace);
            result.newOrders++;
          } else {
            // c. Update if needed (optional logic here)
          }
        }

        // Check if there's more pages (marketplace specific logic)
        hasMore = this.checkHasMore(marketplace, response, page);
        page++;
      }

      // 4. Log success
      await prisma.orderFetchLog.create({
        data: {
          marketplace,
          status: 'SUCCESS',
          fetchedCount: result.fetched,
          lastFetchedAt: now,
        },
      });

    } catch (error: any) {
      result.errors.push(error.message);
      await prisma.orderFetchLog.create({
        data: {
          marketplace,
          status: 'FAILED',
          fetchedCount: result.fetched,
          errorMessage: error.message,
          lastFetchedAt: new Date(),
        },
      });
    }

    return result;
  }

  private getAdapter(marketplace: Marketplace): any {
    switch (marketplace) {
      case Marketplace.TRENDYOL:
        return new TrendyolAdapter();
      case Marketplace.N11:
        return new N11Adapter();
      case Marketplace.PAZARAMA:
        return new PazaramaAdapter({
          clientId: process.env.PAZARAMA_API_KEY!,
          clientSecret: process.env.PAZARAMA_API_SECRET!,
        });
      default:
        return null;
    }
  }

  private extractOrders(marketplace: Marketplace, response: any): any[] {
    switch (marketplace) {
      case Marketplace.TRENDYOL:
        return response.content || [];
      case Marketplace.N11:
        return response.content || []; // Assuming N11Adapter returns content
      case Marketplace.PAZARAMA:
        return response.data || []; // Assuming PazaramaAdapter returns data
      default:
        return [];
    }
  }

  private checkHasMore(marketplace: Marketplace, response: any, currentPage: number): boolean {
    // Simplified logic for demo
    switch (marketplace) {
      case Marketplace.TRENDYOL:
        return response.totalPages > currentPage;
      case Marketplace.N11:
        return response.totalPages > currentPage;
      case Marketplace.PAZARAMA:
        return response.totalPages > currentPage;
      default:
        return false;
    }
  }

  private normalizeOrder(marketplace: Marketplace, raw: any): any {
    switch (marketplace) {
      case Marketplace.TRENDYOL:
        return this.normalizeTrendyolOrder(raw);
      case Marketplace.N11:
        return this.normalizeN11Order(raw);
      case Marketplace.PAZARAMA:
        return this.normalizePazaramaOrder(raw);
      default:
        throw new Error(`Normalizer not found for ${marketplace}`);
    }
  }

  private normalizeTrendyolOrder(raw: any) {
    return {
      marketplaceOrderId: raw.id.toString(),
      marketplaceOrderNo: raw.orderNumber,
      customerName: raw.shipmentAddress.fullName,
      customerPhone: raw.shipmentAddress.phone,
      shippingAddress: raw.shipmentAddress,
      billingAddress: raw.invoiceAddress,
      totalAmount: raw.totalPrice,
      currency: 'TRY',
      items: raw.lines.map((line: any) => ({
        marketplaceProductId: line.productId.toString(),
        sku: line.sku,
        title: line.productName,
        quantity: line.quantity,
        unitPrice: line.price,
        totalPrice: line.totalPrice,
      })),
    };
  }

  private normalizeN11Order(raw: any) {
    // Mock normalization for N11
    return {
      marketplaceOrderId: raw.id.toString(),
      marketplaceOrderNo: raw.orderNumber,
      customerName: raw.recipient?.fullName,
      customerPhone: raw.recipient?.phone,
      shippingAddress: raw.recipient,
      billingAddress: raw.billingAddress,
      totalAmount: raw.totalPrice,
      currency: 'TRY',
      items: raw.items?.map((item: any) => ({
        marketplaceProductId: item.productId?.toString(),
        sku: item.sellerStockCode,
        title: item.productName,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.totalPrice,
      })) || [],
    };
  }

  private normalizePazaramaOrder(raw: any) {
    // Mock normalization for Pazarama
    return {
      marketplaceOrderId: raw.orderNumber,
      marketplaceOrderNo: raw.orderNumber,
      customerName: raw.customerName,
      customerPhone: raw.customerPhone,
      shippingAddress: raw.shippingAddress,
      billingAddress: raw.billingAddress,
      totalAmount: raw.totalAmount,
      currency: 'TRY',
      items: raw.items?.map((item: any) => ({
        marketplaceProductId: item.productId,
        sku: item.code,
        title: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.totalPrice,
      })) || [],
    };
  }

  private async createOrder(normalized: any, marketplace: Marketplace) {
    const { items, ...orderData } = normalized;

    // KVKK Encryption
    const encryptedData = {
      ...orderData,
      customerName: orderData.customerName ? encrypt(orderData.customerName) : null,
      customerPhone: orderData.customerPhone ? encrypt(orderData.customerPhone) : null,
      shippingAddress: orderData.shippingAddress ? encrypt(JSON.stringify(orderData.shippingAddress)) : null,
      billingAddress: orderData.billingAddress ? encrypt(JSON.stringify(orderData.billingAddress)) : null,
    };

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          ...encryptedData,
          marketplace,
          status: OrderStatus.NEW,
          fetchedAt: new Date(),
        },
      });

      for (const item of items) {
        await tx.orderItem.create({
          data: {
            ...item,
            orderId: order.id,
          },
        });
      }

      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          toStatus: OrderStatus.NEW,
          note: 'Sipariş pazaryerinden çekildi.',
        },
      });

      return order;
    });
  }
}
