import { Router, Request, Response, NextFunction } from 'express';
import { trackScan, getQRByShortUrl } from '../services/qrService';
import { getProductPage } from '../services/productPageService';

const router = Router();

interface ScanRequest extends Request {
  scanContext?: {
    userAgent?: string;
    ip?: string;
    referer?: string;
    timestamp: Date;
  };
}

// Middleware to extract scan context
const extractScanContext = (req: ScanRequest, res: Response, next: NextFunction): void => {
  req.scanContext = {
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.socket.remoteAddress,
    referer: req.get('Referer'),
    timestamp: new Date(),
  };
  next();
};

// Track QR code scan
// POST /api/scan
router.post('/', extractScanContext, async (req: ScanRequest, res: Response) => {
  try {
    const { shortUrl } = req.body;

    if (!shortUrl) {
      res.status(400).json({
        success: false,
        error: 'shortUrl is required',
      });
      return;
    }

    const scanContext = req.scanContext;

    const qrCode = await trackScan(shortUrl, {
      userAgent: scanContext?.userAgent,
      ip: scanContext?.ip,
    });

    if (!qrCode) {
      res.status(404).json({
        success: false,
        error: 'QR code not found or inactive',
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
      scanInfo: {
        timestamp: scanContext?.timestamp,
        userAgent: scanContext?.userAgent,
      },
    });
  } catch (error) {
    console.error('Error tracking scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track scan',
    });
  }
});

// Resolve QR code and redirect
// GET /api/scan/resolve/:shortUrl
router.get('/resolve/:shortUrl(*)', extractScanContext, async (req: ScanRequest, res: Response) => {
  try {
    const { shortUrl } = req.params;
    const url = shortUrl.startsWith('https://') ? shortUrl : `https://${shortUrl}`;

    // Track the scan
    const qrCode = await trackScan(url, {
      userAgent: req.scanContext?.userAgent,
      ip: req.scanContext?.ip,
    });

    if (!qrCode) {
      res.status(404).json({
        success: false,
        error: 'QR code not found or inactive',
      });
      return;
    }

    // Determine redirect based on QR type
    let redirectUrl: string;
    let responseData: Record<string, unknown> = {
      qrType: qrCode.qrType,
      targetId: qrCode.targetId,
    };

    switch (qrCode.qrType) {
      case 'product':
        // Get product details
        const product = await getProductPage(qrCode.targetId);
        if (product) {
          redirectUrl = product.buyUrl;
          responseData = {
            ...responseData,
            product: {
              name: product.displayName,
              price: product.displayPrice,
              image: product.displayImage,
              available: product.available,
              buyUrl: product.buyUrl,
              addToCartUrl: product.addToCartUrl,
            },
          };
        } else {
          // Fallback to generic redirect
          redirectUrl = `${process.env.PRODUCT_API_URL || 'https://api.rez.app'}/products/${qrCode.targetId}`;
        }
        break;

      case 'shelf':
        // Redirect to shelf page with all products
        redirectUrl = `${process.env.QR_BASE_URL || 'https://qr.rez.app'}/shelf/${qrCode.targetId}`;
        responseData = {
          ...responseData,
          shelfName: qrCode.metadata?.shelfName,
          shelfLocation: qrCode.metadata?.shelfLocation,
        };
        break;

      case 'checkout':
        // Redirect to checkout with cart ID
        redirectUrl = `${process.env.QR_BASE_URL || 'https://qr.rez.app'}/checkout/${qrCode.targetId}`;
        break;

      case 'loyalty':
        // Redirect to loyalty program page
        redirectUrl = `${process.env.QR_BASE_URL || 'https://qr.rez.app'}/loyalty/${qrCode.targetId}`;
        break;

      default:
        redirectUrl = process.env.QR_BASE_URL || 'https://qr.rez.app';
    }

    // Return redirect information (client decides whether to redirect)
    res.json({
      success: true,
      redirect: {
        url: redirectUrl,
        type: 'direct', // or 'iframe', 'webview', etc.
      },
      data: responseData,
    });
  } catch (error) {
    console.error('Error resolving scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve scan',
    });
  }
});

// Get scan details
// GET /api/scan/:shortUrl
router.get('/:shortUrl(*)', async (req: Request, res: Response) => {
  try {
    const { shortUrl } = req.params;
    const url = shortUrl.startsWith('https://') ? shortUrl : `https://${shortUrl}`;

    const qrCode = await getQRByShortUrl(url);

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
        shortUrl: qrCode.shortUrl,
        qrType: qrCode.qrType,
        targetId: qrCode.targetId,
        merchantId: qrCode.merchantId,
        storeId: qrCode.storeId,
        scans: qrCode.scans,
        lastScanned: qrCode.lastScanned,
        isActive: qrCode.isActive,
        metadata: qrCode.metadata,
        createdAt: qrCode.createdAt,
        updatedAt: qrCode.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching scan details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scan details',
    });
  }
});

export default router;
