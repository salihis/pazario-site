import { BaseCargoAdapter, ShipmentResult, CargoStatus } from './BaseCargoAdapter.js';
import { Order } from '@prisma/client';

export class YurticiCargoAdapter extends BaseCargoAdapter {
  async createShipment(order: Order): Promise<ShipmentResult> {
    return { trackingNumber: 'YURTICI_MOCK_123', labelPdfUrl: 'https://mock.yurtici.com/label/123', rawResponse: {} };
  }

  async getStatus(trackingNumber: string): Promise<CargoStatus> {
    return { code: '1', normalizedStatus: 'IN_TRANSIT', description: 'Yolda', location: 'Ankara', timestamp: new Date() };
  }

  async cancelShipment(trackingNumber: string): Promise<void> {}
}
