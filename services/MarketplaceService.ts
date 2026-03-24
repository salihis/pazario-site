import axios from 'axios';
import { Marketplace, OrderStatus } from '@prisma/client';

export interface ExternalOrder {
  marketplace: Marketplace;
  marketplaceOrderId: string;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  items: string;
}

export class MarketplaceService {
  private static getTrendyolAuth() {
    const apiKey = process.env.TRENDYOL_API_KEY;
    const apiSecret = process.env.TRENDYOL_API_SECRET;
    if (!apiKey || !apiSecret) return null;
    return Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  }

  static async fetchTrendyolOrders(): Promise<ExternalOrder[]> {
    const sellerId = process.env.TRENDYOL_SELLER_ID;
    const auth = this.getTrendyolAuth();

    if (!sellerId || !auth) {
      console.warn('Trendyol credentials missing, skipping real API call.');
      return [];
    }

    try {
      // Trendyol Order API: GET /suppliers/{supplierId}/orders
      const response = await axios.get(`https://api.trendyol.com/sapigw/suppliers/${sellerId}/orders`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': `${sellerId} - SelfIntegration`
        }
      });

      // Map Trendyol response to our ExternalOrder format
      return response.data.content.map((order: any) => ({
        marketplace: Marketplace.TRENDYOL,
        marketplaceOrderId: order.orderNumber,
        customerName: `${order.customerFirstName} ${order.customerLastName}`,
        totalAmount: order.totalPrice,
        status: this.mapTrendyolStatus(order.status),
        items: JSON.stringify(order.lines.map((line: any) => ({
          sku: line.sku,
          title: line.productName,
          quantity: line.quantity,
          price: line.price
        })))
      }));
    } catch (error: any) {
      console.error('Error fetching Trendyol orders:', error.response?.data || error.message);
      return [];
    }
  }

  private static mapTrendyolStatus(status: string): OrderStatus {
    const mapping: Record<string, OrderStatus> = {
      'Created': OrderStatus.NEW,
      'Picking': OrderStatus.PREPARING,
      'Invoiced': OrderStatus.PREPARING,
      'Shipped': OrderStatus.SHIPPED,
      'Delivered': OrderStatus.DELIVERED,
      'Cancelled': OrderStatus.CANCELLED
    };
    return mapping[status] || OrderStatus.NEW;
  }

  static async fetchHepsiburadaOrders(): Promise<ExternalOrder[]> {
    const sellerId = process.env.HEPSIBURADA_SELLER_ID;
    const apiKey = process.env.HEPSIBURADA_API_KEY;

    if (!sellerId || !apiKey) {
      console.warn('Hepsiburada credentials missing.');
      return [];
    }

    try {
      // Hepsiburada Order API: GET https://oms-external.hepsiburada.com/orders
      const response = await axios.get(`https://oms-external.hepsiburada.com/orders`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${apiKey}:${sellerId}`).toString('base64')}`,
          'X-Merchant-Id': sellerId
        }
      });

      return response.data.map((order: any) => ({
        marketplace: Marketplace.HEPSIBURADA,
        marketplaceOrderId: order.orderNumber,
        customerName: order.customerName,
        totalAmount: order.totalPrice,
        status: this.mapHepsiburadaStatus(order.status),
        items: JSON.stringify(order.items.map((item: any) => ({
          sku: item.sku,
          title: item.productName,
          quantity: item.quantity,
          price: item.price
        })))
      }));
    } catch (error: any) {
      console.error('Error fetching Hepsiburada orders:', error.message);
      return [];
    }
  }

  private static mapHepsiburadaStatus(status: string): OrderStatus {
    const mapping: Record<string, OrderStatus> = {
      'Open': OrderStatus.NEW,
      'ReadyToShip': OrderStatus.PREPARING,
      'Shipped': OrderStatus.SHIPPED,
      'Delivered': OrderStatus.DELIVERED,
      'Cancelled': OrderStatus.CANCELLED
    };
    return mapping[status] || OrderStatus.NEW;
  }

  static async fetchN11Orders(): Promise<ExternalOrder[]> {
    const apiKey = process.env.N11_API_KEY;
    const apiSecret = process.env.N11_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.warn('N11 credentials missing.');
      return [];
    }

    try {
      // N11 Order API: POST https://api.n11.com/ws/OrderService.wsdl (SOAP)
      // For this implementation, we simulate the REST mapping
      const response = await axios.post(`https://api.n11.com/ws/OrderService`, {
        auth: { appKey: apiKey, appSecret: apiSecret },
        searchData: { status: 'New' }
      });

      return (response.data.orderList || []).map((order: any) => ({
        marketplace: Marketplace.N11,
        marketplaceOrderId: order.orderNumber,
        customerName: order.buyer.fullName,
        totalAmount: order.totalAmount,
        status: this.mapN11Status(order.status),
        items: JSON.stringify(order.orderItemList.map((item: any) => ({
          sku: item.sellerStockCode,
          title: item.productName,
          quantity: item.quantity,
          price: item.price
        })))
      }));
    } catch (error: any) {
      console.error('Error fetching N11 orders:', error.message);
      return [];
    }
  }

  private static mapN11Status(status: string): OrderStatus {
    const mapping: Record<string, OrderStatus> = {
      'New': OrderStatus.NEW,
      'Approved': OrderStatus.PREPARING,
      'Shipped': OrderStatus.SHIPPED,
      'Delivered': OrderStatus.DELIVERED,
      'Cancelled': OrderStatus.CANCELLED
    };
    return mapping[status] || OrderStatus.NEW;
  }

  static async fetchPazaramaOrders(): Promise<ExternalOrder[]> {
    const apiKey = process.env.PAZARAMA_API_KEY;
    const apiSecret = process.env.PAZARAMA_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.warn('Pazarama credentials missing.');
      return [];
    }

    try {
      const response = await axios.get(`https://api.pazarama.com/supplier/orders`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      return response.data.map((order: any) => ({
        marketplace: Marketplace.PAZARAMA,
        marketplaceOrderId: order.orderId,
        customerName: order.customerName,
        totalAmount: order.totalPrice,
        status: this.mapPazaramaStatus(order.status),
        items: JSON.stringify(order.items.map((item: any) => ({
          sku: item.sku,
          title: item.productName,
          quantity: item.quantity,
          price: item.price
        })))
      }));
    } catch (error: any) {
      console.error('Error fetching Pazarama orders:', error.message);
      return [];
    }
  }

  private static mapPazaramaStatus(status: string): OrderStatus {
    const mapping: Record<string, OrderStatus> = {
      'Pending': OrderStatus.NEW,
      'Ready': OrderStatus.PREPARING,
      'Shipped': OrderStatus.SHIPPED,
      'Completed': OrderStatus.DELIVERED,
      'Cancelled': OrderStatus.CANCELLED
    };
    return mapping[status] || OrderStatus.NEW;
  }

  static async fetchAllOrders(): Promise<ExternalOrder[]> {
    // Fetching sequentially or in parallel, but ensuring Hepsiburada is added last to the final list
    const [trendyol, n11, pazarama, hepsiburada] = await Promise.all([
      this.fetchTrendyolOrders(),
      this.fetchN11Orders(),
      this.fetchPazaramaOrders(),
      this.fetchHepsiburadaOrders()
    ]);
    
    // Hepsiburada is last in the spread
    return [...trendyol, ...n11, ...pazarama, ...hepsiburada];
  }
}
