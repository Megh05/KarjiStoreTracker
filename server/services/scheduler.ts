import * as cron from 'node-cron';
import { vectorStorage } from './vector-storage';
import { contentParser } from './content-parser';
import { ragService } from './rag-service';

interface FeedSyncResult {
  success: boolean;
  message: string;
}

export class SchedulerService {
  private static instance: SchedulerService;
  private scheduledJobs = new Map<string, cron.ScheduledTask>();
  private feedSyncJobs = new Map<number, cron.ScheduledTask>();

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  async initialize() {
    console.log('🔄 Initializing scheduler service...');
    
    try {
      // Load all merchant feeds and schedule sync jobs
      const feeds = await vectorStorage.getMerchantFeeds();
      
      for (const feed of feeds) {
        await this.scheduleFeedSync(feed);
      }
      
      console.log(`✓ Scheduled sync for ${feeds.length} merchant feeds`);
      
      // Schedule a daily job to check for new feeds or interval changes
      this.scheduleJob('feed-sync-maintenance', '0 0 * * *', async () => {
        await this.updateFeedSyncSchedules();
      });
      
      console.log('✓ Scheduler service initialized');
    } catch (error) {
      console.error('❌ Error initializing scheduler:', error);
    }
  }

  private scheduleJob(name: string, pattern: string, task: () => Promise<void>) {
    if (this.scheduledJobs.has(name)) {
      this.scheduledJobs.get(name)?.stop();
      this.scheduledJobs.delete(name);
    }

    const job = cron.schedule(pattern, async () => {
      try {
        console.log(`🔄 Running scheduled task: ${name}`);
        await task();
        console.log(`✓ Completed scheduled task: ${name}`);
      } catch (error) {
        console.error(`❌ Error in scheduled task ${name}:`, error);
      }
    });

    this.scheduledJobs.set(name, job);
    console.log(`✓ Scheduled job: ${name} (${pattern})`);
  }

  private async scheduleFeedSync(feed: any) {
    // Convert interval from seconds to cron expression
    // Default is 3 hours (10800 seconds)
    const intervalSeconds = feed.syncInterval || 10800;
    const intervalHours = Math.max(1, Math.floor(intervalSeconds / 3600));
    
    // Create cron pattern based on interval
    // For intervals less than 1 hour, use minutes
    let cronPattern;
    if (intervalHours < 1) {
      const intervalMinutes = Math.max(5, Math.floor(intervalSeconds / 60)); // Minimum 5 minutes
      cronPattern = `*/${intervalMinutes} * * * *`;
    } else {
      cronPattern = `0 */${intervalHours} * * *`;
    }
    
    // Cancel existing job if it exists
    if (this.feedSyncJobs.has(feed.id)) {
      this.feedSyncJobs.get(feed.id)?.stop();
      this.feedSyncJobs.delete(feed.id);
    }
    
    // Schedule new job
    const job = cron.schedule(cronPattern, async () => {
      try {
        console.log(`🔄 Syncing merchant feed: ${feed.name} (ID: ${feed.id})`);
        await this.triggerFeedSync(feed.id);
      } catch (error) {
        console.error(`❌ Error syncing feed ${feed.name}:`, error);
      }
    });
    
    this.feedSyncJobs.set(feed.id, job);
    console.log(`✓ Scheduled feed sync: ${feed.name} (ID: ${feed.id}) with pattern: ${cronPattern}`);
    
    // Run initial sync
    setTimeout(async () => {
      try {
        console.log(`🔄 Running initial sync for feed: ${feed.name} (ID: ${feed.id})`);
        await this.triggerFeedSync(feed.id);
      } catch (error) {
        console.error(`❌ Error in initial sync for feed ${feed.name}:`, error);
      }
    }, 5000); // Wait 5 seconds before initial sync
  }

  async updateFeedSyncSchedules() {
    try {
      console.log('🔄 Updating feed sync schedules...');
      
      // Get all active feeds
      const feeds = await vectorStorage.getMerchantFeeds();
      
      // Get current scheduled feed IDs
      const scheduledFeedIds = Array.from(this.feedSyncJobs.keys());
      
      // Schedule new feeds
      for (const feed of feeds) {
        if (!this.feedSyncJobs.has(feed.id)) {
          await this.scheduleFeedSync(feed);
        }
      }
      
      // Remove schedules for deleted feeds
      const activeFeedIds = feeds.map(feed => feed.id);
      for (const feedId of scheduledFeedIds) {
        if (!activeFeedIds.includes(feedId)) {
          if (this.feedSyncJobs.has(feedId)) {
            this.feedSyncJobs.get(feedId)?.stop();
            this.feedSyncJobs.delete(feedId);
            console.log(`✓ Removed sync schedule for deleted feed ID: ${feedId}`);
          }
        }
      }
      
      console.log('✓ Feed sync schedules updated');
    } catch (error) {
      console.error('❌ Error updating feed sync schedules:', error);
    }
  }

