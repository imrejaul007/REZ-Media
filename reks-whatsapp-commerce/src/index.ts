/**
 * REZ WhatsApp Commerce - Full Shopping on WhatsApp
 *
 * Features:
 * - Product catalog browsing
 * - Cart management
 * - Order placement
 * - Payment links
 * - Order tracking
 * - Support chatbot
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// ============================================
// MONGODB MODELS
// ============================================

const CartSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  sessionId: String,
  items: [{
    productId: String,
    name: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    image: String,
    variant: String,
  }],
  total: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: String,
  phone: String,
  items: mongoose.Schema.Types.Mixed,
  total: Number,
  status: { type: String, enum: ['pending', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  paymentId: String,
  paymentUrl: String,
  shippingAddress: {
    name: String,
    phone: String,
    address: String,
    city: String,
    pincode: String,
  },
  courier: String,
  trackingId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Cart = mongoose.models.Cart || mongoose.model('Cart', CartSchema);
const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

// ============================================
// WHATSAPP MESSAGE TEMPLATES
// ============================================

const TEMPLATES = {
  welcome: (name: string) =>
    `👋 Welcome to REZ Shopping!\n\nHi ${name}! I'm your shopping assistant.\n\nYou can:\n• Browse products\n• Add to cart\n• Place orders\n• Track deliveries\n\nWhat would you like to do?`,

  product: (p: any) =>
    `🛍️ *${p.name}*\n\n` +
    `💰 Price: ₹${p.price.toLocaleString()}\n` +
    `${p.description || ''}\n\n` +
    `📦 Category: ${p.category}\n` +
    `🆔 SKU: ${p.sku}`,

  cart: (cart: any) => {
    let msg = `🛒 *Your Cart*\n\n`;
    cart.items.forEach((item: any, i: number) => {
      msg += `${i + 1}. ${item.name}\n`;
      msg += `   Qty: ${item.quantity} × ₹${item.price} = ₹${(item.quantity * item.price).toLocaleString()}\n\n`;
    });
    msg += `─────────────────\n`;
    msg += `*Total: ₹${cart.total.toLocaleString()}*\n\n`;
    msg += `Reply with:\n`;
    msg += `• "checkout" - Proceed to payment\n`;
    msg += `• "add [item]" - Add more items\n`;
    msg += `• "remove [item]" - Remove item`;
    return msg;
  },

  orderConfirmed: (order: any) =>
    `✅ *Order Confirmed!*\n\n` +
    `🆔 Order ID: ${order.orderId}\n` +
    `💰 Amount: ₹${order.total.toLocaleString()}\n` +
    `📦 Items: ${order.items.length}\n\n` +
    `Pay here: ${order.paymentUrl}\n\n` +
    `We'll notify you when it's shipped! 🚚`,

  orderShipped: (order: any) =>
    `🚚 *Order Shipped!*\n\n` +
    `🆔 Order ID: ${order.orderId}\n` +
    `📦 Courier: ${order.courier}\n` +
    `🔢 Tracking: ${order.trackingId}\n\n` +
    `Track: https://rez.app/track/${order.orderId}`,

  help: () =>
    `📋 *Available Commands*\n\n` +
    `• "products" - Browse catalog\n` +
    `• "cart" - View cart\n` +
    `• "orders" - My orders\n` +
    `• "help" - Show this\n\n` +
    `Or just tell me what you're looking for!`,
};

// ============================================
// MIDDLEWARE
// ============================================

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-internal-token'];
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (internalToken && token !== internalToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ============================================
// WHATSAPP WEBHOOK
// ============================================

/**
 * POST /webhook - Receive WhatsApp messages
 */
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { from, message, type } = req.body;

    if (!from) {
      res.status(400).json({ error: 'Missing from' });
      return;
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: from });
    if (!cart) {
      cart = await Cart.create({ userId: from, items: [], total: 0 });
    }

    // Process message
    const response = await processMessage(from, message?.text?.toLowerCase() || '', cart, type);

    res.json({ response });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function processMessage(userId: string, text: string, cart: any, type: string): Promise<string> {
  // Handle quick replies / buttons
  if (type === 'button') {
    return handleButtonAction(userId, text);
  }

  // Command handling
  if (text.startsWith('/')) {
    const [cmd, ...args] = text.slice(1).split(' ');
    return handleCommand(userId, cmd, args.join(' '));
  }

  // Natural language
  if (text.includes('browse') || text.includes('products') || text.includes('shop')) {
    return 'Type "products" to browse our catalog!';
  }

  if (text.includes('cart') || text.includes('basket')) {
    return TEMPLATES.cart(cart);
  }

  if (text.includes('order') && text.includes('status')) {
    return 'Send your order ID to check status!';
  }

  if (text.includes('help')) {
    return TEMPLATES.help();
  }

  // Default - suggest browsing
  return `I didn't understand that. Type "help" to see what I can do, or "products" to start shopping!`;
}

