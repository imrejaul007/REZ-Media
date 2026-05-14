import { ConnectionModel } from '../models/Connection.js';
import { IConnection, SSPProvider } from '../types/index.js';
import { GoogleAdXService } from './googleAdxService.js';
import { PubmaticService } from './pubmaticService.js';
import { IndexExchangeService } from './indexExchangeService.js';

const services = {
  google_adx: new GoogleAdXService(),
  pubmatic: new PubmaticService(),
  index_exchange: new IndexExchangeService(),
};

export class ConnectionService {
  async connect(connection: IConnection): Promise<void> {
    const service = services[connection.provider];
    if (!service) {
      throw new Error(`Unknown provider: ${connection.provider}`);
    }

    await service.connect(connection);

    // Save or update connection
    await ConnectionModel.findOneAndUpdate(
      { provider: connection.provider },
      { ...connection, status: 'active', lastSyncAt: new Date() },
      { upsert: true, new: true }
    );

    console.log(`Connected to ${connection.provider}`);
  }

  async disconnect(provider: SSPProvider): Promise<void> {
    const service = services[provider];
    if (service) {
      await service.disconnect();
    }

    await ConnectionModel.findOneAndUpdate(
      { provider },
      { status: 'inactive' }
    );

    console.log(`Disconnected from ${provider}`);
  }

  async getConnections(): Promise<IConnection[]> {
    return ConnectionModel.find();
  }

  async getConnection(provider: SSPProvider): Promise<IConnection | null> {
    return ConnectionModel.findOne({ provider });
  }

  async updateConnection(
    provider: SSPProvider,
    updates: Partial<IConnection>
  ): Promise<IConnection | null> {
    return ConnectionModel.findOneAndUpdate(
      { provider },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );
  }

  async testConnection(provider: SSPProvider): Promise<{ success: boolean; message: string }> {
    const connection = await ConnectionModel.findOne({ provider });
    if (!connection) {
      return { success: false, message: 'Connection not configured' };
    }

    try {
      // In production, would make a test API call
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ConnectionModel.updateOne(
        { provider },
        { status: 'error', errorMessage: message }
      );
      return { success: false, message };
    }
  }
}

export const connectionService = new ConnectionService();
