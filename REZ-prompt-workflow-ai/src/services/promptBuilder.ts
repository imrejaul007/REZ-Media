/**
 * Prompt Builder Service
 * Builds optimized prompts for OpenAI workflow generation
 */

import type { OpenAIMessage } from '../types';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt';
import { formatExamplesForPrompt } from '../prompts/examples';
import config from '../config';

export interface PromptBuilderOptions {
  includeA/BTest?: boolean;
  maxSteps?: number;
  preferredChannels?: string[];
  outputFormat?: 'full' | 'minimal';
}

export interface PromptBuildResult {
  messages: OpenAIMessage[];
  systemPrompt: string;
  userPrompt: string;
  estimatedTokens: number;
}

/**
 * Build a complete prompt for workflow generation
 */
export function buildWorkflowGenerationPrompt(
  userPrompt: string,
  options?: PromptBuilderOptions
): PromptBuildResult {
  const examplesSection = formatExamplesForPrompt();

  const instructions = buildInstructions(options);
  const schemaInfo = buildSchemaInfo(options?.outputFormat);

  const userPromptContent = `${userPrompt}

${instructions}

${schemaInfo}

## Examples

${examplesSection}

IMPORTANT: Return ONLY valid JSON matching the schema above. Do not include any other text or explanation.`;

  const systemPrompt = `${SYSTEM_PROMPT}

## Important Constraints

${instructions}

${schemaInfo}`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPromptContent },
  ];

  // Rough token estimation (4 chars per token average)
  const estimatedTokens = Math.ceil(
    (systemPrompt.length + userPromptContent.length + examplesSection.length) / 4
  );

  return {
    messages,
    systemPrompt,
    userPrompt: userPromptContent,
    estimatedTokens,
  };
}

/**
 * Build a prompt for generating a single step
 */
export function buildStepGenerationPrompt(
  userPrompt: string,
  context?: {
    workflowId?: string;
    previousSteps?: Array<{ id: string; type: string; label?: string }>;
    position?: { x: number; y: number };
  }
): PromptBuildResult {
  let contextSection = '';

  if (context?.previousSteps && context.previousSteps.length > 0) {
    contextSection = `\n## Context (Previous Steps)\n\n`;
    contextSection += `This step will follow these steps:\n`;
    contextContext:
    for (const step of context.previousSteps) {
      contextSection += `- ${step.id} (${step.type})${step.label ? `: ${step.label}` : ''}\n`;
    }
    contextSection += '\n';
  }

  if (context?.position) {
    contextSection += `This step should be positioned at x: ${context.position.x}, y: ${context.position.y}\n\n`;
  }

  const userPromptContent = `${userPrompt}${contextSection}

Generate a single workflow step that fits naturally after the previous steps.

Return ONLY valid JSON with this structure:
{
  "id": "unique_step_id",
  "type": "step_type",
  "config": {},
  "position": {"x": number, "y": number},
  "edges": [],
  "label": "Step description"
}`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPromptContent },
  ];

  const estimatedTokens = Math.ceil((SYSTEM_PROMPT.length + userPromptContent.length) / 4);

  return {
    messages,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: userPromptContent,
    estimatedTokens,
  };
}

/**
 * Build instructions based on options
 */
function buildInstructions(options?: PromptBuilderOptions): string {
  const instructions: string[] = [];

  instructions.push('# Instructions');

  if (options?.maxSteps) {
    instructions.push(`- Generate a workflow with at most ${options.maxSteps} steps`);
  }

  if (options?.preferredChannels && options.preferredChannels.length > 0) {
    const channels = options.preferredChannels.join(', ');
    instructions.push(`- Prefer using these channels: ${channels}`);
  }

  if (options?.includeA/BTest) {
    instructions.push('- Include A/B test splits where appropriate');
  }

  instructions.push('- Ensure logical flow from trigger to end');
  instructions.push('- Space out messages appropriately (not too aggressive)');
  instructions.push('- Include delays between messages');
  instructions.push('- Each step must have a unique ID');

  return instructions.join('\n');
}

/**
 * Build schema information for the prompt
 */
function buildSchemaInfo(format?: 'full' | 'minimal'): string {
  if (format === 'minimal') {
    return `# Simplified Schema

Return a workflow with these required fields:
- name (string)
- description (string)
- trigger: { type: string, conditions?: array }
- steps: array of { id, type, config, position, edges }
- analytics: { trackOpens, trackClicks, trackConversions }`;
  }

  return `# JSON Schema

{
  "name": "Workflow Name",
  "description": "What this workflow does",
  "trigger": {
    "type": "signup|abandoned_cart|purchase|manual|schedule|inactivity|win_back|birthday|price_drop|back_in_stock",
    "conditions": [{ "field": "string", "operator": "string", "value": "any" }]
  },
  "steps": [
    {
      "id": "step_1",
      "type": "email|sms|whatsapp|push|delay|condition|webhook|split|ai_generated_content|end",
      "config": {
        "template": "template_name",
        "subject": "Email subject",
        "content": "Message content",
        "duration": "1 hour|2 days|etc",
        "discount": "10% off",
        "channel": "email|sms|whatsapp|push"
      },
      "position": { "x": 250, "y": 100 },
      "edges": ["step_2", "step_3"],
      "label": "Human readable label"
    }
  ],
  "analytics": {
    "trackOpens": true,
    "trackClicks": true,
    "trackConversions": true
  }
}`;
}

/**
 * Build optimization prompt
 */
export function buildOptimizationPrompt(
  workflowJson: string,
  goals?: string[]
): PromptBuildResult {
  const goalsText = goals && goals.length > 0 ? goals.join(', ') : 'improve overall effectiveness';

  const userPromptContent = `## Workflow to Optimize

\`\`\`json
${workflowJson}
\`\`\`

## Optimization Goals

Optimize this workflow to: ${goalsText}

Consider:
- Reducing unnecessary steps
- Improving timing and delays
- Better channel selection
- Stronger CTAs and personalization
- Appropriate A/B testing
- Clearer conditional logic

Return the optimized workflow as JSON with the same schema.`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPromptContent },
  ];

  const estimatedTokens = Math.ceil((SYSTEM_PROMPT.length + userPromptContent.length) / 4);

  return {
    messages,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: userPromptContent,
    estimatedTokens,
  };
}

export default {
  buildWorkflowGenerationPrompt,
  buildStepGenerationPrompt,
  buildOptimizationPrompt,
};
