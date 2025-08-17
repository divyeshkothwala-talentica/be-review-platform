#!/usr/bin/env ts-node

import database from '../src/config/database';
import { seedAllData, resetDatabase, clearAllData } from '../src/utils/seedData';
import { logger } from '../src/utils/logger';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'seed';

async function runSeedScript() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await database.connect();
    
    switch (command) {
      case 'seed':
        logger.info('Running seed command...');
        await seedAllData();
        break;
        
      case 'reset':
        logger.info('Running reset command...');
        await resetDatabase();
        break;
        
      case 'clear':
        logger.info('Running clear command...');
        await clearAllData();
        break;
        
      default:
        logger.error(`Unknown command: ${command}`);
        logger.info('Available commands: seed, reset, clear');
        process.exit(1);
    }
    
    logger.info('Seed script completed successfully!');
    
  } catch (error) {
    logger.error('Seed script failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from database
    try {
      await database.disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
    
    process.exit(0);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { promise, reason });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  process.exit(1);
});

// Run the script
runSeedScript();
