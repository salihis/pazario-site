import { Product } from "@prisma/client";
import { BaseAdapter, StatusResult, PriceStockItem } from "./BaseAdapter.js";
import { ProductData } from "../services/XMLParser.js";

export class PazaramaAdapter extends BaseAdapter {
  readonly name = "PAZARAMA";
  readonly rateLimitRPM = 100; // Varsayılan

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = "https://isortagimapi.pazarama.com";
  private readonly tokenUrl = "https://isortagimgiris.pazarama.com/connect/token";

  private _token: string | null = null;
  private _tokenExpiry: number = 0;

  constructor(config: { clientId: string; clientSecret: string }) {
    super();
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  /**
   * Pazarama Ürün Normalizasyonu
   */
  normalize(product: Product): any {
    return {
      code: product.sku || product.id,
      name: this._truncate(this._stripHtml(product.title), 300),
      displayName: this._truncate(this._stripHtml(product.title), 300),
      description: this._truncate(this._stripHtml(product.description || ""), 50000),
      brandId: 1, // This should be mapped
      categoryId: "1", // This should be mapped
      stockCount: product.stock,
      listPrice: Number(product.price) + 1,
      salePrice: Number(product.price).toFixed(2).replace(".", ","), // Pazarama virgüllü ondalık bekler
      vatRate: 20,
      currencyType: "TRY",
      desi: 1, // Varsayılan
      images: product.images.slice(0, 10).map((url) => ({ imageurl: url })),
      attributes: [],
      deliveries: [], // deliveryId ve cityList ayrıca set edilmeli
    };
  }

  /**
   * Ürün Yayınlama
   */
  async publish(product: Product): Promise<void> {
    const url = `${this.baseUrl}/product/create`;
    const normalized = this.normalize(product);

    await this._requestWithAuth("POST", url, {
      products: [normalized],
    });
  }

  async getPublishStatus(externalJobId: string): Promise<{ status: 'SUCCESS' | 'FAILED' | 'POLLING'; error?: string }> {
    // Pazarama is synchronous, so if we are here, it's likely success or we don't have a job ID
    return { status: 'SUCCESS' };
  }

  /**
   * Durum Sorgulama (Pazarama'da batchId olmayabilir, SKU ile sorgulanabilir)
   */
  async getStatus(sku: string): Promise<StatusResult> {
    const url = `${this.baseUrl}/product/get?code=${sku}`;
    const response = await this._requestWithAuth("GET", url);

    return {
      status: response.status || "UNKNOWN",
    };
  }

  /**
   * Fiyat ve Stok Güncelleme
   */
  async updatePriceAndStock(items: PriceStockItem[]): Promise<void> {
    const url = `${this.baseUrl}/product/updatePriceAndStock`;
    const payload = {
      products: items.map((i) => ({
        code: i.sku,
        stockCount: i.stock,
        salePrice: i.price.toFixed(2).replace(".", ","),
        listPrice: (i.price + 1).toFixed(2).replace(".", ","),
      })),
    };

    await this._requestWithAuth("POST", url, payload);
  }

  /**
   * Siparişleri Getir
   */
  async getOrders(options: {
    startDate: number;
    endDate: number;
    page: number;
  }): Promise<any> {
    const url = `${this.baseUrl}/order/getOrdersForApi`;
    const body = {
      startDate: new Date(options.startDate).toISOString().split('T')[0],
      endDate: new Date(options.endDate).toISOString().split('T')[0],
      pageSize: 50,
      pageNumber: options.page,
    };

    return this._requestWithAuth("POST", url, body);
  }

  /**
   * Sipariş Durumu Güncelleme
   */
  async updateOrderStatus(orderNumber: string, item: any): Promise<void> {
    const url = `${this.baseUrl}/order/updateOrderStatus`;
    const body = {
      orderNumber,
      item: {
        orderItemId: item.orderItemId,
        status: 11, // Kargoya verildi
        deliveryType: 1,
        shippingTrackingNumber: item.shippingTrackingNumber,
        trackingUrl: item.trackingUrl,
        cargoCompanyId: item.cargoCompanyId, // UUID string
      },
    };

    await this._requestWithAuth("PUT", url, body);
  }

  /**
   * Auth Header Ekleyerek Request Yap
   */
  private async _requestWithAuth(method: string, url: string, body?: any): Promise<any> {
    const token = await this._getToken();
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      throw new Error(`Pazarama API Error: ${response.status} - ${await response.text()}`);
    }

    return response.json();
  }

  /**
   * OAuth2 Token Yönetimi
   */
  private async _getToken(): Promise<string> {
    const now = Date.now();
    
    // Süresi dolmamışsa cache'ten döndür (60sn buffer)
    if (this._token && this._tokenExpiry > now + 60000) {
      return this._token;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "merchantgatewayapi.fullaccess",
    });

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Pazarama Token Error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    this._token = data.access_token;
    this._tokenExpiry = now + (data.expires_in * 1000);

    return this._token!;
  }
}
