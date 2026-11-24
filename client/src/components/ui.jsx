import { useEffect } from 'react';

export function FullScreen({ message }) {
  return (
    <div className="fullscreen">
      <div className="mark">A</div>
      <p>{message}</p>
    </div>
  );
}

export function PageHead({ eyebrow, title, lede, children }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </header>
  );
}

export function Banner({ tone = 'danger', children }) {
  if (!children) return null;
  return (
    <div className={`banner banner-${tone}`} role="status">
      {children}
    </div>
  );
}

export function Badge({ tone = 'muted', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, children, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ title, children, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </aside>
    </>
  );
}

export function Empty({ title, text }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
