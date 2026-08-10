import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MetricCards } from '../components/MetricCards';
import { DataTable } from '../components/DataTable';
import { DetailPanel } from '../components/DetailPanel';
import { ActionModal } from '../components/ActionModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { money, orderMetrics, useMarketplaceStore } from '../stores/useMarketplaceStore';

const modes = {
  customer: { title: 'Customer Orders', description: 'Manage all ARGO Marketplace customer orders', columns: [['orderNumber', 'Order ID'], ['customer', 'Customer'], ['type', 'Order Type'], ['itemCount', 'Items'], ['status', 'Status'], ['paymentStatus', 'Payment'], ['totalLabel', 'Total'], ['time', 'Order Time']] },
  table: { title: 'Table Orders', description: 'Manage dine-in tables, guests and service readiness', columns: [['table', 'Table'], ['customer', 'Server'], ['guests', 'Guests'], ['type', 'Order Type'], ['status', 'Status'], ['totalLabel', 'Amount']] },
  takeout: { title: 'Takeout Orders', description: 'Manage takeout preparation and handover', columns: [['orderNumber', 'Order #'], ['customer', 'Customer'], ['time', 'Order Time'], ['status', 'Status'], ['paymentStatus', 'Payment'], ['totalLabel', 'Amount']] },
  pickup: { title: 'Pickup Orders', description: 'Manage and track customer pickup orders', columns: [['orderNumber', 'Order ID'], ['customer', 'Customer'], ['time', 'Pickup Time'], ['status', 'Status'], ['paymentStatus', 'Payment'], ['totalLabel', 'Total']] },
  delivery: { title: 'Delivery Orders', description: 'Manage delivery assignments, riders and completion', columns: [['orderNumber', 'Order ID'], ['customer', 'Customer'], ['address', 'Delivery Address'], ['time', 'Order Time'], ['status', 'Status'], ['rider', 'Rider'], ['totalLabel', 'Total']] },
  kitchen: { title: 'Kitchen Preparation', description: 'Monitor and advance each kitchen preparation ticket', columns: [['orderNumber', 'Order ID'], ['customer', 'Customer'], ['itemSummary', 'Items'], ['type', 'Order Type'], ['time', 'Time'], ['kitchenStatus', 'Prep Status']] },
};

const scopeOrders = (orders, mode) => {
  if (mode === 'table') return orders.filter((order) => order.type === 'Dine-in');
  if (mode === 'takeout') return orders.filter((order) => order.type === 'Takeout');
  if (mode === 'pickup') return orders.filter((order) => order.type === 'Pickup');
  if (mode === 'delivery') return orders.filter((order) => order.type === 'Delivery');
  if (mode === 'kitchen') return orders.filter((order) => !['Cancelled', 'Completed', 'Delivered'].includes(order.kitchenStatus));
  return orders;
};

