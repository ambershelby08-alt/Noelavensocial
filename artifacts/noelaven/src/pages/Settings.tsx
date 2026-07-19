import React from 'react';
import { User, Bell, Lock, Shield, Moon, Monitor, AlertTriangle, LogOut, ChevronRight, Paintbrush } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

export default function Settings() {
  const { signOut, currentUser } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignOut = () => {
    signOut();
    setLocation('/login');
  };

  const sections = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Personal Information", desc: "Email, phone number, and demographics" },
        { icon: Shield, label: "Security", desc: "Password, 2FA, and connected apps" }
      ]
    },
    {
      title: "Preferences",
      items: [
        { icon: Paintbrush, label: "Appearance", desc: "Theme, colors, and layout" },
        { icon: Bell, label: "Notifications", desc: "Push, email, and in-app alerts" },
        { icon: Lock, label: "Privacy", desc: "Who can see your posts and message you" }
      ]
    },
    {
      title: "Support",
      items: [
        { icon: AlertTriangle, label: "Report a Problem", desc: "Help us fix issues" },
        { icon: Shield, label: "Community Guidelines", desc: "Rules and policies" }
      ]
    }
  ];

  return (
    <div className="pb-24 pt-4 md:pt-8 min-h-screen px-4 md:px-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">Settings</h1>

      {currentUser && (
        <div className="bg-card border border-border rounded-3xl p-5 mb-8 flex items-center gap-4 shadow-sm">
          <img src={currentUser.avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full bg-muted" />
          <div className="flex-1">
            <h2 className="font-bold text-lg">{currentUser.displayName}</h2>
            <p className="text-sm text-muted-foreground">@{currentUser.handle}</p>
          </div>
          <button className="px-4 py-2 bg-muted hover:bg-primary/10 hover:text-primary text-foreground rounded-full text-sm font-semibold transition-colors">
            Edit
          </button>
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx}>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              {section.title}
            </h3>
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
              {section.items.map((item, itemIdx) => (
                <button 
                  key={itemIdx}
                  className="w-full flex items-center p-4 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0 group"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                    <item.icon size={20} />
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className="font-semibold text-[15px]">{item.label}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-4">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 p-4 text-destructive font-bold bg-destructive/10 hover:bg-destructive/20 rounded-2xl transition-colors"
          >
            <LogOut size={20} />
            Log Out
          </button>
          
          <div className="text-center mt-6">
            <span className="text-xs text-muted-foreground">Noelaven v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
