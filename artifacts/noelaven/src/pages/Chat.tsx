import React, { useState, useRef, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { mockConversations, mockMessages } from '@/lib/mockData';
import { ArrowLeft, Phone, Video, Info, Image as ImageIcon, Smile, Mic, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function Chat() {
  const [match, params] = useRoute('/messages/:id');
  const { currentUser } = useAuth();
  const [inputText, setInputText] = useState('');
  
  const conversationId = params?.id || '';
  const conversation = mockConversations.find(c => c.id === conversationId);
  const messages = mockMessages[conversationId] || [];
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!conversation) return <div className="p-8 text-center">Chat not found</div>;

  const otherParticipant = conversation.participants.find(p => p.id !== 'demo-user') || conversation.participants[0];
  const title = conversation.type === 'group' ? conversation.name : otherParticipant.displayName;
  const avatar = conversation.type === 'group' 
    ? `https://api.dicebear.com/9.x/initials/svg?seed=${title}` 
    : otherParticipant.avatarUrl;

  return (
    <div className="h-[100dvh] flex flex-col bg-background/50 md:h-screen relative">
      {/* Header */}
      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/messages" className="md:hidden p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <img src={avatar} alt={title} className="w-10 h-10 rounded-full bg-muted object-cover" />
          <div>
            <h2 className="font-semibold text-sm leading-tight">{title}</h2>
            <p className="text-xs text-muted-foreground">
              {conversation.type === 'group' ? `${conversation.participants.length} members` : 'Online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button className="p-2 rounded-full hover:bg-muted hover:text-foreground transition-colors hidden sm:block">
            <Phone size={20} />
          </button>
          <button className="p-2 rounded-full hover:bg-muted hover:text-foreground transition-colors hidden sm:block">
            <Video size={20} />
          </button>
          <button className="p-2 rounded-full hover:bg-muted hover:text-foreground transition-colors">
            <Info size={20} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        <div className="text-center py-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-3 py-1 rounded-full">
            Today
          </span>
        </div>

        {messages.map((msg, i) => {
          const isMe = msg.senderId === currentUser?.id;
          const showAvatar = !isMe && (i === 0 || messages[i-1].senderId !== msg.senderId);
          const sender = conversation.participants.find(p => p.id === msg.senderId);

          return (
            <div key={msg.id} className={cn("flex gap-3 max-w-[85%]", isMe ? "ml-auto flex-row-reverse" : "")}>
              {!isMe && (
                <div className="w-8 shrink-0">
                  {showAvatar && (
                    <img src={sender?.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full" />
                  )}
                </div>
              )}
              
              <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                {!isMe && showAvatar && conversation.type === 'group' && (
                  <span className="text-xs text-muted-foreground mb-1 ml-1">{sender?.displayName}</span>
                )}
                
                <div className={cn(
                  "px-4 py-2.5 rounded-2xl relative group",
                  isMe 
                    ? "gradient-bg text-white rounded-tr-sm" 
                    : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                )}>
                  <p className="text-[15px] leading-relaxed">{msg.content}</p>
                  
                  {/* Read receipts */}
                  {isMe && i === messages.length - 1 && msg.readBy.length > 0 && (
                    <div className="absolute -bottom-5 right-0 flex -space-x-1">
                      {msg.readBy.filter(id => id !== currentUser?.id).map(readerId => {
                        const reader = conversation.participants.find(p => p.id === readerId);
                        return <img key={readerId} src={reader?.avatarUrl} className="w-4 h-4 rounded-full border border-background" />
                      })}
                    </div>
                  )}
                  
                  {/* Reactions */}
                  {Object.keys(msg.reactions).length > 0 && (
                    <div className={cn(
                      "absolute -bottom-3 flex gap-1",
                      isMe ? "right-2" : "left-2"
                    )}>
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        <div key={emoji} className="bg-background border border-border rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center gap-1">
                          {emoji} <span className="text-[10px] text-muted-foreground">{users.length}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {format(msg.createdAt, 'h:mm a')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-4 bg-background/80 backdrop-blur-xl border-t border-border mt-auto shrink-0 pb-safe">
        <div className="flex items-end gap-2 bg-card border border-border rounded-3xl p-2 pr-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all">
          <button className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-full shrink-0">
            <ImageIcon size={22} strokeWidth={2} />
          </button>
          
          <textarea 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message..." 
            className="flex-1 max-h-32 bg-transparent border-none outline-none resize-none py-2 px-2 text-[15px] text-foreground"
            rows={1}
          />
          
          {inputText.trim() ? (
            <button className="p-2 mb-0.5 rounded-full gradient-bg text-white shadow-md shadow-primary/20 shrink-0 hover:scale-105 active:scale-95 transition-all">
              <Send size={18} className="ml-0.5" />
            </button>
          ) : (
            <>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full shrink-0">
                <Smile size={22} strokeWidth={2} />
              </button>
              <button className="p-2 mb-0.5 rounded-full bg-muted text-foreground shrink-0 hover:bg-secondary/10 hover:text-secondary transition-colors">
                <Mic size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
