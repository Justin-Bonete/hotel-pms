import {
  BarChart3, BedDouble, Building2, CalendarCheck, CalendarDays, ConciergeBell, LayoutDashboard, Package, Plug,
  Receipt, Settings, ShoppingCart, Sparkles, Store, TrendingUp, UserCog, Users, Wrench, type LucideIcon,
} from 'lucide-react';
import type { PermissionKey } from '@pms/types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Built and working now. Everything else renders an honest "Coming soon" page. */
  ready: boolean;
  /** Which build phase delivers it (shown on the placeholder page). */
  phase?: string;
  /** Required permission for a working page. The API independently enforces access. */
  permission?: PermissionKey;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, ready: true, permission: 'property.read' },
  { label: 'Properties', href: '/properties', icon: Building2, ready: true, permission: 'property.read' },
  { label: 'Reservations', href: '/reservations', icon: CalendarCheck, ready: true, permission: 'reservation.read' },
  { label: 'Front Desk', href: '/front-desk', icon: ConciergeBell, ready: false, phase: 'Phase 4' },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays, ready: true, permission: 'reservation.read' },
  { label: 'Rooms', href: '/rooms', icon: BedDouble, ready: true, permission: 'room.read' },
  { label: 'Housekeeping', href: '/housekeeping', icon: Sparkles, ready: false, phase: 'Phase 4' },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench, ready: false, phase: 'Phase 4' },
  { label: 'Guests', href: '/guests', icon: Users, ready: true, permission: 'guest.read' },
  { label: 'POS', href: '/pos', icon: Store, ready: false, phase: 'Phase 5' },
  { label: 'Inventory', href: '/inventory', icon: Package, ready: false, phase: 'Phase 5' },
  { label: 'Purchasing', href: '/purchasing', icon: ShoppingCart, ready: false, phase: 'Phase 5' },
  { label: 'Expenses', href: '/expenses', icon: Receipt, ready: false, phase: 'Phase 5' },
  { label: 'Reports', href: '/reports', icon: BarChart3, ready: false, phase: 'Phase 6' },
  { label: 'Analytics', href: '/analytics', icon: TrendingUp, ready: false, phase: 'Phase 6' },
  { label: 'Staff', href: '/staff', icon: UserCog, ready: false, phase: 'Phase 1 (step 7)' },
  { label: 'Integrations', href: '/integrations', icon: Plug, ready: false, phase: 'Phase 7' },
  { label: 'Settings', href: '/settings', icon: Settings, ready: true },
];
