// Workflow Types

export type TriggerType =
  | 'abandoned_cart'
  | 'signup'
  | 'purchase'
  | 'manual'
  | 'schedule'
  | 'inactivity'
  | 'price_drop'
  | 'back_in_stock'
  | 'birthday'
  | 'win_back';

export type StepType =
  | 'message'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'push'
  | 'webhook'
  | 'condition'
  | 'delay'
  | 'end'
  | 'split'
  | 'ai_generated_content';

export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
export type ConditionField = 'opened' | 'clicked' | 'purchased' | 'visited' | 'cart_value' | 'days_since_last_purchase' | 'tag' | 'segment';

export interface Position {
  x: number;
  y: number;
}

export interface Condition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface StepConfig {
  // Common
  template?: string;
  content?: string;
  subject?: string;

  // Delay
  duration?: string; // e.g., "1 hour", "2 days", "30 minutes"
  durationMinutes?: number;

  // Message/Email/SMS/WhatsApp/Push
  channel?: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';
  templateId?: string;
  variables?: Record<string, string>;

  // Webhook
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;

  // Condition
  conditions?: Condition[];
  conditionLogic?: 'AND' | 'OR';

  // Split (A/B Test)
  splits?: { name: string; percentage: number }[];

  // Discount
  discount?: string;
  discountCode?: string;

  // AI Content Generation
  aiPrompt?: string;
  contentType?: 'subject' | 'body' | 'image' | 'video';
}

export interface WorkflowStep {
  id: string;
  type: StepType;
  config: StepConfig;
  position: Position;
  edges: string[]; // Connected step IDs
  label?: string;
}

export interface WorkflowTrigger {
  type: TriggerType;
  conditions?: Condition[];
  // For schedule type
  cron?: string;
  timezone?: string;
  // For inactivity type
  days?: number;
  // For abandoned_cart type
  cartValueMin?: number;
  // For price_drop type
  productIds?: string[];
  // For back_in_stock type
  trackInventory?: boolean;
}

export interface WorkflowAnalytics {
  trackOpens: boolean;
  trackClicks: boolean;
  trackConversions: boolean;
  attributionWindow?: {
    click: number; // hours
    view: number; // hours
  };
}

export interface Workflow {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  analytics: WorkflowAnalytics;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// API Request/Response Types

export interface GenerateWorkflowRequest {
  prompt: string;
  options?: {
    includeA/BTest?: boolean;
    maxSteps?: number;
    preferredChannels?: ('email' | 'sms' | 'whatsapp' | 'push')[];
    outputFormat?: 'full' | 'minimal';
  };
}

export interface GenerateStepRequest {
  prompt: string;
  context?: {
    workflowId?: string;
    previousSteps?: WorkflowStep[];
    position?: Position;
  };
}

export interface ValidateWorkflowRequest {
  workflow: Workflow;
}

export interface OptimizeWorkflowRequest {
  workflow: Workflow;
  goals?: ('reduce_steps' | 'increase_engagement' | 'reduce_cost' | 'improve_timing')[];
}

export interface GenerateTemplateRequest {
  category?: 'welcome' | 'abandoned_cart' | 'post_purchase' | 'win_back' | 'reengagement' | 'promotional';
  complexity?: 'simple' | 'moderate' | 'complex';
}

export interface TemplateWithPromptRequest {
  templateId: string;
  prompt: string;
  modifications?: Partial<Workflow>;
}

export interface ImportWorkflowRequest {
  workflow: Workflow;
  targetJourneyId?: string;
  duplicateCheck?: boolean;
}

// API Response Types

export interface WorkflowGenerationResponse {
  workflow: Workflow;
  confidence: number; // 0-1
  suggestions?: string[];
  warnings?: string[];
  metadata?: {
    generationTime: number;
    tokensUsed?: number;
    model: string;
  };
}

export interface StepGenerationResponse {
  step: WorkflowStep;
  alternatives?: WorkflowStep[];
  explanation?: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface OptimizationResponse {
  workflow: Workflow;
  improvements: {
    type: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }[];
  estimatedImpact?: {
    engagementImprovement?: number;
    costReduction?: number;
    conversionImprovement?: number;
  };
}

export interface TemplateResponse {
  templates: WorkflowTemplate[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedSteps: number;
  estimatedDuration: string;
  preview?: Workflow;
  usageCount: number;
  tags: string[];
}

export interface ImportResponse {
  success: boolean;
  journeyId?: string;
  workflowId?: string;
  warnings?: string[];
}

// Generated Workflow Document (MongoDB)

export interface GeneratedWorkflowDocument {
  _id: string;
  prompt: string;
  workflow: Workflow;
  confidence: number;
  generationMetadata: {
    tokensUsed: number;
    model: string;
    generationTime: number;
    promptTokens: number;
    completionTokens: number;
  };
  status: 'generated' | 'validated' | 'imported' | 'rejected';
  validationResult?: ValidationResponse;
  importedTo?: {
    journeyId: string;
    journeyServiceUrl: string;
    importedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Error Types

export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Redis Cache Types

export interface CachedWorkflow {
  key: string;
  workflow: Workflow;
  ttl: number;
  createdAt: number;
}

// OpenAI Message Types

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompletionOptions {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}
