import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActionModal } from '../components/ActionModal';
import { DataTable } from '../components/DataTable';
import { MetricCards } from '../components/MetricCards';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import { PAGE_SIZE, useAvailableDishesQuery, useOrderMutation, useOrdersQuery } from '../lib/marketplaceQueries';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const money = (value) => peso.format(Number(value || 0));
const terminalStatuses = new Set(['Completed', 'Delivered', 'Cancelled']);
const modes = {
  customer: { title: 'Customer Orders', description: 'Manage all ARGO Marketplace customer orders', columns: [['orderNumber', 'Order ID'], ['customer', 'Customer'], ['type', 'Order Type'], ['itemCountLabel', 'Items'], ['status', 'Status'], ['paymentStatus', 'Payment'], ['totalLabel', 'Total'], ['time', 'Order Time']] },
  table: { title: 'Table Orders', description: 'Manage dine-in tables, guests and service readiness', columns: [['tableLabel', 'Table'], ['server', 'Server'], ['guestsLabel', 'Guests'], ['status', 'Status'], ['totalLabel', 'Amount']] },
  takeout: { title: 'Takeout Orders', description: 'Manage takeout preparation and handover', columns: [['orderNumber', 'Order #'], ['customer', 'Customer'], ['contact', 'Contact'], ['time', 'Order Time'], ['status', 'Status'], ['paymentStatus', 'Payment'], ['totalLabel', 'Amount']] },
  pickup: { title: 'Pickup Orders', description: 'Manage and track scheduled customer pickups', columns: [['orderNumber', 'Order ID'], ['customer', 'Customer'], ['contact', 'Contact'], ['pickupTimeLabel', 'Pickup Time'], ['status', 'Status'], ['paymentStatus', 'Payment'], ['totalLabel', 'Total']] },
  delivery: { title: 'Delivery Orders', description: 'Manage delivery assignments, riders and completion', columns: [['orderNumber', 'Order ID'], ['customer', 'Customer'], ['addressLabel', 'Delivery Address'], ['status', 'Status'], ['riderLabel', 'Rider'], ['paymentStatus', 'Payment'], ['totalLabel', 'Total']] },
  kitchen: { title: 'Kitchen Preparation', description: 'Monitor and advance active kitchen preparation tickets', columns: [['orderNumber', 'Order ID'], ['customer', 'Customer'], ['itemSummary', 'Items'], ['type', 'Order Type'], ['time', 'Time'], ['kitchenStatus', 'Prep Status']] },
};

const typeForMode = (mode) => ({ table: 'Dine-in', takeout: 'Takeout', pickup: 'Pickup', delivery: 'Delivery' }[mode] || 'Dine-in');

function OperationalFields({ values, onChange }) {
  return <>
    {['Takeout', 'Pickup', 'Delivery'].includes(values.type) && <label>Contact number<span className="required-mark"> *</span><input value={values.contact || ''} placeholder="09XX XXX XXXX" onChange={(event) => onChange('contact', event.target.value)} /></label>}
    {values.type === 'Dine-in' && <><label>Table<span className="required-mark"> *</span><input value={values.table || ''} placeholder="Table 1" onChange={(event) => onChange('table', event.target.value)} /></label><label>Guests<span className="required-mark"> *</span><input type="number" min="1" max="30" value={values.guests || ''} placeholder="2" onChange={(event) => onChange('guests', event.target.value)} /></label><label>Server<input value={values.server || ''} placeholder="ARGO Floor Team" onChange={(event) => onChange('server', event.target.value)} /></label></>}
    {values.type === 'Pickup' && <label>Pickup time<span className="required-mark"> *</span><input value={values.pickupTime || ''} placeholder="Today, 11:00 AM" onChange={(event) => onChange('pickupTime', event.target.value)} /></label>}
    {values.type === 'Delivery' && <><label>Delivery address<span className="required-mark"> *</span><input value={values.address || ''} placeholder="Street, city" onChange={(event) => onChange('address', event.target.value)} /></label><label>Assigned rider<input value={values.rider || ''} placeholder="Assign before dispatch" onChange={(event) => onChange('rider', event.target.value)} /></label></>}
    <label>Order notes<input value={values.notes || ''} placeholder="Optional preparation notes" onChange={(event) => onChange('notes', event.target.value)} /></label>
  </>;
}

