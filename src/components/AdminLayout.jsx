import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../stores/useUiStore';
import { cn } from '../lib/cn';
import { useMarketplaceStore } from '../stores/useMarketplaceStore';

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
  return (
    <NavLink to={item.path} end={item.path === '/orders'} title={collapsed ? item.label : undefined} className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}>
      <i className={`bi ${item.icon}`} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

function NavGroup({ label, items, collapsed }) {
  return (
    <div className="nav-group">
      {!collapsed && <div className="nav-group-label">{label}</div>}
      {items.map((item) => <NavItem key={item.path} item={item} collapsed={collapsed} />)}
    </div>
  );
}

export function AdminLayout() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const loadLiveData = useMarketplaceStore((state) => state.loadLiveData);
  const loadState = useMarketplaceStore((state) => state.loadState);
  const loadError = useMarketplaceStore((state) => state.loadError);
  useEffect(() => { loadLiveData().catch(() => undefined); }, [loadLiveData]);
  const submitGlobalSearch = (event) => {
    if (event.key === 'Enter' && globalSearch.trim()) navigate(`/orders?search=${encodeURIComponent(globalSearch.trim())}`);
  };
  return (
    <div className="app-shell">
      <aside className={cn('sidebar', sidebarCollapsed && 'sidebar-collapsed')}>
        <div className="brand">
          <div className="brand-mark"><i className="bi bi-egg-fried" /></div>
          {!sidebarCollapsed && <div><strong>FOOD ORDERING</strong><span>SYSTEM</span></div>}
        </div>
        <nav className="sidebar-nav">
          <NavGroup label="CATALOG" items={primary} collapsed={sidebarCollapsed} />
          <NavGroup label="ORDERS" items={orders} collapsed={sidebarCollapsed} />
          <NavGroup label="OPERATIONS" items={operations} collapsed={sidebarCollapsed} />
        </nav>
        <div className="sidebar-footer">
          <NavItem item={{ label: 'Settings', path: '/settings', icon: 'bi-gear' }} collapsed={sidebarCollapsed} />
          <NavItem item={{ label: 'Users', path: '/users', icon: 'bi-people' }} collapsed={sidebarCollapsed} />
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button" onClick={toggleSidebar} aria-label="Toggle sidebar"><i className="bi bi-list" /></button>
          <div className="topbar-spacer" />
          <div className="global-search"><i className="bi bi-search" /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={submitGlobalSearch} placeholder="Search menus, orders..." /></div>
          <div className="notification-wrap"><button className="icon-button notification" aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)}><i className="bi bi-bell" /><span>5</span></button>{notificationsOpen && <div className="notification-popover"><strong>Notifications</strong><p>5 order updates need attention.</p><button onClick={() => { setNotificationsOpen(false); navigate('/kitchen'); }}>Review kitchen queue</button></div>}</div>
          <div className="profile"><div className="avatar"><i className="bi bi-person-fill" /></div><div><strong>ARGO User</strong><small>Administrator</small></div></div>
        </header>
        {loadState === 'loading' && <div className="live-data-banner">Connecting to live ARGO data…</div>}
        {loadState === 'error' && <div className="live-data-banner live-data-error">Live data unavailable: {loadError}</div>}
        <Outlet />
      </main>
    </div>
  );
}
