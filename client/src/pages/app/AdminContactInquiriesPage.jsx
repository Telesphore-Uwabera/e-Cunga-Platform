import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiFetch, apiUploadMedia } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { usePortalData } from '../../context/PortalStateContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import ListPageControls from '../../components/ListPageControls.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import ui from './DashboardUi.module.css';

// ─── Rich Text Editor Toolbar ─────────────────────────────────────────────────
const FONT_SIZES  = ['10', '11', '12', '13', '14', '16', '18', '20', '24', '28', '32', '36', '48'];
const FONT_FACES  = ['Default', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS'];
const HEADING_MAP = { 'p': 'Normal', 'h1': 'Heading 1', 'h2': 'Heading 2', 'h3': 'Heading 3', 'h4': 'Heading 4' };

function ToolbarBtn({ title, active, onClick, children, danger }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(e); }}
      style={{
        border: active ? '1px solid #692751' : '1px solid transparent',
        borderRadius: '4px',
        padding: '3px 6px',
        background: active ? '#f3e8ee' : 'transparent',
        color: danger ? '#ef4444' : active ? '#692751' : '#374151',
        cursor: 'pointer',
        fontSize: '0.82rem',
        fontWeight: '600',
        minWidth: '26px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <span style={{ width: '1px', background: '#e2e8f0', alignSelf: 'stretch', margin: '0 3px' }} />;
}

function ToolbarSelect({ value, onChange, options, width = '90px', title }) {
  return (
    <select
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '4px',
        padding: '2px 4px',
        fontSize: '0.78rem',
        background: '#fff',
        color: '#374151',
        cursor: 'pointer',
        width,
        height: '26px',
      }}
    >
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

// Colour palette
const COLOURS = [
  '#000000','#374151','#6b7280','#9ca3af','#ffffff',
  '#dc2626','#ea580c','#d97706','#16a34a','#2563eb','#7c3aed','#692751',
  '#fecaca','#fed7aa','#fef08a','#bbf7d0','#bfdbfe','#ddd6fe','#f3e8ee',
];

function ColourPicker({ onPick, title }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title={title}
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        style={{
          border: '1px solid transparent', borderRadius: '4px', padding: '3px 5px',
          background: 'transparent', cursor: 'pointer', fontSize: '0.78rem',
          display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#374151',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>A</span>
        <span style={{ fontSize: '0.6rem' }}>▼</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 999,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px',
            padding: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            display: 'grid', gridTemplateColumns: 'repeat(5, 20px)', gap: '3px',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onMouseDown={(e) => { e.preventDefault(); onPick(c); setOpen(false); }}
              style={{
                width: '20px', height: '20px', borderRadius: '3px',
                background: c, border: '1px solid rgba(0,0,0,0.15)',
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── The full Reply Modal ──────────────────────────────────────────────────────
function ReplyModal({ inquiry, onClose, onSent }) {
  const { state } = usePortalData();
  const { user }  = useAuth();
  const { flash } = useFlash();

  const editorRef  = useRef(null);
  const fileRef    = useRef(null);

  const [attachments, setAttachments]   = useState([]);  // { file, name, url?, uploading, error }
  const [sending, setSending]           = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [err, setErr]                   = useState('');

  // Track active formatting state for toolbar highlights
  const [fmtState, setFmtState] = useState({
    bold: false, italic: false, underline: false, strikethrough: false,
    justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false,
    insertOrderedList: false, insertUnorderedList: false,
    fontSize: '13', fontName: 'Default', heading: 'p',
  });

  const syncFmt = useCallback(() => {
    if (!document.activeElement) return;
    setFmtState({
      bold:              document.queryCommandState('bold'),
      italic:            document.queryCommandState('italic'),
      underline:         document.queryCommandState('underline'),
      strikethrough:     document.queryCommandState('strikethrough'),
      justifyLeft:       document.queryCommandState('justifyLeft'),
      justifyCenter:     document.queryCommandState('justifyCenter'),
      justifyRight:      document.queryCommandState('justifyRight'),
      justifyFull:       document.queryCommandState('justifyFull'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      fontSize: document.queryCommandValue('fontSize') || '3',
      fontName: document.queryCommandValue('fontName') || 'Default',
      heading: 'p',
    });
  }, []);

  const exec = useCallback((cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    syncFmt();
  }, [syncFmt]);

  // Insert a link
  function insertLink() {
    const url = window.prompt('Enter URL:', 'https://');
    if (url) exec('createLink', url);
  }

  // Insert an inline image from URL
  function insertImageUrl() {
    const url = window.prompt('Enter image URL:');
    if (url) exec('insertImage', url);
  }

  // Upload files via Cloudinary
  async function handleFiles(files) {
    const newFiles = Array.from(files).map((f) => ({
      name: f.name, file: f, url: null, uploading: true, error: null,
    }));
    setAttachments((prev) => [...prev, ...newFiles]);
    setUploadingCount((n) => n + newFiles.length);

    await Promise.all(
      newFiles.map(async (entry) => {
        try {
          const res = await apiUploadMedia(entry.file);
          const url = res?.secure_url || res?.url;
          if (!url) throw new Error('Upload returned no URL');
          setAttachments((prev) =>
            prev.map((a) =>
              a.name === entry.name && a.uploading
                ? { ...a, url, uploading: false }
                : a
            )
          );
        } catch (e) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.name === entry.name && a.uploading
                ? { ...a, uploading: false, error: e.message }
                : a
            )
          );
        } finally {
          setUploadingCount((n) => n - 1);
        }
      })
    );
  }

  function removeAttachment(idx) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  // Paste images from clipboard
  function handlePaste(e) {
    const items = e.clipboardData?.items || [];
    const imageItems = Array.from(items).filter((i) => i.type.startsWith('image/'));
    if (imageItems.length) {
      e.preventDefault();
      const files = imageItems.map((i) => i.getAsFile()).filter(Boolean);
      handleFiles(files);
    }
  }

  // Drag & drop onto editor
  function handleDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files?.length) handleFiles(files);
  }

  async function handleSend() {
    const html = editorRef.current?.innerHTML?.trim() || '';
    if (!html || html === '<br>') { setErr('Please write a reply before sending.'); return; }
    if (uploadingCount > 0) { setErr('Please wait for all uploads to finish.'); return; }

    const failedUploads = attachments.filter((a) => a.error);
    if (failedUploads.length) { setErr(`${failedUploads.length} attachment(s) failed to upload. Remove them or retry.`); return; }

    setSending(true);
    setErr('');
    try {
      const text = editorRef.current?.innerText?.trim() || '';
      const autoSubject = `Re: Your inquiry to ${companyName}`;
      const uploadedAttachments = attachments.filter((a) => a.url).map((a) => ({
        url: a.url,
        originalName: a.name,
        resourceType: a.resourceType || 'raw',
        bytes: a.bytes || 0,
      }));

      // Send as JSON — files are already pre-uploaded to Cloudinary
      const res = await apiFetch(`/admin/contact-inquiries/${inquiry._id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ subject: autoSubject, htmlBody: html, textBody: text, uploadedAttachments }),
      });

      if (res?.ok) {
        flash(`Reply sent to ${inquiry.email}`, 'ok');
        onSent(res.inquiry);
        onClose();
      } else {
        throw new Error(res?.error || 'Failed to send reply');
      }
    } catch (e) {
      setErr(e.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  }

  if (!inquiry) return null;

  const companyName = state.company?.name || 'e-Cunga Portal';

  return (
    <div
      className={ui.modalOverlay}
      onClick={onClose}
      style={{ zIndex: 1200, alignItems: 'flex-start', paddingTop: '2vh' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          margin: '0 auto',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          background: 'linear-gradient(135deg, #692751 0%, #8b3a62 100%)',
          color: '#fff',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: '700', fontSize: '1rem' }}>
              Reply to {inquiry.firstName} {inquiry.lastName}
            </span>
            <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{inquiry.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>From: {companyName}</span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                width: '28px', height: '28px', color: '#fff', cursor: 'pointer',
                fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>

        {/* ── Original message strip ──────────────────────────────────────── */}
        <div style={{
          padding: '0.65rem 1.5rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
            <span style={{ fontWeight: '600', color: '#475569' }}>Original message: </span>
            {String(inquiry.message || '').slice(0, 180)}{inquiry.message?.length > 180 ? '…' : ''}
          </p>
        </div>

        {/* ── MS-Word-style Toolbar ───────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '2px',
          padding: '6px 10px',
          background: '#f1f5f9',
          borderBottom: '2px solid #e2e8f0',
          alignItems: 'center',
          flexShrink: 0,
          userSelect: 'none',
        }}>

          {/* Heading / paragraph style */}
          <ToolbarSelect
            title="Paragraph style"
            value={fmtState.heading}
            width="100px"
            options={Object.entries(HEADING_MAP).map(([v, l]) => ({ value: v, label: l }))}
            onChange={(v) => { exec('formatBlock', v); }}
          />
          <ToolbarSep />

          {/* Font face */}
          <ToolbarSelect
            title="Font family"
            value={fmtState.fontName.replace(/['"]/g, '')}
            width="112px"
            options={FONT_FACES.map((f) => ({ value: f === 'Default' ? '' : f, label: f }))}
            onChange={(v) => { if (v) exec('fontName', v); }}
          />

          {/* Font size */}
          <ToolbarSelect
            title="Font size"
            value={fmtState.fontSize}
            width="56px"
            options={FONT_SIZES.map((s) => ({ value: s, label: s }))}
            onChange={(v) => {
              editorRef.current?.focus();
              // Use fontSize command (1–7 HTML sizes) or direct span insertion
              const sizeMap = { '10':1,'11':1,'12':2,'13':2,'14':3,'16':4,'18':4,'20':5,'24':5,'28':6,'32':6,'36':6,'48':7 };
              exec('fontSize', sizeMap[v] || 3);
            }}
          />
          <ToolbarSep />

          {/* Bold / Italic / Underline / Strike */}
          <ToolbarBtn title="Bold (Ctrl+B)" active={fmtState.bold} onClick={() => exec('bold')}>
            <strong>B</strong>
          </ToolbarBtn>
          <ToolbarBtn title="Italic (Ctrl+I)" active={fmtState.italic} onClick={() => exec('italic')}>
            <em>I</em>
          </ToolbarBtn>
          <ToolbarBtn title="Underline (Ctrl+U)" active={fmtState.underline} onClick={() => exec('underline')}>
            <u>U</u>
          </ToolbarBtn>
          <ToolbarBtn title="Strikethrough" active={fmtState.strikethrough} onClick={() => exec('strikethrough')}>
            <s>S</s>
          </ToolbarBtn>
          <ToolbarSep />

          {/* Text colour */}
          <ColourPicker title="Text colour" onPick={(c) => exec('foreColor', c)} />
          {/* Highlight */}
          <ColourPicker title="Highlight colour" onPick={(c) => exec('hiliteColor', c)} />
          <ToolbarSep />

          {/* Alignment */}
          <ToolbarBtn title="Align left" active={fmtState.justifyLeft} onClick={() => exec('justifyLeft')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="2"/><rect x="3" y="10" width="12" height="2"/><rect x="3" y="15" width="18" height="2"/><rect x="3" y="20" width="12" height="2"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Center" active={fmtState.justifyCenter} onClick={() => exec('justifyCenter')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="2"/><rect x="6" y="10" width="12" height="2"/><rect x="3" y="15" width="18" height="2"/><rect x="6" y="20" width="12" height="2"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Align right" active={fmtState.justifyRight} onClick={() => exec('justifyRight')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="2"/><rect x="9" y="10" width="12" height="2"/><rect x="3" y="15" width="18" height="2"/><rect x="9" y="20" width="12" height="2"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Justify" active={fmtState.justifyFull} onClick={() => exec('justifyFull')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="2"/><rect x="3" y="10" width="18" height="2"/><rect x="3" y="15" width="18" height="2"/><rect x="3" y="20" width="18" height="2"/></svg>
          </ToolbarBtn>
          <ToolbarSep />

          {/* Lists */}
          <ToolbarBtn title="Bulleted list" active={fmtState.insertUnorderedList} onClick={() => exec('insertUnorderedList')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="7" r="1.5"/><rect x="8" y="6" width="13" height="2"/><circle cx="4" cy="12" r="1.5"/><rect x="8" y="11" width="13" height="2"/><circle cx="4" cy="17" r="1.5"/><rect x="8" y="16" width="13" height="2"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Numbered list" active={fmtState.insertOrderedList} onClick={() => exec('insertOrderedList')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><text x="2" y="8" fontSize="7" fontWeight="bold">1.</text><rect x="9" y="6" width="12" height="2"/><text x="2" y="14" fontSize="7" fontWeight="bold">2.</text><rect x="9" y="12" width="12" height="2"/><text x="2" y="20" fontSize="7" fontWeight="bold">3.</text><rect x="9" y="18" width="12" height="2"/></svg>
          </ToolbarBtn>
          <ToolbarSep />

          {/* Indent */}
          <ToolbarBtn title="Increase indent" onClick={() => exec('indent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="7 9 10 12 7 15"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Decrease indent" onClick={() => exec('outdent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="10 9 7 12 10 15"/></svg>
          </ToolbarBtn>
          <ToolbarSep />

          {/* Quote / HR */}
          <ToolbarBtn title="Blockquote" onClick={() => exec('formatBlock', 'blockquote')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Horizontal line" onClick={() => exec('insertHorizontalRule')}>
            ─
          </ToolbarBtn>
          <ToolbarSep />

          {/* Link / Image */}
          <ToolbarBtn title="Insert link" onClick={insertLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Unlink" onClick={() => exec('unlink')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Insert image from URL" onClick={insertImageUrl}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </ToolbarBtn>
          <ToolbarSep />

          {/* Attach file */}
          <ToolbarBtn title="Attach file / media" onClick={() => fileRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </ToolbarBtn>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
          />
          <ToolbarSep />

          {/* Undo / Redo */}
          <ToolbarBtn title="Undo (Ctrl+Z)" onClick={() => exec('undo')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Redo (Ctrl+Y)" onClick={() => exec('redo')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Clear formatting" onClick={() => exec('removeFormat')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 12h6M11 17h2"/><line x1="18" y1="6" x2="6" y2="18" strokeDasharray="2 2"/></svg>
          </ToolbarBtn>
        </div>

        {/* ── Editable body ───────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 1.5rem',
            background: '#fff',
            minHeight: '200px',
          }}
        >
          {/* Page-like writing area */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write your reply here…"
            onKeyUp={syncFmt}
            onMouseUp={syncFmt}
            onFocus={syncFmt}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              minHeight: '220px',
              padding: '1.5rem 2rem',
              margin: '1.25rem auto',
              maxWidth: '680px',
              background: '#fff',
              boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              outline: 'none',
              fontSize: '0.95rem',
              lineHeight: '1.7',
              color: '#1e293b',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* ── Attachments strip ───────────────────────────────────────────── */}
        {attachments.length > 0 && (
          <div style={{
            padding: '0.5rem 1.5rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
            flexShrink: 0,
          }}>
            {attachments.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '99px',
                  background: a.error ? '#fee2e2' : a.uploading ? '#fef3c7' : '#dbeafe',
                  border: `1px solid ${a.error ? '#fecaca' : a.uploading ? '#fde68a' : '#bfdbfe'}`,
                  fontSize: '0.75rem',
                  color: a.error ? '#dc2626' : a.uploading ? '#92400e' : '#1d4ed8',
                  maxWidth: '200px',
                }}
              >
                {a.uploading && <span style={{ fontSize: '0.65rem' }}>⏳</span>}
                {a.error && <span style={{ fontSize: '0.65rem' }}>⚠️</span>}
                {!a.uploading && !a.error && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: '0.85rem', lineHeight: 1 }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {err && (
          <div style={{
            padding: '0.65rem 1.5rem', background: '#fee2e2', borderTop: '1px solid #fecaca',
            color: '#b91c1c', fontSize: '0.85rem', fontWeight: '500', flexShrink: 0,
          }}>
            {err}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.85rem 1.5rem',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          flexShrink: 0,
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              title="Attach files"
              onClick={() => fileRef.current?.click()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                border: '1px solid #e2e8f0', borderRadius: '6px',
                background: '#fff', cursor: 'pointer',
                fontSize: '0.82rem', color: '#475569',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              Attach
            </button>
            {uploadingCount > 0 && (
              <span style={{ fontSize: '0.78rem', color: '#d97706' }}>
                Uploading {uploadingCount} file{uploadingCount > 1 ? 's' : ''}…
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              style={{
                padding: '0.55rem 1.2rem', border: '1px solid #e2e8f0', borderRadius: '7px',
                background: '#fff', cursor: 'pointer', fontSize: '0.88rem',
                color: '#475569', fontWeight: '500',
              }}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || uploadingCount > 0}
              style={{
                padding: '0.55rem 1.4rem',
                border: 'none', borderRadius: '7px',
                background: sending ? '#9b6e89' : 'linear-gradient(135deg, #692751, #8b3a62)',
                color: '#fff', cursor: sending ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem', fontWeight: '700',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                boxShadow: '0 2px 8px rgba(105,39,81,0.25)',
              }}
            >
              {sending ? (
                <>
                  <span style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Sending…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Send Reply
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        blockquote {
          border-left: 3px solid #692751;
          margin: 0.5rem 0;
          padding: 0.25rem 0.75rem;
          background: #f3e8ee;
          color: #692751;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

// ─── Contact Detail + Thread Modal ────────────────────────────────────────────
function ContactDetailModal({ isOpen, inquiry, onClose, onDelete, onReply }) {
  if (!isOpen || !inquiry) return null;

  const replies = inquiry.replies || [];

  const label = (text) => (
    <label style={{
      display: 'block', fontSize: '0.75rem', color: '#64748b',
      marginBottom: '0.35rem', textTransform: 'uppercase',
      letterSpacing: '0.06em', fontWeight: '700',
    }}>{text}</label>
  );

  return (
    <div className={ui.modalOverlay} onClick={onClose}>
      <div
        className={ui.modalCard}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '720px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className={ui.modalHead}>
          <div>
            <h2 className={ui.modalTitle}>Contact Inquiry</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
              {inquiry.firstName} {inquiry.lastName} · {inquiry.email}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Status badge */}
            <span style={{
              fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '99px',
              background: inquiry.status === 'replied' ? '#dcfce7' : '#fef3c7',
              color: inquiry.status === 'replied' ? '#15803d' : '#92400e',
              textTransform: 'uppercase',
            }}>
              {inquiry.status === 'replied' ? 'Replied' : inquiry.status === 'closed' ? 'Closed' : 'Open'}
            </span>
            <button type="button" className={ui.modalClose} onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Inquiry metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>{label('First Name')}<p style={{ margin: 0, fontWeight: '500' }}>{inquiry.firstName}</p></div>
            <div>{label('Last Name')}<p style={{ margin: 0, fontWeight: '500' }}>{inquiry.lastName}</p></div>
          </div>
          <div>
            {label('Email')}
            <a href={`mailto:${inquiry.email}`} style={{ color: 'var(--ec-primary)', fontWeight: '500', textDecoration: 'none' }}>{inquiry.email}</a>
          </div>
          <div>
            {label('Industry')}
            <span style={{ padding: '0.3rem 0.65rem', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.9rem', color: '#475569', display: 'inline-block' }}>
              {inquiry.industry || 'Not specified'}
            </span>
          </div>
          <div>
            {label('Message')}
            <div style={{
              whiteSpace: 'pre-wrap', lineHeight: '1.7',
              padding: '1rem', background: '#f8fafc',
              borderRadius: '8px', border: '1px solid #e2e8f0',
              fontSize: '0.92rem', color: '#334155',
            }}>
              {inquiry.message}
            </div>
          </div>

          {/* Reply thread */}
          {replies.length > 0 && (
            <div>
              {label(`Reply Thread (${replies.length})`)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {replies.map((r, i) => (
                  <div key={i} style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: '8px', padding: '0.85rem 1rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#15803d' }}>{r.adminName || 'Admin'}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    {r.subject && (
                      <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                        Subject: {r.subject}
                      </div>
                    )}
                    <div
                      dangerouslySetInnerHTML={{ __html: r.htmlBody || '' }}
                      style={{ fontSize: '0.88rem', lineHeight: '1.65', color: '#1e293b' }}
                    />
                    {r.attachments?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {r.attachments.map((a, ai) => (
                          <a
                            key={ai}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.72rem', color: '#2563eb',
                              background: '#dbeafe', border: '1px solid #bfdbfe',
                              padding: '2px 8px', borderRadius: '99px', textDecoration: 'none',
                            }}
                          >
                            📎 {a.originalName || 'Attachment'}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Submitted: {new Date(inquiry.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <span style={{ fontFamily: 'monospace' }}>ID: {(inquiry._id || '').slice(-8)}</span>
          </div>
        </div>

        <div style={{
          padding: '1rem 2rem', display: 'flex', gap: '0.65rem',
          justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={() => { onClose(); onReply(inquiry); }}
            style={{
              padding: '0.6rem 1.35rem', border: 'none', borderRadius: '7px',
              background: 'linear-gradient(135deg,#692751,#8b3a62)',
              color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '700',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Reply
          </button>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.55rem 1.1rem', border: '1px solid #e2e8f0', borderRadius: '7px',
                background: '#fff', cursor: 'pointer', fontSize: '0.88rem', color: '#475569', fontWeight: '500',
              }}
            >Close</button>
            <button
              type="button"
              onClick={() => { onDelete(inquiry); onClose(); }}
              style={{
                padding: '0.55rem 1.1rem', border: 'none', borderRadius: '7px',
                background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '600',
              }}
            >Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AdminContactInquiries() {
  const { flash, FlashBanner } = useFlash();
  const [inquiries, setInquiries]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyingTo, setReplyingTo]       = useState(null);
  const [deletingInquiry, setDeletingInquiry] = useState(null);
  const [deletingBusy, setDeletingBusy]   = useState(false);

  useEffect(() => { loadInquiries(); }, []);

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
      flash('Inquiry deleted.', 'ok');
      loadInquiries();
    } catch (err) {
      flash(err?.message || 'Could not delete inquiry.', 'error');
    }
  }

  function handleReplySent(updatedInquiry) {
    if (updatedInquiry) {
      setInquiries((prev) =>
        prev.map((q) => q._id === updatedInquiry._id ? { ...q, ...updatedInquiry } : q)
      );
    }
  }

  const filtered = useMemo(() => inquiries.filter((q) => {
    const s = search.toLowerCase();
    const matchText = !s ||
      q.firstName.toLowerCase().includes(s) ||
      q.lastName.toLowerCase().includes(s) ||
      q.email.toLowerCase().includes(s) ||
      q.message.toLowerCase().includes(s);
    const matchInd = industryFilter === 'all' || q.industry === industryFilter;
    return matchText && matchInd;
  }), [inquiries, search, industryFilter]);

  const pager = usePagedList(filtered, { pageSize: 20, resetKey: filtered.length });

  const statusColor = (status) =>
    status === 'replied' ? { bg: '#dcfce7', color: '#15803d' }
    : status === 'closed' ? { bg: '#f1f5f9', color: '#475569' }
    : { bg: '#fef9c3', color: '#854d0e' };

  return (
    <div className={ui.adminPage}>
      <FlashBanner />

      <ConfirmModal
        isOpen={Boolean(deletingInquiry)}
        title="Delete Contact Inquiry"
        message={`Delete inquiry from ${deletingInquiry?.firstName} ${deletingInquiry?.lastName}?`}
        confirmText="Delete"
        isBusy={deletingBusy}
        onConfirm={async () => {
          setDeletingBusy(true);
          try { await handleDelete(deletingInquiry); setDeletingInquiry(null); }
          finally { setDeletingBusy(false); }
        }}
        onClose={() => !deletingBusy && setDeletingInquiry(null)}
      />

      <ContactDetailModal
        isOpen={Boolean(selectedInquiry)}
        inquiry={selectedInquiry}
        onClose={() => setSelectedInquiry(null)}
        onDelete={setDeletingInquiry}
        onReply={(inq) => setReplyingTo(inq)}
      />

      {replyingTo && (
        <ReplyModal
          inquiry={replyingTo}
          onClose={() => setReplyingTo(null)}
          onSent={handleReplySent}
        />
      )}

      {/* Header */}
      <div className={ui.adminPageHead}>
        <div>
          <h1 className={ui.adminTitle}>Contact Inquiries</h1>
          <p className={ui.adminLead}>Manage and respond to website contact form submissions.</p>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        padding: '0.85rem 1.25rem', backgroundColor: '#dbeafe',
        border: '1px solid #93c5fd', borderRadius: '8px',
        marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#2563eb" style={{ flexShrink: 0, marginTop: '1px' }}><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>
        <p style={{ margin: 0, fontSize: '0.88rem', color: '#1e40af', lineHeight: '1.55' }}>
          <strong>Automatic Confirmation:</strong> When someone submits a contact form, they automatically receive a confirmation email letting them know we'll reach out soon.
        </p>
      </div>

      {/* Filters */}
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
          <option value="Retail & wholesale">Retail &amp; wholesale</option>
          <option value="Industry / manufacturing">Industry / manufacturing</option>
          <option value="Agribusiness">Agribusiness</option>
          <option value="Government / NGO">Government / NGO</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className={ui.adminEmpty}>Loading contact inquiries…</div>
      ) : filtered.length === 0 ? (
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
              {pager.pageSlice.map((inquiry) => {
                const sc = statusColor(inquiry.status);
                const replyCount = (inquiry.replies || []).length;
                return (
                  <article key={inquiry._id} className={ui.adminUsersRow}>
                    <div>
                      <p className={ui.adminUsersRowName} style={{ margin: 0 }}>
                        {inquiry.firstName} {inquiry.lastName}
                      </p>
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: '700', padding: '1px 6px',
                          borderRadius: '99px', background: sc.bg, color: sc.color, textTransform: 'uppercase',
                        }}>
                          {inquiry.status || 'open'}
                        </span>
                        {replyCount > 0 && (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: '700', padding: '1px 6px',
                            borderRadius: '99px', background: '#dbeafe', color: '#1d4ed8',
                          }}>
                            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--ec-primary, #692751)', fontSize: '0.88rem' }}>{inquiry.email}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.88rem' }}>{inquiry.industry || '—'}</span>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.83rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                        {inquiry.message}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.83rem', color: '#64748b' }}>
                        {new Date(inquiry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Reply button — primary action */}
                      <button
                        type="button"
                        onClick={() => setReplyingTo(inquiry)}
                        title="Reply to this inquiry"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          backgroundColor: 'var(--ec-primary, #692751)',
                          color: '#fff', padding: '0.45rem 0.9rem',
                          borderRadius: '6px', border: 'none',
                          fontSize: '0.83rem', fontWeight: '600', cursor: 'pointer',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInquiry(inquiry)}
                        title="View details & thread"
                        style={{
                          padding: '0.45rem 0.75rem', borderRadius: '6px',
                          border: '1px solid #e2e8f0', backgroundColor: '#fff',
                          fontSize: '0.83rem', fontWeight: '500', cursor: 'pointer', color: '#475569',
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingInquiry(inquiry)}
                        title="Delete inquiry"
                        style={{
                          padding: '0.45rem 0.65rem', borderRadius: '6px',
                          border: '1px solid #fecaca', backgroundColor: '#fff',
                          fontSize: '0.83rem', cursor: 'pointer', color: '#ef4444',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </article>
                );
              })}
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
