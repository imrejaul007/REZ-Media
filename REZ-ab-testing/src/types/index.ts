import { Types } from 'mongoose';

// Variant definition
export interface IVariant {
  id: string;
  name: string;
  description?: string;
  weight: number; // Traffic allocation weight (0-100)
  isControl: boolean;
  metadata?: Record<string, unknown>;
}

// Variant statistics
export interface IVariantStats {
  variantId: string;
  variantName: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  averageOrderValue: number;
  confidence: number;
  isWinner: boolean;
  uplift: number; // % improvement over control
}

// Experiment status
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

// Experiment type
export type ExperimentType = 'ab' | 'multivariate' | 'bandit';

// Primary metric
export type PrimaryMetric = 'conversion_rate' | 'revenue' | 'ctr' | 'engagement';

// Statistical settings
export interface IStatisticalSettings {
  confidenceLevel: number; // 0.9, 0.95, 0.99
  minimumSampleSize: number;
  testType: 'frequentist' | 'bayesian';
  sequentialTesting: boolean;
}

// Auto-stop settings
export interface IAutoStopSettings {
  enabled: boolean;
  maxDuration: number; // days
  maxImpressions: number;
  stopOnSignificance: boolean;
}

// Winner determination
export interface IWinnerSettings {
  autoWinner: boolean;
  confidenceThreshold: number;
  holdoutPeriod: number; // days to continue after winner detected
}

// Experiment document interface
export interface IExperiment {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  type: ExperimentType;
  status: ExperimentStatus;
  variants: IVariant[];
  primaryMetric: PrimaryMetric;
  secondaryMetrics?: PrimaryMetric[];

  // Targeting
  targetingRules?: Record<string, unknown>;
  trafficAllocation: number; // % of total traffic to include

  // Statistics
  statisticalSettings: IStatisticalSettings;
  autoStopSettings: IAutoStopSettings;
  winnerSettings: IWinnerSettings;

  // Scheduling
  startDate?: Date;
  endDate?: Date;
  createdBy: string;

  // Winner
  winnerId?: string;
  winnerDetectedAt?: Date;

  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

// Conversion event
export interface IConversionEvent {
  _id: Types.ObjectId;
  experimentId: Types.ObjectId;
  variantId: string;
  userId: string;
  sessionId: string;
  value?: number; // Revenue value
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// Impression event
export interface IImpressionEvent {
  _id: Types.ObjectId;
  experimentId: Types.ObjectId;
  variantId: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
}

// Create experiment DTO
export interface CreateExperimentDTO {
  name: string;
  description?: string;
  type?: ExperimentType;
  variants: Omit<IVariant, 'id'>[];
  primaryMetric: PrimaryMetric;
  secondaryMetrics?: PrimaryMetric[];
  targetingRules?: Record<string, unknown>;
  trafficAllocation?: number;
  statisticalSettings?: Partial<IStatisticalSettings>;
  autoStopSettings?: Partial<IAutoStopSettings>;
  winnerSettings?: Partial<IWinnerSettings>;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy: string;
}

// Update experiment DTO
export interface UpdateExperimentDTO {
  name?: string;
  description?: string;
  status?: ExperimentStatus;
  variants?: IVariant[];
  targetingRules?: Record<string, unknown>;
  trafficAllocation?: number;
  statisticalSettings?: Partial<IStatisticalSettings>;
  autoStopSettings?: Partial<IAutoStopSettings>;
  winnerSettings?: Partial<IWinnerSettings>;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// Add variant DTO
export interface AddVariantDTO {
  name: string;
  description?: string;
  weight: number;
  isControl?: boolean;
  metadata?: Record<string, unknown>;
}

// Track event DTO
export interface TrackEventDTO {
  userId: string;
  sessionId: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

// Experiment results response
export interface ExperimentResults {
  experimentId: string;
  name: string;
  status: ExperimentStatus;
  startDate: Date | null;
  endDate: Date | null;
  duration: number; // days
  totalImpressions: number;
  totalConversions: number;
  variantStats: IVariantStats[];
  significance: {
    pValue: number;
    confidenceLevel: number;
    isSignificant: boolean;
    testType: string;
  };
  winner?: {
    variantId: string;
    variantName: string;
    uplift: number;
    confidence: number;
    detectedAt?: Date;
  };
  revenueImpact?: {
    totalRevenue: number;
    estimatedLift: number;
    projectedAnnualRevenue: number;
  };
  recommendations: string[];
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
