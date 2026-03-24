import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Sipariş status geçiş validasyonu middleware
prisma.$use(async (params, next) => {
  if (params.model === 'Order' && params.action === 'update') {
    const { where, data } = params.args;
    const newStatus = data.status as OrderStatus;

    if (newStatus) {
      // Mevcut siparişi bul
      const currentOrder = await prisma.order.findUnique({
        where: where,
        select: { status: true }
      });

      if (currentOrder) {
        const currentStatus = currentOrder.status;

        // Geçersiz geçiş kontrolü: NEW -> SHIPPED doğrudan geçiş yasak
        if (currentStatus === OrderStatus.NEW && newStatus === OrderStatus.SHIPPED) {
          throw new Error('Geçersiz sipariş durumu geçişi: NEW durumundan doğrudan SHIPPED durumuna geçilemez. Önce hazırlık aşamasına geçilmelidir.');
        }

        // Diğer geçiş kuralları buraya eklenebilir
      }
    }
  }
  return next(params);
});

export default prisma;
