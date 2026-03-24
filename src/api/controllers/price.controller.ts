import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../../../services/Database";
import { PriceEngine } from "../../services/PriceEngine";
import { Marketplace, ScopeType } from "@prisma/client";

// Zod schemas
const priceRuleSchema = z.object({
  name: z.string().min(1),
  marketplace: z.nativeEnum(Marketplace),
  scopeType: z.nativeEnum(ScopeType),
  scopeValue: z.string().optional(),
  ekTutar: z.number().min(0),
  karOrani: z.number().min(1.0).max(9.9999),
  kargo: z.number().min(0),
  komisyonOrani: z.number().min(0).max(0.99),
  priority: z.number().int().positive(),
});

const globalSettingsSchema = z.object({
  minPrice: z.number().positive(),
});

export class PriceController {
  /**
   * Fiyat kurallarını listele
   */
  static async getPriceRules(req: Request, res: Response) {
    try {
      const { marketplace, scopeType, active, page = "1", limit = "25" } = req.query;
      const p = parseInt(page as string);
      const l = parseInt(limit as string);

      const where: any = {};
      if (marketplace) where.marketplace = marketplace as Marketplace;
      if (scopeType) where.scopeType = scopeType as ScopeType;
      if (active !== undefined) where.active = active === "true";

      const [data, total] = await Promise.all([
        prisma.priceRule.findMany({
          where,
          skip: (p - 1) * l,
          take: l,
          orderBy: { priority: "asc" },
        }),
        prisma.priceRule.count({ where }),
      ]);

      res.json({
        data,
        meta: { total, page: p, limit: l },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Yeni fiyat kuralı oluştur
   */
  static async createPriceRule(req: Request, res: Response) {
    try {
      const validated = priceRuleSchema.parse(req.body);
      const rule = await prisma.priceRule.create({
        data: {
          ...validated,
          active: true,
          createdBy: (req as any).user?.email || "ADMIN",
        },
      });
      res.status(201).json(rule);
    } catch (error: any) {
      if (error.name === "ZodError" || error.issues) {
        return res.status(400).json({ errors: error.issues || error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Fiyat kuralını güncelle
   */
  static async updatePriceRule(req: Request, res: Response) {
    try {
      const { ruleId } = req.params;
      const validated = priceRuleSchema.partial().parse(req.body);
      const rule = await prisma.priceRule.update({
        where: { id: ruleId },
        data: validated,
      });
      res.json(rule);
    } catch (error: any) {
      if (error.name === "ZodError" || error.issues) {
        return res.status(400).json({ errors: error.issues || error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Fiyat kuralını sil (soft delete)
   */
  static async deletePriceRule(req: Request, res: Response) {
    try {
      const { ruleId } = req.params;
      await prisma.priceRule.update({
        where: { id: ruleId },
        data: { active: false },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Fiyat simülasyonu (DB kaydı yapmaz)
   */
  static async simulate(req: Request, res: Response) {
    try {
      const { basePrice, marketplace } = req.body;
      
      const engine = new PriceEngine();
      const result = await engine.simulate(
        basePrice,
        marketplace as Marketplace
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ürün için 4 pazaryeri fiyat önizlemesi
   */
  static async preview(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { price: true }
      });

      if (!product) return res.status(404).json({ error: "Ürün bulunamadı." });

      const marketplaces = [Marketplace.TRENDYOL, Marketplace.HEPSIBURADA, Marketplace.N11, Marketplace.AMAZON];
      const results = [];
      const engine = new PriceEngine();

      for (const mp of marketplaces) {
        try {
          const result = await engine.calculate({
            basePrice: Number(product.price),
            marketplace: mp,
            productId,
            syncJobId: "PREVIEW"
          });
          results.push({
            marketplace: mp,
            finalPrice: result.finalPrice,
          });
        } catch (e: any) {
          results.push({
            marketplace: mp,
            error: e.message
          });
        }
      }

      res.json({
        productId,
        basePrice: Number(product.price),
        results
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Global fiyat ayarlarını getir
   */
  static async getPriceSettings(req: Request, res: Response) {
    try {
      const settings = await prisma.globalPriceSettings.findFirst();
      res.json(settings || { minPrice: 0, currency: "TRY", updatedAt: new Date() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Global fiyat ayarlarını güncelle
   */
  static async updatePriceSettings(req: Request, res: Response) {
    try {
      const validated = globalSettingsSchema.parse(req.body);
      const settings = await prisma.globalPriceSettings.findFirst();
      
      let updated;
      if (settings) {
        updated = await prisma.globalPriceSettings.update({
          where: { id: settings.id },
          data: {
            minPrice: validated.minPrice,
            updatedBy: (req as any).user?.email || "ADMIN",
          },
        });
      } else {
        updated = await prisma.globalPriceSettings.create({
          data: {
            minPrice: validated.minPrice,
            currency: "TRY",
            updatedBy: (req as any).user?.email || "ADMIN",
          },
        });
      }

      // Side effect: etkilenen ürünlerin hashAtPublish'ini sıfırla (arka planda)
      // Bu örnekte Listing modelinde hashAtPublish alanı olduğunu varsayıyoruz
      await prisma.marketplaceListing.updateMany({ data: { hashAtPublish: null } });

      res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError" || error.issues) {
        return res.status(400).json({ errors: error.issues || error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Fiyat hesaplama loglarını getir
   */
  static async getPriceCalculations(req: Request, res: Response) {
    try {
      const { productId, marketplace, syncJobId, page = "1", limit = "25" } = req.query;
      const p = parseInt(page as string);
      const l = parseInt(limit as string);

      const where: any = {};
      if (productId) where.productId = productId as string;
      if (marketplace) where.marketplace = marketplace as Marketplace;
      if (syncJobId) where.syncJobId = syncJobId as string;

      const [data, total] = await Promise.all([
        prisma.priceCalculation.findMany({
          where,
          skip: (p - 1) * l,
          take: l,
          orderBy: { calculatedAt: "desc" },
        }),
        prisma.priceCalculation.count({ where }),
      ]);

      res.json({
        data,
        meta: { total, page: p, limit: l },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
