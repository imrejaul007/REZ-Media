/**
 * DOOH Service - Database Migration Manager
 *
 * Manages database schema migrations.
 */

import mongoose from 'mongoose';
import { ScreenModel, CampaignModel } from './schemas';

// ============================================================================
// Migration Definitions
// ============================================================================

interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
}

const migrations: Migration[] = [
  // ==========================================================================
  // Migration 001: Initial Schema
  // ==========================================================================
  {
    version: 1,
    name: 'initial_schema',
    up: async () => {
      console.log('[Migration 001] Creating initial schema...');

      // Create indexes for screens
      await ScreenModel.collection.createIndex(
        { screenId: 1 },
        { unique: true, background: true }
      );
      await ScreenModel.collection.createIndex(
        { ownerId: 1 },
        { background: true }
      );
      await ScreenModel.collection.createIndex(
        { status: 1, type: 1 },
        { background: true }
      );
      await ScreenModel.collection.createIndex(
        { 'location.city': 1, 'location.area': 1 },
        { background: true }
      );

      // Create indexes for campaigns
      await CampaignModel.collection.createIndex(
        { campaignId: 1 },
        { unique: true, background: true }
      );
      await CampaignModel.collection.createIndex(
        { merchantId: 1, status: 1 },
        { background: true }
      );
      await CampaignModel.collection.createIndex(
        { status: 1, startDate: 1, endDate: 1 },
        { background: true }
      );

      console.log('[Migration 001] Complete');
    },
  },

  // ==========================================================================
  // Migration 002: Add API Key Hash Field
  // ==========================================================================
  {
    version: 2,
    name: 'add_api_key_hash',
    up: async () => {
      console.log('[Migration 002] Adding apiKeyHash field...');

      await ScreenModel.updateMany(
        { apiKeyHash: { $exists: false } },
        { $set: { apiKeyHash: '' } }
      );

      console.log('[Migration 002] Complete');
    },
    down: async () => {
      console.log('[Migration 002] Rolling back...');
      await ScreenModel.updateMany(
        {},
        { $unset: { apiKeyHash: '' } }
      );
      console.log('[Migration 002] Rollback complete');
    },
  },

  // ==========================================================================
  // Migration 003: Add Earnings Fields
  // ==========================================================================
  {
    version: 3,
    name: 'add_earnings_fields',
    up: async () => {
      console.log('[Migration 003] Adding earnings fields...');

      await ScreenModel.updateMany(
        { earningsBalance: { $exists: false } },
        { $set: { earningsBalance: 0, earningsPaid: 0 } }
      );

      await ScreenModel.updateMany(
        { totalImpressions: { $exists: false } },
        { $set: { totalImpressions: 0, totalScans: 0 } }
      );

      console.log('[Migration 003] Complete');
    },
  },

  // ==========================================================================
  // Migration 004: Add Playlist Version
  // ==========================================================================
  {
    version: 4,
    name: 'add_playlist_version',
    up: async () => {
      console.log('[Migration 004] Adding playlistVersion field...');

      await ScreenModel.updateMany(
        { playlistVersion: { $exists: false } },
        { $set: { playlistVersion: 0 } }
      );

      console.log('[Migration 004] Complete');
    },
  },

  // ==========================================================================
  // Migration 005: Add Compound Indexes for Queries
  // ==========================================================================
  {
    version: 5,
    name: 'add_compound_indexes',
    up: async () => {
      console.log('[Migration 005] Adding compound indexes...');

      // Dashboard query index
      await ScreenModel.collection.createIndex(
        { ownerId: 1, status: 1, createdAt: -1 },
        { background: true }
      );

      // Campaign targeting index
      await CampaignModel.collection.createIndex(
        { 'targeting.cities': 1, status: 1 },
        { background: true }
      );

      // Campaign date range index
      await CampaignModel.collection.createIndex(
        { startDate: 1, endDate: 1, status: 1 },
        { background: true }
      );

      console.log('[Migration 005] Complete');
    },
  },
];

// ============================================================================
// Migration State
// ============================================================================

const MIGRATION_COLLECTION = '_migrations';

interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: Date;
}

