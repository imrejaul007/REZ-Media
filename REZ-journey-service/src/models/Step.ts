import { v4 as uuidv4 } from 'uuid';
import {
  ActionType,
  StepStatus,
  ActionConfig,
  StepAnalytics
} from '../types';

export type StepType = 'entry' | 'action' | 'condition' | 'split' | 'end';

export class Step {
  public readonly id: string;
  public name: string;
  public description: string;
  public type: StepType;
  public actionType: ActionType | null;
  public actionConfig: ActionConfig | null;
  public nextStepId: string;
  public errorStepId: string;
  public status: StepStatus;
  public position: { x: number; y: number }; // For visual builder
  public retryConfig: {
    maxRetries: number;
    retryDelay: number; // milliseconds
    exponentialBackoff: boolean;
  };
  public timeout: number; // milliseconds, 0 = no timeout
  public analytics: StepAnalytics;
  public conditions?: {
    operator: 'and' | 'or';
    items: {
      field: string;
      operator: string;
      value: unknown;
    }[];
  };
  public splitBranches?: {
    name: string;
    stepId: string;
    condition: {
      field: string;
      operator: string;
      value: unknown;
    };
  }[];

  constructor(data?: Partial<Step>) {
    this.id = data?.id || uuidv4();
    this.name = data?.name || 'New Step';
    this.description = data?.description || '';
    this.type = data?.type || 'action';
    this.actionType = data?.actionType || null;
    this.actionConfig = data?.actionConfig || null;
    this.nextStepId = data?.nextStepId || '';
    this.errorStepId = data?.errorStepId || '';
    this.status = data?.status || 'pending';
    this.position = data?.position || { x: 0, y: 0 };
    this.retryConfig = data?.retryConfig || {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true
    };
    this.timeout = data?.timeout || 30000; // 30 seconds default
    this.analytics = data?.analytics || this.initAnalytics();
    this.conditions = data?.conditions;
    this.splitBranches = data?.splitBranches;
  }

