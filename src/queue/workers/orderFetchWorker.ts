import { Worker, Job } from 'bullmq';
import { redis } from '../../utils/redis';
import { OrderFetchJobData } from '../jobs';
import { OrderFetchService } from '../../services/OrderFetchService';

const orderFetchService = new OrderFetchService();

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const orderFetchWorker = new Worker(
  'order-fetch',
  async (job: Job<OrderFetchJobData>) => {
    const { marketplace } = job.data;
    console.log(`Fetching orders for ${marketplace}`);

    if (marketplace === 'all') {
      await orderFetchService.fetchAll();
    } else {
      await orderFetchService.fetchFrom(marketplace);
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

orderFetchWorker.on('failed', (job, err) => {
  console.error(`Order fetch job ${job?.id} failed with error: ${err.message}`);
});
