import { XMLParser as FastXMLParser, XMLValidator } from "fast-xml-parser";
import crypto from "crypto";

export interface ParsedProduct {
  id: string;
  sku: string;
  barcode: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  price: number;
  listPrice: number | null;
  currency: string;
  stock: number;
  images: string[];
  attributes: Record<string, string>;
  contentHash: string;
}

export interface ParseError {
  type: "ERROR" | "WARN";
  code: string;
  message: string;
  raw?: unknown;
}

export interface ParseResult {
  products: ParsedProduct[];
  meta: {
    totalNodes: number;
    parsed: number;
    failed: number;
    durationMs: number;
    feedType: "RSS_SHOPPING" | "ATOM" | "CUSTOM" | "ROOT_ARRAY" | string;
  };
  errors: ParseError[];
}

export class XMLParseError extends Error {
  constructor(message: string, public code: string = "PARSE_ERROR") {
    super(message);
    this.name = "XMLParseError";
  }
}

export class XMLParser {
  private parser: FastXMLParser;

  constructor() {
    this.parser = new FastXMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      removeNSPrefix: true,
      trimValues: true,
      isArray: (name) => ["item", "product", "offer", "entry", "image", "images"].includes(name),
    });
  }

  /**
   * Main parse method
   */
  public parse(xmlString: string): ParseResult {
    const startTime = Date.now();
    const errors: ParseError[] = [];
    
    // 1. Pre-processing
    const processedXml = this.preprocess(xmlString);

    // 2. Validation
    const validation = XMLValidator.validate(processedXml);
    if (validation !== true) {
      throw new XMLParseError(`Invalid XML: ${validation.err.msg}`, "INVALID_XML");
    }

    // 3. Parsing
    const jsonObj = this.parser.parse(processedXml);
    if (!jsonObj) {
      throw new XMLParseError("Empty or invalid XML structure", "EMPTY_FEED");
    }

    // 4. Extraction
    const { products, feedType } = this.extractProducts(jsonObj);

    if (products.length === 0) {
      errors.push({
        type: "WARN",
        code: "EMPTY_FEED",
        message: "No products found in the feed.",
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      products,
      meta: {
        totalNodes: products.length,
        parsed: products.length,
        failed: 0,
        durationMs,
        feedType,
      },
      errors,
    };
  }

  /**
   * Pre-processing: Encoding, entities, null bytes
   */
  private preprocess(xml: string): string {
    let processed = xml.replace(/\x00/g, ""); // Remove null bytes
    
    // Update encoding to UTF-8
    processed = processed.replace(/encoding="[^"]*"/i, 'encoding="UTF-8"');

    // Fix bare & characters (not part of an entity)
    // This is a simple regex, might need refinement for complex cases
    processed = processed.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[a-fA-F\d]+;)/g, "&amp;");

    return processed;
  }

  /**
   * Extract products based on format
   */
  private extractProducts(json: any): { products: ParsedProduct[]; feedType: string } {
    let rawItems: any[] = [];
    let feedType = "UNKNOWN";

    // 1. Google Shopping RSS: rss.channel.item[]
    if (json.rss?.channel?.item) {
      rawItems = json.rss.channel.item;
      feedType = "RSS_SHOPPING";
    }
    // 2. Atom feed: feed.entry[]
    else if (json.feed?.entry) {
      rawItems = json.feed.entry;
      feedType = "ATOM";
    }
    // 3. <products><product>[]
    else if (json.products?.product) {
      rawItems = json.products.product;
      feedType = "CUSTOM_PRODUCTS";
    }
    // 4. <catalog><item>[]
    else if (json.catalog?.item) {
      rawItems = json.catalog.item;
      feedType = "CUSTOM_CATALOG";
    }
    // 5. <items><product>[]
    else if (json.items?.product) {
      rawItems = json.items.product;
      feedType = "CUSTOM_ITEMS";
    }
    // 6. Root array fallback
    else if (Array.isArray(json)) {
      rawItems = json;
      feedType = "ROOT_ARRAY";
    }

    const products = rawItems.map((item) => this.normalizeProduct(item)).filter(Boolean) as ParsedProduct[];
    return { products, feedType };
  }

  /**
   * Normalize raw JSON item to ParsedProduct
   */
  private normalizeProduct(item: any): ParsedProduct | null {
    try {
      // Map common fields across formats
      const id = String(item.id || item.g_id || item.sku || item.barcode || "");
      const sku = String(item.sku || item.g_sku || item.id || "");
      const barcode = item.barcode || item.g_gtin || item.gtin || null;
      const title = item.title || item.g_title || "";
      const description = item.description || item.g_description || null;
      const brand = item.brand || item.g_brand || null;
      const category = item.category || item.g_google_product_category || item.product_type || null;
      const stock = parseInt(item.stock || item.quantity || item.g_availability === "in stock" ? "999" : "0") || 0;
      
      const rawPrice = item.price || item.g_price || "0";
      const { price, currency } = this.parsePrice(rawPrice);
      
      const rawListPrice = item.list_price || item.g_sale_price || null;
      const listPrice = rawListPrice ? this.parsePrice(rawListPrice).price : null;

      // Images
      let images: string[] = [];
      const imgField = item.image_link || item.g_image_link || item.image || item.images;
      if (Array.isArray(imgField)) {
        images = imgField.map(String);
      } else if (typeof imgField === "string") {
        images = [imgField];
      } else if (imgField && typeof imgField === "object") {
        // Handle cases where images are nested
        const nested = imgField.image || imgField.url;
        if (Array.isArray(nested)) images = nested.map(String);
        else if (nested) images = [String(nested)];
      }

      // Attributes (everything else)
      const attributes: Record<string, string> = {};
      Object.keys(item).forEach((key) => {
        if (typeof item[key] === "string" || typeof item[key] === "number") {
          attributes[key] = String(item[key]);
        }
      });

      const product: Omit<ParsedProduct, "contentHash"> = {
        id,
        sku,
        barcode,
        title,
        description,
        brand,
        category,
        price,
        listPrice,
        currency,
        stock,
        images,
        attributes,
      };

      const contentHash = this.generateHash(product);

      return { ...product, contentHash };
    } catch (e) {
      console.error("Normalization error:", e);
      return null;
    }
  }

  /**
   * Price parsing logic
   */
  private parsePrice(priceStr: any): { price: number; currency: string } {
    if (typeof priceStr === "number") return { price: priceStr, currency: "TRY" };
    if (!priceStr || typeof priceStr !== "string") return { price: 0, currency: "TRY" };

    let cleaned = priceStr.trim();
    let currency = "TRY";

    // Detect currency
    if (cleaned.includes("USD") || cleaned.includes("$")) currency = "USD";
    else if (cleaned.includes("EUR") || cleaned.includes("€")) currency = "EUR";
    else if (cleaned.includes("TL") || cleaned.includes("TRY") || cleaned.includes("₺")) currency = "TRY";

    // Remove non-numeric characters except dots and commas
    cleaned = cleaned.replace(/[^\d.,]/g, "");

    // Handle Turkish format: 1.299,99
    if (cleaned.includes(",") && cleaned.includes(".")) {
      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");
      if (lastComma > lastDot) {
        // 1.299,99 -> 1299.99
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else {
        // 1,299.99 -> 1299.99
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (cleaned.includes(",")) {
      // 1299,99 -> 1299.99
      cleaned = cleaned.replace(",", ".");
    }

    const price = parseFloat(cleaned) || 0;
    return { price, currency };
  }

  /**
   * Generate MD5 hash for change detection
   */
  private generateHash(p: Omit<ParsedProduct, "contentHash">): string {
    const data = `${p.id}|${p.price}|${p.stock}|${p.title}`;
    return crypto.createHash("md5").update(data).digest("hex");
  }

  /**
   * Stream parsing for large files (Placeholder for SAX implementation)
   */
  public async parseStream(stream: any): Promise<ParseResult> {
    // In a real scenario, we'd use a SAX parser here to avoid loading everything in memory
    // For this implementation, we'll assume the standard parse is sufficient or 
    // provide a basic structure.
    throw new Error("Stream parsing not implemented in this version.");
  }
}
