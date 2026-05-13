import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import {
  Platform,
  IFieldMapping,
  ISlaMapping,
  IAgentMapping,
  TicketPriority,
} from '../types';

// In-memory storage for mappings (in production, use MongoDB)
const fieldMappings = new Map<string, IFieldMapping[]>();
const slaMappings = new Map<string, ISlaMapping[]>();
const agentMappings = new Map<string, IAgentMapping[]>();

export interface FieldMappingInput {
  platform: Platform;
  fieldName: string;
  targetField: string;
  transformType?: 'direct' | 'mapping' | 'function';
  transformConfig?: Record<string, unknown>;
}

export interface SlaMappingInput {
  platform: Platform;
  platformSlaName: string;
  targetPriority: TicketPriority;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
}

export interface AgentMappingInput {
  platform: Platform;
  platformAgentId: string;
  platformAgentName: string;
  platformAgentEmail: string;
  rezUserId?: string;
}

export class MappingService {
  constructor() {
    this.initializeDefaultMappings();
  }

  private initializeDefaultMappings(): void {
    // Zendesk default field mappings
    this.setFieldMappings('zendesk', [
      {
        id: uuidv4(),
        platform: 'zendesk',
        fieldName: 'subject',
        targetField: 'subject',
        transformType: 'direct',
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'zendesk',
        fieldName: 'description',
        targetField: 'description',
        transformType: 'direct',
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'zendesk',
        fieldName: 'status',
        targetField: 'status',
        transformType: 'mapping',
        transformConfig: {
          'new': 'open',
          'open': 'open',
          'pending': 'pending',
          'hold': 'on_hold',
          'solved': 'solved',
          'closed': 'closed',
        },
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'zendesk',
        fieldName: 'priority',
        targetField: 'priority',
        transformType: 'mapping',
        transformConfig: {
          'low': 'low',
          'normal': 'normal',
          'high': 'high',
          'urgent': 'urgent',
        },
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'zendesk',
        fieldName: 'tags',
        targetField: 'tags',
        transformType: 'direct',
        isActive: true,
      },
    ]);

    // Freshdesk default field mappings
    this.setFieldMappings('freshdesk', [
      {
        id: uuidv4(),
        platform: 'freshdesk',
        fieldName: 'subject',
        targetField: 'subject',
        transformType: 'direct',
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'freshdesk',
        fieldName: 'description',
        targetField: 'description',
        transformType: 'direct',
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'freshdesk',
        fieldName: 'status',
        targetField: 'status',
        transformType: 'mapping',
        transformConfig: {
          '2': 'open',
          '3': 'pending',
          '4': 'on_hold',
          '5': 'solved',
          '6': 'closed',
        },
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'freshdesk',
        fieldName: 'priority',
        targetField: 'priority',
        transformType: 'mapping',
        transformConfig: {
          '1': 'low',
          '2': 'normal',
          '3': 'high',
          '4': 'urgent',
        },
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'freshdesk',
        fieldName: 'tags',
        targetField: 'tags',
        transformType: 'direct',
        isActive: true,
      },
    ]);

    // Intercom default field mappings
    this.setFieldMappings('intercom', [
      {
        id: uuidv4(),
        platform: 'intercom',
        fieldName: 'title',
        targetField: 'subject',
        transformType: 'direct',
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'intercom',
        fieldName: 'source.body',
        targetField: 'description',
        transformType: 'direct',
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'intercom',
        fieldName: 'state',
        targetField: 'status',
        transformType: 'mapping',
        transformConfig: {
          'open': 'open',
          'closed': 'closed',
          'snoozed': 'on_hold',
        },
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'intercom',
        fieldName: 'statistics.priority',
        targetField: 'priority',
        transformType: 'mapping',
        transformConfig: {
          'priority': 'urgent',
          'not_priority': 'normal',
        },
        isActive: true,
      },
    ]);

    // Default SLA mappings
    this.setSlaMappings('zendesk', [
      {
        id: uuidv4(),
        platform: 'zendesk',
        platformSlaName: 'Business Critical',
        targetPriority: 'urgent',
        responseTimeMinutes: 15,
        resolutionTimeMinutes: 240,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'zendesk',
        platformSlaName: 'High',
        targetPriority: 'high',
        responseTimeMinutes: 60,
        resolutionTimeMinutes: 480,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'zendesk',
        platformSlaName: 'Medium',
        targetPriority: 'normal',
        responseTimeMinutes: 240,
        resolutionTimeMinutes: 1440,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'zendesk',
        platformSlaName: 'Low',
        targetPriority: 'low',
        responseTimeMinutes: 480,
        resolutionTimeMinutes: 2880,
        isActive: true,
      },
    ]);

    this.setSlaMappings('freshdesk', [
      {
        id: uuidv4(),
        platform: 'freshdesk',
        platformSlaName: 'Urgent',
        targetPriority: 'urgent',
        responseTimeMinutes: 15,
        resolutionTimeMinutes: 240,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'freshdesk',
        platformSlaName: 'High',
        targetPriority: 'high',
        responseTimeMinutes: 60,
        resolutionTimeMinutes: 480,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'freshdesk',
        platformSlaName: 'Medium',
        targetPriority: 'normal',
        responseTimeMinutes: 240,
        resolutionTimeMinutes: 1440,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'freshdesk',
        platformSlaName: 'Low',
        targetPriority: 'low',
        responseTimeMinutes: 480,
        resolutionTimeMinutes: 2880,
        isActive: true,
      },
    ]);

    this.setSlaMappings('intercom', [
      {
        id: uuidv4(),
        platform: 'intercom',
        platformSlaName: 'Urgent',
        targetPriority: 'urgent',
        responseTimeMinutes: 15,
        resolutionTimeMinutes: 60,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'intercom',
        platformSlaName: 'High',
        targetPriority: 'high',
        responseTimeMinutes: 30,
        resolutionTimeMinutes: 240,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'intercom',
        platformSlaName: 'Medium',
        targetPriority: 'normal',
        responseTimeMinutes: 120,
        resolutionTimeMinutes: 480,
        isActive: true,
      },
      {
        id: uuidv4(),
        platform: 'intercom',
        platformSlaName: 'Low',
        targetPriority: 'low',
        responseTimeMinutes: 480,
        resolutionTimeMinutes: 1440,
        isActive: true,
      },
    ]);
  }

