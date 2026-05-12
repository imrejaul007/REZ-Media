import { logger } from '../config/logger';

export interface Lead {
  id: string;
  instagramId: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  email?: string;
  phone?: string;
  source: 'dm' | 'comment' | 'story_mention' | 'story_reply';
  interests: string[];
  budget?: {
    min?: number;
    max?: number;
    currency: string;
  };
  tags: string[];
  engagement: LeadEngagement;
  createdAt: Date;
  updatedAt: Date;
  lastContacted?: Date;
  status: LeadStatus;
  notes: string[];
  conversationContext?: string;
}

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'engaged'
  | 'qualified'
  | 'nurturing'
  | 'converted'
  | 'disqualified';

export interface LeadEngagement {
  totalMessages: number;
  productsViewed: string[];
  questionsAsked: number;
  cartAbandons: number;
  lastInteraction?: Date;
  interactionHistory: InteractionRecord[];
}

export interface InteractionRecord {
  type: 'message' | 'comment' | 'story_view' | 'product_click' | 'cart_add';
  timestamp: Date;
  details?: string;
}

export class LeadCaptureService {
  private leads: Map<string, Lead> = new Map();

  generateLeadId(instagramId: string): string {
    return `lead_${instagramId}_${Date.now()}`;
  }

  createLead(
    instagramId: string,
    username: string,
    displayName: string,
    source: Lead['source'],
    profilePicture?: string
  ): Lead {
    const existingLead = this.findByInstagramId(instagramId);

    if (existingLead) {
      existingLead.updatedAt = new Date();
      logger.info('Existing lead updated', { leadId: existingLead.id });
      return existingLead;
    }

    const lead: Lead = {
      id: this.generateLeadId(instagramId),
      instagramId,
      username,
      displayName,
      profilePicture,
      source,
      interests: [],
      tags: [],
      engagement: {
        totalMessages: 0,
        productsViewed: [],
        questionsAsked: 0,
        cartAbandons: 0,
        interactionHistory: []
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'new',
      notes: []
    };

    this.leads.set(lead.id, lead);
    logger.info('New lead captured', { leadId: lead.id, username });

    return lead;
  }

  findByInstagramId(instagramId: string): Lead | undefined {
    for (const lead of this.leads.values()) {
      if (lead.instagramId === instagramId) {
        return lead;
      }
    }
    return undefined;
  }

  findById(leadId: string): Lead | undefined {
    return this.leads.get(leadId);
  }

  updateContactInfo(
    leadId: string,
    contactInfo: { email?: string; phone?: string }
  ): boolean {
    const lead = this.leads.get(leadId);
    if (!lead) return false;

    if (contactInfo.email) lead.email = contactInfo.email;
    if (contactInfo.phone) lead.phone = contactInfo.phone;

    lead.updatedAt = new Date();
    logger.debug('Lead contact info updated', { leadId });

    return true;
  }

  addInterest(leadId: string, interest: string): boolean {
    const lead = this.leads.get(leadId);
    if (!lead) return false;

    const normalizedInterest = interest.toLowerCase().trim();
    if (!lead.interests.includes(normalizedInterest)) {
      lead.interests.push(normalizedInterest);
      lead.updatedAt = new Date();
    }

    return true;
  }

  addTag(leadId: string, tag: string): boolean {
    const lead = this.leads.get(leadId);
    if (!lead) return false;

    const normalizedTag = tag.toLowerCase().trim();
    if (!lead.tags.includes(normalizedTag)) {
      lead.tags.push(normalizedTag);
      lead.updatedAt = new Date();
    }

    return true;
  }

  recordInteraction(
    leadId: string,
    type: InteractionRecord['type'],
    details?: string
  ): boolean {
    const lead = this.leads.get(leadId);
    if (!lead) return false;

    const interaction: InteractionRecord = {
      type,
      timestamp: new Date(),
      details
    };

    lead.engagement.interactionHistory.push(interaction);
    lead.engagement.lastInteraction = new Date();
    lead.lastContacted = new Date();
    lead.updatedAt = new Date();

    // Update engagement metrics
    switch (type) {
      case 'message':
        lead.engagement.totalMessages++;
        break;
      case 'product_click':
        if (details) {
          lead.engagement.productsViewed.push(details);
        }
        break;
      case 'comment':
        lead.engagement.questionsAsked++;
        break;
      case 'cart_add':
        // Could trigger nurture sequence
        break;
      case 'story_view':
        // Add to engagement score
        break;
    }

    return true;
  }

  updateStatus(leadId: string, status: LeadStatus): boolean {
    const lead = this.leads.get(leadId);
    if (!lead) return false;

    const previousStatus = lead.status;
    lead.status = status;
    lead.updatedAt = new Date();

    logger.info('Lead status updated', {
      leadId,
      from: previousStatus,
      to: status
    });

    return true;
  }

  addNote(leadId: string, note: string): boolean {
    const lead = this.leads.get(leadId);
    if (!lead) return false;

    lead.notes.push(`[${new Date().toISOString()}] ${note}`);
    lead.updatedAt = new Date();

    return true;
  }

  setBudget(leadId: string, min?: number, max?: number, currency: string = 'USD'): boolean {
    const lead = this.leads.get(leadId);
    if (!lead) return false;

    lead.budget = { min, max, currency };
    lead.updatedAt = new Date();

    return true;
  }

  getLeadsByStatus(status: LeadStatus): Lead[] {
    return Array.from(this.leads.values()).filter(lead => lead.status === status);
  }

  getLeadsByTag(tag: string): Lead[] {
    const normalizedTag = tag.toLowerCase();
    return Array.from(this.leads.values()).filter(lead =>
      lead.tags.includes(normalizedTag)
    );
  }

  getLeadsByInterest(interest: string): Lead[] {
    const normalizedInterest = interest.toLowerCase();
    return Array.from(this.leads.values()).filter(lead =>
      lead.interests.includes(normalizedInterest)
    );
  }

  getAbandonedCarts(daysThreshold: number = 3): Lead[] {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysThreshold);

    return Array.from(this.leads.values()).filter(lead => {
      if (lead.engagement.cartAbandons === 0) return false;

      const lastInteraction = lead.engagement.lastInteraction;
      if (!lastInteraction) return false;

      return lastInteraction >= threshold;
    });
  }

