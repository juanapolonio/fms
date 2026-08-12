import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const PAGE_SIZE = 10;
const marketplaceChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('argo-marketplace-sync');

function notifyMarketplaceChange() {
  marketplaceChannel?.postMessage({ type: 'marketplace-change', at: Date.now() });
}

export function installMarketplaceSync(queryClient) {
  if (!marketplaceChannel) return () => undefined;
  const refresh = (event) => {
    if (event.data?.type !== 'marketplace-change') return;
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['resource'] });
    queryClient.invalidateQueries({ queryKey: ['available-dishes'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  };
  marketplaceChannel.addEventListener('message', refresh);
  return () => marketplaceChannel.removeEventListener('message', refresh);
}

async function fetchResource({ key, page, search, status, sort, availableOnly = false }) {
  const { data } = await api.get(`/resources/${key}`, { params: { page, page_size: PAGE_SIZE, search: search || undefined, status: status === 'All Status' ? undefined : status, sort: sort === 'Recently updated' ? 'recent' : 'name', available_only: availableOnly || undefined } });
  return data;
}

export function useResourceQuery({ key, page, search, status, sort, availableOnly = false }) {
  return useQuery({
    queryKey: ['resource', key, page, search, status, sort, availableOnly],
    queryFn: () => fetchResource({ key, page, search, status, sort, availableOnly }),
    placeholderData: keepPreviousData,
    staleTime: 8_000,
    refetchInterval: ['payments', 'cancellations'].includes(key) ? 10_000 : false,
    refetchOnWindowFocus: 'always',
  });
}

export function useOrdersQuery({ mode, page, search, status, date }) {
  return useQuery({
    queryKey: ['orders', mode, page, search, status, date],
    queryFn: async () => (await api.get('/orders', { params: { mode, page, page_size: PAGE_SIZE, search: search || undefined, status: status === 'All Status' ? undefined : status, date: date || undefined } })).data,
    placeholderData: keepPreviousData,
    staleTime: 4_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: 'always',
  });
}

export function useAvailableDishesQuery() {
  return useQuery({
    queryKey: ['available-dishes'],
    queryFn: async () => (await api.get('/resources/foodItems', { params: { page: 1, page_size: 100, available_only: true, sort: 'name' } })).data.items || [],
    staleTime: 30_000,
  });
}

export function useReportQuery() {
  return useQuery({ queryKey: ['reports'], queryFn: async () => (await api.get('/reports')).data, staleTime: 8_000, refetchOnWindowFocus: 'always' });
}

function invalidateOperations(queryClient) {
  return queryClient.invalidateQueries({ queryKey: ['orders'] });
}

async function invalidateAllOperations(queryClient) {
  await Promise.all([
    invalidateOperations(queryClient),
    queryClient.invalidateQueries({ queryKey: ['resource', 'payments'] }),
    queryClient.invalidateQueries({ queryKey: ['resource', 'cancellations'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
  ]);
  notifyMarketplaceChange();
}

export function useResourceMutation(key) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, values, record }) => {
      if (action === 'create') return api.post(`/resources/${key}`, values);
      if (action === 'update') return api.patch(`/resources/${key}/${id}`, values);
      if (action === 'delete') return api.delete(`/resources/${key}/${id}`);
      const copy = { ...record, name: `${record.name || record.code || 'Record'} Copy` };
      delete copy.id;
      if (key === 'foodItems') delete copy.categoryId;
      return api.post(`/resources/${key}`, copy);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resource', key] });
      if (key === 'foodItems') await queryClient.invalidateQueries({ queryKey: ['available-dishes'] });
      if (['foodItems', 'categories', 'discounts'].includes(key)) await invalidateAllOperations(queryClient);
      else notifyMarketplaceChange();
    },
  });
}

export function useOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, values }) => {
      if (action === 'create') return api.post('/orders', values);
      if (action === 'update') return api.patch(`/orders/${id}`, values);
      if (action === 'advance') return api.post(`/orders/${id}/advance`, values);
      if (action === 'cancel') return api.post(`/orders/${id}/cancel`, values);
      return api.post(`/orders/${id}/duplicate`);
    },
    onSuccess: async () => {
      await invalidateAllOperations(queryClient);
    },
  });
}

export function usePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.post(`/payments/${id}/status`, { status }),
    onSuccess: () => invalidateAllOperations(queryClient),
  });
}

export function useCancellationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, notes }) => api.post(`/cancellations/${id}/resolve`, { decision, notes }),
    onSuccess: () => invalidateAllOperations(queryClient),
  });
}
