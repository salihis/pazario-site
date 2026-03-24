import { BaseCargoAdapter, ShipmentResult, CargoStatus } from './BaseCargoAdapter.js';
import { Order } from '@prisma/client';

export class PttCargoAdapter extends BaseCargoAdapter {
  async createShipment(order: Order): Promise<ShipmentResult> {
    return { trackingNumber: 'PTT_MOCK_123', labelPdfUrl: 'https://mock.ptt.com/label/123', rawResponse: {} };
  }

  async getStatus(trackingNumber: string): Promise<CargoStatus> {
    return { code: '1', normalizedStatus: 'IN_TRANSIT', description: 'Yolda', location: 'Istanbul', timestamp: new Date() };
  }

  async cancelShipment(trackingNumber: string): Promise<void> {}
}
