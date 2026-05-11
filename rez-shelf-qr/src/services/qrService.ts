import QRCode from 'qrcode';
import { ShelfQR, IShelfQR } from '../models/ShelfQR';

const QR_BASE_URL = process.env.QR_BASE_URL || 'https://qr.rez.app';
const QR_SHORT_DOMAIN = process.env.QR_SHORT_DOMAIN || 'rez.app';

interface GenerateQROptions {
  merchantId: string;
  storeId: string;
  targetId: string;
  qrType: 'product' | 'shelf' | 'checkout' | 'loyalty';
  metadata?: {
    shelfName?: string;
    shelfLocation?: string;
    productName?: string;
    category?: string;
  };
}

interface QRRcord {
  _id: string;
  merchantId: string;
  storeId: string;
  qrType: 'product' | 'shelf' | 'checkout' | 'loyalty';
  targetId: string;
  shortUrl: string;
  qrCode: string;
  scans: number;
  lastScanned: Date | null;
  isActive: boolean;
}

/**
 * Generate a unique short URL for the QR code
 */
async function generateShortUrl(qrType: string, targetId: string): Promise<string> {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  const typePrefix = qrType.charAt(0).toUpperCase();
  return `https://${QR_SHORT_DOMAIN}/${typePrefix}${timestamp}${random}`;
}

/**
 * Generate a QR code image as base64 data URL
 */
async function generateQRImage(data: string): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    return qrDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code image');
  }
}

/**
 * Generate a product QR code
 */
export async function generateProductQR(
  merchantId: string,
  storeId: string,
  productId: string,
  metadata?: { productName?: string; category?: string }
): Promise<QRRcord> {
  const shortUrl = await generateShortUrl('product', productId);
  const qrCode = await generateQRImage(shortUrl);

  const shelfQR = new ShelfQR({
    merchantId,
    storeId,
    qrType: 'product',
    targetId: productId,
    qrCode,
    shortUrl,
    scans: 0,
    lastScanned: null,
    isActive: true,
    metadata,
  });

  await shelfQR.save();

  return {
    _id: shelfQR._id.toString(),
    merchantId: shelfQR.merchantId,
    storeId: shelfQR.storeId,
    qrType: shelfQR.qrType,
    targetId: shelfQR.targetId,
    shortUrl: shelfQR.shortUrl,
    qrCode: shelfQR.qrCode,
    scans: shelfQR.scans,
    lastScanned: shelfQR.lastScanned,
    isActive: shelfQR.isActive,
  };
}

/**
 * Generate a shelf QR code
 */
export async function generateShelfQR(
  merchantId: string,
  storeId: string,
  shelfId: string,
  metadata?: { shelfName?: string; shelfLocation?: string; category?: string }
): Promise<QRRcord> {
  const shortUrl = await generateShortUrl('shelf', shelfId);
  const qrCode = await generateQRImage(shortUrl);

  const shelfQR = new ShelfQR({
    merchantId,
    storeId,
    qrType: 'shelf',
    targetId: shelfId,
    qrCode,
    shortUrl,
    scans: 0,
    lastScanned: null,
    isActive: true,
    metadata,
  });

  await shelfQR.save();

  return {
    _id: shelfQR._id.toString(),
    merchantId: shelfQR.merchantId,
    storeId: shelfQR.storeId,
    qrType: shelfQR.qrType,
    targetId: shelfQR.targetId,
    shortUrl: shelfQR.shortUrl,
    qrCode: shelfQR.qrCode,
    scans: shelfQR.scans,
    lastScanned: shelfQR.lastScanned,
    isActive: shelfQR.isActive,
  };
}

/**
 * Generate a checkout QR code
 */
export async function generateCheckoutQR(
  merchantId: string,
  storeId: string,
  cartId?: string,
  metadata?: { shelfName?: string }
): Promise<QRRcord> {
  const targetId = cartId || `checkout_${Date.now()}`;
  const shortUrl = await generateShortUrl('checkout', targetId);
  const qrCode = await generateQRImage(shortUrl);

  const shelfQR = new ShelfQR({
    merchantId,
    storeId,
    qrType: 'checkout',
    targetId,
    qrCode,
    shortUrl,
    scans: 0,
    lastScanned: null,
    isActive: true,
    metadata,
  });

  await shelfQR.save();

  return {
    _id: shelfQR._id.toString(),
    merchantId: shelfQR.merchantId,
    storeId: shelfQR.storeId,
    qrType: shelfQR.qrType,
    targetId: shelfQR.targetId,
    shortUrl: shelfQR.shortUrl,
    qrCode: shelfQR.qrCode,
    scans: shelfQR.scans,
    lastScanned: shelfQR.lastScanned,
    isActive: shelfQR.isActive,
  };
}

