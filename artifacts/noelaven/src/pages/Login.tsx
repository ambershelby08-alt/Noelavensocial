import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { NoelavenLogo } from '@/components/ui/NoelavenLogo';

function Field({ label, icon, error, right, ...props }: {
  label: string; icon: React.ReactNode; error?: string; right?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-semibold ml-1" style={{ color: '#BDBDBD' }}>{label}</label>
      <div className={`flex items-center backdrop-blur-sm border rounded-2xl px-4 py-3.5 gap-3 transition-all`}
        style={{
          background: '#111',
          borderColor: error ? '#ef4444' : '#2a2a2a',
          boxShadow: error ? '0 0 0 2px rgba(239,68,68,0.15)' : undefined,
        }}
      >
        <span style={{ color: '#BDBDBD' }} className="flex-shrink-0">{icon}</span>
        <input
          className="flex-1 bg-transparent text-[15px] text-white placeholder:text-[#555] outline-none"
          {...props}
        />
        {right}
      </div>
      {error && <p className="text-[12px] font-medium ml-1" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  );
}

export default function Login() {
  const { signIn, isLoading, redirectError, addingAccount } = useAuth();

  const prefillEmail = (() => {
    try {
      const v = localStorage.getItem('nlv_switch_email') ?? '';
      if (v) localStorage.removeItem('nlv_switch_email');
      return v;
    } catch { return ''; }
  })();

  const [email, setEmail]   = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!email.trim())        e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password)            e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await signIn(email, password);
    } catch (err) {
      setErrors(prev => ({ ...prev, form: (err as Error).message }));
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col" style={{ background: '#000' }}>
      {/* Subtle gold glow top-right */}
      <div className="absolute top-[-10%] right-[-15%] w-[60%] h-[60%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,197,66,0.08) 0%, transparent 70%)' }} />
      {/* Subtle rainbow glow bottom-left */}
      <div className="absolute bottom-[-15%] left-[-15%] w-[60%] h-[60%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, rgba(236,72,153,0.04) 40%, transparent 70%)' }} />

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-10"
        >
          <NoelavenLogo variant="mark" size="xl" className="mb-4" />
          <h1 className="text-[28px] font-black text-white tracking-tight">
            {addingAccount ? 'Add account' : 'Welcome back'}
          </h1>
          <p className="text-[13px] font-semibold tracking-widest uppercase mt-1.5"
            style={{ color: '#F5C542', letterSpacing: '0.12em' }}>
            {addingAccount ? 'Sign in to another account' : 'Connect. Create. Belong.'}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="space-y-4 flex-1"
        >
          {(redirectError || errors.form) && (
            <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-[13px] font-medium text-center" style={{ color: '#ef4444' }}>
                {redirectError ?? errors.form}
              </p>
            </div>
          )}
          <Field label="Email" icon={<Mail size={17} />} type="email" placeholder="hello@noelaven.com"
            value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
            error={errors.email} autoComplete="email" />

          <Field label="Password" icon={<Lock size={17} />} type={showPw ? 'text' : 'password'}
            placeholder="••••••••" value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
            error={errors.password} autoComplete="current-password"
            right={
              <button type="button" onClick={() => setShowPw(v => !v)} className="flex-shrink-0"
                style={{ color: '#BDBDBD' }}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            }
          />

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-[13px] font-semibold transition-colors"
              style={{ color: '#F5C542' }}>
              Forgot password?
            </Link>
          </div>

          <motion.button
            type="submit"
            disabled={isLoading}
            whileTap={{ scale: 0.98 }}
            className="w-full font-bold py-4 rounded-2xl text-[15px] transition-all disabled:opacity-70 flex items-center justify-center mt-2 text-black"
            style={{ background: '#F5C542', boxShadow: '0 4px 18px rgba(245,197,66,0.35)' }}
          >
            {isLoading
              ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              : 'Sign In'}
          </motion.button>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center text-[14px] mt-8"
          style={{ color: '#BDBDBD' }}
        >
          New to Noelaven?{' '}
          <Link href="/signup" className="font-bold transition-colors" style={{ color: '#F5C542' }}>
            Create an account →
          </Link>
        </motion.p>
      </div>
    </div>
  );
}
