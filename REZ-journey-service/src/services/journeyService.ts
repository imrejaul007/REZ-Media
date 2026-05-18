import { Journey } from '../models/Journey';
import { Step } from '../models/Step';
import { JourneyEntry } from '../models/JourneyEntry';
import {
  ApiResponse,
  PaginatedResponse,
  JourneyAnalyticsSummary,
  JourneyTemplate,
  TriggerType,
  ActionType,
  ABVariant
} from '../types';
import { logger } from '../utils/logger';
import { defaultTemplates } from '../utils/templates';

/**
 * PERFORMANCE ISSUE: Unbounded In-Memory Storage (Lines 17-19)
 * ------------------------------------------
 * JourneyStore uses unbounded Map collections that grow indefinitely.
 *
 * Memory Risks:
 *   1. journeys Map: Grows with each created journey, never pruned
 *   2. entries Map: Grows with every journey entry, no TTL
 *   3. templates Map: Grows with custom templates, rarely pruned
 *
 * Operational Issues:
 *   - Restart = data loss (not persistent)
 *   - Memory grows unbounded in long-running processes
 *   - No cleanup of completed/exited entries
 *
 * Fix Approach (TTL & Size Limits Required):
 *   Option A: Add TTL to entries
 *   ```typescript
 *   private entriesTTLHours = 24; // Configurable
 *
 *   // On read: filter expired
 *   getEntry(id: string): JourneyEntry | undefined {
 *     const entry = this.entries.get(id);
 *     if (entry && Date.now() - entry.createdAt.getTime() > this.entriesTTLHours * 3600000) {
 *       this.entries.delete(id);
 *       return undefined;
 *     }
 *     return entry;
 *   }
 *   ```
 *
 *   Option B: Background cleanup job
 *   ```typescript
 *   // Run every hour
 *   setInterval(() => {
 *     const cutoff = Date.now() - this.entriesTTLHours * 3600000;
 *     for (const [id, entry] of this.entries) {
 *       if (entry.completedAt && entry.completedAt.getTime() < cutoff) {
 *         this.entries.delete(id);
 *       }
 *     }
 *   }, 3600000);
 *   ```
 *
 *   Option C: Move to persistent storage (recommended for production)
 *   - Use MongoDB with TTL indexes on entries
 *   - Add compound indexes for common queries
 *   - Use cursor-based pagination for large result sets
 *
 * Required MongoDB Indexes for Entry Collection:
 *   - { journeyId: 1, status: 1 } - Active entries by journey
 *   - { contactId: 1, status: 1 } - Contact's active journeys
 *   - { createdAt: 1 } with expireAfterSeconds - TTL for completed entries
 */
// In-memory storage (in production, use a database)
class JourneyStore {
  private journeys: Map<string, Journey> = new Map();
  private entries: Map<string, JourneyEntry> = new Map();
  private templates: Map<string, JourneyTemplate> = new Map();

  // Journey operations
  saveJourney(journey: Journey): void {
    this.journeys.set(journey.id, journey);
  }

  getJourney(id: string): Journey | undefined {
    return this.journeys.get(id);
  }

  getAllJourneys(): Journey[] {
    return Array.from(this.journeys.values());
  }

  deleteJourney(id: string): boolean {
    return this.journeys.delete(id);
  }

  getActiveJourneys(): Journey[] {
    return this.getAllJourneys().filter(j => j.status === 'active');
  }

  // Entry operations
  saveEntry(entry: JourneyEntry): void {
    this.entries.set(entry.id, entry);
  }

  getEntry(id: string): JourneyEntry | undefined {
    return this.entries.get(id);
  }

  getEntriesByJourney(journeyId: string): JourneyEntry[] {
    return Array.from(this.entries.values()).filter(e => e.journeyId === journeyId);
  }

  getEntriesByContact(contactId: string): JourneyEntry[] {
    return Array.from(this.entries.values()).filter(e => e.contactId === contactId);
  }

  deleteEntry(id: string): boolean {
    return this.entries.delete(id);
  }

  // Template operations
  saveTemplate(template: JourneyTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): JourneyTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): JourneyTemplate[] {
    return Array.from(this.templates.values());
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }
}

export const store = new JourneyStore();

// Initialize with default templates
const initializeDefaults = (): void => {
  for (const template of defaultTemplates) {
    store.saveTemplate(template);
  }
  logger.info(`Initialized ${defaultTemplates.length} default journey templates`);
};
initializeDefaults();

