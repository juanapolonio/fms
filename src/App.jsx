import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { ResourcePage } from './pages/ResourcePage';
import { OrdersPage } from './pages/OrdersPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { CancellationsPage } from './pages/CancellationsPage';
import { resourceConfigs } from './data/resourceConfigs';

const ReportsPage = lazy(() => import('./pages/ReportsPage').then(({ ReportsPage: Page }) => ({ default: Page })));

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/menus" replace />} />
        <Route path="dashboard" element={<Navigate to="/menus" replace />} />
        <Route path="menus" element={<ResourcePage config={resourceConfigs.menus} />} />
        <Route path="categories" element={<ResourcePage config={resourceConfigs.categories} />} />
        <Route path="food-items" element={<ResourcePage config={resourceConfigs.foodItems} />} />
        <Route path="food-options" element={<ResourcePage config={resourceConfigs.foodOptions} />} />
        <Route path="orders" element={<OrdersPage mode="customer" />} />
        <Route path="orders/tables" element={<OrdersPage mode="table" />} />
        <Route path="orders/takeout" element={<OrdersPage mode="takeout" />} />
        <Route path="orders/pickup" element={<OrdersPage mode="pickup" />} />
        <Route path="orders/delivery" element={<OrdersPage mode="delivery" />} />
        <Route path="kitchen" element={<OrdersPage mode="kitchen" />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="discounts" element={<ResourcePage config={resourceConfigs.discounts} />} />
        <Route path="cancellations" element={<CancellationsPage />} />
        <Route path="reports" element={<Suspense fallback={<section className="page-content">Loading sales reports…</section>}><ReportsPage /></Suspense>} />
        <Route path="settings" element={<Navigate to="/menus" replace />} />
        <Route path="users" element={<Navigate to="/menus" replace />} />
        <Route path="*" element={<Navigate to="/menus" replace />} />
      </Route>
    </Routes>
  );
}
