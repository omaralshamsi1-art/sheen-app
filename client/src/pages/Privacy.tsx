import { Link } from 'react-router-dom'
import Footer from '../components/layout/Footer'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-sheen-cream">
      <header className="bg-sheen-black sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <img src="/images/logo.png" alt="SHEEN" className="w-10 h-10 rounded-full" />
            <h1 className="font-display text-2xl font-bold text-sheen-gold tracking-wide">SHEEN</h1>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-sheen-black mb-6">Privacy Policy</h1>
        <p className="font-body text-xs text-sheen-muted mb-8">Last updated: April 2026</p>

        <div className="prose prose-sm max-w-none font-body text-sheen-black/80 space-y-6">
          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">1. Who We Are</h2>
            <p>SHEEN Speciality Coffee ("we", "us", "our") operates the website sheencafe.ae. We are registered in the United Arab Emirates under Trade License No. <strong>63802</strong>, located at Saqr bin Mohammed City, AlDhait 03, Ras Al Khaimah, UAE.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">2. Data We Collect</h2>
            <p>When you use our Website, we may collect the following personal data:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> Full name, email address, phone number</li>
              <li><strong>Vehicle information:</strong> UAE plate number (for drive-through order identification)</li>
              <li><strong>Location data:</strong> Home address and coordinates (only if you choose to provide them for delivery)</li>
              <li><strong>Order history:</strong> Items ordered, order dates, amounts, payment method chosen</li>
              <li><strong>Authentication data:</strong> Login credentials managed securely through Supabase Auth</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">3. Why We Collect Your Data</h2>
            <p>We use your personal data for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Order fulfillment:</strong> To process, prepare, and deliver your orders</li>
              <li><strong>Drive-through identification:</strong> Your plate number helps our staff identify your vehicle</li>
              <li><strong>Delivery:</strong> Your home address is used to deliver orders when delivery is enabled</li>
              <li><strong>Communication:</strong> To contact you about your orders if needed</li>
              <li><strong>Service improvement:</strong> To understand customer preferences and improve our offerings</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">4. How We Store Your Data</h2>
            <p>Your data is stored securely using Supabase, a trusted cloud database provider. All data is encrypted in transit (TLS/SSL) and at rest. We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, loss, or destruction.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">5. Data Sharing</h2>
            <p>We do not sell, trade, or rent your personal data to third parties. We may share your data only with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Payment processors:</strong> Stripe processes card payments under their own privacy policy. We never see or store your card number.</li>
              <li><strong>Legal requirements:</strong> We may disclose data if required by UAE law or government authorities.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">6. Your Rights (UAE Personal Data Protection Law)</h2>
            <p>Under the UAE Federal Decree-Law No. 45/2021 on Personal Data Protection, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Update or correct inaccurate data via your profile page</li>
              <li><strong>Deletion:</strong> Delete your account and associated data at any time using the "Delete My Account" option in your profile</li>
              <li><strong>Withdraw consent:</strong> Stop using our services and request data deletion</li>
            </ul>
            <p>When you delete your account, your personal information is permanently removed. Order records are anonymized (your name and email are stripped) to comply with business record-keeping requirements.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">7. Data Retention</h2>
            <p>We retain your personal data for as long as your account is active. If you delete your account, personal data is removed immediately and order records are anonymized. Anonymized order data may be retained indefinitely for business and tax record-keeping purposes.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">8. Cookies and Tracking</h2>
            <p>Our Website uses essential cookies and local storage for authentication and user preferences (such as language selection and label size). We do not use advertising cookies or third-party tracking.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of the Website after changes constitutes acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">10. Contact Us</h2>
            <p>For any questions or requests regarding your personal data, please contact us:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Phone: <a href="tel:0557306030" className="text-sheen-brown hover:underline">0557306030</a></li>
              <li>Website: <a href="https://sheencafe.ae" className="text-sheen-brown hover:underline">sheencafe.ae</a></li>
              <li>Address: Saqr bin Mohammed City, AlDhait 03, RAK, UAE</li>
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