function OrderForm({ mode, values, dishes, onChange, onClose, onSubmit, saving }) {
  const [dishSearch, setDishSearch] = useState('');
  const selectedItems = values.items || [];
  const visibleDishes = dishes.filter((dish) => dish.name.toLowerCase().includes(dishSearch.toLowerCase()));
  const addDish = (dish) => {
    const found = selectedItems.find((item) => item.foodItemId === dish.id);
    onChange('items', found ? selectedItems.map((item) => item.foodItemId === dish.id ? { ...item, quantity: item.quantity + 1 } : item) : [...selectedItems, { foodItemId: dish.id, name: dish.name, price: dish.price, quantity: 1 }]);
  };
  const setQuantity = (id, quantity) => onChange('items', selectedItems.map((item) => item.foodItemId === id ? { ...item, quantity } : item).filter((item) => item.quantity > 0));
  const subtotal = selectedItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const serviceCharge = values.type === 'Dine-in' ? subtotal * 0.05 : 0;
  const deliveryFee = values.type === 'Delivery' ? 49 : 0;
  const tax = subtotal * 0.12;
  return <div className="modal-backdrop" role="presentation"><div className="modal-card order-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">New Order</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog" disabled={saving}><i className="bi bi-x-lg" /></button></div><div className="modal-form order-form"><div className="order-fields"><label>Customer<span className="required-mark"> *</span><input autoFocus value={values.customer} placeholder="Customer name" onChange={(event) => onChange('customer', event.target.value)} /></label><label>Order type<select value={values.type} disabled={mode !== 'customer'} onChange={(event) => onChange('type', event.target.value)}><option>Dine-in</option><option>Takeout</option><option>Pickup</option><option>Delivery</option></select></label><label>Payment method<select value={values.paymentMethod} onChange={(event) => onChange('paymentMethod', event.target.value)}><option>Cash</option><option>GCash</option><option>Card</option><option>PayMaya</option></select></label><OperationalFields values={values} onChange={onChange} /></div><div className="dish-picker"><div className="dish-picker-heading"><strong>Add dishes</strong><span>{selectedItems.length ? `${selectedItems.length} selected` : 'Select one or more dishes'}</span></div><div className="dish-search"><i className="bi bi-search" /><input value={dishSearch} onChange={(event) => setDishSearch(event.target.value)} placeholder="Search available dishes" /></div><div className="dish-list">{visibleDishes.map((dish) => <button type="button" className="dish-row" key={dish.id} onClick={() => addDish(dish)}><span><strong>{dish.name}</strong><small>{dish.category}</small></span><b>{money(dish.price)}</b><i className="bi bi-plus-circle" /></button>)}{!visibleDishes.length && <p className="empty-dishes">No available dish matches this search.</p>}</div></div><div className="order-cart"><div className="dish-picker-heading"><strong>Order items</strong><span>{selectedItems.reduce((sum, item) => sum + item.quantity, 0)} item(s)</span></div>{selectedItems.length ? selectedItems.map((item) => <div className="cart-row" key={item.foodItemId}><span><strong>{item.name}</strong><small>{money(item.price)} each</small></span><div className="quantity-control"><button type="button" aria-label={`Decrease ${item.name}`} onClick={() => setQuantity(item.foodItemId, item.quantity - 1)}><i className="bi bi-dash" /></button><span>{item.quantity}</span><button type="button" aria-label={`Increase ${item.name}`} onClick={() => setQuantity(item.foodItemId, item.quantity + 1)}><i className="bi bi-plus" /></button></div><b>{money(item.price * item.quantity)}</b></div>) : <p className="empty-dishes">Choose dishes from the list to create this order.</p>}<div className="order-total"><span>Subtotal</span><b>{money(subtotal)}</b><span>Service / delivery / tax</span><b>{money(serviceCharge + deliveryFee + tax)}</b><strong>Total</strong><strong>{money(subtotal + serviceCharge + deliveryFee + tax)}</strong></div></div></div><div className="modal-actions"><button className="outline-button" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-button" onClick={onSubmit} disabled={saving || !selectedItems.length}>{saving ? 'Creating...' : 'Create Order'}</button></div></div></div>;
}

