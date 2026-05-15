/**
 * REZ Referral Graph - Network Analysis
 * Graph-based referral tracking and analysis
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = parseInt(process.env.PORT || '4070', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/referral-graph';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
});
app.use('/api/', limiter);

// Referral Node Schema
const referralNodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, unique: true },
  referrerId: String,
  referralDepth: { type: Number, default: 0 },
  totalReferrals: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  network: {
    directReferrals: [{ type: String }],
    indirectReferrals: [{ type: String }],
  },
  createdAt: { type: Date, default: Date.now },
});

const ReferralNode = mongoose.model('ReferralNode', referralNodeSchema);

// Referral Edge Schema
const referralEdgeSchema = new mongoose.Schema({
  edgeId: { type: String, required: true, unique: true },
  fromNodeId: { type: String, required: true },
  toNodeId: { type: String, required: true },
  type: { type: String, enum: ['referral', 'commission'], default: 'referral' },
  value: Number,
  createdAt: { type: Date, default: Date.now },
});

const ReferralEdge = mongoose.model('ReferralEdge', referralEdgeSchema);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-referral-graph' });
});

// Add referral node (user joins)
app.post('/api/nodes', async (req, res) => {
  try {
    const { userId, referrerId } = req.body;

    let referralDepth = 0;
    if (referrerId) {
      const referrer = await ReferralNode.findOne({ userId: referrerId });
      if (referrer) {
        referralDepth = referrer.referralDepth + 1;

        // Update referrer stats
        await ReferralNode.findOneAndUpdate(
          { userId: referrerId },
          { $inc: { totalReferrals: 1 } }
        );
      }
    }

    const nodeId = `node-${uuidv4().slice(0, 8)}`;
    const node = new ReferralNode({
      nodeId,
      userId,
      referrerId,
      referralDepth,
    });

    await node.save();

    // Create edge if referred
    if (referrerId) {
      const referrerNode = await ReferralNode.findOne({ userId: referrerId });
      if (referrerNode) {
        await ReferralEdge.create({
          edgeId: `edge-${uuidv4().slice(0, 8)}`,
          fromNodeId: referrerNode.nodeId,
          toNodeId: nodeId,
          type: 'referral',
        });
      }
    }

    res.status(201).json({ success: true, data: node });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get node by userId
app.get('/api/nodes/:userId', async (req, res) => {
  try {
    const node = await ReferralNode.findOne({ userId: req.params.userId });
    if (!node) {
      res.status(404).json({ success: false, error: 'Node not found' });
      return;
    }
    res.json({ success: true, data: node });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Get referral network
app.get('/api/nodes/:userId/network', async (req, res) => {
  try {
    const node = await ReferralNode.findOne({ userId: req.params.userId });
    if (!node) {
      res.status(404).json({ success: false, error: 'Node not found' });
      return;
    }

    // Get all descendants
    const descendants = await ReferralNode.find({ referrerId: req.params.userId });
    const descendantIds = descendants.map((d) => d.userId);

    res.json({
      success: true,
      data: {
        node,
        directReferrals: descendants.length,
        totalNetwork: descendantIds.length + 1,
        referralTree: descendants,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Get network stats
app.get('/api/stats/network', async (req, res) => {
  try {
    const totalNodes = await ReferralNode.countDocuments();
    const avgDepth = await ReferralNode.aggregate([
      { $group: { _id: null, avgDepth: { $avg: '$referralDepth' } } },
    ]);
    const topReferrers = await ReferralNode.find()
      .sort({ totalReferrals: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        totalNodes,
        avgDepth: avgDepth[0]?.avgDepth || 0,
        topReferrers,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[${new Date().toISOString()}] Connected to MongoDB`);

    app.listen(PORT, () => {
      console.log(`[${new Date().toISOString()}] Referral Graph running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

start();

export default app;
