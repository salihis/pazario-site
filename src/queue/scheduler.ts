import { Cron } from 'croner';
import { syncQueue, orderFetchQueue, cargoQueue } from './queues';

// Gece 03:00–05:00 arası sync penceresi
// Scheduled sync at 03:00
new Cron('0 3 * * *', async () => {
  console.log('Triggering scheduled sync at 03:00');
  await syncQueue.add('scheduled-sync', { triggeredBy: 'cron', sourceId: 'all' });
});

// Her 5dk order fetch
new Cron('*/5 * * * *', async () => {
  console.log('Triggering order fetch every 5 minutes');
  await orderFetchQueue.add('fetch-all', { marketplace: 'all' });
});

// Her 2 saat kargo durum kontrolü
new Cron('0 */2 * * *', async () => {
  console.log('Triggering cargo status check every 2 hours');
  await cargoQueue.add('check-all-status', { action: 'check_status', orderId: 'all' });
});
