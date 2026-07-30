import React, { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Trash2, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DeleteAccount() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-sm border-b border-[#1a1a1a] px-4 pt-safe pt-4 pb-3 flex items-center gap-3">
        <Link href="/">
          <button className="w-8 h-8 rounded-full bg-[#111] border border-[#1a1a1a] flex items-center justify-center shadow-sm">
            <ArrowLeft size={17} className="text-[#BDBDBD]" />
          </button>
        </Link>
        <h1 className="text-[18px] font-black text-white">Delete Account</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-[15px] text-[#BDBDBD] leading-relaxed pb-20">

        {/* Warning banner */}
        <div className="flex gap-3 bg-red-950/40 border border-red-900/50 rounded-2xl p-4">
          <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300 mb-1">This action is permanent</p>
            <p className="text-[13px] text-red-400/80">
              Deleting your account removes your profile, posts, messages, followers, and all associated data.
              This cannot be undone.
            </p>
          </div>
        </div>

        {/* Option 1 — in-app */}
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-white">Option 1 — Delete from within the app</h2>
          <p>If you have access to your account, you can delete it directly from Settings:</p>
          <ol className="list-decimal list-inside space-y-2 pl-1 text-[14px]">
            <li>Open Noelaven and sign in</li>
            <li>Tap your profile icon → <span className="text-white font-medium">Settings</span></li>
            <li>Scroll down and tap <span className="text-white font-medium">Delete Account</span></li>
            <li>Confirm when prompted — your account will be permanently removed</li>
          </ol>
        </section>

        {/* Divider */}
        <div className="border-t border-[#1a1a1a]" />

        {/* Option 2 — email */}
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-white">Option 2 — Request deletion by email</h2>
          <p>
            If you cannot access your account, email us from your registered address and we will delete your
            account within <span className="text-white font-medium">7 days</span>.
          </p>

          {!submitted ? (
            <a
              href="mailto:support@noelaven.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20Noelaven%20account%20associated%20with%20this%20email%20address."
              onClick={() => setSubmitted(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#7B5CFA] to-[#E040FB] text-white font-semibold text-[15px] shadow-lg hover:opacity-90 transition-opacity"
            >
              <Mail size={17} />
              Email support@noelaven.com
            </a>
          ) : (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 size={18} />
              <span className="text-[14px]">Email app opened — send the message to complete your request.</span>
            </div>
          )}

          <p className="text-[13px] text-[rgba(255,255,255,0.35)]">
            Include your username or the email address linked to the account so we can locate it quickly.
          </p>
        </section>

        {/* Divider */}
        <div className="border-t border-[#1a1a1a]" />

        {/* What gets deleted */}
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-white">What gets deleted</h2>
          <ul className="space-y-2 text-[14px]">
            {[
              'Your profile, username, and bio',
              'All posts, stories, and Sparks you published',
              'Your messages and conversation history',
              'Your followers and following list',
              'Likes, reactions, and comments you left',
              'Saved and liked posts',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <Trash2 size={14} className="text-red-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Footer note */}
        <p className="text-[13px] text-[rgba(255,255,255,0.35)] border-t border-[#1a1a1a] pt-6">
          For privacy-related questions see our{' '}
          <Link href="/privacy">
            <span className="text-[#7B5CFA] hover:underline cursor-pointer">Privacy Policy</span>
          </Link>
          . Noelaven complies with applicable data protection laws including GDPR and CCPA.
        </p>
      </div>
    </div>
  );
}
