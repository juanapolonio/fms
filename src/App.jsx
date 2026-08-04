import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { ResourcePage } from './pages/ResourcePage';
import { OrdersPage } from './pages/OrdersPage';
import { ReportsPage } from './pages/ReportsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { resourceConfigs } from './data/resourceConfigs';

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/menus" replace />} />
        <Route path="dashboard" element={<PlaceholderPage title="Dashboard" />} />
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
        <Route path="payments" element={<ResourcePage config={resourceConfigs.payments} />} />
        <Route path="discounts" element={<ResourcePage config={resourceConfigs.discounts} />} />
        <Route path="cancellations" element={<ResourcePage config={resourceConfigs.cancellations} />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="users" element={<PlaceholderPage title="Users" />} />
        <Route path="*" element={<PlaceholderPage title="Page not found" />} />
      </Route>
    </Routes>
  );
}