/**
 * Generate a loyalty program QR code
 */
export async function generateLoyaltyQR(
  merchantId: string,
  customerId: string,
  storeId?: string
): Promise<QRRcord> {
  const targetId = customerId;
  const shortUrl = await generateShortUrl('loyalty', targetId);
  const qrCode = await generateQRImage(shortUrl);

  const shelfQR = new ShelfQR({
    merchantId,
    storeId: storeId || 'global',
    qrType: 'loyalty',
    targetId,
    qrCode,
    shortUrl,
    scans: 0,
    lastScanned: null,
    isActive: true,
  });

  await shelfQR.save();

  return {
    _id: shelfQR._id.toString(),
    merchantId: shelfQR.merchantId,
    storeId: shelfQR.storeId,
    qrType: shelfQR.qrType,
    targetId: shelfQR.targetId,
    shortUrl: shelfQR.shortUrl,
    qrCode: shelfQR.qrCode,
    scans: shelfQR.scans,
    lastScanned: shelfQR.lastScanned,
    isActive: shelfQR.isActive,
  };
}

/**
 * Track a QR code scan
 */
export async function trackScan(shortUrl: string, scanData?: { userAgent?: string; ip?: string }): Promise<IShelfQR | null> {
  const shelfQR = await ShelfQR.findOne({ shortUrl });

  if (!shelfQR) {
    console.warn(`QR code not found for URL: ${shortUrl}`);
    return null;
  }

  if (!shelfQR.isActive) {
    console.warn(`QR code is inactive: ${shortUrl}`);
    return null;
  }

  shelfQR.scans += 1;
  shelfQR.lastScanned = new Date();
  await shelfQR.save();

  return shelfQR;
}

/**
 * Get QR code details by short URL
 */
export async function getQRByShortUrl(shortUrl: string): Promise<IShelfQR | null> {
  return ShelfQR.findOne({ shortUrl });
}

/**
 * Get all QR codes for a merchant
 */
export async function getQRCodesByMerchant(
  merchantId: string,
  options?: { qrType?: string; storeId?: string; isActive?: boolean }
): Promise<IShelfQR[]> {
  const query: Record<string, unknown> = { merchantId };

  if (options?.qrType) {
    query.qrType = options.qrType;
  }
  if (options?.storeId) {
    query.storeId = options.storeId;
  }
  if (options?.isActive !== undefined) {
    query.isActive = options.isActive;
  }

  return ShelfQR.find(query).sort({ createdAt: -1 });
}

/**
 * Deactivate a QR code
 */
export async function deactivateQR(shortUrl: string): Promise<boolean> {
  const result = await ShelfQR.updateOne(
    { shortUrl },
    { isActive: false }
  );
  return result.modifiedCount > 0;
}

/**
 * Get scan statistics for a merchant
 */
export async function getScanStats(
  merchantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ totalScans: number; scansByType: Record<string, number> }> {
  const matchStage: Record<string, unknown> = { merchantId };

  if (startDate || endDate) {
    matchStage.lastScanned = {};
    if (startDate) {
      (matchStage.lastScanned as Record<string, Date>).$gte = startDate;
    }
    if (endDate) {
      (matchStage.lastScanned as Record<string, Date>).$lte = endDate;
    }
  }

  const result = await ShelfQR.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalScans: { $sum: '$scans' },
        scansByType: { $push: '$qrType' },
      },
    },
    {
      $project: {
        _id: 0,
        totalScans: 1,
        scansByType: 1,
      },
    },
  ]);

  if (result.length === 0) {
    return { totalScans: 0, scansByType: {} };
  }

  const scansByType: Record<string, number> = {};
  result[0].scansByType.forEach((type: string) => {
    scansByType[type] = (scansByType[type] || 0) + 1;
  });

  return {
    totalScans: result[0].totalScans,
    scansByType,
  };
}
