/**
 * Mindset365 - Privacy Policy Page
 * Public page — accessible without authentication.
 */

export async function render(container) {
    const currentYear = new Date().getFullYear();

    container.innerHTML = `
        <div class="page-enter legal-page">
            <div class="legal-container">
                <div class="legal-header">
                    <a href="/login" class="legal-back-link">&larr; Back</a>
                    <h1>Privacy Policy</h1>
                    <p class="text-muted">Last updated: February ${currentYear}</p>
                </div>

                <div class="legal-content card">
                    <div class="card-body">

                        <section class="legal-section">
                            <h2>1. Introduction</h2>
                            <p>Mindset365 ("we", "us", "our") operates the website <strong>moneymindset365.com</strong> and the Mindset365 platform ("Service"). This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our Service.</p>
                            <p>By using the Service, you consent to the data practices described in this policy.</p>
                        </section>

                        <section class="legal-section">
                            <h2>2. Information We Collect</h2>

                            <h3>2.1 Information You Provide</h3>
                            <ul>
                                <li><strong>Google Account Data:</strong> When you sign in with Google, we receive your name, email address, and profile picture from your Google account.</li>
                                <li><strong>Assessment Responses:</strong> Answers you provide during business assessments.</li>
                                <li><strong>Chat Messages:</strong> Messages you send to the AI coaching chatbot.</li>
                                <li><strong>Goals and Tasks:</strong> Business goals and tasks you create on the platform.</li>
                                <li><strong>Client Data:</strong> Information about clients you add to the platform (if applicable).</li>
                            </ul>

                            <h3>2.2 Information Collected Automatically</h3>
                            <ul>
                                <li><strong>Usage Data:</strong> Pages visited, features used, and interaction patterns.</li>
                                <li><strong>Device Information:</strong> Browser type, operating system, and screen resolution.</li>
                                <li><strong>IP Address:</strong> Used for security, fraud prevention, and approximate geolocation.</li>
                                <li><strong>Cookies:</strong> We use essential cookies (e.g., authentication tokens) for the Service to function. We do not use third-party advertising or tracking cookies.</li>
                            </ul>

                            <h3>2.3 Payment Information</h3>
                            <p>We do <strong>not</strong> collect, store, or process your credit card numbers, billing addresses, or other payment details. All payment transactions are handled entirely by our payment processor, <strong>Lemon Squeezy</strong>. Please refer to <a href="https://www.lemonsqueezy.com/privacy" target="_blank" rel="noopener">Lemon Squeezy's Privacy Policy</a> for information about how they handle your payment data.</p>
                        </section>

                        <section class="legal-section">
                            <h2>3. How We Use Your Information</h2>
                            <p>We use your information to:</p>
                            <ul>
                                <li><strong>Provide the Service:</strong> Authenticate your identity, deliver AI coaching, and power platform features.</li>
                                <li><strong>Personalize Experience:</strong> Tailor AI coaching responses based on your assessment data and conversation history.</li>
                                <li><strong>Process Transactions:</strong> Track credit balances, record purchases, and manage your account.</li>
                                <li><strong>Improve the Service:</strong> Analyze usage patterns to improve features and fix issues.</li>
                                <li><strong>Communicate:</strong> Send important service updates and notifications.</li>
                                <li><strong>Security:</strong> Detect and prevent fraud, abuse, and unauthorized access.</li>
                            </ul>
                        </section>

                        <section class="legal-section">
                            <h2>4. AI Coaching and Your Data</h2>
                            <p>When you use the AI coaching chat:</p>
                            <ul>
                                <li>Your messages are sent to our AI provider (OpenAI) to generate coaching responses.</li>
                                <li>We store your chat history on our servers to provide conversation continuity.</li>
                                <li>AI responses are generated in real-time and are not pre-written by humans.</li>
                                <li>We do not use your individual chat data to train AI models. However, our AI provider may process data according to their own privacy policies.</li>
                            </ul>
                            <p>For more information about how OpenAI processes data, see <a href="https://openai.com/privacy" target="_blank" rel="noopener">OpenAI's Privacy Policy</a>.</p>
                        </section>

                        <section class="legal-section">
                            <h2>5. Data Sharing</h2>
                            <p>We do <strong>not</strong> sell your personal information. We share data only with:</p>
                            <ul>
                                <li><strong>OpenAI:</strong> Chat messages are sent to generate AI coaching responses.</li>
                                <li><strong>Lemon Squeezy:</strong> Payment processing for credit purchases.</li>
                                <li><strong>Google:</strong> Authentication via Google Sign-In.</li>
                                <li><strong>Legal Requirements:</strong> If required by law, court order, or governmental authority.</li>
                            </ul>
                            <p>We do not share your data with advertisers, data brokers, or any other third parties.</p>
                        </section>

                        <section class="legal-section">
                            <h2>6. Data Storage and Security</h2>
                            <ul>
                                <li>Your data is stored on secure servers with encrypted database connections.</li>
                                <li>Authentication tokens are hashed before storage (we never store raw tokens).</li>
                                <li>All data transmission uses HTTPS/TLS encryption.</li>
                                <li>We implement access controls to limit who can access user data.</li>
                            </ul>
                            <p>While we implement industry-standard security measures, no system is 100% secure. We cannot guarantee absolute security of your data.</p>
                        </section>

                        <section class="legal-section">
                            <h2>7. Data Retention</h2>
                            <ul>
                                <li><strong>Account Data:</strong> Retained as long as your account is active.</li>
                                <li><strong>Chat History:</strong> Retained as long as your account is active to provide conversation continuity.</li>
                                <li><strong>Transaction Records:</strong> Retained for a minimum of 3 years for accounting and legal purposes.</li>
                                <li><strong>Expired Tokens:</strong> Automatically deleted during regular cleanup cycles.</li>
                            </ul>
                            <p>Upon account deletion request, we will remove your personal data within 30 days, except where retention is required by law.</p>
                        </section>

                        <section class="legal-section">
                            <h2>8. Your Rights</h2>
                            <p>Depending on your jurisdiction, you may have the right to:</p>
                            <ul>
                                <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
                                <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
                                <li><strong>Deletion:</strong> Request deletion of your personal data.</li>
                                <li><strong>Portability:</strong> Request your data in a portable format.</li>
                                <li><strong>Objection:</strong> Object to certain types of data processing.</li>
                            </ul>
                            <p>To exercise any of these rights, please contact us at <strong>support@moneymindset365.com</strong>. We will respond within 30 days.</p>
                        </section>

                        <section class="legal-section">
                            <h2>9. Children's Privacy</h2>
                            <p>The Service is not intended for users under the age of 18. We do not knowingly collect personal information from children. If you believe a minor has provided us with personal data, please contact us and we will delete it promptly.</p>
                        </section>

                        <section class="legal-section">
                            <h2>10. International Users</h2>
                            <p>The Service is hosted in the United States. If you access the Service from outside the US, your data may be transferred to and processed in the US. By using the Service, you consent to this transfer. We comply with applicable data protection laws including GDPR for EU/EEA users.</p>
                        </section>

                        <section class="legal-section">
                            <h2>11. Changes to This Policy</h2>
                            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on the platform or sending an email. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>
                        </section>

                        <section class="legal-section">
                            <h2>12. Contact Us</h2>
                            <p>For questions, concerns, or requests regarding this Privacy Policy or your personal data, contact us at:</p>
                            <p><strong>Email:</strong> support@moneymindset365.com</p>
                            <p><strong>Website:</strong> <a href="https://moneymindset365.com">moneymindset365.com</a></p>
                        </section>

                    </div>
                </div>

                <div class="legal-footer">
                    <a href="/terms">Terms of Service</a>
                    <span class="text-muted">&bull;</span>
                    <a href="/login">Sign In</a>
                </div>
            </div>
        </div>
    `;
}
