import { useState } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminDashboard from "@/pages/admin";
import NotFound from "@/pages/not-found";
import ChatWidget from "@/components/chat-widget";
import { queryClient } from "./lib/queryClient";
import './styles/KarjistoreChatBot.css';

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/" component={HomePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Simple home page component
function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-white text-gray-800">
      <h1 className="text-4xl font-bold text-black mb-6">Welcome to <span className="text-[#d4af37]">KarjiStore</span></h1>
      <div className="max-w-lg mb-8 text-center">
        <p className="text-lg mb-4">
          Our AI assistant is ready to help you with product information, order tracking, and more.
        </p>
        <p className="text-gray-600">
          Click the chat button in the bottom right corner to get started.
        </p>
      </div>
      <div className="w-32 h-1 bg-gradient-to-r from-black to-[#d4af37] rounded-full"></div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-white to-gray-100 relative">
          {/* Chat Widget */}
          <ChatWidget />

          {/* Main Content */}
          <div className="absolute inset-0">
            <Router />
          </div>
        </div>
        
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
