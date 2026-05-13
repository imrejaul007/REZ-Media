export default function PrivacyPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#0f0f0f', color: '#e5e7eb' }}
    >
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm mb-10" style={{ color: '#6b7280' }}>
          Last updated: April 2025
        </p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#9ca3af' }}>
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Information We Collect</h2>
            <p>
              We collect information you provide when registering (name, email, company details),
              information generated through your use of the platform (bookings, listings, QR scans),
              and technical data such as IP addresses and device information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. How We Use Your Information</h2>
            <p>
              We use your information to provide and improve the AdBazaar platform, process
              payments, send transactional emails, calculate attribution metrics, and comply with
              legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Data Sharing</h2>
            <p>
              We share data with payment processors (Razorpay), email providers, and the REZ
              platform for attribution purposes. We do not sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. QR and Attribution Data</h2>
            <p>
              Scan events and attribution data are collected to provide campaign performance metrics.
              Individual scanner data is anonymised before being surfaced in dashboards.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as required by law.
              You may request deletion of your account and associated data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Security</h2>
            <p>
              We implement industry-standard security measures including TLS encryption, Supabase
              row-level security, and access controls. No system is completely secure; we encourage
              you to use a strong password.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal data. Contact us at{' '}
              <a href="mailto:privacy@adBazaar.in" style={{ color: '#f59e0b' }}>
                privacy@adBazaar.in
              </a>{' '}
              to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">8. Contact</h2>
            <p>
              For privacy questions, email{' '}
              <a href="mailto:privacy@adBazaar.in" style={{ color: '#f59e0b' }}>
                privacy@adBazaar.in
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
