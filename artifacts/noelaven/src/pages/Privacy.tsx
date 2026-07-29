import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#FDF9F6]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#FDF9F6]/95 backdrop-blur-sm border-b border-black/[0.04] px-4 pt-safe pt-4 pb-3 flex items-center gap-3">
        <Link href="/">
          <button className="w-8 h-8 rounded-full bg-white border border-black/[0.06] flex items-center justify-center shadow-sm">
            <ArrowLeft size={17} className="text-gray-600" />
          </button>
        </Link>
        <h1 className="text-[18px] font-black text-gray-900">Privacy Policy</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-[15px] text-gray-700 leading-relaxed pb-20">
        <div>
          <p className="text-[13px] text-gray-400 mb-6">Last updated: July 2026</p>
          <p>
            Noelaven ("we," "us," or "our") is committed to protecting your privacy. This Privacy
            Policy explains how we collect, use, and safeguard information when you use the Noelaven
            mobile and web application.
          </p>
        </div>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">1. Information We Collect</h2>
          <h3 className="font-semibold text-gray-800 mb-1">Account data</h3>
          <p className="mb-3">
            When you create an account we collect your email address, chosen username (@handle),
            display name, profile photo, and optional bio. This information is stored in Firebase
            Authentication and Firestore.
          </p>
          <h3 className="font-semibold text-gray-800 mb-1">User content</h3>
          <p className="mb-3">
            We store the content you create: posts, comments, reactions, direct messages, stories,
            and voice messages. Messages are stored in Firestore and associated with your account.
          </p>
          <h3 className="font-semibold text-gray-800 mb-1">Media</h3>
          <p className="mb-3">
            Photos, videos, and audio you upload are stored via Cloudinary, a third-party image
            and video management service.
          </p>
          <h3 className="font-semibold text-gray-800 mb-1">Usage data</h3>
          <p>
            We collect interaction data (e.g. posts viewed, reactions sent) to personalise your
            feed and improve the service. This data is stored in Firestore and is not sold to
            third parties.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To operate and personalise the Noelaven service</li>
            <li>To deliver direct messages and notifications</li>
            <li>To detect and prevent spam, abuse, and violations of our community guidelines</li>
            <li>To improve app features and fix bugs</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">3. Third-Party Services</h2>
          <p className="mb-3">Noelaven uses the following third-party services:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Firebase (Google)</strong> — Authentication, Firestore database, and Cloud
              Messaging (push notifications). Governed by Google's Privacy Policy.
            </li>
            <li>
              <strong>Cloudinary</strong> — Image and video storage and delivery. Files you upload
              are stored on Cloudinary's servers under our account.
            </li>
          </ul>
          <p className="mt-3">
            We do not sell your personal data to advertisers or data brokers.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">4. Push Notifications</h2>
          <p>
            If you grant notification permissions, your device's push token is stored in Firestore
            and used solely to deliver in-app alerts (likes, messages, calls, etc.). You can
            revoke permission at any time in your device settings or in-app notification preferences.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">5. Data Retention</h2>
          <p>
            Your data is retained for as long as your account is active. When you delete your
            account, we remove your profile, posts, and messages within 30 days. Some data may
            be retained longer where required by law.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">6. Your Rights</h2>
          <p className="mb-3">Depending on your location, you may have rights to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Object to certain processing activities</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact us at the email below.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">7. Children's Privacy</h2>
          <p>
            Noelaven is not directed at children under 13. We do not knowingly collect personal
            information from children under 13. If you believe a child has provided us with
            personal information, please contact us and we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be
            communicated via in-app notice or email. Continued use of Noelaven after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-gray-900 mb-3">9. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your data, please contact us at:{' '}
            <a href="mailto:privacy@noelaven.com" className="text-purple-600 font-medium underline">
              privacy@noelaven.com
            </a>
          </p>
        </section>

        <div className="pt-4 border-t border-black/[0.06]">
          <p className="text-[13px] text-gray-400">
            © {new Date().getFullYear()} Noelaven. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
