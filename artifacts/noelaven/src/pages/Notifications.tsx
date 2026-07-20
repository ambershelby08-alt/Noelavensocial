import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Heart, MessageCircle, UserPlus, Users, Sparkles, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { GradientAvatar } from '@/components/ui/GradientAvatar';

export default function Notifications() {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Likes', 'Comments', 'Mentions'];

  const getIcon = (type: string) => {
    switch(type) {
      case 'like': return <Heart size={16} className="fill-destructive text-destructive" />;
      case 'comment': return <MessageCircle size={16} className="fill-primary text-primary" />;
      case 'follow': return <UserPlus size={16} className="text-secondary" />;
      case 'community_invite': return <Users size={16} className="text-accent" />;
      case 'daily_spark': return <Sparkles size={16} className="text-yellow-500 fill-yellow-500" />;
      default: return <Heart size={16} />;
    }
  };

  const { notifications, markAllRead } = useNotifications();

  return (
    <div className="pb-24 pt-4 md:pt-8 min-h-screen px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
        <button 
          onClick={markAllRead}
          className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors tooltip"
          title="Mark all as read"
        >
          <CheckCheck size={22} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === f 
                ? 'bg-foreground text-background shadow-md' 
                : 'bg-muted text-muted-foreground hover:bg-card border border-transparent hover:border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2 mt-4">
        {notifications.map((notif, i) => (
          <motion.div 
            key={notif.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex gap-4 p-4 rounded-2xl transition-colors relative group",
              !notif.read ? "bg-primary/5 border border-primary/20" : "bg-card border border-border hover:shadow-sm"
            )}
          >
            {!notif.read && (
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
            )}
            
            <div className="relative shrink-0">
              {notif.type === 'daily_spark' ? (
                <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white shadow-md shadow-primary/20">
                  <Sparkles size={24} />
                </div>
              ) : (
                <Link href={`/profile/${notif.actorId}`}>
                  <GradientAvatar name={notif.actor.displayName} size={48} />
                </Link>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-background rounded-full flex items-center justify-center border border-border shadow-sm">
                {getIcon(notif.type)}
              </div>
            </div>
            
            <div className="flex-1 min-w-0 pt-1">
              <p className={cn("text-[15px] pr-4", !notif.read ? "font-medium text-foreground" : "text-foreground/90")}>
                {notif.message}
              </p>
              <span className="text-xs text-muted-foreground mt-1 block">
                {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
              </span>
            </div>
            
            {notif.type === 'daily_spark' && !notif.read && (
              <div className="shrink-0 self-center mr-4">
                <button className="px-4 py-1.5 gradient-bg text-white rounded-full text-xs font-bold shadow-md shadow-primary/20 hover:scale-105 transition-transform">
                  Respond
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
