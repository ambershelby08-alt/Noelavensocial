import React, { useState } from 'react';
import { Search, TrendingUp, Users, Zap, Plus } from 'lucide-react';
import { mockUsers, mockCommunities } from '@/lib/mockData';
import { Link } from 'wouter';

export default function Discover() {
  const [search, setSearch] = useState('');

  const trendingTags = ['#Design2025', '#TechNews', '#Photography', '#WorkoutRoutine', '#MusicProduction'];

  return (
    <div className="pb-24 pt-4 md:pt-8 min-h-screen px-4 md:px-6">
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input 
          type="text" 
          placeholder="Search people, communities, posts..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-2xl pl-11 pr-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm"
        />
      </div>

      {!search && (
        <>
          <section className="mb-10">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <TrendingUp size={20} className="text-primary" />
              Trending Topics
            </h2>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map(tag => (
                <button key={tag} className="px-4 py-2 rounded-xl bg-card border border-border text-sm font-semibold hover:border-primary hover:text-primary transition-colors shadow-sm">
                  {tag}
                </button>
              ))}
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Users size={20} className="text-secondary" />
              Suggested Friends
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              {mockUsers.filter(u => u.id !== 'demo-user').map(user => (
                <div key={user.id} className="min-w-[160px] p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col items-center text-center shrink-0">
                  <Link href={`/profile/${user.id}`}>
                    <img src={user.avatarUrl} alt={user.displayName} className="w-16 h-16 rounded-full mb-3 object-cover hover:ring-2 ring-primary ring-offset-2 ring-offset-card transition-all cursor-pointer" />
                  </Link>
                  <Link href={`/profile/${user.id}`} className="font-semibold text-[15px] truncate w-full hover:text-primary transition-colors cursor-pointer">
                    {user.displayName}
                  </Link>
                  <span className="text-xs text-muted-foreground mb-4">12 mutuals</span>
                  <button className="w-full py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-colors">
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Zap size={20} className="text-accent" />
              Growing Communities
            </h2>
            <div className="space-y-3">
              {mockCommunities.slice(0, 3).map(community => (
                <Link key={community.id} href={`/communities/${community.id}`}>
                  <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-card/60 transition-colors cursor-pointer border border-transparent hover:border-border">
                    <img src={community.bannerUrl} alt={community.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[15px] truncate">{community.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{community.category} • {(community.memberCount / 1000).toFixed(1)}k members</p>
                    </div>
                    <button className="p-2 bg-muted rounded-full text-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                      <Plus size={16} />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {search && (
        <div className="text-center py-20 text-muted-foreground">
          <Search size={32} className="mx-auto mb-4 opacity-50" />
          <p>Searching across Noelaven...</p>
        </div>
      )}
    </div>
  );
}
