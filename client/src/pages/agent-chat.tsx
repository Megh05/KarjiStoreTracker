import React from 'react';
import AgentChatWidget from '@/components/AgentChatWidget';
import { Toaster } from '@/components/ui/toaster';

const AgentChatPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-900">KarjiStore Intelligent Agent</h1>
          <p className="text-gray-600">Powered by advanced AI agent technology</p>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">About This Agent</h2>
            <p className="text-gray-700 mb-4">
              This is an intelligent shopping assistant powered by a ReAct (Reasoning + Acting) agent architecture.
              Unlike traditional chatbots, this agent can reason about your needs and take actions to help you find
              the perfect products.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm text-blue-700">
                <strong>Try asking:</strong> "I need a perfume for a special occasion", "Show me men's watches under $300",
                or "What's the difference between eau de parfum and eau de toilette?"
              </p>
            </div>
          </div>
          
          <AgentChatWidget />
        </div>
      </main>
      
      <footer className="bg-gray-800 text-white py-6 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} KarjiStore. All rights reserved.</p>
          <p className="text-gray-400 text-sm mt-2">Powered by intelligent agent technology</p>
        </div>
      </footer>
      
      <Toaster />
    </div>
  );
};

export default AgentChatPage;