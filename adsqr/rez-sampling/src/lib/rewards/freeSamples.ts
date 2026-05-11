/**
 * Free Samples Reward System
 * Handles sample requests, store availability, and pickup QR codes
 */

import { createClient } from '../supabase';

// Types
export interface FreeSample {
  id: string;
  name: string;
  description: string;
  image?: string;
  brandId: string;
  brandName: string;
  category: string;
  value: number; // estimated value in rupees
  available: boolean;
  stores?: string[]; // store IDs where available
  expiryDate?: string;
  createdAt: string;
}

export interface SampleRequest {
  id: string;
  userId: string;
  sampleId: string;
  storeId: string;
  status: 'pending' | 'approved' | 'ready' | 'collected' | 'expired' | 'cancelled';
  pickupCode: string;
  qrCode?: string;
  requestedAt: string;
  approvedAt?: string;
  expiresAt?: string;
  collectedAt?: string;
}

export interface SampleAvailability {
  storeId: string;
  storeName: string;
  storeAddress: string;
  available: boolean;
  quantity?: number;
  distance?: number; // in km
}

export interface RequestSampleParams {
  userId: string;
  sampleId: string;
  storeId: string;
}

/**
 * Get all available free samples
 */
export async function getAvailableSamples(): Promise<FreeSample[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('free_samples')
      .select('*')
      .eq('available', true)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as FreeSample[];
  } catch (error) {
    console.error('Get available samples error:', error);
    return [];
  }
}

/**
 * Get sample by ID
 */
export async function getSample(sampleId: string): Promise<FreeSample | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('free_samples')
      .select('*')
      .eq('id', sampleId)
      .single();

    if (error || !data) return null;
    return data as FreeSample;
  } catch (error) {
    console.error('Get sample error:', error);
    return null;
  }
}

/**
 * Get samples by brand
 */
export async function getSamplesByBrand(brandId: string): Promise<FreeSample[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('free_samples')
      .select('*')
      .eq('brand_id', brandId)
      .eq('available', true)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as FreeSample[];
  } catch (error) {
    console.error('Get samples by brand error:', error);
    return [];
  }
}

/**
 * Check store availability for a sample
 */
export async function checkSampleAvailability(
  sampleId: string,
  location?: { lat: number; lng: number }
): Promise<SampleAvailability[]> {
  try {
    const supabase = createClient();

    // Get sample details
    const sample = await getSample(sampleId);
    if (!sample) return [];

    // Get stores that have this sample
    const { data: inventory, error } = await supabase
      .from('sample_inventory')
      .select('*, stores(*)')
      .eq('sample_id', sampleId)
      .gt('quantity', 0);

    if (error || !inventory) return [];

    const availability = inventory.map(inv => ({
      storeId: inv.store_id,
      storeName: (inv.stores as any)?.name || 'Unknown Store',
      storeAddress: (inv.stores as any)?.address || '',
      available: inv.quantity > 0,
      quantity: inv.quantity,
      distance: location ? calculateDistance(
        location.lat,
        location.lng,
        (inv.stores as any)?.latitude || 0,
        (inv.stores as any)?.longitude || 0
      ) : undefined,
    }));

    // Sort by distance if location provided
    if (location) {
      availability.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    return availability;
  } catch (error) {
    console.error('Check sample availability error:', error);
    return [];
  }
}

/**
 * Request a free sample
 */
export async function requestSample(params: RequestSampleParams): Promise<{
  success: boolean;
  request?: SampleRequest;
  pickupCode?: string;
  message?: string;
}> {
  try {
    const supabase = createClient();

    // Check if sample is still available
    const sample = await getSample(params.sampleId);
    if (!sample) {
      return { success: false, message: 'Sample not found' };
    }

    // Check store inventory
    const { data: inventory } = await supabase
      .from('sample_inventory')
      .select('*')
      .eq('sample_id', params.sampleId)
      .eq('store_id', params.storeId)
      .single();

    if (!inventory || inventory.quantity <= 0) {
      return { success: false, message: 'Sample not available at this store' };
    }

    // Check if user already requested this sample
    const { data: existingRequest } = await supabase
      .from('sample_requests')
      .select('*')
      .eq('user_id', params.userId)
      .eq('sample_id', params.sampleId)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return { success: false, message: 'You already have a pending request for this sample' };
    }

    // Generate pickup code
    const pickupCode = generatePickupCode();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Create request
    const request: SampleRequest = {
      id: requestId,
      userId: params.userId,
      sampleId: params.sampleId,
      storeId: params.storeId,
      status: 'pending',
      pickupCode,
      requestedAt: new Date().toISOString(),
      expiresAt,
    };

    const { error } = await supabase.from('sample_requests').insert(request);

    if (error) {
      console.error('Request sample error:', error);
      return { success: false, message: 'Failed to request sample' };
    }

    // Decrement inventory
    await supabase
      .from('sample_inventory')
      .update({ quantity: inventory.quantity - 1 })
      .eq('id', inventory.id);

    return {
      success: true,
      request,
      pickupCode,
      message: 'Sample request submitted! Show the QR code at the store to collect.',
    };
  } catch (error) {
    console.error('Request sample error:', error);
    return { success: false, message: 'Failed to request sample' };
  }
}

