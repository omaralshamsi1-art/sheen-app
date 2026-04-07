// ─────────────────────────────────────────────
// MENU ITEMS
// ─────────────────────────────────────────────
export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  selling_price: number;
  is_active: boolean;
  estimated_cogs: number;
  packaging_cost: number;
  gross_margin: number;
  image_url: string | null;
  created_at: string;
}

export type MenuCategory =
  | 'Coffee'
  | 'Matcha'
  | 'Cold Drinks'
  | 'Açaí'
  | 'Desserts'
  | 'Bites';

// ─────────────────────────────────────────────
// INGREDIENTS
// ─────────────────────────────────────────────
export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  pack_size: string | null;
  pack_cost: number;
  cost_per_unit: number;
  notes: string | null;
  updated_at: string;
}

export type IngredientCategory =
  | 'Coffee'
  | 'Dairy'
  | 'Matcha'
  | 'Packaging'
  | 'Fruit'
  | 'Syrup'
  | 'Baking'
  | 'Other';

export type IngredientUnit = 'grams' | 'ml' | 'piece';

// ─────────────────────────────────────────────
// RECIPE LINES
// ─────────────────────────────────────────────
export interface RecipeLine {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  qty: number;
  unit: string;
  unit_cost: number;
  line_cost: number;
}

// ─────────────────────────────────────────────
// SALES
// ─────────────────────────────────────────────
export interface Sale {
  id: string;
  sale_date: string;
  recorded_at: string;
  total_cups: number;
  total_revenue: number;
  recorded_by: string | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  menu_item_id: string;
  name: string;
  category: string;
  price: number;
  qty: number;
  total: number;
}

export interface SalePayload {
  sale_date: string;
  items: Omit<SaleItem, 'id' | 'sale_id'>[];
  recorded_by?: string;
}

// ─────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────
export interface Expense {
  id: string;
  expense_date: string;
  recorded_at: string;
  ingredient_name: string;
  category: IngredientCategory;
  supplier: string | null;
  unit: string | null;
  qty_bought: number;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  added_by: string | null;
}

export interface ExpensePayload {
  expense_date: string;
  ingredient_name: string;
  category: IngredientCategory;
  supplier?: string;
  unit?: string;
  qty_bought: number;
  unit_cost: number;
  total_cost: number;
  notes?: string;
  added_by?: string;
}

// ─────────────────────────────────────────────
// FIXED COSTS
// ─────────────────────────────────────────────
export interface FixedCost {
  id: string;
  month: string;
  category: FixedCostCategory;
  description: string;
  amount: number;
  is_paid: boolean;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
}

export type FixedCostCategory =
  | 'Rent'
  | 'Wages'
  | 'Utilities'
  | 'Internet'
  | 'Insurance'
  | 'Equipment'
  | 'Marketing'
  | 'Other';

export interface FixedCostPayload {
  month: string;
  category: FixedCostCategory;
  description: string;
  amount: number;
  due_date?: string;
  notes?: string;
}

// ─────────────────────────────────────────────
// AI CHAT
// ─────────────────────────────────────────────
export interface AiChat {
  id: string;
  session_date: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AiChatPayload {
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export interface AiContextResponse {
  salesContext: string;
  expensesContext: string;
  fixedCostsContext: string;
  menuContext: string;
  netProfit: number;
}

// ─────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────
export interface PLReport {
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  fixed_costs: number;
  net_profit: number;
  net_margin: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
}

export interface TopSeller {
  name: string;
  category: string;
  qty: number;
  revenue: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  cups: number;
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
export interface DashboardKPIs {
  total_revenue: number;
  total_cups: number;
  total_expenses: number;
  net_profit: number;
}

export interface HourlySales {
  hour: number;
  cups: number;
}

// ─────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────
export type OrderStatus = 'pending' | 'confirmed' | 'rejected' | 'completed';

export interface Order {
  id: string;
  customer_id: string;
  customer_email: string | null;
  customer_name: string | null;
  status: OrderStatus;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
  total: number;
}

// ─────────────────────────────────────────────
// USER ROLES
// ─────────────────────────────────────────────
export type UserRole = 'admin' | 'staff' | 'customer';

export interface UserRoleRecord {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  allowed_pages: string[] | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────
// COMMON
// ─────────────────────────────────────────────
export interface DateRange {
  start: string;
  end: string;
}

export interface ApiError {
  message: string;
  status?: number;
}
