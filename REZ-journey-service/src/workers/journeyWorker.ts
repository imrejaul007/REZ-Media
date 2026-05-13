import { store, eventEmitter } from '../services/journeyService';
import { Journey } from '../models/Journey';
import { Step } from '../models/Step';
import { JourneyEntry } from '../models/JourneyEntry';
import { ActionType, WorkerEvent, AICheckConfig, AICheckContext } from '../types';
import { aiCheckService } from '../services/aiCheckService';
import { logger } from '../utils/logger';

// Action executors
interface ActionExecutor {
  execute(
    actionConfig: Step['actionConfig'],
    contactData: Record<string, unknown>,
    entryData: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }>;
}

class EmailActionExecutor implements ActionExecutor {
  async execute(
    actionConfig: Step['actionConfig'],
    contactData: Record<string, unknown>,
    entryData: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { emailTemplate, emailSubject, emailFrom } = actionConfig!;

    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    const emailData = {
      to: contactData.email,
      from: emailFrom || 'noreply@example.com',
      subject: emailSubject || 'Journey Email',
      body: this.interpolateTemplate(emailTemplate || '', { ...contactData, ...entryData }),
      sentAt: new Date().toISOString()
    };

    logger.info('Email action executed', { emailData });

    // Simulate email sending
    return { success: true, data: { messageId: `email_${Date.now()}`, ...emailData } };
  }

  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return String(data[key] ?? match);
    });
  }
}

class SMSActionExecutor implements ActionExecutor {
  async execute(
    actionConfig: Step['actionConfig'],
    contactData: Record<string, unknown>,
    entryData: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { smsTemplate, smsFrom } = actionConfig!;

    // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
    const smsData = {
      to: contactData.phone,
      from: smsFrom || ' JOURNEY',
      body: this.interpolateTemplate(smsTemplate || '', { ...contactData, ...entryData }),
      sentAt: new Date().toISOString()
    };

    logger.info('SMS action executed', { smsData });

    return { success: true, data: { messageId: `sms_${Date.now()}`, ...smsData } };
  }

  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return String(data[key] ?? match);
    });
  }
}

class PushActionExecutor implements ActionExecutor {
  async execute(
    actionConfig: Step['actionConfig'],
    contactData: Record<string, unknown>,
    entryData: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { pushTitle, pushBody, pushData } = actionConfig!;

    // In production, integrate with push notification service (Firebase, APNs, etc.)
    const pushPayload = {
      to: contactData.deviceToken,
      notification: {
        title: pushTitle,
        body: pushBody
      },
      data: pushData || {},
      sentAt: new Date().toISOString()
    };

    logger.info('Push notification action executed', { pushPayload });

    return { success: true, data: { messageId: `push_${Date.now()}`, ...pushPayload } };
  }
}

class DelayActionExecutor implements ActionExecutor {
  async execute(
    actionConfig: Step['actionConfig'],
    _contactData: Record<string, unknown>,
    _entryData: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { delayDuration, delayUnit } = actionConfig!;

    let delayMs = delayDuration || 0;
    switch (delayUnit) {
      case 'seconds':
        delayMs *= 1000;
        break;
      case 'minutes':
        delayMs *= 60 * 1000;
        break;
      case 'hours':
        delayMs *= 60 * 60 * 1000;
        break;
      case 'days':
        delayMs *= 24 * 60 * 60 * 1000;
        break;
    }

    logger.info('Delay action executed', { duration: delayMs });

    return { success: true, data: { delayMs, unit: delayUnit } };
  }
}

class WebhookActionExecutor implements ActionExecutor {
  async execute(
    actionConfig: Step['actionConfig'],
    contactData: Record<string, unknown>,
    entryData: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { webhookUrl, webhookMethod, webhookHeaders, webhookBody } = actionConfig!;

    // In production, make actual HTTP request
    const requestData = {
      url: webhookUrl,
      method: webhookMethod || 'POST',
      headers: webhookHeaders || { 'Content-Type': 'application/json' },
      body: this.interpolateObject(webhookBody || {}, { contact: contactData, entry: entryData }),
      timestamp: new Date().toISOString()
    };

    logger.info('Webhook action executed', { requestData });

    // Simulate webhook call
    return { success: true, data: { statusCode: 200, response: 'OK' } };
  }

