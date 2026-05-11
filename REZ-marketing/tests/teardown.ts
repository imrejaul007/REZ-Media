/**
 * Jest Global Teardown
 *
 * Cleans up MongoDB Memory Server after all tests complete.
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

module.exports = async () => {
  // Close mongoose connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }

  // Stop MongoDB Memory Server
  if (mongoServer) {
    await mongoServer.stop();
  }
};

// Export for use in setup
export { mongoServer };
