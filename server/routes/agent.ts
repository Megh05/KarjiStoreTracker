/**
 * Agent-based chat routes
 * 
 * These routes handle the agent-based approach to chat, where a single LLM agent
 * has more agency to decide what information it needs and what actions to take.
 */

import express from 'express';
import { agentSystem } from '../services/agent-system';

const router = express.Router();

// Agent chat message endpoint
router.post('/agent/message', async (req, res) => {
  try {
    console.log('\n📋 AGENT SESSION MANAGEMENT:');
    
    // Extract session ID from request body or headers
    const providedSessionId = req.body.sessionId || req.headers['x-session-id'];
    
    if (!providedSessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const finalSessionId = providedSessionId.toString();
    
    console.log(`   Final sessionId: ${finalSessionId}`);
    
    // Extract message content
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    console.log(`\n🤖 AGENT PROCESSING:`)
    console.log(`   Query: "${content}"`);
    console.log(`   SessionId: ${finalSessionId}`);
    
    // Process the query with the agent system
    const agentResponse = await agentSystem.processQuery(content, finalSessionId);
    
    console.log(`\n📤 AGENT RESPONSE:`)
    console.log(`   Message: "${agentResponse.message}"`);
    console.log(`   Products: ${agentResponse.products ? agentResponse.products.length : 0}`);
    
    // Return the agent's response
    return res.json({
      message: agentResponse.message,
      products: agentResponse.products,
      confidence: agentResponse.confidence,
      sources: agentResponse.sources,
      sessionId: finalSessionId
    });
  } catch (error) {
    console.error('Error in agent chat message endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent chat history endpoint
router.get('/agent/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // For now, we'll use the existing chat history endpoint implementation
    // This could be enhanced to use the agent's memory system directly
    const filePath = `chat-session-${sessionId}.json`;
    
    // Check if the file exists
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(__dirname, '../../data-storage', filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.json([]);
    }
    
    // Read the file
    const data = fs.readFileSync(fullPath, 'utf8');
    const messages = JSON.parse(data);
    
    return res.json(messages);
  } catch (error) {
    console.error('Error retrieving agent chat history:', error);
    return res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
});

export default router;