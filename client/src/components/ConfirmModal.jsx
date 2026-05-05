import React from 'react';
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
  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isBusy) return;
    await onConfirm();
  };

  const confirmBtnStyle = variant === 'danger' 
    ? { background: '#ef4444', color: '#fff' }
    : variant === 'primary'
    ? { background: 'var(--ec-primary)', color: '#fff' }
    : {};

  return (
    <div 
      className={ui.adminModalOverlay} 
      onClick={() => !isBusy && onClose()}
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
            disabled={isBusy}
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
              disabled={isBusy}
            >
              {cancelText}
            </button>
            <button 
              type="button" 
              className={ui.adminPrimaryBtn} 
              style={confirmBtnStyle}
              onClick={handleConfirm}
              disabled={isBusy}
            >
              {isBusy ? (
                <span className={ui.adminModalBtnContent}>
                  <span className={ui.adminBtnSpinner} aria-hidden />
                  Processing...
                </span>
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
