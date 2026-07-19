import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { mockUsers, mockPosts } from '@/lib/mockData';
import { PostCard } from '@/pages/Home';
import { Settings, MapPin, Link as LinkIcon, Calendar, Grid, Heart, Bookmark, Edit3, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export default function Profile() {
  const [match, params] = useRoute('/profile/:userId');
  const userId = params?.userId;
  const { currentUser } = useAuth();
  
  const user = mockUsers.find(u => u.id === userId) || mockUsers[0];
  const isOwnProfile = currentUser?.id === user.id;
  
  const [activeTab, setActiveTab] = useState<'posts'|'liked'|'saved'>('posts');
  
  const userPosts = mockPosts.filter(p => p.authorId === user.id);
  const likedPosts = mockPosts.filter(p => p.liked); // mock data

  if (!user) return <div className="p-8 text-center">User not found</div>;

  return (
    <div className="pb-24 md:pb-8 min-h-screen bg-background">
      {/* Cover Photo */}
      <div className="relative h-48 md:h-64 w-full bg-muted">
        {user.coverUrl ? (
          <img src={user.coverUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full gradient-bg opacity-50" />
        )}
        
        {isOwnProfile && (
          <button className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
            <ImageIcon size={18} />
          </button>
        )}
      </div>

      <div className="px-4 md:px-8 relative -mt-16 sm:-mt-20">
        <div className="flex justify-between items-end mb-4">
          <div className="relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background overflow-hidden bg-muted">
              <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover bg-white" />
            </div>
            {isOwnProfile && (
              <button className="absolute bottom-2 right-2 bg-primary text-white p-2 rounded-full border-2 border-background hover:scale-105 transition-transform shadow-md">
                <Edit3 size={16} />
              </button>
            )}
          </div>
          
          <div className="mb-2">
            {isOwnProfile ? (
              <button className="px-5 py-2 rounded-full bg-secondary/10 text-secondary font-semibold text-sm hover:bg-secondary/20 transition-colors">
                Edit Profile
              </button>
            ) : (
              <button className="px-6 py-2 rounded-full gradient-bg text-white font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 transition-all active:scale-95">
                Follow
              </button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            {user.displayName}
            {user.badges.includes("Verified") && (
              <span className="text-primary" title="Verified">✓</span>
            )}
          </h1>
          <p className="text-muted-foreground font-medium">@{user.handle}</p>
        </div>
        
        <p className="text-foreground text-[15px] leading-relaxed mb-4 max-w-xl">
          {user.bio}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-1">
            <Calendar size={16} />
            <span>Joined {format(user.joinedAt, 'MMMM yyyy')}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 mb-8">
          <button className="flex gap-1.5 hover:underline group">
            <strong className="text-foreground">{user.following}</strong> 
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">Following</span>
          </button>
          <button className="flex gap-1.5 hover:underline group">
            <strong className="text-foreground">{user.followers}</strong> 
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">Followers</span>
          </button>
        </div>

        {user.interests && user.interests.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              {user.interests.map(interest => (
                <span key={interest} className="px-3 py-1 rounded-full bg-muted text-xs font-medium text-foreground">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-b border-border flex mb-2 sticky top-0 bg-background/95 backdrop-blur z-10 pt-2">
          <button 
            onClick={() => setActiveTab('posts')}
            className={cn("flex-1 pb-4 text-sm font-semibold relative transition-colors flex items-center justify-center gap-2", activeTab === 'posts' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Grid size={16} />
            <span className="hidden sm:inline">Posts</span>
            {activeTab === 'posts' && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab('liked')}
            className={cn("flex-1 pb-4 text-sm font-semibold relative transition-colors flex items-center justify-center gap-2", activeTab === 'liked' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Heart size={16} />
            <span className="hidden sm:inline">Likes</span>
            {activeTab === 'liked' && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab('saved')}
            className={cn("flex-1 pb-4 text-sm font-semibold relative transition-colors flex items-center justify-center gap-2", activeTab === 'saved' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Bookmark size={16} />
            <span className="hidden sm:inline">Saved</span>
            {activeTab === 'saved' && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-primary" />}
          </button>
        </div>

        <div className="space-y-2 mt-4 -mx-4 md:mx-0">
          {activeTab === 'posts' && userPosts.length > 0 ? (
            userPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
          ) : activeTab === 'liked' && likedPosts.length > 0 ? (
            likedPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
          ) : (
            <div className="py-20 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                {activeTab === 'posts' ? <Grid size={24} /> : activeTab === 'liked' ? <Heart size={24} /> : <Bookmark size={24} />}
              </div>
              <h3 className="font-bold text-lg mb-1">Nothing to see here yet</h3>
              <p className="text-muted-foreground text-sm">When they post, it will show up here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
