/**
 * Schema Validator Service
 * Validates generated workflows against the schema
 */

import { z } from 'zod';
import type {
  Workflow,
  ValidationResponse,
  ValidationError,
  ValidationWarning,
} from '../types';
import { workflowSchema } from '../utils/schema';
import logger from '../utils/logger';

/**
 * Validate a workflow against the schema
 */
export function validateWorkflow(workflow: unknown): ValidationResponse {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Schema validation with Zod
  const result = workflowSchema.safeParse(workflow);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      errors.push({
        field: path || 'root',
        message: issue.message,
        code: `SCHEMA_${issue.code.toUpperCase()}`,
      });
    }
  }

  // Additional semantic validations
  if (result.success && workflow) {
    const validatedWorkflow = workflow as Workflow;

    // Validate step IDs are unique
    const stepIds = validatedWorkflow.steps.map((s) => s.id);
    const uniqueStepIds = new Set(stepIds);
    if (stepIds.length !== uniqueStepIds.size) {
      errors.push({
        field: 'steps',
        message: 'Step IDs must be unique',
        code: 'DUPLICATE_STEP_ID',
      });
    }

    // Validate edges reference existing steps
    const allStepIds = new Set(stepIds);
    for (const step of validatedWorkflow.steps) {
      for (const edgeId of step.edges) {
        if (edgeId !== 'end' && !allStepIds.has(edgeId)) {
          errors.push({
            field: `steps.${step.id}.edges`,
            message: `Edge "${edgeId}" references non-existent step`,
            code: 'INVALID_EDGE',
          });
        }
      }
    }

    // Validate workflow has at least one end step
    const hasEnd = validatedWorkflow.steps.some((s) => s.type === 'end');
    if (!hasEnd) {
      warnings.push({
        field: 'steps',
        message: 'Workflow should include an end step',
        code: 'MISSING_END',
      });
    }

    // Validate trigger type compatibility
    const triggerType = validatedWorkflow.trigger.type;
    if (triggerType === 'schedule' && !validatedWorkflow.trigger.cron) {
      warnings.push({
        field: 'trigger',
        message: 'Schedule trigger should include a cron expression',
        code: 'MISSING_CRON',
      });
    }

    if ((triggerType === 'inactivity' || triggerType === 'win_back') && !validatedWorkflow.trigger.days) {
      warnings.push({
        field: 'trigger',
        message: `${triggerType} trigger should include days parameter`,
        code: 'MISSING_DAYS',
      });
    }

    // Validate condition steps have conditions
    for (const step of validatedWorkflow.steps) {
      if (step.type === 'condition' && (!step.config.conditions || step.config.conditions.length === 0)) {
        errors.push({
          field: `steps.${step.id}.config.conditions`,
          message: 'Condition steps must have at least one condition',
          code: 'MISSING_CONDITIONS',
        });
      }

      if (step.type === 'condition' && step.edges.length < 2) {
        warnings.push({
          field: `steps.${step.id}`,
          message: 'Condition steps typically have multiple paths (edges)',
          code: 'SINGLE_CONDITION_PATH',
        });
      }
    }

    // Validate delay steps have duration
    for (const step of validatedWorkflow.steps) {
      if (step.type === 'delay' && !step.config.duration && !step.config.durationMinutes) {
        errors.push({
          field: `steps.${step.id}.config`,
          message: 'Delay steps must have duration or durationMinutes',
          code: 'MISSING_DELAY_DURATION',
        });
      }
    }

    // Validate message/email/sms/whatsapp steps have content or template
    for (const step of validatedWorkflow.steps) {
      if (['email', 'sms', 'whatsapp', 'push', 'message'].includes(step.type)) {
        if (!step.config.content && !step.config.template && !step.config.aiPrompt) {
          warnings.push({
            field: `steps.${step.id}.config`,
            message: `${step.type} steps should have content, template, or aiPrompt`,
            code: 'MISSING_MESSAGE_CONTENT',
          });
        }
      }
    }

    // Validate webhook steps have URL
    for (const step of validatedWorkflow.steps) {
      if (step.type === 'webhook' && !step.config.url) {
        errors.push({
          field: `steps.${step.id}.config.url`,
          message: 'Webhook steps must have a URL',
          code: 'MISSING_WEBHOOK_URL',
        });
      }
    }

    // Check for potentially long workflows
    if (validatedWorkflow.steps.length > 30) {
      warnings.push({
        field: 'steps',
        message: 'Workflow has many steps. Consider simplifying for better performance.',
        code: 'WORKFLOW_TOO_LONG',
      });
    }

    // Check for timing issues (too many messages in short time)
    const messageSteps = validatedWorkflow.steps.filter((s) =>
      ['email', 'sms', 'whatsapp', 'push', 'message'].includes(s.type)
    );
    const delaySteps = validatedWorkflow.steps.filter((s) => s.type === 'delay');

    if (messageSteps.length > 5 && delaySteps.length === 0) {
      warnings.push({
        field: 'steps',
        message: 'Consider adding delays between messages to avoid user fatigue',
        code: 'NO_DELAYS',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate workflow with strict mode (treats warnings as errors)
 */
export function validateWorkflowStrict(workflow: unknown): ValidationResponse {
  const result = validateWorkflow(workflow);

  if (result.warnings && result.warnings.length > 0) {
    result.errors = result.errors || [];
    for (const warning of result.warnings!) {
      result.errors.push({
        field: warning.field,
        message: warning.message,
        code: `STRICT_${warning.code}`,
      });
    }
    result.warnings = undefined;
    result.valid = false;
  }

  return result;
}

/**
 * Quick validation check (returns true if valid, false otherwise)
 */
export function isWorkflowValid(workflow: unknown): boolean {
  const result = validateWorkflow(workflow);
  return result.valid;
}

/**
 * Get validation summary
 */
export function getValidationSummary(response: ValidationResponse): string {
  if (response.valid) {
    if (response.warnings && response.warnings.length > 0) {
      return `Valid with ${response.warnings.length} warning(s)`;
    }
    return 'Valid';
  }

  const errorCount = response.errors?.length || 0;
  const warningCount = response.warnings?.length || 0;

  let summary = `Invalid - ${errorCount} error(s)`;
  if (warningCount > 0) {
    summary += `, ${warningCount} warning(s)`;
  }

  return summary;
}

export default {
  validateWorkflow,
  validateWorkflowStrict,
  isWorkflowValid,
  getValidationSummary,
};