  getQualifiedLeads(): Lead[] {
    return Array.from(this.leads.values()).filter(lead =>
      lead.status === 'qualified' ||
      lead.status === 'engaged' ||
      lead.budget?.max !== undefined
    );
  }

  scoreLead(leadId: string): number {
    const lead = this.leads.get(leadId);
    if (!lead) return 0;

    let score = 0;

    // Engagement score (0-30 points)
    score += Math.min(lead.engagement.totalMessages * 2, 15);
    score += Math.min(lead.engagement.productsViewed.length * 3, 10);
    score += lead.engagement.questionsAsked * 2;

    // Intent signals (0-40 points)
    if (lead.engagement.cartAbandons > 0) score += 15;
    if (lead.interests.length >= 3) score += 10;
    if (lead.engagement.productsViewed.length >= 3) score += 15;

    // Contact info completeness (0-15 points)
    if (lead.email) score += 8;
    if (lead.phone) score += 7;

    // Budget indicator (0-15 points)
    if (lead.budget?.max) {
      if (lead.budget.max >= 100) score += 15;
      else if (lead.budget.max >= 50) score += 10;
      else score += 5;
    }

    return Math.min(score, 100);
  }

  exportLeads(): Lead[] {
    return Array.from(this.leads.values());
  }

  getStats(): {
    total: number;
    byStatus: Record<LeadStatus, number>;
    bySource: Record<string, number>;
    averageScore: number;
  } {
    const leads = Array.from(this.leads.values());

    const byStatus: Record<LeadStatus, number> = {
      new: 0,
      contacted: 0,
      engaged: 0,
      qualified: 0,
      nurturing: 0,
      converted: 0,
      disqualified: 0
    };

    const bySource: Record<string, number> = {};

    let totalScore = 0;

    for (const lead of leads) {
      byStatus[lead.status]++;
      bySource[lead.source] = (bySource[lead.source] || 0) + 1;
      totalScore += this.scoreLead(lead.id);
    }

    return {
      total: leads.length,
      byStatus,
      bySource,
      averageScore: leads.length > 0 ? Math.round(totalScore / leads.length) : 0
    };
  }
}

export const leadCaptureService = new LeadCaptureService();
