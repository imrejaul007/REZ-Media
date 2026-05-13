/**
 * Prompt Templates for Workflow Generation
 * Reusable prompt templates for different workflow scenarios
 */

export interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  variables?: string[];
}

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  abandonedCartRecovery: {
    name: 'Abandoned Cart Recovery',
    description: 'Follow up with customers who abandoned their carts',
    template: `Create a workflow to recover abandoned carts.

The workflow should:
- Trigger when a customer adds items to cart but doesn't complete purchase
- Send initial recovery message within {initial_delay}
- Include a sequence of {num_messages} messages across {channels}
- Use escalating incentives (if specified)
- End with a final discount offer before archiving

{additional_instructions}`,
    variables: ['initial_delay', 'num_messages', 'channels', 'additional_instructions'],
  },

  welcomeSeries: {
    name: 'Welcome Series',
    description: 'Onboard new customers with a series of welcome messages',
    template: `Create a welcome workflow for new customers.

The workflow should:
- Trigger on user signup/registration
- Deliver a {num_emails}-email series over {duration}
- Introduce the brand and key features
- Encourage first purchase with {incentive}
- Build engagement gradually

Email topics should progress from:
1. Welcome and brand introduction
2. Getting started guide / product education
3. Special offer for first purchase

{additional_instructions}`,
    variables: ['num_emails', 'duration', 'incentive', 'additional_instructions'],
  },

  postPurchase: {
    name: 'Post-Purchase Follow-up',
    description: 'Follow up after a purchase to increase satisfaction and repeat business',
    template: `Create a post-purchase workflow.

The workflow should:
- Trigger after successful purchase
- Send order confirmation and thank you
- Request product review after {review_delay}
- Cross-sell related products
- Encourage repeat purchase with {upsell_offer}

{additional_instructions}`,
    variables: ['review_delay', 'upsell_offer', 'additional_instructions'],
  },

  winBack: {
    name: 'Win Back Campaign',
    description: 'Re-engage inactive or lapsed customers',
    template: `Create a win-back campaign for inactive customers.

The workflow should:
- Trigger when customer hasn't purchased in {inactive_days} days
- Start with a gentle "we miss you" message
- Progress to more attractive offers
- Include final {final_incentive} offer
- Only target customers who haven't engaged with recent campaigns

Message progression:
1. Friendly reminder (no offer)
2. Small discount ({small_discount})
3. Better offer ({medium_discount})
4. Final push ({final_incentive})

{additional_instructions}`,
    variables: [
      'inactive_days',
      'small_discount',
      'medium_discount',
      'final_incentive',
      'additional_instructions',
    ],
  },

  birthday: {
    name: 'Birthday Campaign',
    description: 'Send birthday greetings and special offers',
    template: `Create a birthday workflow.

The workflow should:
- Trigger on customer's birthday
- Send warm birthday wishes
- Include a special birthday offer valid for {validity_days} days
- {include_special_treatment}

{additional_instructions}`,
    variables: ['validity_days', 'include_special_treatment', 'additional_instructions'],
  },

  priceDrop: {
    name: 'Price Drop Alert',
    description: 'Notify customers about price reductions on items they viewed or saved',
    template: `Create a price drop notification workflow.

The workflow should:
- Trigger when tracked product prices drop by {min_drop_percent}%
- Target customers who viewed or saved the product
- Send notification within {notification_timing} of price change
- Include the new price and savings amount
- Add urgency with {urgency_element}

{additional_instructions}`,
    variables: ['min_drop_percent', 'notification_timing', 'urgency_element', 'additional_instructions'],
  },

  backInStock: {
    name: 'Back in Stock Alert',
    description: 'Notify customers when out-of-stock items become available',
    template: `Create a back-in-stock notification workflow.

The workflow should:
- Trigger when product becomes available after being out of stock
- Target customers who showed interest (viewed, waited, or saved)
- Send immediate notification
- Include {additional_info} about availability
- Add limited-time aspect with {urgency_element}

{additional_instructions}`,
    variables: ['additional_info', 'urgency_element', 'additional_instructions'],
  },

  reengagement: {
    name: 'Re-engagement Campaign',
    description: 'Win back customers who haven't engaged recently',
    template: `Create a re-engagement workflow for disengaged customers.

The workflow should:
- Trigger when customer hasn't opened/clicked in {inactive_days} days
- Start with a recap of what they've missed
- Highlight popular products/content
- Offer {incentive} to re-engage
- Give option to update preferences
- Clean up inactive subscribers after {final_step}

{additional_instructions}`,
    variables: ['inactive_days', 'incentive', 'final_step', 'additional_instructions'],
  },

  promotional: {
    name: 'Promotional Campaign',
    description: 'Promote sales, events, or special offers',
    template: `Create a promotional campaign workflow for {campaign_name}.

The campaign should:
- Trigger {trigger_type}
- Build anticipation before launch (if applicable)
- Send launch announcement
- Create urgency with {urgency_element}
- Include multiple touchpoints: {touchpoints}
- End with post-campaign follow-up

{additional_instructions}`,
    variables: ['campaign_name', 'trigger_type', 'urgency_element', 'touchpoints', 'additional_instructions'],
  },
};

/**
 * Fill a template with variables
 */
export function fillTemplate(template: string, variables: Record<string, string>): string {
  let filledTemplate = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    filledTemplate = filledTemplate.replace(regex, value);
  }

  // Remove any unfilled placeholders
  filledTemplate = filledTemplate.replace(/\{[a-z_]+\}/gi, '');

  return filledTemplate.trim();
}

/**
 * Get available template names
 */
export function getTemplateNames(): string[] {
  return Object.keys(PROMPT_TEMPLATES);
}

/**
 * Get template by name
 */
export function getTemplate(name: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES[name];
}

export default PROMPT_TEMPLATES;
