import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, CheckCircle, XCircle, Lock, Share2, Database, Trash2 } from 'lucide-react';

interface Row {
  label: string;
  collected: boolean;
  purpose: string;
  shared: string;
  retention: string;
}

const DATA_ROWS: Row[] = [
  {
    label: 'Name & display name',
    collected: true,
    purpose: 'Show your identity to other users',
    shared: 'Visible to followers / public depending on account privacy setting',
    retention: 'Until account deleted',
  },
  {
    label: 'Email address',
    collected: true,
    purpose: 'Account authentication and password recovery',
    shared: 'Not shared with other users; stored in Firebase Authentication',
    retention: 'Until account deleted',
  },
  {
    label: '@handle (username)',
    collected: true,
    purpose: 'Unique identifier for mentions and profile URL',
    shared: 'Publicly visible',
    retention: 'Until account deleted',
  },
  {
    label: 'Profile photo & bio',
    collected: true,
    purpose: 'Display on your profile and in feeds',
    shared: 'Visible to followers / public; photo hosted on Cloudinary',
    retention: 'Until you remove it or delete your account',
  },
  {
    label: 'Posts, comments & reactions',
    collected: true,
    purpose: 'Core social content — shown in feeds and on profiles',
    shared: 'Visible according to your audience setting (public, mutuals, or private)',
    retention: 'Until you delete the content or your account',
  },
  {
    label: 'Direct messages',
    collected: true,
    purpose: 'Private 1-to-1 conversations between users',
    shared: 'Visible only to sender and recipient; stored in Firestore',
    retention: 'Until either party deletes the conversation or account',
  },
  {
    label: 'Stories',
    collected: true,
    purpose: 'Ephemeral content visible for 24 hours',
    shared: 'Visible to followers or public per your story audience setting',
    retention: '24 hours after posting, then auto-deleted',
  },
  {
    label: 'Voice messages',
    collected: true,
    purpose: 'Audio messages sent in conversations',
    shared: 'Visible only to conversation participants; audio hosted on Cloudinary',
    retention: 'Until deleted by sender or account deleted',
  },
  {
    label: 'Photos & videos you upload',
    collected: true,
    purpose: 'Media attached to posts, messages, or stories',
    shared: 'Hosted on Cloudinary; shared according to content visibility settings',
    retention: 'Until you remove the content or delete your account',
  },
  {
    label: 'Push notification token',
    collected: true,
    purpose: 'Deliver push alerts to your device',
    shared: 'Sent to Firebase Cloud Messaging (FCM) to route notifications',
    retention: 'Until you revoke notification permission or delete your account',
  },
  {
    label: 'Follower / following relationships',
    collected: true,
    purpose: 'Build your social graph and personalise your feed',
    shared: 'Follower counts are public; follower lists visible to account owner',
    retention: 'Until you unfollow / remove follower or delete your account',
  },
  {
    label: 'Online presence (last active)',
    collected: true,
    purpose: 'Show an "online" indicator to your followers',
    shared: 'Visible to followers only',
    retention: 'Refreshed each session; not permanently stored',
  },
  {
    label: 'Call metadata (who called whom, duration)',
    collected: true,
    purpose: 'Generate call history records in your conversation',
    shared: 'Visible only to call participants',
    retention: 'Until the conversation is deleted',
  },
  {
    label: 'Precise location',
    collected: false,
    purpose: '—',
    shared: '—',
    retention: '—',
  },
  {
    label: 'Contacts list',
    collected: false,
    purpose: '—',
    shared: '—',
    retention: '—',
  },
  {
    label: 'Payment information',
    collected: false,
    purpose: '—',
    shared: '—',
    retention: '—',
  },
  {
    label: 'Call audio / video recording',
    collected: false,
    purpose: 'Calls use end-to-end encrypted WebRTC; content is never stored',
    shared: '—',
    retention: '—',
  },
];

const THIRD_PARTIES = [
  {
    name: 'Google Firebase',
    role: 'Authentication, Firestore database, Cloud Messaging (FCM)',
    link: 'https://firebase.google.com/support/privacy',
  },
  {
    name: 'Cloudinary',
    role: 'Image, video, and audio file storage and delivery',
    link: 'https://cloudinary.com/privacy',
  },
  {
    name: 'Metered.ca (TURN)',
    role: 'Relay servers for WebRTC calls when direct peer connection fails',
    link: 'https://www.metered.ca/privacy',
  },
];

