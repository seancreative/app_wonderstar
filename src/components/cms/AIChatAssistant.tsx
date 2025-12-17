import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, TrendingUp, Target, Package } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const AIChatAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = daysOfWeek[new Date().getDay()];

      setTimeout(() => {
        setMessages([
          {
            id: '1',
            text: `Hello! It's ${today}! How can I help you?`,
            sender: 'ai',
            timestamp: new Date()
          }
        ]);
      }, 300);
    }
  }, [isOpen]);

  const handleQuickAction = (action: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: action,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    setTimeout(() => {
      let aiResponse = '';

      switch (action) {
        case 'Analyze Sales':
          aiResponse = "I'm analyzing your sales data... Based on recent trends, your sales have increased by 15% this month. Peak hours are between 2-4 PM. Would you like me to provide more detailed insights?";
          break;
        case 'Predict Marketing':
          aiResponse = "Looking at your customer patterns... I recommend focusing on email campaigns on Mondays and social media promotions on Fridays. Your conversion rate could improve by 20% with targeted voucher campaigns.";
          break;
        case 'Check Stock':
          aiResponse = "Checking inventory levels... You have 3 products running low: Classic Burger (12 left), Iced Coffee (8 left), and French Fries (15 left). Would you like me to suggest reorder quantities?";
          break;
        default:
          aiResponse = "I'm here to help! You can ask me about sales analytics, marketing predictions, inventory management, or any other business insights you need.";
      }

      const aiMessage: Message = {
        id: Date.now().toString(),
        text: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: "Thank you for your message! I'm currently in demo mode. This AI assistant will be powered by advanced analytics to provide real-time insights about your business data, trends, and actionable recommendations.",
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1200);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 text-white shadow-2xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-50 animate-bounce-gentle"
          style={{
            animation: 'glow-pulse 2s ease-in-out infinite'
          }}
        >
          <Sparkles className="w-8 h-8 animate-pulse" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-8 right-8 w-96 h-[600px] bg-white rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden border-4 border-purple-200 animate-scale-in">
          <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg">AI Assistant</h3>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-white/90 text-xs font-semibold">Online</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-purple-50/30 to-white">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3 ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white border-2 border-purple-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm font-medium leading-relaxed">{message.text}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.sender === 'user' ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="space-y-2 animate-slide-up">
                <button
                  onClick={() => handleQuickAction('Analyze Sales')}
                  className="w-full p-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  Analyze Sales
                </button>
                <button
                  onClick={() => handleQuickAction('Predict Marketing')}
                  className="w-full p-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-2"
                >
                  <Target className="w-5 h-5" />
                  Predict Marketing
                </button>
                <button
                  onClick={() => handleQuickAction('Check Stock')}
                  className="w-full p-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-2"
                >
                  <Package className="w-5 h-5" />
                  Check Stock
                </button>
              </div>
            )}

            {isTyping && (
              <div className="flex justify-start animate-slide-up">
                <div className="bg-white border-2 border-purple-200 rounded-2xl p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t-2 border-purple-100">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-3 bg-gray-100 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none font-medium text-sm transition-colors"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.5), 0 0 30px rgba(236, 72, 153, 0.4), 0 0 40px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(168, 85, 247, 0.8), 0 0 45px rgba(236, 72, 153, 0.6), 0 0 60px rgba(59, 130, 246, 0.5);
          }
        }

        @keyframes bounce-gentle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-bounce-gentle {
          animation: bounce-gentle 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};

export default AIChatAssistant;
