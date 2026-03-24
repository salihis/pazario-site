import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const syncQueue = new Queue('sync', { connection });
export const publishQueue = new Queue('publish', { connection });
export const cargoQueue = new Queue('cargo', { connection });
export const orderFetchQueue = new Queue('order-fetch', { connection });
export const notifyQueue = new Queue('notify', { connection });
