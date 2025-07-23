import cron from 'node-cron';
import { storage } from '../storage';
import { contentParser } from './content-parser';
import { vectorService } from './vector-service';

export class SchedulerService {
  private static instance: SchedulerService;
  private scheduledJobs = new Map<string, cron.ScheduledTask>();

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  async initialize() {
    console.log('🔄 Initializing scheduler service...');
    
    // Schedule merchant feed sync every 3 hours
    this.scheduleJob('merchant-feeds-sync', '0 */3 * * *', async () => {
      await this.syncMerchantFeeds();
    });
    
    console.log('✓ Scheduler service initialized');
  }

  private scheduleJob(name: string, pattern: string, task: () => Promise<void>) {
    if (this.scheduledJobs.has(name)) {
      this.scheduledJobs.get(name)?.destroy();
    }

    const job = cron.schedule(pattern, async () => {
      try {
        console.log(`🔄 Running scheduled task: ${name}`);
        await task();
        console.log(`✓ Completed scheduled task: ${name}`);
      } catch (error) {
        console.error(`❌ Error in scheduled task ${name}:`, error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.scheduledJobs.set(name, job);
    console.log(`✓ Scheduled job: ${name} (${pattern})`);
  }

  async syncMerchantFeeds() {
    try {
      const feeds = await storage.getMerchantFeeds();
      
      for (const feed of feeds) {
        try {
          console.log(`🔄 Syncing merchant feed: ${feed.name}`);
          
          // Fetch XML content
          const response = await fetch(feed.feedUrl);
          if (!response.ok) {
            console.error(`Failed to fetch feed ${feed.name}: ${response.statusText}`);
            continue;
          }
          
          const xmlContent = await response.text();
          
          // Parse products from XML
          const { products } = await contentParser.parseGoogleMerchantXML(xmlContent);
          
          // Clear existing products for this feed (in a real implementation, you'd want to be more selective)
          // For now, we'll add all products with feed metadata
          
          // Process and store products
          await contentParser.processProductsAndStore(
            products.map(product => ({
              ...product,
              metadata: {
                ...product.metadata,
                feedId: feed.id,
                feedName: feed.name,
                lastSyncedAt: new Date().toISOString()
              }
            }))
          );
          
          // Update last synced timestamp
          await storage.updateMerchantFeed(feed.id, {
            lastSyncedAt: new Date()
          });
          
          console.log(`✓ Synced ${products.length} products from ${feed.name}`);
          
        } catch (error) {
          console.error(`❌ Error syncing feed ${feed.name}:`, error);
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

  // Stop all scheduled jobs
  stopAll() {
    for (const [name, job] of this.scheduledJobs) {
      job.destroy();
      console.log(`🛑 Stopped scheduled job: ${name}`);
    }
    this.scheduledJobs.clear();
  }

  // Get status of all jobs
  getJobsStatus() {
    const jobs = Array.from(this.scheduledJobs.entries()).map(([name, job]) => ({
      name,
      running: job.getStatus() === 'scheduled'
    }));
    
    return jobs;
  }
}

export const schedulerService = SchedulerService.getInstance();