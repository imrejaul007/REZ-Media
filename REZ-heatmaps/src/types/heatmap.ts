import { z } from 'zod';

// Click event schema
export const ClickEventSchema = z.object({
  sessionId: z.string().uuid(),
  pageId: z.string(),
  websiteId: z.string(),
  x: z.number(),
  y: z.number(),
  elementX: z.number().optional(),
  elementY: z.number().optional(),
  elementTag: z.string().optional(),
  elementId: z.string().optional(),
  elementClass: z.string().optional(),
  timestamp: z.number(),
  viewportWidth: z.number(),
  viewportHeight: z.number(),
});

// Scroll event schema
export const ScrollEventSchema = z.object({
  sessionId: z.string().uuid(),
  pageId: z.string(),
  websiteId: z.string(),
  scrollDepth: z.number().min(0).max(100),
  maxScrollDepth: z.number().min(0).max(100),
  timestamp: z.number(),
  viewportHeight: z.number(),
  documentHeight: z.number(),
});

// Movement event schema
export const MovementEventSchema = z.object({
  sessionId: z.string().uuid(),
  pageId: z.string(),
  websiteId: z.string(),
  x: z.number(),
  y: z.number(),
  timestamp: z.number(),
  throttleIndex: z.number(),
});

// Page view event schema
export const PageViewSchema = z.object({
  sessionId: z.string().uuid(),
  pageId: z.string(),
  websiteId: z.string(),
  url: z.string().url(),
  referrer: z.string().optional(),
  title: z.string().optional(),
  timestamp: z.number(),
  viewportWidth: z.number(),
  viewportHeight: z.number(),
});

// Session data schema
export const SessionSchema = z.object({
  sessionId: z.string().uuid(),
  websiteId: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  duration: z.number().optional(),
  pageViews: z.number().default(0),
  clicks: z.number().default(0),
  avgScrollDepth: z.number().default(0),
  bounce: z.boolean().default(true),
  country: z.string().optional(),
  device: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
});

// Website config schema
export const WebsiteConfigSchema = z.object({
  websiteId: z.string(),
  name: z.string(),
  domain: z.string(),
  enabled: z.boolean().default(true),
  sampleRate: z.number().min(0).max(1).default(1),
  sessionTimeout: z.number().default(1800000),
  createdAt: z.number(),
});

// Analytics aggregation schema
export const AnalyticsQuerySchema = z.object({
  websiteId: z.string(),
  startDate: z.number(),
  endDate: z.number(),
  pageId: z.string().optional(),
  interval: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});

// Type exports
export type ClickEvent = z.infer<typeof ClickEventSchema>;
export type ScrollEvent = z.infer<typeof ScrollEventSchema>;
export type MovementEvent = z.infer<typeof MovementEventSchema>;
export type PageView = z.infer<typeof PageViewSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type WebsiteConfig = z.infer<typeof WebsiteConfigSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

// Heatmap data structure for visualization
export interface HeatmapCell {
  x: number;
  y: number;
  count: number;
  intensity: number;
}

export interface ScrollHeatmapData {
  depth: number;
  percentage: number;
  viewCount: number;
}

export interface ClickHeatmapData {
  cells: HeatmapCell[];
  resolution: number;
  totalClicks: number;
}

export interface MovementHeatmapData {
  path: Array<{ x: number; y: number; weight: number }>;
  hotspots: Array<{ x: number; y: number; intensity: number }>;
}

export interface PageAnalytics {
  pageId: string;
  url: string;
  title: string;
  views: number;
  uniqueSessions: number;
  avgDuration: number;
  avgScrollDepth: number;
  clickCount: number;
  bounceRate: number;
}

export interface DashboardData {
  websiteId: string;
  totalViews: number;
  uniqueVisitors: number;
  avgSessionDuration: number;
  avgBounceRate: number;
  topPages: PageAnalytics[];
  scrollDepthDistribution: number[];
  clickHeatmap: ClickHeatmapData;
  movementHeatmap: MovementHeatmapData;
}
