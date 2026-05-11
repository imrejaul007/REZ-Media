/**
 * Free Consultation Reward System
 * Handles consultation bookings, calendar integration, and confirmations
 */

import { createClient } from '../supabase';

// Types
export interface Consultation {
  id: string;
  brandId: string;
  brandName: string;
  category: string;
  title: string;
  description: string;
  duration: number; // in minutes
  expertName?: string;
  expertImage?: string;
  value: number; // estimated value in rupees
  available: boolean;
  slots: ConsultationSlot[];
  createdAt: string;
}

export interface ConsultationSlot {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  available: boolean;
  bookedBy?: string;
}

export interface ConsultationBooking {
  id: string;
  userId: string;
  consultationId: string;
  slotId: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  confirmationCode: string;
  qrCode?: string;
  meetingLink?: string;
  notes?: string;
  bookedAt: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  reminderSent: boolean;
}

export interface BookConsultationParams {
  userId: string;
  consultationId: string;
  slotId: string;
  notes?: string;
}

export interface CalendarEvent {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  meetingLink?: string;
}

/**
 * Get all available consultations
 */
export async function getAvailableConsultations(): Promise<Consultation[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('available', true)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as Consultation[];
  } catch (error) {
    console.error('Get available consultations error:', error);
    return [];
  }
}

/**
 * Get consultation by ID
 */
export async function getConsultation(consultationId: string): Promise<Consultation | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('id', consultationId)
      .single();

    if (error || !data) return null;
    return data as Consultation;
  } catch (error) {
    console.error('Get consultation error:', error);
    return null;
  }
}

/**
 * Get available slots for a consultation
 */
export async function getAvailableSlots(
  consultationId: string,
  date?: string
): Promise<ConsultationSlot[]> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('consultation_slots')
      .select('*')
      .eq('consultation_id', consultationId)
      .eq('available', true)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    // Filter out past slots
    const now = new Date();
    return data.filter(slot => {
      const slotDateTime = new Date(`${slot.date}T${slot.time}`);
      return slot.available && slotDateTime > now;
    }) as ConsultationSlot[];
  } catch (error) {
    console.error('Get available slots error:', error);
    return [];
  }
}

/**
 * Book a consultation
 */
export async function bookConsultation(params: BookConsultationParams): Promise<{
  success: boolean;
  booking?: ConsultationBooking;
  confirmationCode?: string;
  message?: string;
}> {
  try {
    const supabase = createClient();

    // Get consultation and slot
    const consultation = await getConsultation(params.consultationId);
    if (!consultation) {
      return { success: false, message: 'Consultation not found' };
    }

    const { data: slot, error: slotError } = await supabase
      .from('consultation_slots')
      .select('*')
      .eq('id', params.slotId)
      .eq('consultation_id', params.consultationId)
      .single();

    if (slotError || !slot) {
      return { success: false, message: 'Slot not found' };
    }

    if (!slot.available) {
      return { success: false, message: 'Slot is no longer available' };
    }

    // Check for existing booking
    const { data: existing } = await supabase
      .from('consultation_bookings')
      .select('*')
      .eq('user_id', params.userId)
      .eq('slot_id', params.slotId)
      .single();

    if (existing) {
      return { success: false, message: 'You have already booked this slot' };
    }

    // Generate confirmation code
    const confirmationCode = generateConfirmationCode();
    const bookingId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate meeting time
    const slotDateTime = new Date(`${slot.date}T${slot.time}`);
    const endTime = new Date(slotDateTime.getTime() + consultation.duration * 60000);
    const meetingLink = `https://meet.rez.money/consultation/${bookingId}`;

    const booking: ConsultationBooking = {
      id: bookingId,
      userId: params.userId,
      consultationId: params.consultationId,
      slotId: params.slotId,
      status: 'confirmed',
      confirmationCode,
      meetingLink,
      notes: params.notes,
      bookedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      reminderSent: false,
    };

    const { error: bookingError } = await supabase.from('consultation_bookings').insert(booking);

    if (bookingError) {
      console.error('Book consultation error:', bookingError);
      return { success: false, message: 'Failed to book consultation' };
    }

    // Mark slot as unavailable
    await supabase
      .from('consultation_slots')
      .update({ available: false, booked_by: params.userId })
      .eq('id', params.slotId);

    return {
      success: true,
      booking,
      confirmationCode,
      message: `Consultation booked for ${slot.date} at ${slot.time}!`,
    };
  } catch (error) {
    console.error('Book consultation error:', error);
    return { success: false, message: 'Failed to book consultation' };
  }
}

/**
 * Get user's consultation bookings
 */
export async function getUserBookings(userId: string): Promise<ConsultationBooking[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('consultation_bookings')
      .select('*, consultations(*)')
      .eq('user_id', userId)
      .order('booked_at', { ascending: false });

    if (error || !data) return [];
    return data as ConsultationBooking[];
  } catch (error) {
    console.error('Get user bookings error:', error);
    return [];
  }
}

/**
 * Get booking details with slot info
 */
export async function getBookingDetails(bookingId: string, userId: string): Promise<(ConsultationBooking & { slot: ConsultationSlot }) | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('consultation_bookings')
      .select('*, consultation_slots(*)')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data as ConsultationBooking & { slot: ConsultationSlot };
  } catch (error) {
    console.error('Get booking details error:', error);
    return null;
  }
}

