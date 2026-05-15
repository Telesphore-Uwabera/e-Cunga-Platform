import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import '../theme.css';
import styles from './MarketingPages.module.css';

export default function SupplierRegisterPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [formStatus, setFormStatus] = useState('idle');
  const [formMessage, setFormMessage] = useState('');
  const [formData, setFormData] = useState({
    companyName: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    industry: 'Supplier',
    phone: '',
    location: 'Rwanda',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setFormStatus('submitting');
    setFormMessage('');

    if (formData.password !== formData.confirmPassword) {
      setFormStatus('error');
      setFormMessage('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setFormStatus('error');
      setFormMessage('Password must be at least 8 characters long');
      return;
    }

    try {
      const response = await apiFetch('/auth/register-supplier', {
        method: 'POST',
        body: JSON.stringify({
          companyName: formData.companyName,
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          industry: formData.industry,
          phone: formData.phone,
          location: formData.location,
        }),
      });

      if (response.requiresApproval === false) {
        setFormStatus('success');
        setFormMessage('Supplier account created successfully! You can now log in.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setFormStatus('success');
        setFormMessage(response.message || 'Registration submitted successfully!');
      }
    } catch (err) {
      setFormStatus('error');
      setFormMessage(err?.message || 'Registration failed. Please try again.');
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroBandPrimary}>
        <div className={styles.containNarrow}>
          <p className={styles.contactEyebrow}>Supplier Registration</p>
          <h1 className={styles.contactTitle}>Join Our Supplier Network</h1>
          <p className={styles.heroSub} style={{ textAlign: 'center' }}>
            Register your supplier company to connect with healthcare facilities and grow your business
          </p>
        </div>
      </section>

      <div className={styles.contain}>
        <div className={styles.contactGrid}>
          <div className={styles.contactPanel}>
            <div className={styles.contactPanelTop}>
              <span className={styles.contactChip}>Why Join?</span>
              <h2 className={styles.contactPanelTitle}>Connect with Healthcare Providers</h2>
              <p className={styles.contactPanelCopy}>
                Join our platform to reach healthcare facilities, hospitals, and clinics looking for reliable suppliers.
              </p>
            </div>

            <div className={styles.contactInfoCard}>
              <div className={styles.contactBlock}>
                <h3 className={styles.contactLabel}>Benefits</h3>
                <ul className={styles.contactValue} style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>Access to verified healthcare buyers</li>
                  <li style={{ marginBottom: '0.5rem' }}>Streamlined procurement process</li>
                  <li style={{ marginBottom: '0.5rem' }}>Secure payment processing</li>
                  <li style={{ marginBottom: '0.5rem' }}>Real-time order tracking</li>
                  <li>Professional business profile</li>
                </ul>
              </div>
            </div>

            <div className={styles.backHomeRow} style={{ justifyContent: 'flex-start', marginTop: '1.2rem' }}>
              <Link to="/" className={styles.backHomeBtn}>
                Back to Home
              </Link>
            </div>
          </div>

          <div className={styles.formWrap}>
            <div className={styles.formIntro}>
              <span className={styles.formKicker}>Register Your Company</span>
              <h2 className={styles.formTitle}>Create Supplier Account</h2>
              <p className={styles.formLead}>
                Fill in your company details to get started with our supplier platform
              </p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                Company Name
                <input 
                  type="text" 
                  name="companyName" 
                  required 
                  className={styles.input} 
                  placeholder="Your Company Ltd."
                  value={formData.companyName}
                  onChange={handleInputChange}
                />
              </label>

              <div className={styles.formRow2}>
                <label className={styles.field}>
                  Your Full Name
                  <input 
                    type="text" 
                    name="fullName" 
                    required 
                    className={styles.input} 
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleInputChange}
                  />
                </label>
                <label className={styles.field}>
                  Email or Phone Number
                  <input 
                    type="text" 
                    name="email" 
                    required 
                    className={styles.input} 
                    placeholder="contact@company.com or +250..."
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </label>
              </div>

              <div className={styles.formRow2}>
                <label className={styles.field}>
                  Password
                  <input 
                    type="password" 
                    name="password" 
                    required 
                    className={styles.input} 
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </label>
                <label className={styles.field}>
                  Confirm Password
                  <input 
                    type="password" 
                    name="confirmPassword" 
                    required 
                    className={styles.input} 
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </label>
              </div>

              <label className={styles.field}>
                Industry Category
                <select 
                  name="industry" 
                  className={styles.select}
                  value={formData.industry}
                  onChange={handleInputChange}
                  required
                >
                  <option value="Supplier">General Supplier</option>
                  <option value="Medical Equipment">Medical Equipment</option>
                  <option value="Pharmaceuticals">Pharmaceuticals</option>
                  <option value="Laboratory Supplies">Laboratory Supplies</option>
                  <option value="Surgical Supplies">Surgical Supplies</option>
                  <option value="Hospital Furniture">Hospital Furniture</option>
                  <option value="Disposables">Disposables</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <div className={styles.formRow2}>
                <label className={styles.field}>
                  Phone Number
                  <input 
                    type="tel" 
                    name="phone" 
                    className={styles.input} 
                    placeholder="+250 7xx xxx xxx"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                  />
                </label>
                <label className={styles.field}>
                  Location
                  <input 
                    type="text" 
                    name="location" 
                    className={styles.input} 
                    placeholder="Kigali, Rwanda"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                  />
                </label>
              </div>

              {formMessage ? (
                <p
                  className={styles.formLead}
                  style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    color: formStatus === 'error' ? '#b91c1c' : 'var(--ec-primary, #692751)',
                  }}
                  role="status"
                >
                  {formMessage}
                </p>
              ) : null}

              <button 
                type="submit" 
                className={styles.btnSolid} 
                disabled={formStatus === 'submitting'}
              >
                {formStatus === 'submitting' ? 'Creating Account...' : 'Create Supplier Account'}
              </button>
            </form>

            <div className={styles.formFooter}>
              <p style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                Already have an account? <Link to="/login" style={{ color: 'var(--ec-primary, #692751)' }}>Sign In</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
