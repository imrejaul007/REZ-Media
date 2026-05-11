import { v4 as uuidv4 } from 'uuid';
import {
  JourneyStatus,
  TriggerConfig,
  ABTestConfig,
  StepAnalytics,
  JourneyAnalyticsSummary
} from '../types';
import { Step } from './Step';

export class Journey {
  public readonly id: string;
  public name: string;
  public description: string;
  public status: JourneyStatus;
  public trigger: TriggerConfig;
  public steps: Step[];
  public entryStepId: string;
  public abTest: ABTestConfig;
  public tags: string[];
  public createdAt: Date;
  public updatedAt: Date;
  public analytics: JourneyAnalyticsSummary;
  public isTemplate: boolean;
  public templateName?: string;

  constructor(data?: Partial<Journey>) {
    this.id = data?.id || uuidv4();
    this.name = data?.name || 'New Journey';
    this.description = data?.description || '';
    this.status = data?.status || 'draft';
    this.trigger = data?.trigger || {
      type: 'signup',
      conditions: []
    };
    this.steps = data?.steps || [];
    this.entryStepId = data?.entryStepId || '';
    this.abTest = data?.abTest || {
      enabled: false,
      variants: []
    };
    this.tags = data?.tags || [];
    this.createdAt = data?.createdAt || new Date();
    this.updatedAt = data?.updatedAt || new Date();
    this.analytics = data?.analytics || this.initAnalytics();
    this.isTemplate = data?.isTemplate || false;
    this.templateName = data?.templateName;
  }

