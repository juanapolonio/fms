import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { MetricCards } from '../components/MetricCards';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import { PAGE_SIZE, useCancellationMutation, useResourceQuery } from '../lib/marketplaceQueries';

const columns = [['cancellationNumber', 'Cancellation ID'], ['orderId', 'Order ID'], ['customer', 'Customer'], ['type', 'Order Type'], ['date', 'Requested On'], ['reason', 'Reason'], ['status', 'Status'], ['refund', 'Refund Amount']];

export function CancellationsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const query = useResourceQuery({ key: 'cancellations', page, search, status, sort: 'Recently updated' });
  const mutation = useCancellationMutation();
  const rows = useMemo(() => query.data?.items || [], [query.data?.items]);
  useEffect(() => setPage(1), [search, status]);
  useEffect(() => { if (query.data && page > query.data.pageCount) setPage(query.data.pageCount); }, [page, query.data]);
  useEffect(() => {
    if (!selected) return;
    const refreshed = rows.find((row) => row.id === selected.id);
    if (refreshed && JSON.stringify(refreshed) !== JSON.stringify(selected)) setSelected(refreshed);
  }, [rows, selected]);
  const resolve = async (decision) => {
    try { await mutation.mutateAsync({ id: selected.id, decision, notes: decision === 'approve' ? 'Approved by ARGO administrator' : 'Rejected by ARGO administrator' }); setSelected(null); setToast(decision === 'approve' ? 'Cancellation approved and payment reconciliation completed' : 'Cancellation rejected; the order remains active'); }
    catch (error) { setToast(error.response?.data?.detail || 'Unable to resolve cancellation'); }
  };
  return <section className="page-content"><div className="page-heading"><div><h1>Cancellations</h1><p>Review requests before cancelling orders or issuing refunds</p></div></div><MetricCards metrics={query.data?.metrics || []} /><div className="content-grid"><div className="list-card"><div className="toolbar"><div className="field-search"><i className="bi bi-search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cancellations, orders, customers..." /></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All Status</option><option>Pending Review</option><option>Approved</option><option>Refunded</option><option>Rejected</option></select></div><DataTable columns={columns} rows={rows} loading={query.isLoading && !query.data} onSelect={setSelected} selectedId={selected?.id} page={query.data?.page || page} pageCount={query.data?.pageCount || 1} pageSize={PAGE_SIZE} totalCount={query.data?.total || 0} onPageChange={setPage} /></div>{selected ? <aside className="detail-panel operation-detail"><div className="detail-heading"><div><h3>Cancellation Details</h3><span>{selected.cancellationNumber} · {selected.orderId}</span></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><i className="bi bi-x-lg" /></button></div><div className="order-detail-status"><StatusBadge value={selected.status} /><StatusBadge value={selected.paymentStatus} /></div><div className="detail-fields"><div className="detail-field"><small>Customer</small><strong>{selected.customer}</strong></div><div className="detail-field"><small>Order type</small><strong>{selected.type}</strong></div><div className="detail-field"><small>Requested on</small><strong>{selected.date}</strong></div><div className="detail-field"><small>Reason</small><strong>{selected.reason}</strong></div><div className="detail-field"><small>Refund amount</small><strong>{selected.refund}</strong></div></div>{selected.status === 'Pending Review' && <div className="resolution-actions"><button className="danger-button" disabled={mutation.isPending} onClick={() => resolve('reject')}><i className="bi bi-x-lg" /> Reject Request</button><button className="primary-button" disabled={mutation.isPending} onClick={() => resolve('approve')}><i className="bi bi-check-lg" /> Approve Cancellation</button></div>}</aside> : <div className="detail-panel empty-detail"><i className="bi bi-x-circle" /><h3>Cancellation Details</h3><p>Select a request to review its reason, order, and refund status.</p></div>}</div>{toast && <Toast message={toast} onClose={() => setToast('')} />}</section>;
}
