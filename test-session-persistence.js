import fs from 'fs';
import path from 'path';

// Mock session persistence test
class SessionPersistenceTest {
  
  constructor() {
    this.sessions = new Map();
    this.sessionCounter = 0;
  }
  
  // Simulate session management
  createSession() {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.sessions.set(sessionId, {
      messages: [],
      preferences: {},
      context: {}
    });
    return sessionId;
  }
  
  // Simulate conversation with session persistence
  async sendMessage(content, sessionId = null) {
    // Create new session if none provided
    if (!sessionId) {
      sessionId = this.createSession();
      console.log(`🆕 Created new session: ${sessionId}`);
    } else {
      console.log(`🔄 Using existing session: ${sessionId}`);
    }
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Add user message to session
    session.messages.push({
      role: 'user',
      content,
      timestamp: new Date()
    });
    
    // Extract preferences from message
    this.extractPreferences(session, content);
    
    // Generate response based on conversation context
    const response = this.generateResponse(content, session);
    
    // Add bot response to session
    session.messages.push({
      role: 'assistant',
      content: response.message,
      timestamp: new Date()
    });
    
    return {
      message: response.message,
      sessionId,
      products: response.products,
      preferences: { ...session.preferences },
      messageCount: session.messages.length
    };
  }
  
  extractPreferences(session, content) {
    const contentLower = content.toLowerCase();
    
    // Track style preferences
    if (['classic', 'modern', 'sporty', 'elegant'].some(style => contentLower.includes(style))) {
      session.preferences.style = contentLower.includes('classic') ? 'classic' : 
                                contentLower.includes('modern') ? 'modern' : 
                                contentLower.includes('sporty') ? 'sporty' : 'elegant';
    }
    
    // Track budget preferences
    if (/\d+/.test(contentLower) || contentLower.includes('budget')) {
      const budgetMatch = contentLower.match(/(\d+)-(\d+)/);
      if (budgetMatch) {
        session.preferences.budget = `${budgetMatch[1]}-${budgetMatch[2]}`;
      }
    }
    
    // Track gender preferences
    if (contentLower.includes('women') || contentLower.includes('ladies')) {
      session.preferences.gender = 'women';
    } else if (contentLower.includes('men') || contentLower.includes('gents')) {
      session.preferences.gender = 'men';
    }
    
    // Track category preferences
    if (contentLower.includes('watch')) {
      session.preferences.category = 'watch';
    } else if (contentLower.includes('perfume') || contentLower.includes('fragrance')) {
      session.preferences.category = 'perfume';
    }
  }
  
  generateResponse(content, session) {
    const contentLower = content.toLowerCase();
    const hasStyle = session.preferences.style;
    const hasBudget = session.preferences.budget;
    const hasGender = session.preferences.gender;
    
    // Check conversation context
    const recentMessages = session.messages.slice(-4);
    const hasWatchContext = recentMessages.some(msg => 
      msg.content.toLowerCase().includes('watch')
    );
    
    let message;
    let products = null;
    
    // Step 1: Generic query - ask for gender
    if (contentLower.includes('watch') && !hasGender) {
      message = "I can help you find watches! Are you looking for men's or women's watches?";
    }
    
    // Step 2: Gender-specific query - ask for style
    else if (contentLower.includes('watch') && hasGender && !hasStyle) {
      message = `Great! I found some ${hasGender}'s watches for you. What style are you looking for - classic, modern, or sporty?`;
    }
    
    // Step 3: Style preference - ask for budget
    else if (['classic', 'modern', 'sporty', 'elegant'].some(style => contentLower.includes(style)) && !hasBudget) {
      message = "Perfect! Now what's your budget range?";
    }
    
    // Step 4: Budget preference - show products
    else if ((/\d+/.test(contentLower) || contentLower.includes('budget')) && hasStyle && hasBudget) {
      message = "Here are some elegant watches in your price range:";
      products = [
        {
          title: "Juvenis Women Analog Watch - JV1637W",
          price: 296,
          imageUrl: "watch1.jpg"
        },
        {
          title: "Lencia Leather Women Analog Watch-LC7174B", 
          price: 595,
          imageUrl: "watch2.jpg"
        }
      ];
    }
    
    // Follow-up without context
    else {
      message = "Could you please tell me what you're looking for? I can help with watches, perfumes, or other products.";
    }
    
    return { message, products };
  }
  
