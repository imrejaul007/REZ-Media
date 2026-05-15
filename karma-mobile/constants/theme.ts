/**
 * Karma Mobile App Constants & Theme
 *
 * Re-exports from @rez/brand-tokens and adds karma-specific colors.
 */

import { colors as brandColors, spacing as brandSpacing, borderRadius as brandRadius } from '@rez/brand-tokens';

// Karma App Identity Colors (Purple theme)
export const Colors = {
  // Primary Purple (Karma identity)
  primary: '#8B5CF6',
  primaryDark: '#7C3AED',
  primaryLight: '#A78BFA',
  gradient: ['#7C3AED', '#8B5CF6', '#A78BFA'] as const,

  // Brand colors
  purple: '#8B5CF6',
  purpleDark: '#7C3AED',
  purpleLight: '#A78BFA',

  // Semantic colors from brand tokens
  ...brandColors,

  // Status colors (override brand for consistency)
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Grays
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
};

// Karma Band Colors
export const BAND_COLORS: Record<string, string> = {
  starter: '#9CA3AF',
  active: '#10B981',
  performer: '#3B82F6',
  leader: '#8B5CF6',
  elite: '#F59E0B',
  pinnacle: '#EF4444',
};

// Re-export spacing and border radius from brand tokens
export const Spacing = brandSpacing;
export const BorderRadius = brandRadius;

// Re-export typography and other tokens from brand tokens
export * from '@rez/brand-tokens';
