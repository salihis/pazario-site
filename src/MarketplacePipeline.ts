import { Marketplace, PrismaClient } from '@prisma/client';
import { XMLParser } from './services/XMLParser';
import { ProductValidator } from './services/ProductValidator';
import { ChangeDetectionService } from './services/ChangeDetectionService';
import { PriceEngine } from './services/PriceEngine';
import { CategoryMappingService } from './services/CategoryMappingService';
import { BaseAdapter } from './adapters/BaseAdapter';
import { publishQueue, notifyQueue } from './queue/queues';

const prisma = new PrismaClient();

export interface PipelineResult {
  syncJobId: string;
  totalFetched: number;
  newProducts: number;
  changedProducts: number;
  unchanged: number;
  published: number;
  failed: number;
  skippedValidation: number;
  durationMs: number;
}

export class MarketplacePipeline {
  constructor(
    private parser: XMLParser,
    private validator: ProductValidator,
    private changeDetector: ChangeDetectionService,
    private priceEngine: PriceEngine,
    private categoryMapper: CategoryMappingService,
    private adapters: Record<Marketplace, BaseAdapter>
  ) {}

  async run(syncJobId: string): Promise<PipelineResult> {
    const startTime = Date.now();
    
    // 1. Update sync_job status to RUNNING
    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const syncJob = await prisma.syncJob.findUnique({
      where: { id: syncJobId },
      include: { source: true },
    });

    if (!syncJob || !syncJob.source) {
      throw new Error(`SyncJob ${syncJobId} or its source not found`);
    }

    try {
      // 2. Fetch XML
      const response = await fetch(syncJob.source.url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Failed to fetch XML: ${response.statusText}`);
      const xml = await response.text();

      // 3. Parse XML
      const products = await this.parser.parse(xml);
      
      // 5. Change Detection
      const detection = await this.changeDetector.detect(products, syncJob.sourceId);
      const toProcess = [...detection.newProducts, ...detection.changedProducts];
      
      // Update lastSeenAt for unchanged
      if (detection.unchangedIds.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: detection.unchangedIds } },
          data: { lastSeenAt: new Date() },
        });
      }

      let publishedCount = 0;
      let failedCount = 0;
      let skippedValidationCount = 0;

      // 6. Process products
      for (const product of toProcess) {
        try {
          // a. Validate
          const validation = await this.validator.validate(product);
          if (!validation.isValid) {
            await prisma.publishError.create({
              data: {
                productId: product.id,
                marketplace: 'ALL',
                errorMessage: validation.errors.join(', '),
                syncJobId,
              },
            });
            skippedValidationCount++;
            continue;
          }

          // b. Upsert Product to DB
          const dbProduct = await prisma.product.upsert({
            where: { 
              sourceId_externalId: {
                sourceId: syncJob.sourceId,
                externalId: product.id
              }
            },
            update: {
              title: product.name,
              price: product.price,
              stock: product.stock,
              categoryRaw: product.categoryRaw || '',
              description: product.description || '',
              images: product.images,
              lastSeenAt: new Date(),
              contentHash: product.contentHash || '',
            },
            create: {
              source: { connect: { id: syncJob.sourceId } },
              externalId: product.id,
              sku: product.id, // Default to externalId if not provided
              barcode: product.id,
              title: product.name,
              price: product.price,
              stock: product.stock,
              categoryRaw: product.categoryRaw || '',
              description: product.description || '',
              images: product.images,
              contentHash: product.contentHash || '',
            },
          });

          // c. Price Calculation
          const prices = await this.priceEngine.calculateBatch(product, dbProduct.id, syncJobId);

          // d. Category Mapping
          const categories = await this.categoryMapper.resolveAll(product);

          // 7. Add to publish queue (batching could be improved)
          const marketplaces: Marketplace[] = ['TRENDYOL', 'HEPSIBURADA', 'N11', 'AMAZON'];
          for (const m of marketplaces) {
            await publishQueue.add('publish-product', {
              productId: dbProduct.id,
              marketplace: m,
              syncJobId,
            });
          }
          publishedCount++;
        } catch (err: any) {
          failedCount++;
          await prisma.publishError.create({
            data: {
              productId: product.id,
              marketplace: 'ALL',
              errorMessage: err.message,
              syncJobId,
            },
          });
        }
      }

      const result: PipelineResult = {
        syncJobId,
        totalFetched: products.length,
        newProducts: detection.newProducts.length,
        changedProducts: detection.changedProducts.length,
        unchanged: detection.unchangedIds.length,
        published: publishedCount,
        failed: failedCount,
        skippedValidation: skippedValidationCount,
        durationMs: Date.now() - startTime,
      };

      // 8. Update sync_job status to DONE
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'DONE',
          finishedAt: new Date(),
          totalProducts: result.totalFetched,
          publishedCount: result.published,
          failedCount: result.failed + result.skippedValidation,
          totalCount: result.totalFetched,
          successCount: result.published,
          failCount: result.failed + result.skippedValidation,
        },
      });

      // 9. Notify if failure rate > 20%
      const totalProcessed = result.published + result.failed + result.skippedValidation;
      if (totalProcessed > 0 && (result.failed + result.skippedValidation) / totalProcessed > 0.2) {
        await notifyQueue.add('high-failure-rate', {
          type: 'slack',
          message: `High failure rate in sync job ${syncJobId}: ${((result.failed + result.skippedValidation) / totalProcessed * 100).toFixed(2)}%`,
          level: 'error',
        });
      }

      return result;
    } catch (err: any) {
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: { status: 'FAILED', errorMessage: err.message, finishedAt: new Date() },
      });
      throw err;
    }
  }
}