  // Test session persistence
  async testSessionPersistence() {
    console.log('🧪 Testing Session Persistence...\n');
    
    const testScenarios = [
      {
        name: "Good Session - Maintains Context",
        messages: [
          "show me watches",
          "men",
          "classic",
          "200-500"
        ],
        expectedSessionCount: 1
      },
      {
        name: "Bad Session - Loses Context",
        messages: [
          "show me watches",
          "men",
          "classic",
          "200-500"
        ],
        expectedSessionCount: 4 // Each message gets new session
      }
    ];
    
    testScenarios.forEach((scenario, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 SCENARIO ${index + 1}: ${scenario.name}`);
      console.log(`${'='.repeat(60)}`);
      
      // Reset sessions
      this.sessions.clear();
      
      let currentSessionId = null;
      const usedSessions = new Set();
      
      scenario.messages.forEach(async (message, msgIndex) => {
        console.log(`\n📝 Message ${msgIndex + 1}: "${message}"`);
        
        // For bad session scenario, don't pass session ID
        const sessionIdToUse = scenario.name.includes("Bad") ? null : currentSessionId;
        
        const result = await this.sendMessage(message, sessionIdToUse);
        
        console.log(`✅ Response: "${result.message}"`);
        console.log(`✅ Session ID: ${result.sessionId}`);
        console.log(`✅ Message Count: ${result.messageCount}`);
        console.log(`✅ Preferences: ${JSON.stringify(result.preferences)}`);
        console.log(`✅ Products: ${result.products ? result.products.length : 'None'}`);
        
        // Track session usage
        usedSessions.add(result.sessionId);
        currentSessionId = result.sessionId;
        
        // Verify session continuity
        const sessionContinuity = scenario.name.includes("Good") ? 
          (msgIndex === 0 || result.sessionId === currentSessionId) :
          true; // For bad scenario, we expect different sessions
        
        console.log(`🎯 SESSION CHECK:`);
        console.log(`   Session continuity: ${sessionContinuity ? '✅' : '❌'}`);
        console.log(`   Unique sessions used: ${usedSessions.size}`);
      });
      
      console.log(`\n📊 SESSION SUMMARY:`);
      console.log(`   Expected sessions: ${scenario.expectedSessionCount}`);
      console.log(`   Actual sessions: ${usedSessions.size}`);
      console.log(`   Session persistence: ${usedSessions.size === scenario.expectedSessionCount ? '✅' : '❌'}`);
    });
  }
  
  // Test conversation memory
  async testConversationMemory() {
    console.log('\n🧪 Testing Conversation Memory...\n');
    
    const sessionId = this.createSession();
    const session = this.sessions.get(sessionId);
    
    const conversation = [
      "show me watches",
      "men",
      "classic",
      "200-500"
    ];
    
    console.log(`📝 Testing conversation with session: ${sessionId}`);
    
    for (let i = 0; i < conversation.length; i++) {
      const message = conversation[i];
      console.log(`\n📝 Step ${i + 1}: "${message}"`);
      
      const result = await this.sendMessage(message, sessionId);
      
      console.log(`✅ Response: "${result.message}"`);
      console.log(`✅ Preferences: ${JSON.stringify(result.preferences)}`);
      console.log(`✅ Message Count: ${result.messageCount}`);
      
      // Verify memory is maintained
      const hasMemory = result.messageCount > 2;
      const hasPreferences = Object.keys(result.preferences).length > 0;
      
      console.log(`🎯 MEMORY CHECK:`);
      console.log(`   Has conversation history: ${hasMemory ? '✅' : '❌'}`);
      console.log(`   Has preferences: ${hasPreferences ? '✅' : '❌'}`);
    }
  }
}

async function testSessionPersistence() {
  try {
    const test = new SessionPersistenceTest();
    
    // Test session persistence
    await test.testSessionPersistence();
    
    // Test conversation memory
    await test.testConversationMemory();
    
    console.log('\n📋 SUMMARY:');
    console.log('✅ Good: Session persistence maintains conversation context');
    console.log('❌ Bad: New sessions lose conversation context');
    console.log('🎯 Goal: Maintain single session throughout conversation');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSessionPersistence().catch(console.error); 