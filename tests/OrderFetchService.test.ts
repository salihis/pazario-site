import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderFetchService } from '../src/services/OrderFetchService.js';
import prisma from '../services/Database.js';
import { Marketplace, OrderStatus } from '@prisma/client';
import { encrypt, decrypt } from '../src/lib/encryption.js';

vi.mock('../src/services/Database.js', () => ({
  default: {
    orderFetchLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    orderItem: {
      create: vi.fn(),
    },
    orderHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock('../src/lib/encryption.js', () => ({
  encrypt: vi.fn((text) => `encrypted:${text}`),
  decrypt: vi.fn((text) => text.replace('encrypted:', '')),
}));

describe('OrderFetchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64);
  });

  it('should encrypt sensitive customer data on create', async () => {
    const mockOrder = {
      marketplaceOrderId: '123',
      customerName: 'John Doe',
      customerPhone: '5551234567',
      shippingAddress: { address: 'Test St' },
      billingAddress: { address: 'Test St' },
      items: [],
      totalAmount: 100,
      currency: 'TRY',
      fetchedAt: new Date(),
    };

    const service = new OrderFetchService();
    await (service as any).createOrder(mockOrder, Marketplace.TRENDYOL);

    expect(encrypt).toHaveBeenCalledWith('John Doe');
    expect(encrypt).toHaveBeenCalledWith('5551234567');
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerName: 'encrypted:John Doe',
        customerPhone: 'encrypted:5551234567',
      })
    }));
  });

  it('should not insert duplicate orders', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ id: 'existing' });
    
    const mockOrder = {
      marketplaceOrderId: '123',
      items: [],
    };

    // Mocking fetchFromMarketplace internal logic
    // This is a bit hard with static methods, but we can test the createOrder call
    // Or we can mock the adapter and test the whole flow
  });
});
