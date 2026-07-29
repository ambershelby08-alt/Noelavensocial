import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { NoelavenLogo } from '@/components/ui/NoelavenLogo';

function Field({ label, icon, error, right, ...props }: {
  label: string; icon: React.ReactNode; error?: string; right?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-semibold ml-1" style={{ color: '#BDBDBD' }}>{label}</label>
      <div className="flex items-center border rounded-2xl px-4 py-3.5 gap-3 transition-all"
        style={{ background: '#111', borderColor: error ? '#ef4444' : '#2a2a2a' }}>
        <span style={{ color: '#BDBDBD' }} className="flex-shrink-0">{icon}</span>
        <input className="flex-1 bg-transparent text-[15px] text-white placeholder:text-[#555] outline-none" {...props} />
        {right}
      </div>
      {error && <p className="text-[12px] font-medium ml-1" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  );
}

export default function Signup() {
  const { signUp, isLoading } = useAuth();
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed]           = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())             e.name     = 'Full name is required';
    if (!email.trim())            e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password)                e.password = 'Password is required';
    else if (password.length < 6) e.password = 'At least 6 characters';
    if (password !== confirm)     e.confirm  = 'Passwords do not match';
    if (!agreed)                  e.terms    = 'You must agree to the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      await signUp(email, password, name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      if (msg.toLowerCase().includes('email')) {
        setErrors(prev => ({ ...prev, email: msg }));
      } else if (msg.toLowerCase().includes('password')) {
        setErrors(prev => ({ ...prev, password: msg }));
      } else {
        setErrors(prev => ({ ...prev, form: msg }));
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col" style={{ background: '#000' }}>
      <div className="absolute top-[-10%] right-[-15%] w-[60%] h-[60%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.07) 0%, rgba(124,58,237,0.05) 50%, transparent 70%)' }} />
      <div className="absolute bottom-[-15%] left-[-15%] w-[60%] h-[60%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-12 pb-8 max-w-sm mx-auto w-full">
        <Link href="/login" className="flex items-center gap-2 mb-8 w-fit" style={{ color: '#BDBDBD' }}>
          <ArrowLeft size={18} />
          <span className="text-[14px] font-semibold">Back</span>
        </Link>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8">
          <NoelavenLogo variant="mark" size="lg" className="mb-3" />
          <h1 className="text-[26px] font-black text-white tracking-tight">Join Noelaven</h1>
          <p className="text-[13px] font-semibold tracking-widest uppercase mt-1"
            style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em' }}>
            Be real. Be seen. Belong.
          </p>
        </motion.div>

        <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} onSubmit={handleSubmit} className="space-y-4">
          {errors.form && (
            <div className="px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-[13px] font-medium text-center" style={{ color: '#ef4444' }}>{errors.form}</p>
            </div>
          )}

          <Field label="Full Name" icon={<User size={17} />} type="text" placeholder="Your name"
            value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
            error={errors.name} autoComplete="name" />

          <Field label="Email" icon={<Mail size={17} />} type="email" placeholder="hello@noelaven.com"
            value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
            error={errors.email} autoComplete="email" />

          <Field label="Password" icon={<Lock size={17} />} type={showPw ? 'text' : 'password'}
            placeholder="At least 6 characters" value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
            error={errors.password} autoComplete="new-password"
            right={
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ color: '#BDBDBD' }}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            } />

          <Field label="Confirm Password" icon={<Lock size={17} />} type={showConfirm ? 'text' : 'password'}
            placeholder="Re-enter password" value={confirm}
            onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: '' })); }}
            error={errors.confirm} autoComplete="new-password"
            right={
              <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ color: '#BDBDBD' }}>
                {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            } />

          {/* Terms */}
          <div className="flex items-start gap-3 pt-1">
            <button type="button" onClick={() => setAgreed(v => !v)}
              className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
              style={{ background: agreed ? 'linear-gradient(135deg,#EC4899,#7C3AED)' : '#111', border: `2px solid ${agreed ? '#7C3AED' : '#333'}` }}>
              {agreed && <span className="text-black text-[11px] font-black">✓</span>}
            </button>
            <p className="text-[12.5px] leading-relaxed" style={{ color: '#BDBDBD' }}>
              I agree to Noelaven's{' '}
              <Link href="/privacy" className="font-semibold gradient-text">Privacy Policy</Link>
              {' '}and{' '}
              <a href="#" className="font-semibold gradient-text">Terms of Service</a>
            </p>
          </div>
          {errors.terms && <p className="text-[12px] font-medium" style={{ color: '#ef4444' }}>{errors.terms}</p>}

          <motion.button type="submit" disabled={isLoading || submitting} whileTap={{ scale: 0.98 }}
            className="w-full font-bold py-4 rounded-2xl text-[15px] transition-all disabled:opacity-70 flex items-center justify-center mt-2 text-white"
            style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 4px 24px rgba(124,58,237,0.45)' }}>
            {(isLoading || submitting)
              ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              : 'Create Account'}
          </motion.button>
        </motion.form>

        <p className="text-center text-[14px] mt-6" style={{ color: '#BDBDBD' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-bold gradient-text">Sign in →</Link>
        </p>
      </div>
    </div>
  );
}
