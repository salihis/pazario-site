import { Router } from 'express';
import { Marketplace, PrismaClient } from '@prisma/client';
import { CategoryAttributeService } from '../../services/CategoryAttributeService';

const router = Router();
const prisma = new PrismaClient();
const attributeService = new CategoryAttributeService();

/**
 * GET /category-attributes/:marketplace/:categoryId
 * Query: ?productId= (opsiyonel — mevcut değerleri ekler)
 */
router.get('/:marketplace/:categoryId', async (req, res) => {
  const { marketplace, categoryId } = req.params;
  const { productId } = req.query;

  try {
    const attributes = await attributeService.getAttributes(
      marketplace as Marketplace,
      categoryId,
      productId as string
    );

    res.json({
      attributes,
      source: 'cache', // Basitleştirildi
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /category-attributes/:marketplace/:categoryId/refresh
 */
router.post('/:marketplace/:categoryId/refresh', async (req, res) => {
  const { marketplace, categoryId } = req.params;

  try {
    attributeService.refreshFromAPI(marketplace as Marketplace, categoryId).catch(console.error);
    res.status(202).json({ message: 'Yenileniyor…' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /products/:productId/attributes/:marketplace
 */
router.get('/product/:productId/:marketplace', async (req, res) => {
  const { productId, marketplace } = req.params;

  try {
    const attributes = await prisma.productAttribute.findMany({
      where: { productId, marketplace: marketplace as Marketplace },
    });
    res.json(attributes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /products/:productId/attributes/:marketplace
 */
router.put('/product/:productId/:marketplace', async (req, res) => {
  const { productId, marketplace } = req.params;
  const { attributes } = req.body;

  try {
    let saved = 0;
    let updated = 0;

    for (const attr of attributes) {
      const existing = await prisma.productAttribute.findUnique({
        where: {
          productId_marketplace_attributeId: {
            productId,
            marketplace: marketplace as Marketplace,
            attributeId: attr.attributeId,
          },
        },
      });

      if (existing) {
        await prisma.productAttribute.update({
          where: { id: existing.id },
          data: {
            valueId: attr.valueId,
            valueText: attr.valueText,
            savedAt: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.productAttribute.create({
          data: {
            productId,
            marketplace: marketplace as Marketplace,
            attributeId: attr.attributeId,
            attributeName: attr.attributeName,
            valueId: attr.valueId,
            valueText: attr.valueText,
          },
        });
        saved++;
      }
    }

    res.json({ saved, updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /products/attributes/bulk-apply
 */
router.post('/bulk-apply', async (req, res) => {
  const { productIds, marketplace, attributes } = req.body;

  try {
    let applied = 0;
    for (const productId of productIds) {
      for (const attr of attributes) {
        await prisma.productAttribute.upsert({
          where: {
            productId_marketplace_attributeId: {
              productId,
              marketplace: marketplace as Marketplace,
              attributeId: attr.attributeId,
            },
          },
          update: {
            valueId: attr.valueId,
            valueText: attr.valueText,
            isInherited: true,
            savedAt: new Date(),
          },
          create: {
            productId,
            marketplace: marketplace as Marketplace,
            attributeId: attr.attributeId,
            attributeName: attr.attributeName,
            valueId: attr.valueId,
            valueText: attr.valueText,
            isInherited: true,
          },
        });
      }
      applied++;
    }

    res.json({ applied, products: productIds });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
