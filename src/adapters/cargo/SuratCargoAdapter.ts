import { BaseCargoAdapter, ShipmentResult, CargoStatus } from './BaseCargoAdapter.js';
import { Order } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';

export class SuratCargoAdapter extends BaseCargoAdapter {
  private readonly baseUrl = 'https://webservices.suratkargo.com.tr/v2';
  private readonly parser = new XMLParser();

  async createShipment(order: Order): Promise<ShipmentResult> {
    const receiver = this.buildReceiverInfo(order);
    const soapEnvelope = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sur="http://suratkargo.com.tr/">
        <soapenv:Header/>
        <soapenv:Body>
          <sur:CreateShipment>
            <sur:ReceiverName>${receiver.name}</sur:ReceiverName>
            <sur:ReceiverPhone>${receiver.phone}</sur:ReceiverPhone>
            <sur:ReceiverAddress>${receiver.address}</sur:ReceiverAddress>
            <sur:ReceiverCity>${receiver.city}</sur:ReceiverCity>
            <sur:ReceiverDistrict>${receiver.district}</sur:ReceiverDistrict>
            <sur:OrderNumber>${order.marketplaceOrderNo || order.id}</sur:OrderNumber>
          </sur:CreateShipment>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await fetch(`${this.baseUrl}/ShipmentService.asmx`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://suratkargo.com.tr/CreateShipment' },
      body: soapEnvelope,
    });

    const xmlData = await response.text();
    const result = this.parser.parse(xmlData);
    const body = result['soapenv:Envelope']['soapenv:Body']['CreateShipmentResponse']['CreateShipmentResult'];

    if (body.Status !== 'SUCCESS') {
      throw new Error(`Sürat Kargo API Error: ${body.Message}`);
    }

    return {
      trackingNumber: body.TrackingNumber,
      labelPdfUrl: body.LabelUrl,
      rawResponse: body,
    };
  }

  async getStatus(trackingNumber: string): Promise<CargoStatus> {
    const soapEnvelope = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sur="http://suratkargo.com.tr/">
        <soapenv:Header/>
        <soapenv:Body>
          <sur:GetShipmentStatus>
            <sur:TrackingNumber>${trackingNumber}</sur:TrackingNumber>
          </sur:GetShipmentStatus>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await fetch(`${this.baseUrl}/ShipmentService.asmx`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://suratkargo.com.tr/GetShipmentStatus' },
      body: soapEnvelope,
    });

    const xmlData = await response.text();
    const result = this.parser.parse(xmlData);
    const body = result['soapenv:Envelope']['soapenv:Body']['GetShipmentStatusResponse']['GetShipmentStatusResult'];

    // Placeholder status mapping
    const statusMap: Record<string, CargoStatus['normalizedStatus']> = {
      '1': 'IN_TRANSIT',
      '2': 'DELIVERED',
      '3': 'DELIVERY_FAILED',
      '4': 'RETURNING',
    };

    return {
      code: body.StatusCode.toString(),
      normalizedStatus: statusMap[body.StatusCode.toString()] || 'CARGO_ISSUE',
      description: body.StatusDescription,
      location: body.CurrentLocation,
      timestamp: new Date(),
    };
  }

  async cancelShipment(trackingNumber: string): Promise<void> {
    // SOAP cancel call
  }
}
