export default function TermsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#0f0f0f', color: '#e5e7eb' }}
    >
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm mb-10" style={{ color: '#6b7280' }}>
          Last updated: April 2025
        </p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#9ca3af' }}>
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using AdBazaar you agree to be bound by these Terms of Service and our
              Privacy Policy. If you do not agree, please do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. Use of the Platform</h2>
            <p>
              AdBazaar is a marketplace connecting advertisers (buyers) with ad-space owners (vendors).
              You may use the platform only for lawful purposes and in accordance with these terms.
              You are responsible for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Listings and Bookings</h2>
            <p>
              Vendors are responsible for the accuracy of their listings. Buyers acknowledge that
              all bookings are subject to vendor confirmation. AdBazaar charges a platform commission
              on completed bookings as disclosed at checkout.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Payments</h2>
            <p>
              Payments are processed via Razorpay. AdBazaar does not store payment card details.
              Refunds are subject to our dispute resolution policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. QR Codes and Attribution</h2>
            <p>
              QR codes generated on the platform are for tracking campaign performance. Misuse of
              QR codes or scan data is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Termination</h2>
            <p>
              AdBazaar reserves the right to suspend or terminate accounts that violate these terms,
              engage in fraud, or harm other users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Limitation of Liability</h2>
            <p>
              AdBazaar provides the platform on an as-is basis. To the maximum extent permitted by
              law, AdBazaar is not liable for indirect, incidental, or consequential damages arising
              from your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">8. Contact</h2>
            <p>
              For questions about these terms, contact us at{' '}
              <a href="mailto:support@adBazaar.in" style={{ color: '#f59e0b' }}>
                support@adBazaar.in
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
