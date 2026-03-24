import { Router } from 'express';
import { Marketplace, PrismaClient, PublishStatus } from '@prisma/client';
import { PublishService } from '../../services/PublishService';

const router = Router();
const prisma = new PrismaClient();
const publishService = new PublishService();

/**
 * POST /publish/submit
 */
router.post('/submit', async (req, res) => {
  const { productIds, marketplace, triggeredBy } = req.body;

  try {
    const result = await publishService.submitProducts(
      productIds,
      marketplace as Marketplace,
      triggeredBy || 'manual'
    );

    res.status(202).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /publish/jobs
 */
router.get('/jobs', async (req, res) => {
  const { status, marketplace, productId, page = 1, limit = 25 } = req.query;

  try {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    if (status) where.status = status as PublishStatus;
    if (marketplace) where.marketplace = marketplace as Marketplace;
    if (productId) where.productId = productId as string;

    const jobs = await prisma.productPublishJob.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { title: true, sku: true } } },
    });

    const total = await prisma.productPublishJob.count({ where });

    res.json({
      jobs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /publish/jobs/:jobId
 */
router.get('/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await prisma.productPublishJob.findUnique({
      where: { id: jobId },
      include: { product: true },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /publish/jobs/:jobId/retry
 */
router.post('/jobs/:jobId/retry', async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await prisma.productPublishJob.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    await publishService.submitProducts([job.productId], job.marketplace, 'retry');
    res.status(202).json({ message: 'Retry initiated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /publish/status/:productId/:marketplace
 */
router.get('/status/:productId/:marketplace', async (req, res) => {
  const { productId, marketplace } = req.params;

  try {
    const lastJob = await prisma.productPublishJob.findFirst({
      where: { productId, marketplace: marketplace as Marketplace },
      orderBy: { createdAt: 'desc' },
    });

    const completeness = await (publishService as any).getProductCompleteness(productId, marketplace as Marketplace);

    res.json({
      status: lastJob?.status || 'NOT_PUBLISHED',
      completenessPercent: completeness.completenessPercent,
      lastJobId: lastJob?.id,
      resolvedAt: lastJob?.resolvedAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
