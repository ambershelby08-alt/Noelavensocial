import React, { useState } from 'react';
import { Search, Plus, Users, Hash, Shield } from 'lucide-react';
import { mockCommunities } from '@/lib/mockData';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

export default function Communities() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const categories = ['All', 'Design', 'Technology', 'Photography', 'Music', 'Travel', 'Fitness'];

  const filtered = mockCommunities.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'All' || c.category === category;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="pb-24 pt-4 md:pt-8 min-h-screen px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Communities</h1>
        <button className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold text-sm hover:bg-primary/20 transition-colors">
          <Plus size={16} />
          <span className="hidden sm:inline">Create</span>
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input 
          type="text" 
          placeholder="Search for communities..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              category === cat 
                ? 'bg-foreground text-background shadow-md' 
                : 'bg-muted text-muted-foreground hover:bg-card border border-transparent hover:border-border'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((community, i) => (
          <motion.div 
            key={community.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group rounded-3xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all flex flex-col"
          >
            <div className="h-32 bg-muted relative overflow-hidden">
              <img src={community.bannerUrl} alt={community.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-md">
                {community.category}
              </div>
            </div>
            
            <div className="p-5 flex flex-col flex-1">
              <Link href={`/communities/${community.id}`} className="block group-hover:text-primary transition-colors">
                <h3 className="text-lg font-bold mb-1">{community.name}</h3>
              </Link>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
                {community.description}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Users size={14} />
                  <span>{(community.memberCount / 1000).toFixed(1)}k members</span>
                </div>
                
                <button className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  community.isJoined 
                    ? 'bg-muted text-foreground' 
                    : 'gradient-bg text-white shadow-md shadow-primary/20 hover:opacity-90'
                }`}>
                  {community.isJoined ? 'Joined' : 'Join'}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
