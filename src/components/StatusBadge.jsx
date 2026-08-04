import { cn } from '../lib/cn';

const statusClass = {
  Active: 'status-success', Paid: 'status-success', Completed: 'status-success', Delivered: 'status-success', Ready: 'status-success', 'Ready for Pickup': 'status-success',
  Pending: 'status-warning', Preparing: 'status-warning', Scheduled: 'status-warning', 'Pending Review': 'status-warning',
  Inactive: 'status-muted', Failed: 'status-danger', Cancelled: 'status-danger', Refunded: 'status-info', 'Out for Delivery': 'status-info',
};

export function StatusBadge({ value }) {
  if (!value) return null;
  return <span className={cn('status-badge', statusClass[value] || 'status-muted')}><span className="status-dot" />{value}</span>;
}
