import { describe, it, expect, vi, beforeEach } from "vitest";
import { PriceEngine, PriceRuleNotFoundError, InvalidRuleError } from "../src/services/PriceEngine";
import { Marketplace, ScopeType } from "@prisma/client";
import prisma from "../services/Database";

// Mock Prisma
vi.mock("../services/Database", () => ({
  default: {
    product: {
      findUnique: vi.fn(),
    },
    priceRule: {
      findMany: vi.fn(),
    },
    globalPriceSettings: {
      findFirst: vi.fn(),
    },
    priceCalculation: {
      create: vi.fn(),
    },
  },
}));

describe("PriceEngine", () => {
  const productId = "prod-123";
  const syncJobId = "job-456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate price correctly with basic formula", async () => {
    // base=200, ek=10, kar=1.25, kargo=15, kom=0.15 -> 326.47
    // ara1 = 200 + 10 = 210
    // ara2 = 210 * 1.25 = 262.5
    // ara3 = 262.5 + 15 = 277.5
    // raw = 277.5 / (1 - 0.15) = 277.5 / 0.85 = 326.4705...
    // final = 326.47

    (prisma.product.findUnique as any).mockResolvedValue({
      id: productId,
      brand: "Apple",
      categoryRaw: "Elektronik > Telefon",
    });

    (prisma.priceRule.findMany as any).mockResolvedValue([
      {
        id: "rule-1",
        name: "Test Rule",
        marketplace: Marketplace.TRENDYOL,
        scopeType: ScopeType.GLOBAL,
        ekTutar: 10,
        karOrani: 1.25,
        kargo: 15,
        komisyonOrani: 0.15,
        priority: 100,
        active: true,
      },
    ]);

    (prisma.globalPriceSettings.findFirst as any).mockResolvedValue({
      minPrice: 50,
    });

    const engine = new PriceEngine();
    const result = await engine.calculate({
      basePrice: 200,
      marketplace: Marketplace.TRENDYOL,
      productId,
      syncJobId,
    });

    expect(result.finalPrice).toBe(326.47);
    expect(result.ara1BaseEk).toBe(210);
    expect(result.ara2Kar).toBe(262.5);
    expect(result.ara3Kargo).toBe(277.5);
    expect(result.minPriceApplied).toBe(false);
  });

  it("should apply global minimum price when final price is lower", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: productId });
    (prisma.priceRule.findMany as any).mockResolvedValue([
      {
        id: "rule-1",
        name: "Cheap Rule",
        marketplace: Marketplace.TRENDYOL,
        scopeType: ScopeType.GLOBAL,
        ekTutar: 0,
        karOrani: 1.0,
        kargo: 0,
        komisyonOrani: 0,
        priority: 100,
        active: true,
      },
    ]);
    (prisma.globalPriceSettings.findFirst as any).mockResolvedValue({
      minPrice: 100,
    });

    const engine = new PriceEngine();
    const result = await engine.calculate({
      basePrice: 50,
      marketplace: Marketplace.TRENDYOL,
      productId,
      syncJobId,
    });

    expect(result.finalPrice).toBe(100);
    expect(result.minPriceApplied).toBe(true);
  });

  it("should throw PriceRuleNotFoundError when no rule matches", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: productId });
    (prisma.priceRule.findMany as any).mockResolvedValue([]);

    const engine = new PriceEngine();
    await expect(engine.calculate({
      basePrice: 100,
      marketplace: Marketplace.TRENDYOL,
      productId,
      syncJobId,
    })).rejects.toThrow(PriceRuleNotFoundError);
  });

  it("should throw InvalidRuleError when karOrani is less than 1.0", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: productId });
    (prisma.priceRule.findMany as any).mockResolvedValue([
      {
        id: "rule-bad",
        name: "Bad Rule",
        marketplace: Marketplace.TRENDYOL,
        scopeType: ScopeType.GLOBAL,
        ekTutar: 0,
        karOrani: 0.9,
        kargo: 0,
        komisyonOrani: 0,
        priority: 1,
        active: true,
      },
    ]);

    const engine = new PriceEngine();
    await expect(engine.calculate({
      basePrice: 100,
      marketplace: Marketplace.TRENDYOL,
      productId,
      syncJobId,
    })).rejects.toThrow(InvalidRuleError);
  });
});
