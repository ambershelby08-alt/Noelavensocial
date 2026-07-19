import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { signIn, isLoading } = useAuth();
  const [isLogin, setIsLogin] = React.useState(true);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-card/80 backdrop-blur-2xl border border-border/50 rounded-[2rem] p-8 shadow-2xl z-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-6">
            <span className="text-white font-bold text-3xl">N</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to Noelaven</h1>
          <p className="text-muted-foreground text-sm">Where connections feel genuinely human.</p>
        </div>

        <div className="flex bg-muted p-1 rounded-2xl mb-8">
          <button 
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isLogin ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setIsLogin(true)}
          >
            Log In
          </button>
          <button 
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${!isLogin ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); signIn(); }}>
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium ml-1 text-foreground">Name</label>
              <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" placeholder="Jane Doe" />
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium ml-1 text-foreground">Email</label>
            <input type="email" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" placeholder="hello@noelaven.com" />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between ml-1">
              <label className="text-sm font-medium text-foreground">Password</label>
              {isLogin && <a href="#" className="text-xs text-primary font-medium hover:underline">Forgot password?</a>}
            </div>
            <input type="password" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" placeholder="••••••••" />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full gradient-bg text-white font-bold py-3.5 rounded-xl mt-6 shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all flex justify-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              isLogin ? 'Log In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>This is a demo environment. Any login works.</p>
        </div>
      </motion.div>
    </div>
  );
}