  // Field Mappings
  getFieldMappings(platform: Platform): IFieldMapping[] {
    return fieldMappings.get(platform) || [];
  }

  getAllFieldMappings(): Record<Platform, IFieldMapping[]> {
    return {
      zendesk: this.getFieldMappings('zendesk'),
      freshdesk: this.getFieldMappings('freshdesk'),
      intercom: this.getFieldMappings('intercom'),
      rez: [],
    };
  }

  setFieldMappings(platform: Platform, mappings: IFieldMapping[]): void {
    fieldMappings.set(platform, mappings);
  }

  addFieldMapping(platform: Platform, mapping: FieldMappingInput): IFieldMapping {
    const mappings = this.getFieldMappings(platform);
    const newMapping: IFieldMapping = {
      id: uuidv4(),
      ...mapping,
      isActive: true,
    };
    mappings.push(newMapping);
    fieldMappings.set(platform, mappings);
    return newMapping;
  }

  updateFieldMapping(
    platform: Platform,
    mappingId: string,
    updates: Partial<FieldMappingInput>
  ): IFieldMapping | null {
    const mappings = this.getFieldMappings(platform);
    const index = mappings.findIndex((m) => m.id === mappingId);
    if (index === -1) return null;

    mappings[index] = { ...mappings[index], ...updates };
    fieldMappings.set(platform, mappings);
    return mappings[index];
  }

  deleteFieldMapping(platform: Platform, mappingId: string): boolean {
    const mappings = this.getFieldMappings(platform);
    const index = mappings.findIndex((m) => m.id === mappingId);
    if (index === -1) return false;

    mappings.splice(index, 1);
    fieldMappings.set(platform, mappings);
    return true;
  }

  // Transform field value using mapping
  transformFieldValue(
    platform: Platform,
    fieldName: string,
    value: unknown
  ): unknown {
    const mappings = this.getFieldMappings(platform).filter(
      (m) => m.fieldName === fieldName && m.isActive
    );

    if (mappings.length === 0) return value;

    const mapping = mappings[0];

    if (mapping.transformType === 'mapping' && mapping.transformConfig) {
      const key = String(value);
      return mapping.transformConfig[key] ?? value;
    }

    return value;
  }

  // SLA Mappings
  getSlaMappings(platform: Platform): ISlaMapping[] {
    return slaMappings.get(platform) || [];
  }

  getAllSlaMappings(): Record<Platform, ISlaMapping[]> {
    return {
      zendesk: this.getSlaMappings('zendesk'),
      freshdesk: this.getSlaMappings('freshdesk'),
      intercom: this.getSlaMappings('intercom'),
      rez: [],
    };
  }

  setSlaMappings(platform: Platform, mappings: ISlaMapping[]): void {
    slaMappings.set(platform, mappings);
  }

  addSlaMapping(platform: Platform, mapping: SlaMappingInput): ISlaMapping {
    const mappings = this.getSlaMappings(platform);
    const newMapping: ISlaMapping = {
      id: uuidv4(),
      ...mapping,
      isActive: true,
    };
    mappings.push(newMapping);
    slaMappings.set(platform, mappings);
    return newMapping;
  }

  updateSlaMapping(
    platform: Platform,
    mappingId: string,
    updates: Partial<SlaMappingInput>
  ): ISlaMapping | null {
    const mappings = this.getSlaMappings(platform);
    const index = mappings.findIndex((m) => m.id === mappingId);
    if (index === -1) return null;

    mappings[index] = { ...mappings[index], ...updates };
    slaMappings.set(platform, mappings);
    return mappings[index];
  }