/**
 * Generate pickup QR code for sample collection
 */
export async function generatePickupQR(requestId: string): Promise<{
  success: boolean;
  qrData?: string;
  message?: string;
}> {
  try {
    const supabase = createClient();

    // Get request details
    const { data: request, error } = await supabase
      .from('sample_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error || !request) {
      return { success: false, message: 'Request not found' };
    }

    // Generate QR data
    const qrData = JSON.stringify({
      type: 'sample_pickup',
      requestId: request.id,
      pickupCode: request.pickup_code,
      sampleId: request.sample_id,
      expiresAt: request.expires_at,
    });

    // Update request with QR code data
    await supabase
      .from('sample_requests')
      .update({ qr_code: qrData })
      .eq('id', requestId);

    return { success: true, qrData };
  } catch (error) {
    console.error('Generate pickup QR error:', error);
    return { success: false, message: 'Failed to generate QR code' };
  }
}

/**
 * Get user's sample requests
 */
export async function getUserSampleRequests(userId: string): Promise<SampleRequest[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sample_requests')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    if (error || !data) return [];
    return data as SampleRequest[];
  } catch (error) {
    console.error('Get user sample requests error:', error);
    return [];
  }
}

/**
 * Get active sample request (for QR display)
 */
export async function getActiveSampleRequest(requestId: string): Promise<SampleRequest | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sample_requests')
      .select('*, free_samples(*)')
      .eq('id', requestId)
      .single();

    if (error || !data) return null;
    return data as SampleRequest;
  } catch (error) {
    console.error('Get active sample request error:', error);
    return null;
  }
}

/**
 * Cancel sample request
 */
export async function cancelSampleRequest(requestId: string, userId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const supabase = createClient();

    // Get request
    const { data: request, error } = await supabase
      .from('sample_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', userId)
      .single();

    if (error || !request) {
      return { success: false, message: 'Request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, message: 'Cannot cancel this request' };
    }

    // Update status
    await supabase
      .from('sample_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId);

    // Return inventory
    const { data: inventory } = await supabase
      .from('sample_inventory')
      .select('*')
      .eq('sample_id', request.sample_id)
      .eq('store_id', request.store_id)
      .single();

    if (inventory) {
      await supabase
        .from('sample_inventory')
        .update({ quantity: inventory.quantity + 1 })
        .eq('id', inventory.id);
    }

    return { success: true, message: 'Request cancelled successfully' };
  } catch (error) {
    console.error('Cancel sample request error:', error);
    return { success: false, message: 'Failed to cancel request' };
  }
}

/**
 * Generate unique pickup code
 */
function generatePickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