/**
 * Generate booking QR code
 */
export async function generateBookingQR(bookingId: string): Promise<{
  success: boolean;
  qrData?: string;
  message?: string;
}> {
  try {
    const supabase = createClient();

    const { data: booking, error } = await supabase
      .from('consultation_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return { success: false, message: 'Booking not found' };
    }

    // Generate QR data
    const qrData = JSON.stringify({
      type: 'consultation_booking',
      bookingId: booking.id,
      confirmationCode: booking.confirmation_code,
      consultationId: booking.consultation_id,
      slotId: booking.slot_id,
      meetingLink: booking.meeting_link,
    });

    // Update booking with QR code
    await supabase
      .from('consultation_bookings')
      .update({ qr_code: qrData })
      .eq('id', bookingId);

    return { success: true, qrData };
  } catch (error) {
    console.error('Generate booking QR error:', error);
    return { success: false, message: 'Failed to generate QR code' };
  }
}

/**
 * Cancel consultation booking
 */
export async function cancelBooking(bookingId: string, userId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const supabase = createClient();

    const { data: booking, error } = await supabase
      .from('consultation_bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (error || !booking) {
      return { success: false, message: 'Booking not found' };
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return { success: false, message: 'Cannot cancel this booking' };
    }

    // Update booking status
    await supabase
      .from('consultation_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    // Make slot available again
    await supabase
      .from('consultation_slots')
      .update({ available: true, booked_by: null })
      .eq('id', booking.slot_id);

    return { success: true, message: 'Booking cancelled successfully' };
  } catch (error) {
    console.error('Cancel booking error:', error);
    return { success: false, message: 'Failed to cancel booking' };
  }
}

/**
 * Reschedule consultation booking
 */
export async function rescheduleBooking(
  bookingId: string,
  userId: string,
  newSlotId: string
): Promise<{
  success: boolean;
  booking?: ConsultationBooking;
  message?: string;
}> {
  try {
    const supabase = createClient();

    // Get existing booking
    const { data: booking, error } = await supabase
      .from('consultation_bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (error || !booking) {
      return { success: false, message: 'Booking not found' };
    }

    if (booking.status !== 'confirmed') {
      return { success: false, message: 'Cannot reschedule this booking' };
    }

    // Check new slot availability
    const { data: newSlot } = await supabase
      .from('consultation_slots')
      .select('*')
      .eq('id', newSlotId)
      .eq('available', true)
      .single();

    if (!newSlot) {
      return { success: false, message: 'New slot is not available' };
    }

    // Make old slot available
    await supabase
      .from('consultation_slots')
      .update({ available: true, booked_by: null })
      .eq('id', booking.slot_id);

    // Book new slot
    await supabase
      .from('consultation_slots')
      .update({ available: false, booked_by: userId })
      .eq('id', newSlotId);

    // Update booking
    const meetingLink = `https://meet.rez.money/consultation/${bookingId}`;
    await supabase
      .from('consultation_bookings')
      .update({
        slot_id: newSlotId,
        meeting_link: meetingLink,
      })
      .eq('id', bookingId);

    // Get updated booking
    const updatedBooking = await getBookingDetails(bookingId, userId);

    return {
      success: true,
      booking: updatedBooking || undefined,
      message: `Consultation rescheduled to ${newSlot.date} at ${newSlot.time}!`,
    };
  } catch (error) {
    console.error('Reschedule booking error:', error);
    return { success: false, message: 'Failed to reschedule booking' };
  }
}

/**
 * Generate calendar event (ICS format)
 */
export function generateCalendarEvent(booking: ConsultationBooking, consultation: Consultation, slot: ConsultationSlot): CalendarEvent {
  const startTime = `${slot.date}T${slot.time}:00`;
  const endDate = new Date(new Date(`${slot.date}T${slot.time}`).getTime() + consultation.duration * 60000);
  const endTime = endDate.toISOString().slice(0, 16).replace(/[:-]/g, '').replace('T', 'T');

  return {
    title: `${consultation.title} - ${consultation.brandName}`,
    description: `Consultation with ${consultation.expertName || 'Expert'}\n\n${consultation.description}\n\nMeeting Link: ${booking.meetingLink || 'TBD'}`,
    startTime: startTime.replace(/[:-]/g, '').replace('T', 'T'),
    endTime: endTime,
    attendees: [],
    meetingLink: booking.meetingLink,
  };
}

/**
 * Generate ICS file content
 */
export function generateICSFile(event: CalendarEvent): string {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Ads QR//Consultation//EN
BEGIN:VEVENT
UID:${Date.now()}@adsqr.rez.money
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${event.startTime}
DTEND:${event.endTime}
SUMMARY:${event.title}
DESCRIPTION:${event.description.replace(/\n/g, '\\n')}
END:VEVENT
END:VCALENDAR`;
}

/**
 * Download calendar event
 */
export function downloadCalendarEvent(event: CalendarEvent): void {
  const icsContent = generateICSFile(event);
  const blob = new Blob([icsContent], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'consultation.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate unique confirmation code
 */
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CNSL-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