// Event emitter for worker communication
type JourneyEventType = 'entry:created' | 'entry:updated' | 'entry:completed' | 'step:processed';
type JourneyEventListener = (data: unknown) => void;

class EventEmitter {
  private listeners: Map<JourneyEventType, JourneyEventListener[]> = new Map();

  on(event: JourneyEventType, listener: JourneyEventListener): void {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  off(event: JourneyEventType, listener: JourneyEventListener): void {
    const listeners = this.listeners.get(event) || [];
    this.listeners.set(event, listeners.filter(l => l !== listener));
  }

  emit(event: JourneyEventType, data: unknown): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }
}

export const eventEmitter = new EventEmitter();

export class JourneyService {
  // ==================== Journey CRUD ====================

  async createJourney(data: {
    name: string;
    description?: string;
    trigger?: Journey['trigger'];
    tags?: string[];
  }): Promise<ApiResponse<Journey>> {
    try {
      const journey = new Journey({
        name: data.name,
        description: data.description || '',
        trigger: data.trigger || { type: 'signup' },
        tags: data.tags || []
      });

      store.saveJourney(journey);
      logger.info(`Journey created: ${journey.id}`);

      return {
        success: true,
        data: journey,
        message: 'Journey created successfully'
      };
    } catch (error) {
      logger.error('Failed to create journey', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getJourney(id: string): Promise<ApiResponse<Journey>> {
    const journey = store.getJourney(id);
    if (!journey) {
      return {
        success: false,
        error: 'Journey not found'
      };
    }
    return {
      success: true,
      data: journey
    };
  }

  async listJourneys(params: {
    status?: Journey['status'];
    page?: number;
    limit?: number;
    tags?: string[];
  }): Promise<PaginatedResponse<Journey>> {
    const { status, page = 1, limit = 10, tags } = params;

    let journeys = store.getAllJourneys();

    // Filter by status
    if (status) {
      journeys = journeys.filter(j => j.status === status);
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      journeys = journeys.filter(j => tags.some(tag => j.tags.includes(tag)));
    }

    // Sort by updatedAt descending
    journeys.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const total = journeys.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    return {
      success: true,
      data: journeys.slice(offset, offset + limit),
      pagination: { page, limit, total, totalPages }
    };
  }

  async updateJourney(id: string, updates: Partial<Journey>): Promise<ApiResponse<Journey>> {
    const journey = store.getJourney(id);
    if (!journey) {
      return {
        success: false,
        error: 'Journey not found'
      };
    }

    if (journey.status === 'active') {
      return {
        success: false,
        error: 'Cannot update active journey. Pause it first.'
      };
    }

    try {
      if (updates.name !== undefined) journey.name = updates.name;
      if (updates.description !== undefined) journey.description = updates.description;
      if (updates.trigger !== undefined) journey.trigger = updates.trigger;
      if (updates.tags !== undefined) journey.tags = updates.tags;
      if (updates.abTest !== undefined) journey.abTest = updates.abTest;

      journey.updatedAt = new Date();
      store.saveJourney(journey);

      logger.info(`Journey updated: ${id}`);
      return {
        success: true,
        data: journey
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteJourney(id: string): Promise<ApiResponse<void>> {
    const journey = store.getJourney(id);
    if (!journey) {
      return {
        success: false,
        error: 'Journey not found'
      };
    }

    if (journey.status === 'active') {
      return {
        success: false,
        error: 'Cannot delete active journey. Pause it first.'
      };
    }

    store.deleteJourney(id);
    logger.info(`Journey deleted: ${id}`);

    return {
      success: true,
      message: 'Journey deleted successfully'
    };
  }

  // ==================== Step Management ====================

  async addStep(journeyId: string, stepData: Partial<Step>): Promise<ApiResponse<Step>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    try {
      const step = new Step({
        ...stepData,
        id: stepData.id || undefined // Let Step generate ID
      });
      journey.addStep(step);
      store.saveJourney(journey);

      logger.info(`Step added to journey ${journeyId}: ${step.id}`);
      return { success: true, data: step };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateStep(journeyId: string, stepId: string, updates: Partial<Step>): Promise<ApiResponse<Step>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    const step = journey.getStep(stepId);
    if (!step) {
      return { success: false, error: 'Step not found' };
    }

    try {
      journey.updateStep(stepId, updates);
      store.saveJourney(journey);

      logger.info(`Step updated: ${stepId} in journey ${journeyId}`);
      return { success: true, data: journey.getStep(stepId)! };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async removeStep(journeyId: string, stepId: string): Promise<ApiResponse<void>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    journey.removeStep(stepId);
    store.saveJourney(journey);

    logger.info(`Step removed: ${stepId} from journey ${journeyId}`);
    return { success: true, message: 'Step removed successfully' };
  }

  async connectSteps(journeyId: string, fromStepId: string, toStepId: string, type: 'next' | 'error' = 'next'): Promise<ApiResponse<void>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    journey.connectSteps(fromStepId, toStepId, type);
    store.saveJourney(journey);

    return { success: true, message: 'Steps connected successfully' };
  }

  async reorderSteps(journeyId: string, stepOrder: string[]): Promise<ApiResponse<void>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    const reorderedSteps = stepOrder
      .map(id => journey.getStep(id))
      .filter((s): s is Step => s !== undefined);

    journey.steps = reorderedSteps;
    journey.updatedAt = new Date();
    store.saveJourney(journey);

    return { success: true, message: 'Steps reordered successfully' };
  }

  // ==================== Journey Lifecycle ====================

  async activateJourney(id: string): Promise<ApiResponse<Journey>> {
    const journey = store.getJourney(id);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    if (journey.status === 'active') {
      return { success: false, error: 'Journey is already active' };
    }

    // Validate journey before activation
    const validation = journey.validate();
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    try {
      journey.activate();
      store.saveJourney(journey);

      logger.info(`Journey activated: ${id}`);
      return { success: true, data: journey, message: 'Journey activated successfully' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async pauseJourney(id: string): Promise<ApiResponse<Journey>> {
    const journey = store.getJourney(id);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    try {
      journey.pause();
      store.saveJourney(journey);

      logger.info(`Journey paused: ${id}`);
      return { success: true, data: journey, message: 'Journey paused successfully' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async resumeJourney(id: string): Promise<ApiResponse<Journey>> {
    const journey = store.getJourney(id);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    try {
      journey.resume();
      store.saveJourney(journey);

      logger.info(`Journey resumed: ${id}`);
      return { success: true, data: journey, message: 'Journey resumed successfully' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async archiveJourney(id: string): Promise<ApiResponse<Journey>> {
    const journey = store.getJourney(id);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    journey.archive();
    store.saveJourney(journey);

    logger.info(`Journey archived: ${id}`);
    return { success: true, data: journey, message: 'Journey archived successfully' };
  }

  // ==================== Entry Management ====================

  async enterJourney(journeyId: string, contactId: string, contactData?: Record<string, unknown>): Promise<ApiResponse<JourneyEntry>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    if (journey.status !== 'active') {
      return { success: false, error: 'Journey is not active' };
    }

    // Check if contact already has an active entry
    const existingEntries = store.getEntriesByContact(contactId)
      .filter(e => e.journeyId === journeyId && e.status === 'entered');
    if (existingEntries.length > 0) {
      return { success: false, error: 'Contact already has an active entry in this journey' };
    }

    const variant = journey.selectABVariant();
    const entryStepId = journey.abTest.enabled
      ? journey.getABStepsForVariant(variant)[0]?.id || journey.entryStepId
      : journey.entryStepId;

    const entry = new JourneyEntry({
      journeyId,
      contactId,
      contactEmail: contactData?.email as string | undefined,
      entryStepId,
      variant,
      contactData
    });

    store.saveEntry(entry);

    // Update journey analytics
    journey.analytics.totalEntries++;
    journey.analytics.activeEntries++;
    journey.analytics.lastUpdated = new Date();
    store.saveJourney(journey);

    eventEmitter.emit('entry:created', { entryId: entry.id, journeyId, contactId });

    logger.info(`Entry created: ${entry.id} for contact ${contactId} in journey ${journeyId}`);
    return { success: true, data: entry, message: 'Contact entered journey successfully' };
  }

  async getEntry(id: string): Promise<ApiResponse<JourneyEntry>> {
    const entry = store.getEntry(id);
    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }
    return { success: true, data: entry };
  }

  async getJourneyEntries(journeyId: string, params: { status?: JourneyEntry['status']; page?: number; limit?: number } = {}): Promise<PaginatedResponse<JourneyEntry>> {
    const { status, page = 1, limit = 10 } = params;

    let entries = store.getEntriesByJourney(journeyId);

    if (status) {
      entries = entries.filter(e => e.status === status);
    }

    entries.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const total = entries.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    return {
      success: true,
      data: entries.slice(offset, offset + limit),
      pagination: { page, limit, total, totalPages }
    };
  }

  async exitEntry(entryId: string, reason: string): Promise<ApiResponse<void>> {
    const entry = store.getEntry(entryId);
    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }

    const journey = store.getJourney(entry.journeyId);
    if (journey) {
      journey.analytics.activeEntries--;
      if (entry.status === 'entered') {
        journey.analytics.activeEntries--;
      }
      if (entry.status === 'completed' || entry.status === 'exited') {
        // Already counted
      }
      store.saveJourney(journey);
    }

    entry.exit(reason);
    store.saveEntry(entry);

    eventEmitter.emit('entry:updated', { entryId, reason });

    return { success: true, message: 'Entry exited successfully' };
  }

  // ==================== A/B Testing ====================

  async configureABTest(journeyId: string, config: Journey['abTest']): Promise<ApiResponse<void>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    try {
      journey.configureABTest(config);
      store.saveJourney(journey);

      return { success: true, message: 'A/B test configured successfully' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getABTestResults(journeyId: string): Promise<ApiResponse<JourneyAnalyticsSummary['abTestResults']>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    if (!journey.abTest.enabled) {
      return { success: true, data: undefined, message: 'A/B testing is not enabled' };
    }

    const entries = store.getEntriesByJourney(journeyId);
    const results = journey.abTest.variants.map(variant => {
      const variantEntries = entries.filter(e => e.variant === variant.variant);
      const completedEntries = variantEntries.filter(e => e.status === 'completed');

      return {
        variant: variant.variant,
        entries: variantEntries.length,
        conversions: completedEntries.length,
        conversionRate: variantEntries.length > 0
          ? (completedEntries.length / variantEntries.length) * 100
          : 0
      };
    });

    return { success: true, data: results };
  }

  // ==================== Analytics ====================

  async getJourneyAnalytics(journeyId: string): Promise<ApiResponse<JourneyAnalyticsSummary>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    const entries = store.getEntriesByJourney(journeyId);

    // Recalculate analytics
    const activeEntries = entries.filter(e => e.status === 'entered').length;
    const completedEntries = entries.filter(e => e.status === 'completed').length;
    const failedEntries = entries.filter(e => e.status === 'failed').length;

    const conversionRate = entries.length > 0
      ? (completedEntries / entries.length) * 100
      : 0;

    const completedWithTime = entries.filter(e => e.completedAt);
    const avgCompletionTime = completedWithTime.length > 0
      ? completedWithTime.reduce((sum, e) => sum + e.getTimeSpent(), 0) / completedWithTime.length
      : 0;

    // Calculate step analytics
    const stepAnalytics = journey.steps.map(step => {
      const stepEntries = entries.filter(e =>
        e.progress.some(p => p.stepId === step.id)
      );
      const completedSteps = entries.filter(e =>
        e.progress.some(p => p.stepId === step.id && p.status === 'completed')
      );

      return {
        stepId: step.id,
        entered: stepEntries.length,
        started: stepEntries.filter(e =>
          e.progress.some(p => p.stepId === step.id && ['entered', 'in_progress'].includes(p.status))
        ).length,
        completed: completedSteps.length,
        failed: entries.filter(e =>
          e.progress.some(p => p.stepId === step.id && p.status === 'failed')
        ).length,
        skipped: entries.filter(e =>
          e.progress.some(p => p.stepId === step.id && p.status === 'skipped')
        ).length,
        avgTimeToComplete: 0, // Calculate from step progress
        conversionRate: stepEntries.length > 0
          ? (completedSteps.length / stepEntries.length) * 100
          : 0,
        lastUpdated: new Date()
      };
    });

    const analytics: JourneyAnalyticsSummary = {
      journeyId,
      totalEntries: entries.length,
      activeEntries,
      completedEntries,
      failedEntries,
      conversionRate,
      avgCompletionTime,
      stepAnalytics,
      lastUpdated: new Date()
    };

    return { success: true, data: analytics };
  }

  async getStepAnalytics(journeyId: string, stepId: string): Promise<ApiResponse<Journey['analytics']['stepAnalytics'][0]>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    const stepAnalytics = journey.getStepAnalytics(stepId);
    if (!stepAnalytics) {
      return { success: false, error: 'Step analytics not found' };
    }

    return { success: true, data: stepAnalytics };
  }

  // ==================== Templates ====================

  async createTemplate(journeyId: string, templateData: {
    name: string;
    description: string;
    category: string;
    tags: string[];
  }): Promise<ApiResponse<JourneyTemplate>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    const template: JourneyTemplate = {
      id: `template_${Date.now()}`,
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      tags: templateData.tags,
      journey: {
        name: journey.name,
        description: journey.description,
        trigger: journey.trigger,
        steps: journey.steps.map(s => new Step(s.toJSON() as Partial<Step>)),
        entryStepId: journey.entryStepId,
        abTest: journey.abTest
      }
    };

    store.saveTemplate(template);

    return { success: true, data: template, message: 'Template created successfully' };
  }

  async listTemplates(params: { category?: string; tags?: string[] } = {}): Promise<PaginatedResponse<JourneyTemplate>> {
    let templates = store.getAllTemplates();

    if (params.category) {
      templates = templates.filter(t => t.category === params.category);
    }

    if (params.tags && params.tags.length > 0) {
      templates = templates.filter(t => params.tags!.some(tag => t.tags.includes(tag)));
    }

    return {
      success: true,
      data: templates,
      pagination: { page: 1, limit: templates.length, total: templates.length, totalPages: 1 }
    };
  }

  async createFromTemplate(templateId: string, name: string): Promise<ApiResponse<Journey>> {
    const template = store.getTemplate(templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    try {
      const newJourney = new Journey({
        name,
        description: template.description,
        trigger: { ...template.journey.trigger },
        steps: template.journey.steps.map(s => new Step(s.toJSON() as Partial<Step>)),
        entryStepId: template.journey.entryStepId,
        tags: [...template.tags]
      });

      store.saveJourney(newJourney);

      return { success: true, data: newJourney, message: 'Journey created from template' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteTemplate(templateId: string): Promise<ApiResponse<void>> {
    const deleted = store.deleteTemplate(templateId);
    if (!deleted) {
      return { success: false, error: 'Template not found' };
    }
    return { success: true, message: 'Template deleted successfully' };
  }

  // ==================== Trigger Events ====================

  async processTrigger(triggerType: TriggerType, contactId: string, contactData: Record<string, unknown>): Promise<ApiResponse<void>> {
    const journeys = store.getActiveJourneys();

    for (const journey of journeys) {
      if (journey.trigger.type !== triggerType) continue;

      // Check trigger conditions
      if (journey.trigger.conditions && journey.trigger.conditions.length > 0) {
        const matches = journey.trigger.conditions.every(condition => {
          const value = contactData[condition.field];
          switch (condition.operator) {
            case 'equals':
              return value === condition.value;
            case 'not_equals':
              return value !== condition.value;
            case 'contains':
              return String(value).includes(String(condition.value));
            case 'not_contains':
              return !String(value).includes(String(condition.value));
            case 'greater_than':
              return Number(value) > Number(condition.value);
            case 'less_than':
              return Number(value) < Number(condition.value);
            case 'in':
              return Array.isArray(condition.value) && condition.value.includes(value);
            case 'not_in':
              return Array.isArray(condition.value) && !condition.value.includes(value);
            default:
              return false;
          }
        });

        if (!matches) continue;
      }

      // Enter the journey
      await this.enterJourney(journey.id, contactId, contactData);
    }

    return { success: true };
  }

  // ==================== Visual Builder ====================

  async getJourneyCanvas(journeyId: string): Promise<ApiResponse<{
    nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: unknown }>;
    edges: Array<{ from: string; to: string; type: 'next' | 'error' }>;
  }>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    const nodes = journey.steps.map(step => ({
      id: step.id,
      type: step.type,
      position: step.position,
      data: {
        name: step.name,
        description: step.description,
        actionType: step.actionType,
        actionConfig: step.actionConfig,
        status: step.status
      }
    }));

    const edges: Array<{ from: string; to: string; type: 'next' | 'error' }> = [];
    journey.steps.forEach(step => {
      if (step.nextStepId) {
        edges.push({ from: step.id, to: step.nextStepId, type: 'next' });
      }
      if (step.errorStepId) {
        edges.push({ from: step.id, to: step.errorStepId, type: 'error' });
      }
    });

    return { success: true, data: { nodes, edges } };
  }

  async updateCanvasPosition(journeyId: string, stepId: string, position: { x: number; y: number }): Promise<ApiResponse<void>> {
    const journey = store.getJourney(journeyId);
    if (!journey) {
      return { success: false, error: 'Journey not found' };
    }

    const step = journey.getStep(stepId);
    if (!step) {
      return { success: false, error: 'Step not found' };
    }

    step.setPosition(position.x, position.y);
    store.saveJourney(journey);

    return { success: true };
  }
}

export const journeyService = new JourneyService();
