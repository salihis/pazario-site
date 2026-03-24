import { Router, Request, Response } from "express";
import prisma from "../../../services/Database.js";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth.middleware.js";
import { Marketplace, MappingStatus } from "@prisma/client";
import { CategoryMappingService } from "../../services/CategoryMappingService.js";

const router = Router();

/**
 * GET /category-mappings/pending
 * Onay bekleyen eşleştirmeler
 */
router.get(
  "/category-mappings/pending",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { marketplace, page = "1", limit = "50" } = req.query;
      const p = parseInt(page as string);
      const l = parseInt(limit as string);

      const where: any = { status: "PENDING" };
      if (marketplace) where.marketplace = marketplace as Marketplace;

      const [data, total] = await Promise.all([
        prisma.categoryMapping.findMany({
          where,
          skip: (p - 1) * l,
          take: l,
          orderBy: { createdAt: "desc" },
        }),
        prisma.categoryMapping.count({ where }),
      ]);

      res.json({
        data,
        meta: {
          total,
          page: p,
          limit: l,
          pages: Math.ceil(total / l),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PUT /category-mappings/:id/approve
 * AI önerisini onayla
 */
router.put(
  "/category-mappings/:id/approve",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { suggestionIndex = 0 } = req.body;

      const mapping = await prisma.categoryMapping.findUnique({ where: { id } });
      if (!mapping) return res.status(404).json({ error: "Mapping not found" });

      const suggestions = mapping.allSuggestions as any[];
      const selected = suggestions[suggestionIndex];

      if (!selected) return res.status(400).json({ error: "Invalid suggestion index" });

      const updated = await prisma.categoryMapping.update({
        where: { id },
        data: {
          status: "APPROVED",
          marketplaceCategoryId: selected.categoryId,
          marketplaceCategoryPath: selected.categoryPath,
          approvedBy: req.user?.email || "ADMIN",
          approvedAt: new Date(),
        },
      });

      // TODO: Bu sourceCategory bekleyen ürünleri kuyruğa al (background)
      // Bu adım genellikle bir message broker veya background job ile yapılır.

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PUT /category-mappings/:id/approve-manual
 * Manuel kategori eşleştir
 */
router.put(
  "/category-mappings/:id/approve-manual",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { marketplaceCategoryId, marketplaceCategoryPath } = req.body;

      const updated = await prisma.categoryMapping.update({
        where: { id },
        data: {
          status: "APPROVED",
          marketplaceCategoryId,
          marketplaceCategoryPath,
          aiSuggested: false,
          approvedBy: req.user?.email || "ADMIN",
          approvedAt: new Date(),
        },
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PUT /category-mappings/:id/reject
 * Eşleştirmeyi reddet
 */
router.put(
  "/category-mappings/:id/reject",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await prisma.categoryMapping.update({
        where: { id },
        data: { status: "REJECTED" },
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /category-mappings/bulk-approve
 * Toplu onay
 */
router.post(
  "/category-mappings/bulk-approve",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { items } = req.body; // [{ id: string, suggestionIndex: number }]
      
      const results = await prisma.$transaction(async (tx) => {
        const approved = [];
        for (const item of items) {
          const mapping = await tx.categoryMapping.findUnique({ where: { id: item.id } });
          if (!mapping) continue;

          const suggestions = mapping.allSuggestions as any[];
          const selected = suggestions[item.suggestionIndex || 0];

          if (selected) {
            const updated = await tx.categoryMapping.update({
              where: { id: item.id },
              data: {
                status: "APPROVED",
                marketplaceCategoryId: selected.categoryId,
                marketplaceCategoryPath: selected.categoryPath,
                approvedBy: req.user?.email || "ADMIN",
                approvedAt: new Date(),
              },
            });
            approved.push(updated);
          }
        }
        return approved;
      });

      res.json({
        approved: results.length,
        failed: items.length - results.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /category-mappings/suggest
 * Manuel AI öneri tetikle
 */
router.post(
  "/category-mappings/suggest",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { sourceCategory, marketplace, sourceId } = req.body;
      
      // Async tetikleme (demo için direkt çağırıyoruz ama mappingId dönüyoruz)
      const result = await CategoryMappingService.resolveCategory(
        sourceCategory,
        marketplace as Marketplace
      );

      res.status(202).json({ mappingId: result.mappingId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /marketplace-categories/:marketplace/search
 * Kategori ağacında metin araması
 */
router.get(
  "/marketplace-categories/:marketplace/search",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { marketplace } = req.params;
      const { q, isLeaf = "true", limit = "20" } = req.query;
      const l = parseInt(limit as string);

      // pg_trgm benzerlik araması
      const results = await prisma.$queryRaw<any[]>`
        SELECT "categoryId", "categoryPath", "categoryName"
        FROM marketplace_categories
        WHERE marketplace = ${marketplace}::"Marketplace"
        AND "isLeaf" = ${isLeaf === "true"}
        AND similarity("categoryPath", ${q as string}) > 0.1
        ORDER BY similarity("categoryPath", ${q as string}) DESC
        LIMIT ${l}
      `;

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /category-stats
 * İstatistikler
 */
router.get(
  "/category-stats",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const [pending, approved, rejected, total] = await Promise.all([
        prisma.categoryMapping.count({ where: { status: "PENDING" } }),
        prisma.categoryMapping.count({ where: { status: "APPROVED" } }),
        prisma.categoryMapping.count({ where: { status: "REJECTED" } }),
        prisma.categoryMapping.count(),
      ]);

      res.json({ pending, approved, rejected, total });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
