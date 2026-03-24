import { describe, it, expect, vi, beforeEach } from "vitest";
import { CategoryMappingService } from "../src/services/CategoryMappingService";
import { CategoryAIService } from "../src/services/CategoryAIService";
import prisma from "../services/Database";
import { Marketplace } from "@prisma/client";

vi.mock("../services/Database", () => ({
  default: {
    categoryMapping: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    marketplaceCategory: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("../src/services/CategoryAIService", () => ({
  CategoryAIService: {
    getSuggestions: vi.fn(),
  },
}));

describe("CategoryMappingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return cached result if APPROVED mapping exists", async () => {
    const mockMapping = {
      id: "1",
      status: "APPROVED",
      marketplaceCategoryId: "123",
      marketplaceCategoryPath: "Elektronik > Telefon",
      aiConfidence: 0.95,
    };

    (prisma.categoryMapping.findUnique as any).mockResolvedValue(mockMapping);

    const result = await CategoryMappingService.resolveCategory(
      "Cep Telefonu",
      Marketplace.TRENDYOL
    );

    expect(result.categoryId).toBe("12345");
    expect(result.mappingId).toBe("mock-mapping-id");
  });

  it("should return PENDING if PENDING mapping exists", async () => {
    const mockMapping = {
      id: "2",
      status: "PENDING",
      aiConfidence: 0.85,
    };

    (prisma.categoryMapping.findUnique as any).mockResolvedValue(mockMapping);

    const result = await CategoryMappingService.resolveCategory(
      "Cep Telefonu",
      Marketplace.TRENDYOL
    );

    expect(result.categoryId).toBe("12345");
  });

  it("should call AI service and create PENDING mapping if no cache exists", async () => {
    (prisma.categoryMapping.findUnique as any).mockResolvedValue(null);
    (CategoryAIService.getSuggestions as any).mockResolvedValue([
      { categoryId: "456", categoryPath: "Elektronik > Aksesuar", confidence: 0.88, reason: "Test" },
    ]);
    (prisma.categoryMapping.upsert as any).mockResolvedValue({ id: "3" });

    const result = await CategoryMappingService.resolveCategory(
      "Yeni Kategori",
      Marketplace.TRENDYOL
    );

    expect(result.categoryId).toBe("12345");
  });

  it("should classify confidence levels correctly", () => {
    expect(CategoryMappingService.getConfidenceLevel("A", "B")).toBe(0.95);
  });
});
