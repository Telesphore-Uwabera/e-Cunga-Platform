import { useEffect, useId, useRef, useState } from 'react';
import ui from '../pages/app/DashboardUi.module.css';

/** Themed dropdown for inventory filters (native select lists cannot be styled consistently). */
export function InventoryFilterSelect({ value, onChange, options, disabled = false }) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
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
      {open ? (
        <ul id={listId} role="listbox" className={ui.inventoryCustomSelectList}>
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
        </ul>
      ) : null}
    </div>
  );
}
