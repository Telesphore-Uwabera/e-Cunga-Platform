import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import '../theme.css';
import styles from './MarketingPages.module.css';

const PrivacyContent = () => (
  <div className={styles.legalContent}>
    <h2>1. Purpose</h2>
    <p>This Acceptable Use Policy outlines the rules and standards for using eCunga Portal services, systems, and digital platforms responsibly and professionally.</p>
    
    <h2>2. Scope</h2>
    <p>This policy applies to all users of eCunga Portal, including clients, suppliers, employees, volunteers, partners, and visitors accessing the platform or related services.</p>
    
    <h2>3. Acceptable Use</h2>
    <p>Users are permitted to use eCunga Portal for lawful business activities including inventory management, procurement support, communication, supplier coordination, and operational services.</p>
    
    <h2>4. Prohibited Activities</h2>
    <p>Users must not:</p>
    <ul>
      <li>Engage in illegal or fraudulent activities</li>
      <li>Upload false or misleading information</li>
      <li>Attempt unauthorized access to accounts or systems</li>
      <li>Spread malware, viruses, or harmful software</li>
      <li>Use the platform to harass, abuse, or threaten others</li>
      <li>Violate intellectual property rights</li>
      <li>Copy or misuse platform content without permission</li>
      <li>Interfere with the performance or security of the platform</li>
    </ul>

    <h2>5. Data and Privacy</h2>
    <p>Users must respect the confidentiality and privacy of business and personal information obtained through eCunga Portal. Unauthorized sharing or misuse of data is strictly prohibited.</p>

    <h2>6. Account Security</h2>
    <p>Users are responsible for protecting their login credentials and maintaining the security of their accounts. Any suspected unauthorized access must be reported immediately.</p>

    <h2>7. Compliance with Laws</h2>
    <p>All users must comply with applicable laws and regulations of the Republic of Rwanda and any other applicable jurisdictions while using the platform.</p>

    <h2>8. Monitoring and Enforcement</h2>
    <p>eCunga Portal reserves the right to monitor platform usage and investigate any suspected violations of this policy.</p>

    <h2>9. Consequences of Violations</h2>
    <p>Violation of this policy may result in:</p>
    <ul>
      <li>Temporary or permanent account suspension</li>
      <li>Termination of services</li>
      <li>Legal action where applicable</li>
      <li>Reporting to relevant authorities</li>
    </ul>

    <h2>10. Policy Updates</h2>
    <p>eCunga Portal may modify this policy from time to time. Updated versions become effective immediately upon publication on the platform.</p>

    <h2>11. Contact Information</h2>
    <p>For questions regarding this policy, contact:<br />
    Email: hello.ecunga@gmail.com<br />
    Phone: +250781975074<br />
    Website: www.ecunga.com</p>

    <div className={styles.downloadBox}>
      <p>
        <strong>Download Policy:</strong> <a href="/documents/eCunga policy of use.pdf" target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>eCunga policy of use.pdf</a>
      </p>
    </div>
  </div>
);

const TermsContent = () => (
  <div className={styles.legalContent}>
    <h2>1. Introduction</h2>
    <p>e-Cunga Portal is a digital platform designed to support inventory management, procurement support, supplier connections, and related operational services for businesses, clinics, polyclinics, hospitals, institutions, and other users. These Terms apply to all users, including clients, suppliers, visitors, volunteers, and partners using the platform;</p>

    <h2>2. Acceptance of Terms</h2>
    <p>By registering an account, accessing, or using eCunga Portal services, you confirm that you are legally capable of entering into binding agreements, the information you provide is accurate and complete, and you agree to follow these Terms and all applicable laws and regulations.</p>

    <h2>3. User Accounts</h2>
    <p>Users may be required to create an account to access certain services. Users are responsible for maintaining account confidentiality and all activities under their accounts.</p>

    <h2>4. Services Provided</h2>
    <p>eCunga Portal may provide inventory management support, procurement coordination, supplier and vendor marketing, digital inventory operational support, customer support services, and business communication tools and all the services are chargeable.</p>

    <h2>5. User Responsibilities</h2>
    <p>Users agree not to use the platform for illegal activities, upload harmful information, disrupt the platform, or misuse company intellectual property.</p>

    <h2>6. Payments and Transactions</h2>
    <p>Where applicable, users agree to provide accurate payment information. eCunga Portal reserves the right to modify pricing and service charges where necessary.</p>

    <h2>7. Intellectual Property</h2>
    <p>All logos, content, designs, software, and materials associated with eCunga Portal remain the intellectual property of eCunga Portal unless otherwise stated.</p>

    <h2>8. Privacy and Data Protection</h2>
    <p>eCunga Portal is committed to protecting user and business information and implementing reasonable security measures.</p>

    <h2>9. Third-Party Services</h2>
    <p>eCunga Portal is not responsible for third-party content, external services, or supplier actions accessed through the platform.</p>

    <h2>10. Limitation of Liability</h2>
    <p>eCunga Portal shall not be liable for indirect damages, loss of profits, service interruptions, or unauthorized access caused by external systems.</p>

    <h2>11. Suspension and Termination</h2>
    <p>eCunga Portal reserves the right to suspend or terminate user access for violations of these Terms or fraudulent activity.</p>

    <h2>12. Modifications to Terms</h2>
    <p>These Terms may be updated from time to time. Continued use of the platform means acceptance of the updated Terms.</p>

    <h2>13. Governing Law</h2>
    <p>These Terms shall be governed in accordance with the laws of the Republic of Rwanda.</p>

    <h2>14. Contact Information</h2>
    <p>Email: hello.ecunga@gmail.com<br />
    Phone: +250781975074<br />
    Website: www.ecunga.com</p>

    <h2>15. Acceptance</h2>
    <p>By using eCunga Portal, users acknowledge that they have read, understood, and agreed to these Terms and Conditions.</p>
    <p><strong>eCunga Portal</strong><br />Empowering Digital Procurement & Inventory Solutions</p>

    <div className={styles.downloadBox}>
      <p>
        <strong>Download Terms:</strong> <a href="/documents/eCunga_Portal_Terms_and_Conditions.pdf" target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>eCunga_Portal_Terms_and_Conditions.pdf</a>
      </p>
    </div>
  </div>
);