  private interpolateObject(obj: Record<string, unknown>, data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = value.replace(/\{\{(\w+)\}\}/g, (match, path) => {
          const parts = path.split('.');
          let val: unknown = data;
          for (const part of parts) {
            val = (val as Record<string, unknown>)?.[part];
          }
          return String(val ?? match);
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateObject(value as Record<string, unknown>, data);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

class ConditionActionExecutor implements ActionExecutor {
  async execute(
    actionConfig: Step['actionConfig'],
    contactData: Record<string, unknown>,
    _entryData: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { conditions } = actionConfig!;

    if (!conditions || conditions.length === 0) {
      return { success: true, data: { branch: 'true' } };
    }

    const results = conditions.map(condition => {
      const value = contactData[condition.field];
      let matches = false;

      switch (condition.operator) {
        case 'equals':
          matches = value === condition.value;
          break;
        case 'not_equals':
          matches = value !== condition.value;
          break;
        case 'contains':
          matches = String(value).includes(String(condition.value));
          break;
        case 'not_contains':
          matches = !String(value).includes(String(condition.value));
          break;
        case 'greater_than':
          matches = Number(value) > Number(condition.value);
          break;
        case 'less_than':
          matches = Number(value) < Number(condition.value);
          break;
        case 'in':
          matches = Array.isArray(condition.value) && (condition.value as unknown[]).includes(value);
          break;
        case 'not_in':
          matches = !Array.isArray(condition.value) || !(condition.value as unknown[]).includes(value);
          break;
      }

      return matches;
    });

    const branch = results.every(r => r) ? 'true' : 'false';

    logger.info('Condition evaluated', { conditions: results, branch });

    return { success: true, data: { branch } };
  }
}

// Action executor registry
const actionExecutors: Record<ActionType, ActionExecutor> = {
  email: new EmailActionExecutor(),
  SMS: new SMSActionExecutor(),
  push: new PushActionExecutor(),
  delay: new DelayActionExecutor(),
  webhook: new WebhookActionExecutor(),
  condition: new ConditionActionExecutor()
};

// Job queue for delayed processing
interface DelayedJob {
  id: string;
  entryId: string;
  stepId: string;
  executeAt: Date;
  data: unknown;
}

export class JourneyWorker {
  private isRunning: boolean = false;
  private processingQueue: Set<string> = new Set();
  private delayedJobs: Map<string, NodeJS.Timeout> = new Map();
  private workerEvents: WorkerEvent[] = [];

  constructor() {
    // Subscribe to entry events
    eventEmitter.on('entry:created', (data) => this.handleEntryCreated(data));
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Journey worker started');

    // Start processing any pending entries
    this.processPendingEntries();
  }

  public stop(): void {
    this.isRunning = false;

    // Clear all delayed jobs
    this.delayedJobs.forEach(timeout => clearTimeout(timeout));
    this.delayedJobs.clear();

    logger.info('Journey worker stopped');
  }

  private async handleEntryCreated(data: unknown): Promise<void> {
    const { entryId } = data as { entryId: string };
    await this.processEntry(entryId);
  }

  private async processPendingEntries(): Promise<void> {
    const entries = Array.from(store['entries'].values())
      .filter(e => e.status === 'entered');

    for (const entry of entries) {
      if (!this.processingQueue.has(entry.id)) {
        this.processEntry(entry.id);
      }
    }
  }

  public async processEntry(entryId: string): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Worker is not running, skipping entry processing');
      return;
    }

    if (this.processingQueue.has(entryId)) {
      logger.debug(`Entry ${entryId} is already being processed`);
      return;
    }

    this.processingQueue.add(entryId);

    try {
      const entry = store.getEntry(entryId);
      if (!entry) {
        logger.error(`Entry not found: ${entryId}`);
        return;
      }

      const journey = store.getJourney(entry.journeyId);
      if (!journey) {
        logger.error(`Journey not found: ${entry.journeyId}`);
        entry.fail('Journey not found');
        store.saveEntry(entry);
        return;
      }

      if (journey.status !== 'active') {
        logger.info(`Journey is not active, skipping entry ${entryId}`);
        entry.exit('Journey not active');
        store.saveEntry(entry);
        return;
      }

      await this.processCurrentStep(entry, journey);

    } catch (error) {
      logger.error(`Error processing entry ${entryId}`, { error });
    } finally {
      this.processingQueue.delete(entryId);
    }
  }

  private async processCurrentStep(entry: JourneyEntry, journey: Journey): Promise<void> {
    const step = journey.getStep(entry.currentStepId);
    if (!step) {
      logger.error(`Step not found: ${entry.currentStepId}`);
      entry.fail('Step not found');
      store.saveEntry(entry);
      return;
    }

    const startTime = Date.now();
    this.logWorkerEvent(entry, journey, step, 'process');

    // Update analytics
    entry.getCurrentProgress()?.status === 'in_progress';
    store.saveEntry(entry);

    // Update journey step analytics
    journey.updateStepAnalytics(step.id, {
      entered: (journey.getStepAnalytics(step.id)?.entered || 0) + 1
    });

    try {
      // Handle different step types
      switch (step.type) {
        case 'entry':
          await this.processEntryStep(entry, journey, step);
          break;
        case 'action':
          await this.processActionStep(entry, journey, step);
          break;
        case 'condition':
          await this.processConditionStep(entry, journey, step);
          break;
        case 'split':
          await this.processSplitStep(entry, journey, step);
          break;
        case 'ai_check':
          await this.processAICheckStep(entry, journey, step);
          break;
        case 'end':
          await this.completeJourney(entry, journey);
          break;
        default:
          await this.moveToNextStep(entry, journey, step);
      }

      // Update analytics on completion
      const timeTook = Date.now() - startTime;
      journey.updateStepAnalytics(step.id, {
        completed: (journey.getStepAnalytics(step.id)?.completed || 0) + 1,
        avgTimeToComplete: this.calculateNewAverage(
          journey.getStepAnalytics(step.id)?.avgTimeToComplete || 0,
          journey.getStepAnalytics(step.id)?.completed || 0,
          timeTook
        )
      });
      store.saveJourney(journey);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error processing step ${step.id}`, { error: errorMessage });

      entry.failStep(step.id, errorMessage);
      store.saveEntry(entry);

      // Update journey analytics
      journey.updateStepAnalytics(step.id, {
        failed: (journey.getStepAnalytics(step.id)?.failed || 0) + 1
      });
      store.saveJourney(journey);

      // Handle retry if configured
      if (step.retryConfig.maxRetries > 0 && entry.canRetry(step.id, step.retryConfig.maxRetries)) {
        await this.scheduleRetry(entry, journey, step, errorMessage);
      } else if (step.errorStepId) {
        // Move to error step
        entry.moveToStep(step.errorStepId);
        store.saveEntry(entry);
        await this.processCurrentStep(entry, journey);
      } else {
        // Mark entry as failed
        entry.fail(`Step failed after all retries: ${errorMessage}`);
        store.saveEntry(entry);
        this.updateJourneyEntryCounts(journey);
      }

      this.logWorkerEvent(entry, journey, step, 'fail');
    }
  }

  private async processEntryStep(entry: JourneyEntry, journey: Journey, step: Step): Promise<void> {
    // Entry step - just move to the next step
    await this.moveToNextStep(entry, journey, step);
  }

  private async processActionStep(entry: JourneyEntry, journey: Journey, step: Step): Promise<void> {
    if (!step.actionType || !step.actionConfig) {
      await this.moveToNextStep(entry, journey, step);
      return;
    }

    // Check timeout
    if (step.timeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Step timeout')), step.timeout);
      });
      await Promise.race([
        this.executeAction(step.actionType, step.actionConfig, entry.contactData, entry.getCurrentProgress()?.data || {}),
        timeoutPromise
      ]);
    } else {
      await this.executeAction(step.actionType, step.actionConfig, entry.contactData, entry.getCurrentProgress()?.data || {});
    }

    await this.moveToNextStep(entry, journey, step);
  }

  private async executeAction(
    actionType: ActionType,
    actionConfig: Step['actionConfig'],
    contactData: Record<string, unknown>,
    entryData: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown }> {
    const executor = actionExecutors[actionType];
    if (!executor) {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    const result = await executor.execute(actionConfig, contactData, entryData);

    if (!result.success) {
      throw new Error(result.error || 'Action execution failed');
    }

    return result;
  }

  private async processConditionStep(entry: JourneyEntry, journey: Journey, step: Step): Promise<void> {
    if (!step.actionConfig?.conditions) {
      await this.moveToNextStep(entry, journey, step);
      return;
    }

    const executor = actionExecutors['condition'];
    const result = await executor.execute(
      { type: 'condition', conditions: step.actionConfig.conditions },
      entry.contactData,
      entry.getCurrentProgress()?.data || {}
    ) as { success: boolean; data: { branch: 'true' | 'false' } };

    const branch = result.data?.branch || 'true';
    const nextStepId = branch === 'true' ? step.nextStepId : step.errorStepId;

    if (nextStepId) {
      entry.moveToStep(nextStepId, { conditionBranch: branch });
      store.saveEntry(entry);
      await this.processCurrentStep(entry, journey);
    } else {
      await this.moveToNextStep(entry, journey, step);
    }
  }

  private async processSplitStep(entry: JourneyEntry, journey: Journey, step: Step): Promise<void> {
    if (!step.splitBranches || step.splitBranches.length === 0) {
      await this.moveToNextStep(entry, journey, step);
      return;
    }

    // Evaluate each branch condition
    for (const branch of step.splitBranches) {
      const matches = this.evaluateCondition(branch.condition, entry.contactData);
      if (matches) {
        entry.moveToStep(branch.stepId, { splitBranch: branch.name });
        store.saveEntry(entry);
        await this.processCurrentStep(entry, journey);
        return;
      }
    }

    // No branch matched, continue to default next step
    await this.moveToNextStep(entry, journey, step);
  }

  /**
   * Process an AI-Check step
   */
  private async processAICheckStep(entry: JourneyEntry, journey: Journey, step: Step): Promise<void> {
    if (!step.aiCheckConfig) {
      logger.warn('AI-Check step missing configuration', { stepId: step.id });
      await this.moveToNextStep(entry, journey, step);
      return;
    }

    logger.info('Processing AI check step', {
      stepId: step.id,
      checkType: step.aiCheckConfig.checkType,
      threshold: step.aiCheckConfig.threshold,
    });

    try {
      // Build context for AI evaluation
      const context: AICheckContext = {
        contactData: entry.contactData,
        journeyData: {
          journeyId: journey.id,
          journeyName: journey.name,
        },
        entryData: {
          entryId: entry.id,
          enteredAt: entry.enteredAt.toISOString(),
          currentStepId: entry.currentStepId,
        },
        historicalData: {
          recentSearches: entry.contactData.recentSearches as string[] || [],
          abandonedCarts: entry.contactData.abandonedCarts as Array<{ items: string[]; value: number }> || [],
          views: entry.contactData.views as string[] || [],
          purchases: entry.contactData.purchases as Array<{ items: string[]; total: number; date: Date }> || [],
          supportTickets: entry.contactData.supportTickets as number || 0,
          lastActivity: entry.contactData.lastActivity as Date || undefined,
          engagementScore: entry.contactData.engagementScore as number || undefined,
        },
        metadata: {
          journeyTags: journey.tags,
          entryTags: entry.tags,
        },
      };

      // Evaluate the AI check
      const result = await aiCheckService.evaluateCheck(step.aiCheckConfig, context);

      // Update step analytics
      step.updateAIAnalytics(result);

      // Log the result
      logger.info('AI check completed', {
        stepId: step.id,
        checkType: result.checkType,
        score: result.score,
        passed: result.passed,
        confidence: result.confidence,
        evaluationTimeMs: result.evaluationTimeMs,
      });

      // Store variables from the result
      if (result.variables && Object.keys(result.variables).length > 0) {
        entry.variables = { ...entry.variables, ...result.variables };
      }

      // Determine next step based on result
      const nextStepId = step.getNextStepForResult(result);

      if (nextStepId) {
        entry.moveToStep(nextStepId, {
          aiCheckResult: {
            checkType: result.checkType,
            score: result.score,
            passed: result.passed,
            reasoning: result.reasoning,
          },
        });
        store.saveEntry(entry);
        await this.processCurrentStep(entry, journey);
      } else {
        // No specific next step, use default nextStepId
        await this.moveToNextStep(entry, journey, step);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('AI check failed', {
        stepId: step.id,
        error: errorMessage,
      });

      // On AI check failure, use default fallback
      if (step.nextStepId) {
        entry.moveToStep(step.nextStepId, {
          aiCheckError: errorMessage,
        });
        store.saveEntry(entry);
        await this.processCurrentStep(entry, journey);
      } else {
        await this.moveToNextStep(entry, journey, step);
      }
    }
  }

  private evaluateCondition(condition: { field: string; operator: string; value: unknown }, data: Record<string, unknown>): boolean {
    const value = data[condition.field];

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
        return Array.isArray(condition.value) && (condition.value as unknown[]).includes(value);
      case 'not_in':
        return !Array.isArray(condition.value) || !(condition.value as unknown[]).includes(value);
      default:
        return false;
    }
  }

  private async moveToNextStep(entry: JourneyEntry, journey: Journey, step: Step): Promise<void> {
    if (!step.nextStepId) {
      // No next step, complete the journey
      await this.completeJourney(entry, journey);
      return;
    }

    entry.moveToStep(step.nextStepId);
    store.saveEntry(entry);

    // Handle delay if configured
    if (step.actionType === 'delay' && step.actionConfig?.delayDuration) {
      await this.scheduleDelay(entry, journey, step);
    } else {
      // Immediately process next step
      await this.processCurrentStep(entry, journey);
    }
  }

  private async scheduleDelay(entry: JourneyEntry, journey: Journey, step: Step): Promise<void> {
    let delayMs = step.actionConfig?.delayDuration || 0;
    const unit = step.actionConfig?.delayUnit || 'seconds';

    switch (unit) {
      case 'seconds':
        delayMs *= 1000;
        break;
      case 'minutes':
        delayMs *= 60 * 1000;
        break;
      case 'hours':
        delayMs *= 60 * 60 * 1000;
        break;
      case 'days':
        delayMs *= 24 * 60 * 60 * 1000;
        break;
    }

    const jobId = `${entry.id}_${step.id}_${Date.now()}`;
    const timeout = setTimeout(async () => {
      this.delayedJobs.delete(jobId);
      await this.processCurrentStep(entry, journey);
    }, delayMs);

    this.delayedJobs.set(jobId, timeout);
    logger.info(`Delay scheduled for entry ${entry.id}`, { delayMs, jobId });
  }

  private async scheduleRetry(entry: JourneyEntry, journey: Journey, step: Step, error: string): Promise<void> {
    const progress = entry.getStepProgress(step.id);
    const retryCount = progress?.retryCount || 0;

    let delayMs = step.retryConfig.retryDelay;
    if (step.retryConfig.exponentialBackoff) {
      delayMs *= Math.pow(2, retryCount);
    }

    const jobId = `${entry.id}_${step.id}_retry_${Date.now()}`;
    const timeout = setTimeout(async () => {
      this.delayedJobs.delete(jobId);
      await this.processEntry(entry.id);
    }, delayMs);

    this.delayedJobs.set(jobId, timeout);
    logger.info(`Retry scheduled for entry ${entry.id}`, { delayMs, retryCount: retryCount + 1, jobId });
  }

  private async completeJourney(entry: JourneyEntry, journey: Journey): Promise<void> {
    entry.complete('Journey completed successfully');
    store.saveEntry(entry);

    this.updateJourneyEntryCounts(journey);

    eventEmitter.emit('entry:completed', {
      entryId: entry.id,
      journeyId: journey.id,
      contactId: entry.contactId,
      duration: entry.getTimeSpent()
    });

    logger.info(`Journey completed for entry ${entry.id}`, {
      contactId: entry.contactId,
      journeyId: journey.id,
      duration: entry.getTimeSpent()
    });
  }

  private updateJourneyEntryCounts(journey: Journey): void {
    const entries = store.getEntriesByJourney(journey.id);

    journey.analytics.activeEntries = entries.filter(e => e.status === 'entered').length;
    journey.analytics.completedEntries = entries.filter(e => e.status === 'completed').length;
    journey.analytics.failedEntries = entries.filter(e => e.status === 'failed').length;

    if (entries.length > 0) {
      journey.analytics.conversionRate =
        (journey.analytics.completedEntries / entries.length) * 100;
    }

    store.saveJourney(journey);
  }

  private calculateNewAverage(currentAvg: number, currentCount: number, newValue: number): number {
    return ((currentAvg * currentCount) + newValue) / (currentCount + 1);
  }

  private logWorkerEvent(entry: JourneyEntry, journey: Journey, step: Step, action: WorkerEvent['action']): void {
    const event: WorkerEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entryId: entry.id,
      journeyId: journey.id,
      stepId: step.id,
      action,
      timestamp: new Date()
    };

    this.workerEvents.push(event);

    // Keep only last 1000 events
    if (this.workerEvents.length > 1000) {
      this.workerEvents = this.workerEvents.slice(-500);
    }

    logger.debug('Worker event', { event });
  }

  public getWorkerEvents(limit: number = 100): WorkerEvent[] {
    return this.workerEvents.slice(-limit);
  }

  public getQueueSize(): number {
    return this.processingQueue.size;
  }

  public getDelayedJobsCount(): number {
    return this.delayedJobs.size;
  }

  public getStatus(): {
    isRunning: boolean;
    queueSize: number;
    delayedJobs: number;
    recentEvents: number;
  } {
    return {
      isRunning: this.isRunning,
      queueSize: this.getQueueSize(),
      delayedJobs: this.getDelayedJobsCount(),
      recentEvents: this.workerEvents.length
    };
  }
}

export const journeyWorker = new JourneyWorker();
