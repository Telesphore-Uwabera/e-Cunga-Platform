import { useState, useEffect, useCallback } from 'react';
import { apiFetch, getToken, resolveApiUrl } from '../../api/client.js';
import { useFlash } from '../../context/FlashContext.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import ui from './DashboardUi.module.css';

const MAX_ATTACHMENTS = 3;

async function uploadCampaignFile(file, kind) {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', kind);

  const res = await fetch(resolveApiUrl('/admin/news-campaigns/upload'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid response' };
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Upload failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

export function AdminNewsCampaigns() {
  const { flash, FlashBanner } = useFlash();

  const [subject, setSubject] = useState('');
  const [headline, setHeadline] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [audienceStats, setAudienceStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const loadAudience = useCallback(async () => {
    try {
      const data = await apiFetch('/admin/news-campaigns/audience');
      setAudienceStats(data.stats || null);
    } catch (err) {
      flash(err?.message || 'Could not load audience stats.', 'error');
    }
  }, [flash]);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await apiFetch('/admin/news-campaigns?limit=20');
      setCampaigns(data.campaigns || []);
    } catch (err) {
      flash(err?.message || 'Could not load campaign history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  }, [flash]);

  useEffect(() => {
    loadAudience();
    loadCampaigns();
  }, [loadAudience, loadCampaigns]);

  const campaignPayload = {
    subject: subject.trim(),
    headline: headline.trim(),
    bodyHtml: bodyHtml.trim(),
    bodyText: bodyHtml.trim(),
    heroImageUrl: heroImageUrl.trim(),
    attachments,
  };

  function validateForm() {
    if (!campaignPayload.subject || !campaignPayload.headline || !campaignPayload.bodyHtml) {
      flash('Subject, headline, and body are required.', 'error');
      return false;
    }
    return true;
  }

  async function handleHeroUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingHero(true);
      const data = await uploadCampaignFile(file, 'hero');
      setHeroImageUrl(data.url || '');
      flash('Hero image uploaded.', 'ok');
    } catch (err) {
      flash(err?.message || 'Could not upload hero image.', 'error');
    } finally {
      setUploadingHero(false);
      e.target.value = '';
    }
  }

  async function handleAttachmentUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (attachments.length >= MAX_ATTACHMENTS) {
      flash(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`, 'error');
      e.target.value = '';
      return;
    }
    try {
      setUploadingAttachment(true);
      const data = await uploadCampaignFile(file, 'attachment');
      setAttachments((prev) => [
        ...prev,
        {
          filename: data.filename || file.name,
          url: data.url,
          contentType: data.contentType || file.type,
          size: data.size || file.size,
        },
      ]);
      flash('Attachment uploaded.', 'ok');
    } catch (err) {
      flash(err?.message || 'Could not upload attachment.', 'error');
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePreview() {
    if (!validateForm()) return;
    try {
      setPreviewing(true);
      const data = await apiFetch('/admin/news-campaigns/preview', {
        method: 'POST',
        body: JSON.stringify(campaignPayload),
      });
      flash(data.message || 'Preview sent to your email.', 'ok');
    } catch (err) {
      flash(err?.message || 'Could not send preview.', 'error');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    if (!validateForm()) return;
    try {
      setSending(true);
      await apiFetch('/admin/news-campaigns', {
        method: 'POST',
        body: JSON.stringify({ ...campaignPayload, sendNow: true }),
      });
      flash('Campaign send started. Recipients will receive emails shortly.', 'ok');
      setSubject('');
      setHeadline('');
      setBodyHtml('');
      setHeroImageUrl('');
      setAttachments([]);
      setConfirmSend(false);
      loadCampaigns();
      loadAudience();
    } catch (err) {
      flash(err?.message || 'Could not start campaign send.', 'error');
    } finally {
      setSending(false);
    }
  }

  const stats = audienceStats || {
    total: 0,
    newsletterTotal: 0,
    portalTotal: 0,
    both: 0,
  };

  return (
    <div className={ui.adminPage}>
      <FlashBanner />

      <ConfirmModal
        isOpen={confirmSend}
        title="Send news email to all recipients?"
        message={`This will send "${subject.trim()}" to ${stats.total.toLocaleString()} unique recipients (newsletter subscribers and portal users). This cannot be undone.`}
        confirmText="Send to all"
        isBusy={sending}
        onConfirm={handleSend}
        onClose={() => !sending && setConfirmSend(false)}
      />

      <div className={ui.adminPageHead}>
        <div>
          <h1 className={ui.adminTitle}>News Campaigns</h1>
          <p className={ui.adminLead}>
            Compose and send news updates with images and attachments to all newsletter subscribers and portal users.
          </p>
        </div>
      </div>

      <div className={ui.adminSummaryGrid} style={{ marginBottom: '1.5rem' }}>
        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Total recipients</p>
          <strong className={ui.adminSummaryValue}>{stats.total.toLocaleString()}</strong>
          <span className={ui.adminSummaryMeta}>Deduplicated by email</span>
        </article>
        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Newsletter subscribers</p>
          <strong className={ui.adminSummaryValue}>{stats.newsletterTotal.toLocaleString()}</strong>
          <span className={ui.adminSummaryMeta}>Active footer sign-ups</span>
        </article>
        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Portal users</p>
          <strong className={ui.adminSummaryValue}>{stats.portalTotal.toLocaleString()}</strong>
          <span className={ui.adminSummaryMeta}>Active accounts</span>
        </article>
      </div>

      <section className={ui.adminSettingsCard} style={{ marginBottom: '2rem' }}>
        <div className={ui.adminSettingsSectionHead}>
          <h2 className={ui.adminSettingsSectionTitle}>Compose campaign</h2>
        </div>

        <div className={ui.adminSettingsFormGrid}>
          <label className={ui.adminSettingsField}>
            <span>Email subject</span>
            <input
              className={ui.adminSettingsInput}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. New features this month"
              maxLength={200}
            />
          </label>
          <label className={ui.adminSettingsField}>
            <span>Headline</span>
            <input
              className={ui.adminSettingsInput}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Main title shown in the email"
              maxLength={200}
            />
          </label>
          <label className={`${ui.adminSettingsField} ${ui.adminSettingsFieldWide}`}>
            <span>Body content</span>
            <textarea
              className={ui.adminSettingsTextarea}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={10}
              placeholder="Write your news update here. Plain text is supported; line breaks are preserved."
            />
          </label>
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>Hero image (inline)</p>
            {heroImageUrl ? (
              <div style={{ marginBottom: '0.75rem' }}>
                <img
                  src={heroImageUrl}
                  alt="Hero preview"
                  style={{ maxWidth: '280px', maxHeight: '160px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  className={ui.adminUsersRowBtn}
                  style={{ display: 'block', marginTop: '0.5rem', color: '#ef4444' }}
                  onClick={() => setHeroImageUrl('')}
                >
                  Remove image
                </button>
              </div>
            ) : null}
            <label className={ui.adminPrimaryBtn} style={{ cursor: 'pointer', display: 'inline-block' }}>
              {uploadingHero ? 'Uploading...' : 'Upload hero image'}
              <input type="file" accept="image/*" hidden onChange={handleHeroUpload} disabled={uploadingHero} />
            </label>
          </div>

          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>
              Attachments ({attachments.length}/{MAX_ATTACHMENTS})
            </p>
            {attachments.length > 0 && (
              <ul style={{ margin: '0 0 0.75rem', padding: 0, listStyle: 'none' }}>
                {attachments.map((att, i) => (
                  <li key={`${att.url}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                    <span>{att.filename}</span>
                    <button type="button" className={ui.adminUsersRowBtn} style={{ color: '#ef4444' }} onClick={() => removeAttachment(i)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label
              className={ui.adminPrimaryBtn}
              style={{
                cursor: attachments.length >= MAX_ATTACHMENTS ? 'not-allowed' : 'pointer',
                display: 'inline-block',
                opacity: attachments.length >= MAX_ATTACHMENTS ? 0.6 : 1,
              }}
            >
              {uploadingAttachment ? 'Uploading...' : 'Add attachment'}
              <input
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={handleAttachmentUpload}
                disabled={uploadingAttachment || attachments.length >= MAX_ATTACHMENTS}
              />
            </label>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>Images or PDF, max 5 MB each</p>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button type="button" className={ui.adminPrimaryBtn} onClick={handlePreview} disabled={previewing || sending}>
            {previewing ? 'Sending preview...' : 'Send preview to me'}
          </button>
          <button
            type="button"
            className={ui.adminPrimaryBtn}
            onClick={() => validateForm() && setConfirmSend(true)}
            disabled={previewing || sending || stats.total === 0}
          >
            {sending ? 'Starting send...' : `Send to all (${stats.total.toLocaleString()})`}
          </button>
        </div>
      </section>

      <section>
        <div className={ui.adminPageHead} style={{ marginBottom: '1rem' }}>
          <h2 className={ui.adminTitle} style={{ fontSize: '1.25rem' }}>Campaign history</h2>
        </div>

        {loadingHistory ? (
          <div className={ui.adminEmpty}>Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className={ui.adminEmpty}>No campaigns sent yet.</div>
        ) : (
          <div className={ui.adminUsersTableWrap}>
            <div className={ui.adminUsersTableHead}>
              <span>Subject</span>
              <span>Status</span>
              <span>Recipients</span>
              <span>Success / Failed</span>
              <span>Sent</span>
            </div>
            <div className={ui.adminUsersRows}>
              {campaigns.map((c) => (
                <article key={c._id} className={ui.adminUsersRow}>
                  <div>
                    <strong>{c.subject}</strong>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{c.headline}</div>
                  </div>
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        backgroundColor:
                          c.status === 'sent' ? '#dcfce7'
                          : c.status === 'sending' ? '#fef3c7'
                          : c.status === 'failed' ? '#fee2e2'
                          : '#f1f5f9',
                        color:
                          c.status === 'sent' ? '#166534'
                          : c.status === 'sending' ? '#92400e'
                          : c.status === 'failed' ? '#991b1b'
                          : '#475569',
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div>{c.recipientCount?.toLocaleString() ?? '—'}</div>
                  <div>
                    {c.successCount ?? 0} / {c.failureCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                    {c.sentAt ? new Date(c.sentAt).toLocaleString() : c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
