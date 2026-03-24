import { Worker, Job } from 'bullmq';
import { redis } from '../../utils/redis';
import { PublishJobData } from '../jobs';
import { Marketplace, PrismaClient } from '@prisma/client';
import { TrendyolAdapter } from '../../adapters/TrendyolAdapter';
import { HepsiburadaAdapter } from '../../adapters/HepsiburadaAdapter';
import { N11Adapter } from '../../adapters/N11Adapter';
import { AmazonAdapter } from '../../adapters/AmazonAdapter';

const prisma = new PrismaClient();

const adapters = {
  TRENDYOL: new TrendyolAdapter(),
  HEPSIBURADA: new HepsiburadaAdapter(),
  N11: new N11Adapter(),
  AMAZON: new AmazonAdapter(),
};

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const publishWorker = new Worker(
  'publish',
  async (job: Job<PublishJobData>) => {
    const { productId, marketplace, syncJobId } = job.data;
    console.log(`Publishing product ${productId} to ${marketplace}`);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error(`Product ${productId} not found`);

    const adapter = (adapters as any)[marketplace];
    if (!adapter) throw new Error(`Adapter for ${marketplace} not found`);

    try {
      await adapter.publish(product);
      await prisma.publishLog.create({
        data: {
          productId,
          marketplace,
          status: 'SUCCESS',
          syncJobId,
        },
      });
    } catch (err: any) {
      console.error(`Failed to publish product ${productId} to ${marketplace}:`, err);
      await prisma.publishLog.create({
        data: {
          productId,
          marketplace,
          status: 'FAILED',
          error: err.message,
          syncJobId,
        },
      });
      throw err;
    }
  },
  {
    connection,
    concurrency: 4,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

publishWorker.on('failed', (job, err) => {
  console.error(`Publish job ${job?.id} failed with error: ${err.message}`);
});
