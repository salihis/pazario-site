import { BaseCargoAdapter, ShipmentResult, CargoStatus } from './BaseCargoAdapter.js';
import { Order } from '@prisma/client';

export class ArasCargoAdapter extends BaseCargoAdapter {
  private readonly baseUrl = 'https://api.araskargo.com.tr/v1';
  private readonly token: string;

  constructor(token: string) {
    super();
    this.token = token;
  }

  async createShipment(order: Order): Promise<ShipmentResult> {
    const receiver = this.buildReceiverInfo(order);
    const response = await fetch(`${this.baseUrl}/shipments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receiverName: receiver.name,
        receiverPhone: receiver.phone,
        receiverAddress: receiver.address,
        receiverCity: receiver.city,
        receiverDistrict: receiver.district,
        orderNumber: order.marketplaceOrderNo || order.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`Aras Cargo API Error: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      trackingNumber: data.trackingNumber,
      labelPdfUrl: data.labelUrl,
      rawResponse: data,
    };
  }

  async getStatus(trackingNumber: string): Promise<CargoStatus> {
    const response = await fetch(`${this.baseUrl}/shipments/${trackingNumber}/status`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });

    if (!response.ok) {
      throw new Error(`Aras Cargo API Error: ${await response.text()}`);
    }

    const data = await response.json();
    const code = data.statusCode.toString();

    const statusMap: Record<string, CargoStatus['normalizedStatus']> = {
      '65': 'IN_TRANSIT',
      '70': 'IN_TRANSIT',
      '71': 'DELIVERED',
      '75': 'DELIVERY_FAILED',
      '80': 'RETURNING',
      '99': 'CARGO_ISSUE',
    };

    return {
      code,
      normalizedStatus: statusMap[code] || 'CARGO_ISSUE',
      description: data.statusDescription,
      location: data.currentLocation,
      timestamp: new Date(data.statusTime),
    };
  }

  async cancelShipment(trackingNumber: string): Promise<void> {
    await fetch(`${this.baseUrl}/shipments/${trackingNumber}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
  }
}
