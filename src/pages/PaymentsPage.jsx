import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { MetricCards } from '../components/MetricCards';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import { PAGE_SIZE, usePaymentMutation, useResourceQuery } from '../lib/marketplaceQueries';

const columns = [['transaction', 'Transaction ID'], ['order', 'Order ID'], ['customer', 'Customer'], ['method', 'Payment Method'], ['amount', 'Amount'], ['status', 'Status'], ['date', 'Date & Time']];

export function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const query = useResourceQuery({ key: 'payments', page, search, status, sort: 'Recently updated' });
  const mutation = usePaymentMutation();
  const rows = useMemo(() => query.data?.items || [], [query.data?.items]);
  useEffect(() => setPage(1), [search, status]);
  useEffect(() => { if (query.data && page > query.data.pageCount) setPage(query.data.pageCount); }, [page, query.data]);
  useEffect(() => {
    if (!selected) return;
    const refreshed = rows.find((row) => row.id === selected.id);
    if (refreshed && JSON.stringify(refreshed) !== JSON.stringify(selected)) setSelected(refreshed);
  }, [rows, selected]);
  const updateStatus = async (nextStatus) => {
    try { await mutation.mutateAsync({ id: selected.id, status: nextStatus }); setSelected(null); setToast(`Payment marked ${nextStatus.toLowerCase()} across the linked order`); }
    catch (error) { setToast(error.response?.data?.detail || 'Unable to update payment'); }
  };
  return <section className="page-content"><div className="page-heading"><div><h1>Payments</h1><p>Monitor and reconcile live payment transactions with their linked orders</p></div></div><MetricCards metrics={query.data?.metrics || []} /><div className="content-grid"><div className="list-card"><div className="toolbar"><div className="field-search"><i className="bi bi-search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions, orders, customers..." /></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All Status</option><option>Paid</option><option>Pending</option><option>Failed</option><option>Refunded</option><option>Voided</option></select></div><DataTable columns={columns} rows={rows} loading={query.isLoading && !query.data} onSelect={setSelected} selectedId={selected?.id} page={query.data?.page || page} pageCount={query.data?.pageCount || 1} pageSize={PAGE_SIZE} totalCount={query.data?.total || 0} onPageChange={setPage} /></div>{selected ? <aside className="detail-panel operation-detail"><div className="detail-heading"><div><h3>Payment Details</h3><span>{selected.transaction}</span></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><i className="bi bi-x-lg" /></button></div><div className="order-detail-status"><StatusBadge value={selected.status} /></div><div className="detail-fields"><div className="detail-field"><small>Linked order</small><strong>{selected.order}</strong></div><div className="detail-field"><small>Customer</small><strong>{selected.customer}</strong></div><div className="detail-field"><small>Payment method</small><strong>{selected.method}</strong></div><div className="detail-field"><small>Amount</small><strong>{selected.amount}</strong></div><div className="detail-field"><small>Date and time</small><strong>{selected.date}</strong></div></div>{['Pending', 'Failed'].includes(selected.status) && <button className="primary-button" disabled={mutation.isPending} onClick={() => updateStatus('Paid')}><i className="bi bi-check-circle" /> Mark as Paid</button>}{selected.status === 'Pending' && <button className="danger-button" disabled={mutation.isPending} onClick={() => updateStatus('Failed')}><i className="bi bi-exclamation-circle" /> Mark as Failed</button>}<button className="outline-button detail-action" onClick={() => window.print()}><i className="bi bi-printer" /> Print Receipt</button></aside> : <div className="detail-panel empty-detail"><i className="bi bi-wallet2" /><h3>Payment Details</h3><p>Select a payment to inspect its linked order and reconciliation status.</p></div>}</div>{toast && <Toast message={toast} onClose={() => setToast('')} />}</section>;
}
