import React, { useState, useEffect } from 'react';
import ui from '../pages/app/DashboardUi.module.css';
import { CloseIcon } from './Icons.jsx';

export function EditDraftRequisitionModal({
  isOpen,
  requisition,
  onClose,
  onSave,
  onSubmit,
  onCancel,
}) {
  const [lines, setLines] = useState([]);
  const [priority, setPriority] = useState('low');
  const [clerkJustification, setClerkJustification] = useState('');
  const [requestingDepartment, setRequestingDepartment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen && requisition) {
      setLines(
        (requisition.lines || []).map((l, idx) => ({
          id: l._id || String(idx),
          description: l.description || '',
          quantity: l.quantity || 1,
          unit: l.unit || 'units',
          estimatedCost: l.estimatedCost || 0,
          dateValue: l.dateValue || '',
        }))
      );
      setPriority(requisition.priority || 'low');
      setClerkJustification(requisition.clerkJustification || '');
      setRequestingDepartment(requisition.requestingDepartment || '');
      setError('');
    }
  }, [isOpen, requisition]);

  if (!isOpen || !requisition) return null;

  const handleUpdateLine = (id, field, value) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        description: '',
        quantity: 1,
        unit: 'units',
        estimatedCost: 0,
        dateValue: '',
      },
    ]);
  };

  const handleRemoveLine = (id) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const validate = () => {
    if (lines.length === 0) {
      return 'You must have at least one item in the requisition.';
    }
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].description.trim()) {
        return `Item ${i + 1} description is required.`;
      }
      if (lines[i].quantity <= 0) {
        return `Item ${i + 1} quantity must be greater than zero.`;
      }
    }
    return null;
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        lines: lines.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unit: l.unit,
          estimatedCost: Number(l.estimatedCost),
          dateValue: l.dateValue,
        })),
        priority,
        clerkJustification,
        requestingDepartment,
      };
      await onSave(requisition.id || requisition._id, payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save draft changes.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitDraft = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!window.confirm('Are you sure you want to submit this requisition to the supervisor approval queue?')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Save changes first to ensure backend has the latest lines
      const payload = {
        lines: lines.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unit: l.unit,
          estimatedCost: Number(l.estimatedCost),
          dateValue: l.dateValue,
        })),
        priority,
        clerkJustification,
        requestingDepartment,
      };
      await onSave(requisition.id || requisition._id, payload);
      // Then submit
      await onSubmit(requisition.id || requisition._id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit requisition.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelDraft = async () => {
    if (!window.confirm('Are you sure you want to delete/cancel this draft requisition? This cannot be undone.')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onCancel(requisition.id || requisition._id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to cancel draft requisition.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={ui.modalOverlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={ui.modalCard}
        style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', marginLeft: '2rem', marginRight: '2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={ui.modalHead}>
          <div>
            <h2 className={ui.modalTitle}>
              {requisition.status === 'submitted'
                ? 'Edit Requisition'
                : requisition.status === 'rejected'
                  ? 'Edit & Resubmit Requisition'
                  : 'Edit Requisition Draft'}
            </h2>
            <p className={ui.modalSubtitle} style={{ fontSize: '0.85rem', color: 'var(--ec-muted)', marginTop: '0.2rem' }}>
              Ref: {requisition.id || requisition._id}
            </p>
          </div>
          <button type="button" className={ui.modalClose} onClick={onClose} disabled={busy}>
            ×
          </button>
        </header>

        <form className={ui.modalForm} onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className={ui.modalBody} style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
            {error && (
              <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.9rem', border: '1px solid #fee2e2' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <label className={ui.materialsField}>
                <span>Requesting Department</span>
                <input
                  type="text"
                  className={ui.materialsInput}
                  value={requestingDepartment || 'Operation'}
                  readOnly
                  disabled
                  style={{ background: 'var(--ec-bg-soft, #f1f5f9)', cursor: 'not-allowed', color: 'var(--ec-muted, #64748b)', fontWeight: 600 }}
                />
              </label>

              <label className={ui.materialsField}>
                <span>Priority</span>
                <select
                  className={ui.materialsInput}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={busy}
                >
                  <option value="low">Low (Standard restocking)</option>
                  <option value="normal">Normal (Default)</option>
                  <option value="high">High (Bottleneck potential)</option>
                  <option value="critical">Critical (Immediate dispatch)</option>
                </select>
              </label>
            </div>

            <label className={ui.materialsField} style={{ marginBottom: '1.5rem' }}>
              <span>Justification / Purpose</span>
              <textarea
                className={ui.materialsInput}
                value={clerkJustification}
                onChange={(e) => setClerkJustification(e.target.value)}
                placeholder="Provide a reason for the requisition..."
                rows={2}
                disabled={busy}
                style={{ resize: 'vertical', minHeight: '60px', padding: '0.6rem 0.8rem' }}
              />
            </label>

            <div style={{ marginBottom: '1rem', borderBottom: '2px solid var(--ec-border-soft)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--ec-text)' }}>Requested Lines</h3>
              <button
                type="button"
                className={ui.materialsFilterBtnActive}
                onClick={handleAddLine}
                disabled={busy}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: 'var(--ec-primary)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'opacity 0.2s',
                }}
              >
                + Add Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lines.map((line, idx) => (
                <div
                  key={line.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 40px',
                    gap: '0.75rem',
                    alignItems: 'center',
                    background: 'var(--ec-bg-soft, #f8fafc)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--ec-border-soft)',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--ec-muted)', display: 'block', marginBottom: '0.25rem' }}>Description</label>
                    <input
                      type="text"
                      className={ui.materialsInput}
                      value={line.description}
                      onChange={(e) => handleUpdateLine(line.id, 'description', e.target.value)}
                      placeholder="Item name/spec"
                      required
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--ec-muted)', display: 'block', marginBottom: '0.25rem' }}>Quantity</label>
                    <input
                      type="number"
                      className={ui.materialsInput}
                      value={line.quantity}
                      onChange={(e) => handleUpdateLine(line.id, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                      min="1"
                      required
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--ec-muted)', display: 'block', marginBottom: '0.25rem' }}>Unit</label>
                    <input
                      type="text"
                      className={ui.materialsInput}
                      value={line.unit}
                      onChange={(e) => handleUpdateLine(line.id, 'unit', e.target.value)}
                      placeholder="pcs, box, etc."
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--ec-muted)', display: 'block', marginBottom: '0.25rem' }}>Est. Cost (RWF)</label>
                    <input
                      type="number"
                      className={ui.materialsInput}
                      value={line.estimatedCost}
                      onChange={(e) => handleUpdateLine(line.id, 'estimatedCost', Math.max(0, Number(e.target.value) || 0))}
                      min="0"
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--ec-muted)', display: 'block', marginBottom: '0.25rem' }}>Needed By</label>
                    <input
                      type="date"
                      className={ui.materialsInput}
                      value={line.dateValue}
                      onChange={(e) => handleUpdateLine(line.id, 'dateValue', e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(line.id)}
                      disabled={busy || lines.length <= 1}
                      title="Remove line"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: lines.length <= 1 ? 'var(--ec-border-soft)' : '#ef4444',
                        cursor: lines.length <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseOver={(e) => {
                        if (lines.length > 1) e.currentTarget.style.backgroundColor = '#fee2e2';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <CloseIcon size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <footer
            className={ui.modalActions}
            style={{
              padding: '1.25rem 1.5rem',
              background: 'var(--ec-white)',
              borderTop: '1px solid var(--ec-border-soft)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div>
              <button
                type="button"
                className={ui.modalSecondaryBtn}
                onClick={handleCancelDraft}
                disabled={busy}
                style={{
                  color: '#ef4444',
                  borderColor: '#fca5a5',
                  backgroundColor: '#fef2f2',
                }}
              >
                {requisition.status === 'submitted' || requisition.status === 'rejected'
                  ? 'Delete Requisition'
                  : 'Delete Draft'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className={ui.modalSecondaryBtn}
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={ui.materialsSubmitBtn}
                disabled={busy}
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--ec-border-soft)',
                  color: 'var(--ec-text)',
                  fontWeight: 600,
                }}
              >
                Save Draft
              </button>
              <button
                type="button"
                className={ui.materialsSubmitBtn}
                onClick={handleSubmitDraft}
                disabled={busy}
                style={{
                  background: 'var(--ec-primary)',
                  color: 'white',
                }}
              >
                Submit Requisition
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
