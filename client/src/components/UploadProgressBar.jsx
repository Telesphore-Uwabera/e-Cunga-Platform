import ui from '../pages/app/DashboardUi.module.css';

/**
 * Thin upload progress indicator (0–100). Hidden when `percent` is null/undefined.
 */
export function UploadProgressBar({ percent, label }) {
  if (percent == null || percent < 0) return null;
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      className={ui.progressGroup}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Upload progress'}
    >
      <div className={ui.progressTrack}>
        <div className={ui.progressFill} style={{ width: `${pct}%`, transition: 'width 0.15s ease' }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>{label || `${pct}%`}</span>
    </div>
  );
}
