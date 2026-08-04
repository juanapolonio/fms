import { create } from 'zustand';
import { resourceConfigs } from '../data/resourceConfigs';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const isoDate = (value) => value.toISOString().slice(0, 10);
const orderNumber = (prefix, number) => `#${prefix}-${String(number).padStart(5, '0')}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

export const money = (value) => peso.format(Number(value || 0));

const catalogItems = [
  { id: 'item-burger', name: 'Cheese Burger', category: 'Burgers', price: 250, status: 'Active', availability: 'In Stock', rating: '4.8', description: 'Juicy grilled beef patty with cheese, lettuce, tomato and signature sauce.' },
  { id: 'item-pizza', name: 'Pepperoni Pizza', category: 'Pizzas', price: 380, status: 'Active', availability: 'In Stock', rating: '4.7', description: 'Stone-baked pizza with pepperoni, mozzarella and tomato sauce.' },
  { id: 'item-chicken', name: 'Fried Chicken', category: 'Chicken', price: 220, status: 'Active', availability: 'In Stock', rating: '4.6', description: 'Crispy fried chicken served with house gravy.' },
  { id: 'item-fries', name: 'French Fries', category: 'Snacks', price: 90, status: 'Active', availability: 'In Stock', rating: '4.5', description: 'Seasoned golden fries with a crunchy finish.' },
  { id: 'item-milktea', name: 'Milk Tea', category: 'Drinks', price: 120, status: 'Active', availability: 'In Stock', rating: '4.6', description: 'Creamy black tea with brown sugar pearls.' },
  { id: 'item-pasta', name: 'Carbonara Pasta', category: 'Pasta', price: 320, status: 'Active', availability: 'In Stock', rating: '4.7', description: 'Creamy carbonara with bacon, parmesan and herbs.' },
  { id: 'item-salad', name: 'Caesar Salad', category: 'Salads', price: 180, status: 'Active', availability: 'In Stock', rating: '4.4', description: 'Crisp romaine, parmesan, croutons and Caesar dressing.' },
  { id: 'item-cake', name: 'Chocolate Cake', category: 'Desserts', price: 150, status: 'Inactive', availability: 'Out of Stock', rating: '4.3', description: 'Rich chocolate cake with dark chocolate ganache.' },
  { id: 'item-coffee', name: 'Iced Coffee', category: 'Drinks', price: 110, status: 'Active', availability: 'In Stock', rating: '4.5', description: 'Cold-brew coffee with fresh milk and ice.' },
  { id: 'item-garlicbread', name: 'Garlic Bread', category: 'Snacks', price: 80, status: 'Active', availability: 'In Stock', rating: '4.2', description: 'Toasted bread brushed with roasted garlic butter.' },
];

const customers = [
  ['Juan Dela Cruz', '0917 123 4567'], ['Maria Santos', '0928 765 4321'], ['Anne Garcia', '0905 345 6789'], ['Mark Villanueva', '0906 555 6789'],
  ['Ricky Tan', '0999 888 7777'], ['Liza Reyes', '0945 111 2222'], ['Carlo Mendoza', '0916 222 3333'], ['Paula Lim', '0922 444 5555'],
  ['James Reyes', '0908 111 2222'], ['Bea Lim', '0932 111 2222'], ['Kevin Tan', '0907 777 9999'], ['Jasmine Lee', '0919 222 1111'],
];
const addresses = ['123 Rizal St., Makati City', '456 Bonifacio Ave., Taguig City', '789 Tomas Morato St., Quezon City', '321 Kapitolyo Rd., Pasig City', '88 Eastwood Ave., Quezon City'];
const riders = ['Miguel Santos', 'Carlo Reyes', 'Jared Lim', 'No rider assigned'];
const methods = ['Cash', 'GCash', 'Card', 'PayMaya'];

const statusFor = (type, index) => {
  const cycle = {
    'Dine-in': ['Preparing', 'Ready', 'Completed', 'Completed', 'Cancelled'],
    Takeout: ['Preparing', 'Ready for Pickup', 'Completed', 'Completed', 'Cancelled'],
    Pickup: ['Pending', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'],
    Delivery: ['Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'],
  };
  return cycle[type][index % cycle[type].length];
};

const makeOrderItems = (index) => {
  const first = catalogItems[index % 7];
  const second = catalogItems[(index * 3 + 1) % 9];
  const lines = [{ ...first, quantity: index % 3 === 0 ? 2 : 1 }];
  if (index % 2 === 0 && second.id !== first.id) lines.push({ ...second, quantity: 1 });
  if (index % 5 === 0) lines.push({ ...catalogItems[3], quantity: 1 });
  return lines;
};

const createSeedOrders = () => Array.from({ length: 72 }, (_, index) => {
  const type = ['Dine-in', 'Takeout', 'Pickup', 'Delivery'][index % 4];
  const status = statusFor(type, index);
  const date = new Date(Date.UTC(2026, 7, 3 - Math.floor(index / 3), 3 + (index % 12), (index * 11) % 60));
  const [customer, contact] = customers[index % customers.length];
  const items = makeOrderItems(index);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = index % 9 === 0 ? Math.min(100, Math.round(subtotal * 0.1)) : 0;
  const serviceCharge = type === 'Dine-in' ? Math.round((subtotal - discount) * 0.05) : 0;
  const deliveryFee = type === 'Delivery' ? 49 : 0;
  const tax = Math.round((subtotal - discount) * 0.12);
  const total = subtotal - discount + serviceCharge + deliveryFee + tax;
  const prefix = type === 'Pickup' ? 'PU' : type === 'Takeout' ? 'TO' : type === 'Delivery' ? 'DO' : 'TB';
  const paymentStatus = status === 'Cancelled' ? 'Refunded' : index % 7 === 0 ? 'Pending' : 'Paid';
  return {
    id: orderNumber(prefix, 140 + index), orderNumber: orderNumber(prefix, 140 + index), customer, contact, type, status,
    kitchenStatus: status === 'Delivered' || status === 'Completed' ? 'Completed' : status === 'Ready' || status === 'Ready for Pickup' ? 'Ready' : status,
    paymentStatus, paymentMethod: methods[index % methods.length], subtotal, discount, serviceCharge, tax, deliveryFee, total,
    items, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), itemSummary: items.map((item) => item.name).join(', '),
    date: isoDate(date), createdAt: date.toISOString(), time: date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    table: type === 'Dine-in' ? `Table ${1 + (index % 12)}` : null, guests: type === 'Dine-in' ? 2 + (index % 5) : null,
    address: type === 'Delivery' ? addresses[index % addresses.length] : null, rider: type === 'Delivery' ? riders[index % riders.length] : null,
    notes: index % 6 === 0 ? 'Please include extra ketchup and napkins.' : '',
  };
});

const initialResources = {
  menus: clone(resourceConfigs.menus.rows),
  categories: clone(resourceConfigs.categories.rows),
  foodItems: catalogItems.map((item, index) => ({ ...item, id: index + 1, price: money(item.price) })),
  foodOptions: clone(resourceConfigs.foodOptions.rows),
  discounts: clone(resourceConfigs.discounts.rows),
  payments: [],
  cancellations: [],
};

const buildPayments = (orders) => orders.map((order, index) => ({
  id: `#PAY-${String(780 + index).padStart(5, '0')}`, order: order.orderNumber, orderId: order.id, customer: order.customer,
  method: order.paymentMethod, amount: money(order.total), amountValue: order.total, status: order.paymentStatus,
  date: `${new Date(order.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · ${order.time}`,
}));

