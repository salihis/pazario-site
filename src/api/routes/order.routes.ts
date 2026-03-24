import { Router } from 'express';
import { OrderController } from '../controllers/order.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

// Public (Auth required)
router.get('/orders', OrderController.getOrders);
router.get('/orders/stats', OrderController.getStats);
router.get('/orders/:orderId', OrderController.getOrder);
router.post('/orders/fetch', OrderController.fetchOrders);

// Admin-only
router.post('/orders/:orderId/approve', requireRole('ADMIN'), OrderController.approveOrder);
router.post('/orders/:orderId/cancel', requireRole('ADMIN'), OrderController.cancelOrder);
router.post('/orders/:orderId/mark-shipped', requireRole('ADMIN'), OrderController.markShipped);
router.post('/orders/:orderId/approve-return', requireRole('ADMIN'), OrderController.approveReturn);
router.post('/orders/:orderId/reject-return', requireRole('ADMIN'), OrderController.rejectReturn);
router.post('/orders/:orderId/mark-returned', requireRole('ADMIN'), OrderController.markReturned);

export default router;
