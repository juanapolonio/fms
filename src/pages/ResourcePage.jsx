import { useMemo, useState } from 'react';
import { MetricCards } from '../components/MetricCards';
import { DataTable } from '../components/DataTable';
import { DetailPanel } from '../components/DetailPanel';
import { ActionModal } from '../components/ActionModal';
import { Toast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { money, useMarketplaceStore } from '../stores/useMarketplaceStore';

const keyByTitle = {
  'Manage Menus': 'menus', Categories: 'categories', 'Food Items': 'foodItems', 'Food Options': 'foodOptions',
  Payments: 'payments', Discounts: 'discounts', Cancellations: 'cancellations',
};

const number = (value) => Number(String(value || 0).replace(/[^0-9.-]/g, '')) || 0;

function getMetrics(config, rows, orders) {
  const active = rows.filter((row) => ['Active', 'Paid', 'Approved'].includes(row.status)).length;
  const inactive = rows.filter((row) => ['Inactive', 'Failed', 'Refunded'].includes(row.status)).length;
  const orderSales = orders.filter((order) => !['Cancelled', 'Pending'].includes(order.paymentStatus)).reduce((sum, order) => sum + order.total, 0);
  if (config.title === 'Payments') {
    const paid = rows.filter((row) => row.status === 'Paid').reduce((sum, row) => sum + (row.amountValue || number(row.amount)), 0);
    const pending = rows.filter((row) => row.status === 'Pending').reduce((sum, row) => sum + (row.amountValue || number(row.amount)), 0);
    const refunded = rows.filter((row) => row.status === 'Refunded').reduce((sum, row) => sum + (row.amountValue || number(row.amount)), 0);
    return [[money(rows.reduce((sum, row) => sum + (row.amountValue || number(row.amount)), 0)), 'Total Payments'], [money(paid), 'Paid Amount'], [money(pending), 'Pending'], [money(refunded), 'Refunded'], [String(rows.length), 'Transactions']];
  }
  if (config.title === 'Cancellations') {
    const refunds = rows.reduce((sum, row) => sum + (row.refundValue || number(row.refund)), 0);
    return [[String(rows.length), 'Total Cancellations'], [String(rows.filter((row) => row.status === 'Pending Review').length), 'Pending Review'], [String(rows.filter((row) => row.status === 'Approved').length), 'Approved'], [String(rows.filter((row) => row.status === 'Refunded').length), 'Refunded'], [money(refunds), 'Total Refunded']];
  }
  if (config.title === 'Discounts') return [[String(rows.length), 'Total Discounts'], [String(rows.filter((row) => row.status === 'Active').length), 'Active Discounts'], [String(rows.filter((row) => row.status === 'Scheduled').length), 'Scheduled'], [String(rows.filter((row) => row.status === 'Inactive').length), 'Inactive'], [money(orders.reduce((sum, order) => sum + order.discount, 0)), 'Discount Given']];
  if (config.title === 'Food Items') return [[String(rows.length), 'Total Items'], [String(active), 'Active Items'], [String(inactive), 'Inactive Items'], [money(orderSales), 'Total Sales'], ['4.7', 'Average Rating']];
  if (config.title === 'Food Options') return [[String(rows.length), 'Total Options'], [String(active), 'Active Options'], [String(inactive), 'Inactive Options'], [String(rows.reduce((sum, row) => sum + Number(row.choices || 0), 0)), 'Total Choices'], [money(orderSales * 0.12), 'Option Sales']];
  if (config.title === 'Categories') return [[String(rows.length), 'Total Categories'], [String(active), 'Active Categories'], [String(inactive), 'Inactive Categories'], [String(orders.reduce((sum, order) => sum + order.itemCount, 0)), 'Items Sold'], [money(orderSales), 'Category Sales']];
  return [[String(rows.length), 'Total Menus'], [String(active), 'Active Menus'], [String(inactive), 'Inactive Menus'], [String(orders.reduce((sum, order) => sum + order.itemCount, 0)), 'Items Sold'], [money(orderSales), 'Menu Sales']];
}

export function ResourcePage({ config }) {
  const key = keyByTitle[config.title];
  const searchLabel = config.singular === 'Category' ? 'categories' : `${config.singular.toLowerCase()}s`;
  const rows = useMarketplaceStore((state) => state.resources[key] || []);
  const orders = useMarketplaceStore((state) => state.orders);
  const addResource = useMarketplaceStore((state) => state.addResource);
  const updateResource = useMarketplaceStore((state) => state.updateResource);
  const deleteResource = useMarketplaceStore((state) => state.deleteResource);
  const duplicateResource = useMarketplaceStore((state) => state.duplicateResource);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [sort, setSort] = useState('Sort by: Name (A-Z)');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState('');
  const fields = config.formFields || [{ key: 'name', label: `${config.singular} name`, placeholder: `Enter ${config.singular.toLowerCase()} name`, required: true }, { key: 'description', label: 'Description', placeholder: 'Add a short description' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Scheduled'] }];
  const fieldValues = (record = {}) => fields.reduce((values, field) => {
    const fallback = field.key === 'name' ? record.name || record.code || record.id || '' : field.defaultValue || (field.type === 'select' ? field.options?.[0] || '' : '');
    values[field.key] = record[field.key] ?? fallback;
    return values;
  }, {});
  const filteredRows = useMemo(() => rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'All Status' || row.status === statusFilter)).sort((a, b) => sort === 'Recently updated' ? String(b.id).localeCompare(String(a.id)) : String(a.name || a.code || a.customer || a.id || '').localeCompare(String(b.name || b.code || b.customer || b.id || ''))), [rows, search, statusFilter, sort]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const metrics = useMemo(() => getMetrics(config, rows, orders), [config, rows, orders]);
  const openCreate = () => setModal({ mode: 'create', values: fieldValues() });
  const openEdit = (record) => setModal({ mode: 'edit', record, values: fieldValues(record) });
  const saveRecord = () => {
    const requiredFields = fields.filter((field) => field.required !== false);
    if (requiredFields.some((field) => !String(modal.values[field.key] ?? '').trim())) return;
    if (modal.mode === 'edit') {
      updateResource(key, modal.record.id, modal.values);
      setSelected((current) => current?.id === modal.record.id ? { ...modal.record, ...modal.values } : current);
    } else addResource(key, { ...modal.values, items: 0, order: rows.length + 1 });
    setToast(`${config.singular} ${modal.mode === 'edit' ? 'updated' : 'created'} successfully`);
    setModal(null);
  };
  const performDelete = () => {
    deleteResource(key, confirmDelete.id);
    setSelected(null);
    setConfirmDelete(null);
    setToast(`${config.singular} deleted successfully`);
  };
  const handleDuplicate = (record) => {
    duplicateResource(key, record);
    setToast(`${config.singular} duplicated successfully`);
  };
  return <section className="page-content"><div className="page-heading"><div><h1>{config.title}</h1><p>{config.description}</p></div><button className="primary-button" onClick={openCreate}><i className="bi bi-plus-lg" /> Add {config.singular}</button></div><MetricCards metrics={metrics} /><div className="content-grid"><div className="list-card"><div className="toolbar"><div className="field-search"><i className="bi bi-search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${searchLabel}...`} /></div><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option>All Status</option><option>Active</option><option>Inactive</option><option>Scheduled</option><option>Pending Review</option><option>Paid</option><option>Refunded</option></select><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option>Sort by: Name (A-Z)</option><option>Recently updated</option></select><button className={`outline-button ${showFilters ? 'button-selected' : ''}`} aria-label="Toggle filters" onClick={() => setShowFilters((open) => !open)}><i className="bi bi-funnel" /></button></div>{showFilters && <div className="filter-note"><i className="bi bi-sliders" /> Results and summaries update from the shared ARGO demo dataset.</div>}<DataTable columns={config.columns} rows={visibleRows} onSelect={setSelected} onEdit={openEdit} onDuplicate={handleDuplicate} selectedId={selected?.id} page={page} pageCount={pageCount} pageSize={pageSize} totalCount={filteredRows.length} onPageChange={setPage} /></div><DetailPanel record={selected} config={config} onClose={() => setSelected(null)} onUpdate={openEdit} onDelete={setConfirmDelete} /></div>{modal && <ActionModal title={`${modal.mode === 'edit' ? 'Edit' : 'Add'} ${config.singular}`} fields={fields} values={modal.values} onChange={(field, value) => setModal((current) => ({ ...current, values: { ...current.values, [field]: value } }))} onClose={() => setModal(null)} onSubmit={saveRecord} submitLabel={modal.mode === 'edit' ? 'Save Changes' : `Create ${config.singular}`} />}{confirmDelete && <ConfirmModal title={`Delete ${config.singular}`} message={`Delete ${confirmDelete.name || confirmDelete.code || confirmDelete.customer || confirmDelete.id}? This action cannot be undone.`} confirmLabel={`Delete ${config.singular}`} onClose={() => setConfirmDelete(null)} onConfirm={performDelete} />}{toast && <Toast message={toast} onClose={() => setToast('')} />}</section>;
}
