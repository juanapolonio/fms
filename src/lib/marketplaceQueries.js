import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const PAGE_SIZE = 10;
const OPERATION_REFRESH_INTERVAL = 45_000;
const marketplaceChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('argo-marketplace-sync');

function useDebouncedValue(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debouncedValue;
}

function notifyMarketplaceChange() {
  marketplaceChannel?.postMessage({ type: 'marketplace-change', at: Date.now() });
}

function invalidate(queryClient, queryKey) {
  void queryClient.invalidateQueries({ queryKey });
}

function patchOrderCaches(queryClient, orderId, patch) {
  queryClient.setQueriesData({ queryKey: ['orders'] }, (previous) => {
    if (!previous?.items) return previous;
    return {
      ...previous,
      items: previous.items.map((item) => item.id === orderId ? { ...item, ...patch } : item),
    };
  });
}

function patchPaymentCaches(queryClient, paymentId, patch) {
  let orderId;
  queryClient.setQueriesData({ queryKey: ['resource', 'payments'] }, (previous) => {
    if (!previous?.items) return previous;
    return {
      ...previous,
      items: previous.items.map((item) => {
        if (item.id !== paymentId) return item;
        orderId = item.orderId;
        return { ...item, ...patch };
      }),
    };
  });
  return orderId;
}

function patchPaymentByOrder(queryClient, orderId, patch) {
  queryClient.setQueriesData({ queryKey: ['resource', 'payments'] }, (previous) => {
    if (!previous?.items) return previous;
    return {
      ...previous,
      items: previous.items.map((item) => item.orderId === orderId ? { ...item, ...patch } : item),
    };
  });
}

function patchCancellationCaches(queryClient, cancellationId, patch) {
  let orderId;
  queryClient.setQueriesData({ queryKey: ['resource', 'cancellations'] }, (previous) => {
    if (!previous?.items) return previous;
    return {
      ...previous,
      items: previous.items.map((item) => {
        if (item.id !== cancellationId) return item;
        orderId = item.orderSourceId;
        return { ...item, ...patch };
      }),
    };
  });
  return orderId;
}

export function installMarketplaceSync(queryClient) {
  if (!marketplaceChannel) return () => undefined;
  const refresh = (event) => {
    if (event.data?.type !== 'marketplace-change') return;
    invalidate(queryClient, ['orders']);
    invalidate(queryClient, ['resource']);
    invalidate(queryClient, ['available-dishes']);
    invalidate(queryClient, ['reports']);
  };
  marketplaceChannel.addEventListener('message', refresh);
  return () => marketplaceChannel.removeEventListener('message', refresh);
}

async function fetchResource({ key, page, search, status, sort, availableOnly = false }) {
  const { data } = await api.get(`/resources/${key}`, { params: { page, page_size: PAGE_SIZE, search: search || undefined, status: status === 'All Status' ? undefined : status, sort: sort === 'Recently updated' ? 'recent' : 'name', available_only: availableOnly || undefined } });
  return data;
}

export function useResourceQuery({ key, page, search, status, sort, availableOnly = false }) {
  const debouncedSearch = useDebouncedValue(search);
  return useQuery({
    queryKey: ['resource', key, page, debouncedSearch, status, sort, availableOnly],
    queryFn: () => fetchResource({ key, page, search: debouncedSearch, status, sort, availableOnly }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: ['payments', 'cancellations'].includes(key) ? OPERATION_REFRESH_INTERVAL : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useOrdersQuery({ mode, page, search, status, date }) {
  const debouncedSearch = useDebouncedValue(search);
  return useQuery({
    queryKey: ['orders', mode, page, debouncedSearch, status, date],
    queryFn: async () => (await api.get('/orders', { params: { mode, page, page_size: PAGE_SIZE, search: debouncedSearch || undefined, status: status === 'All Status' ? undefined : status, date: date || undefined } })).data,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: OPERATION_REFRESH_INTERVAL,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useAvailableDishesQuery() {
  return useQuery({
    queryKey: ['available-dishes'],
    queryFn: async () => (await api.get('/resources/foodItems', { params: { page: 1, page_size: 100, available_only: true, sort: 'name' } })).data.items || [],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useReportQuery() {
  return useQuery({ queryKey: ['reports'], queryFn: async () => (await api.get('/reports')).data, staleTime: 300_000, refetchOnWindowFocus: true, refetchOnReconnect: true });
}

function invalidateAllOperations(queryClient) {
  invalidate(queryClient, ['orders']);
  invalidate(queryClient, ['resource', 'payments']);
  invalidate(queryClient, ['resource', 'cancellations']);
  invalidate(queryClient, ['reports']);
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
    onSuccess: () => {
      invalidate(queryClient, ['resource', key]);
      if (key === 'foodItems') invalidate(queryClient, ['available-dishes']);
      if (['foodItems', 'categories', 'discounts'].includes(key)) invalidateAllOperations(queryClient);
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
    onSuccess: (response, variables) => {
      const result = response.data || {};
      if (variables.action === 'advance') {
        patchOrderCaches(queryClient, variables.id, { status: result.status, kitchenStatus: result.kitchenStatus, paymentStatus: result.paymentStatus });
        patchPaymentByOrder(queryClient, variables.id, { status: result.paymentStatus });
      }
      if (variables.action === 'cancel') patchOrderCaches(queryClient, variables.id, { cancellationStatus: result.status });
      if (variables.action === 'update') patchOrderCaches(queryClient, variables.id, {
        customer: variables.values.customer,
        type: variables.values.type,
        contact: variables.values.contact || '—',
        paymentMethod: variables.values.paymentMethod,
        table: variables.values.table || null,
        guests: variables.values.guests || null,
        pickupTime: variables.values.pickupTime || null,
        address: variables.values.address || null,
        rider: variables.values.rider || null,
        notes: variables.values.notes || '',
      });
      invalidateAllOperations(queryClient);
    },
  });
}

export function usePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.post(`/payments/${id}/status`, { status }),
    onSuccess: (response, variables) => {
      const status = response.data?.status;
      const orderId = patchPaymentCaches(queryClient, variables.id, { status });
      if (orderId) patchOrderCaches(queryClient, orderId, { paymentStatus: status });
      invalidateAllOperations(queryClient);
    },
  });
}

export function useCancellationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, notes }) => api.post(`/cancellations/${id}/resolve`, { decision, notes }),
    onSuccess: (response, variables) => {
      const result = response.data || {};
      const orderId = patchCancellationCaches(queryClient, variables.id, { status: result.status });
      if (orderId) {
        const orderPatch = variables.decision === 'approve'
          ? { cancellationStatus: result.status, status: 'Cancelled', kitchenStatus: 'Cancelled', paymentStatus: result.paymentStatus }
          : { cancellationStatus: result.status };
        patchOrderCaches(queryClient, orderId, orderPatch);
        if (variables.decision === 'approve') patchPaymentByOrder(queryClient, orderId, { status: result.paymentStatus });
      }
      invalidateAllOperations(queryClient);
    },
  });
}