  private initAnalytics(): StepAnalytics {
    return {
      stepId: this.id,
      entered: 0,
      started: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      avgTimeToComplete: 0,
      conversionRate: 0,
      lastUpdated: new Date()
    };
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      actionType: this.actionType,
      actionConfig: this.actionConfig,
      nextStepId: this.nextStepId,
      errorStepId: this.errorStepId,
      status: this.status,
      position: this.position,
      retryConfig: this.retryConfig,
      timeout: this.timeout,
      analytics: {
        ...this.analytics,
        lastUpdated: this.analytics.lastUpdated.toISOString()
      },
      conditions: this.conditions,
      splitBranches: this.splitBranches
    };
  }

  public static fromJSON(json: Record<string, unknown>): Step {
    return new Step({
      id: json.id as string,
      name: json.name as string,
      description: json.description as string,
      type: json.type as StepType,
      actionType: json.actionType as ActionType | null,
      actionConfig: json.actionConfig as ActionConfig | null,
      nextStepId: json.nextStepId as string,
      errorStepId: json.errorStepId as string,
      status: json.status as StepStatus,
      position: json.position as { x: number; y: number },
      retryConfig: json.retryConfig as Step['retryConfig'],
      timeout: json.timeout as number,
      analytics: json.analytics ? {
        ...json.analytics as StepAnalytics,
        lastUpdated: new Date((json.analytics as StepAnalytics).lastUpdated)
      } : undefined,
      conditions: json.conditions as Step['conditions'],
      splitBranches: json.splitBranches as Step['splitBranches']
    });
  }

  public clone(): Step {
    return new Step({
      ...this,
      analytics: this.initAnalytics()
    });
  }

  public setAction(type: ActionType, config: ActionConfig): void {
    this.actionType = type;
    this.actionConfig = config;
  }

  public setNextStep(stepId: string): void {
    this.nextStepId = stepId;
  }

  public setErrorStep(stepId: string): void {
    this.errorStepId = stepId;
  }

  public setPosition(x: number, y: number): void {
    this.position = { x, y };
  }

  public setRetryConfig(config: Partial<Step['retryConfig']>): void {
    this.retryConfig = {
      ...this.retryConfig,
      ...config
    };
  }

  public setConditions(operator: 'and' | 'or', items: Step['conditions'] extends undefined ? never : Step['conditions']['items']): void {
    this.conditions = { operator, items };
  }

  public setSplitBranches(branches: Step['splitBranches']): void {
    this.splitBranches = branches;
  }

  public incrementEntered(): void {
    this.analytics.entered++;
    this.analytics.lastUpdated = new Date();
    this.updateConversionRate();
  }

  public incrementStarted(): void {
    this.analytics.started++;
    this.analytics.lastUpdated = new Date();
  }

  public incrementCompleted(timeTook?: number): void {
    this.analytics.completed++;
    if (timeTook !== undefined) {
      const currentTotal = this.analytics.avgTimeToComplete * (this.analytics.completed - 1);
      this.analytics.avgTimeToComplete = (currentTotal + timeTook) / this.analytics.completed;
    }
    this.analytics.lastUpdated = new Date();
    this.updateConversionRate();
  }

  public incrementFailed(): void {
    this.analytics.failed++;
    this.analytics.lastUpdated = new Date();
    this.updateConversionRate();
  }

  public incrementSkipped(): void {
    this.analytics.skipped++;
    this.analytics.lastUpdated = new Date();
    this.updateConversionRate();
  }

  private updateConversionRate(): void {
    if (this.analytics.entered > 0) {
      this.analytics.conversionRate = (this.analytics.completed / this.analytics.entered) * 100;
    }
  }

  public resetAnalytics(): void {
    this.analytics = this.initAnalytics();
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name.trim()) {
      errors.push('Step name is required');
    }

    if (this.type === 'action' && !this.actionType) {
      errors.push('Action step must have an action type');
    }

    if (this.actionConfig) {
      const actionErrors = this.validateActionConfig();
      errors.push(...actionErrors);
    }

    if (this.type === 'condition' && (!this.conditions || this.conditions.items.length === 0)) {
      errors.push('Condition step must have at least one condition');
    }

    if (this.type === 'split' && (!this.splitBranches || this.splitBranches.length === 0)) {
      errors.push('Split step must have at least one branch');
    }

    if (this.retryConfig.maxRetries < 0) {
      errors.push('Retry count cannot be negative');
    }

    if (this.retryConfig.retryDelay < 0) {
      errors.push('Retry delay cannot be negative');
    }

    if (this.timeout < 0) {
      errors.push('Timeout cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateActionConfig(): string[] {
    const errors: string[] = [];
    const config = this.actionConfig!;

    switch (config.type) {
      case 'email':
        if (!config.emailTemplate && !config.emailSubject) {
          errors.push('Email action requires template or subject');
        }
        break;
      case 'SMS':
        if (!config.smsTemplate) {
          errors.push('SMS action requires template');
        }
        break;
      case 'push':
        if (!config.pushTitle || !config.pushBody) {
          errors.push('Push notification action requires title and body');
        }
        break;
      case 'delay':
        if (!config.delayDuration && !config.delayUnit) {
          errors.push('Delay action requires duration and unit');
        }
        break;
      case 'webhook':
        if (!config.webhookUrl) {
          errors.push('Webhook action requires URL');
        }
        break;
    }

    return errors;
  }

  public getActionSummary(): string {
    if (!this.actionType || !this.actionConfig) {
      return 'No action configured';
    }

    switch (this.actionType) {
      case 'email':
        return `Send Email: ${this.actionConfig.emailSubject || 'Untitled'}`;
      case 'SMS':
        return `Send SMS: ${(this.actionConfig.smsTemplate || '').substring(0, 30)}...`;
      case 'push':
        return `Push: ${this.actionConfig.pushTitle}`;
      case 'delay':
        return `Delay: ${this.actionConfig.delayDuration} ${this.actionConfig.delayUnit}`;
      case 'condition':
        return `Condition: ${this.actionConfig.conditions?.length || 0} rules`;
      case 'webhook':
        return `Webhook: ${this.actionConfig.webhookUrl}`;
      default:
        return `Action: ${this.actionType}`;
    }
  }
}
