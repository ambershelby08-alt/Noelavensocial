import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';

// ─── Google icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Background blobs ─────────────────────────────────────────────────────────

function AuthBackground() {
  return (
    <>
      <div className="absolute top-[-15%] right-[-20%] w-[75%] h-[75%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,107,157,0.20) 0%, rgba(196,79,219,0.12) 40%, transparent 70%)' }} />
      <div className="absolute bottom-[-20%] left-[-20%] w-[75%] h-[75%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(107,115,255,0.18) 0%, rgba(60,194,168,0.10) 40%, transparent 70%)' }} />
      <div className="absolute top-[35%] left-[-5%] w-[40%] h-[40%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,217,61,0.13) 0%, transparent 70%)' }} />
    </>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ReactNode;
  error?: string;
  right?: React.ReactNode;
}

function Field({ label, icon, error, right, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-semibold text-gray-600 ml-1">{label}</label>
      <div className={`flex items-center bg-white/80 backdrop-blur-sm border rounded-2xl px-4 py-3.5 gap-3 transition-all
        ${error ? 'border-red-300 ring-2 ring-red-100' : 'border-black/[0.08] focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100'}`}>
        <span className="text-gray-400 flex-shrink-0">{icon}</span>
        <input
          className="flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 outline-none"
          {...props}
        />
        {right}
      </div>
      {error && <p className="text-[12px] text-red-500 font-medium ml-1">{error}</p>}
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Login() {
  const { signIn, signInWithGoogle, isLoading } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!email.trim())          e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password)              e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await signIn(email, password);
  }

  return (
    <div className="min-h-screen bg-[#FDF9F6] relative overflow-hidden flex flex-col">
      <AuthBackground />

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-10"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)', boxShadow: '0 8px 24px rgba(107,115,255,0.40)' }}
          >
            <span className="text-white font-black text-2xl">N</span>
          </div>
          <h1 className="text-[28px] font-black text-gray-900 tracking-tight">Welcome back</h1>
          <p className="text-[14px] text-gray-400 font-medium mt-1">Sign in to your Noelaven account</p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="space-y-4 flex-1"
        >
          <Field
            label="Email"
            icon={<Mail size={17} />}
            type="email"
            placeholder="hello@noelaven.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
            error={errors.email}
            autoComplete="email"
          />

          <Field
            label="Password"
            icon={<Lock size={17} />}
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
            error={errors.password}
            autoComplete="current-password"
            right={
              <button type="button" onClick={() => setShowPw(v => !v)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            }
          />

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-[13px] font-semibold text-purple-500 hover:text-purple-700 transition-colors">
              Forgot password?
            </Link>
          </div>

          {/* Sign In button */}
          <motion.button
            type="submit"
            disabled={isLoading}
            whileTap={{ scale: 0.98 }}
            className="w-full text-white font-bold py-4 rounded-2xl text-[15px] transition-all disabled:opacity-70 flex items-center justify-center mt-2"
            style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)', boxShadow: '0 4px 18px rgba(107,115,255,0.35)' }}
          >
            {isLoading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Sign In'}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[12px] text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={signInWithGoogle}
            disabled={isLoading}
            className="w-full bg-white border border-black/[0.08] rounded-2xl py-4 flex items-center justify-center gap-3 font-semibold text-[15px] text-gray-700 shadow-sm hover:shadow-md transition-all disabled:opacity-70"
          >
            <GoogleIcon />
            Continue with Google
          </motion.button>
        </motion.form>

        {/* Footer link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center text-[14px] text-gray-500 mt-8"
        >
          New to Noelaven?{' '}
          <Link href="/signup" className="font-bold text-purple-500 hover:text-purple-700 transition-colors">
            Create an account →
          </Link>
        </motion.p>
      </div>
    </div>
  );
}
