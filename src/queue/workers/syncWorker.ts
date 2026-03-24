import { Worker, Job } from 'bullmq';
import { redis } from '../../utils/redis';
import { MarketplacePipeline } from '../../MarketplacePipeline';
import { XMLParser } from '../../services/XMLParser';
import { ProductValidator } from '../../services/ProductValidator';
import { ChangeDetectionService } from '../../services/ChangeDetectionService';
import { PriceEngine } from '../../services/PriceEngine';
import { CategoryMappingService } from '../../services/CategoryMappingService';
import { SyncJobData } from '../jobs';

import { TrendyolAdapter } from '../../adapters/TrendyolAdapter';
import { HepsiburadaAdapter } from '../../adapters/HepsiburadaAdapter';
import { N11Adapter } from '../../adapters/N11Adapter';
import { AmazonAdapter } from '../../adapters/AmazonAdapter';

const parser = new XMLParser();
const validator = new ProductValidator();
const changeDetector = new ChangeDetectionService();
const priceEngine = new PriceEngine();
const categoryMapper = new CategoryMappingService();

const pipeline = new MarketplacePipeline(
  parser,
  validator,
  changeDetector,
  priceEngine,
  categoryMapper,
  {
    TRENDYOL: new TrendyolAdapter(),
    HEPSIBURADA: new HepsiburadaAdapter(),
    N11: new N11Adapter(),
    AMAZON: new AmazonAdapter(),
    PAZARAMA: {} as any // Placeholder
  }
);

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const syncWorker = new Worker(
  'sync',
  async (job: Job<SyncJobData>) => {
    console.log(`Processing sync job ${job.id} for source ${job.data.sourceId}`);
    try {
      await pipeline.run(job.id!);
    } catch (err) {
      console.error(`Sync job ${job.id} failed:`, err);
      throw err;
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

syncWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error: ${err.message}`);
});
