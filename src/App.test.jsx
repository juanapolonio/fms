import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';

vi.mock('./lib/api', () => ({
  api: { get: async () => ({ data: { resources: {}, orders: [] } }) },
}));

afterEach(cleanup);

test('opens the catalog without a login or dashboard screen', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/menus']}><App /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText('Manage Menus')).toBeInTheDocument();
  expect(screen.queryByText('Login')).not.toBeInTheDocument();
  expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
});

test('highlights only the active order module in the sidebar', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/orders/tables']}><App /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByRole('link', { name: 'Table Orders' })).toHaveClass('nav-item-active');
  expect(screen.getByRole('link', { name: 'Customer Orders' })).not.toHaveClass('nav-item-active');
});
