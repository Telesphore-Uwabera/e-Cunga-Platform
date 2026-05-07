import React, { useState, useEffect } from 'react';
import ui from '../pages/app/DashboardUi.module.css';

/**
 * A professional confirmation modal to replace window.confirm.
 */
export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  onConfirm, 
  onClose, 
  variant = 'danger',
  isBusy = false
}) {
  const [saveResult, setSaveResult] = useState(null);
  const [internalBusy, setInternalBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSaveResult(null);
      setInternalBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const busy = isBusy || internalBusy;

  const handleConfirm = async () => {
    if (busy) return;
    setInternalBusy(true);
    setSaveResult(null);
    try {
      await Promise.resolve(onConfirm());
      setSaveResult('ok');
      setTimeout(() => {
        setSaveResult(null);
        onClose();
      }, 1500);
    } catch (e) {
      setSaveResult('err');
      setTimeout(() => setSaveResult(null), 2000);
    } finally {
      setInternalBusy(false);
    }
  };

  return (
    <div 
      className={ui.adminModalOverlay} 
      onClick={() => {
        if (!busy) onClose();
      }}
      style={{ zIndex: 3000 }}
    >
      <div 
        className={`${ui.adminModalInvite} ${ui.adminModalInviteCompact} ${ui.adminModalInviteCompactNarrow}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '400px' }}
      >
        <header className={ui.adminCardHead}>
          <div>
            <h2 className={ui.adminUsersSectionTitle}>{title}</h2>
          </div>
          <button 
            type="button" 
            className={ui.adminModalClose} 
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>

        <div className={ui.adminUsersInviteFormModal} style={{ padding: '1rem 1.5rem' }}>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.95rem', color: 'var(--ec-text)', lineHeight: 1.5 }}>
            {message}
          </p>

          <div className={ui.adminModalFoot} style={{ marginTop: 0 }}>
            <button 
              type="button" 
              className={ui.adminGhostBtn} 
              onClick={onClose}
              disabled={busy}
            >
              {cancelText}
            </button>
            <button 
              type="button" 
              className={`${ui.checkoutSaveBtn} ${busy ? ui.checkoutSaveBtnSaving : ''} ${saveResult === 'ok' ? ui.checkoutSaveBtnSuccess : ''} ${saveResult === 'err' ? ui.checkoutSaveBtnError : ''}`}
              onClick={handleConfirm}
              disabled={busy || saveResult === 'ok'}
            >
              {busy ? (
                '...'
              ) : saveResult === 'ok' ? (
                'SUCCESSFULLY'
              ) : saveResult === 'err' ? (
                'FAILED'
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
