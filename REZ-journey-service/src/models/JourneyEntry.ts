import { v4 as uuidv4 } from 'uuid';
import { EntryStatus, ABVariant } from '../types';

export interface StepProgress {
  stepId: string;
  status: EntryStatus;
  enteredAt?: Date;
  completedAt?: Date;
  retryCount: number;
  lastError?: string;
  data?: Record<string, unknown>;
}

export class JourneyEntry {
  public readonly id: string;
  public readonly journeyId: string;
  public readonly contactId: string;
  public readonly contactEmail?: string;
  public variant: ABVariant;
  public currentStepId: string;
  public status: EntryStatus;
  public progress: StepProgress[];
  public startedAt: Date;
  public completedAt?: Date;
  public exitReason?: string;
  public metadata: Record<string, unknown>;
  public contactData: Record<string, unknown>;

  constructor(data: {
    id?: string;
    journeyId: string;
    contactId: string;
    contactEmail?: string;
    entryStepId: string;
    variant?: ABVariant;
    metadata?: Record<string, unknown>;
    contactData?: Record<string, unknown>;
  }) {
    this.id = data.id || uuidv4();
    this.journeyId = data.journeyId;
    this.contactId = data.contactId;
    this.contactEmail = data.contactEmail;
    this.variant = data.variant || 'A';
    this.currentStepId = data.entryStepId;
    this.status = 'entered';
    this.progress = [{
      stepId: data.entryStepId,
      status: 'entered',
      enteredAt: new Date(),
      retryCount: 0,
      data: {}
    }];
    this.startedAt = new Date();
    this.metadata = data.metadata || {};
    this.contactData = data.contactData || {};
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      journeyId: this.journeyId,
      contactId: this.contactId,
      contactEmail: this.contactEmail,
      variant: this.variant,
      currentStepId: this.currentStepId,
      status: this.status,
      progress: this.progress.map(p => ({
        ...p,
        enteredAt: p.enteredAt?.toISOString(),
        completedAt: p.completedAt?.toISOString()
      })),
      startedAt: this.startedAt.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      exitReason: this.exitReason,
      metadata: this.metadata,
      contactData: this.contactData
    };
  }

  public static fromJSON(json: Record<string, unknown>): JourneyEntry {
    const entry = new JourneyEntry({
      id: json.id as string,
      journeyId: json.journeyId as string,
      contactId: json.contactId as string,
      contactEmail: json.contactEmail as string | undefined,
      entryStepId: (json.progress as StepProgress[])?.[0]?.stepId || '',
      variant: json.variant as ABVariant,
      metadata: json.metadata as Record<string, unknown>,
      contactData: json.contactData as Record<string, unknown>
    });
    entry.currentStepId = json.currentStepId as string;
    entry.status = json.status as EntryStatus;
    entry.progress = (json.progress as Record<string, unknown>[]).map(p => ({
      stepId: p.stepId as string,
      status: p.status as EntryStatus,
      enteredAt: p.enteredAt ? new Date(p.enteredAt as string) : undefined,
      completedAt: p.completedAt ? new Date(p.completedAt as string) : undefined,
      retryCount: p.retryCount as number,
      lastError: p.lastError as string | undefined,
      data: p.data as Record<string, unknown> | undefined
    }));
    entry.startedAt = new Date(json.startedAt as string);
    entry.completedAt = json.completedAt ? new Date(json.completedAt as string) : undefined;
    entry.exitReason = json.exitReason as string | undefined;
    return entry;
  }

  public moveToStep(stepId: string, data?: Record<string, unknown>): void {
    // Mark current step as completed
    const currentProgress = this.getCurrentProgress();
    if (currentProgress) {
      currentProgress.status = 'completed';
      currentProgress.completedAt = new Date();
      if (data) {
        currentProgress.data = { ...currentProgress.data, ...data };
      }
    }

    // Add new step progress
    this.currentStepId = stepId;
    this.progress.push({
      stepId,
      status: 'entered',
      enteredAt: new Date(),
      retryCount: 0,
      data: data || {}
    });
  }

  public completeStep(stepId: string, data?: Record<string, unknown>): void {
    const stepProgress = this.getStepProgress(stepId);
    if (stepProgress) {
      stepProgress.status = 'completed';
      stepProgress.completedAt = new Date();
      if (data) {
        stepProgress.data = { ...stepProgress.data, ...data };
      }
    }
  }

  public failStep(stepId: string, error: string): void {
    const stepProgress = this.getStepProgress(stepId);
    if (stepProgress) {
      stepProgress.status = 'failed';
      stepProgress.lastError = error;
      stepProgress.retryCount++;
    }
  }

  public skipStep(stepId: string, reason?: string): void {
    const stepProgress = this.getStepProgress(stepId);
    if (stepProgress) {
      stepProgress.status = 'skipped';
      if (reason) {
        stepProgress.lastError = reason;
      }
    }
  }

  public getCurrentProgress(): StepProgress | undefined {
    return this.getStepProgress(this.currentStepId);
  }

  public getStepProgress(stepId: string): StepProgress | undefined {
    return this.progress.find(p => p.stepId === stepId);
  }

  public complete(reason?: string): void {
    this.status = 'completed';
    this.completedAt = new Date();
    this.exitReason = reason || 'Journey completed normally';
  }

  public exit(reason: string): void {
    this.status = 'exited';
    this.completedAt = new Date();
    this.exitReason = reason;
  }

  public fail(reason: string): void {
    this.status = 'failed';
    this.completedAt = new Date();
    this.exitReason = reason;
  }

  public canRetry(stepId: string, maxRetries: number): boolean {
    const progress = this.getStepProgress(stepId);
    if (!progress) return false;
    return progress.retryCount < maxRetries;
  }

  public getTimeSpent(): number {
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  public getStepTimeSpent(stepId: string): number | undefined {
    const progress = this.getStepProgress(stepId);
    if (!progress || !progress.enteredAt) return undefined;
    const endTime = progress.completedAt || new Date();
    return endTime.getTime() - progress.enteredAt.getTime();
  }

  public getCompletedSteps(): string[] {
    return this.progress
      .filter(p => p.status === 'completed')
      .map(p => p.stepId);
  }

  public getFailedSteps(): string[] {
    return this.progress
      .filter(p => p.status === 'failed')
      .map(p => p.stepId);
  }

  public getSkippedSteps(): string[] {
    return this.progress
      .filter(p => p.status === 'skipped')
      .map(p => p.stepId);
  }

  public updateContactData(data: Record<string, unknown>): void {
    this.contactData = { ...this.contactData, ...data };
  }

  public setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  public getMetadata<T>(key: string): T | undefined {
    return this.metadata[key] as T | undefined;
  }
}
