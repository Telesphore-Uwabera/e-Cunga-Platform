import { Link } from 'react-router-dom';
import '../theme.css';
import styles from './MarketingPages.module.css';

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <div className={styles.contain}>
        <h1 className={styles.contactTitle}>Connect with the e-CUNGA Team</h1>
        <p className={styles.heroSub} style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          Reach out for demos, onboarding, workflow setup, or enterprise support for healthcare, hospitality,
          agribusiness, retail, and public institutions.
        </p>
        <div className={styles.contactGrid}>
          <div>
            <div className={styles.contactBlock}>
              <p className={styles.contactLabel}>Email support</p>
              <a href="mailto:hello@ecunga.com" className={styles.contactValue}>
                hello@ecunga.com
              </a>
            </div>
            <div className={styles.contactBlock}>
              <p className={styles.contactLabel}>Operations base</p>
              <p className={styles.contactValue}>Kigali, Rwanda</p>
              <p className={styles.contactMuted}>Project demos and onboarding are coordinated online.</p>
            </div>
            <div className={styles.contactBlock}>
              <p className={styles.contactLabel}>Workflow support</p>
              <p className={styles.contactValue}>Talk to us about stock automation, expiry control, reporting, and role-based rollout.</p>
            </div>
            <div className={styles.mapStub} role="img" aria-label="Map location placeholder" />
            <p style={{ marginTop: '1.5rem' }}>
              <Link to="/">← Back to home</Link>
            </p>
          </div>
          <div className={styles.formWrap}>
            <h2 className={styles.formTitle}>Send a Message</h2>
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className={styles.formRow2}>
                <label className={styles.field}>
                  First name
                  <input type="text" name="firstName" required className={styles.input} />
                </label>
                <label className={styles.field}>
                  Last name
                  <input type="text" name="lastName" required className={styles.input} />
                </label>
              </div>
              <label className={styles.field}>
                Work email
                <input type="email" name="email" required className={styles.input} />
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
          </div>
        </div>
      </div>
    </div>
  );
}
