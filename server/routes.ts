import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiService } from './services/ai-service';
import { agenticRagService } from './services/agentic-rag-service';
import { unifiedRagOrchestrator } from './services/unified-rag-orchestrator';
import { contentParser } from './services/content-parser';
import { agentSystem } from './services/agent-system';
import { registerAdminRoutes } from './routes/admin';
import agentRoutes from './routes/agent';
import http from 'http';
import { XMLParser } from 'fast-xml-parser';
import axios from 'axios';
import fetch from 'node-fetch';
import { vectorStorage } from './services/vector-storage';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Export the function that registers all routes
export async function registerRoutes(app: express.Express): Promise<http.Server> {
  // Admin routes
  registerAdminRoutes(app);
  
  // Register API routes
  app.use('/api', router);
  
  // Register agent routes
  app.use('/api', agentRoutes);
  
  // Create and return the HTTP server
  return http.createServer(app);
}

// Chat history endpoint
router.get('/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    console.log(`\n📋 RETRIEVING CHAT HISTORY:`);
    console.log(`   SessionId: ${sessionId}`);
    
    // Check if the file exists directly
    const filePath = path.join(process.cwd(), 'data-storage', `chat-session-${sessionId}.json`);
    const fileExists = fs.existsSync(filePath);
    console.log(`   File path: ${filePath}`);
    console.log(`   File exists: ${fileExists ? '✅ YES' : '❌ NO'}`);
    
    if (fileExists) {
      try {
        // Read the file directly
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const messages = JSON.parse(fileContent);
        console.log(`   Read ${messages.length} messages directly from file`);
        return res.json(messages);
      } catch (fileError) {
        console.error('Error reading file directly:', fileError);
      }
    }
    
    // Fallback to vector storage method
    console.log('   Falling back to vector storage method');
    const chatHistory = await vectorStorage.getChatHistory(sessionId);
    
    console.log(`   Retrieved ${chatHistory.length} messages from vector storage`);
    
    return res.json(chatHistory);
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    return res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
});

