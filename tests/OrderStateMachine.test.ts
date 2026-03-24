import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderStateMachine, InvalidTransitionError, InsufficientStockError } from '../src/services/OrderStateMachine.js';
import prisma from '../services/Database.js';
import { OrderStatus } from '@prisma/client';

vi.mock('../src/services/Database.js', () => ({
  default: {
    $queryRaw: vi.fn(),
    order: {
      update: vi.fn(),
    },
    orderHistory: {
      create: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

describe('OrderStateMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow valid transition NEW -> PENDING_APPROVAL', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ id: '1', status: OrderStatus.NEW }]);
    (prisma.order.update as any).mockResolvedValue({ id: '1', status: OrderStatus.PENDING_APPROVAL, items: [] });

    const stateMachine = new OrderStateMachine();
    const result = await stateMachine.transition('1', OrderStatus.PENDING_APPROVAL);
    expect(result.status).toBe(OrderStatus.PENDING_APPROVAL);
    expect(prisma.orderHistory.create).toHaveBeenCalled();
  });

  it('should throw error on invalid transition NEW -> SHIPPED', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ id: '1', status: OrderStatus.NEW }]);

    const stateMachine = new OrderStateMachine();
    await expect(stateMachine.transition('1', OrderStatus.SHIPPED))
      .rejects.toThrow(InvalidTransitionError);
  });

  it('should decrease stock on PREPARING status', async () => {
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([{ id: '1', status: OrderStatus.PENDING_APPROVAL }]) // Order
      .mockResolvedValueOnce([{ stock: 10 }]); // Product stock

    (prisma.order.update as any).mockResolvedValue({
      id: '1',
      status: OrderStatus.PREPARING,
      items: [{ productId: 'p1', quantity: 2 }],
    });

    const stateMachine = new OrderStateMachine();
    await stateMachine.transition('1', OrderStatus.PREPARING);

    expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'p1' },
      data: { stock: 8 }
    }));
  });

  it('should throw error if stock is insufficient', async () => {
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([{ id: '1', status: OrderStatus.PENDING_APPROVAL }]) // Order
      .mockResolvedValueOnce([{ stock: 1 }]); // Product stock (only 1)

    (prisma.order.update as any).mockResolvedValue({
      id: '1',
      status: OrderStatus.PREPARING,
      items: [{ productId: 'p1', quantity: 2 }], // Need 2
    });

    const stateMachine = new OrderStateMachine();
    await expect(stateMachine.transition('1', OrderStatus.PREPARING))
      .rejects.toThrow(InsufficientStockError);
  });
});
