import { useEffect, useId, useRef, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ui from '../pages/app/DashboardUi.module.css';

/** Themed dropdown for inventory filters (native select lists cannot be styled consistently). */
export function InventoryFilterSelect({ value, onChange, options, disabled = false }) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  const syncCoords = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    syncCoords();
    const onScroll = () => syncCoords();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, syncCoords]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        // If clicking inside the portal list, don't close here
        if (typeof e.target.closest === 'function' && e.target.closest('[data-ec-inventory-filter-list]')) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const listEl =
    open && coords
      ? createPortal(
          <ul
            data-ec-inventory-filter-list
            id={listId}
            role="listbox"
            className={ui.inventoryCustomSelectList}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              minWidth: coords.width,
              width: 'max-content',
              maxWidth: 'min(90vw, 320px)',
              zIndex: 9000, // Very high to overlay everything
              margin: 0,
            }}
          >
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <li
                  key={String(opt.value)}
                  role="option"
                  aria-selected={isActive}
                  className={isActive ? ui.inventoryCustomSelectOptionActive : ui.inventoryCustomSelectOption}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    btnRef.current?.focus();
                  }}
                >
                  {opt.label}
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className={ui.inventoryCustomSelectWrap} ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className={ui.inventoryCustomSelectBtn}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        {selected?.label ?? ''}
      </button>
      {listEl}
    </div>
  );
}
