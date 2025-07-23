import { useState } from "react";
import { Switch, Route } from "wouter";
import { MessageCircle } from "lucide-react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Chatbot from "@/pages/chatbot";
import AdminDashboard from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Chatbot} />
      <Route path="/chat" component={Chatbot} />
      <Route path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  const toggleWidget = () => {
    setIsWidgetOpen(!isWidgetOpen);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 relative">
          {/* Floating Chat Button */}
          <button
            onClick={toggleWidget}
            className="fixed bottom-5 right-5 w-15 h-15 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 flex items-center justify-center"
            style={{
              width: '60px',
              height: '60px',
              transform: isWidgetOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <MessageCircle size={28} strokeWidth={2} />
          </button>

          {/* Full Screen Admin Dashboard */}
          <div className="absolute inset-0">
            <Router />
          </div>
          
          {/* Chat Widget */}
          <div
            className={`fixed transition-all duration-300 z-40 overflow-hidden bg-white shadow-2xl ${
              isWidgetOpen 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-full pointer-events-none'
            } 
            sm:bottom-24 sm:right-5 sm:w-96 sm:h-[600px] sm:rounded-2xl
            max-sm:inset-0 max-sm:w-full max-sm:h-full max-sm:rounded-none`}
          >
            <Chatbot />
          </div>

          {/* Background overlay for mobile */}
          {isWidgetOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
              onClick={() => setIsWidgetOpen(false)}
            />
          )}
        </div>
        
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
