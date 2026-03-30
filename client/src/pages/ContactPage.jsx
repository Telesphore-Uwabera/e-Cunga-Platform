import { Link } from 'react-router-dom';
import '../theme.css';
import styles from './MarketingPages.module.css';

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="m5.5 7.5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <path
        d="M7.8 4.6h2l1.1 4.3-1.9 1.8a15.5 15.5 0 0 0 4.3 4.3l1.8-1.9 4.3 1.1v2a1.8 1.8 0 0 1-2 1.8c-7 0-12.6-5.7-12.6-12.6a1.8 1.8 0 0 1 1.8-1.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <path
        d="M12 20s6-4.9 6-10a6 6 0 1 0-12 0c0 5.1 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9h17M3.5 15h17M12 3c2.4 2.4 3.7 5.6 3.7 9s-1.3 6.6-3.7 9c-2.4-2.4-3.7-5.6-3.7-9S9.6 5.4 12 3Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" aria-hidden>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.3 11 7.1-4.1M8.3 13l7.1 4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <section className={styles.heroBand}>
        <div className={styles.containNarrow}>
          <p className={styles.contactEyebrow}>Get in touch</p>
          <h1 className={styles.contactTitle}>Connect with the Intelligent Ledger</h1>
          <p className={styles.heroSub} style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            Reach out for demos, onboarding, workflow setup, or enterprise support for healthcare, hospitality,
            agribusiness, retail, and public institutions.
          </p>
        </div>
      </section>

      <div className={styles.contain}>
        <div className={styles.contactGrid}>
          <div className={styles.contactPanel}>
            <div className={styles.contactPanelTop}>
              <span className={styles.contactChip}>e-CUNGA support desk</span>
              <h2 className={styles.contactPanelTitle}>Let&apos;s design your inventory workflow together.</h2>
              <p className={styles.contactPanelCopy}>
                We help teams roll out stock automation, approval channels, finance visibility, and supplier document
                flow inside one controlled workspace.
              </p>
            </div>

            <div className={styles.contactInfoCard}>
              <div className={styles.contactBlock}>
                <div className={`${styles.contactIconBox} ${styles.contactIconMail}`}>
                  <MailIcon />
                </div>
                <div className={styles.contactBlockBody}>
                  <p className={styles.contactLabel}>Direct Support</p>
                  <a href="mailto:hello@ecunga.com" className={styles.contactValue}>
                    concierge@e-cunga.tech
                  </a>
                  <p className={styles.contactMuted}>Response within 2 hours</p>
                </div>
              </div>
              <div className={styles.contactBlock}>
                <div className={`${styles.contactIconBox} ${styles.contactIconPhone}`}>
                  <PhoneIcon />
                </div>
                <div className={styles.contactBlockBody}>
                  <p className={styles.contactLabel}>Global Headquarters</p>
                  <p className={styles.contactValue}>+250 788 000 000</p>
                  <p className={styles.contactMuted}>Mon-Fri, 8am - 6pm CAT</p>
                </div>
              </div>
              <div className={styles.contactBlock}>
                <div className={`${styles.contactIconBox} ${styles.contactIconPin}`}>
                  <PinIcon />
                </div>
                <div className={styles.contactBlockBody}>
                  <p className={styles.contactLabel}>Curation Center</p>
                  <p className={styles.contactValue}>Kigali Innovation City, Kigali</p>
                  <p className={styles.contactMuted}>Remote demos and guided rollout sessions.</p>
                </div>
              </div>
            </div>

            <div className={styles.mapCard}>
              <div className={styles.mapStub} role="img" aria-label="Map location placeholder" />
              <div className={styles.mapMeta}>
                <strong>Kigali operations hub</strong>
                <span>Remote demos, guided onboarding, and rollout consultations.</span>
              </div>
            </div>

            <div className={styles.backHomeRow} style={{ justifyContent: 'flex-start', marginTop: '1.2rem' }}>
              <Link to="/" className={styles.backHomeBtn}>
                ← Back to home
              </Link>
            </div>
          </div>

          <div className={styles.formWrap}>
            <div className={styles.formIntro}>
              <span className={styles.formKicker}>Request a conversation</span>
              <h2 className={styles.formTitle}>Send a Message</h2>
              <p className={styles.formLead}>
                Share your inventory challenge and the e-CUNGA team will respond with the right next step.
              </p>
            </div>

            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className={styles.formRow2}>
                <label className={styles.field}>
                  First name
                  <input type="text" name="firstName" required className={styles.input} placeholder="Aline" />
                </label>
                <label className={styles.field}>
                  Last name
                  <input type="text" name="lastName" required className={styles.input} placeholder="Uwimana" />
                </label>
              </div>
              <label className={styles.field}>
                Work email
                <input type="email" name="email" required className={styles.input} placeholder="hello@company.com" />
              </label>
              <label className={styles.field}>
                Institution type
                <select name="industry" className={styles.select}>
                  <option>Healthcare</option>
                  <option>Hotel / hospitality</option>
                  <option>Retail &amp; wholesale</option>
                  <option>Industry / manufacturing</option>
                  <option>Agribusiness</option>
                  <option>Government / NGO</option>
                  <option>Other</option>
                </select>
              </label>
              <label className={styles.field}>
                Message
                <textarea
                  name="message"
                  rows={4}
                  className={styles.textarea}
                  placeholder="Tell us about your stock control challenge, workflow, or demo request."
                />
              </label>
              <button type="submit" className={styles.btnSolid}>
                Send a Message
              </button>
            </form>
            <div className={styles.formFooter}>
              <div className={styles.formSocialProof}>
                <div className={styles.avatarStack} aria-hidden>
                  <span className={styles.avatarDot} />
                  <span className={styles.avatarDot} />
                  <span className={styles.avatarDot} />
                </div>
                <span>Joined by 2,000+ logistics leaders</span>
              </div>
              <div className={styles.formFooterActions}>
                <a href="https://ecunga.com" className={styles.formFooterBtn} aria-label="Visit e-CUNGA website">
                  <GlobeIcon />
                </a>
                <button type="button" className={styles.formFooterBtn} aria-label="Share contact page">
                  <ShareIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