async function getMigrationCollection() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Not connected to database');

  const collection = db.collection(MIGRATION_COLLECTION);
  await collection.createIndex({ version: 1 }, { unique: true });

  return collection;
}

async function getAppliedMigrations(): Promise<MigrationRecord[]> {
  const collection = await getMigrationCollection();
  return collection.find().sort({ version: 1 }).toArray() as Promise<MigrationRecord[]>;
}

async function recordMigration(migration: Migration): Promise<void> {
  const collection = await getMigrationCollection();
  await collection.insertOne({
    version: migration.version,
    name: migration.name,
    appliedAt: new Date(),
  });
}

async function removeMigration(migration: Migration): Promise<void> {
  const collection = await getMigrationCollection();
  await collection.deleteOne({ version: migration.version });
}

// ============================================================================
// Migration Commands
// ============================================================================

export async function runMigrations(options: { direction?: 'up' | 'down'; targetVersion?: number } = {}): Promise<void> {
  const direction = options.direction || 'up';
  const targetVersion = options.targetVersion;

  // Connect to database
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  console.log(`[Migration] Starting migrations (${direction})...`);

  if (direction === 'up') {
    const applied = await getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));

    // Sort migrations by version
    const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

    for (const migration of sortedMigrations) {
      // Skip if already applied
      if (appliedVersions.has(migration.version)) {
        console.log(`[Migration ${migration.version}] Already applied, skipping`);
        continue;
      }

      // Skip if target version is specified and this is beyond it
      if (targetVersion !== undefined && migration.version > targetVersion) {
        console.log(`[Migration ${migration.version}] Beyond target version, stopping`);
        break;
      }

      console.log(`[Migration ${migration.version}] Running: ${migration.name}`);
      await migration.up();
      await recordMigration(migration);
      console.log(`[Migration ${migration.version}] Complete`);
    }
  } else {
    // Rollback
    const applied = await getAppliedMigrations();
    const sortedApplied = applied.sort((a, b) => b.version - a.version);

    for (const record of sortedApplied) {
      const migration = migrations.find((m) => m.version === record.version);

      if (!migration) {
        console.warn(`[Migration ${record.version}] No migration found, skipping`);
        continue;
      }

      if (!migration.down) {
        console.warn(`[Migration ${record.version}] No down migration, skipping`);
        continue;
      }

      // Stop at target version
      if (targetVersion !== undefined && migration.version <= targetVersion) {
        console.log(`[Migration ${migration.version}] At target version, stopping`);
        break;
      }

      console.log(`[Migration ${migration.version}] Rolling back: ${migration.name}`);
      await migration.down();
      await removeMigration(migration);
      console.log(`[Migration ${migration.version}] Rollback complete`);
    }
  }

  console.log('[Migration] Complete');
}

export async function status(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  const applied = await getAppliedMigrations();
  const appliedVersions = new Set(applied.map((m) => m.version));

  console.log('\n=== Migration Status ===\n');
  console.log('Migration | Status');
  console.log('---------|--------');

  for (const migration of migrations) {
    const applied = appliedVersions.has(migration.version);
    console.log(`${migration.version.toString().padEnd(9)} | ${applied ? 'APPLIED' : 'PENDING'}`);
  }

  console.log(`\nTotal: ${migrations.length} migrations`);
  console.log(`Applied: ${applied.length}`);
  console.log(`Pending: ${migrations.length - applied.length}`);
}

// ============================================================================
// CLI
// ============================================================================

const command = process.argv[2];
const targetVersion = process.argv[3] ? parseInt(process.argv[3]) : undefined;

async function main(): Promise<void> {
  switch (command) {
    case 'up':
      await runMigrations({ direction: 'up', targetVersion });
      break;
    case 'down':
      await runMigrations({ direction: 'down', targetVersion });
      break;
    case 'status':
      await status();
      break;
    default:
      console.log('Usage:');
      console.log('  npm run migrate           # Run all pending migrations');
      console.log('  npm run migrate up       # Run all pending migrations');
      console.log('  npm run migrate up 3      # Migrate to version 3');
      console.log('  npm run migrate down     # Rollback last migration');
      console.log('  npm run migrate down 0   # Rollback all migrations');
      console.log('  npm run migrate status   # Show migration status');
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
