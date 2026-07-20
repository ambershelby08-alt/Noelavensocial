import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();

  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address'); return; }
    setLoading(true);
    await resetPassword(email);
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-[#FDF9F6] relative overflow-hidden flex flex-col">
      {/* Background blobs */}
      <div className="absolute top-[-15%] left-[-20%] w-[70%] h-[70%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(107,115,255,0.18) 0%, rgba(60,194,168,0.10) 40%, transparent 70%)' }} />
      <div className="absolute bottom-[-20%] right-[-15%] w-[65%] h-[65%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,107,157,0.18) 0%, rgba(196,79,219,0.10) 40%, transparent 70%)' }} />

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-14 pb-8 max-w-sm mx-auto w-full">
        {/* Back */}
        <Link href="/login">
          <button className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-500 hover:text-gray-800 transition-colors mb-10 self-start">
            <ArrowLeft size={16} />
            Back to Sign In
          </button>
        </Link>

        <AnimatePresence mode="wait">
          {!sent ? (
            /* ── Request form ── */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="flex-1 flex flex-col"
            >
              {/* Icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)', boxShadow: '0 8px 24px rgba(107,115,255,0.38)' }}
              >
                <Mail size={28} className="text-white" />
              </div>

              <h1 className="text-[28px] font-black text-gray-900 tracking-tight leading-tight mb-2">
                Forgot your<br />password?
              </h1>
              <p className="text-[14px] text-gray-400 font-medium mb-8 leading-relaxed">
                No worries — we'll send a reset link to your email. Check your inbox in a moment.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-600 ml-1">Email address</label>
                  <div className={`flex items-center bg-white/80 backdrop-blur-sm border rounded-2xl px-4 py-3.5 gap-3 transition-all
                    ${error ? 'border-red-300 ring-2 ring-red-100' : 'border-black/[0.08] focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100'}`}
                  >
                    <Mail size={17} className="text-gray-400 flex-shrink-0" />
                    <input
                      type="email"
                      placeholder="hello@noelaven.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      className="flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 outline-none"
                      autoComplete="email"
                    />
                  </div>
                  {error && <p className="text-[12px] text-red-500 font-medium ml-1">{error}</p>}
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.98 }}
                  className="w-full text-white font-bold py-4 rounded-2xl text-[15px] transition-all disabled:opacity-70 flex items-center justify-center mt-2"
                  style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)', boxShadow: '0 4px 18px rgba(107,115,255,0.35)' }}
                >
                  {loading
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Send Reset Link'}
                </motion.button>
              </form>
            </motion.div>
          ) : (
            /* ── Success state ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20, delay: 0.1 }}
                className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-xl"
                style={{ background: 'linear-gradient(135deg, #3CC2A8, #4F75FF)', boxShadow: '0 8px 28px rgba(60,194,168,0.35)' }}
              >
                <CheckCircle2 size={44} className="text-white" />
              </motion.div>

              <h2 className="text-[26px] font-black text-gray-900 tracking-tight mb-3">
                Check your inbox
              </h2>
              <p className="text-[14px] text-gray-400 font-medium leading-relaxed mb-2">
                We've sent a reset link to
              </p>
              <p className="text-[15px] font-bold text-purple-600 mb-8">
                {email}
              </p>
              <p className="text-[12.5px] text-gray-400 mb-8 leading-relaxed max-w-[240px]">
                Didn't receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-purple-500 font-semibold underline underline-offset-2"
                >
                  try again
                </button>
                .
              </p>

              <Link href="/login">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-3.5 rounded-2xl font-bold text-[15px] text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 4px 16px rgba(107,115,255,0.30)' }}
                >
                  Back to Sign In
                </motion.button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