const buildCancellations = (orders) => orders.filter((order) => order.status === 'Cancelled').map((order, index) => ({
  id: `#CO-${String(220 + index).padStart(5, '0')}`, orderId: order.id, customer: order.customer, type: order.type,
  date: `${new Date(order.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · ${order.time}`,
  reason: ['Changed my mind', 'Delivery taking too long', 'Order placed by mistake', 'Address changed'][index % 4],
  status: order.paymentStatus === 'Refunded' ? 'Refunded' : 'Pending Review', refund: money(order.total), refundValue: order.total,
}));

const refreshFinancialRecords = (orders, resources) => ({
  ...resources,
  payments: buildPayments(orders),
  cancellations: buildCancellations(orders),
});

const defaultOrder = (payload, sequence) => {
  const type = payload.type || 'Dine-in';
  const items = payload.items?.length ? payload.items : [{ ...catalogItems[0], quantity: 1 }];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity || 1), 0);
  const discount = 0;
  const serviceCharge = type === 'Dine-in' ? Math.round(subtotal * 0.05) : 0;
  const deliveryFee = type === 'Delivery' ? 49 : 0;
  const tax = Math.round(subtotal * 0.12);
  const createdAt = new Date().toISOString();
  const prefix = type === 'Pickup' ? 'PU' : type === 'Takeout' ? 'TO' : type === 'Delivery' ? 'DO' : 'TB';
  return {
    id: orderNumber(prefix, sequence), orderNumber: orderNumber(prefix, sequence), customer: payload.customer, contact: payload.contact || '0917 000 0000', type,
    status: payload.status || 'Pending', kitchenStatus: payload.status || 'Pending', paymentStatus: payload.paymentStatus || 'Pending', paymentMethod: payload.paymentMethod || 'Cash',
    subtotal, discount, serviceCharge, tax, deliveryFee, total: subtotal - discount + serviceCharge + deliveryFee + tax,
    items, itemCount: items.reduce((sum, item) => sum + Number(item.quantity || 1), 0), itemSummary: items.map((item) => item.name).join(', '),
    date: payload.date || isoDate(new Date()), createdAt, time: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    table: payload.table || (type === 'Dine-in' ? 'Table 1' : null), guests: payload.guests || (type === 'Dine-in' ? 2 : null),
    address: payload.address || (type === 'Delivery' ? addresses[0] : null), rider: payload.rider || (type === 'Delivery' ? 'No rider assigned' : null), notes: payload.notes || '',
  };
};

const seededOrders = createSeedOrders();

