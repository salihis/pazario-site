import { Order, CargoCompany } from '@prisma/client';

export interface ShipmentResult {
  trackingNumber: string;
  labelPdfUrl: string;
  rawResponse: unknown;
}

export interface CargoStatus {
  code: string;
  normalizedStatus: 'IN_TRANSIT' | 'DELIVERED' | 'DELIVERY_FAILED' | 'RETURNING' | 'CARGO_ISSUE';
  description: string;
  location: string | null;
  timestamp: Date;
}

export interface ReceiverInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  district: string;
}

export abstract class BaseCargoAdapter {
  abstract createShipment(order: Order): Promise<ShipmentResult>;
  abstract getStatus(trackingNumber: string): Promise<CargoStatus>;
  abstract cancelShipment(trackingNumber: string): Promise<void>;

  protected buildReceiverInfo(order: Order): ReceiverInfo {
    // Decrypting customer info for shipping
    // Note: Order object here should be decrypted before passing or we decrypt here
    // For simplicity, let's assume it's already decrypted or we handle it.
    // Actually, the service should pass decrypted data or this adapter should know how to decrypt.
    // Let's assume the service passes decrypted order.
    const address = order.shippingAddress as any;
    return {
      name: order.customerName || '',
      phone: order.customerPhone || '',
      address: address.address || '',
      city: address.city || '',
      district: address.district || '',
    };
  }

  public static calculateDesi(product: { weight?: number; width?: number; height?: number; depth?: number }): number {
    const defaultDesi = parseInt(process.env.DEFAULT_DESI || '1');
    if (product.width && product.height && product.depth) {
      const desi = (product.width * product.height * product.depth) / 3000;
      return Math.max(1, Math.round(desi * 100) / 100);
    }
    return defaultDesi;
  }
}