// Chat message endpoint
router.post('/chat/message', async (req, res) => {
  try {
    const { content, sessionId, isBot } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing content field' });
    }

    // Generate session ID if not provided, but try to maintain session continuity
    let finalSessionId = sessionId;
    
    if (!finalSessionId) {
      // Check if there's a session ID in the request headers or cookies
      const headerSessionId = req.headers['x-session-id'] || req.headers['session-id'];
      if (headerSessionId) {
        finalSessionId = headerSessionId as string;
      } else {
        finalSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
    }
    
    console.log(`\n📋 SESSION MANAGEMENT:`);
    console.log(`   Frontend provided sessionId: ${sessionId || '❌ NOT PROVIDED'}`);
    console.log(`   Headers sessionId: ${req.headers['x-session-id'] || req.headers['session-id'] || '❌ NOT FOUND'}`);
    console.log(`   Final sessionId: ${finalSessionId}`);
    console.log(`   Session continuity: ${sessionId ? '✅ MAINTAINED' : '❌ BROKEN'}`);

    // For now, we'll just handle the message without storing it
    // If it's a user message, generate a response
    if (!isBot) {
      try {
        // Get conversation history to check context
        const chatHistory = await vectorStorage.getChatHistory(finalSessionId);
        const conversationContext = chatHistory
          .slice(-8) // Increase from 4 to 8 to maintain more context
          .map(msg => ({
            role: msg.isBot ? 'assistant' : 'user',
            content: msg.content
          }));
          
        console.log(`\n🔍 SESSION DEBUG for ${finalSessionId}:`);
        console.log(`   Total messages in history: ${chatHistory.length}`);
        console.log(`   Using ${conversationContext.length} messages for context`);
        console.log(`   Current user message: "${content}"`);
        
        if (conversationContext.length > 0) {
          console.log(`   Recent conversation context:`);
          conversationContext.slice(-5).forEach((msg, index) => {
            console.log(`     ${index + 1}. ${msg.role.toUpperCase()}: "${msg.content}"`);
          });
        } else {
          console.log(`   ⚠️  No conversation history found - this might be a new session`);
        }
        
        // Check if this is a follow-up to previous conversation
        const isFollowUp = conversationContext.length > 0;
        console.log(`   Is follow-up: ${isFollowUp}`);
        console.log(`   Session continuity: ${sessionId ? '✅ Provided' : '❌ Not provided'}`);
        
        // Check if this is a follow-up to a previous product-related question
        const isFollowUpToProductQuery = await isProductRelatedFollowUp(content, conversationContext);
        
        // Check for order tracking keywords directly, but only if it's not a product follow-up
        if (!isFollowUpToProductQuery) {
          const lowerContent = content.toLowerCase();
          const isOrderTrackingQuery = ['order', 'track', 'shipping', 'delivery', 'package', 'status', 'where is my']
            .some(keyword => lowerContent.includes(keyword));
          
          // If it's an order tracking query, return a fixed response without using AI
          if (isOrderTrackingQuery) {
            console.log('Order tracking query detected, returning fixed response');
            console.log(`📤 RETURNING ORDER TRACKING RESPONSE with sessionId: ${finalSessionId}`);
            
            // Save conversation
            try {
              await vectorStorage.saveChatMessage(finalSessionId, {
                content: content,
                isBot: false
              });
              await vectorStorage.saveChatMessage(finalSessionId, {
                content: "I'll help you track your order. Please provide your email address first.",
                isBot: true
              });
              console.log(`💾 Saved order tracking conversation for session: ${finalSessionId}`);
            } catch (error) {
              console.error('Error saving order tracking conversation:', error);
            }
            
            return res.json({ 
              message: "I'll help you track your order. Please provide your email address first.",
              sources: [],
              confidence: 1.0,
              intent: 'order_tracking',
              shouldStartProductFlow: false,
              sessionId: finalSessionId
            });
          }
        }
        
        // Check if the input looks like an email address (contains @ and .)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(content)) {
          // Check if we're in an order tracking flow by looking at previous messages
          const isInOrderTrackingFlow = conversationContext.some(msg => 
            msg.role === 'assistant' && 
            msg.content.toLowerCase().includes('order') && 
            msg.content.toLowerCase().includes('email')
          );
          
          if (isInOrderTrackingFlow) {
            console.log('Email address detected in order tracking flow, returning fixed response asking for order ID');
            console.log(`📤 RETURNING EMAIL RESPONSE with sessionId: ${finalSessionId}`);
            
            // Save conversation
            try {
              await vectorStorage.saveChatMessage(finalSessionId, {
                content: content,
                isBot: false
              });
              await vectorStorage.saveChatMessage(finalSessionId, {
                content: "Thank you! Now please provide your order ID or order number.",
                isBot: true
              });
              console.log(`💾 Saved email conversation for session: ${finalSessionId}`);
            } catch (error) {
              console.error('Error saving email conversation:', error);
            }
            
            return res.json({ 
              message: "Thank you! Now please provide your order ID or order number.",
              sources: [],
              confidence: 1.0,
              intent: 'order_tracking',
              shouldStartProductFlow: false,
              sessionId: finalSessionId
            });
          }
        }

        // Check if the input looks like an order ID (alphanumeric with possible hyphens)
        const orderIdRegex = /^[A-Za-z0-9-]{3,20}$/;
        if (orderIdRegex.test(content) && !emailRegex.test(content)) {
          // Check if we're in an order tracking flow
          const isInOrderTrackingFlow = conversationContext.some(msg => 
            msg.role === 'assistant' && 
            (msg.content.toLowerCase().includes('order id') || 
             msg.content.toLowerCase().includes('order number'))
          );
          
          if (isInOrderTrackingFlow) {
            console.log('Order ID detected in order tracking flow, returning fixed response for order lookup');
            console.log(`📤 RETURNING ORDER ID RESPONSE with sessionId: ${finalSessionId}`);
            
            // Save conversation
            try {
              await vectorStorage.saveChatMessage(finalSessionId, {
                content: content,
                isBot: false
              });
              await vectorStorage.saveChatMessage(finalSessionId, {
                content: "Let me look up your order...",
                isBot: true
              });
              console.log(`💾 Saved order ID conversation for session: ${finalSessionId}`);
            } catch (error) {
              console.error('Error saving order ID conversation:', error);
            }
            
            return res.json({ 
              message: "Let me look up your order...",
              sources: [],
              confidence: 1.0,
              intent: 'order_tracking',
              shouldStartProductFlow: false,
              sessionId: finalSessionId
            });
          }
        }
        
        // Use the unified RAG orchestrator for enhanced responses
        console.log(`\n🚀 SENDING TO RAG ORCHESTRATOR:`);
        console.log(`   Query: "${content}"`);
        console.log(`   SessionId: ${finalSessionId}`);
        console.log(`   Context messages: ${conversationContext.length}`);
        
        const ragResponse = await unifiedRagOrchestrator.query(content, finalSessionId);
        
        // Check if the response contains configuration error messages
        if (ragResponse.answer.includes("OpenRouter integration is not properly configured") || 
            ragResponse.answer.includes("placeholder API key") ||
            ragResponse.answer.includes("API key is invalid or has expired")) {
          console.log("Detected configuration error in RAG response");
        }
        
        // If shouldStartProductFlow is true, don't show products even if we have them
    if (ragResponse.shouldStartProductFlow) {
      console.log("Should start product flow, checking if we should show products anyway");
      
      // Check if the query contains enough specific product information to skip the flow
      const lowerQuery = content.toLowerCase();
      const hasSpecificInfo = lowerQuery.includes('perfume') || 
                             lowerQuery.includes('watch') || 
                             lowerQuery.includes('jewelry') || 
                             lowerQuery.includes('gift') ||
                             lowerQuery.includes('floral') ||
                             lowerQuery.includes('woody') ||
                             lowerQuery.includes('fresh') ||
                             lowerQuery.includes('women') ||
                             lowerQuery.includes('men') ||
                             lowerQuery.includes('ladies') ||
                             lowerQuery.includes('gentlemen');
                             
      // Also check if we have products and this might be a follow-up
      const hasProducts = ragResponse.products && ragResponse.products.length > 0;
      const isShortQuery = content.trim().split(/\s+/).length <= 3;
      
      console.log(`hasSpecificInfo: ${hasSpecificInfo}, hasProducts: ${hasProducts}, isShortQuery: ${isShortQuery}`);
      
      if (hasSpecificInfo || (hasProducts && isShortQuery)) {
        console.log("Showing products despite shouldStartProductFlow due to specific info or follow-up");
        
        // For gender-specific queries, search for products directly
        if (lowerQuery.includes('women') || lowerQuery.includes('ladies')) {
          console.log("Gender-specific query detected (women/ladies), searching for matching products");
          
          try {
            const productResults = await vectorStorage.searchProducts(content, 5);
            
            // Filter for women's products
            const filteredProducts = productResults.filter(product => {
              const productContent = (product.content || '').toLowerCase();
              const productTitle = (product.metadata?.title || '').toLowerCase();
              
              return productContent.includes('women') || 
                     productContent.includes('ladies') || 
                     productTitle.includes('women') || 
                     productTitle.includes('ladies');
            });
            
            console.log(`Found ${filteredProducts.length} women's products out of ${productResults.length} total`);
            
            if (filteredProducts.length > 0) {
              // Apply budget filter from user content if present (e.g., "under 1500", "between 500 and 1000")
              let minPrice = 0;
              let maxPrice = Infinity;
              const lowerContent = (content || '').toLowerCase();
              const underMatch = lowerContent.match(/under\s+(\d+)/i) || lowerContent.match(/less\s+than\s+(\d+)/i);
              const betweenMatch = lowerContent.match(/between\s+(\d+)\s+and\s+(\d+)/i) || lowerContent.match(/(\d+)\s*[-to]{1,3}\s*(\d+)/i);
              const overMatch = lowerContent.match(/over\s+(\d+)/i) || lowerContent.match(/more\s+than\s+(\d+)/i);
              if (underMatch) {
                maxPrice = parseInt(underMatch[1], 10);
              } else if (betweenMatch) {
                minPrice = parseInt(betweenMatch[1], 10);
                maxPrice = parseInt(betweenMatch[2], 10);
              } else if (overMatch) {
                minPrice = parseInt(overMatch[1], 10);
              }
              // Default to displaying the gender-filtered products
              let toDisplayProducts = filteredProducts;

              if (minPrice > 0 || maxPrice < Infinity) {
                console.log(`Applying gender-specific budget filter: min=${minPrice}, max=${maxPrice}`);
                const budgetFiltered = filteredProducts.filter((result: any) => {
                  let price = 0;
                  if (typeof result.metadata?.price === 'string') {
                    price = parseFloat(result.metadata.price);
                  } else if (typeof result.metadata?.price === 'number') {
                    price = result.metadata.price;
                  }
                  const within = price >= minPrice && price <= maxPrice;
                  if (!within) {
                    console.log(`Excluding (budget): ${result.metadata?.title} - ${price}`);
                  }
                  return within;
                });
                toDisplayProducts = budgetFiltered;
                console.log(`After gender-specific budget filtering: ${budgetFiltered.length} products remain`);
              }

              // Process products for display
              const products = toDisplayProducts.map(result => ({
                title: result.metadata?.title || 'Unknown Product',
                description: result.content,
                price: result.metadata?.price ? parseFloat(String(result.metadata.price)) : 0,
                imageUrl: result.metadata?.imageUrl || null,
                productUrl: result.metadata?.productUrl || '#'
              }));
              
              return res.json({ 
                message: ragResponse.answer,
                sources: ragResponse.sources || [],
                confidence: ragResponse.confidence || 0.95,
                type: 'product-recommendations',
                products
              });
            }
          } catch (error) {
            console.error("Error searching for gender-specific products:", error);
          }
        }
        
        // For men's products
        if (lowerQuery.includes('men') || lowerQuery.includes('gentlemen')) {
          console.log("Gender-specific query detected (men/gentlemen), searching for matching products");
          
          try {
            const productResults = await vectorStorage.searchProducts(content, 5);
            
            // Filter for men's products
            const filteredProducts = productResults.filter(product => {
              const productContent = (product.content || '').toLowerCase();
              const productTitle = (product.metadata?.title || '').toLowerCase();
              
              return productContent.includes('men') || 
                     productContent.includes('gentlemen') || 
                     productTitle.includes('men') || 
                     productTitle.includes('gentlemen');
            });
            
            console.log(`Found ${filteredProducts.length} men's products out of ${productResults.length} total`);
            
            if (filteredProducts.length > 0) {
              // Process products for display
              const products = filteredProducts.map(result => ({
                title: result.metadata?.title || 'Unknown Product',
                description: result.content,
                price: result.metadata?.price ? parseFloat(String(result.metadata.price)) : 0,
                imageUrl: result.metadata?.imageUrl || null,
                productUrl: result.metadata?.productUrl || '#'
              }));
              
              return res.json({ 
                message: ragResponse.answer,
                sources: ragResponse.sources || [],
                confidence: ragResponse.confidence || 0.95,
                type: 'product-recommendations',
                products
              });
            }
          } catch (error) {
            console.error("Error searching for gender-specific products:", error);
          }
        }
        
        // Process products for display (non-gender specific)
        const products = ragResponse.products || [];
        
        return res.json({ 
          message: ragResponse.answer,
          sources: ragResponse.sources || [],
          confidence: ragResponse.confidence || 0.95,
          type: 'product-recommendations',
          products
        });
      }
      
      console.log("Not showing products, starting product flow");
      console.log(`📤 RETURNING PRODUCT FLOW RESPONSE with sessionId: ${finalSessionId}`);
      
      // Save conversation
      try {
        await vectorStorage.saveChatMessage(finalSessionId, {
          content: content,
          isBot: false
        });
        await vectorStorage.saveChatMessage(finalSessionId, {
          content: ragResponse.answer,
          isBot: true
        });
        console.log(`💾 Saved product flow conversation for session: ${finalSessionId}`);
      } catch (error) {
        console.error('Error saving product flow conversation:', error);
      }
      
      return res.json({ 
        message: ragResponse.answer,
        sources: ragResponse.sources || [],
        confidence: ragResponse.confidence || 0.95,
        intent: ragResponse.intent,
        shouldStartProductFlow: true,
        sessionId: finalSessionId
      });
    }
        
        // Ensure products are always in the right format for card display
        let products = ragResponse.products;
        
        // If we have products, make sure they have all required fields
        if (products && products.length > 0) {
          // Apply budget filter from user content if present (e.g., "under 1500", "between 500 and 1000")
          try {
            let minPrice = 0;
            let maxPrice = Infinity;
            const lowerContent = (content || '').toLowerCase();
            const underMatch = lowerContent.match(/under\s+(\d+)/i) || lowerContent.match(/less\s+than\s+(\d+)/i);
            const betweenMatch = lowerContent.match(/between\s+(\d+)\s+and\s+(\d+)/i) || lowerContent.match(/(\d+)\s*[-to]{1,3}\s*(\d+)/i);
            const overMatch = lowerContent.match(/over\s+(\d+)/i) || lowerContent.match(/more\s+than\s+(\d+)/i);
            if (underMatch) {
              maxPrice = parseInt(underMatch[1], 10);
            } else if (betweenMatch) {
              minPrice = parseInt(betweenMatch[1], 10);
              maxPrice = parseInt(betweenMatch[2], 10);
            } else if (overMatch) {
              minPrice = parseInt(overMatch[1], 10);
            }
            if (minPrice > 0 || maxPrice < Infinity) {
              console.log(`Applying budget filter to ragResponse.products: min=${minPrice}, max=${maxPrice}`);
              products = products.filter((p: any) => {
                let price = 0;
                if (typeof p.price === 'string') {
                  price = parseFloat(p.price);
                } else if (typeof p.price === 'number') {
                  price = p.price;
                }
                const within = price >= minPrice && price <= maxPrice;
                if (!within) {
                  console.log(`Excluding (budget): ${p.title} - ${price}`);
                }
                return within;
              });
              console.log(`After budget filtering ragResponse.products: ${products.length} products remain`);
            }
          } catch (e) {
            console.warn('Budget filter on ragResponse.products failed:', e);
          }
          // Sample prices for products based on brand
          const samplePrices: Record<string, number> = {
            'Calvin Klein': 85.99,
            'La Maison': 120.50,
            'Billie Eilish': 69.99,
            'Debut': 55.00,
            'Penhaligon': 150.00,
            'Fabian': 89.99,
            'Unique': 75.50,
            'Esse': 65.00,
            'Etat': 110.00,
            'Default': 99.99
          };
          
          products = products.map(product => {
            // Use the product URL as is - it's already a full URL
            let productUrl = product.productUrl || '';
            
            // Only add domain if it's not already an absolute URL
            if (productUrl && !productUrl.startsWith('http')) {
              productUrl = `https://www.karjistore.com${productUrl.startsWith('/') ? productUrl : '/' + productUrl}`;
            }
            
            // Use image URL as is - it's already a full URL
            let imageUrl = product.imageUrl || '';
            
            // Only add domain if it's not already an absolute URL
            if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = `https://www.karjistore.com${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
            }
            
            // Determine price - use actual price if available, otherwise use sample price based on title
            let price = typeof product.price === 'number' ? product.price : 
                       (typeof product.price === 'string' ? parseFloat(product.price) : 0);
            
            // If price is zero or invalid, assign a sample price based on title
            if (!price || price <= 0) {
              // Find a matching brand name in the title
              const title = product.title || '';
              let matchedBrand = 'Default';
              
              // Check if any of our sample price keys are in the title
              Object.keys(samplePrices).forEach(brand => {
                if (title.includes(brand)) {
                  matchedBrand = brand;
                }
              });
              
              price = samplePrices[matchedBrand as keyof typeof samplePrices];
            }
            
            // Debug logging
            console.log(`Sending product to client: ${product.title}`);
            console.log(`  URL: ${productUrl} (original: ${product.productUrl})`);
            console.log(`  Image: ${imageUrl} (original: ${product.imageUrl})`);
            console.log(`  Price: ${price} (original: ${product.price}, type: ${typeof product.price})`);
            
            return {
              title: product.title || 'Unknown Product',
              description: product.description || 'No description available',
              price: price,
              imageUrl: imageUrl || null,
              productUrl: productUrl
            };
          });
          
          // Set the message type to product-recommendations to trigger the card display
          console.log(`📤 RETURNING PRODUCT RECOMMENDATIONS with sessionId: ${finalSessionId}`);
          
          // Save conversation
          try {
            await vectorStorage.saveChatMessage(finalSessionId, {
              content: content,
              isBot: false
            });
            await vectorStorage.saveChatMessage(finalSessionId, {
              content: ragResponse.answer,
              isBot: true
            });
            console.log(`💾 Saved product recommendations conversation for session: ${finalSessionId}`);
          } catch (error) {
            console.error('Error saving product recommendations conversation:', error);
          }
          
          return res.json({ 
            message: ragResponse.answer,
            sources: ragResponse.sources || [],
            confidence: ragResponse.confidence || 0.95,
            type: 'product-recommendations',
            products,
            sessionId: finalSessionId
          });
        }
        
        // Save conversation to storage
        try {
          // Save user message
          await vectorStorage.saveChatMessage(finalSessionId, {
            content: content,
            isBot: false
          });
          
          // Save bot response
          await vectorStorage.saveChatMessage(finalSessionId, {
            content: ragResponse.answer,
            isBot: true
          });
          
          console.log(`💾 Saved conversation for session: ${finalSessionId}`);
        } catch (error) {
          console.error('Error saving conversation:', error);
        }
        
        // No fallback products - just return the RAG response
        console.log(`\n📤 RETURNING RESPONSE:`);
        console.log(`   Message: "${ragResponse.answer}"`);
        console.log(`   SessionId: ${finalSessionId}`);
        console.log(`   Confidence: ${ragResponse.confidence || 0.95}`);
        console.log(`   Products: ${ragResponse.products ? ragResponse.products.length : 0}`);
        console.log(`   Intent: ${ragResponse.intent}`);
        console.log(`   ShouldStartProductFlow: ${ragResponse.shouldStartProductFlow}`);
        
        return res.json({ 
          message: ragResponse.answer,
          sources: ragResponse.sources || [],
          confidence: ragResponse.confidence || 0.95,
          intent: ragResponse.intent,
          shouldStartProductFlow: ragResponse.shouldStartProductFlow,
          sessionId: finalSessionId
        });
      } catch (error) {
        console.error('Error generating response:', error);
        return res.status(500).json({ error: 'Failed to generate response' });
      }
    } else {
      // For bot messages, just return a success response
      return res.json({ success: true });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return res.status(500).json({ error: 'Failed to handle message' });
  }
});

// Helper function to determine if a query is product-related
function isProductQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Use semantic patterns instead of hardcoded keywords
  const productPatterns = [
    // Questions about products
    /what (kind|type|sort) of|do you (have|sell|offer)/i,
    // Shopping intent
    /looking for|interested in|show me|find|suggest|recommend/i,
    // Product categories (more general)
    /items?|products?|goods|merchandise|collection|catalog|shop/i
  ];
  
  return productPatterns.some(pattern => pattern.test(lowerQuery));
}

// Helper function to determine if a query is a follow-up to a product-related question
async function isProductRelatedFollowUp(query: string, conversationContext: { role: string; content: string }[]): Promise<boolean> {
  if (conversationContext.length < 2) return false;
  
  const lastAssistantMessage = [...conversationContext]
    .reverse()
    .find(msg => msg.role === 'assistant');
    
  if (!lastAssistantMessage) return false;
  
  // Check if the last assistant message was about products using semantic patterns
  const productRelatedPatterns = [
    // Product-related terms
    /products?|items?|merchandise|catalog|collection/i,
    // Shopping-related questions
    /looking for|interested in|prefer|would you like|recommendations?/i,
    // Questions about preferences
    /what (kind|type|style|brand) (of|are you)|do you have any preferences/i
  ];
  
  const lastMessageWasAboutProducts = productRelatedPatterns.some(pattern => 
    pattern.test(lastAssistantMessage.content.toLowerCase())
  );
  
  // Check if the last message was asking a question
  const wasAskingQuestion = lastAssistantMessage.content.includes('?') ||
    /can you|could you|would you|do you|are you|what|how|when|where|which|who|why/i.test(lastAssistantMessage.content.toLowerCase());
  
  // Check if the current query is short and looks like a direct response
  const isShortResponse = query.trim().split(/\s+/).length <= 5;
  
  return lastMessageWasAboutProducts && wasAskingQuestion && isShortResponse;
}

// Product recommendations endpoint
router.post('/product-recommendations', async (req, res) => {
  try {
    const { preferences, sessionId } = req.body;
    
    console.log('Product recommendation request received:');
    console.log('Preferences:', JSON.stringify(preferences, null, 2));
    console.log('Session ID:', sessionId);
    
    if (!preferences) {
      console.log('No preferences provided in request');
      return res.status(400).json({ error: 'Product preferences are required' });
    }
    
    // Get the path to the products.json file
    const productsFilePath = path.join(__dirname, '../data-storage/products.json');
    console.log(`Reading products from: ${productsFilePath}`);
    
    if (!fs.existsSync(productsFilePath)) {
      console.error('Products file not found:', productsFilePath);
      return res.status(500).json({ error: 'Products data not found' });
    }
    
    // Read the products data
    let productsData;
    try {
      productsData = fs.readFileSync(productsFilePath, 'utf8');
      console.log(`Successfully read products data (${productsData.length} bytes)`);
    } catch (readError: any) {
      console.error('Error reading products data:', readError.message);
      return res.status(500).json({ error: 'Failed to read products data' });
    }
    
    // Parse the products data
    let allProducts;
    try {
      allProducts = JSON.parse(productsData);
      console.log(`Successfully parsed products data (${allProducts.length} products)`);
    } catch (parseError: any) {
      console.error('Error parsing products data:', parseError.message);
      return res.status(500).json({ error: 'Failed to parse products data' });
    }
    
    // Fetch Google Merchant feed for image URLs
    console.log('Fetching Google Merchant feed for product images...');
    const googleMerchantData = await fetchGoogleMerchantFeed();
    console.log(`Google Merchant feed data available: ${googleMerchantData ? 'Yes' : 'No'}`);
    
    // Filter products based on preferences
    let filteredProducts = [...allProducts];
    
    // Filter by search query if provided
    if (preferences.searchQuery) {
      const searchQuery = preferences.searchQuery.toLowerCase();
      console.log(`Filtering by search query: "${searchQuery}"`);
      
      filteredProducts = filteredProducts.filter((product: any) => {
        const title = (product.title || '').toLowerCase();
        const description = (product.description || '').toLowerCase();
        const brand = (product.brand || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        
        return title.includes(searchQuery) || 
               description.includes(searchQuery) || 
               brand.includes(searchQuery) || 
               category.includes(searchQuery);
      });
      
      console.log(`Found ${filteredProducts.length} products matching search query`);
    }
    
    // Filter by category if provided
    if (preferences.category && preferences.category !== 'all') {
      console.log(`Filtering by category: ${preferences.category}`);
      
      // Define keywords for each category
      const categoryKeywords: Record<string, string[]> = {
        'dates': ['date', 'dates', 'majdool', 'medjool'],
        'chocolates': ['chocolate', 'truffle', 'praline'],
        'sweets': ['sweet', 'candy', 'dessert', 'baklava', 'turkish delight'],
        'coffee': ['coffee', 'espresso', 'latte', 'cappuccino', 'mocha'],
        'vegetables': ['vegetable', 'veggie', 'produce']
      };
      
      const keywords = categoryKeywords[preferences.category] || [preferences.category];
      console.log(`Category keywords: ${keywords.join(', ')}`);
      
      filteredProducts = filteredProducts.filter((product: any) => {
        const title = (product.title || '').toLowerCase();
        const description = (product.description || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        
        return keywords.some(keyword => 
          title.includes(keyword) || 
          description.includes(keyword) || 
          category.includes(keyword)
        );
      });
      
      console.log(`Found ${filteredProducts.length} products in category`);
    } else if (preferences.category === 'all') {
      console.log('Category is "all", showing products from all categories');
      // Don't filter by category - keep all products
    }
    
    // Filter by budget if provided
    if (preferences.budget) {
      console.log(`Filtering by budget: ${preferences.budget}`);
      
      // Handle predefined budget ranges
      const priceRanges: Record<string, [number, number]> = {
        'budget-friendly': [0, 50],
        'mid-range': [50, 150],
        'premium': [150, Infinity],
        'any': [0, Infinity]
      };
      
      // Handle numeric budget constraints like "under 200"
      let minPrice = 0;
      let maxPrice = Infinity;
      
      // Check for "under X" or "less than X" patterns
      const underMatch = preferences.budget.toString().match(/under\s+(\d+)/i);
      const lessThanMatch = preferences.budget.toString().match(/less\s+than\s+(\d+)/i);
      
      if (underMatch || lessThanMatch) {
        const match = underMatch || lessThanMatch;
        maxPrice = parseInt(match[1], 10);
        console.log(`Detected "under ${maxPrice}" budget constraint`);
      } 
      // Check for "over X" or "more than X" patterns
      else if (preferences.budget.toString().match(/over\s+(\d+)/i)) {
        minPrice = parseInt(preferences.budget.toString().match(/over\s+(\d+)/i)[1], 10);
        console.log(`Detected "over ${minPrice}" budget constraint`);
      }
      // Check for "between X and Y" pattern
      else if (preferences.budget.toString().match(/between\s+(\d+)\s+and\s+(\d+)/i)) {
        const matches = preferences.budget.toString().match(/between\s+(\d+)\s+and\s+(\d+)/i);
        minPrice = parseInt(matches[1], 10);
        maxPrice = parseInt(matches[2], 10);
        console.log(`Detected "between ${minPrice} and ${maxPrice}" budget constraint`);
      }
      // Check for predefined ranges
      else if (preferences.budget !== 'any' && priceRanges[preferences.budget]) {
        [minPrice, maxPrice] = priceRanges[preferences.budget];
      }
      
      console.log(`Price range: ${minPrice} - ${maxPrice === Infinity ? 'unlimited' : maxPrice}`);
      
      filteredProducts = filteredProducts.filter((product: any) => {
        // Convert price to number if it's a string
        let price = 0;
        if (typeof product.price === 'string') {
          price = parseFloat(product.price);
        } else if (typeof product.price === 'number') {
          price = product.price;
        }
        
        return price >= minPrice && price <= maxPrice;
      });
      
      console.log(`Found ${filteredProducts.length} products in budget range`);
    }
    
    // Filter by features if provided
    if (preferences.features && preferences.features.length > 0) {
      console.log(`Filtering by features: ${preferences.features.join(', ')}`);
      
      if (preferences.features[0] !== 'none') {
        const featureKeywords: Record<string, string[]> = {
          'stuffed': ['stuffed', 'filled', 'stuff', 'fill'],
          'organic': ['organic', 'natural', 'bio'],
          'regular': ['regular', 'standard', 'plain', 'simple']
        };
        
        preferences.features.forEach((feature: string) => {
          const keywords = featureKeywords[feature] || [feature];
          console.log(`Feature keywords for "${feature}": ${keywords.join(', ')}`);
          
          filteredProducts = filteredProducts.filter((product: any) => {
            const title = (product.title || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            
            // Prioritize exact matches in title
            if (title.includes(feature)) {
              return true;
            }
            
            // Check for keyword matches
            const match = keywords.some(keyword => 
              title.includes(keyword) || 
              description.includes(keyword)
            );
            
            return match;
          });
          
          console.log(`Found ${filteredProducts.length} products with feature "${feature}"`);
          
          // If no products found with this feature, try a broader search within the category
          if (filteredProducts.length === 0 && preferences.category) {
            console.log(`No products found with feature "${feature}", trying broader search`);
            
            const categoryKeywords = preferences.category !== 'all' ? 
              [preferences.category] : 
              ['dates', 'chocolates', 'sweets', 'coffee', 'vegetables'];
            
            filteredProducts = allProducts.filter((product: any) => {
              const title = (product.title || '').toLowerCase();
              const description = (product.description || '').toLowerCase();
              
              return categoryKeywords.some(catKeyword => 
                title.includes(catKeyword) || 
                description.includes(catKeyword)
              );
            });
            
            console.log(`Found ${filteredProducts.length} products in broader category search`);
          }
        });
      }
    }
    
    // Filter by brand if provided
    if (preferences.brand && preferences.brand !== 'any') {
      console.log(`Filtering by brand: ${preferences.brand}`);
      
      filteredProducts = filteredProducts.filter((product: any) => {
        const brand = (product.brand || '').toLowerCase();
        const title = (product.title || '').toLowerCase();
        
        return brand.includes(preferences.brand.toLowerCase()) || 
               title.includes(preferences.brand.toLowerCase());
      });
      
      console.log(`Found ${filteredProducts.length} products matching brand`);
    }
    
    // If no products found, return a subset of all products
    if (filteredProducts.length === 0) {
      console.log('No products found matching filters, returning a sample of all products');
      
      // Try a broader search based on category and any feature keywords
      if (preferences.category && preferences.features && preferences.features.length > 0) {
        console.log(`Trying broader search for ${preferences.category} products`);
        
        filteredProducts = allProducts.filter((product: any) => {
          const title = (product.title || '').toLowerCase();
          const description = (product.description || '').toLowerCase();
          
          return title.includes(preferences.category?.toLowerCase() || '') || 
                 description.includes(preferences.category?.toLowerCase() || '');
        });
        
        console.log(`Found ${filteredProducts.length} products in broader category search`);
      }
      
      // If still no products, return a sample of all products
      if (filteredProducts.length === 0) {
        filteredProducts = allProducts.slice(0, 5);
        console.log(`Returning random sample of ${filteredProducts.length} products`);
      }
    }
    
    // Sort products if sorting preference provided
    if (preferences.sort) {
      console.log(`Sorting products by: ${preferences.sort}`);
      
      switch(preferences.sort) {
        case 'price_low':
          filteredProducts.sort((a: any, b: any) => {
            const aPrice = typeof a.price === 'number' ? a.price : 0;
            const bPrice = typeof b.price === 'number' ? b.price : 0;
            return aPrice - bPrice;
          });
          console.log('Sorted products by price low to high');
          break;
        case 'price_high':
          filteredProducts.sort((a: any, b: any) => {
            const aPrice = typeof a.price === 'number' ? a.price : 0;
            const bPrice = typeof b.price === 'number' ? b.price : 0;
            return bPrice - aPrice;
          });
          console.log('Sorted products by price high to low');
          break;
        case 'popularity':
          // For demonstration, we'll use a random "popularity" score
          // In a real app, this would be based on sales data or reviews
          filteredProducts.sort(() => Math.random() - 0.5);
          console.log('Sorted products by popularity (random for demo)');
          break;
      }
      
      // Log the sorted products for debugging
      console.log('Sorted products:', filteredProducts.map((p: any) => ({
        title: p.title,
        price: p.price
      })));
    }
    
    // Limit to 5 products for better UX
    const limitedProducts = filteredProducts.slice(0, 5);
    console.log(`Limited to ${limitedProducts.length} products for display`);
    
    // Ensure we have valid data for each product and enrich with Google Merchant data
    const sanitizedProducts = limitedProducts.map((product: any) => {
      // Generate a sample price if price is 0 or missing
      let price = product.price;
      if (!price || price === 0) {
        // Generate a random price between $10 and $100 based on product ID for consistency
        const productId = parseInt(product.id || '0');
        price = 10 + (productId % 90); // Price between $10 and $99
        
        // Try to get price from Google Merchant feed
        if (googleMerchantData) {
          // Try to match by product URL
          if (product.productUrl && googleMerchantData.has(product.productUrl)) {
            const merchantData = googleMerchantData.get(product.productUrl);
            if (merchantData && merchantData.price > 0) {
              price = merchantData.price;
              console.log(`Using Google Merchant price for ${product.title}: ${price}`);
            }
          }
          
          // Try to match by product title
          if (product.title && googleMerchantData.has(product.title.toLowerCase())) {
            const merchantData = googleMerchantData.get(product.title.toLowerCase());
            if (merchantData && merchantData.price > 0) {
              price = merchantData.price;
              console.log(`Using Google Merchant price for ${product.title}: ${price}`);
            }
          }
        }
      }
      
      // Generate a sample image URL if missing
      let imageUrl = product.imageUrl;
      if (!imageUrl && googleMerchantData) {
        // Try to match by product URL
        if (product.productUrl && googleMerchantData.has(product.productUrl)) {
          const merchantData = googleMerchantData.get(product.productUrl);
          if (merchantData && merchantData.imageUrl) {
            imageUrl = merchantData.imageUrl;
            console.log(`Using Google Merchant image for ${product.title}`);
            
            // Update the product in the original data for future use
            product.imageUrl = merchantData.imageUrl;
          }
        }
        
        // Try to match by product title
        if (!imageUrl && product.title && googleMerchantData.has(product.title.toLowerCase())) {
          const merchantData = googleMerchantData.get(product.title.toLowerCase());
          if (merchantData && merchantData.imageUrl) {
            imageUrl = merchantData.imageUrl;
            console.log(`Using Google Merchant image for ${product.title} (by title match)`);
            
            // Update the product in the original data for future use
            product.imageUrl = merchantData.imageUrl;
          }
        }
        
        // Try fuzzy matching for image URL
        if (!imageUrl && product.title) {
          const title = product.title.toLowerCase();
          let bestMatch = null;
          let bestMatchScore = 0;
          
          // Convert map entries to array first to avoid MapIterator error
          const entries = Array.from(googleMerchantData.entries());
          
          for (const [key, value] of entries) {
            if (key.includes(title) || title.includes(key)) {
              const score = Math.min(key.length, title.length) / Math.max(key.length, title.length);
              if (score > bestMatchScore && score > 0.7) { // Only use matches with >70% similarity
                bestMatch = value;
                bestMatchScore = score;
              }
            }
          }
          
          if (bestMatch && bestMatch.imageUrl) {
            imageUrl = bestMatch.imageUrl;
            console.log(`Using Google Merchant image for ${product.title} (by fuzzy match with score ${bestMatchScore.toFixed(2)})`);
            
            // Update the product in the original data for future use
            product.imageUrl = bestMatch.imageUrl;
          }
        }
        
        // If still no image, use a placeholder
        if (!imageUrl) {
          const title = encodeURIComponent(product.title || 'Product');
          imageUrl = `https://via.placeholder.com/150?text=${title.substring(0, 10)}`;
          
          // For dates-related products, use more specific images
          if ((product.title || '').toLowerCase().includes('date')) {
            if ((product.title || '').toLowerCase().includes('stuffed')) {
              imageUrl = 'https://images.unsplash.com/photo-1583315527632-b26c6b7da5d3?w=150&h=150&fit=crop';
            } else {
              imageUrl = 'https://images.unsplash.com/photo-1601897690193-6c5b4f0e8881?w=150&h=150&fit=crop';
            }
          }
        }
      }
      
      return {
        id: product.id || Math.random().toString(36).substring(2, 9),
        title: product.title || "Unnamed Product",
        description: product.description === "NULL" ? "No description available" : (product.description || "No description available"),
        price: price,
        imageUrl: imageUrl,
        productUrl: product.productUrl || "#"
      };
    });
    
    // After processing, save any updated product images back to the file
    try {
      // Check if any products were updated with new image URLs
      let updatedCount = 0;
      allProducts.forEach((product: any) => {
        if (product.imageUrl) updatedCount++;
      });
      
      if (updatedCount > 0) {
        console.log(`Saving ${updatedCount} updated product images back to products.json`);
        fs.writeFileSync(productsFilePath, JSON.stringify(allProducts, null, 2));
      }
    } catch (writeError: any) {
      console.error('Error saving updated product images:', writeError.message);
      // Continue with the response even if saving fails
    }
    
    console.log(`Returning ${sanitizedProducts.length} product recommendations:`, sanitizedProducts.map((p: any) => p.title));
    
    // Return the products
    try {
      const responseData = { products: sanitizedProducts };
      console.log("Sending response:", JSON.stringify(responseData).substring(0, 200) + "...");
      return res.json({
        products: sanitizedProducts.map(product => {
          // Ensure product URL is absolute
          let productUrl = product.productUrl || '';
          if (productUrl && !productUrl.startsWith('http')) {
            productUrl = `https://www.karjistore.com${productUrl.startsWith('/') ? productUrl : '/' + productUrl}`;
          }
          
          // Ensure image URL is absolute
          let imageUrl = product.imageUrl || '';
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = `https://www.karjistore.com${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
          }
          
          // Ensure price is a valid number
          let price = 0;
          if (typeof product.price === 'string') {
            price = parseFloat(product.price);
          } else if (typeof product.price === 'number') {
            price = product.price;
          }
          
          // If price is not valid, set a default
          if (!price || isNaN(price)) {
            price = 99.99; // Default price
          }
          
          console.log(`Sending product to client from recommendations: ${product.title}`);
          console.log(`  URL: ${productUrl} (original: ${product.productUrl})`);
          console.log(`  Image: ${imageUrl} (original: ${product.imageUrl})`);
          console.log(`  Price: ${price} (original: ${product.price}, type: ${typeof product.price})`);
          
          return {
            title: product.title || 'Unknown Product',
            description: product.description || 'No description available',
            price: price,
            imageUrl: imageUrl,
            productUrl: productUrl
          };
        })
      });
    } catch (responseError) {
      console.error("Error sending response:", responseError);
      return res.status(500).json({ error: "Error formatting response" });
    }
    
  } catch (error: any) {
    console.error('Error generating product recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to generate product recommendations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Chat history endpoint
router.get('/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // This endpoint was not using db, so it's removed as per the edit hint.
    // If you need to implement this, you'll need to restore the db import.
    // For now, returning an empty array instead of a placeholder message.
    res.json([]);
    
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
});

// Order tracking endpoint
router.post('/track-order', async (req, res) => {
  try {
    const { email, orderId } = req.body;
    
    if (!email || !orderId) {
      return res.status(400).json({ error: 'Email and order ID are required' });
    }
    
    // For demo purposes, we'll return mock data
    // In a real app, this would query your order database
    
    // Simulate a delay for realism
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 30% chance of order not found for testing error states
    if (Math.random() < 0.3) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const mockOrder = {
      id: Math.floor(Math.random() * 10000),
      orderNumber: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
      orderDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      status: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'][Math.floor(Math.random() * 4)],
      customer: {
        name: email.split('@')[0],
        email
      }
    };
    
    const statuses = [
      { status: 'Order Placed', completed: true },
      { status: 'Payment Confirmed', completed: true },
      { status: 'Processing', completed: mockOrder.status !== 'Processing' },
      { status: 'Shipped', completed: ['Shipped', 'Out for Delivery', 'Delivered'].includes(mockOrder.status) },
      { status: 'Out for Delivery', completed: ['Out for Delivery', 'Delivered'].includes(mockOrder.status) },
      { status: 'Delivered', completed: mockOrder.status === 'Delivered' }
    ];
    
    const timeline = statuses.map((status, index) => ({
      id: index,
      status: status.status,
      date: new Date(Date.now() - (5 - index) * 24 * 60 * 60 * 1000).toISOString(),
      completed: status.completed,
      isLatest: status.status === mockOrder.status
    }));
    
    const latestStatus = timeline.find(item => item.isLatest);
    
    res.json({
      order: mockOrder,
      timeline,
      latestUpdate: latestStatus ? {
        status: latestStatus.status,
        date: latestStatus.date
      } : null
    });
    
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ error: 'Failed to track order' });
  }
});

// System status endpoint
router.get('/status', async (req, res) => {
  try {
    // Check AI provider configuration
    const aiConnected = await aiService.testConnection();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      aiProvider: {
        configured: true,
        provider: 'configured',
        active: aiConnected
      }
    });
  } catch (error) {
    console.error('Error checking system status:', error);
    res.status(500).json({ error: 'Failed to check system status' });
  }
});

// Memory management endpoints
router.get('/memory/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const context = agenticRagService.getConversationContext(sessionId);
    const preferences = agenticRagService.getUserPreferences(sessionId);
    
    res.json({
      sessionId,
      context,
      preferences,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving memory:', error);
    res.status(500).json({ error: 'Failed to retrieve memory' });
  }
});

router.post('/memory/:sessionId/preferences', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { preferences } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Preferences object is required' });
    }
    
    agenticRagService.updateUserPreferences(sessionId, preferences);
    
    res.json({
      sessionId,
      preferences: agenticRagService.getUserPreferences(sessionId),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// System initialization endpoint
router.post('/system/initialize', async (req, res) => {
  try {
    console.log('Initializing system via API...');
    
    // Initialize knowledge base
    await agenticRagService.initializeKnowledgeBase();
    
    res.json({
      success: true,
      message: 'System initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error initializing system:', error);
    res.status(500).json({ error: 'Failed to initialize system' });
  }
});

// Add this function to fetch Google Merchant feed
async function fetchGoogleMerchantFeed() {
  try {
    console.log('Fetching Google Merchant feed...');
    const feedUrl = 'https://daima.ae/userfiles/1-1-0001-mygooglemerchantcenterxmlfeed1.xml';
    
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch Google Merchant feed: ${response.status} ${response.statusText}`);
      return createSampleProductMap();
    }
    
    const responseText = await response.text();
    console.log(`Feed data received, length: ${responseText.length}`);
    
    // Debug: Save raw XML for inspection
    try {
      fs.writeFileSync('debug-merchant-feed.xml', responseText);
      console.log('Saved raw XML feed to debug-merchant-feed.xml for inspection');
    } catch (err) {
      console.log('Could not save debug XML file');
    }
    
    // Extract image URLs directly from the XML using regex for reliability
    console.log('Extracting product data using regex patterns...');
    const productMap = new Map();
    
    // Extract product URLs
    const urlRegex = /<link>([^<]+)<\/link>/g;
    let urlMatch;
    const productUrls = [];
    while ((urlMatch = urlRegex.exec(responseText)) !== null) {
      productUrls.push(urlMatch[1]);
    }
    
    // Extract image URLs
    const imageRegex = /<g:image_link>([^<]+)<\/g:image_link>/g;
    let imageMatch;
    const imageUrls = [];
    while ((imageMatch = imageRegex.exec(responseText)) !== null) {
      imageUrls.push(imageMatch[1]);
    }
    
    // Extract titles
    const titleRegex = /<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g;
    let titleMatch;
    const titles = [];
    while ((titleMatch = titleRegex.exec(responseText)) !== null) {
      titles.push(titleMatch[1]);
    }
    
    // Extract prices
    const priceRegex = /<g:price>([^<]+)<\/g:price>/g;
    let priceMatch;
    const prices = [];
    while ((priceMatch = priceRegex.exec(responseText)) !== null) {
      const priceStr = priceMatch[1];
      const priceValue = parseFloat(priceStr.split(' ')[0]);
      prices.push(priceValue);
    }
    
    console.log(`Found ${productUrls.length} product URLs, ${imageUrls.length} image URLs, ${titles.length} titles, and ${prices.length} prices`);
    
    // Map products if all arrays have the same length
    if (productUrls.length === imageUrls.length && productUrls.length === titles.length && productUrls.length === prices.length) {
      for (let i = 0; i < productUrls.length; i++) {
        const productUrl = productUrls[i];
        const imageUrl = imageUrls[i];
        const title = titles[i];
        const price = prices[i];
        
        // Map by URL
        productMap.set(productUrl, {
          imageUrl,
          title,
          price
        });
        
        // Also map by title for fuzzy matching
        productMap.set(title.toLowerCase(), {
          imageUrl,
          title,
          price,
          productUrl
        });
      }
      
      console.log(`Successfully mapped ${productMap.size / 2} products from Google Merchant feed`);
      
      // Debug: Save parsed data for inspection
      try {
        const debugData = Array.from(productMap.entries())
          .filter(([key]) => !key.includes(' ')) // Only include URL keys, not title keys
          .map(([url, data]) => ({
            url,
            imageUrl: data.imageUrl,
            title: data.title,
            price: data.price
          }));
        
        fs.writeFileSync('debug-merchant-data.json', JSON.stringify(debugData, null, 2));
        console.log('Saved parsed merchant data to debug-merchant-data.json for inspection');
      } catch (err) {
        console.log('Could not save debug JSON file');
      }
      
      return productMap;
    } else {
      console.error('Mismatched array lengths in XML parsing:', {
        productUrls: productUrls.length,
        imageUrls: imageUrls.length,
        titles: titles.length,
        prices: prices.length
      });
      
      // Try the XML parser as fallback
      return parseXmlFeed(responseText);
    }
  } catch (error) {
    console.error('Error fetching Google Merchant feed:', error);
    
    // Fallback to sample data if fetch fails
    console.log('Using sample data from the Google Merchant feed...');
    return createSampleProductMap();
  }
}

// Fallback XML parser function
function parseXmlFeed(xmlText: string) {
  try {
    console.log('Attempting to parse XML feed with XMLParser...');
    
    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      parseTagValue: true
      // Remove cdataTagName and textNodeName options as they're not supported
    });
    
    const result = parser.parse(xmlText);
    
    if (!result || !result.rss || !result.rss.channel || !result.rss.channel.item) {
      console.error('Invalid XML structure in Google Merchant feed');
      return createSampleProductMap();
    }
    
    // Extract product data
    const items = Array.isArray(result.rss.channel.item) 
      ? result.rss.channel.item 
      : [result.rss.channel.item];
    
    console.log(`Found ${items.length} products in feed using XMLParser`);
    
    // Debug: Save parsed JSON for inspection
    try {
      fs.writeFileSync('debug-xml-parsed.json', JSON.stringify(items.slice(0, 10), null, 2));
      console.log('Saved first 10 parsed items to debug-xml-parsed.json for inspection');
    } catch (err) {
      console.log('Could not save debug JSON file');
    }
    
    // Create a map of product URLs to image URLs
    const productImageMap = new Map();
    
    items.forEach((item: any) => {
      // Handle different possible structures
      const link = item.link;
      const imageUrl = item['g:image_link'];
      
      const title = item.title || '';
      
      const priceStr = item['g:price'] || '';
      
      const price = priceStr ? parseFloat(priceStr.toString().split(' ')[0]) : 0;
      
      if (link && imageUrl) {
        // Map by URL
        productImageMap.set(link, {
          imageUrl,
          title,
          price
        });
        
        // Also map by title for fuzzy matching
        if (title) {
          productImageMap.set(title.toLowerCase(), {
            imageUrl,
            title,
            price,
            productUrl: link
          });
        }
      }
    });
    
    console.log(`Processed ${productImageMap.size / 2} products from Google Merchant feed using XMLParser`);
    return productImageMap;
    
  } catch (parseError) {
    console.error('Error parsing XML with XMLParser:', parseError);
    return createSampleProductMap();
  }
}

// Create a sample product map as fallback
function createSampleProductMap() {
  // Create a map with sample data from the Google Merchant feed XML
  const map = new Map();
  
  // Sample data from the Google Merchant feed
  const sampleProducts = [
    {
      title: "Pre Packed Saffron Super Negin Iran",
      url: "https://daima.ae/pre-packed-saffron-super-negin-iran",
      imageUrl: "https://daima.ae/media/293/catalog/saffron-super-negin-irn-01.jpg",
      price: 16.80
    },
    {
      title: "Baked Pretzos Salt",
      url: "https://daima.ae/baked-pretzos-salt",
      imageUrl: "https://daima.ae/media/315/catalog/baked-pretzos-salt-02.jpg",
      price: 24.00
    },
    {
      title: "Baked Pretzos Sesame",
      url: "https://daima.ae/baked-pretzos-sesame",
      imageUrl: "https://daima.ae/media/317/catalog/baked-pretzos-sesame-02.jpg",
      price: 24.00
    },
    {
      title: "Assorted Baklava 250gm",
      url: "https://daima.ae/assorted-baklava-250gm",
      imageUrl: "https://daima.ae/media/325/catalog/assorted-baklava-250gm-0222.jpg",
      price: 52.00
    },
    {
      title: "Assorted Baklava 500gm",
      url: "https://daima.ae/assorted-baklava-500gm",
      imageUrl: "https://daima.ae/media/326/catalog/assorted-baklava-500gm-01111.jpg",
      price: 100.00
    },
    {
      title: "Stuffed Dates Jumbo Assorted",
      url: "https://daima.ae/stuffed-dates-jumbo-assorted",
      imageUrl: "https://daima.ae/media/343/catalog/barazik-700gm-02.jpg",
      price: 100.00
    },
    {
      title: "Daima Stuffed Dates Butter Fly Tray Small 1290gm",
      url: "https://daima.ae/daima-stuffed-dates-butter-fly-tray-small-1290gm",
      imageUrl: "https://daima.ae/media/2125/catalog/daima-stuffed-dates-butter-fly-tray-small-1290gm-01.jpg",
      price: 292.00
    }
  ];
  
  // Add products to the map
  for (const product of sampleProducts) {
    // Map by URL
    map.set(product.url, {
      imageUrl: product.imageUrl,
      title: product.title,
      price: product.price
    });
    
    // Also map by title for fuzzy matching
    map.set(product.title.toLowerCase(), {
      imageUrl: product.imageUrl,
      title: product.title,
      productUrl: product.url,
      price: product.price
    });
  }
  
  console.log(`Created sample map with ${map.size} entries`);
  return map;
}

// Helper function to extract categories from products
function extractCategoriesFromProducts(products: any[]): Array<{label: string, value: string}> {
  // First attempt: try to use the 'category' field if available
  const categoriesFromField = new Set<string>();
  
  products.forEach(product => {
    if (product.category && typeof product.category === 'string') {
      categoriesFromField.add(product.category);
    }
  });
  
  if (categoriesFromField.size > 0) {
    return Array.from(categoriesFromField).map(category => ({
      label: category.charAt(0).toUpperCase() + category.slice(1),
      value: category.toLowerCase()
    }));
  }
  
  // Second attempt: analyze product titles and descriptions
  const keywordMap: Record<string, string[]> = {
    'dates': ['dates', 'date', 'majdool', 'khudri', 'sukkari', 'ajwat', 'mabroom', 'stuffed dates'],
    'chocolates': ['chocolate', 'dragee', 'pecan', 'hazelnut', 'almond', 'cashew'],
    'sweets': ['baklava', 'sweet', 'barazik'],
    'vegetables': ['vegetable', 'dehydrated', 'carrot', 'green bean', 'sweet potato', 'beetroot', 'mushroom', 'okra', 'snap peas', 'pumpkin'],
    'coffee': ['coffee', 'bean', 'roasted', 'arabic', 'cardamom']
  };
  
  // Count products in each category
  const categoryCounts: Record<string, number> = {};
  
  products.forEach(product => {
    const title = (product.title || '').toLowerCase();
    const description = (product.description || '').toLowerCase();
    
    Object.entries(keywordMap).forEach(([category, keywords]) => {
      if (keywords.some(keyword => title.includes(keyword) || description.includes(keyword))) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    });
  });
  
  // Convert to array and sort by count
  const sortedCategories = Object.entries(categoryCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, _]) => ({
      label: category.charAt(0).toUpperCase() + category.slice(1),
      value: category.toLowerCase()
    }));
  
  // If no categories found, return default categories
  if (sortedCategories.length === 0) {
    return [
      { label: "Dates and Date Products", value: "dates" },
      { label: "Chocolates and Dragees", value: "chocolates" },
      { label: "Baklava and Sweets", value: "sweets" },
      { label: "Dehydrated Vegetables", value: "vegetables" },
      { label: "Coffee and Beverages", value: "coffee" }
    ];
  }
  
  return sortedCategories;
}