export const useMarketplaceStore = create((set, get) => ({
  resources: refreshFinancialRecords(seededOrders, initialResources),
  orders: seededOrders,
  lastSequence: 1000,
  addResource: (key, values) => set((state) => ({
    resources: { ...state.resources, [key]: [{ id: `${key}-${Date.now()}`, ...values }, ...state.resources[key] || []] },
  })),
  updateResource: (key, id, values) => set((state) => ({
    resources: { ...state.resources, [key]: (state.resources[key] || []).map((record) => record.id === id ? { ...record, ...values } : record) },
  })),
  deleteResource: (key, id) => set((state) => ({
    resources: { ...state.resources, [key]: (state.resources[key] || []).filter((record) => record.id !== id) },
  })),
  duplicateResource: (key, record) => set((state) => ({
    resources: { ...state.resources, [key]: [{ ...record, id: `${key}-${Date.now()}`, name: `${record.name || record.code || record.customer || 'Record'} Copy` }, ...state.resources[key] || []] },
  })),
  createOrder: (payload) => set((state) => {
    const order = defaultOrder(payload, state.lastSequence + 1);
    const orders = [order, ...state.orders];
    return { orders, lastSequence: state.lastSequence + 1, resources: refreshFinancialRecords(orders, state.resources) };
  }),
  updateOrder: (id, values) => set((state) => {
    const orders = state.orders.map((order) => order.id === id ? { ...order, ...values } : order);
    return { orders, resources: refreshFinancialRecords(orders, state.resources) };
  }),
  transitionOrder: (id, status) => {
    const order = get().orders.find((record) => record.id === id);
    if (!order) return;
    const patch = { status };
    if (['Preparing', 'Ready', 'Ready for Pickup', 'Completed', 'Delivered'].includes(status)) patch.kitchenStatus = status === 'Ready for Pickup' ? 'Ready' : status;
    if (status === 'Cancelled') patch.paymentStatus = 'Refunded';
    get().updateOrder(id, patch);
  },
  cancelOrder: (id) => get().transitionOrder(id, 'Cancelled'),
  duplicateOrder: (id) => set((state) => {
    const source = state.orders.find((order) => order.id === id);
    if (!source) return state;
    const copy = { ...source, id: orderNumber('ORD', state.lastSequence + 1), orderNumber: orderNumber('ORD', state.lastSequence + 1), status: 'Pending', kitchenStatus: 'Pending', paymentStatus: 'Pending', createdAt: new Date().toISOString(), date: isoDate(new Date()), time: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) };
    const orders = [copy, ...state.orders];
    return { orders, lastSequence: state.lastSequence + 1, resources: refreshFinancialRecords(orders, state.resources) };
  }),
  resetDemo: () => set(() => ({ resources: refreshFinancialRecords(seededOrders, initialResources), orders: seededOrders, lastSequence: 1000 })),
}));

export const orderMetrics = (orders, mode) => {
  const scoped = mode === 'table' ? orders.filter((order) => order.type === 'Dine-in') : mode === 'takeout' ? orders.filter((order) => order.type === 'Takeout') : mode === 'pickup' ? orders.filter((order) => order.type === 'Pickup') : mode === 'delivery' ? orders.filter((order) => order.type === 'Delivery') : mode === 'kitchen' ? orders.filter((order) => !['Cancelled', 'Delivered', 'Completed'].includes(order.kitchenStatus)) : orders;
  const amount = scoped.reduce((sum, order) => sum + order.total, 0);
  const count = (status) => scoped.filter((order) => order.status === status || order.kitchenStatus === status).length;
  if (mode === 'table') return [[String(new Set(scoped.map((order) => order.table)).size), 'Occupied Tables'], [String(count('Preparing')), 'Preparing'], [String(count('Ready')), 'Ready to Serve'], [String(count('Completed')), 'Completed'], [money(amount), 'Table Sales']];
  if (mode === 'takeout') return [[String(scoped.length), 'Takeout Orders'], [String(count('Ready for Pickup')), 'Ready for Pickup'], [String(count('Preparing')), 'Preparing'], [String(count('Completed')), 'Completed'], [money(amount), 'Takeout Sales']];
  if (mode === 'pickup') return [[String(scoped.length), 'Pickup Orders'], [String(count('Pending')), 'Pending'], [String(count('Ready for Pickup')), 'Ready for Pickup'], [String(count('Completed')), 'Completed'], [String(count('Cancelled')), 'Cancelled']];
  if (mode === 'delivery') return [[String(scoped.length), 'Delivery Orders'], [String(count('Pending')), 'Pending'], [String(count('Out for Delivery')), 'Out for Delivery'], [String(count('Delivered')), 'Delivered'], [String(count('Cancelled')), 'Cancelled']];
  if (mode === 'kitchen') return [[String(scoped.length), 'Kitchen Queue'], [String(count('Pending')), 'Pending'], [String(count('Preparing')), 'Preparing'], [String(count('Ready')), 'Ready'], [String(count('Cancelled')), 'Cancelled']];
  return [[String(scoped.length), 'Total Orders'], [String(count('Preparing')), 'Preparing'], [String(count('Out for Delivery')), 'Out for Delivery'], [String(count('Completed') + count('Delivered')), 'Completed'], [String(count('Cancelled')), 'Cancelled']];
};
