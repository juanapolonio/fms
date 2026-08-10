import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMemo, useState } from 'react';
import { MetricCards } from '../components/MetricCards';
import { Toast } from '../components/Toast';
import { money, useMarketplaceStore } from '../stores/useMarketplaceStore';

const chartColors = ['#145cf5', '#16a34a', '#f59e0b', '#7c3aed', '#ef4444'];
const labelDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

export function ReportsPage() {
  const orders = useMarketplaceStore((state) => state.orders);
  const [range, setRange] = useState('Last 30 days');
  const [orderType, setOrderType] = useState('All Order Types');
  const [paymentMethod, setPaymentMethod] = useState('All Payment Methods');
  const [toast, setToast] = useState('');
  const report = useMemo(() => {
    const newest = orders.reduce((latest, order) => order.date > latest ? order.date : latest, orders[0]?.date || new Date().toISOString().slice(0, 10));
    const cutoff = new Date(`${newest}T00:00:00`);
    if (range === 'Last 7 days') cutoff.setDate(cutoff.getDate() - 6);
    else if (range === 'Last 30 days') cutoff.setDate(cutoff.getDate() - 29);
    else cutoff.setFullYear(2020);
    const rows = orders.filter((order) => new Date(`${order.date}T00:00:00`) >= cutoff && (orderType === 'All Order Types' || order.type === orderType) && (paymentMethod === 'All Payment Methods' || order.paymentMethod === paymentMethod));
    const paid = rows.filter((order) => !['Cancelled', 'Pending'].includes(order.paymentStatus));
    const gross = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const discounts = paid.reduce((sum, order) => sum + Number(order.discount || 0), 0);
    const refunds = rows.filter((order) => order.paymentStatus === 'Refunded').reduce((sum, order) => sum + Number(order.total || 0), 0);
    const dailyMap = new Map();
    rows.forEach((order) => dailyMap.set(order.date, (dailyMap.get(order.date) || 0) + (order.paymentStatus === 'Paid' ? Number(order.total || 0) : 0)));
    const daily = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, sales]) => ({ date, day: labelDate(date), sales, orders: rows.filter((order) => order.date === date).length }));
    const group = (key) => Object.entries(rows.reduce((result, order) => ({ ...result, [order[key]]: (result[order[key]] || 0) + (order.paymentStatus === 'Paid' ? Number(order.total || 0) : 0) }), {})).map(([name, value]) => ({ name, value }));
    const topItems = Object.values(rows.flatMap((order) => order.items).reduce((result, item) => ({ ...result, [item.name]: { name: item.name, quantity: (result[item.name]?.quantity || 0) + item.quantity, sales: (result[item.name]?.sales || 0) + Number(item.price || 0) * item.quantity } }), {})).sort((a, b) => b.sales - a.sales).slice(0, 5);
    return { rows, gross, discounts, refunds, net: gross - refunds, daily, byType: group('type'), byPayment: group('paymentMethod'), topItems };
  }, [orders, range, orderType, paymentMethod]);
  const exportReport = () => {
    const csv = ['Order ID,Date,Customer,Type,Payment,Status,Total', ...report.rows.map((order) => [order.orderNumber, order.date, order.customer, order.type, order.paymentMethod, order.status, order.total].join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `argo-sales-${range.toLowerCase().replaceAll(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('Sales report exported from the live ARGO dataset');
  };
  return <section className="page-content"><div className="page-heading"><div><h1>Sales Reports</h1><p>Live operational reporting from the ARGO Marketplace database</p></div><button className="outline-button" onClick={exportReport}><i className="bi bi-download" /> Export Report</button></div><MetricCards metrics={[[money(report.gross), 'Gross Sales'], [String(report.rows.length), 'Orders'], [money(report.rows.length ? report.gross / report.rows.length : 0), 'Average Order'], [money(report.discounts), 'Discounts'], [money(report.refunds), 'Refunds'], [money(report.net), 'Net Sales']]} /><div className="report-filters"><select value={range} onChange={(event) => setRange(event.target.value)}><option>Last 7 days</option><option>Last 30 days</option><option>All available data</option></select><select value={orderType} onChange={(event) => setOrderType(event.target.value)}><option>All Order Types</option><option>Dine-in</option><option>Takeout</option><option>Pickup</option><option>Delivery</option></select><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>All Payment Methods</option><option>Cash</option><option>Card</option><option>GCash</option><option>PayMaya</option></select></div><div className="report-grid"><div className="report-card report-wide"><div className="card-title"><h3>Daily Sales Overview</h3><span>{range} · {orderType}</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.daily}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(value) => money(value)} /><Legend /><Bar dataKey="sales" name="Paid sales" fill="#145cf5" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div><div className="report-card"><div className="card-title"><h3>Sales by Order Type</h3></div><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={report.byType} dataKey="value" nameKey="name" innerRadius={46} outerRadius={76} paddingAngle={3}>{report.byType.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => money(value)} /><Legend /></PieChart></ResponsiveContainer></div></div><div className="report-card"><div className="card-title"><h3>Sales by Payment</h3></div><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={report.byPayment} dataKey="value" nameKey="name" innerRadius={46} outerRadius={76} paddingAngle={3}>{report.byPayment.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => money(value)} /><Legend /></PieChart></ResponsiveContainer></div></div></div><div className="report-detail-grid"><div className="report-card"><div className="card-title"><h3>Top Selling Items</h3><span>Quantity and paid sales</span></div><table><thead><tr><th>Item</th><th>Qty</th><th>Sales</th></tr></thead><tbody>{report.topItems.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.sales)}</td></tr>)}</tbody></table></div><div className="report-card"><div className="card-title"><h3>Sales by Day</h3><span>Filtered results</span></div><table><thead><tr><th>Date</th><th>Orders</th><th>Paid Sales</th></tr></thead><tbody>{report.daily.slice(-8).reverse().map((day) => <tr key={day.date}><td>{day.day}</td><td>{day.orders}</td><td>{money(day.sales)}</td></tr>)}</tbody></table></div></div>{toast && <Toast message={toast} onClose={() => setToast('')} />}</section>;
}