export function OrdersPage({ mode }) {
  const config = modes[mode];
  const [searchParams] = useSearchParams();
  const orders = useMarketplaceStore((state) => state.orders);
  const createOrder = useMarketplaceStore((state) => state.createOrder);
  const updateOrder = useMarketplaceStore((state) => state.updateOrder);
  const transitionOrder = useMarketplaceStore((state) => state.transitionOrder);
  const cancelOrder = useMarketplaceStore((state) => state.cancelOrder);
  const duplicateOrder = useMarketplaceStore((state) => state.duplicateOrder);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [dateFilter, setDateFilter] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => setSearch(searchParams.get('search') || ''), [searchParams]);
  useEffect(() => setPage(1), [search, statusFilter, dateFilter, mode]);
  const rows = useMemo(() => scopeOrders(orders, mode).map((order) => ({
    ...order, sourceId: order.id, sourceType: order.type, totalLabel: money(order.total),
    customer: mode === 'table' ? 'ARGO Floor Team' : order.customer,
    itemCount: `${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`,
    guests: order.guests ? `${order.guests} guests` : '—',
    status: mode === 'kitchen' ? order.kitchenStatus : order.status,
  })).filter((order) => Object.values(order).join(' ').toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'All Status' || order.status === statusFilter) && (!dateFilter || order.date === dateFilter)), [orders, mode, search, statusFilter, dateFilter]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const openCreate = () => setModal({ mode: 'create', values: { customer: '', type: mode === 'table' ? 'Dine-in' : mode === 'kitchen' ? 'Takeout' : mode === 'customer' ? 'Dine-in' : mode[0].toUpperCase() + mode.slice(1), status: 'Pending', paymentMethod: 'Cash', date: new Date().toISOString().slice(0, 10) } });
  const openEdit = (record) => setModal({ mode: 'edit', record, values: { customer: record.customer === 'ARGO Floor Team' ? record.customer : record.customer, type: record.sourceType || record.type, status: mode === 'kitchen' ? record.kitchenStatus : record.status, paymentMethod: record.paymentMethod, date: record.date } });
  const saveOrder = async () => {
    if (!modal.values.customer.trim()) return;
    try {
      if (modal.mode === 'edit') {
        const patch = { customer: modal.values.customer, type: modal.values.type, paymentMethod: modal.values.paymentMethod, date: modal.values.date };
        if (mode === 'kitchen') patch.kitchenStatus = modal.values.status;
        else patch.status = modal.values.status;
        await updateOrder(modal.record.sourceId, patch);
        setSelected(null);
        setToast('Order updated and all linked modules refreshed');
      } else {
        await createOrder(modal.values);
        setToast('New order added to the live ARGO queue');
      }
      setModal(null);
    } catch (error) { setToast(error.response?.data?.detail || 'Unable to save order'); }
  };
  const advanceOrder = async () => {
    if (!selected) return;
    const progression = selected.type === 'Delivery' ? ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'] : selected.type === 'Dine-in' ? ['Pending', 'Preparing', 'Ready', 'Completed'] : ['Pending', 'Preparing', 'Ready for Pickup', 'Completed'];
    const current = mode === 'kitchen' ? selected.kitchenStatus : selected.status;
    const next = progression[Math.min(progression.indexOf(current) + 1, progression.length - 1)];
    try {
      await transitionOrder(selected.sourceId, next);
      setSelected((currentRecord) => currentRecord ? { ...currentRecord, status: next, kitchenStatus: next } : currentRecord);
      setToast(next === current ? 'Order is already at its final operational status' : `Order advanced to ${next}`);
    } catch (error) { setToast(error.response?.data?.detail || 'Unable to advance order'); }
  };
  const submitCancel = async () => {
    try {
      await cancelOrder(confirmCancel.sourceId);
      setSelected((record) => record ? { ...record, status: 'Cancelled', paymentStatus: 'Refunded', kitchenStatus: 'Cancelled' } : record);
      setConfirmCancel(null);
      setToast('Order cancelled, payment refunded, and cancellation record created');
    } catch (error) { setToast(error.response?.data?.detail || 'Unable to cancel order'); }
  };
  const statuses = mode === 'kitchen' ? ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'] : ['Pending', 'Preparing', 'Ready', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Completed', 'Cancelled'];
  return <section className="page-content"><div className="page-heading"><div><h1>{config.title}</h1><p>{config.description}</p></div><button className="primary-button" onClick={openCreate}><i className="bi bi-plus-lg" /> New {mode === 'kitchen' ? 'Kitchen Ticket' : 'Order'}</button></div><MetricCards metrics={orderMetrics(orders, mode)} /><div className="content-grid"><div className="list-card"><div className="toolbar"><div className="field-search"><i className="bi bi-search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders, customers, tables..." /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All Status</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><div className="date-filter-wrap"><button className={`outline-button ${dateFilter ? 'button-selected' : ''}`} aria-label={dateFilter ? 'Change selected date' : 'Select date'} onClick={() => setDateOpen((open) => !open)}><i className="bi bi-calendar3" /></button>{dateOpen && <div className="date-popover"><label htmlFor={`order-date-${mode}`}>Order date<input id={`order-date-${mode}`} type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label><button className="text-button" onClick={() => { setDateFilter(''); setDateOpen(false); }}>Clear date</button></div>}</div></div><DataTable columns={config.columns} rows={visibleRows} onSelect={setSelected} onEdit={openEdit} onDuplicate={(record) => duplicateOrder(record.sourceId).then(() => setToast('Order duplicated as a new pending order')).catch((error) => setToast(error.response?.data?.detail || 'Unable to duplicate order'))} selectedId={selected?.id} page={page} pageCount={pageCount} pageSize={pageSize} totalCount={rows.length} onPageChange={setPage} /></div><div><DetailPanel record={selected} config={{ ...config, singular: 'Order', icon: 'bi-receipt' }} onClose={() => setSelected(null)} onUpdate={openEdit} onDelete={setConfirmCancel} deleteLabel="Cancel Order" />{selected && <button className="primary-button order-advance" onClick={advanceOrder}><i className="bi bi-arrow-right-circle" /> Advance Status</button>}</div></div>{modal && <ActionModal title={`${modal.mode === 'edit' ? 'Edit' : 'New'} Order`} fields={[{ key: 'customer', label: 'Customer', placeholder: 'Customer name', required: true }, { key: 'type', label: 'Order type', type: 'select', options: ['Dine-in', 'Takeout', 'Pickup', 'Delivery'] }, { key: 'status', label: mode === 'kitchen' ? 'Preparation status' : 'Order status', type: 'select', options: statuses }, { key: 'paymentMethod', label: 'Payment method', type: 'select', options: ['Cash', 'GCash', 'Card', 'PayMaya'] }, { key: 'date', label: 'Order date', type: 'date' }]} values={modal.values} onChange={(field, value) => setModal((current) => ({ ...current, values: { ...current.values, [field]: value } }))} onClose={() => setModal(null)} onSubmit={saveOrder} submitLabel={modal.mode === 'edit' ? 'Save Changes' : 'Create Order'} />}{confirmCancel && <ConfirmModal title="Cancel Order" message={`Cancel ${confirmCancel.orderNumber || confirmCancel.id}? The linked payment will be marked refunded and a cancellation record will be created.`} confirmLabel="Cancel Order" onClose={() => setConfirmCancel(null)} onConfirm={submitCancel} />}{toast && <Toast message={toast} onClose={() => setToast('')} />}</section>;
}