  private initAnalytics(): JourneyAnalyticsSummary {
    return {
      journeyId: this.id,
      totalEntries: 0,
      activeEntries: 0,
      completedEntries: 0,
      failedEntries: 0,
      conversionRate: 0,
      avgCompletionTime: 0,
      stepAnalytics: [],
      lastUpdated: new Date()
    };
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this.status,
      trigger: this.trigger,
      steps: this.steps.map(s => s.toJSON()),
      entryStepId: this.entryStepId,
      abTest: this.abTest,
      tags: this.tags,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      analytics: {
        ...this.analytics,
        lastUpdated: this.analytics.lastUpdated.toISOString()
      },
      isTemplate: this.isTemplate,
      templateName: this.templateName
    };
  }

  public static fromJSON(json: Record<string, unknown>): Journey {
    const steps = (json.steps as Record<string, unknown>[] || []).map(s => Step.fromJSON(s));
    const entryStepId = (json.entryStepId as string) || (steps[0]?.id || '');

    return new Journey({
      id: json.id as string,
      name: json.name as string,
      description: json.description as string,
      status: json.status as JourneyStatus,
      trigger: json.trigger as TriggerConfig,
      steps: steps,
      entryStepId: entryStepId,
      abTest: json.abTest as ABTestConfig,
      tags: json.tags as string[],
      createdAt: new Date(json.createdAt as string),
      updatedAt: new Date(json.updatedAt as string),
      analytics: json.analytics ? {
        ...json.analytics as JourneyAnalyticsSummary,
        lastUpdated: new Date((json.analytics as JourneyAnalyticsSummary).lastUpdated)
      } : undefined,
      isTemplate: json.isTemplate as boolean,
      templateName: json.templateName as string
    });
  }

  public addStep(step: Step): void {
    this.steps.push(step);
    if (!this.entryStepId && step.type === 'entry') {
      this.entryStepId = step.id;
    }
    this.updatedAt = new Date();
  }

  public removeStep(stepId: string): void {
    this.steps = this.steps.filter(s => s.id !== stepId);
    // Update connections that reference this step
    this.steps.forEach(step => {
      if (step.nextStepId === stepId) {
        step.nextStepId = '';
      }
      if (step.errorStepId === stepId) {
        step.errorStepId = '';
      }
    });
    this.updatedAt = new Date();
  }

  public getStep(stepId: string): Step | undefined {
    return this.steps.find(s => s.id === stepId);
  }

  public updateStep(stepId: string, updates: Partial<Step>): void {
    const index = this.steps.findIndex(s => s.id === stepId);
    if (index !== -1) {
      const existing = this.steps[index];
      this.steps[index] = new Step({
        ...existing,
        ...updates,
        id: stepId // Ensure ID cannot be changed
      });
      this.updatedAt = new Date();
    }
  }

  public connectSteps(fromStepId: string, toStepId: string, type: 'next' | 'error' = 'next'): void {
    const fromStep = this.getStep(fromStepId);
    if (fromStep) {
      if (type === 'next') {
        fromStep.nextStepId = toStepId;
      } else {
        fromStep.errorStepId = toStepId;
      }
      this.updatedAt = new Date();
    }
  }

  public activate(): void {
    if (this.steps.length === 0) {
      throw new Error('Cannot activate journey without steps');
    }
    if (!this.entryStepId) {
      throw new Error('Cannot activate journey without entry step');
    }
    this.status = 'active';
    this.updatedAt = new Date();
  }

  public pause(): void {
    if (this.status !== 'active') {
      throw new Error('Can only pause active journeys');
    }
    this.status = 'paused';
    this.updatedAt = new Date();
  }

  public resume(): void {
    if (this.status !== 'paused') {
      throw new Error('Can only resume paused journeys');
    }
    this.status = 'active';
    this.updatedAt = new Date();
  }

  public archive(): void {
    this.status = 'archived';
    this.updatedAt = new Date();
  }

  public updateAnalytics(analytics: Partial<JourneyAnalyticsSummary>): void {
    this.analytics = {
      ...this.analytics,
      ...analytics,
      lastUpdated: new Date()
    };
    this.updatedAt = new Date();
  }

  public getStepAnalytics(stepId: string): StepAnalytics | undefined {
    return this.analytics.stepAnalytics.find(sa => sa.stepId === stepId);
  }

  public updateStepAnalytics(stepId: string, analytics: Partial<StepAnalytics>): void {
    const index = this.analytics.stepAnalytics.findIndex(sa => sa.stepId === stepId);
    if (index !== -1) {
      this.analytics.stepAnalytics[index] = {
        ...this.analytics.stepAnalytics[index],
        ...analytics
      };
    } else {
      this.analytics.stepAnalytics.push({
        stepId,
        entered: 0,
        started: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        avgTimeToComplete: 0,
        conversionRate: 0,
        lastUpdated: new Date(),
        ...analytics
      });
    }
    this.analytics.lastUpdated = new Date();
    this.updatedAt = new Date();
  }

  public configureABTest(config: ABTestConfig): void {
    // Validate weights sum to 100
    const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new Error(`A/B test weights must sum to 100, got ${totalWeight}`);
    }
    this.abTest = config;
    this.updatedAt = new Date();
  }

  public selectABVariant(): ABVariant {
    if (!this.abTest.enabled || this.abTest.variants.length === 0) {
      return 'A';
    }
    const random = Math.random() * 100;
    let cumulative = 0;
    for (const variant of this.abTest.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant.variant;
      }
    }
    return 'A';
  }

  public getABStepsForVariant(variant: ABVariant): Step[] {
    if (!this.abTest.enabled) {
      return this.steps;
    }
    const variantConfig = this.abTest.variants.find(v => v.variant === variant);
    if (!variantConfig) {
      return this.steps;
    }
    return this.steps.filter(s => variantConfig.stepIds.includes(s.id));
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name.trim()) {
      errors.push('Journey name is required');
    }

    if (this.steps.length === 0) {
      errors.push('Journey must have at least one step');
    }

    if (!this.entryStepId && this.steps.length > 0) {
      errors.push('Journey must have an entry step');
    }

    // Validate step references
    for (const step of this.steps) {
      if (step.nextStepId && !this.getStep(step.nextStepId)) {
        errors.push(`Step "${step.name}" references non-existent next step`);
      }
      if (step.errorStepId && !this.getStep(step.errorStepId)) {
        errors.push(`Step "${step.name}" references non-existent error step`);
      }
    }

    // Check for circular references
    if (this.hasCircularReferences()) {
      errors.push('Journey contains circular step references');
    }

    // Validate A/B test config
    if (this.abTest.enabled) {
      const totalWeight = this.abTest.variants.reduce((sum, v) => sum + v.weight, 0);
      if (totalWeight !== 100) {
        errors.push(`A/B test weights must sum to 100, got ${totalWeight}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private hasCircularReferences(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = this.getStep(stepId);
      if (!step) return false;

      const nextSteps = [step.nextStepId, step.errorStepId].filter(Boolean);
      for (const nextId of nextSteps) {
        if (!visited.has(nextId)) {
          if (dfs(nextId)) return true;
        } else if (recursionStack.has(nextId)) {
          return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    return dfs(this.entryStepId);
  }

  public clone(newName?: string): Journey {
    const clonedSteps = this.steps.map(step => {
      const clonedStep = step.clone();
      // Generate new IDs for cloned steps
      return new Step({
        ...clonedStep,
        id: uuidv4()
      });
    });

    // Create ID mapping for updating references
    const idMapping = new Map<string, string>();
    this.steps.forEach((step, index) => {
      idMapping.set(step.id, clonedSteps[index].id);
    });

    // Update references in cloned steps
    clonedSteps.forEach((step, index) => {
      const originalStep = this.steps[index];
      if (step.nextStepId && idMapping.has(originalStep.nextStepId)) {
        step.nextStepId = idMapping.get(originalStep.nextStepId)!;
      }
      if (step.errorStepId && idMapping.has(originalStep.errorStepId)) {
        step.errorStepId = idMapping.get(originalStep.errorStepId)!;
      }
    });

    const newEntryStepId = this.entryStepId ? (idMapping.get(this.entryStepId) || '') : '';

    return new Journey({
      name: newName || `${this.name} (Copy)`,
      description: this.description,
      trigger: JSON.parse(JSON.stringify(this.trigger)),
      steps: clonedSteps,
      entryStepId: newEntryStepId,
      abTest: {
        enabled: false,
        variants: []
      },
      tags: [...this.tags],
      isTemplate: false
    });
  }

  public toTemplate(templateName: string, description: string, category: string, tags: string[]): Journey {
    const template = this.clone();
    template.isTemplate = true;
    template.templateName = templateName;
    template.description = description;
    template.tags = tags;
    template.status = 'draft';
    return template;
  }
}
