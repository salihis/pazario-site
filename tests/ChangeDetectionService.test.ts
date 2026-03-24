import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChangeDetectionService } from "../src/services/ChangeDetectionService";
import { ProductData } from "../src/services/XMLParser";
import prisma from "../services/Database";

// Mock Prisma
vi.mock("../services/Database", () => ({
  default: {
    product: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("ChangeDetectionService", () => {
  const xmlProducts: ProductData[] = [
    { id: "P1", name: "T1", price: 100, stock: 10, category: "C1", images: [] },
    { id: "P2", name: "T2", price: 200, stock: 20, category: "C2", images: [] },
    { id: "P3", name: "T3", price: 300, stock: 30, category: "C3", images: [] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect new, changed, and unchanged products", async () => {
    // DB state: P2 (changed price), P3 (same price)
    (prisma.product.findMany as any).mockResolvedValue([
      { id: "db-p2", externalId: "P2", price: 150 },
      { id: "db-p3", externalId: "P3", price: 300 },
    ]);

    const result = await ChangeDetectionService.detectChanges(xmlProducts, "source-1");

    expect(result.newProducts).toHaveLength(1);
    expect(result.newProducts[0].id).toBe("P1");

    expect(result.changedProducts).toHaveLength(1);
    expect(result.changedProducts[0].id).toBe("P2");

    expect(result.unchangedIds).toHaveLength(1);
    expect(result.unchangedIds[0]).toBe("db-p3");
  });

  it("should handle large batch performance (simulated)", async () => {
    const largeXml: ProductData[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `P${i}`, name: `T${i}`, price: 100, stock: 10, category: `C${i}`, images: []
    }));

    (prisma.product.findMany as any).mockResolvedValue([]);

    const start = Date.now();
    await ChangeDetectionService.detectChanges(largeXml, "source-1");
    const end = Date.now();

    expect(end - start).toBeLessThan(2000);
  });
});
