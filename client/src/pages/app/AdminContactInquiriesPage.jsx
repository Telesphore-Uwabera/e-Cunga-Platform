import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import ListPageControls from '../../components/ListPageControls.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import ui from './DashboardUi.module.css';

function ContactDetailModal({ isOpen, inquiry, onClose, onDelete }) {
  if (!isOpen || !inquiry) return null;

  return (
    <div className={ui.modalOverlay} onClick={onClose}>
      <div 
        className={ui.modalCard} 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '680px', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className={ui.modalHead}>
          <h2 className={ui.modalTitle}>Contact Inquiry Details</h2>
          <button type="button" className={ui.modalClose} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={ui.modalBody} style={{ padding: '2rem' }}>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.8rem', 
                  color: '#64748b', 
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: '600'
                }}>
                  First Name
                </label>
                <p style={{ margin: 0, fontWeight: '500', fontSize: '1rem', color: '#1e293b' }}>
                  {inquiry.firstName}
                </p>
              </div>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.8rem', 
                  color: '#64748b', 
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: '600'
                }}>
                  Last Name
                </label>
                <p style={{ margin: 0, fontWeight: '500', fontSize: '1rem', color: '#1e293b' }}>
                  {inquiry.lastName}
                </p>
              </div>
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.8rem', 
                color: '#64748b', 
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '600'
              }}>
                Email Address
              </label>
              <a 
                href={`mailto:${inquiry.email}`} 
                style={{ 
                  color: 'var(--ec-primary, #692751)', 
                  fontSize: '1rem',
                  fontWeight: '500',
                  textDecoration: 'none'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                {inquiry.email}
              </a>
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.8rem', 
                color: '#64748b', 
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '600'
              }}>
                Industry/Sector
              </label>
              <p style={{ 
                margin: 0, 
                fontSize: '1rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                display: 'inline-block',
                color: '#475569'
              }}>
                {inquiry.industry || 'Not specified'}
              </p>
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.8rem', 
                color: '#64748b', 
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '600'
              }}>
                Message
              </label>
              <div style={{ 
                margin: 0, 
                lineHeight: '1.7', 
                whiteSpace: 'pre-wrap',
                padding: '1rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.95rem',
                color: '#334155'
              }}>
                {inquiry.message}
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              paddingTop: '1rem',
              borderTop: '1px solid #e2e8f0'
            }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.75rem', 
                  color: '#94a3b8', 
                  marginBottom: '0.25rem'
                }}>
                  Submitted
                </label>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', fontWeight: '500' }}>
                  {new Date(inquiry.createdAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.75rem', 
                  color: '#94a3b8', 
                  marginBottom: '0.25rem'
                }}>
                  Inquiry ID
                </label>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.85rem', 
                  color: '#94a3b8',
                  fontFamily: 'monospace'
                }}>
                  {inquiry._id.slice(-8)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className={ui.modalFooter} style={{ 
          padding: '1.25rem 2rem', 
          display: 'flex', 
          gap: '0.75rem',
          justifyContent: 'flex-end',
          borderTop: '1px solid #e2e8f0'
        }}>
          <button 
            type="button" 
            className={ui.modalBtnGhost} 
            onClick={onClose}
            style={{
              padding: '0.65rem 1.25rem',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              color: '#64748b'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#f8fafc'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Close
          </button>
          <button 
            type="button" 
            className={ui.modalBtnDanger} 
            onClick={() => {
              onDelete(inquiry);
              onClose();
            }}
            style={{
              padding: '0.65rem 1.25rem',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
          >
            Delete Inquiry
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminContactInquiries() {
  const { t } = useI18n();
  const { flash, FlashBanner } = useFlash();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [deletingInquiry, setDeletingInquiry] = useState(null);

  useEffect(() => {
    loadInquiries();
  }, []);

  async function loadInquiries() {
    try {
      setLoading(true);
      const data = await apiFetch('/admin/contact-inquiries?limit=100');
      setInquiries(data.inquiries || []);
    } catch (err) {
      flash(err?.message || 'Could not load contact inquiries.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(inquiry) {
    try {
      await apiFetch(`/admin/contact-inquiries/${inquiry._id}`, { method: 'DELETE' });
      flash('Contact inquiry deleted successfully.', 'ok');
      loadInquiries();
    } catch (err) {
      flash(err?.message || 'Could not delete inquiry.', 'error');
    }
  }

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inquiry) => {
      const matchesSearch = 
        !search || 
        inquiry.firstName.toLowerCase().includes(search.toLowerCase()) ||
        inquiry.lastName.toLowerCase().includes(search.toLowerCase()) ||
        inquiry.email.toLowerCase().includes(search.toLowerCase()) ||
        inquiry.message.toLowerCase().includes(search.toLowerCase());
      
      const matchesIndustry = 
        industryFilter === 'all' || 
        inquiry.industry === industryFilter;

      return matchesSearch && matchesIndustry;
    });
  }, [inquiries, search, industryFilter]);

  const pager = usePagedList(filteredInquiries, { pageSize: 20, resetKey: filteredInquiries.length });

  return (
    <div className={ui.adminPage}>
      <FlashBanner />
      
      <ConfirmModal
        isOpen={Boolean(deletingInquiry)}
        title="Delete Contact Inquiry"
        message={`Delete inquiry from ${deletingInquiry?.firstName} ${deletingInquiry?.lastName}?`}
        confirmText="Delete"
        onConfirm={async () => {
          await handleDelete(deletingInquiry);
          setDeletingInquiry(null);
        }}
        onClose={() => setDeletingInquiry(null)}
      />

      <ContactDetailModal
        isOpen={Boolean(selectedInquiry)}
        inquiry={selectedInquiry}
        onClose={() => setSelectedInquiry(null)}
        onDelete={setDeletingInquiry}
      />

      <div className={ui.adminPageHead}>
        <div>
          <h1 className={ui.adminTitle}>Contact Inquiries</h1>
          <p className={ui.adminLead}>Manage and respond to website contact form submissions</p>
        </div>
      </div>

      <div style={{ 
        padding: '1rem 1.25rem', 
        backgroundColor: '#dbeafe', 
        border: '1px solid #93c5fd',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af', lineHeight: '1.5' }}>
          <strong>Automatic Confirmation:</strong> When someone submits a contact form, they automatically receive a confirmation email letting them know we'll reach out soon.
        </p>
      </div>

      <div className={ui.adminControls}>
        <input
          type="search"
          placeholder="Search inquiries..."
          className={ui.adminSearchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={ui.adminUsersSelect}
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
        >
          <option value="all">All Industries</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Hotel / hospitality">Hotel / hospitality</option>
          <option value="Retail & wholesale">Retail & wholesale</option>
          <option value="Industry / manufacturing">Industry / manufacturing</option>
          <option value="Agribusiness">Agribusiness</option>
          <option value="Government / NGO">Government / NGO</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {loading ? (
        <div className={ui.adminEmpty}>Loading contact inquiries...</div>
      ) : filteredInquiries.length === 0 ? (
        <div className={ui.adminEmpty}>
          {search || industryFilter !== 'all' ? 'No inquiries match your filters.' : 'No contact inquiries yet.'}
        </div>
      ) : (
        <>
          <div className={ui.adminUsersTableWrap}>
            <div className={ui.adminUsersTableHead}>
              <span>Name</span>
              <span>Email</span>
              <span>Industry</span>
              <span>Message Preview</span>
              <span>Date</span>
              <span>Actions</span>
            </div>
            <div className={ui.adminUsersRows}>
              {pager.pageSlice.map((inquiry) => (
                <article key={inquiry._id} className={ui.adminUsersRow}>
                  <div>
                    <p className={ui.adminUsersRowName}>{inquiry.firstName} {inquiry.lastName}</p>
                  </div>
                  <div>
                    <a href={`mailto:${inquiry.email}`} style={{ color: 'var(--ec-primary, #692751)', fontSize: '0.9rem' }}>
                      {inquiry.email}
                    </a>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.9rem' }}>{inquiry.industry || '—'}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                      {inquiry.message}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {new Date(inquiry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className={ui.adminUsersRowBtn}
                      onClick={() => window.location.href = `mailto:${inquiry.email}?subject=Re: Your inquiry to e-Cunga Portal`}
                      title="Send Email"
                      style={{ 
                        backgroundColor: '#0ea5e9', 
                        color: '#ffffff',
                        padding: '0.5rem 0.85rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      ✉ Email
                    </button>
                    <button
                      type="button"
                      className={ui.adminUsersRowBtn}
                      onClick={() => setSelectedInquiry(inquiry)}
                      title="View Details"
                      style={{
                        padding: '0.5rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        color: '#475569'
                      }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={ui.adminUsersRowBtn}
                      onClick={() => setDeletingInquiry(inquiry)}
                      title="Delete"
                      style={{ 
                        padding: '0.5rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        color: '#ef4444'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <ListPageControls
            variant="table"
            rangeFrom={pager.rangeFrom}
            rangeTo={pager.rangeTo}
            total={pager.total}
            page={pager.page}
            pageCount={pager.pageCount}
            pagerNums={pager.pagerNums}
            onPrev={pager.goPrev}
            onNext={pager.goNext}
            onSelectPage={pager.setPage}
            canPrev={pager.canPrev}
            canNext={pager.canNext}
          />
        </>
      )}
    </div>
  );
}
