export function Toast({ message, tone = 'success', onClose }) {
  if (!message) return null;
  return <div className={`toast toast-${tone}`} role="status"><i className={`bi ${tone === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`} /><span>{message}</span><button onClick={onClose} aria-label="Dismiss notification"><i className="bi bi-x" /></button></div>;
}
