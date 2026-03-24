import prisma from '../../services/Database.js';
import { Order, OrderStatus, CargoCompany } from '@prisma/client';
import { ArasCargoAdapter } from '../adapters/cargo/ArasCargoAdapter.js';
import { YurticiCargoAdapter } from '../adapters/cargo/YurticiCargoAdapter.js';
import { SuratCargoAdapter } from '../adapters/cargo/SuratCargoAdapter.js';
import { PttCargoAdapter } from '../adapters/cargo/PttCargoAdapter.js';
import { OrderStateMachine } from './OrderStateMachine.js';
import { decrypt } from '../lib/encryption.js';
import { TrendyolAdapter } from '../adapters/TrendyolAdapter.js';
import { N11Adapter } from '../adapters/N11Adapter.js';
import { PazaramaAdapter } from '../adapters/PazaramaAdapter.js';

export class CargoService {
  public async createLabel(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) throw new Error('Order not found');

    // Decrypt order for shipping
    const decryptedOrder = this.decryptOrder(order);

    // Select adapter
    const adapter = this.getAdapter(decryptedOrder.cargoCompany as CargoCompany);
    if (!adapter) throw new Error(`Cargo adapter not found for ${decryptedOrder.cargoCompany}`);

    try {
      const result = await adapter.createShipment(decryptedOrder);

      // Save shipment
      await prisma.shipment.create({
        data: {
          orderId,
          cargoCompany: decryptedOrder.cargoCompany as CargoCompany,
          trackingNumber: result.trackingNumber,
          labelPdfUrl: result.labelPdfUrl,
          status: 'CREATED',
        },
      });

      // Update order
      await prisma.order.update({
        where: { id: orderId },
        data: {
          trackingNumber: result.trackingNumber,
          cargoLabelUrl: result.labelPdfUrl,
        },
      });

      // Update status
      const stateMachine = new OrderStateMachine();
      await stateMachine.transition(orderId, OrderStatus.LABEL_CREATED);

      // Notify marketplace (async)
      this.notifyMarketplace(orderId).catch(err => console.error('Marketplace notification error:', err));

    } catch (error: any) {
      console.error('Cargo label creation failed:', error);
      throw new Error(`Kargo etiketi oluşturulamadı: ${error.message}`);
    }
  }

  public async notifyMarketplace(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.trackingNumber) return;

    const marketplaceAdapter = this.getMarketplaceAdapter(order.marketplace);
    if (!marketplaceAdapter) return;

    try {
      if (order.marketplace === 'TRENDYOL') {
        // Trendyol needs packageId, assuming marketplaceOrderId is packageId for now
        await (marketplaceAdapter as any).trackingNumberUpdate(order.marketplaceOrderId, order.trackingNumber);
      } else if (order.marketplace === 'PAZARAMA') {
        // Pazarama needs more info, simplified here
        await (marketplaceAdapter as any).updateOrderStatus(order.marketplaceOrderId, {
          shippingTrackingNumber: order.trackingNumber,
          cargoCompanyId: 'MOCK_UUID', // Should be mapped
        });
      }
      // Add other marketplaces...

      await prisma.shipment.update({
        where: { orderId },
        data: { marketplaceNotifiedAt: new Date() },
      });
    } catch (error) {
      console.error('Failed to notify marketplace:', error);
      // Retry logic could be added here (e.g., background job)
    }
  }

  public async pollStatus(orderId: string): Promise<void> {
    console.log(`Polling status for order ${orderId}`);
    // Implementation for polling cargo status
  }

  private getAdapter(company: CargoCompany) {
    switch (company) {
      case CargoCompany.ARAS:
        return new ArasCargoAdapter(process.env.ARAS_TOKEN || '');
      case CargoCompany.YURTICI:
        return new YurticiCargoAdapter();
      case CargoCompany.SURAT:
        return new SuratCargoAdapter();
      case CargoCompany.PTT:
        return new PttCargoAdapter();
      default:
        return null;
    }
  }

  private getMarketplaceAdapter(marketplace: any): any {
    switch (marketplace) {
      case 'TRENDYOL':
        return new TrendyolAdapter();
      case 'N11':
        return new N11Adapter();
      case 'PAZARAMA':
        return new PazaramaAdapter({
          clientId: process.env.PAZARAMA_API_KEY!,
          clientSecret: process.env.PAZARAMA_API_SECRET!,
        });
      default:
        return null;
    }
  }

  private decryptOrder(order: any) {
    return {
      ...order,
      customerName: order.customerName ? decrypt(order.customerName) : null,
      customerPhone: order.customerPhone ? decrypt(order.customerPhone) : null,
      shippingAddress: order.shippingAddress ? JSON.parse(decrypt(order.shippingAddress as string)) : null,
      billingAddress: order.billingAddress ? JSON.parse(decrypt(order.billingAddress as string)) : null,
    };
  }
}