async function handleCommand(userId: string, cmd: string, args: string): Promise<string> {
  switch (cmd) {
    case 'products':
    case 'catalog':
      return await getProductsList();

    case 'cart':
      const cart = await Cart.findOne({ userId });
      return cart ? TEMPLATES.cart(cart) : 'Your cart is empty!';

    case 'checkout':
      return await processCheckout(userId);

    case 'orders':
      return await getOrdersList(userId);

    case 'track':
      return await trackOrder(args);

    case 'help':
      return TEMPLATES.help();

    case 'add': {
      const product = await findProduct(args);
      if (!product) return 'Product not found!';
      await addToCart(userId, product);
      return `Added ${product.name} to cart!`;
    }

    default:
      return 'Unknown command. Type "help" for options.';
  }
}

// ============================================
// PRODUCT APIS
// ============================================

/**
 * GET /api/products - List products
 */
app.get('/api/products', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { category, search, limit = 20 } = req.query;

    // In production, fetch from catalog service
    const products = await getMockProducts({ category: category as string, search: search as string, limit: Number(limit) });

    res.json({ products });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/products/:id - Get product
 */
app.get('/api/products/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ product });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CART APIS
// ============================================

/**
 * GET /api/cart/:userId - Get user's cart
 */
app.get('/api/cart/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    res.json({ cart: cart || { items: [], total: 0 } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cart - Add to cart
 */
app.post('/api/cart', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, productId, quantity = 1 } = req.body;

    const product = await getProductById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [], total: 0 });
    }

    // Check if item already in cart
    const existingItem = cart.items.find((i: any) => i.productId === productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        productId,
        name: product.name,
        price: product.price,
        quantity,
        image: product.image,
      });
    }

    cart.total = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();
    await cart.save();

    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/cart/:userId/items/:productId - Remove from cart
 */
