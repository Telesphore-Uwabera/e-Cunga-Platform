import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getToken, resolveApiUrl } from '../../api/client.js';
import { useFlash } from '../../context/FlashContext.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import ui from './DashboardUi.module.css';

const EMPTY_FORM = {
  name: '',
  websiteUrl: '',
  logoUrl: '',
  sortOrder: 0,
  isActive: true,
};

async function uploadPartnerLogo(file) {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(resolveApiUrl('/admin/trusted-partners/upload'), {
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

export function AdminTrustedPartners() {
  const { flash, FlashBanner } = useFlash();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadPartners = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/admin/trusted-partners');
      setPartners(data.partners || []);
    } catch (err) {
      flash(err?.message || 'Could not load trusted partners.', 'error');
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(partner) {
    setEditingId(partner.id);
    setForm({
      name: partner.name || '',
      websiteUrl: partner.websiteUrl || '',
      logoUrl: partner.logoUrl || '',
      sortOrder: partner.sortOrder ?? 0,
      isActive: partner.isActive !== false,
    });
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const data = await uploadPartnerLogo(file);
      setForm((prev) => ({ ...prev, logoUrl: data.url || '' }));
      flash('Logo uploaded.', 'ok');
    } catch (err) {
      flash(err?.message || 'Could not upload logo.', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      websiteUrl: form.websiteUrl.trim(),
      logoUrl: form.logoUrl.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    if (!payload.name) {
      flash('Partner name is required.', 'error');
      return;
    }
    if (!payload.logoUrl) {
      flash('Upload a logo before saving.', 'error');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await apiFetch(`/admin/trusted-partners/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        flash('Partner updated.', 'ok');
      } else {
        await apiFetch('/admin/trusted-partners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        flash('Partner added.', 'ok');
      }
      resetForm();
      await loadPartners();
    } catch (err) {
      flash(err?.message || 'Could not save partner.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/admin/trusted-partners/${id}`, { method: 'DELETE' });
      flash('Partner removed.', 'ok');
      if (editingId === id) resetForm();
      setConfirmDelete(null);
      await loadPartners();
    } catch (err) {
      flash(err?.message || 'Could not delete partner.', 'error');
    }
  }

  return (
    <div className={ui.adminPage}>
      <FlashBanner />

      <div className={ui.adminPageHead}>
        <div>
          <h1 className={ui.adminTitle}>Trusted partners</h1>
          <p className={ui.adminLead}>
            Manage company logos shown on the homepage marquee. Logos are stored on Cloudinary.
          </p>
        </div>
      </div>

      <section className={ui.adminSettingsCard} style={{ marginBottom: '2rem' }}>
        <div className={ui.adminSettingsSectionHead}>
          <h2 className={ui.adminSettingsSectionTitle}>{editingId ? 'Edit partner' : 'Add partner'}</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={ui.adminSettingsFormGrid}>
            <label className={ui.adminSettingsField}>
              <span>Company name</span>
              <input
                className={ui.adminSettingsInput}
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Labscroll Medicals"
                maxLength={120}
                required
              />
            </label>

            <label className={ui.adminSettingsField}>
              <span>Website URL</span>
              <input
                className={ui.adminSettingsInput}
                type="url"
                value={form.websiteUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
                placeholder="https://example.com"
              />
            </label>

            <label className={ui.adminSettingsField}>
              <span>Display order</span>
              <input
                className={ui.adminSettingsInput}
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                min={0}
              />
            </label>

            <label className={ui.adminSettingsField} style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <span>Show on homepage</span>
            </label>

            <div className={ui.adminSettingsField} style={{ gridColumn: '1 / -1' }}>
              <span>Logo</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                <label className={ui.adminPrimaryBtn} style={{ cursor: uploading ? 'wait' : 'pointer', display: 'inline-block' }}>
                  {uploading ? 'Uploading…' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Partner logo preview"
                    style={{ height: 40, maxWidth: 160, objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No logo uploaded yet.</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '1.25rem' }}>
            <button type="submit" className={ui.adminPrimaryBtn} disabled={saving || uploading}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add partner'}
            </button>
            {editingId ? (
              <button type="button" className={ui.adminUsersRowBtn} onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className={ui.adminSettingsCard}>
        <div className={ui.adminSettingsSectionHead}>
          <h2 className={ui.adminSettingsSectionTitle}>Current partners</h2>
        </div>

        {loading ? (
          <div className={ui.adminEmpty}>Loading…</div>
        ) : partners.length === 0 ? (
          <div className={ui.adminEmpty}>No partners yet. Add one above.</div>
        ) : (
          <div className={ui.adminUsersTableWrap}>
            <div className={ui.adminUsersTableHead}>
              <span>Logo</span>
              <span>Name</span>
              <span>Website</span>
              <span>Order</span>
              <span>Status</span>
              <span aria-hidden="true" />
            </div>
            <div className={ui.adminUsersRows}>
              {partners.map((partner) => (
                <article key={partner.id} className={ui.adminUsersRow}>
                  <div>
                    <img
                      src={partner.logoUrl}
                      alt=""
                      style={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
                    />
                  </div>
                  <div>{partner.name}</div>
                  <div style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>
                    {partner.websiteUrl ? (
                      <a href={partner.websiteUrl} target="_blank" rel="noreferrer">
                        {partner.websiteUrl}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div>{partner.sortOrder ?? 0}</div>
                  <div>{partner.isActive ? 'Active' : 'Hidden'}</div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className={ui.adminUsersRowBtn} onClick={() => startEdit(partner)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={ui.adminUsersRowBtn}
                      style={{ color: '#ef4444' }}
                      onClick={() => setConfirmDelete(partner)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        title="Remove partner?"
        message={confirmDelete ? `Remove "${confirmDelete.name}" from the homepage?` : ''}
        confirmText="Remove"
        onConfirm={() => handleDelete(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
