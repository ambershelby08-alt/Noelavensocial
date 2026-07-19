import React, { useState } from 'react';
import { Search, Edit, MoreVertical } from 'lucide-react';
import { mockConversations } from '@/lib/mockData';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

export default function Messages() {
  const [search, setSearch] = useState('');

  return (
    <div className="pb-24 pt-4 md:pt-8 min-h-screen px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Messages</h1>
        <button className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
          <Edit size={18} />
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input 
          type="text" 
          placeholder="Search messages..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm"
        />
      </div>

      <div className="space-y-1">
        {mockConversations.map((conv) => {
          const otherParticipant = conv.participants.find(p => p.id !== 'demo-user') || conv.participants[0];
          const name = conv.type === 'group' ? conv.name : otherParticipant.displayName;
          const avatar = conv.type === 'group' 
            ? `https://api.dicebear.com/9.x/initials/svg?seed=${name}` 
            : otherParticipant.avatarUrl;

          return (
            <Link key={conv.id} href={`/messages/${conv.id}`}>
              <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-card/60 transition-colors cursor-pointer group">
                <div className="relative">
                  <img src={avatar} alt={name} className="w-14 h-14 rounded-full object-cover bg-muted" />
                  {conv.type === 'group' && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-background rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-primary" />
                    </div>
                  )}
                  {conv.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white">
                      {conv.unreadCount}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-semibold text-[15px] truncate ${conv.unreadCount > 0 ? 'text-foreground' : 'text-foreground/90'}`}>
                      {name}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatDistanceToNow(conv.lastMessageAt, { addSuffix: false }).replace('about ', '')}
                    </span>
                  </div>
                  <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {conv.lastMessage}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
