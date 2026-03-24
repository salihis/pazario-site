import { Worker, Job } from 'bullmq';
import { redis } from '../../utils/redis';
import { CargoJobData } from '../jobs';
import { CargoService } from '../../services/CargoService';

const cargoService = new CargoService();

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const cargoWorker = new Worker(
  'cargo',
  async (job: Job<CargoJobData>) => {
    const { orderId, action } = job.data;
    console.log(`Processing cargo action ${action} for order ${orderId}`);

    switch (action) {
      case 'create_label':
        await cargoService.createLabel(orderId);
        break;
      case 'notify_marketplace':
        await cargoService.notifyMarketplace(orderId);
        break;
      case 'check_status':
        await cargoService.pollStatus(orderId);
        break;
      default:
        throw new Error(`Unknown cargo action: ${action}`);
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

cargoWorker.on('failed', (job, err) => {
  console.error(`Cargo job ${job?.id} failed with error: ${err.message}`);
});
