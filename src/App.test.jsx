import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';
import { DataTable } from './components/DataTable';

vi.mock('./lib/api', () => ({
  api: { get: async () => ({ data: { items: [], metrics: [], total: 0, page: 1, pageSize: 10, pageCount: 1 } }) },
}));

afterEach(cleanup);

test('opens the catalog without a login or dashboard screen', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/menus']}><App /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText('Manage Menus')).toBeInTheDocument();
  expect(screen.queryByText('Login')).not.toBeInTheDocument();
  expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
});

test('highlights only the active order module in the sidebar', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/orders/tables']}><App /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByRole('link', { name: 'Table Orders' })).toHaveClass('nav-item-active');
  expect(screen.getByRole('link', { name: 'Customer Orders' })).not.toHaveClass('nav-item-active');
});

test('keeps a ten-row table footprint on short pages', () => {
  render(<DataTable columns={[['name', 'Name']]} rows={[{ id: 'one', name: 'Sample' }]} page={1} pageCount={1} pageSize={10} totalCount={1} onSelect={() => undefined} onPageChange={() => undefined} />);
  expect(document.querySelectorAll('tbody tr')).toHaveLength(10);
});

test('menu creation captures a persistent dish count and explains the Food Items boundary', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/menus']}><App /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Add Menu' }));
  expect(screen.getByRole('spinbutton', { name: /Number of dishes/i })).toHaveValue(0);
  expect(screen.getByText(/Add each actual dish in Food Items/i)).toBeInTheDocument();
});

test('dine-in creation requires table and guest details', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/orders/tables']}><App /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'New Order' }));
  expect(screen.getByLabelText(/^Table/)).toBeInTheDocument();
  expect(screen.getByLabelText(/Guests/)).toHaveAttribute('min', '1');
  expect(screen.queryByLabelText(/Delivery address/)).not.toBeInTheDocument();
});

test('kitchen preparation advances existing tickets and cannot create orders', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/kitchen']}><App /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByRole('heading', { name: 'Kitchen Preparation' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /New/ })).not.toBeInTheDocument();
});
