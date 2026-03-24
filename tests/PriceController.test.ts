import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { PriceController } from "../src/api/controllers/price.controller";
import prisma from "../services/Database";

// Mock Prisma
vi.mock("../services/Database", () => ({
  default: {
    priceRule: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    globalPriceSettings: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    priceCalculation: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock PriceEngine
vi.mock("../src/services/PriceEngine", () => {
  return {
    PriceEngine: vi.fn().mockImplementation(() => {
      return {
        simulate: vi.fn().mockReturnValue({
          ara1BaseEk: 110,
          ara2Kar: 137.5,
          ara3Kargo: 152.5,
          rawPrice: 179.41,
          finalPrice: 179.41,
          minPriceApplied: false,
        }),
        calculate: vi.fn().mockResolvedValue({
          ruleName: "Test Rule",
          finalPrice: 100,
          minPriceApplied: false,
        }),
      };
    }),
    PriceRuleNotFoundError: class extends Error {},
    InvalidRuleError: class extends Error {},
  };
});

const app = express();
app.use(express.json());

// Mock auth middleware for tests
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { email: "test@example.com", role: "ADMIN" };
  next();
};

app.post("/simulate", PriceController.simulate);
app.get("/preview/:productId", PriceController.preview);
app.post("/price-rules", mockAuth, PriceController.createPriceRule);

describe("PriceController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /simulate should calculate correctly", async () => {
    const response = await request(app)
      .post("/simulate")
      .send({
        basePrice: 100,
        ekTutar: 10,
        karOrani: 1.25,
        kargo: 15,
        komisyonOrani: 0.15,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.finalPrice).toBe(179.41);
  });

  it("POST /simulate should return 400 for karOrani < 1", async () => {
    const response = await request(app)
      .post("/simulate")
      .send({
        basePrice: 100,
        ekTutar: 10,
        karOrani: 0.9,
        kargo: 15,
        komisyonOrani: 0.15,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("karOrani");
  });

  it("POST /price-rules should validate input", async () => {
    const response = await request(app)
      .post("/price-rules")
      .send({
        name: "New Rule",
        marketplace: "TRENDYOL",
        scopeType: "GLOBAL",
        ekTutar: 10,
        karOrani: 0.5, // Invalid
        kargo: 5,
        komisyonOrani: 0.1,
        priority: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it("GET /preview/:productId should return results for all marketplaces", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: "p1", price: 100 });

    const response = await request(app).get("/preview/p1");

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(4);
    expect(response.body.results[0].marketplace).toBeDefined();
  });
});