export default function DataSafety() {
  const collected = DATA_ROWS.filter(r => r.collected);
  const notCollected = DATA_ROWS.filter(r => !r.collected);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-sm border-b border-[#1a1a1a] px-4 pt-safe pt-4 pb-3 flex items-center gap-3">
        <Link href="/settings">
          <button className="w-8 h-8 rounded-full bg-[#111] border border-[#1a1a1a] flex items-center justify-center shadow-sm">
            <ArrowLeft size={17} className="text-[#BDBDBD]" />
          </button>
        </Link>
        <h1 className="text-[18px] font-black text-white">Data Safety</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-10 text-[15px] text-[#BDBDBD] leading-relaxed pb-20">

        {/* Intro */}
        <div>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-4">Last updated: July 2026</p>
          <p>
            This page explains exactly what data Noelaven collects, why, who it's shared with, and
            how long it's kept. It is designed to help you complete or verify the Google Play
            Store's Data Safety declaration.
          </p>
        </div>

        {/* Security callout */}
        <div className="rounded-2xl px-5 py-4 flex gap-4"
          style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
          <Lock size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-bold text-[14px] mb-1">Data in transit is encrypted</p>
            <p className="text-[13px] text-[rgba(255,255,255,0.55)]">
              All communication between the app and our servers uses HTTPS / TLS 1.2+. Voice and
              video calls use end-to-end encrypted WebRTC (DTLS-SRTP). We do not record or store
              call audio or video.
            </p>
          </div>
        </div>

        {/* Data collected */}
        <section>
          <h2 className="text-[17px] font-bold text-white mb-1 flex items-center gap-2">
            <Database size={17} className="text-[#EC4899]" />
            Data we collect
          </h2>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-5">
            {collected.length} data types collected — tap a row for details.
          </p>
          <div className="space-y-3">
            {collected.map(row => (
              <details key={row.label}
                className="rounded-xl overflow-hidden group"
                style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer list-none select-none">
                  <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                  <span className="text-[14px] font-semibold text-white flex-1">{row.label}</span>
                  <svg className="w-4 h-4 text-[#555] transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </summary>
                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-[#1a1a1a]">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.3)]">Purpose</span>
                    <p className="text-[13px] text-[#BDBDBD] mt-0.5">{row.purpose}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.3)]">Shared with</span>
                    <p className="text-[13px] text-[#BDBDBD] mt-0.5">{row.shared}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.3)]">Retention</span>
                    <p className="text-[13px] text-[#BDBDBD] mt-0.5">{row.retention}</p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Data NOT collected */}
        <section>
          <h2 className="text-[17px] font-bold text-white mb-1 flex items-center gap-2">
            <XCircle size={17} className="text-[#555]" />
            Data we do <em>not</em> collect
          </h2>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-4">
            These data types are never collected or stored by Noelaven.
          </p>
          <div className="space-y-2">
            {notCollected.map(row => (
              <div key={row.label}
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                <XCircle size={16} className="text-[#444] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-semibold text-[#666]">{row.label}</p>
                  {row.purpose !== '—' && (
                    <p className="text-[12px] text-[#444] mt-0.5">{row.purpose}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Third parties */}
        <section>
          <h2 className="text-[17px] font-bold text-white mb-1 flex items-center gap-2">
            <Share2 size={17} className="text-[#EC4899]" />
            Third-party services
          </h2>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-4">
            We do not sell your data. The services below process data on our behalf.
          </p>
          <div className="space-y-3">
            {THIRD_PARTIES.map(tp => (
              <div key={tp.name}
                className="px-4 py-3.5 rounded-xl"
                style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                <p className="text-[14px] font-bold text-white mb-0.5">{tp.name}</p>
                <p className="text-[13px] text-[#BDBDBD] mb-2">{tp.role}</p>
                <a href={tp.link} target="_blank" rel="noopener noreferrer"
                  className="text-[12px] font-semibold" style={{ color: '#F5C542' }}>
                  Privacy policy ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* User rights */}
        <section>
          <h2 className="text-[17px] font-bold text-white mb-3 flex items-center gap-2">
            <Trash2 size={17} className="text-[#EC4899]" />
            Your data rights
          </h2>
          <div className="space-y-3">
            {[
              { title: 'Delete your account', desc: 'Go to Settings → Account → Delete Account. Your profile, posts, messages, and stories are permanently removed within 30 days.' },
              { title: 'Export your data', desc: 'Go to Settings → Account → Download My Data to export your profile and posts as JSON.' },
              { title: 'Correct your information', desc: 'Edit your name, handle, bio, and profile photo at any time from your profile page.' },
              { title: 'Revoke notification access', desc: 'Disable notification permission in your device Settings, or toggle individual alert types in Noelaven Settings → Notifications.' },
              { title: 'Contact us', desc: 'Email privacy@noelaven.com with questions about your data or to request manual deletion assistance.' },
            ].map(item => (
              <div key={item.title}
                className="px-4 py-3.5 rounded-xl"
                style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                <p className="text-[14px] font-bold text-white mb-0.5">{item.title}</p>
                <p className="text-[13px] text-[#BDBDBD]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Play Store note */}
        <div className="rounded-2xl px-5 py-4"
          style={{ background: 'rgba(245,197,66,0.06)', border: '1px solid rgba(245,197,66,0.2)' }}>
          <p className="text-[13px] font-bold text-[#F5C542] mb-1">Google Play Data Safety</p>
          <p className="text-[13px] text-[rgba(255,255,255,0.55)]">
            This page reflects the declarations made in Noelaven's Google Play Store Data Safety
            section. If you believe there is a discrepancy, please contact us at{' '}
            <a href="mailto:privacy@noelaven.com" className="text-[#F5C542] font-medium underline">
              privacy@noelaven.com
            </a>.
          </p>
        </div>

        <div className="pt-4 border-t border-[#1a1a1a]">
          <p className="text-[13px] text-[rgba(255,255,255,0.45)]">
            © {new Date().getFullYear()} Noelaven. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
