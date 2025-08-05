import { useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Share your luxury preferences..." 
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-4 bg-white rounded-b-3xl border-t border-gray-100">
      <form onSubmit={handleSubmit} className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <Input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm text-gray-800 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 shadow-sm outline-none transition-colors"
          />
        </div>
        <Button
          type="submit"
          disabled={disabled || !message.trim()}
          className="bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-600 disabled:from-gray-300 disabled:via-gray-300 disabled:to-gray-300 text-white w-12 h-12 rounded-2xl p-0 transition-all duration-300 hover:scale-105 shadow-md disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