app.delete('/api/cart/:userId/items/:productId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, productId } = req.params;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter((i: any) => i.productId !== productId);
    cart.total = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    await cart.save();

    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ORDER APIS
// ============================================

/**
 * POST /api/checkout - Create order
 */
app.post('/api/checkout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, phone, address } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    // Create order
    const orderId = `ORD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const order = await Order.create({
      orderId,
      userId,
      phone,
      items: cart.items,
      total: cart.total,
      status: 'pending',
      shippingAddress: address,
      paymentUrl: `https://rzp.io/pay/${orderId}`,
    });

    // Clear cart
    cart.items = [];
    cart.total = 0;
    await cart.save();

    res.json({
      order,
      message: TEMPLATES.orderConfirmed(order),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orders/:userId - Get user orders
 */
app.get('/api/orders/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ orders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orders/:orderId - Get order by ID
 */
app.get('/api/orders/:orderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/orders/:orderId - Update order (webhook from payment/delivery)
 */
app.patch('/api/orders/:orderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, paymentId, courier, trackingId } = req.body;

    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (status) order.status = status;
    if (paymentId) order.paymentId = paymentId;
    if (courier) order.courier = courier;
    if (trackingId) order.trackingId = trackingId;
    order.updatedAt = new Date();
    await order.save();

    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getProductsList(): Promise<string> {
  const products = await getMockProducts({ limit: 10 });
  let msg = '🛍️ *Our Products*\n\n';
  products.forEach((p: any, i: number) => {
    msg += `${i + 1}. ${p.name}\n`;
    msg += `   ₹${p.price.toLocaleString()}\n\n`;
  });
  msg += 'Reply "add [number]" to add to cart';
  return msg;
}

async function getOrdersList(userId: string): Promise<string> {
  const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(5);
  if (orders.length === 0) {
    return 'No orders yet!';
  }

  let msg = '📦 *Your Orders*\n\n';
  orders.forEach((o: any) => {
    msg += `🆔 ${o.orderId}\n`;
    msg += `💰 ₹${o.total.toLocaleString()} - ${o.status.toUpperCase()}\n`;
    msg += `📅 ${new Date(o.createdAt).toLocaleDateString()}\n\n`;
  });
  return msg;
}

async function trackOrder(orderId: string): Promise<string> {
  const order = await Order.findOne({ orderId });
  if (!order) {
    return 'Order not found!';
  }

  let msg = `📦 *Order ${orderId}*\n`;
  msg += `Status: ${order.status.toUpperCase()}\n`;

  if (order.trackingId) {
    msg += `Tracking: ${order.trackingId}\n`;
    msg += `Courier: ${order.courier}\n`;
  }

  return msg;
}

async function processCheckout(userId: string): Promise<string> {
  const cart = await Cart.findOne({ userId });
  if (!cart || cart.items.length === 0) {
    return 'Your cart is empty!';
  }

  const orderId = `ORD${Date.now()}`;
  const paymentUrl = `https://rzp.io/pay/${orderId}`;

  await Order.create({
    orderId,
    userId,
    items: cart.items,
    total: cart.total,
    status: 'pending',
    paymentUrl,
  });

  cart.items = [];
  cart.total = 0;
  await cart.save();

  return `Checkout ready!\n\nOrder: ${orderId}\nTotal: ₹${cart.total.toLocaleString()}\n\nPay here: ${paymentUrl}`;
}

async function handleButtonAction(userId: string, action: string): Promise<string> {
  switch (action) {
    case 'browse':
      return await getProductsList();
    case 'cart':
      const cart = await Cart.findOne({ userId });
      return cart ? TEMPLATES.cart(cart) : 'Cart is empty!';
    case 'orders':
      return await getOrdersList(userId);
    case 'help':
      return TEMPLATES.help();
    default:
      return TEMPLATES.help();
  }
}

async function addToCart(userId: string, product: any): Promise<void> {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, items: [], total: 0 });
  }

  const existing = cart.items.find((i: any) => i.productId === product._id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.items.push({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
    });
  }

  cart.total = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  await cart.save();
}

async function findProduct(query: string): Promise<any | null> {
  const products = await getMockProducts({ search: query, limit: 1 });
  return products[0] || null;
}

async function getProductById(id: string): Promise<any | null> {
  const products = await getMockProducts({ limit: 100 });
  return products.find((p: any) => p._id === id || p.sku === id) || null;
}

async function getMockProducts(opts: { category?: string; search?: string; limit?: number }): Promise<any[]> {
  const products = [
    { _id: '1', sku: 'ROOM-001', name: 'Premium Room', description: 'Deluxe AC room with breakfast', price: 4999, category: 'hotel', image: 'https://rez.app/room.jpg' },
    { _id: '2', sku: 'ROOM-002', name: 'Suite Room', description: 'Premium suite with lounge', price: 8999, category: 'hotel', image: 'https://rez.app/suite.jpg' },
    { _id: '3', sku: 'FOOD-001', name: 'Restaurant Voucher', description: '₹1000 food credit', price: 999, category: 'food', image: 'https://rez.app/voucher.jpg' },
    { _id: '4', sku: 'SPA-001', name: 'Spa Package', description: '60-min full body massage', price: 2499, category: 'wellness', image: 'https://rez.app/spa.jpg' },
    { _id: '5', sku: 'TOUR-001', name: 'City Tour', description: 'Half-day guided tour', price: 1499, category: 'tour', image: 'https://rez.app/tour.jpg' },
    { _id: '6', sku: 'FIT-001', name: 'Gym Pass', description: '1-week gym access', price: 799, category: 'fitness', image: 'https://rez.app/gym.jpg' },
    { _id: '7', sku: 'BOOK-001', name: 'Consulting Session', description: '30-min expert consultation', price: 1999, category: 'consulting', image: 'https://rez.app/consult.jpg' },
    { _id: '8', sku: 'PROD-001', name: 'Wellness Box', description: 'Health supplements kit', price: 1499, category: 'product', image: 'https://rez.app/box.jpg' },
  ];

  let filtered = products;

  if (opts.category) {
    filtered = filtered.filter(p => p.category === opts.category);
  }

  if (opts.search) {
    const q = opts.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }

  return filtered.slice(0, opts.limit || 20);
}

// ============================================
// HEALTH & INFO
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-whatsapp-commerce',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ WhatsApp Commerce',
    version: '2.0.0',
    description: 'Full shopping on WhatsApp',
    endpoints: {
      webhook: 'POST /webhook',
      products: 'GET /api/products',
      cart: 'POST /api/cart',
      checkout: 'POST /api/checkout',
      orders: 'GET /api/orders/:userId',
    },
  });
});

// ============================================
// START
// ============================================

const PORT = process.env.PORT || 4043;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-commerce';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 WhatsApp Commerce running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  });
