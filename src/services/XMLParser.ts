import { XMLParser as FastXMLParser } from 'fast-xml-parser';

export interface ProductData {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  categoryRaw?: string;
  description?: string;
  images: string[];
  contentHash?: string;
}

export class XMLParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XMLParseError';
  }
}

export class XMLParser {
  private parser: FastXMLParser;

  constructor() {
    this.parser = new FastXMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  async parse(xml: string): Promise<ProductData[]> {
    const result = this.parser.parse(xml);
    const products = result.products?.product || [];
    
    return products.map((p: any) => {
      const data = {
        id: p.id?.toString() || '',
        name: p.name || '',
        price: this.parsePrice(p.price),
        stock: parseInt(p.stock || '0'),
        category: p.category || '',
        categoryRaw: p.category || '',
        description: p.description || '',
        images: Array.isArray(p.images?.image) ? p.images.image : [p.images?.image].filter(Boolean),
      };
      
      return {
        ...data,
        contentHash: Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 32),
      };
    });
  }

  private parsePrice(priceStr: any): number {
    if (typeof priceStr === 'number') return priceStr;
    if (!priceStr) return 0;

    // Fix for "1.299,99 TL" format
    // 1. Remove currency (TL, $, € etc)
    let cleaned = priceStr.toString().replace(/[^\d,.]/g, '');
    
    // 2. Handle European format (1.299,99)
    // If there's a comma and a dot, comma is likely decimal
    // If only comma, it's decimal
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // 1.299,99 -> 1299.99
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      // 1299,99 -> 1299.99
      cleaned = cleaned.replace(',', '.');
    }
    
    return parseFloat(cleaned) || 0;
  }
}
