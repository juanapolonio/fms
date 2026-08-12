export function ActionModal({ title, fields, values, onChange, onClose, onSubmit, submitLabel = 'Save Changes', saving = false }) {
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!saving) onSubmit();
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog" disabled={saving}><i className="bi bi-x-lg" /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-form">
          {fields.map((field) => {
            const helperId = field.helper ? `${field.key}-helper` : undefined;
            return <label key={field.key}>
              <span>{field.label}{field.required && <span className="required-mark" aria-hidden="true"> *</span>}</span>
              {field.type === 'select'
                ? <select required={field.required} value={values[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)} aria-describedby={helperId}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                : <input autoFocus={field.key === fields[0].key} required={field.required} type={field.type || 'text'} min={field.min} max={field.max} step={field.step} value={values[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => onChange(field.key, event.target.value)} aria-describedby={helperId} />}
              {field.helper && <span className="field-helper" id={helperId}>{field.helper}</span>}
            </label>;
          })}
        </div>
        <div className="modal-actions">
          <button className="outline-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : submitLabel}</button>
        </div>
      </form>
    </div>
  </div>;
}
