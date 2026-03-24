import { Request, Response } from 'express';
import prisma from '../../../services/Database.js';
import { OrderStateMachine, TransitionOptions } from '../../services/OrderStateMachine.js';
import { OrderFetchService } from '../../services/OrderFetchService.js';
import { decrypt } from '../../lib/encryption.js';
import { OrderStatus, Marketplace, CargoCompany } from '@prisma/client';

export class OrderController {
  public static async getOrders(req: Request, res: Response) {
    const { status, marketplace, startDate, endDate, page = '1', limit = '25', search } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status as OrderStatus;
    if (marketplace) where.marketplace = marketplace as Marketplace;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }
    if (search) {
      where.OR = [
        { marketplaceOrderId: { contains: search as string } },
        { marketplaceOrderNo: { contains: search as string } },
      ];
    }

    try {
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip: (p - 1) * l,
          take: l,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        }),
        prisma.order.count({ where }),
      ]);

      // Decrypt customer info
      const decryptedOrders = orders.map(order => this.decryptOrder(order));

      res.json({
        data: decryptedOrders,
        meta: {
          total,
          page: p,
          limit: l,
          pages: Math.ceil(total / l),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async getOrder(req: Request, res: Response) {
    const { orderId } = req.params;
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          history: { orderBy: { createdAt: 'desc' } },
          invoice: true,
          shipment: true,
        },
      });

      if (!order) return res.status(404).json({ error: 'Order not found' });

      res.json(this.decryptOrder(order));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async approveOrder(req: any, res: Response) {
    const { orderId } = req.params;
    try {
      const stateMachine = new OrderStateMachine();
      // NEW → PENDING_APPROVAL → PREPARING
      await stateMachine.transition(orderId, OrderStatus.PENDING_APPROVAL);

      await stateMachine.transition(orderId, OrderStatus.PREPARING);

      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      res.json(this.decryptOrder(updated));
    } catch (error: any) {
      res.status(409).json({ error: error.message });
    }
  }

  public static async cancelOrder(req: any, res: Response) {
    const { orderId } = req.params;
    const { reason } = req.body;
    try {
      const stateMachine = new OrderStateMachine();
      await stateMachine.transition(orderId, OrderStatus.CANCELLED);
      
      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      res.json(this.decryptOrder(updated));
    } catch (error: any) {
      res.status(409).json({ error: error.message });
    }
  }

  public static async markShipped(req: any, res: Response) {
    const { orderId } = req.params;
    const { trackingNumber, cargoCompany } = req.body;
    try {
      // 1. Check if label created
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order?.status !== OrderStatus.LABEL_CREATED) {
        return res.status(400).json({ error: 'Kargo etiketi oluşturulmadan sevk edilemez.' });
      }

      const stateMachine = new OrderStateMachine();
      await stateMachine.transition(orderId, OrderStatus.SHIPPED);

      // Update tracking info
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { trackingNumber, cargoCompany },
        include: { items: true },
      });

      res.json(this.decryptOrder(updated));
    } catch (error: any) {
      res.status(409).json({ error: error.message });
    }
  }

  public static async approveReturn(req: any, res: Response) {
    const { orderId } = req.params;
    try {
      const stateMachine = new OrderStateMachine();
      await stateMachine.transition(orderId, OrderStatus.RETURN_APPROVED);
      
      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      res.json(this.decryptOrder(updated));
    } catch (error: any) {
      res.status(409).json({ error: error.message });
    }
  }

  public static async rejectReturn(req: any, res: Response) {
    const { orderId } = req.params;
    const { reason } = req.body;
    try {
      const stateMachine = new OrderStateMachine();
      await stateMachine.transition(orderId, OrderStatus.COMPLETED);
      
      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      res.json(this.decryptOrder(updated));
    } catch (error: any) {
      res.status(409).json({ error: error.message });
    }
  }

  public static async markReturned(req: any, res: Response) {
    const { orderId } = req.params;
    const { condition } = req.body;
    try {
      const stateMachine = new OrderStateMachine();
      await stateMachine.transition(orderId, OrderStatus.REFUNDED);
      
      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      res.json(this.decryptOrder(updated));
    } catch (error: any) {
      res.status(409).json({ error: error.message });
    }
  }

  public static async fetchOrders(req: Request, res: Response) {
    try {
      // Async trigger
      const fetchService = new OrderFetchService();
      fetchService.fetchAll().catch(err => console.error('Background fetch error:', err));
      res.status(202).json({ message: 'Sipariş çekme işlemi başlatıldı.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async getStats(req: Request, res: Response) {
    try {
      const [byStatus, byMarketplace, todayNew, pendingApproval, pendingReturn] = await Promise.all([
        prisma.order.groupBy({ by: ['status'], _count: true }),
        prisma.order.groupBy({ by: ['marketplace'], _count: true }),
        prisma.order.count({ where: { status: OrderStatus.NEW, createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
        prisma.order.count({ where: { status: OrderStatus.PENDING_APPROVAL } }),
        prisma.order.count({ where: { status: OrderStatus.RETURN_REQUESTED } }),
      ]);

      res.json({
        byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
        byMarketplace: Object.fromEntries(byMarketplace.map(m => [m.marketplace, m._count])),
        todayNew,
        pendingApproval,
        pendingReturn,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  private static decryptOrder(order: any) {
    try {
      return {
        ...order,
        customerName: order.customerName ? decrypt(order.customerName) : null,
        customerPhone: order.customerPhone ? decrypt(order.customerPhone) : null,
        shippingAddress: order.shippingAddress ? JSON.parse(decrypt(order.shippingAddress as string)) : null,
        billingAddress: order.billingAddress ? JSON.parse(decrypt(order.billingAddress as string)) : null,
      };
    } catch (error) {
      console.error('Decryption failed for order:', order.id, error);
      return order; // Return as is if decryption fails (might be unencrypted in some cases or wrong key)
    }
  }
}
