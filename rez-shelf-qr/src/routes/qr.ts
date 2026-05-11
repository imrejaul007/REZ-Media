import { Router, Request, Response, NextFunction } from 'express';
import {
  generateProductQR,
  generateShelfQR,
  generateCheckoutQR,
  generateLoyaltyQR,
  getQRCodesByMerchant,
  deactivateQR,
  getScanStats,
  getQRByShortUrl,
} from '../services/qrService';

const router = Router();

// Validation middleware
const validateMerchantId = (req: Request, res: Response, next: NextFunction): void => {
  const { merchantId } = req.body;
  if (!merchantId) {
    res.status(400).json({ error: 'merchantId is required' });
    return;
  }
  next();
};

const validateStoreId = (req: Request, res: Response, next: NextFunction): void => {
  const { storeId } = req.body;
  if (!storeId) {
    res.status(400).json({ error: 'storeId is required' });
    return;
  }
  next();
};

// Generate Product QR Code
// POST /api/qr/product
router.post('/product', validateMerchantId, validateStoreId, async (req: Request, res: Response) => {
  try {
    const { merchantId, storeId, productId, productName, category } = req.body;

    if (!productId) {
      res.status(400).json({ error: 'productId is required' });
      return;
    }

    const qrCode = await generateProductQR(merchantId, storeId, productId, {
      productName,
      category,
    });

    res.status(201).json({
      success: true,
      data: qrCode,
    });
  } catch (error) {
    console.error('Error generating product QR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate product QR code',
    });
  }
});

// Generate Shelf QR Code
// POST /api/qr/shelf
router.post('/shelf', validateMerchantId, validateStoreId, async (req: Request, res: Response) => {
  try {
    const { merchantId, storeId, shelfId, shelfName, shelfLocation, category } = req.body;

    if (!shelfId) {
      res.status(400).json({ error: 'shelfId is required' });
      return;
    }

    const qrCode = await generateShelfQR(merchantId, storeId, shelfId, {
      shelfName,
      shelfLocation,
      category,
    });

    res.status(201).json({
      success: true,
      data: qrCode,
    });
  } catch (error) {
    console.error('Error generating shelf QR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate shelf QR code',
    });
  }
});

// Generate Checkout QR Code
// POST /api/qr/checkout
router.post('/checkout', validateMerchantId, async (req: Request, res: Response) => {
  try {
    const { merchantId, storeId, cartId, shelfName } = req.body;

    const qrCode = await generateCheckoutQR(merchantId, storeId, cartId, { shelfName });

    res.status(201).json({
      success: true,
      data: qrCode,
    });
  } catch (error) {
    console.error('Error generating checkout QR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate checkout QR code',
    });
  }
});

// Generate Loyalty QR Code
// POST /api/qr/loyalty
router.post('/loyalty', async (req: Request, res: Response) => {
  try {
    const { merchantId, customerId, storeId } = req.body;

    if (!merchantId || !customerId) {
      res.status(400).json({ error: 'merchantId and customerId are required' });
      return;
    }

    const qrCode = await generateLoyaltyQR(merchantId, customerId, storeId);

    res.status(201).json({
      success: true,
      data: qrCode,
    });
  } catch (error) {
    console.error('Error generating loyalty QR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate loyalty QR code',
    });
  }
});

// Get QR codes for a merchant
// GET /api/qr/merchant/:merchantId
router.get('/merchant/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { qrType, storeId, isActive } = req.query;

    const qrCodes = await getQRCodesByMerchant(merchantId, {
      qrType: qrType as string | undefined,
      storeId: storeId as string | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    res.json({
      success: true,
      data: qrCodes,
      count: qrCodes.length,
    });
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch QR codes',
    });
  }
});

// Get QR code by short URL
// GET /api/qr/:shortUrl
router.get('/:shortUrl(*)', async (req: Request, res: Response) => {
  try {
    const { shortUrl } = req.params;

    const qrCode = await getQRByShortUrl(`https://${shortUrl}`);

    if (!qrCode) {
      res.status(404).json({
        success: false,
        error: 'QR code not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        qrType: qrCode.qrType,
        targetId: qrCode.targetId,
        merchantId: qrCode.merchantId,
        storeId: qrCode.storeId,
        isActive: qrCode.isActive,
        metadata: qrCode.metadata,
      },
    });
  } catch (error) {
    console.error('Error fetching QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch QR code',
    });
  }
});

// Deactivate QR code
// DELETE /api/qr/:shortUrl
router.delete('/:shortUrl(*)', async (req: Request, res: Response) => {
  try {
    const { shortUrl } = req.params;
    const url = shortUrl.startsWith('https://') ? shortUrl : `https://${shortUrl}`;

    const deactivated = await deactivateQR(url);

    if (!deactivated) {
      res.status(404).json({
        success: false,
        error: 'QR code not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'QR code deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate QR code',
    });
  }
});

// Get scan statistics
// GET /api/qr/stats/:merchantId
router.get('/stats/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate } = req.query;

    const stats = await getScanStats(
      merchantId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching scan stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scan statistics',
    });
  }
});

export default router;