const CookiesContent = () => (
  <div className={styles.legalContent}>
    <h2>1. Introduction</h2>
    <p>e-Cunga Portal uses cookies and similar technologies to ensure the smooth functioning of our digital procurement and inventory solutions. This policy explains what cookies are, how we use them, and your choices regarding their use.</p>

    <h2>2. What are Cookies?</h2>
    <p>Cookies are small text files stored on your device (computer, tablet, or mobile) when you visit a website. They help the platform recognize your device and remember your preferences and session information securely.</p>

    <h2>3. How We Use Cookies</h2>
    <p>We use cookies for the following critical purposes:</p>
    <ul>
      <li><strong>Essential/Strictly Necessary Cookies:</strong> These are required for the e-Cunga Portal to function properly, including user authentication, protecting against CSRF attacks, and session management.</li>
      <li><strong>Preference Cookies:</strong> These remember your settings, such as language preference (e.g., English or Kinyarwanda) and theme selection (Light or Dark mode).</li>
      <li><strong>Analytics Cookies:</strong> We use these to understand how users interact with our platform, which helps us improve the user experience and optimize our supply chain services.</li>
    </ul>

    <h2>4. Third-Party Cookies</h2>
    <p>We may use trusted third-party services (such as analytics or secure document storage) that may also place cookies on your device. We do not control these third-party cookies and recommend reviewing their respective privacy policies.</p>

    <h2>5. Managing Your Cookie Preferences</h2>
    <p>You can control or delete cookies through your browser settings. However, please note that disabling essential cookies may impact your ability to use the e-Cunga Portal, including accessing your account or utilizing our inventory management tools.</p>

    <h2>6. Updates to this Policy</h2>
    <p>We may update our Cookies Policy from time to time to reflect changes in our practices or legal requirements. Updates will be posted on this page.</p>

    <h2>7. Contact Information</h2>
    <p>If you have any questions about our use of cookies, please contact us at:<br />
    Email: hello.ecunga@gmail.com<br />
    Phone: +250781975074<br />
    Website: www.ecunga.com</p>
  </div>
);

const LEGAL_KEYS = {
  privacy: {
    title: 'Acceptable Use Policy',
    updated: 'Effective immediately upon publication',
  },
  terms: {
    title: 'Terms and Conditions',
    updated: 'Effective immediately upon publication',
  },
  cookies: {
    title: 'Cookies Policy',
    updated: 'Effective immediately upon publication',
  },
};

export default function LegalNoticePage({ doc }) {
  const { t } = useI18n();
  const cfg = LEGAL_KEYS[doc] || LEGAL_KEYS.privacy;

  return (
    <div className={styles.page}>
      <section className={styles.heroBand}>
        <div className={styles.containNarrow}>
          <p className={styles.contactEyebrow}>e-Cunga Portal</p>
          <h1 className={styles.contactTitle}>{cfg.title}</h1>
          <p className={styles.heroSub} style={{ textAlign: 'center' }}>
            {cfg.updated}
          </p>
        </div>
      </section>
      <div className={styles.contain} style={{ maxWidth: '48rem', margin: '0 auto 3rem' }}>
        <div className={styles.formLead}>
          {doc === 'privacy' && <PrivacyContent />}
          {doc === 'terms' && <TermsContent />}
          {doc === 'cookies' && <CookiesContent />}
        </div>
        <div className={styles.backHomeRow} style={{ marginTop: '3rem' }}>
          <Link to="/" className={styles.backHomeBtn}>
            {t('pricing.backHome')}
          </Link>
          <Link to="/contact" className={styles.backHomeBtn} style={{ marginLeft: '0.75rem' }}>
            {t('marketing.navContact')}
          </Link>
        </div>
      </div>
    </div>
  );
}