  // Remove the entire syncFeed method since we're no longer using it
  // private async syncFeed(feed: any) {
  //   try {
  //     console.log(`🔄 Syncing merchant feed: ${feed.name}`);
  //     
  //     // Fetch XML content
  //     const response = await fetch(feed.feedUrl);
  //     if (!response.ok) {
  //       throw new Error(`Failed to fetch feed ${feed.name}: ${response.statusText}`);
  //     }
  //     
  //     const xmlContent = await response.text();
  //     
  //     // Parse products from XML
  //     const { products, metadata } = await contentParser.parseGoogleMerchantXML(xmlContent);
  //     
  //     // Truncate all products before adding new ones
  //     await vectorStorage.truncateAllProducts();
  //     
  //     // Process and store products
  //     await contentParser.processProductsAndStore(
  //       products.map(product => ({
  //         ...product,
  //         metadata: {
  //           ...product.metadata,
  //           feedId: feed.id,
  //           feedName: feed.name,
  //           lastSyncedAt: new Date().toISOString()
  //         }
  //       }))
  //     );
  //     
  //     // Update last synced timestamp
  //     await vectorStorage.updateMerchantFeed(feed.id, {
  //       lastSyncedAt: new Date()
  //     });
  //     
  //     console.log(`✓ Synced ${products.length} products from ${feed.name}`);
  //     
  //   } catch (error) {
  //     console.error(`❌ Error syncing feed ${feed.name}:`, error);
  //     
  //     // Update feed with error information
  //     try {
  //       await vectorStorage.updateMerchantFeed(feed.id, {
  //         lastSyncedAt: new Date()
  //       });
  //     } catch (updateError) {
  //       console.error(`❌ Error updating feed status:`, updateError);
  //     }
  //   }
  // }

  async syncMerchantFeeds() {
    try {
      const feeds = await vectorStorage.getMerchantFeeds();
      
      if (feeds.length > 0) {
        // Truncate all products before syncing any feeds
        await vectorStorage.truncateAllProducts();
        
        // Create an array to store all products from all feeds
        let allProducts: any[] = [];
        
        // First collect all products from all feeds
        for (const feed of feeds) {
          try {
            console.log(`🔄 Collecting products from feed: ${feed.name}`);
            
            // Fetch XML content
            const response = await fetch(feed.feedUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch feed ${feed.name}: ${response.statusText}`);
            }
            
            const xmlContent = await response.text();
            
            // Parse products from XML
            const { products, metadata } = await contentParser.parseGoogleMerchantXML(xmlContent);
            
            // Add feed information to products
            const productsWithFeedInfo = products.map(product => ({
              ...product,
              metadata: {
                ...product.metadata,
                feedId: feed.id,
                feedName: feed.name,
                lastSyncedAt: new Date().toISOString()
              }
            }));
            
            // Add to all products array
            allProducts = [...allProducts, ...productsWithFeedInfo];
            
            // Update last synced timestamp
            await vectorStorage.updateMerchantFeed(feed.id, {
              lastSyncedAt: new Date()
            });
            
            console.log(`✓ Collected ${products.length} products from ${feed.name}`);
          } catch (error) {
            console.error(`❌ Error processing feed ${feed.name}:`, error);
          }
        }
        
        // Then store all products at once
        if (allProducts.length > 0) {
          console.log(`🔄 Storing ${allProducts.length} total products from all feeds`);
          await contentParser.processProductsAndStore(allProducts);
          console.log(`✓ Successfully stored all products`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error in merchant feed sync:', error);
    }
  }

  // Manual trigger for immediate sync
  async triggerMerchantFeedSync() {
    console.log('🔄 Manually triggered merchant feed sync');
    await this.syncMerchantFeeds();
  }

  // Manual trigger for specific feed
  async triggerFeedSync(feedId: number): Promise<FeedSyncResult> {
    try {
      const feeds = await vectorStorage.getMerchantFeeds();
      const feed = feeds.find(f => f.id === feedId);
      
      if (!feed) {
        throw new Error(`Feed with ID ${feedId} not found`);
      }
      
      console.log(`🔄 Manually triggered sync for feed: ${feed.name} (ID: ${feedId})`);
      
      // Truncate all products before syncing
      await vectorStorage.truncateAllProducts();
      
      // Fetch XML content
      const response = await fetch(feed.feedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch feed ${feed.name}: ${response.statusText}`);
      }
      
      const xmlContent = await response.text();
      
      // Parse products from XML
      const { products, metadata } = await contentParser.parseGoogleMerchantXML(xmlContent);
      
      // Add feed information to products and store them
      const productsWithFeedInfo = products.map(product => ({
        ...product,
        metadata: {
          ...product.metadata,
          feedId: feed.id,
          feedName: feed.name,
          lastSyncedAt: new Date().toISOString()
        }
      }));
      
      // Store all products
      await contentParser.processProductsAndStore(productsWithFeedInfo);
      
      // Update last synced timestamp
      await vectorStorage.updateMerchantFeed(feed.id, {
        lastSyncedAt: new Date()
      });
      
      console.log(`✓ Synced ${products.length} products from ${feed.name}`);
      
      return {
        success: true,
        message: `Successfully synced feed: ${feed.name} (${products.length} products)`
      };
    } catch (error) {
      console.error(`❌ Error triggering feed sync:`, error);
      throw error;
    }
  }

  // Stop all scheduled jobs
  stopAll() {
    this.scheduledJobs.forEach((job, name) => {
      job.stop();
      console.log(`🛑 Stopped scheduled job: ${name}`);
    });
    this.scheduledJobs.clear();
    
    this.feedSyncJobs.forEach((job, feedId) => {
      job.stop();
      console.log(`🛑 Stopped feed sync job for feed ID: ${feedId}`);
    });
    this.feedSyncJobs.clear();
  }

  // Get status of all jobs
  getJobsStatus() {
    const regularJobs = Array.from(this.scheduledJobs.entries()).map(([name, job]) => ({
      name,
      running: true // All jobs in this map are running
    }));
    
    const feedJobs = Array.from(this.feedSyncJobs.entries()).map(([feedId, job]) => ({
      name: `feed-sync-${feedId}`,
      feedId,
      running: true // All jobs in this map are running
    }));
    
    return {
      regularJobs,
      feedJobs,
      totalRunning: regularJobs.length + feedJobs.length
    };
  }
}

export const schedulerService = SchedulerService.getInstance();