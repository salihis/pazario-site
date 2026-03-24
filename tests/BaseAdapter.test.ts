import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseAdapter, StatusResult, PriceStockItem } from "../src/adapters/BaseAdapter";
import { Product } from "@prisma/client";

class MockAdapter extends BaseAdapter {
  readonly name = "MOCK";
  readonly rateLimitRPM = 600;

  async publish(product: Product): Promise<string> {
    return "job-123";
  }

  async getStatus(externalId: string): Promise<StatusResult> {
    return { status: "DONE" };
  }

  async updatePriceAndStock(items: PriceStockItem[]): Promise<void> {
    return;
  }

  async publishBatch(products: Product[]): Promise<string> {
    return "batch-123";
  }

  async getPublishStatus(externalJobId: string): Promise<{ status: "SUCCESS" | "FAILED" | "POLLING"; error?: string }> {
    return { status: "SUCCESS" };
  }

  async normalize(product: Product): Promise<any> {
    return { id: product.id };
  }

  // Exposing protected methods for testing
  public testStripHtml(html: string) { return this._stripHtml(html); }
  public testTruncate(str: string, max: number) { return this._truncate(str, max); }
}

describe("BaseAdapter", () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    vi.clearAllMocks();
  });

  it("should correctly strip HTML tags", () => {
    expect(adapter.testStripHtml("<p>Hello <b>World</b>&nbsp;!</p>")).toBe("Hello World !");
  });

  it("should correctly truncate strings", () => {
    expect(adapter.testTruncate("Hello World", 5)).toBe("Hello");
    expect(adapter.testTruncate("Hello", 10)).toBe("Hello");
  });
});
