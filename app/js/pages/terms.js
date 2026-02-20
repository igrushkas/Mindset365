/**
 * Mindset365 - Terms of Service Page
 * Public page — accessible without authentication.
 */

export async function render(container) {
    const currentYear = new Date().getFullYear();

    container.innerHTML = `
        <div class="page-enter legal-page">
            <div class="legal-container">
                <div class="legal-header">
                    <a href="/login" class="legal-back-link">&larr; Back</a>
                    <h1>Terms of Service</h1>
                    <p class="text-muted">Last updated: February ${currentYear}</p>
                </div>

                <div class="legal-content card">
                    <div class="card-body">

                        <section class="legal-section">
                            <h2>1. Agreement to Terms</h2>
                            <p>By accessing or using the Mindset365 platform ("Service"), operated at <strong>moneymindset365.com</strong>, you agree to be bound by these Terms of Service ("Terms"). If you do not agree with any part of these Terms, you may not use the Service.</p>
                        </section>

                        <section class="legal-section">
                            <h2>2. Description of Service</h2>
                            <p>Mindset365 is an AI-powered business coaching platform that provides:</p>
                            <ul>
                                <li>AI-generated coaching and business advice via an interactive chat interface</li>
                                <li>Business assessment tools and goal tracking</li>
                                <li>Task and project management features</li>
                                <li>Client management tools (for qualifying accounts)</li>
                                <li>Educational course content</li>
                            </ul>
                            <p>The AI coaching features are powered by artificial intelligence and are not a substitute for professional business, legal, financial, or medical advice.</p>
                        </section>

                        <section class="legal-section">
                            <h2>3. User Accounts</h2>
                            <p>To access the Service, you must sign in using a valid Google account. By signing in, you agree to:</p>
                            <ul>
                                <li>Provide accurate and current information</li>
                                <li>Maintain the security of your account credentials</li>
                                <li>Accept responsibility for all activity under your account</li>
                                <li>Notify us immediately of any unauthorized access</li>
                            </ul>
                            <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>
                        </section>

                        <section class="legal-section">
                            <h2>4. Credits and Payments</h2>
                            <h3>4.1 Credit System</h3>
                            <p>AI coaching interactions consume credits from your account balance. New users receive a one-time allotment of <strong>25 free trial credits</strong> upon signup. Additional credits may be purchased through our platform.</p>

                            <h3>4.2 Credit Packs</h3>
                            <p>We offer the following credit packs for one-time purchase:</p>
                            <ul>
                                <li><strong>Starter Pack</strong> &mdash; 50 credits for $4.99 USD</li>
                                <li><strong>Growth Pack</strong> &mdash; 200 credits for $14.99 USD</li>
                                <li><strong>Pro Pack</strong> &mdash; 500 credits for $29.99 USD</li>
                            </ul>
                            <p>Credit packs are one-time purchases (not subscriptions). Credits do not expire and are non-transferable between accounts.</p>

                            <h3>4.3 Payment Processing</h3>
                            <p>All payments are processed securely by <strong>Lemon Squeezy</strong>, our third-party payment processor. By making a purchase, you also agree to Lemon Squeezy's <a href="https://www.lemonsqueezy.com/terms" target="_blank" rel="noopener">Terms of Service</a>.</p>

                            <h3>4.4 Refund Policy</h3>
                            <p>Because credits are digital goods that are immediately delivered and usable upon purchase, refunds are generally not available for consumed credits. If you experience a technical issue preventing credit delivery, please contact us and we will investigate and resolve the issue promptly. Refunds for unused credits may be issued at our discretion within 14 days of purchase.</p>
                        </section>

                        <section class="legal-section">
                            <h2>5. Referral Program</h2>
                            <p>Mindset365 offers a referral program. When a new user signs up using your unique referral link, you may receive reward credits as described on the Referrals page. We reserve the right to modify or discontinue the referral program at any time. Abuse of the referral system (e.g., creating fake accounts) will result in forfeiture of rewards and possible account termination.</p>
                        </section>

                        <section class="legal-section">
                            <h2>6. AI-Generated Content Disclaimer</h2>
                            <p><strong>Important:</strong> All coaching responses provided by the Mindset365 AI are generated by artificial intelligence. While we strive for accuracy and usefulness, AI-generated content:</p>
                            <ul>
                                <li>May contain errors, inaccuracies, or outdated information</li>
                                <li>Should not be considered professional business, legal, financial, or medical advice</li>
                                <li>Is provided "as-is" for informational and motivational purposes only</li>
                                <li>Should be independently verified before making business decisions</li>
                            </ul>
                            <p>You use AI coaching outputs at your own risk and discretion.</p>
                        </section>

                        <section class="legal-section">
                            <h2>7. Acceptable Use</h2>
                            <p>You agree not to:</p>
                            <ul>
                                <li>Use the Service for any unlawful purpose</li>
                                <li>Attempt to gain unauthorized access to any part of the Service</li>
                                <li>Interfere with or disrupt the Service or its infrastructure</li>
                                <li>Use automated tools to scrape, crawl, or extract data from the Service</li>
                                <li>Share your account with others or resell access to the Service</li>
                                <li>Upload harmful, abusive, or illegal content through the platform</li>
                            </ul>
                        </section>

                        <section class="legal-section">
                            <h2>8. Intellectual Property</h2>
                            <p>The Mindset365 platform, including its design, code, logos, and original content, is owned by Mindset365 and protected by intellectual property laws. You retain ownership of any content you create on the platform (goals, tasks, notes). We do not claim ownership of your data.</p>
                        </section>

                        <section class="legal-section">
                            <h2>9. Limitation of Liability</h2>
                            <p>To the maximum extent permitted by law, Mindset365 shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to:</p>
                            <ul>
                                <li>Loss of profits or business opportunities</li>
                                <li>Decisions made based on AI-generated advice</li>
                                <li>Service interruptions or data loss</li>
                                <li>Unauthorized access to your account</li>
                            </ul>
                            <p>Our total liability shall not exceed the amount you have paid to us in the 12 months preceding the claim.</p>
                        </section>

                        <section class="legal-section">
                            <h2>10. Service Availability</h2>
                            <p>We strive to maintain continuous service availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, updates, or circumstances beyond our control. We are not liable for any loss resulting from service downtime.</p>
                        </section>

                        <section class="legal-section">
                            <h2>11. Termination</h2>
                            <p>You may stop using the Service at any time. We reserve the right to suspend or terminate your account if you violate these Terms. Upon termination, your right to use the Service ceases immediately. Unused purchased credits are non-refundable upon voluntary account termination.</p>
                        </section>

                        <section class="legal-section">
                            <h2>12. Changes to Terms</h2>
                            <p>We may update these Terms from time to time. Significant changes will be communicated via the platform or email. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
                        </section>

                        <section class="legal-section">
                            <h2>13. Governing Law</h2>
                            <p>These Terms are governed by the laws of the United States. Any disputes shall be resolved through binding arbitration in accordance with applicable rules, unless prohibited by local law.</p>
                        </section>

                        <section class="legal-section">
                            <h2>14. Contact</h2>
                            <p>For questions about these Terms, please contact us at:</p>
                            <p><strong>Email:</strong> support@moneymindset365.com</p>
                        </section>

                    </div>
                </div>

                <div class="legal-footer">
                    <a href="/privacy">Privacy Policy</a>
                    <span class="text-muted">&bull;</span>
                    <a href="/login">Sign In</a>
                </div>
            </div>
        </div>
    `;
}
