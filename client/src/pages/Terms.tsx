import { Link } from 'react-router-dom'
import Footer from '../components/layout/Footer'

export default function Terms() {
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
        <h1 className="font-display text-3xl font-bold text-sheen-black mb-6">Terms & Conditions</h1>
        <p className="font-body text-xs text-sheen-muted mb-8">Last updated: April 2026</p>

        <div className="prose prose-sm max-w-none font-body text-sheen-black/80 space-y-6">
          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">1. About Us</h2>
            <p>SHEEN Speciality Coffee is a food and beverage business operating in the United Arab Emirates under Trade License No. <strong>63802</strong>, located at Saqr bin Mohammed City, AlDhait 03, Ras Al Khaimah, UAE.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">2. Acceptance of Terms</h2>
            <p>By accessing or using sheencafe.ae (the "Website"), you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the Website.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">3. Products and Ordering</h2>
            <p>All products displayed on the Website are subject to availability. Prices are listed in UAE Dirhams (AED). We reserve the right to modify prices at any time without prior notice.</p>
            <p>When you place an order through the Website, you are making an offer to purchase. We may accept or reject your order at our discretion. An order is considered confirmed only when we send you a confirmation through the Website.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">4. Payment</h2>
            <p>Payment methods available include cash on pickup and card payment. All payments are processed securely. Card payments are handled through Stripe, a PCI-DSS compliant payment processor. We do not store your card details on our servers.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">5. Cancellations and Refunds</h2>
            <p>Since our products are freshly prepared food and beverages, we cannot accept returns once an order has been confirmed and preparation has begun. If you experience any issues with your order, please contact us immediately at 0557306030 and we will work to resolve the matter.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">6. Delivery</h2>
            <p>Delivery availability is subject to our operational capacity and may be enabled or disabled at our discretion. Delivery areas and fees (if applicable) will be communicated at the time of ordering.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">7. Intellectual Property</h2>
            <p>All content on this Website, including logos, images, text, and design elements, is the property of SHEEN Speciality Coffee and is protected by applicable intellectual property laws. You may not reproduce, distribute, or use any content without our written permission.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">8. User Accounts</h2>
            <p>When you create an account, you are responsible for maintaining the confidentiality of your login credentials. You agree to provide accurate and complete information. We reserve the right to suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">9. Limitation of Liability</h2>
            <p>SHEEN Speciality Coffee shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Website or our products, to the maximum extent permitted by UAE law.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">10. Governing Law</h2>
            <p>These Terms & Conditions are governed by and construed in accordance with the laws of the United Arab Emirates. Any disputes shall be subject to the exclusive jurisdiction of the courts of Ras Al Khaimah, UAE.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-sheen-black mb-2">11. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us:</p>
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