  deleteSlaMapping(platform: Platform, mappingId: string): boolean {
    const mappings = this.getSlaMappings(platform);
    const index = mappings.findIndex((m) => m.id === mappingId);
    if (index === -1) return false;

    mappings.splice(index, 1);
    slaMappings.set(platform, mappings);
    return true;
  }

  // Get SLA mapping by platform SLA name
  getSlaMappingByName(
    platform: Platform,
    platformSlaName: string
  ): ISlaMapping | null {
    const mappings = this.getSlaMappings(platform);
    return mappings.find(
      (m) => m.platformSlaName === platformSlaName && m.isActive
    ) || null;
  }

  // Calculate SLA deadline
  calculateSlaDeadline(
    platform: Platform,
    platformSlaName: string,
    fromDate: Date = new Date()
  ): Date | null {
    const mapping = this.getSlaMappingByName(platform, platformSlaName);
    if (!mapping) return null;

    const deadline = new Date(fromDate);
    deadline.setMinutes(deadline.getMinutes() + mapping.resolutionTimeMinutes);
    return deadline;
  }

  // Agent Mappings
  getAgentMappings(platform: Platform): IAgentMapping[] {
    return agentMappings.get(platform) || [];
  }

  getAllAgentMappings(): Record<Platform, IAgentMapping[]> {
    return {
      zendesk: this.getAgentMappings('zendesk'),
      freshdesk: this.getAgentMappings('freshdesk'),
      intercom: this.getAgentMappings('intercom'),
      rez: [],
    };
  }

  setAgentMappings(platform: Platform, mappings: IAgentMapping[]): void {
    agentMappings.set(platform, mappings);
  }

  addAgentMapping(platform: Platform, mapping: AgentMappingInput): IAgentMapping {
    const mappings = this.getAgentMappings(platform);
    const newMapping: IAgentMapping = {
      id: uuidv4(),
      ...mapping,
      isActive: true,
    };
    mappings.push(newMapping);
    agentMappings.set(platform, mappings);
    return newMapping;
  }

  updateAgentMapping(
    platform: Platform,
    mappingId: string,
    updates: Partial<AgentMappingInput>
  ): IAgentMapping | null {
    const mappings = this.getAgentMappings(platform);
    const index = mappings.findIndex((m) => m.id === mappingId);
    if (index === -1) return null;

    mappings[index] = { ...mappings[index], ...updates };
    agentMappings.set(platform, mappings);
    return mappings[index];
  }

  deleteAgentMapping(platform: Platform, mappingId: string): boolean {
    const mappings = this.getAgentMappings(platform);
    const index = mappings.findIndex((m) => m.id === mappingId);
    if (index === -1) return false;

    mappings.splice(index, 1);
    agentMappings.set(platform, mappings);
    return true;
  }

  // Get agent mapping by platform agent ID
  getAgentMappingByPlatformId(
    platform: Platform,
    platformAgentId: string
  ): IAgentMapping | null {
    const mappings = this.getAgentMappings(platform);
    return mappings.find(
      (m) => m.platformAgentId === platformAgentId && m.isActive
    ) || null;
  }

  // Get agent mapping by ReZ user ID
  getAgentMappingByRezUserId(rezUserId: string): IAgentMapping | null {
    for (const platform of ['zendesk', 'freshdesk', 'intercom'] as Platform[]) {
      const mappings = this.getAgentMappings(platform);
      const found = mappings.find(
        (m) => m.rezUserId === rezUserId && m.isActive
      );
      if (found) return found;
    }
    return null;
  }

  // Export all mappings
  exportAllMappings(): {
    fieldMappings: Record<Platform, IFieldMapping[]>;
    slaMappings: Record<Platform, ISlaMapping[]>;
    agentMappings: Record<Platform, IAgentMapping[]>;
  } {
    return {
      fieldMappings: this.getAllFieldMappings(),
      slaMappings: this.getAllSlaMappings(),
      agentMappings: this.getAllAgentMappings(),
    };
  }

  // Import mappings
  importMappings(mappings: {
    fieldMappings?: Record<Platform, IFieldMapping[]>;
    slaMappings?: Record<Platform, ISlaMapping[]>;
    agentMappings?: Record<Platform, IAgentMapping[]>;
  }): void {
    if (mappings.fieldMappings) {
      for (const [platform, platformMappings] of Object.entries(mappings.fieldMappings)) {
        this.setFieldMappings(platform as Platform, platformMappings);
      }
    }

    if (mappings.slaMappings) {
      for (const [platform, platformMappings] of Object.entries(mappings.slaMappings)) {
        this.setSlaMappings(platform as Platform, platformMappings);
      }
    }

    if (mappings.agentMappings) {
      for (const [platform, platformMappings] of Object.entries(mappings.agentMappings)) {
        this.setAgentMappings(platform as Platform, platformMappings);
      }
    }
  }
}

// Singleton instance
let mappingServiceInstance: MappingService | null = null;

export function getMappingService(): MappingService {
  if (!mappingServiceInstance) {
    mappingServiceInstance = new MappingService();
  }
  return mappingServiceInstance;
}

export default MappingService;
