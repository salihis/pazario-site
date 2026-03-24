import { PrismaClient, Marketplace, PublishStatus, Product } from '@prisma/client';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { CategoryAttributeService } from './CategoryAttributeService';
import { publishQueue } from '../queue/queues';

const prisma = new PrismaClient();
const attributeService = new CategoryAttributeService();

const POLLING_CONFIG: Record<Marketplace, { intervalSec: number; maxAttempts: number }> = {
  [Marketplace.TRENDYOL]:    { intervalSec: 10, maxAttempts: 12 },   // max 2 dk
  [Marketplace.N11]:         { intervalSec: 15, maxAttempts: 20 },   // max 5 dk
  [Marketplace.HEPSIBURADA]: { intervalSec: 20, maxAttempts: 15 },   // max 5 dk
  [Marketplace.PAZARAMA]:    { intervalSec: 0,  maxAttempts: 1  },   // tek seferlik
  [Marketplace.AMAZON]:      { intervalSec: 30, maxAttempts: 10 },
};

export class PublishService {
  /**
   * Seçili ürünleri pazaryerine gönderir.
   */
  async submitProducts(productIds: string[], marketplace: Marketplace, triggeredBy: string) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const submittedJobs: string[] = [];
    const skipped: { productId: string; reason: string }[] = [];

    const adapter = AdapterFactory.getAdapter(marketplace);

    for (const product of products) {
      try {
        // 1a. Zorunlu attribute'lar dolu mu?
        const completeness = await this.getProductCompleteness(product.id, marketplace);
        if (completeness.completenessPercent < 100) {
          skipped.push({ 
            productId: product.id, 
            reason: `Eksik zorunlu alanlar: ${completeness.missingAttributes.join(', ')}` 
          });
          continue;
        }

        // 1d. Pazaryerine gönder
        const externalJobId = await adapter.publish(product);

        // 1e. ProductPublishJob oluştur
        const job = await prisma.productPublishJob.create({
          data: {
            productId: product.id,
            marketplace,
            externalJobId: externalJobId || null,
            status: externalJobId ? PublishStatus.SUBMITTED : PublishStatus.SUCCESS,
            triggeredBy,
            submittedAt: new Date(),
            resolvedAt: externalJobId ? null : new Date(),
          },
        });

        // 2. BullMQ polling job'larını kuyruğa al (eğer asenkron ise)
        if (externalJobId) {
          const config = POLLING_CONFIG[marketplace];
          if (config.intervalSec > 0) {
            await publishQueue.add('poll-status', { jobId: job.id }, {
              delay: config.intervalSec * 1000,
              jobId: `poll-${job.id}`,
            });
          }
        }

        submittedJobs.push(job.id);
      } catch (error: any) {
        skipped.push({ productId: product.id, reason: error.message });
      }
    }

    return {
      submitted: submittedJobs.length,
      skipped,
      jobIds: submittedJobs,
    };
  }

  /**
   * BullMQ worker tarafından her X saniyede çağrılır.
   */
  async pollJobStatus(jobId: string) {
    // 1. ProductPublishJob'ı çek
    const job = await prisma.productPublishJob.findUnique({
      where: { id: jobId },
      include: { product: true },
    });

    if (!job || !job.externalJobId) return;
    if (job.status === PublishStatus.SUCCESS || job.status === PublishStatus.FAILED) return;

    const config = POLLING_CONFIG[job.marketplace];
    
    // 3. attemptCount > limit → status=POLLING_TIMEOUT
    if (job.attemptCount >= config.maxAttempts) {
      await prisma.productPublishJob.update({
        where: { id: jobId },
        data: { status: PublishStatus.POLLING_TIMEOUT, resolvedAt: new Date() },
      });
      // Slack bildirimi tetiklenebilir
      return;
    }

    const adapter = AdapterFactory.getAdapter(job.marketplace);
    
    try {
      // 2. Pazaryerine externalJobId ile durum sor
      const result = await adapter.getPublishStatus!(job.externalJobId);

      if (result.status === 'SUCCESS') {
        await prisma.$transaction([
          prisma.productPublishJob.update({
            where: { id: jobId },
            data: { status: PublishStatus.SUCCESS, resolvedAt: new Date() },
          }),
          prisma.marketplaceListing.upsert({
            where: { productId_marketplace: { productId: job.productId, marketplace: job.marketplace } },
            update: { status: 'PUBLISHED', publishedAt: new Date(), hashAtPublish: job.product.contentHash },
            create: { productId: job.productId, marketplace: job.marketplace, status: 'PUBLISHED', publishedAt: new Date(), hashAtPublish: job.product.contentHash },
          }),
        ]);
      } else if (result.status === 'FAILED') {
        await prisma.productPublishJob.update({
          where: { id: jobId },
          data: { status: PublishStatus.FAILED, errorMessage: result.error, resolvedAt: new Date() },
        });
        // publish_errors tablosuna yazılabilir
      } else {
        // Devam ediyor → status=POLLING
        await prisma.productPublishJob.update({
          where: { id: jobId },
          data: { 
            status: PublishStatus.POLLING, 
            lastPolledAt: new Date(), 
            attemptCount: { increment: 1 } 
          },
        });

        // Yeniden kuyruğa al
        await publishQueue.add('poll-status', { jobId: job.id }, {
          delay: config.intervalSec * 1000,
          jobId: `poll-${job.id}-${job.attemptCount + 1}`,
        });
      }
    } catch (error: any) {
      console.error(`Error polling job ${jobId}:`, error);
    }
  }

  /**
   * Ürünlerin doluluk oranını hesapla.
   */
  async getCompleteness(productIds: string[], marketplace: Marketplace) {
    const results = [];
    for (const id of productIds) {
      results.push(await this.getProductCompleteness(id, marketplace));
    }
    return results;
  }

  private async getProductCompleteness(productId: string, marketplace: Marketplace) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new Error('Product not found');

    // Kategori mapping'den kategori ID'sini bul
    const mapping = await prisma.categoryMapping.findFirst({
      where: { sourceCategory: product.categoryRaw || '', marketplace },
    });

    if (!mapping || !mapping.marketplaceCategoryId) {
      return { productId, totalMandatory: 0, filledMandatory: 0, completenessPercent: 0, missingAttributes: ['Kategori Eşleşmesi Eksik'] };
    }

    const attributes = await attributeService.getAttributes(marketplace, mapping.marketplaceCategoryId, productId);
    const mandatory = attributes.filter(a => a.isMandatory);
    const filled = mandatory.filter(a => a.isValid && a.currentValue !== null);

    const missingAttributes = mandatory
      .filter(a => !a.isValid || a.currentValue === null)
      .map(a => a.attributeName);

    return {
      productId,
      totalMandatory: mandatory.length,
      filledMandatory: filled.length,
      completenessPercent: mandatory.length === 0 ? 100 : Math.round((filled.length / mandatory.length) * 100),
      missingAttributes,
    };
  }
}
