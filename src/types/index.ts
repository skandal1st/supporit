// Роли пользователей
export type UserRole = 'admin' | 'it_specialist' | 'employee';

// Статусы оборудования
export type EquipmentStatus = 'in_use' | 'in_stock' | 'in_repair' | 'written_off';

// Категории оборудования
export type EquipmentCategory = 
  | 'computer'
  | 'monitor'
  | 'printer'
  | 'network'
  | 'server'
  | 'mobile'
  | 'peripheral'
  | 'other';

// Приоритеты заявок
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

// Статусы заявок
export type TicketStatus = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

// Категории заявок
export type TicketCategory = 'hardware' | 'software' | 'network' | 'other';

// Пользователь
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  position?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Оборудование
export interface Equipment {
  id: string;
  name: string;
  model?: string;
  inventory_number: string;
  serial_number?: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  purchase_date?: string;
  cost?: number;
  warranty_until?: string;
  current_owner_id?: string;
  current_owner?: User;
  location_department?: string;
  location_room?: string;
  manufacturer?: string;
  ip_address?: string;
  specifications?: Record<string, any>;
  attachments?: string[]; // URLs файлов
  qr_code?: string;
  created_at: string;
  updated_at: string;
}

// История перемещений оборудования
export interface EquipmentHistory {
  id: string;
  equipment_id: string;
  from_user_id?: string;
  from_user?: User;
  to_user_id?: string;
  to_user?: User;
  from_location?: string;
  to_location?: string;
  reason?: string;
  changed_by_id: string;
  changed_by?: User;
  created_at: string;
}

// Расходный материал для оборудования
export interface EquipmentConsumable {
  consumable_id: string;
  consumable_name: string;
  consumable_model?: string;
  consumable_category: string;
  quantity_per_unit: number;
  quantity_in_stock: number;
  min_quantity: number;
  is_low_stock: boolean;
}

// Заявка
export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  creator_id: string;
  creator?: User;
  assignee_id?: string;
  assignee?: User;
  equipment_id?: string;
  equipment?: Equipment;
  location_department?: string;
  location_room?: string;
  consumables?: EquipmentConsumable[];
  selected_consumables?: string[]; // IDs выбранных расходников
  attachments?: string[]; // URLs файлов
  desired_resolution_date?: string;
  resolved_at?: string;
  closed_at?: string;
  rating?: number; // 1-5
  rating_comment?: string;
  created_at: string;
  updated_at: string;
}

// Комментарий к заявке
export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  user?: User;
  content: string;
  attachments?: string[];
  created_at: string;
}

// История заявки
export interface TicketHistory {
  id: string;
  ticket_id: string;
  changed_by_id: string;
  changed_by?: User;
  field: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

// Здание
export interface Building {
  id: string;
  name: string;
  address?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Расходные материалы
export interface Consumable {
  id: string;
  name: string;
  model?: string;
  category?: string;
  consumable_type?: string; // cartridge, drum, toner, ink, paper, other
  unit: string; // шт, упак, и т.д.
  quantity_in_stock: number;
  min_quantity: number;
  cost_per_unit?: number;
  supplier?: string;
  last_purchase_date?: string;
  created_at: string;
  updated_at: string;
}

// История выдачи расходников
export interface ConsumableIssue {
  id: string;
  consumable_id: string;
  consumable?: Consumable;
  quantity: number;
  issued_to_id: string;
  issued_to?: User;
  issued_by_id: string;
  issued_by?: User;
  reason?: string;
  created_at: string;
}

// Лицензия ПО
export interface SoftwareLicense {
  id: string;
  software_name: string;
  vendor: string;
  license_type: string; // корпоративная, индивидуальная и т.д.
  total_licenses: number;
  used_licenses: number;
  expires_at?: string;
  cost?: number;
  purchase_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Привязка лицензии
export interface LicenseAssignment {
  id: string;
  license_id: string;
  license?: SoftwareLicense;
  equipment_id?: string;
  equipment?: Equipment;
  user_id?: string;
  user?: User;
  assigned_at: string;
  released_at?: string;
}

// Плановые работы
export interface Maintenance {
  id: string;
  equipment_id: string;
  equipment?: Equipment;
  title: string;
  description?: string;
  scheduled_date: string;
  frequency?: string; // ежедневно, еженедельно, ежемесячно и т.д.
  last_performed_at?: string;
  next_due_date: string;
  assigned_to_id?: string;
  assigned_to?: User;
  status: 'pending' | 'completed' | 'skipped';
  created_at: string;
  updated_at: string;
}

// База знаний
export interface KnowledgeBase {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  author_id: string;
  author?: User;
  views_count: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// Уведомление
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  related_type?: string; // 'ticket', 'equipment', etc.
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

// Zabbix типы
export interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: string;
  available?: boolean;
  lastCheck?: string;
  interfaces?: Array<{
    interfaceid: string;
    ip: string;
    type: string;
    main: string;
    available: string;
  }>;
}

export interface ZabbixPageCounters {
  total: number | null;
  black: number | null;
  color: number | null;
}

export interface ZabbixGroup {
  groupid: string;
  name: string;
}

export interface ZabbixTemplate {
  templateid: string;
  name: string;
  host: string;
}

export interface ZabbixEquipmentStatus {
  found: boolean;
  reason?: 'no_ip' | 'not_in_zabbix';
  message?: string;
  hostid?: string;
  hostname?: string;
  available?: boolean;
  lastCheck?: string;
  ip?: string;
}

export interface ZabbixSupply {
  name: string;
  level: number | null;
  maxLevel: number | null;
  percent: number | null;
  color?: string;
}

export interface ZabbixEquipmentCounters {
  supported: boolean;
  found: boolean;
  reason?: string;
  message?: string;
  hostid?: string;
  hostname?: string;
  counters?: ZabbixPageCounters;
  supplies?: ZabbixSupply[];
}



