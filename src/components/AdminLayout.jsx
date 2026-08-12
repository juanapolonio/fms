import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useUiStore } from '../stores/useUiStore';
import { cn } from '../lib/cn';

const primary = [
  { label: 'Menus', path: '/menus', icon: 'bi-book' },
  { label: 'Categories', path: '/categories', icon: 'bi-grid' },
  { label: 'Food Items', path: '/food-items', icon: 'bi-shop' },
  { label: 'Food Options', path: '/food-options', icon: 'bi-sliders' },
];
const orders = [
  { label: 'Customer Orders', path: '/orders', icon: 'bi-cart3' },
  { label: 'Table Orders', path: '/orders/tables', icon: 'bi-grid-3x3-gap' },
  { label: 'Takeout Orders', path: '/orders/takeout', icon: 'bi-bag' },
  { label: 'Pickup Orders', path: '/orders/pickup', icon: 'bi-bag-check' },
  { label: 'Delivery Orders', path: '/orders/delivery', icon: 'bi-bicycle' },
];
const operations = [
  { label: 'Kitchen Preparation', path: '/kitchen', icon: 'bi-egg-fried' },
  { label: 'Payments', path: '/payments', icon: 'bi-wallet2' },
  { label: 'Discounts', path: '/discounts', icon: 'bi-tags' },
  { label: 'Cancellations', path: '/cancellations', icon: 'bi-x-circle' },
  { label: 'Reports', path: '/reports', icon: 'bi-bar-chart-line' },
];

function NavItem({ item, collapsed }) {
  return <NavLink to={item.path} end={item.path === '/orders'} title={collapsed ? item.label : undefined} className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}><i className={`bi ${item.icon}`} />{!collapsed && <span>{item.label}</span>}</NavLink>;
}
function NavGroup({ label, items, collapsed }) {
  return <div className="nav-group">{!collapsed && <div className="nav-group-label">{label}</div>}{items.map((item) => <NavItem key={item.path} item={item} collapsed={collapsed} />)}</div>;
}

export function AdminLayout() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  return <div className="app-shell"><aside className={cn('sidebar', sidebarCollapsed && 'sidebar-collapsed')}><div className="brand"><div className="brand-mark"><i className="bi bi-egg-fried" /></div>{!sidebarCollapsed && <div><strong>FOOD ORDERING</strong><span>SYSTEM</span></div>}</div><nav className="sidebar-nav"><NavGroup label="CATALOG" items={primary} collapsed={sidebarCollapsed} /><NavGroup label="ORDERS" items={orders} collapsed={sidebarCollapsed} /><NavGroup label="OPERATIONS" items={operations} collapsed={sidebarCollapsed} /></nav></aside><main className="main-area"><header className="topbar"><button className="icon-button" onClick={toggleSidebar} aria-label="Toggle sidebar"><i className="bi bi-list" /></button><div className="topbar-spacer" /><div className="notification-wrap"><button className="icon-button notification" aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)}><i className="bi bi-bell" /><span>5</span></button>{notificationsOpen && <div className="notification-popover"><strong>Notifications</strong><p>5 order updates need attention.</p><button onClick={() => { setNotificationsOpen(false); navigate('/kitchen'); }}>Review kitchen queue</button></div>}</div><div className="profile"><div className="avatar"><i className="bi bi-person-fill" /></div><div><strong>ARGO User</strong><small>Administrator</small></div></div></header><Outlet /></main></div>;
}
