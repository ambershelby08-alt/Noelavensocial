import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ShieldCheck, AlertTriangle, Ban, Eye, Trash2, Gavel, Phone } from 'lucide-react';

export default function ChildSafety() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-sm border-b border-[#1a1a1a] px-4 pt-safe pt-4 pb-3 flex items-center gap-3">
        <Link href="/">
          <button className="w-8 h-8 rounded-full bg-[#111] border border-[#1a1a1a] flex items-center justify-center shadow-sm">
            <ArrowLeft size={17} className="text-[#BDBDBD]" />
          </button>
        </Link>
        <h1 className="text-[18px] font-black text-white">Child Safety Standards</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-[15px] text-[#BDBDBD] leading-relaxed pb-20">

        <div>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-4">Last updated: July 2026</p>
          <p>
            Noelaven is committed to providing a safe environment for all users. The protection of children
            is one of our highest priorities, and we maintain a strict zero-tolerance policy toward any
            content or behaviour that harms, exploits, or endangers minors.
          </p>
        </div>

        {/* Zero tolerance */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#7B5CFA]" />
            <h2 className="text-[17px] font-bold text-white">Zero Tolerance for CSAE/CSAM</h2>
          </div>
          <p>
            Noelaven has an absolute zero-tolerance policy for child sexual abuse material (CSAM) and child
            sexual abuse and exploitation (CSAE) in any form. This includes images, videos, text, links, or
            any other content that sexually exploits or abuses minors.
          </p>
          <p>
            Any account found to be creating, sharing, soliciting, or distributing such material will be
            permanently banned immediately, and the content will be reported to the National Center for
            Missing and Exploited Children (NCMEC) and relevant law enforcement authorities as required
            by law.
          </p>
        </section>

        {/* Reporting */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-400" />
            <h2 className="text-[17px] font-bold text-white">Reporting Abusive Content & Accounts</h2>
          </div>
          <p>
            All users can report content or accounts they believe to be harmful, abusive, or in violation
            of our child safety standards:
          </p>
          <ul className="space-y-2 text-[14px] pl-1">
            <li className="flex items-start gap-2">
              <span className="text-[#7B5CFA] mt-1">→</span>
              Tap the <span className="text-white font-medium">⋯ menu</span> on any post, story, or message and select <span className="text-white font-medium">Report</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#7B5CFA] mt-1">→</span>
              Visit a user's profile, tap <span className="text-white font-medium">⋯</span> and select <span className="text-white font-medium">Report Account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#7B5CFA] mt-1">→</span>
              Email us directly at{' '}
              <a href="mailto:support.noelaven@gmail.com" className="text-[#7B5CFA] underline">
                support.noelaven@gmail.com
              </a>
            </li>
          </ul>
          <p>All reports are reviewed promptly by our moderation team.</p>
        </section>

        {/* Blocking */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Ban size={20} className="text-red-400" />
            <h2 className="text-[17px] font-bold text-white">Blocking Users</h2>
          </div>
          <p>
            Every user can block other users at any time. Blocking prevents the blocked user from viewing
            your profile, sending you messages, or interacting with your content. To block a user, visit
            their profile and tap <span className="text-white font-medium">Block</span> from the menu.
          </p>
        </section>

        {/* Review */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-blue-400" />
            <h2 className="text-[17px] font-bold text-white">Content Review</h2>
          </div>
          <p>
            Reported content is reviewed promptly by our moderation team. We prioritise reports involving
            potential harm to minors above all other report categories. Our goal is to review all
            child-safety-related reports within 24 hours of receipt.
          </p>
        </section>

        {/* Removal */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 size={20} className="text-red-400" />
            <h2 className="text-[17px] font-bold text-white">Removal of Illegal Content</h2>
          </div>
          <p>
            Any content found to violate child safety laws — including CSAM and CSAE material — is removed
            immediately upon detection or report, without prior notice to the posting user. Noelaven
            reserves the right to remove any content we determine poses a risk to the safety of minors,
            regardless of whether a formal report has been submitted.
          </p>
        </section>

        {/* Banning */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Gavel size={20} className="text-orange-400" />
            <h2 className="text-[17px] font-bold text-white">Account Banning</h2>
          </div>
          <p>
            Accounts found to be in violation of our child safety policy are permanently banned. Banned
            accounts cannot create new accounts using the same identifying information. Noelaven does not
            offer appeals for bans resulting from CSAM or CSAE violations.
          </p>
        </section>

        {/* Law enforcement */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Phone size={20} className="text-green-400" />
            <h2 className="text-[17px] font-bold text-white">Law Enforcement Cooperation</h2>
          </div>
          <p>
            Noelaven cooperates fully with law enforcement agencies when legally required. We respond to
            valid legal requests including subpoenas, court orders, and emergency disclosure requests
            involving the safety of a child. All CSAM discoveries are proactively reported to NCMEC
            in accordance with 18 U.S.C. § 2258A.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-white">Contact Us</h2>
          <p>
            To report a child safety concern or for questions about this policy, contact us at:
          </p>
          <a
            href="mailto:support.noelaven@gmail.com"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#7B5CFA] to-[#E040FB] text-white font-semibold text-[15px] shadow-lg hover:opacity-90 transition-opacity"
          >
            support.noelaven@gmail.com
          </a>
        </section>

        {/* Footer */}
        <div className="pt-4 border-t border-[#1a1a1a] space-y-2">
          <p className="text-[13px] text-[rgba(255,255,255,0.45)]">
            © {new Date().getFullYear()} Noelaven. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            <Link href="/privacy"><span className="text-[#7B5CFA] hover:underline cursor-pointer">Privacy Policy</span></Link>
            <Link href="/terms"><span className="text-[#7B5CFA] hover:underline cursor-pointer">Terms of Service</span></Link>
            <Link href="/delete-account"><span className="text-[#7B5CFA] hover:underline cursor-pointer">Delete Account</span></Link>
          </div>
        </div>

      </div>
    </div>
  );
}