function OrderDetail({ record, mode, onClose, onEdit, onCancel, onAdvance, advanceLabel, canAdvance, canEdit, canCancel, busy }) {
  if (!record) return <div className="detail-panel empty-detail"><i className="bi bi-receipt" /><h3>Order Details</h3><p>Select an order to inspect its live operational state.</p></div>;
  return <aside className="detail-panel order-detail"><div className="detail-heading"><div><h3>Order Details</h3><span>{record.orderNumber} · {record.date} {record.time}</span></div><button className="icon-button" onClick={onClose} aria-label="Close details"><i className="bi bi-x-lg" /></button></div><div className="order-detail-status"><StatusBadge value={mode === 'kitchen' ? record.kitchenStatus : record.status} /><StatusBadge value={record.paymentStatus} /></div><div className="detail-fields"><div className="detail-field"><small>Customer</small><strong>{record.customer}</strong></div><div className="detail-field"><small>Order type</small><strong>{record.type}</strong></div>{record.contact && record.contact !== '—' && <div className="detail-field"><small>Contact</small><strong>{record.contact}</strong></div>}{record.table && <div className="detail-field"><small>Table / guests</small><strong>{record.table} · {record.guests} guest(s)</strong></div>}{record.pickupTime && <div className="detail-field"><small>Pickup time</small><strong>{record.pickupTime}</strong></div>}{record.address && <div className="detail-field"><small>Delivery address</small><strong>{record.address}</strong></div>}{record.type === 'Delivery' && <div className="detail-field"><small>Assigned rider</small><strong>{record.rider || 'Not assigned'}</strong></div>}{record.cancellationStatus && <div className="detail-field"><small>Cancellation</small><strong><StatusBadge value={record.cancellationStatus} /> {record.cancellationReason}</strong></div>}</div><div className="order-items"><h4>Order items</h4>{record.items.map((item) => <div key={`${item.id}-${item.name}`}><span>{item.name} ×{item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}</div><div className="order-total compact"><span>Subtotal</span><b>{money(record.subtotal)}</b>{record.serviceCharge > 0 && <><span>Service charge</span><b>{money(record.serviceCharge)}</b></>}{record.deliveryFee > 0 && <><span>Delivery fee</span><b>{money(record.deliveryFee)}</b></>}<span>Tax</span><b>{money(record.tax)}</b><strong>Total</strong><strong>{money(record.total)}</strong></div>{canAdvance && <button className="primary-button" onClick={onAdvance} disabled={busy}><i className="bi bi-arrow-right-circle" /> {advanceLabel}</button>}{canEdit && <button className="outline-button detail-action" onClick={onEdit} disabled={busy}><i className="bi bi-pencil" /> Edit Order Details</button>}{canCancel && <button className="danger-button" onClick={onCancel} disabled={busy}><i className="bi bi-x-circle" /> Request Cancellation</button>}<button className="outline-button detail-action" onClick={() => window.print()}><i className="bi bi-printer" /> Print Order</button></aside>;
}

function editFields(type, allowType) {
  const fields = [{ key: 'customer', label: 'Customer', required: true }];
  if (allowType) fields.push({ key: 'type', label: 'Order type', type: 'select', options: ['Dine-in', 'Takeout', 'Pickup', 'Delivery'] });
  fields.push({ key: 'paymentMethod', label: 'Payment method', type: 'select', options: ['Cash', 'GCash', 'Card', 'PayMaya'] });
  if (['Takeout', 'Pickup', 'Delivery'].includes(type)) fields.push({ key: 'contact', label: 'Contact number', required: true });
  if (type === 'Dine-in') fields.push({ key: 'table', label: 'Table', required: true }, { key: 'guests', label: 'Guests', type: 'number', min: 1, max: 30, required: true }, { key: 'server', label: 'Server' });
  if (type === 'Pickup') fields.push({ key: 'pickupTime', label: 'Pickup time', required: true });
  if (type === 'Delivery') fields.push({ key: 'address', label: 'Delivery address', required: true }, { key: 'rider', label: 'Assigned rider', helper: 'A rider is required before dispatch.' });
  fields.push({ key: 'notes', label: 'Order notes' });
  return fields;
}

export function OrdersPage({ mode }) {
  const config = modes[mode];
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [dateFilter, setDateFilter] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [cancelRequest, setCancelRequest] = useState(null);
  const [toast, setToast] = useState('');
  const query = useOrdersQuery({ mode, page, search, status: statusFilter, date: dateFilter });
  const dishesQuery = useAvailableDishesQuery();
  const mutation = useOrderMutation();
  useEffect(() => setSearch(searchParams.get('search') || ''), [searchParams]);
  useEffect(() => { setPage(1); setSelected(null); }, [mode]);
  useEffect(() => setPage(1), [search, statusFilter, dateFilter]);
  useEffect(() => { if (query.data && page > query.data.pageCount) setPage(query.data.pageCount); }, [page, query.data]);
  const rows = useMemo(() => (query.data?.items || []).map((order) => ({ ...order, sourceId: order.id, totalLabel: money(order.total), itemCountLabel: `${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`, guestsLabel: order.guests ? `${order.guests} guests` : '—', tableLabel: order.table || 'Unassigned', pickupTimeLabel: order.pickupTime || 'Not scheduled', addressLabel: order.address || 'No address', riderLabel: order.rider || 'Unassigned' })), [query.data?.items]);
  useEffect(() => {
    if (!selected) return;
    const refreshed = rows.find((row) => row.id === selected.id);
    if (refreshed && JSON.stringify(refreshed) !== JSON.stringify(selected)) setSelected(refreshed);
  }, [rows, selected]);
  const openCreate = () => setModal({ mode: 'create', values: { customer: '', type: typeForMode(mode), paymentMethod: 'Cash', contact: '', table: '', guests: '', server: 'ARGO Floor Team', pickupTime: '', address: '', rider: '', notes: '', items: [] } });
  const openEdit = (record) => setModal({ mode: 'edit', record, values: { customer: record.customer, type: record.type, paymentMethod: record.paymentMethod, contact: record.contact === '—' ? '' : record.contact, table: record.table || '', guests: record.guests || '', server: record.server || '', pickupTime: record.pickupTime || '', address: record.address || '', rider: record.rider || '', notes: record.notes || '' } });
  const saveOrder = async () => {
    if (modal.mode === 'create' && (!modal.values.customer.trim() || !modal.values.items.length)) return setToast('Add a customer and at least one dish before creating the order');
    try {
      await mutation.mutateAsync({ action: modal.mode === 'create' ? 'create' : 'update', id: modal.record?.sourceId, values: modal.values });
      setSelected(null); setModal(null); setToast(modal.mode === 'create' ? 'Order created and synchronized across operations' : 'Order details updated across all modules');
    } catch (error) { setToast(error.response?.data?.detail || 'Unable to save order'); }
  };
  const advanceOrder = async () => {
    try {
      const response = await mutation.mutateAsync({ action: 'advance', id: selected.sourceId, values: { event: mode === 'kitchen' ? 'advance_kitchen' : 'advance_fulfillment' } });
      setSelected(null); setToast(`Order advanced to ${mode === 'kitchen' ? response.data.kitchenStatus : response.data.status}`);
    } catch (error) { setToast(error.response?.data?.detail || 'Unable to advance order'); }
  };
  const submitCancel = async () => {
    try { await mutation.mutateAsync({ action: 'cancel', id: cancelRequest.record.sourceId, values: { reason: cancelRequest.reason } }); setSelected(null); setCancelRequest(null); setToast('Cancellation request sent for administrator review'); }
    catch (error) { setToast(error.response?.data?.detail || 'Unable to request cancellation'); }
  };
  const duplicateOrder = async (record) => {
    try { await mutation.mutateAsync({ action: 'duplicate', id: record.sourceId }); setToast('Order duplicated as a new pending order'); }
    catch (error) { setToast(error.response?.data?.detail || 'Unable to duplicate order'); }
  };
  const mutable = (record) => !terminalStatuses.has(record.status) && record.cancellationStatus !== 'Pending Review';
  const canEdit = (record) => mode !== 'kitchen' && mutable(record);
  const canDuplicate = (record) => ['customer', 'takeout', 'delivery'].includes(mode) && ['Takeout', 'Delivery'].includes(record.type);
  const canCancel = selected && mode !== 'kitchen' && mutable(selected);
  const canAdvance = selected && (mode === 'kitchen' ? ['Pending', 'Preparing'].includes(selected.kitchenStatus) : mode === 'delivery' ? ['Ready for Dispatch', 'Out for Delivery'].includes(selected.status) : ['table', 'takeout', 'pickup'].includes(mode) && ['Ready', 'Ready for Pickup'].includes(selected.status));
  const advanceLabel = mode === 'kitchen' ? (selected?.kitchenStatus === 'Pending' ? 'Start Preparing' : 'Mark Ready') : mode === 'delivery' ? (selected?.status === 'Ready for Dispatch' ? 'Dispatch Order' : 'Mark Delivered') : mode === 'table' ? 'Complete Service' : 'Mark Handed Over';
  const statuses = mode === 'kitchen' ? ['Pending', 'Preparing', 'Ready'] : mode === 'delivery' ? ['Pending', 'Preparing', 'Ready for Dispatch', 'Out for Delivery', 'Delivered', 'Cancelled'] : mode === 'table' ? ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'] : mode === 'customer' ? ['Pending', 'Preparing', 'Ready', 'Ready for Pickup', 'Ready for Dispatch', 'Out for Delivery', 'Delivered', 'Completed', 'Cancelled'] : ['Pending', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'];
  return <section className="page-content"><div className="page-heading"><div><h1>{config.title}</h1><p>{config.description}</p></div>{mode !== 'kitchen' && <button className="primary-button" onClick={openCreate}><i className="bi bi-plus-lg" /> New Order</button>}</div><MetricCards metrics={query.data?.metrics || []} /><div className="content-grid"><div className="list-card"><div className="toolbar"><div className="field-search"><i className="bi bi-search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders, customers, tables..." /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All Status</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><div className="date-filter-wrap"><button className={`outline-button ${dateFilter ? 'button-selected' : ''}`} aria-label={dateFilter ? 'Change selected date' : 'Select date'} onClick={() => setDateOpen((open) => !open)}><i className="bi bi-calendar3" /></button>{dateOpen && <div className="date-popover"><label htmlFor={`order-date-${mode}`}>Order date<input id={`order-date-${mode}`} type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label><button className="text-button" onClick={() => { setDateFilter(''); setDateOpen(false); }}>Clear date</button></div>}</div></div><DataTable columns={config.columns} rows={rows} loading={query.isLoading && !query.data} onSelect={setSelected} onEdit={mode === 'kitchen' ? undefined : openEdit} onDuplicate={['customer', 'takeout', 'delivery'].includes(mode) ? duplicateOrder : undefined} canEdit={canEdit} canDuplicate={canDuplicate} selectedId={selected?.id} page={query.data?.page || page} pageCount={query.data?.pageCount || 1} pageSize={PAGE_SIZE} totalCount={query.data?.total || 0} onPageChange={setPage} /></div><OrderDetail record={selected} mode={mode} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onCancel={() => setCancelRequest({ record: selected, reason: '' })} onAdvance={advanceOrder} advanceLabel={advanceLabel} canAdvance={canAdvance} canEdit={selected ? canEdit(selected) : false} canCancel={canCancel} busy={mutation.isPending} /></div>{modal?.mode === 'create' && <OrderForm mode={mode} values={modal.values} dishes={dishesQuery.data || []} saving={mutation.isPending} onChange={(field, value) => setModal((current) => ({ ...current, values: { ...current.values, [field]: value } }))} onClose={() => setModal(null)} onSubmit={saveOrder} />}{modal?.mode === 'edit' && <ActionModal title="Edit Order Details" fields={editFields(modal.values.type, mode === 'customer')} values={modal.values} saving={mutation.isPending} onChange={(field, value) => setModal((current) => ({ ...current, values: { ...current.values, [field]: value } }))} onClose={() => setModal(null)} onSubmit={saveOrder} submitLabel="Save Details" />}{cancelRequest && <ActionModal title="Request Cancellation" fields={[{ key: 'reason', label: 'Cancellation reason', placeholder: 'Explain why this order should be cancelled', required: true }]} values={cancelRequest} saving={mutation.isPending} onChange={(_, value) => setCancelRequest((current) => ({ ...current, reason: value }))} onClose={() => setCancelRequest(null)} onSubmit={submitCancel} submitLabel="Send for Review" />}{toast && <Toast message={toast} onClose={() => setToast('')} />}</section>;
}
