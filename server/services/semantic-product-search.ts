import { aiService } from './ai-service.js';
import { vectorStorage } from './vector-storage.js';

export interface SemanticProductQuery {
  query: string;
  category?: string;
  gender?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
  style?: string;
  brand?: string[];
  features?: string[];
}

export interface SemanticProductMatch {
  product: any;
  relevanceScore: number;
  reasoning: string;
  matchedCriteria: string[];
}

export class SemanticProductSearchService {
  
  /**
   * Analyze user query semantically to extract intent and preferences
   */
  async analyzeQuery(query: string): Promise<SemanticProductQuery> {
    const analysisPrompt = `
You are a product search assistant. Analyze this query and extract the user's intent and preferences.

Query: "${query}"

Extract the following information:
1. Product category (watch, perfume, jewelry, etc.)
2. Target gender (men, women, unisex)
3. Price range if mentioned
4. Style preferences if mentioned
5. Brand preferences if mentioned
6. Specific features if mentioned

Return your analysis as JSON:
{
  "category": "string or null",
  "gender": "string or null", 
  "priceRange": {"min": number, "max": number} or null,
  "style": "string or null",
  "brand": ["array", "of", "brands"] or null,
  "features": ["array", "of", "features"] or null
}
`;

    try {
      const response = await aiService.generateResponse([
        { role: 'system', content: analysisPrompt },
        { role: 'user', content: query }
      ]);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to keyword analysis
      return this.fallbackQueryAnalysis(query);
    } catch (error) {
      console.error('Error in semantic query analysis:', error);
      return this.fallbackQueryAnalysis(query);
    }
  }

  /**
   * Classify a product semantically
   */
  async classifyProduct(product: any): Promise<{
    category: string;
    gender: string;
    price: number;
    style: string;
    features: string[];
  }> {
    const classificationPrompt = `
Analyze this product and classify it semantically:

Product Title: "${product.title}"
Product Description: "${product.description}"
Price: ${product.price} AED

Classify the product and return as JSON:
{
  "category": "watch|perfume|jewelry|accessory",
  "gender": "men|women|unisex",
  "price": number,
  "style": "classic|modern|sporty|elegant|casual",
  "features": ["array", "of", "features"]
}
`;

    try {
      const response = await aiService.generateResponse([
        { role: 'system', content: classificationPrompt },
        { role: 'user', content: `${product.title} - ${product.description}` }
      ]);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback classification
      return this.fallbackProductClassification(product);
    } catch (error) {
      console.error('Error in product classification:', error);
      return this.fallbackProductClassification(product);
    }
  }

  /**
   * Calculate semantic relevance between query and product
   */
  async calculateRelevance(query: SemanticProductQuery, product: any): Promise<SemanticProductMatch> {
    const relevancePrompt = `
Calculate the semantic relevance between this query and product:

Query Intent: ${JSON.stringify(query)}
Product: ${product.title} - ${product.description} - ${product.price} AED

Rate the relevance from 0-10 and explain why.
Return as JSON:
{
  "relevanceScore": number (0-10),
  "reasoning": "explanation",
  "matchedCriteria": ["array", "of", "matched", "criteria"]
}
`;

    try {
      const response = await aiService.generateResponse([
        { role: 'system', content: relevancePrompt },
        { role: 'user', content: `Query: ${JSON.stringify(query)}\nProduct: ${product.title}` }
      ]);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          product,
          relevanceScore: result.relevanceScore,
          reasoning: result.reasoning,
          matchedCriteria: result.matchedCriteria
        };
      }
      
      // Fallback relevance calculation
      return this.fallbackRelevanceCalculation(query, product);
    } catch (error) {
      console.error('Error in relevance calculation:', error);
      return this.fallbackRelevanceCalculation(query, product);
    }
  }

  /**
   * Search products using semantic understanding
   */
  async searchProducts(query: string, limit: number = 10): Promise<SemanticProductMatch[]> {
    try {
      // Step 1: Analyze user query semantically
      const queryIntent = await this.analyzeQuery(query);
      console.log('Semantic query analysis:', queryIntent);
      
      // Step 2: Get all products
      await vectorStorage.initialize();
      const allProducts = vectorStorage.productItems;
      
      // Step 3: Classify and score each product
      const scoredProducts: SemanticProductMatch[] = [];
      
      for (const product of allProducts) {
        const relevance = await this.calculateRelevance(queryIntent, product);
        if (relevance.relevanceScore > 0) {
          scoredProducts.push(relevance);
        }
      }
      
      // Step 4: Sort by relevance and return top results
      return scoredProducts
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
        
    } catch (error) {
      console.error('Error in semantic product search:', error);
      return [];
    }
  }

  // Fallback methods for when LLM fails
  private fallbackQueryAnalysis(query: string): SemanticProductQuery {
    const queryLower = query.toLowerCase();
    
    return {
      query,
      category: queryLower.includes('watch') ? 'watch' : 
                queryLower.includes('perfume') ? 'perfume' : 
                queryLower.includes('jewelry') ? 'jewelry' : null,
      gender: queryLower.includes('women') || queryLower.includes('ladies') ? 'women' :
              queryLower.includes('men') ? 'men' : null,
      priceRange: null,
      style: null,
      brand: null,
      features: null
    };
  }

  private fallbackProductClassification(product: any): any {
    const title = product.title.toLowerCase();
    const description = product.description.toLowerCase();
    
    return {
      category: title.includes('watch') ? 'watch' : 
                title.includes('perfume') || title.includes('edp') || title.includes('edt') ? 'perfume' : 
                title.includes('jewelry') ? 'jewelry' : 'accessory',
      gender: title.includes('women') || title.includes('ladies') ? 'women' :
              title.includes('men') ? 'men' : 'unisex',
      price: parseFloat(product.price) || 0,
      style: 'classic',
      features: []
    };
  }

  private fallbackRelevanceCalculation(query: SemanticProductQuery, product: any): SemanticProductMatch {
    const title = product.title.toLowerCase();
    const description = product.description.toLowerCase();
    let score = 0;
    const matchedCriteria: string[] = [];
    
    // Category matching
    if (query.category && title.includes(query.category)) {
      score += 3;
      matchedCriteria.push('category');
    }
    
    // Gender matching
    if (query.gender && (title.includes(query.gender) || description.includes(query.gender))) {
      score += 2;
      matchedCriteria.push('gender');
    }
    
    // Price matching
    if (query.priceRange) {
      const price = parseFloat(product.price);
      if (price >= (query.priceRange.min || 0) && price <= (query.priceRange.max || Infinity)) {
        score += 1;
        matchedCriteria.push('price');
      }
    }
    
    return {
      product,
      relevanceScore: Math.min(score, 10),
      reasoning: `Matched criteria: ${matchedCriteria.join(', ')}`,
      matchedCriteria
    };
  }
}

export const semanticProductSearch = new SemanticProductSearchService(); 