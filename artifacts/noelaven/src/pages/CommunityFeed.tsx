import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { mockCommunities, mockPosts } from '@/lib/mockData';
import { Users, Info, Shield, PlusCircle, Check } from 'lucide-react';
import { PostCard } from '@/pages/Home';
import { cn } from '@/lib/utils';

export default function CommunityFeed() {
  const [match, params] = useRoute('/communities/:id');
  const community = mockCommunities.find(c => c.id === params?.id) || mockCommunities[0];
  const [activeTab, setActiveTab] = useState<'feed'|'about'|'rules'>('feed');
  const [isJoined, setIsJoined] = useState(community.isJoined);

  const posts = mockPosts.filter(p => p.communityId === community.id || !p.communityId); // Using general posts for demo filling

  return (
    <div className="pb-24 min-h-screen bg-background">
      <div className="h-48 md:h-64 relative">
        <img src={community.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="px-4 md:px-8 relative -mt-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary mb-1 block">
              {community.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              {community.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5">
                <Users size={16} />
                <span>{(community.memberCount / 1000).toFixed(1)}k Members</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield size={16} />
                <span>{community.moderatorIds.length} Mods</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setIsJoined(!isJoined)}
            className={cn(
              "px-8 py-2.5 rounded-full font-bold text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2",
              isJoined 
                ? "bg-muted text-foreground" 
                : "gradient-bg text-white shadow-primary/25"
            )}
          >
            {isJoined ? (
              <>
                <Check size={18} />
                Joined
              </>
            ) : (
              <>
                <PlusCircle size={18} />
                Join Community
              </>
            )}
          </button>
        </div>

        <div className="border-b border-border flex mb-4 sticky top-0 bg-background/95 backdrop-blur z-10 pt-2">
          {['feed', 'about', 'rules'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-6 pb-4 text-sm font-semibold relative transition-colors capitalize", 
                activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-primary" />}
            </button>
          ))}
        </div>

        <div className="py-4">
          {activeTab === 'feed' && (
            <div className="space-y-2 -mx-4 md:mx-0">
              {posts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Info size={20} className="text-primary" />
                About this community
              </h3>
              <p className="text-foreground leading-relaxed">
                {community.description}
              </p>
              
              <div className="mt-8">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Moderators</h4>
                <div className="space-y-4">
                  {community.moderatorIds.map((id, i) => (
                    <div key={id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                          {i+1}
                        </div>
                        <span className="font-medium">User {id}</span>
                      </div>
                      <Shield size={16} className="text-primary" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-2">
                <Shield size={20} className="text-primary" />
                Community Rules
              </h3>
              
              {community.rules.map((rule, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="pt-1">
                    <p className="font-medium text-foreground">{rule}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
