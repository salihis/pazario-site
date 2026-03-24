import prisma from './Database.js';
import { MarketplaceService } from './MarketplaceService.js';
import { OrderStatus } from '@prisma/client';

export class OrderService {
  /**
   * Syncing orders from real marketplaces (Section 13.2)
   */
  static async syncOrdersFromMarketplaces() {
    const externalOrders = await MarketplaceService.fetchAllOrders();

    if (externalOrders.length === 0) {
      console.warn('No real orders found or credentials missing.');
    }

    for (const extOrder of externalOrders) {
      await prisma.order.upsert({
        where: { marketplaceOrderId: extOrder.marketplaceOrderId },
        update: { status: extOrder.status },
        create: {
          marketplace: extOrder.marketplace,
          marketplaceOrderId: extOrder.marketplaceOrderId,
          customerName: extOrder.customerName,
          totalAmount: extOrder.totalAmount,
          status: extOrder.status,
          fetchedAt: new Date()
        }
      });
    }

    return externalOrders.length;
  }

  static async getOrders() {
    return prisma.order.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  static async updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    // Section 13.4: Order State Machine Logic
    return prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus }
    });
  }
}
