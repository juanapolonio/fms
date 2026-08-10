import { create } from 'zustand';
import { api } from '../lib/api';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export const money = (value) => peso.format(Number(value || 0));

const resourcePaths = {
  menus: 'menus',
  categories: 'categories',
  foodItems: 'foodItems',
  foodOptions: 'foodOptions',
  discounts: 'discounts',
  payments: 'payments',
  cancellations: 'cancellations',
};

const emptyResources = { menus: [], categories: [], foodItems: [], foodOptions: [], payments: [], discounts: [], cancellations: [] };

const loadSnapshot = async () => {
  const response = await api.get('/snapshot');
  return response.data;
};

export const useMarketplaceStore = create((set, get) => ({
  resources: emptyResources,
  orders: [],
  loadState: 'idle',
  loadError: '',
  loadLiveData: async () => {
    set({ loadState: 'loading', loadError: '' });
    try {
      const snapshot = await loadSnapshot();
      set({ resources: { ...emptyResources, ...snapshot.resources }, orders: snapshot.orders || [], loadState: 'ready', loadError: '' });
      return snapshot;
    } catch (error) {
      const message = error.response?.data?.detail || error.message || 'Unable to load live ARGO data';
      set({ loadState: 'error', loadError: message });
      throw error;
    }
  },
  refresh: async () => get().loadLiveData(),
  addResource: async (key, values) => {
    await api.post(`/resources/${resourcePaths[key]}`, values);
    await get().refresh();
  },
  updateResource: async (key, id, values) => {
    await api.patch(`/resources/${resourcePaths[key]}/${id}`, values);
    await get().refresh();
  },
  deleteResource: async (key, id) => {
    await api.delete(`/resources/${resourcePaths[key]}/${id}`);
    await get().refresh();
  },
  duplicateResource: async (key, record) => {
    const values = { ...record, name: `${record.name || record.code || 'Record'} Copy` };
    delete values.id;
    if (key === 'foodItems') delete values.categoryId;
    await api.post(`/resources/${resourcePaths[key]}`, values);
    await get().refresh();
  },
  createOrder: async (payload) => {
    await api.post('/orders', payload);
    await get().refresh();
  },
  updateOrder: async (id, values) => {
    await api.patch(`/orders/${id}`, values);
    await get().refresh();
  },
  transitionOrder: async (id, status) => {
    await api.post(`/orders/${id}/advance`, { status });
    await get().refresh();
  },
  cancelOrder: async (id) => {
    await api.post(`/orders/${id}/cancel`);
    await get().refresh();
  },
  duplicateOrder: async (id) => {
    await api.post(`/orders/${id}/duplicate`);
    await get().refresh();
  },
}));

export const orderMetrics = (orders, mode) => {
  const scoped = mode === 'table' ? orders.filter((order) => order.type === 'Dine-in') : mode === 'takeout' ? orders.filter((order) => order.type === 'Takeout') : mode === 'pickup' ? orders.filter((order) => order.type === 'Pickup') : mode === 'delivery' ? orders.filter((order) => order.type === 'Delivery') : mode === 'kitchen' ? orders.filter((order) => !['Cancelled', 'Delivered', 'Completed'].includes(order.kitchenStatus)) : orders;
  const amount = scoped.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const count = (status) => scoped.filter((order) => order.status === status || order.kitchenStatus === status).length;
  if (mode === 'table') return [[String(new Set(scoped.map((order) => order.table).filter(Boolean)).size), 'Occupied Tables'], [String(count('Preparing')), 'Preparing'], [String(count('Ready')), 'Ready to Serve'], [String(count('Completed')), 'Completed'], [money(amount), 'Table Sales']];
  if (mode === 'takeout') return [[String(scoped.length), 'Takeout Orders'], [String(count('Ready for Pickup')), 'Ready for Pickup'], [String(count('Preparing')), 'Preparing'], [String(count('Completed')), 'Completed'], [money(amount), 'Takeout Sales']];
  if (mode === 'pickup') return [[String(scoped.length), 'Pickup Orders'], [String(count('Pending')), 'Pending'], [String(count('Ready for Pickup')), 'Ready for Pickup'], [String(count('Completed')), 'Completed'], [String(count('Cancelled')), 'Cancelled']];
  if (mode === 'delivery') return [[String(scoped.length), 'Delivery Orders'], [String(count('Pending')), 'Pending'], [String(count('Out for Delivery')), 'Out for Delivery'], [String(count('Delivered')), 'Delivered'], [String(count('Cancelled')), 'Cancelled']];
  if (mode === 'kitchen') return [[String(scoped.length), 'Kitchen Queue'], [String(count('Pending')), 'Pending'], [String(count('Preparing')), 'Preparing'], [String(count('Ready')), 'Ready'], [String(count('Cancelled')), 'Cancelled']];
  return [[String(scoped.length), 'Total Orders'], [String(count('Preparing')), 'Preparing'], [String(count('Out for Delivery')), 'Out for Delivery'], [String(count('Completed') + count('Delivered')), 'Completed'], [String(count('Cancelled')), 'Cancelled']];
};
