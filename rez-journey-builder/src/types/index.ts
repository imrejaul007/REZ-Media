/**
 * REZ Journey Builder - Types
 */

// ─── Node Types ─────────────────────────────────────────────────────────────

export type NodeType =
  | 'trigger'
  | 'condition'
  | 'action'
  | 'delay'
  | 'split'
  | 'end';

export interface Position {
  x: number;
  y: number;
}

export interface NodeData {
  label: string;
  description?: string;
  config: Record<string, unknown>;
}

export interface JourneyNode {
  id: string;
  type: NodeType;
  position: Position;
  data: NodeData;
}

export interface JourneyConnection {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// ─── Journey ────────────────────────────────────────────────────────────────

export interface JourneyTemplate {
  id: string;
  name: string;
  description?: string;
  nodes: JourneyNode[];
  connections: JourneyConnection[];
  status: 'draft' | 'published' | 'archived';
  triggers?: JourneyTrigger[];
  stats?: JourneyStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface JourneyTrigger {
  id: string;
  type: 'event' | 'schedule' | 'api' | 'manual';
  config: Record<string, unknown>;
}

export interface JourneyStats {
  enrolled: number;
  completed: number;
  dropped: number;
  conversionRate: number;
}

// ─── Trigger Nodes ─────────────────────────────────────────────────────────

export interface TriggerConfig {
  eventType?: string;
  schedule?: string;
  filter?: FilterCondition[];
}

export interface ConditionConfig {
  conditions: FilterCondition[];
  operator: 'and' | 'or';
}

export interface ActionConfig {
  actionType: 'email' | 'sms' | 'push' | 'whatsapp' | 'webhook' | 'update_profile';
  template?: string;
  webhookUrl?: string;
}

export interface DelayConfig {
  duration: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface SplitConfig {
  branches: SplitBranch[];
}

export interface SplitBranch {
  id: string;
  label: string;
  condition: FilterCondition[];
}

// ─── Filter ────────────────────────────────────────────────────────────────

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: unknown;
}

// ─── Templates ─────────────────────────────────────────────────────────────

export interface JourneyTemplatePreset {
  id: string;
  name: string;
  description: string;
  category: 'welcome' | 'reengagement' | 'purchase' | 'support';
  nodes: JourneyNode[];
  connections: JourneyConnection[];
}

export const PRESET_TEMPLATES: JourneyTemplatePreset[] = [
  {
    id: 'welcome-series',
    name: 'Welcome Series',
    description: 'Onboard new customers with a 3-day welcome sequence',
    category: 'welcome',
    nodes: [
      { id: 'trigger', type: 'trigger', position: { x: 100, y: 50 }, data: { label: 'New Signup', config: {} } },
      { id: 'welcome-email', type: 'action', position: { x: 100, y: 150 }, data: { label: 'Welcome Email', config: { actionType: 'email' } } },
      { id: 'delay-1', type: 'delay', position: { x: 100, y: 250 }, data: { label: 'Wait 1 day', config: { duration: 1, unit: 'days' } } },
      { id: 'intro-email', type: 'action', position: { x: 100, y: 350 }, data: { label: 'Intro to Features', config: { actionType: 'email' } } },
      { id: 'delay-2', type: 'delay', position: { x: 100, y: 450 }, data: { label: 'Wait 2 days', config: { duration: 2, unit: 'days' } } },
      { id: 'offer-email', type: 'action', position: { x: 100, y: 550 }, data: { label: 'First Order Offer', config: { actionType: 'email' } } },
      { id: 'end', type: 'end', position: { x: 100, y: 650 }, data: { label: 'End', config: {} } },
    ],
    connections: [
      { id: 'c1', source: 'trigger', target: 'welcome-email' },
      { id: 'c2', source: 'welcome-email', target: 'delay-1' },
      { id: 'c3', source: 'delay-1', target: 'intro-email' },
      { id: 'c4', source: 'intro-email', target: 'delay-2' },
      { id: 'c5', source: 'delay-2', target: 'offer-email' },
      { id: 'c6', source: 'offer-email', target: 'end' },
    ],
  },
  {
    id: 'abandoned-cart',
    name: 'Abandoned Cart Recovery',
    description: 'Recover abandoned carts with timed reminders',
    category: 'purchase',
    nodes: [
      { id: 'trigger', type: 'trigger', position: { x: 100, y: 50 }, data: { label: 'Cart Abandoned', config: {} } },
      { id: 'condition', type: 'condition', position: { x: 100, y: 150 }, data: { label: 'Cart Value > ₹500', config: {} } },
      { id: 'email-1', type: 'action', position: { x: 50, y: 250 }, data: { label: 'Reminder 1 (1hr)', config: { actionType: 'email' } } },
      { id: 'email-2', type: 'action', position: { x: 200, y: 250 }, data: { label: 'Reminder 2 (24hr)', config: { actionType: 'email' } } },
      { id: 'end', type: 'end', position: { x: 100, y: 350 }, data: { label: 'End', config: {} } },
    ],
    connections: [
      { id: 'c1', source: 'trigger', target: 'condition' },
      { id: 'c2', source: 'condition', target: 'email-1', label: 'Yes' },
      { id: 'c3', source: 'condition', target: 'email-2', label: 'Yes' },
      { id: 'c4', source: 'email-1', target: 'end' },
      { id: 'c5', source: 'email-2', target: 'end' },
    ],
  },
  {
    id: 'winback',
    name: 'Win Back Campaign',
    description: 'Re-engage customers who haven\'t purchased in 30 days',
    category: 'reengagement',
    nodes: [
      { id: 'trigger', type: 'trigger', position: { x: 100, y: 50 }, data: { label: 'No purchase 30 days', config: {} } },
      { id: 'email-1', type: 'action', position: { x: 100, y: 150 }, data: { label: 'We miss you email', config: { actionType: 'email' } } },
      { id: 'delay', type: 'delay', position: { x: 100, y: 250 }, data: { label: 'Wait 7 days', config: { duration: 7, unit: 'days' } } },
      { id: 'condition', type: 'condition', position: { x: 100, y: 350 }, data: { label: 'Made purchase?', config: {} } },
      { id: 'offer', type: 'action', position: { x: 50, y: 450 }, data: { label: 'Special offer', config: { actionType: 'email' } } },
      { id: 'end-win', type: 'end', position: { x: 200, y: 550 }, data: { label: 'End', config: {} } },
      { id: 'end-lose', type: 'end', position: { x: 50, y: 550 }, data: { label: 'End', config: {} } },
    ],
    connections: [
      { id: 'c1', source: 'trigger', target: 'email-1' },
      { id: 'c2', source: 'email-1', target: 'delay' },
      { id: 'c3', source: 'delay', target: 'condition' },
      { id: 'c4', source: 'condition', target: 'end-win', label: 'Yes' },
      { id: 'c5', source: 'condition', target: 'offer', label: 'No' },
      { id: 'c6', source: 'offer', target: 'end-lose' },
    ],
  },
];
