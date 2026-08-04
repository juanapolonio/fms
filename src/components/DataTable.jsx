import { StatusBadge } from './StatusBadge';

function display(value, key) {
  if (key === 'status' || key === 'availability' || key === 'kitchenStatus' || key === 'paymentStatus') return <StatusBadge value={value} />;
  if (key === 'rating') return <span className="rating"><i className="bi bi-star-fill" /> {value}</span>;
  return value;
}

export function DataTable({ columns, rows, onSelect, onEdit, onDuplicate, selectedId, page = 1, pageCount = 1, pageSize = rows.length, totalCount = rows.length, onPageChange }) {
  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? Math.min(start + rows.length - 1, totalCount) : 0;
  return <div className="table-wrap"><table><thead><tr><th>#</th>{columns.map(([, label]) => <th key={label}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className={selectedId === row.id ? 'row-selected' : ''} onClick={() => onSelect(row)}><td>{(page - 1) * pageSize + index + 1}</td>{columns.map(([key]) => <td key={key}>{display(row[key], key)}</td>)}<td><div className="row-actions"><button aria-label="View" onClick={(event) => { event.stopPropagation(); onSelect(row); }}><i className="bi bi-eye" /></button><button aria-label="Edit" onClick={(event) => { event.stopPropagation(); onEdit(row); }}><i className="bi bi-pencil" /></button><button aria-label="More" onClick={(event) => { event.stopPropagation(); onDuplicate(row); }}><i className="bi bi-three-dots-vertical" /></button></div></td></tr>)}</tbody></table><div className="table-footer"><span>Showing {start} to {end} of {totalCount} records</span><div className="pagination"><button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><i className="bi bi-chevron-left" /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={page === number ? 'page-active' : ''} onClick={() => onPageChange(number)}>{number}</button>)}<button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}><i className="bi bi-chevron-right" /></button></div></div></div>;
}
