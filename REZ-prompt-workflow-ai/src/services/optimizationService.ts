/**
 * Optimization Service
 * Analyzes and optimizes existing workflows
 */

import type { Workflow, OptimizationResponse } from '../types';
import logger from '../utils/logger';

export interface OptimizationGoal {
  type: 'reduce_steps' | 'increase_engagement' | 'reduce_cost' | 'improve_timing';
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface StepAnalysis {
  stepId: string;
  type: string;
  redundancy: boolean;
  timing: 'aggressive' | 'normal' | 'passive';
  recommendations: string[];
}

/**
 * Analyze a workflow and suggest optimizations
 */
export function analyzeWorkflow(workflow: Workflow): StepAnalysis[] {
  const analyses: StepAnalysis[] = [];

  for (const step of workflow.steps) {
    const analysis: StepAnalysis = {
      stepId: step.id,
      type: step.type,
      redundancy: false,
      timing: 'normal',
      recommendations: [],
    };

    // Check for redundant steps
    const similarSteps = workflow.steps.filter(
      (s) =>
        s.id !== step.id &&
        s.type === step.type &&
        JSON.stringify(s.config) === JSON.stringify(step.config)
    );
    if (similarSteps.length > 0) {
      analysis.redundancy = true;
      analysis.recommendations.push(
        `This step is similar to ${similarSteps.map((s) => s.id).join(', ')}. Consider consolidating.`
      );
    }

    // Check timing
    if (step.type === 'delay') {
      const duration = step.config.duration || '';
      if (
        duration.includes('1 hour') ||
        duration.includes('30 minutes') ||
        duration.includes('2 hours')
      ) {
        analysis.timing = 'aggressive';
        analysis.recommendations.push(
          'Consider increasing this delay to reduce message fatigue.'
        );
      } else if (
        duration.includes('30 days') ||
        duration.includes('60 days') ||
        duration.includes('90 days')
      ) {
        analysis.timing = 'passive';
      }
    }

    // Check for missing analytics
    if (
      ['email', 'sms', 'whatsapp', 'push'].includes(step.type) &&
      !workflow.analytics.trackOpens &&
      ['email'].includes(step.type)
    ) {
      analysis.recommendations.push(
        'Consider enabling open tracking for email messages.'
      );
    }

    if (
      ['email', 'sms', 'whatsapp', 'push'].includes(step.type) &&
      !workflow.analytics.trackClicks
    ) {
      analysis.recommendations.push(
        'Consider enabling click tracking to measure engagement.'
      );
    }

    analyses.push(analysis);
  }

  return analyses;
}

/**
 * Optimize workflow for specific goals
 */
export function optimizeWorkflow(
  workflow: Workflow,
  goals: OptimizationGoal['type'][]
): OptimizationResponse {
  const improvements: OptimizationResponse['improvements'] = [];

  let optimizedWorkflow = JSON.parse(JSON.stringify(workflow)) as Workflow;

  for (const goal of goals) {
    const result = applyOptimization(optimizedWorkflow, goal);
    if (result) {
      improvements.push(result);
    }
  }

  // Always apply general optimizations
  const generalOptimizations = applyGeneralOptimizations(optimizedWorkflow);
  improvements.push(...generalOptimizations);

  // Calculate estimated impact
  const estimatedImpact = calculateEstimatedImpact(workflow, improvements);

  return {
    workflow: optimizedWorkflow,
    improvements,
    estimatedImpact,
  };
}

/**
 * Apply specific optimization
 */
function applyOptimization(
  workflow: Workflow,
  goal: OptimizationGoal['type']
): OptimizationResponse['improvements'][0] | null {
  switch (goal) {
    case 'reduce_steps':
      return reduceUnnecessarySteps(workflow);
    case 'increase_engagement':
      return optimizeForEngagement(workflow);
    case 'reduce_cost':
      return optimizeForCost(workflow);
    case 'improve_timing':
      return improveTiming(workflow);
    default:
      return null;
  }
}

/**
 * Reduce unnecessary steps
 */
function reduceUnnecessarySteps(
  workflow: Workflow
): OptimizationResponse['improvements'][0] {
  const stepsBefore = workflow.steps.length;

  // Remove redundant message steps
  const seenConfigs = new Map<string, number>();
  const stepsToKeep: typeof workflow.steps = [];

  for (const step of workflow.steps) {
    if (['email', 'sms', 'whatsapp', 'push', 'message'].includes(step.type)) {
      const configKey = JSON.stringify(step.config);
      if (seenConfigs.has(configKey)) {
        // Mark for removal, update edges
        const existingStepId = seenConfigs.get(configKey)!;
        // Update any steps pointing to this step to point to existing
        for (const s of stepsToKeep) {
          s.edges = s.edges.map((edge) =>
            edge === step.id ? existingStepId : edge
          );
        }
        continue;
      }
      seenConfigs.set(configKey, step.id);
    }
    stepsToKeep.push(step);
  }

  workflow.steps = stepsToKeep;

  // Remove orphaned end steps (keep only one)
  const endSteps = workflow.steps.filter((s) => s.type === 'end');
  if (endSteps.length > 1) {
    const mainEnd = endSteps[0];
    for (const step of workflow.steps) {
      if (step.edges.includes('end')) {
        // Already points to 'end', which should be the first one
      } else {
        step.edges = step.edges.filter((e) => !endSteps.slice(1).some((es) => es.id === e));
      }
    }
    workflow.steps = workflow.steps.filter((s) => s.type !== 'end' || s.id === mainEnd.id);
  }

  const stepsRemoved = stepsBefore - workflow.steps.length;

  return {
    type: 'reduce_steps',
    description: `Reduced ${stepsRemoved} redundant or unnecessary steps`,
    impact: stepsRemoved > 3 ? 'high' : stepsRemoved > 1 ? 'medium' : 'low',
  };
}

/**
 * Optimize for engagement
 */
function optimizeForEngagement(
  workflow: Workflow
): OptimizationResponse['improvements'][0] {
  // Ensure analytics are enabled
  const wasTrackingClicks = workflow.analytics.trackClicks;
  const wasTrackingOpens = workflow.analytics.trackOpens;

  workflow.analytics.trackClicks = true;
  if (workflow.trigger.type === 'signup') {
    workflow.analytics.trackOpens = true;
  }

  return {
    type: 'increase_engagement',
    description: `Enabled click tracking${!wasTrackingOpens && workflow.analytics.trackOpens ? ' and open tracking' : ''} for better engagement measurement`,
    impact: 'high',
  };
}

/**
 * Optimize for cost
 */
function optimizeForCost(
  workflow: Workflow
): OptimizationResponse['improvements'][0] {
  let changes = 0;

  // Prefer email over SMS/WhatsApp where appropriate
  for (const step of workflow.steps) {
    if (step.type === 'sms' && !step.config.discount) {
      step.type = 'email';
      changes++;
    }
  }

  // Remove webhook steps that are not essential
  for (const step of workflow.steps) {
    if (step.type === 'webhook' && !step.config.url?.includes('analytics')) {
      // Keep webhook but note the cost consideration
    }
  }

  return {
    type: 'reduce_cost',
    description:
      changes > 0
        ? `Converted ${changes} SMS to email to reduce messaging costs`
        : 'Consider consolidating multiple messages to reduce channel costs',
    impact: changes > 0 ? 'medium' : 'low',
  };
}

/**
 * Improve timing
 */
function improveTiming(
  workflow: Workflow
): OptimizationResponse['improvements'][0] {
  let changes = 0;

  for (const step of workflow.steps) {
    if (step.type === 'delay') {
      const duration = step.config.duration || '';

      // Reduce overly aggressive timing
      if (duration === '30 minutes' || duration === '1 hour') {
        if (step === workflow.steps.find((s) => s.id === step.id)) {
          // Only change if it's early in the workflow
          step.config.duration = '4 hours';
          changes++;
        }
      }

      // Increase spacing for better engagement
      if (duration === '1 day') {
        step.config.duration = '2 days';
        changes++;
      }
    }
  }

  return {
    type: 'improve_timing',
    description:
      changes > 0
        ? `Adjusted ${changes} delays for better message spacing`
        : 'Current timing appears reasonable',
    impact: changes > 0 ? 'medium' : 'low',
  };
}

/**
 * Apply general optimizations
 */
function applyGeneralOptimizations(
  workflow: Workflow
): OptimizationResponse['improvements'] {
  const improvements: OptimizationResponse['improvements'] = [];

  // Ensure there's an end step
  if (!workflow.steps.some((s) => s.type === 'end')) {
    const lastStep = workflow.steps[workflow.steps.length - 1];
    if (lastStep) {
      lastStep.edges.push('end');
      workflow.steps.push({
        id: 'end',
        type: 'end',
        config: {},
        position: { x: lastStep.position.x, y: lastStep.position.y + 80 },
        edges: [],
        label: 'End',
      });
      improvements.push({
        type: 'reduce_steps',
        description: 'Added end step to ensure proper workflow termination',
        impact: 'medium',
      });
    }
  }

  // Ensure all steps have unique IDs
  const seenIds = new Set<string>();
  for (const step of workflow.steps) {
    if (seenIds.has(step.id)) {
      step.id = `${step.id}_${Date.now()}`;
    }
    seenIds.add(step.id);
  }

  // Update edges to use unique IDs
  for (const step of workflow.steps) {
    step.edges = step.edges.map((edge) => {
      if (edge === 'end') return edge;
      const targetStep = workflow.steps.find((s) => s.id === edge);
      return targetStep ? targetStep.id : edge;
    });
  }

  // Set default analytics if not present
  if (!workflow.analytics) {
    workflow.analytics = {
      trackOpens: true,
      trackClicks: true,
      trackConversions: true,
    };
    improvements.push({
      type: 'increase_engagement',
      description: 'Enabled default analytics tracking',
      impact: 'medium',
    });
  }

  return improvements;
}

/**
 * Calculate estimated impact of optimizations
 */
function calculateEstimatedImpact(
  original: Workflow,
  improvements: OptimizationResponse['improvements']
): OptimizationResponse['estimatedImpact'] {
  const impact: OptimizationResponse['estimatedImpact'] = {};

  for (const improvement of improvements) {
    switch (improvement.type) {
      case 'increase_engagement':
        impact.engagementImprovement = (impact.engagementImprovement || 0) + 15;
        break;
      case 'reduce_cost':
        impact.costReduction = (impact.costReduction || 0) + 10;
        break;
      case 'improve_timing':
        impact.conversionImprovement = (impact.conversionImprovement || 0) + 8;
        break;
    }
  }

  return impact;
}

/**
 * Validate optimization is safe
 */
export function isOptimizationSafe(
  workflow: Workflow,
  goal: OptimizationGoal['type']
): boolean {
  // Prevent reducing steps below minimum viable workflow
  if (goal === 'reduce_steps' && workflow.steps.length <= 3) {
    return false;
  }

  // Don't remove all delays if workflow has many messages
  const messageSteps = workflow.steps.filter((s) =>
    ['email', 'sms', 'whatsapp', 'push', 'message'].includes(s.type)
  );
  if (
    goal === 'reduce_steps' &&
    messageSteps.length > 3 &&
    workflow.steps.filter((s) => s.type === 'delay').length === 0
  ) {
    return false;
  }

  return true;
}

export default {
  analyzeWorkflow,
  optimizeWorkflow,
  isOptimizationSafe,
};
