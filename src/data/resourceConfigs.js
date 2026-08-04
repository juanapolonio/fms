const menuItems = [
  { id: 1, name: 'Main Menu', description: 'Our main menu featuring burgers, pizzas, drinks and more', items: 78, status: 'Active', order: 1 },
  { id: 2, name: 'Breakfast Menu', description: 'Start your day with our breakfast favorites', items: 18, status: 'Active', order: 2 },
  { id: 3, name: 'Pizza Menu', description: 'All our delicious pizza varieties', items: 22, status: 'Active', order: 3 },
  { id: 4, name: 'Beverage Menu', description: 'Refreshing drinks, shakes and beverages', items: 16, status: 'Active', order: 4 },
  { id: 5, name: 'Dessert Menu', description: 'Sweet treats to end your meal perfectly', items: 12, status: 'Active', order: 5 },
  { id: 6, name: 'Value Meals', description: 'Best value combo meals for everyone', items: 14, status: 'Inactive', order: 7 },
];

const categories = [
  { id: 1, name: 'Burgers', description: 'Delicious burgers made with premium ingredients', items: 24, status: 'Active' },
  { id: 2, name: 'Pizzas', description: 'Classic and specialty pizzas fresh from the oven', items: 18, status: 'Active' },
  { id: 3, name: 'Chicken', description: 'Tasty chicken dishes for every craving', items: 16, status: 'Active' },
  { id: 4, name: 'Snacks', description: 'Quick bites and sides to enjoy anytime', items: 20, status: 'Active' },
  { id: 5, name: 'Drinks', description: 'Refreshing beverages and cold drinks', items: 25, status: 'Active' },
  { id: 6, name: 'Desserts', description: 'Sweet treats to end your meal', items: 12, status: 'Active' },
];

const foodItems = [
  { id: 1, name: 'Cheese Burger', category: 'Burgers', price: '₱250.00', status: 'Active', availability: 'In Stock', rating: '4.8' },
  { id: 2, name: 'Pepperoni Pizza', category: 'Pizzas', price: '₱380.00', status: 'Active', availability: 'In Stock', rating: '4.7' },
  { id: 3, name: 'Fried Chicken', category: 'Chicken', price: '₱220.00', status: 'Active', availability: 'In Stock', rating: '4.6' },
  { id: 4, name: 'French Fries', category: 'Snacks', price: '₱60.00', status: 'Active', availability: 'In Stock', rating: '4.5' },
  { id: 5, name: 'Milk Tea', category: 'Drinks', price: '₱120.00', status: 'Active', availability: 'In Stock', rating: '4.6' },
  { id: 6, name: 'Chocolate Cake', category: 'Desserts', price: '₱150.00', status: 'Inactive', availability: 'Out of Stock', rating: '4.3' },
];

const foodOptions = [
  { id: 1, name: 'Extra Cheese', type: 'Single Choice', choices: 2, required: 'No', status: 'Active', items: 24 },
  { id: 2, name: 'Size', type: 'Single Choice', choices: 3, required: 'Yes', status: 'Active', items: 38 },
  { id: 3, name: 'Crust Type', type: 'Single Choice', choices: 3, required: 'Yes', status: 'Active', items: 12 },
  { id: 4, name: 'Add Toppings', type: 'Multiple Choice', choices: 8, required: 'No', status: 'Active', items: 28 },
  { id: 5, name: 'Sauce', type: 'Single Choice', choices: 4, required: 'Yes', status: 'Active', items: 18 },
];

const payments = [
  { id: '#PAY00068', order: '#PU00012', customer: 'Juan Dela Cruz', method: 'Cash', amount: '₱350.00', status: 'Paid', date: 'Jul 20, 2025 · 11:30 AM' },
  { id: '#PAY00067', order: '#DO00018', customer: 'Juan Dela Cruz', method: 'Visa •••• 4242', amount: '₱350.00', status: 'Paid', date: 'Jul 20, 2025 · 11:15 AM' },
  { id: '#PAY00066', order: '#DO00017', customer: 'Maria Santos', method: 'Mastercard •••• 3333', amount: '₱300.00', status: 'Paid', date: 'Jul 20, 2025 · 10:50 AM' },
  { id: '#PAY00065', order: '#DO00016', customer: 'Mark Villanueva', method: 'GCash', amount: '₱420.00', status: 'Pending', date: 'Jul 20, 2025 · 10:20 AM' },
  { id: '#PAY00064', order: '#TO00009', customer: 'Anne Garcia', method: 'Cash', amount: '₱270.00', status: 'Paid', date: 'Jul 20, 2025 · 09:40 AM' },
  { id: '#PAY00063', order: '#DO00014', customer: 'Ricky Tan', method: 'PayMaya', amount: '₱340.00', status: 'Paid', date: 'Jul 20, 2025 · 09:05 AM' },
];

