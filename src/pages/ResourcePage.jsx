import { useEffect, useMemo, useState } from 'react';
import { MetricCards } from '../components/MetricCards';
import { DataTable } from '../components/DataTable';
import { DetailPanel } from '../components/DetailPanel';
import { ActionModal } from '../components/ActionModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { PAGE_SIZE, useResourceMutation, useResourceQuery } from '../lib/marketplaceQueries';

const keyByTitle = { 'Manage Menus': 'menus', Categories: 'categories', 'Food Items': 'foodItems', 'Food Options': 'foodOptions', Payments: 'payments', Discounts: 'discounts', Cancellations: 'cancellations' };

export function ResourcePage({ config }) {
  const key = keyByTitle[config.title];
  const searchLabel = config.singular === 'Category' ? 'categories' : `${config.singular.toLowerCase()}s`;
  const readOnly = ['payments', 'cancellations'].includes(key);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [sort, setSort] = useState('Sort by: Name (A-Z)');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState('');
  const query = useResourceQuery({ key, page, search, status: statusFilter, sort });
  const categoriesQuery = useResourceQuery({ key: 'categories', page: 1, search: '', status: 'Active', sort: 'Sort by: Name (A-Z)' });
  const mutation = useResourceMutation(key);
  const fields = useMemo(() => {
    const base = config.formFields || [{ key: 'name', label: `${config.singular} name`, placeholder: `Enter ${config.singular.toLowerCase()} name`, required: true }, { key: 'description', label: 'Description', placeholder: 'Add a short description' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Scheduled'] }];
    if (key !== 'foodItems') return base;
    return base.map((field) => field.key === 'category' ? { ...field, options: (categoriesQuery.data?.items || []).map((row) => row.name) } : field);
  }, [categoriesQuery.data?.items, config.formFields, config.singular, key]);
  const fieldValues = (record = {}) => fields.reduce((values, field) => {
    const fallback = field.key === 'name' ? record.name || record.code || record.id || '' : field.defaultValue ?? (field.type === 'select' ? field.options?.[0] || '' : '');
    values[field.key] = record[field.key] ?? fallback;
    return values;
  }, {});
  useEffect(() => { setPage(1); setSelected(null); }, [key]);
  useEffect(() => { setPage(1); }, [search, statusFilter, sort]);
  useEffect(() => {
    if (query.data && page > query.data.pageCount) setPage(query.data.pageCount);
  }, [page, query.data]);
  const rows = query.data?.items || [];
  const openCreate = () => setModal({ mode: 'create', values: fieldValues() });
  const openEdit = (record) => setModal({ mode: 'edit', record, values: fieldValues(record) });
  const saveRecord = async () => {
    const required = fields.filter((field) => field.required);
    if (required.some((field) => !String(modal.values[field.key] ?? '').trim())) return setToast('Complete all required fields before saving');
    try {
      await mutation.mutateAsync({ action: modal.mode === 'edit' ? 'update' : 'create', id: modal.record?.id, values: modal.values });
      setToast(`${config.singular} ${modal.mode === 'edit' ? 'updated' : 'created'} successfully`);
      setSelected(null);
      setModal(null);
    } catch (error) { setToast(error.response?.data?.detail || `Unable to save ${config.singular.toLowerCase()}`); }
  };
  const performDelete = async () => {
    try {
      await mutation.mutateAsync({ action: 'delete', id: confirmDelete.id });
      setSelected(null); setConfirmDelete(null); setToast(`${config.singular} deleted successfully`);
    } catch (error) { setToast(error.response?.data?.detail || `Unable to delete ${config.singular.toLowerCase()}`); }
  };
  const handleDuplicate = async (record) => {
    try { await mutation.mutateAsync({ action: 'duplicate', record }); setToast(`${config.singular} duplicated successfully`); }
    catch (error) { setToast(error.response?.data?.detail || `Unable to duplicate ${config.singular.toLowerCase()}`); }
  };
  const metrics = query.data?.metrics || [];
  const loading = query.isLoading && !query.data;
  return <section className="page-content"><div className="page-heading"><div><h1>{config.title}</h1><p>{config.description}</p></div>{!readOnly && <button className="primary-button" onClick={openCreate}><i className="bi bi-plus-lg" /> Add {config.singular}</button>}</div><MetricCards metrics={metrics} /><div className="content-grid"><div className="list-card"><div className="toolbar"><div className="field-search"><i className="bi bi-search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${searchLabel}...`} /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All Status</option><option>Active</option><option>Inactive</option><option>Scheduled</option><option>Pending Review</option><option>Paid</option><option>Refunded</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Sort by: Name (A-Z)</option><option>Recently updated</option></select><button className={`outline-button ${showFilters ? 'button-selected' : ''}`} aria-label="Toggle filters" onClick={() => setShowFilters((open) => !open)}><i className="bi bi-funnel" /></button></div>{showFilters && <div className="filter-note"><i className="bi bi-sliders" /> Results are loaded live and refresh after every successful change.</div>}<DataTable columns={config.columns} rows={rows} loading={loading} onSelect={setSelected} onEdit={readOnly ? undefined : openEdit} onDuplicate={readOnly ? undefined : handleDuplicate} onDelete={readOnly ? undefined : setConfirmDelete} selectedId={selected?.id} page={query.data?.page || page} pageCount={query.data?.pageCount || 1} pageSize={PAGE_SIZE} totalCount={query.data?.total || 0} onPageChange={setPage} /></div><DetailPanel record={selected} config={config} onClose={() => setSelected(null)} onUpdate={readOnly ? undefined : openEdit} onDelete={readOnly ? undefined : setConfirmDelete} /></div>{modal && <ActionModal title={`${modal.mode === 'edit' ? 'Edit' : 'Add'} ${config.singular}`} fields={fields} values={modal.values} saving={mutation.isPending} onChange={(field, value) => setModal((current) => ({ ...current, values: { ...current.values, [field]: value } }))} onClose={() => setModal(null)} onSubmit={saveRecord} submitLabel={modal.mode === 'edit' ? 'Save Changes' : `Create ${config.singular}`} />}{confirmDelete && <ConfirmModal title={`Delete ${config.singular}`} message={`Delete ${confirmDelete.name || confirmDelete.code || confirmDelete.customer || confirmDelete.id}? This action cannot be undone.`} confirmLabel={`Delete ${config.singular}`} onClose={() => setConfirmDelete(null)} onConfirm={performDelete} />}{toast && <Toast message={toast} onClose={() => setToast('')} />}</section>;
}
