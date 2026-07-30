import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-sm border-b border-[#1a1a1a] px-4 pt-safe pt-4 pb-3 flex items-center gap-3">
        <Link href="/">
          <button className="w-8 h-8 rounded-full bg-[#111] border border-[#1a1a1a] flex items-center justify-center shadow-sm">
            <ArrowLeft size={17} className="text-[#BDBDBD]" />
          </button>
        </Link>
        <h1 className="text-[18px] font-black text-white">Terms of Service</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-[15px] text-[#BDBDBD] leading-relaxed pb-20">
        <div>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-6">Last updated: July 2026</p>
          <p>
            Welcome to Noelaven. By creating an account or using the Noelaven application (the "Service"),
            you agree to be bound by these Terms of Service ("Terms"). Please read them carefully.
          </p>
        </div>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">1. Eligibility</h2>
          <p>
            You must be at least 13 years old to use Noelaven. By using the Service you represent that
            you meet this age requirement and that any registration information you submit is accurate
            and complete. If you are under 18, you represent that a parent or guardian has reviewed and
            agreed to these Terms on your behalf.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">2. Your Account</h2>
          <p className="mb-3">
            You are responsible for maintaining the security of your account credentials and for all
            activity that occurs under your account. You must notify us immediately at{' '}
            <a href="mailto:support@noelaven.com" className="text-[#F5C542] font-medium underline">
              support@noelaven.com
            </a>{' '}
            if you suspect unauthorised access.
          </p>
          <p>
            You may not create an account on behalf of someone else, operate multiple accounts to
            circumvent suspensions, or transfer your account to another person.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">3. Acceptable Use</h2>
          <p className="mb-3">You agree not to use Noelaven to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Post content that is illegal, harmful, threatening, abusive, or harassing</li>
            <li>Distribute spam, unsolicited promotions, or phishing content</li>
            <li>Upload malware, viruses, or any other harmful code</li>
            <li>Impersonate any person or entity or misrepresent your affiliation</li>
            <li>Infringe the intellectual property rights of others</li>
            <li>Attempt to gain unauthorised access to other users' accounts or our systems</li>
            <li>Scrape, crawl, or otherwise collect data from the Service without written permission</li>
            <li>Violate any applicable local, national, or international law or regulation</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">4. Content You Post</h2>
          <p className="mb-3">
            You retain ownership of content you create and share on Noelaven. By posting content, you
            grant Noelaven a non-exclusive, royalty-free, worldwide licence to store, display, and
            distribute that content solely for the purpose of operating and improving the Service.
          </p>
          <p>
            You are solely responsible for your content. We do not pre-screen posts, but we reserve the
            right to remove any content that violates these Terms or our Community Guidelines, and to
            suspend or terminate accounts that repeatedly violate them.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">5. Community Guidelines</h2>
          <p className="mb-3">To keep Noelaven safe and welcoming, all users must:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Treat others with respect — harassment, hate speech, and bullying are prohibited</li>
            <li>Not share explicit sexual content, graphic violence, or self-harm material</li>
            <li>Not distribute misinformation or content designed to deceive</li>
            <li>Not promote illegal goods, services, or activities</li>
            <li>Respect the privacy of others — do not share personal information without consent</li>
          </ul>
          <p className="mt-3">
            Violations may result in content removal, account suspension, or permanent termination
            depending on severity.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">6. Intellectual Property</h2>
          <p>
            The Noelaven name, logo, and all original Service content (excluding user-generated content)
            are owned by Noelaven and protected by applicable intellectual property laws. You may not
            copy, modify, distribute, or create derivative works from any part of the Service without
            our prior written consent.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">7. Voice &amp; Video Calls</h2>
          <p>
            Noelaven provides peer-to-peer voice and video calling features. Calls are transmitted
            using end-to-end encrypted WebRTC connections. We do not record or store call audio or
            video. You must obtain consent from all participants before recording any call using a
            third-party tool.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">8. Disclaimers</h2>
          <p className="mb-3">
            The Service is provided "as is" and "as available" without warranties of any kind, express
            or implied, including but not limited to warranties of merchantability, fitness for a
            particular purpose, or non-infringement.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, error-free, or free from viruses
            or other harmful components. Your use of the Service is at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Noelaven shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of or
            inability to use the Service, even if we have been advised of the possibility of such
            damages. Our total liability for any claim arising out of these Terms shall not exceed the
            greater of £50 or the amount you paid us in the twelve months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">10. Termination</h2>
          <p>
            You may stop using Noelaven and delete your account at any time. We may suspend or
            terminate your access immediately, without notice, if you violate these Terms. Upon
            termination, your licence to use the Service ends and we may delete your account data
            in accordance with our{' '}
            <Link href="/privacy">
              <span className="text-[#F5C542] font-medium underline cursor-pointer">Privacy Policy</span>
            </Link>.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">11. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. When we do, we will revise the "Last updated"
            date above and, for material changes, notify you via in-app notice or email. Continued use
            of Noelaven after changes take effect constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">12. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of England and Wales.
            Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the
            courts of England and Wales.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-white mb-3">13. Contact Us</h2>
          <p>
            If you have questions about these Terms, please contact us at:{' '}
            <a href="mailto:legal@noelaven.com" className="text-[#F5C542] font-medium underline">
              legal@noelaven.com
            </a>
          </p>
        </section>

        <div className="pt-4 border-t border-[#1a1a1a]">
          <p className="text-[13px] text-[rgba(255,255,255,0.45)]">
            © {new Date().getFullYear()} Noelaven. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
