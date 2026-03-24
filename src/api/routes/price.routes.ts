import { Router } from "express";
import { PriceController } from "../controllers/price.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();

// Fiyat kuralları CRUD
router.get("/price-rules", requireAuth, PriceController.getPriceRules);
router.post("/price-rules", requireAuth, requireRole("ADMIN"), PriceController.createPriceRule);
router.put("/price-rules/:ruleId", requireAuth, requireRole("ADMIN"), PriceController.updatePriceRule);
router.delete("/price-rules/:ruleId", requireAuth, requireRole("ADMIN"), PriceController.deletePriceRule);

// Fiyat simülasyonu ve önizleme
router.post("/price-rules/simulate", requireAuth, PriceController.simulate);
router.get("/price-rules/preview/:productId", requireAuth, PriceController.preview);

// Global fiyat ayarları
router.get("/price-settings", requireAuth, PriceController.getPriceSettings);
router.put("/price-settings", requireAuth, requireRole("ADMIN"), PriceController.updatePriceSettings);

// Fiyat hesaplama logları
router.get("/price-calculations", requireAuth, PriceController.getPriceCalculations);

export default router;
