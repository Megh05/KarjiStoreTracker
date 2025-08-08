import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { parseString } from 'xml2js';
import { agenticRagService } from './agentic-rag-service';

// Use the agentic RAG service
const ragService = agenticRagService;

export interface ParsedContent {
  title: string;
  content: string;
  type: string;
  sourceUrl?: string;
  metadata?: Record<string, any>;
}

export class ContentParser {
  async parsePDF(filePath: string, title?: string): Promise<ParsedContent> {
    // PDF parsing temporarily disabled - will implement with different library
    throw new Error('PDF parsing temporarily unavailable. Please use text files or website URLs instead.');
  }

  async parseWebsite(url: string): Promise<ParsedContent> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.statusText}`);
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Remove script and style elements
      $('script, style, nav, footer, aside').remove();
      
      // Extract title
      const title = $('title').text().trim() || $('h1').first().text().trim() || 'Website Content';
      
      // Extract main content
      let content = '';
      
      // Try to find main content area
      const mainSelectors = ['main', '[role="main"]', '.content', '#content', '.post', 'article'];
      let mainContent = '';
      
      for (const selector of mainSelectors) {
        const element = $(selector).first();
        if (element.length && element.text().trim().length > 100) {
          mainContent = element.text().trim();
          break;
        }
      }
      
      // Fallback to body content if no main content found
      if (!mainContent) {
        mainContent = $('body').text().trim();
      }
      
      // Clean up content
      content = mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
      
      return {
        title,
        content,
        type: 'website',
        sourceUrl: url,
        metadata: {
          domain: new URL(url).hostname,
          scrapedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error parsing website:', error);
      throw new Error(`Failed to parse website: ${url}`);
    }
  }

  async parseFAQ(faqData: { question: string; answer: string }[]): Promise<ParsedContent> {
    try {
      const content = faqData
        .map(item => `Q: ${item.question}\nA: ${item.answer}`)
        .join('\n\n');
      
      return {
        title: 'FAQ Content',
        content,
        type: 'faq',
        metadata: {
          totalQuestions: faqData.length,
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error parsing FAQ:', error);
      throw new Error('Failed to parse FAQ data');
    }
  }

  async parseGoogleMerchantXML(xmlContent: string): Promise<{
    products: any[];
    metadata: Record<string, any>;
  }> {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        parseString(xmlContent, {
          explicitArray: false,
          ignoreAttrs: false
        }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      // Navigate the XML structure to find products
      const feed = result.rss?.channel || result.feed || result;
      const items = feed.item || feed.entry || [];
      
      // Ensure items is an array
      const itemsArray = Array.isArray(items) ? items : [items];
      
      const products = itemsArray.map((item: any, index: number) => {
        // Handle different XML structures
        const gNamespace = item['g:'] || item;
        
        // Debug the structure to find price
        console.log(`Processing item ${index}:`, 
          item['g:price'] ? `Has g:price directly: ${item['g:price']}` : 'No direct g:price',
          gNamespace.price ? `Has gNamespace.price: ${gNamespace.price}` : 'No gNamespace.price');
        
        // Try multiple ways to get the price
        let price = 0;
        if (item['g:price']) {
          price = this.parsePrice(item['g:price']);
          console.log(`Found price in g:price: ${price}`);
        } else if (gNamespace.price) {
          price = this.parsePrice(gNamespace.price);
          console.log(`Found price in gNamespace.price: ${price}`);
        } else {
          console.log(`No price found for item ${index}`);
        }
        
        // Try multiple ways to get the image URL
        let imageUrl = '';
        if (item['g:image_link']) {
          imageUrl = item['g:image_link'];
          console.log(`Found image URL in g:image_link: ${imageUrl}`);
        } else if (gNamespace.image_link) {
          imageUrl = gNamespace.image_link;
          console.log(`Found image URL in gNamespace.image_link: ${imageUrl}`);
        } else if (item.image_link) {
          imageUrl = item.image_link;
          console.log(`Found image URL in item.image_link: ${imageUrl}`);
        } else if (gNamespace.image) {
          imageUrl = gNamespace.image;
          console.log(`Found image URL in gNamespace.image: ${imageUrl}`);
        } else {
          console.log(`No image URL found for item ${index}`);
        }
        
        return {
          productId: gNamespace.id || gNamespace.product_id || `product_${index}`,
          title: gNamespace.title || item.title || '',
          description: gNamespace.description || item.description || '',
          price: price,
          imageUrl: imageUrl,
          productUrl: gNamespace.link || item.link || '',
          category: gNamespace.product_type || item.category || '',
          brand: gNamespace.brand || item.brand || '',
          availability: gNamespace.availability || item.availability || 'in stock',
          condition: gNamespace.condition || item.condition || 'new',
          gtin: gNamespace.gtin || item.gtin || '',
          mpn: gNamespace.mpn || item.mpn || ''
        };
      }).filter(product => product.title && product.productId);
      
      return {
        products,
        metadata: {
          totalProducts: products.length,
          parsedAt: new Date().toISOString(),
          feedType: 'google_merchant'
        }
      };
    } catch (error) {
      console.error('Error parsing Google Merchant XML:', error);
      throw new Error('Failed to parse Google Merchant XML feed');
    }
  }

  private parsePrice(priceString: string): number {
    if (!priceString) return 0;
    
    // Extract numeric value from price string (handle different currencies)
    const matches = priceString.match(/[\d.,]+/);
    if (!matches) return 0;
    
    const numericValue = matches[0].replace(/,/g, '');
    return parseFloat(numericValue) || 0;
  }

  async processAndStore(content: ParsedContent): Promise<string> {
    try {
      const documentId = await ragService.addKnowledgeDocument(
        content.title,
        content.content,
        content.type,
        content.sourceUrl,
        content.metadata
      );
      
      console.log(`✓ Processed and stored ${content.type}: ${content.title}`);
      return documentId;
    } catch (error) {
      console.error('Error processing and storing content:', error);
      throw error;
    }
  }

  async processProductsAndStore(products: any[]): Promise<void> {
    try {
      for (const product of products) {
        await ragService.addProduct({
          productId: product.productId,
          title: product.title,
          description: product.description || '',
          price: product.price,
          imageUrl: product.imageUrl,
          productUrl: product.productUrl,
          category: product.category,
          brand: product.brand,
          metadata: {
            availability: product.availability,
            condition: product.condition,
            gtin: product.gtin,
            mpn: product.mpn
          }
        });
      }
      
      console.log(`✓ Processed and stored ${products.length} products`);
    } catch (error) {
      console.error('Error processing products:', error);
      throw error;
    }
  }
}

export const contentParser = new ContentParser();