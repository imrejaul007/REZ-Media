/**
 * Workflow Generator Service
 * Main service for generating workflows from natural language using OpenAI
 */

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../utils/logger';
import type {
  Workflow,
  WorkflowGenerationResponse,
  StepGenerationResponse,
  OpenAIMessage,
} from '../types';
import {
  buildWorkflowGenerationPrompt,
  buildStepGenerationPrompt,
  buildOptimizationPrompt,
} from './promptBuilder';
import { validateWorkflow, isWorkflowValid } from './schemaValidator';
import { generateWorkflowFromTemplate, getTemplateById } from './templateService';

export class WorkflowGeneratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowGeneratorError';
  }
}

/**
 * Main Workflow Generator Service
 */
export class WorkflowGenerator {
  private openai: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
    this.model = config.openaiModel;
    this.temperature = config.openaiTemperature;
    this.maxTokens = config.openaiMaxTokens;
  }

  /**
   * Generate a complete workflow from natural language
   */
  async generateWorkflow(
    prompt: string,
    options?: {
      includeA/BTest?: boolean;
      maxSteps?: number;
      preferredChannels?: string[];
      outputFormat?: 'full' | 'minimal';
    }
  ): Promise<WorkflowGenerationResponse> {
    const startTime = Date.now();

    try {
      logger.info('Generating workflow from prompt', { prompt: prompt.substring(0, 100) });

      // Build prompt
      const { messages, estimatedTokens } = buildWorkflowGenerationPrompt(prompt, options);

      // Call OpenAI
      const completion = await this.callOpenAI(messages);

      // Parse response
      const workflow = this.parseWorkflowResponse(completion);

      // Validate workflow
      const validation = validateWorkflow(workflow);

      if (!validation.valid) {
        // Try to fix common issues
        const fixedWorkflow = this.tryFixWorkflow(workflow, validation.errors || []);
        const reValidation = validateWorkflow(fixedWorkflow);

        if (reValidation.valid) {
          return this.buildResponse(fixedWorkflow, startTime, estimatedTokens, reValidation.warnings);
        }

        throw new WorkflowGeneratorError(
          `Invalid workflow generated: ${validation.errors?.map((e) => e.message).join(', ')}`,
          'INVALID_WORKFLOW',
          { errors: validation.errors }
        );
      }

      return this.buildResponse(workflow, startTime, estimatedTokens, validation.warnings);
    } catch (error) {
      logger.error('Error generating workflow', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Generate a single workflow step
   */
  async generateStep(
    prompt: string,
    context?: {
      workflowId?: string;
      previousSteps?: Array<{ id: string; type: string; label?: string }>;
      position?: { x: number; y: number };
    }
  ): Promise<StepGenerationResponse> {
    try {
      logger.info('Generating workflow step', { prompt });

      const { messages } = buildStepGenerationPrompt(prompt, context);

      const completion = await this.callOpenAI(messages);

      const step = JSON.parse(completion);

      return {
        step: {
          ...step,
          id: step.id || `step_${uuidv4().substring(0, 8)}`,
          edges: step.edges || [],
        },
        explanation: `Generated a ${step.type} step based on your description.`,
      };
    } catch (error) {
      logger.error('Error generating step', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Optimize an existing workflow
   */
  async optimizeWorkflow(
    workflow: Workflow,
    goals?: ('reduce_steps' | 'increase_engagement' | 'reduce_cost' | 'improve_timing')[]
  ): Promise<WorkflowGenerationResponse> {
    const startTime = Date.now();

    try {
      logger.info('Optimizing workflow', {
        workflowName: workflow.name,
        goals: goals?.join(', ') || 'general',
      });

      const workflowJson = JSON.stringify(workflow);
      const { messages, estimatedTokens } = buildOptimizationPrompt(workflowJson, goals);

      const completion = await this.callOpenAI(messages);

      const optimizedWorkflow = this.parseWorkflowResponse(completion);
      const validation = validateWorkflow(optimizedWorkflow);

      if (!validation.valid) {
        // Try to fix the optimized workflow
        const fixedWorkflow = this.tryFixWorkflow(optimizedWorkflow, validation.errors || []);
        const reValidation = validateWorkflow(fixedWorkflow);

        if (reValidation.valid) {
          return this.buildResponse(fixedWorkflow, startTime, estimatedTokens, reValidation.warnings);
        }

        throw new WorkflowGeneratorError(
          `Optimization produced invalid workflow: ${validation.errors?.map((e) => e.message).join(', ')}`,
          'INVALID_OPTIMIZATION',
          { errors: validation.errors }
        );
      }

      return this.buildResponse(optimizedWorkflow, startTime, estimatedTokens, validation.warnings);
    } catch (error) {
      logger.error('Error optimizing workflow', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Generate workflow from template with modifications
   */
  generateFromTemplate(
    templateId: string,
    modifications?: {
      name?: string;
      description?: string;
      triggerDays?: number;
      channelPreferences?: string[];
    }
  ): WorkflowGenerationResponse {
    const template = getTemplateById(templateId);

    if (!template) {
      throw new WorkflowGeneratorError(
        `Template not found: ${templateId}`,
        'TEMPLATE_NOT_FOUND'
      );
    }

    const workflow = generateWorkflowFromTemplate(templateId, modifications);

    if (!workflow) {
      throw new WorkflowGeneratorError(
        `Failed to generate workflow from template: ${templateId}`,
        'TEMPLATE_GENERATION_FAILED'
      );
    }

    return {
      workflow,
      confidence: 0.9,
      suggestions: [
        `Based on "${template.name}" template`,
        'Review and customize the workflow steps as needed',
      ],
      warnings: ['This workflow was generated from a template and may need customization'],
      metadata: {
        generationTime: 0,
        model: 'template',
      },
    };
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(messages: OpenAIMessage[]): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: 'json_object' },
      });

      const completion = response.choices[0]?.message?.content;

      if (!completion) {
        throw new WorkflowGeneratorError(
          'No completion returned from OpenAI',
          'NO_COMPLETION'
        );
      }

      logger.debug('OpenAI response received', {
        tokens: response.usage?.total_tokens,
        model: this.model,
      });

      return completion;
    } catch (error) {
      if (error instanceof WorkflowGeneratorError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new WorkflowGeneratorError(
            'Invalid or missing OpenAI API key',
            'INVALID_API_KEY'
          );
        }
        if (error.message.includes('rate limit')) {
          throw new WorkflowGeneratorError(
            'OpenAI rate limit exceeded. Please try again later.',
            'RATE_LIMIT'
          );
        }
      }

      throw new WorkflowGeneratorError(
        `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OPENAI_ERROR'
      );
    }
  }

  /**
   * Parse workflow from OpenAI response
   */
  private parseWorkflowResponse(response: string): Workflow {
    try {
      const parsed = JSON.parse(response);

      // Ensure required fields
      const workflow: Workflow = {
        name: parsed.name || 'Untitled Workflow',
        description: parsed.description || '',
        trigger: {
          type: parsed.trigger?.type || 'manual',
          conditions: parsed.trigger?.conditions,
          days: parsed.trigger?.days,
          cartValueMin: parsed.trigger?.cartValueMin,
          cron: parsed.trigger?.cron,
          timezone: parsed.trigger?.timezone,
        },
        steps: this.parseSteps(parsed.steps || []),
        analytics: {
          trackOpens: parsed.analytics?.trackOpens ?? true,
          trackClicks: parsed.analytics?.trackClicks ?? true,
          trackConversions: parsed.analytics?.trackConversions ?? true,
          attributionWindow: parsed.analytics?.attributionWindow,
        },
        status: parsed.status || 'draft',
        tags: parsed.tags,
        metadata: parsed.metadata,
      };

      return workflow;
    } catch (error) {
      logger.error('Error parsing workflow response', { error, response });
      throw new WorkflowGeneratorError(
        'Failed to parse workflow response from OpenAI',
        'PARSE_ERROR',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Parse steps ensuring proper structure
   */
  private parseSteps(steps: unknown[]): Workflow['steps'] {
    return steps.map((step, index) => ({
      id: (step as any).id || `step_${index + 1}`,
      type: (step as any).type || 'message',
      config: (step as any).config || {},
      position: (step as any).position || { x: 250, y: index * 80 },
      edges: (step as any).edges || [],
      label: (step as any).label,
    }));
  }

  /**
   * Try to fix common workflow issues
   */
  private tryFixWorkflow(
    workflow: Workflow,
    errors: Array<{ code: string; field: string }>
  ): Workflow {
    const fixed = JSON.parse(JSON.stringify(workflow)) as Workflow;

    // Fix duplicate IDs
    const seenIds = new Set<string>();
    for (const step of fixed.steps) {
      if (seenIds.has(step.id)) {
        step.id = `${step.id}_${uuidv4().substring(0, 8)}`;
      }
      seenIds.add(step.id);
    }

    // Update edges to match new IDs
    for (const step of fixed.steps) {
      step.edges = step.edges.map((edge) => {
        if (edge === 'end') return edge;
        const existingStep = fixed.steps.find((s) => s.id === edge);
        if (existingStep) {
          return existingStep.id;
        }
        return edge;
      });
    }

    // Ensure there's an end step
    if (!fixed.steps.some((s) => s.type === 'end')) {
      const lastStep = fixed.steps[fixed.steps.length - 1];
      lastStep.edges.push('end');
      fixed.steps.push({
        id: 'end',
        type: 'end',
        config: {},
        position: { x: lastStep.position.x, y: lastStep.position.y + 80 },
        edges: [],
        label: 'End',
      });
    }

    // Fix position values
    let currentY = 100;
    for (const step of fixed.steps) {
      if (step.position.y === 0) {
        step.position.y = currentY;
      }
      currentY += 80;
    }

    return fixed;
  }

  /**
   * Build response object
   */
  private buildResponse(
    workflow: Workflow,
    startTime: number,
    estimatedTokens: number,
    warnings?: Array<{ field: string; message: string; code: string }>
  ): WorkflowGenerationResponse {
    // Calculate confidence based on validation
    let confidence = 0.8;
    if (workflow.steps.length >= 3) confidence += 0.1;
    if (workflow.steps.some((s) => s.type === 'end')) confidence += 0.05;
    if (workflow.analytics.trackConversions) confidence += 0.05;

    const suggestions: string[] = [];
    if (!workflow.steps.some((s) => s.type === 'condition')) {
      suggestions.push('Consider adding conditional steps for better personalization');
    }
    if (!workflow.analytics.trackOpens) {
      suggestions.push('Enable open tracking for better engagement measurement');
    }

    return {
      workflow,
      confidence: Math.min(confidence, 1),
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      warnings: warnings?.map((w) => w.message),
      metadata: {
        generationTime: Date.now() - startTime,
        tokensUsed: estimatedTokens,
        model: this.model,
      },
    };
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown): WorkflowGeneratorError {
    if (error instanceof WorkflowGeneratorError) {
      return error;
    }

    if (error instanceof Error) {
      logger.error('Workflow generator error', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      return new WorkflowGeneratorError(
        error.message,
        'INTERNAL_ERROR',
        { originalError: error.message }
      );
    }

    return new WorkflowGeneratorError(
      'An unexpected error occurred',
      'UNKNOWN_ERROR'
    );
  }
}

// Export singleton instance
let instance: WorkflowGenerator | null = null;

export function getWorkflowGenerator(): WorkflowGenerator {
  if (!instance) {
    instance = new WorkflowGenerator();
  }
  return instance;
}

export default WorkflowGenerator;
