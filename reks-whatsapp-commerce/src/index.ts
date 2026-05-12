/**
 * REZ WhatsApp Commerce - Backend API
 * Express server for WhatsApp shopping
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-whatsapp-commerce' });
});

// Products
app.get('/api/products', (req: Request, res: Response) => {
  res.json({
    products: [
      { id: '1', name: 'Premium Room', price: 4999, category: 'hotel' },
      { id: '2', name: 'Restaurant Voucher', price: 999, category: 'food' },
      { id: '3', name: 'Spa Package', price: 2499, category: 'wellness' },
    ]
  });
});

// Cart
app.post('/api/cart', (req: Request, res: Response) => {
  const { userId, productId, quantity } = req.body;
  res.json({ cartId: 'cart_123', items: [{ productId, quantity }], total: 4999 });
});

// Checkout
app.post('/api/checkout/:cartId', (req: Request, res: Response) => {
  const { cartId } = req.params;
  res.json({
    checkoutId: `checkout_${cartId}`,
    paymentUrl: 'https://rzp.io/pay/xyz',
    amount: 4999
  });
});

// Orders
app.get('/api/orders/:userId', (req: Request, res: Response) => {
  res.json({
    orders: [
      { id: '1', status: 'confirmed', total: 4999, date: new Date().toISOString() }
    ]
  });
});

const PORT = process.env.PORT || 4006;
app.listen(PORT, () => console.log(`WhatsApp Commerce running on ${PORT}`));
