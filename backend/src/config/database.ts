import mongoose from 'mongoose';
import config from './index';
import { logger } from '../utils/logger';

class Database {
  private static instance: Database;
  private isConnected: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    try {
      await this.connectWithRetry();
    } catch (error) {
      logger.error('Failed to connect to database after maximum retries', error);
      throw error;
    }
  }

  private async connectWithRetry(): Promise<void> {
    try {
      await mongoose.connect(config.mongoUri, config.mongoOptions);
      this.isConnected = true;
      this.retryCount = 0;
      logger.info('Successfully connected to MongoDB');
      
      // Set up connection event listeners
      this.setupEventListeners();
    } catch (error) {
      this.retryCount++;
      logger.error(`Database connection attempt ${this.retryCount} failed:`, error);

      if (this.retryCount < this.maxRetries) {
        logger.info(`Retrying database connection in ${this.retryDelay / 1000} seconds...`);
        await this.delay(this.retryDelay);
        return this.connectWithRetry();
      } else {
        throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
      }
    }
  }

  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      logger.error('Mongoose connection error:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.info('Database already disconnected');
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      if (!this.isConnected) {
        return {
          status: 'error',
          message: 'Database not connected'
        };
      }

      // Perform a simple ping to check connection
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      } else {
        throw new Error('Database connection not established');
      }
      
      return {
        status: 'healthy',
        message: 'Database connection is healthy'
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'error',
        message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default Database.getInstance();
