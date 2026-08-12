import { StatusBadge } from './StatusBadge';

const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function display(value, key) {
  if (key === 'status' || key === 'availability' || key === 'kitchenStatus' || key === 'paymentStatus') return <StatusBadge value={value} />;
  if (key === 'rating') return <span className="rating"><i className="bi bi-star-fill" /> {value}</span>;
  if (['price', 'amount', 'refund'].includes(key) && typeof value === 'number') return currency.format(value);
  return value;
}

function pageNumbers(page, pageCount) {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const values = new Set([1, pageCount, page - 1, page, page + 1]);
  return [...values].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
}

export function DataTable({ columns, rows, loading = false, onSelect, onEdit, onDuplicate, onDelete, canEdit = () => true, canDuplicate = () => true, canDelete = () => true, selectedId, page = 1, pageCount = 1, pageSize = 10, totalCount = 0, onPageChange }) {
  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? Math.min(start + rows.length - 1, totalCount) : 0;
  const blanks = Math.max(0, pageSize - rows.length);
  const numbers = pageNumbers(page, pageCount);
  return <div className="table-wrap"><table><thead><tr><th>#</th>{columns.map(([, label]) => <th key={label}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className={selectedId === row.id ? 'row-selected' : ''} onClick={() => onSelect?.(row)}><td>{(page - 1) * pageSize + index + 1}</td>{columns.map(([key]) => <td key={key}>{display(row[key], key)}</td>)}<td><div className="row-actions"><button aria-label="View" onClick={(event) => { event.stopPropagation(); onSelect?.(row); }}><i className="bi bi-eye" /></button>{onEdit && canEdit(row) && <button aria-label="Edit" onClick={(event) => { event.stopPropagation(); onEdit(row); }}><i className="bi bi-pencil" /></button>}{onDuplicate && canDuplicate(row) && <button aria-label="Duplicate" onClick={(event) => { event.stopPropagation(); onDuplicate(row); }}><i className="bi bi-copy" /></button>}{onDelete && canDelete(row) && <button aria-label="Delete" onClick={(event) => { event.stopPropagation(); onDelete(row); }}><i className="bi bi-trash3" /></button>}</div></td></tr>)}{Array.from({ length: blanks }, (_, index) => <tr className="table-empty-row" key={`blank-${index}`}><td>{loading && index === 0 ? <span className="table-loading">Loading...</span> : ''}</td>{columns.map(([, label]) => <td key={label} />)}<td /></tr>)}</tbody></table><div className="table-footer"><span>Showing {start} to {end} of {totalCount} records</span><div className="pagination"><button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><i className="bi bi-chevron-left" /></button>{numbers.map((number, index) => <span className="pagination-number" key={number}>{index > 0 && number - numbers[index - 1] > 1 && <span className="pagination-ellipsis">...</span>}<button className={page === number ? 'page-active' : ''} onClick={() => onPageChange(number)}>{number}</button></span>)}<button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}><i className="bi bi-chevron-right" /></button></div></div></div>;
}