const discounts = [
  { id: 1, code: 'WELCOME10', name: 'Welcome 10% Off', type: 'Percentage', value: '10% OFF', minimum: '₱300.00', usage: '120 / 200', status: 'Active', validity: 'Jul 1 – Jul 31, 2025' },
  { id: 2, code: 'SAVE20', name: 'Save 20%', type: 'Percentage', value: '20% OFF', minimum: '₱500.00', usage: '85 / 150', status: 'Active', validity: 'Jun 15 – Jul 15, 2025' },
  { id: 3, code: 'FREESHIP', name: 'Free Delivery', type: 'Free Shipping', value: '₱0.00', minimum: '₱400.00', usage: '210 / 300', status: 'Active', validity: 'Jul 1 – Jul 31, 2025' },
  { id: 4, code: 'SUMMER15', name: 'Summer Special', type: 'Percentage', value: '15% OFF', minimum: '₱400.00', usage: '45 / 100', status: 'Scheduled', validity: 'Jul 1 – Aug 15, 2025' },
];

const cancellations = [
  { id: '#CO0022', customer: 'Juan Dela Cruz', type: 'Delivery', reason: 'Changed my mind', status: 'Pending Review', refund: '₱300.00', date: 'Jul 20, 2025 · 11:45 AM' },
  { id: '#CO0021', customer: 'Maria Santos', type: 'Pickup', reason: 'Found a better price', status: 'Approved', refund: '₱250.00', date: 'Jul 20, 2025 · 10:30 AM' },
  { id: '#CO0020', customer: 'Mark Villanueva', type: 'Delivery', reason: 'Delivery taking too long', status: 'Refunded', refund: '₱420.00', date: 'Jul 20, 2025 · 09:50 AM' },
  { id: '#CO0019', customer: 'Anne Garcia', type: 'Takeout', reason: 'Order placed by mistake', status: 'Approved', refund: '₱210.00', date: 'Jul 19, 2025 · 08:40 PM' },
  { id: '#CO0018', customer: 'Ricky Tan', type: 'Delivery', reason: 'Restaurant closed', status: 'Refunded', refund: '₱340.00', date: 'Jul 19, 2025 · 07:15 PM' },
];

