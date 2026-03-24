import { OrderStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TransitionOptions {
  changedBy?: string;
  note?: string;
}

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export class OrderStateMachine {
  private static VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.NEW]: [OrderStatus.PENDING_APPROVAL, OrderStatus.CANCELLED],
    [OrderStatus.PENDING_APPROVAL]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.LABEL_CREATED, OrderStatus.CANCELLED],
    [OrderStatus.LABEL_CREATED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.IN_TRANSIT, OrderStatus.DELIVERY_FAILED],
    [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.DELIVERY_FAILED],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.RETURN_REQUESTED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.CANCELLATION_REQUESTED]: [OrderStatus.CANCELLED, OrderStatus.PREPARING],
    [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURN_APPROVED, OrderStatus.RETURN_REJECTED],
    [OrderStatus.RETURN_APPROVED]: [OrderStatus.RETURNED],
    [OrderStatus.RETURN_REJECTED]: [],
    [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
    [OrderStatus.REFUNDED]: [],
    [OrderStatus.DELIVERY_FAILED]: [OrderStatus.RETURNED],
  };

  async transition(orderId: string, nextStatus: OrderStatus): Promise<any> {
    // Fix: Race condition for concurrent approvals
    // Use a transaction with a check on the current status
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });

      if (!order) throw new Error(`Order ${orderId} not found`);

      const validNext = OrderStateMachine.VALID_TRANSITIONS[order.status];
      if (!validNext.includes(nextStatus)) {
        throw new Error(`Invalid transition from ${order.status} to ${nextStatus}`);
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });

      await tx.orderHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: nextStatus,
        },
      });

      return updated;
    });
  }
}
