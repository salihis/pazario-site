import { Marketplace } from '@prisma/client';

export type SyncJobData = {
  sourceId: string;
  triggeredBy: 'cron' | 'manual';
  userId?: string;
};

export type PublishJobData = {
  productId: string;
  marketplace: Marketplace;
  syncJobId: string;
};

export type CargoJobData = {
  orderId: string;
  action: 'create_label' | 'notify_marketplace' | 'check_status';
};

export type OrderFetchJobData = {
  marketplace: Marketplace | 'all';
};

export type NotifyJobData = {
  type: 'slack' | 'email';
  message: string;
  level: 'info' | 'warn' | 'error';
};