export const resourceConfigs = {
  menus: { title: 'Manage Menus', description: 'Create, organize and manage your restaurant menus', singular: 'Menu', icon: 'bi-book', columns: [['name', 'Menu Name'], ['description', 'Description'], ['items', 'Items'], ['status', 'Status'], ['order', 'Menu Order']], metrics: [['12', 'Total Menus'], ['10', 'Active Menus'], ['2', 'Inactive Menus'], ['156', 'Total Items'], ['₱86,750.00', 'Menu Sales']], rows: menuItems },
  categories: { title: 'Categories', description: 'Manage food categories to organize your menu', singular: 'Category', icon: 'bi-grid', columns: [['name', 'Category'], ['description', 'Description'], ['items', 'Items'], ['status', 'Status']], metrics: [['18', 'Total Categories'], ['15', 'Active Categories'], ['2', 'Inactive Categories'], ['156', 'Total Items'], ['₱86,750.00', 'Category Sales']], rows: categories },
  foodItems: { title: 'Food Items', description: 'Manage and organize all food items in your menu', singular: 'Food Item', icon: 'bi-shop', columns: [['name', 'Item'], ['category', 'Category'], ['price', 'Price'], ['status', 'Status'], ['availability', 'Availability'], ['rating', 'Rating']], formFields: [{ key: 'name', label: 'Item name', placeholder: 'Enter food item name', required: true }, { key: 'category', label: 'Category', type: 'select', options: ['Burgers', 'Pizzas', 'Chicken', 'Snacks', 'Drinks', 'Desserts'] }, { key: 'price', label: 'Price', placeholder: '₱0.00', required: true }, { key: 'description', label: 'Description', placeholder: 'Describe the food item' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Scheduled'] }, { key: 'availability', label: 'Availability', type: 'select', options: ['In Stock', 'Out of Stock'] }], metrics: [['156', 'Total Items'], ['140', 'Active Items'], ['8', 'Inactive Items'], ['₱86,750.00', 'Total Sales'], ['4.8', 'Average Rating']], rows: foodItems },
  foodOptions: { title: 'Food Options', description: 'Manage food options and add-ons for menu items', singular: 'Option', icon: 'bi-sliders', columns: [['name', 'Option Name'], ['type', 'Option Type'], ['choices', 'Choices'], ['required', 'Required'], ['status', 'Status'], ['items', 'Items Using']], formFields: [{ key: 'name', label: 'Option name', placeholder: 'Enter option name', required: true }, { key: 'description', label: 'Description', placeholder: 'Describe this option' }, { key: 'type', label: 'Option type', type: 'select', options: ['Single Choice', 'Multiple Choice'] }, { key: 'choices', label: 'Choices', placeholder: 'Number of choices' }, { key: 'required', label: 'Required', type: 'select', options: ['Yes', 'No'] }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Scheduled'] }], metrics: [['86', 'Total Options'], ['72', 'Active Options'], ['14', 'Inactive Options'], ['156', 'Total Choices'], ['₱18,560.00', 'Option Sales']], rows: foodOptions },
  payments: { title: 'Payments', description: 'Monitor and manage all payment transactions', singular: 'Payment', icon: 'bi-wallet2', columns: [['id', 'Transaction ID'], ['order', 'Order ID'], ['customer', 'Customer'], ['method', 'Payment Method'], ['amount', 'Amount'], ['status', 'Status'], ['date', 'Date & Time']], formFields: [{ key: 'customer', label: 'Customer', placeholder: 'Customer name', required: true }, { key: 'method', label: 'Payment method', type: 'select', options: ['Cash', 'Card', 'GCash', 'PayMaya'] }, { key: 'amount', label: 'Amount', placeholder: '₱0.00', required: true }, { key: 'status', label: 'Status', type: 'select', options: ['Paid', 'Pending', 'Refunded', 'Failed'] }], metrics: [['₱18,450.00', 'Total Payments'], ['₱16,980.00', 'Paid Amount'], ['₱1,120.00', 'Pending'], ['₱350.00', 'Refunded'], ['68', 'Total Transactions']], rows: payments },
  discounts: { title: 'Discounts', description: 'Manage and configure discount codes and promotions', singular: 'Discount', icon: 'bi-tags', columns: [['code', 'Code'], ['name', 'Discount Name'], ['type', 'Type'], ['value', 'Discount Value'], ['minimum', 'Min. Order'], ['usage', 'Usage'], ['validity', 'Validity Period'], ['status', 'Status']], formFields: [{ key: 'code', label: 'Discount code', placeholder: 'e.g. WELCOME10', required: true }, { key: 'name', label: 'Discount name', placeholder: 'Discount name', required: true }, { key: 'type', label: 'Discount type', type: 'select', options: ['Percentage', 'Fixed Amount', 'Free Shipping'] }, { key: 'value', label: 'Discount value', placeholder: '10% OFF' }, { key: 'minimum', label: 'Minimum order', placeholder: '₱0.00' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Scheduled', 'Inactive'] }], metrics: [['24', 'Total Discounts'], ['12', 'Active Discounts'], ['5', 'Scheduled'], ['3', 'Inactive'], ['₱1,250.00', 'Total Discount Given']], rows: discounts },
  cancellations: { title: 'Cancellations', description: 'Manage and track cancelled orders and reasons', singular: 'Cancellation', icon: 'bi-x-circle', columns: [['id', 'Order ID'], ['customer', 'Customer'], ['type', 'Order Type'], ['date', 'Cancelled On'], ['reason', 'Reason'], ['status', 'Status'], ['refund', 'Refund Amount']], formFields: [{ key: 'customer', label: 'Customer', placeholder: 'Customer name', required: true }, { key: 'type', label: 'Order type', type: 'select', options: ['Dine-in', 'Takeout', 'Pickup', 'Delivery'] }, { key: 'reason', label: 'Reason', placeholder: 'Cancellation reason' }, { key: 'status', label: 'Status', type: 'select', options: ['Pending Review', 'Approved', 'Refunded', 'Rejected'] }, { key: 'refund', label: 'Refund amount', placeholder: '₱0.00' }], metrics: [['22', 'Total Cancellations'], ['7', 'Pending Review'], ['12', 'Approved'], ['3', 'Refunded'], ['₱2,480.00', 'Total Refunded']], rows: cancellations },
};
