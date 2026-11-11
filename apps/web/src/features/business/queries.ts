import type { ExpenseListView, InventoryItemView, PurchaseOrderView, StockMovementView, SupplierInvoiceView, SupplierView } from '@pms/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useInventory = (propertyId: string, enabled = true) =>
  useQuery({ queryKey: ['inventory', propertyId], queryFn: () => api.get<InventoryItemView[]>(`/properties/${propertyId}/inventory`), enabled });

export const useMovements = (propertyId: string, itemId: string | null) =>
  useQuery({ queryKey: ['inventory-movements', propertyId, itemId], queryFn: () => api.get<StockMovementView[]>(`/properties/${propertyId}/inventory/${itemId}/movements`), enabled: Boolean(itemId) });

export const useSuppliers = (enabled = true) => useQuery({ queryKey: ['suppliers'], queryFn: () => api.get<SupplierView[]>('/suppliers'), enabled });

export const useOrders = (propertyId: string, enabled = true) =>
  useQuery({ queryKey: ['purchase-orders', propertyId], queryFn: () => api.get<PurchaseOrderView[]>(`/properties/${propertyId}/purchase-orders`), enabled });

export const useInvoices = (propertyId: string, enabled = true) =>
  useQuery({ queryKey: ['supplier-invoices', propertyId], queryFn: () => api.get<SupplierInvoiceView[]>(`/properties/${propertyId}/supplier-invoices`), enabled });

export const useExpenses = (propertyId: string, p: { category: string; from: string; to: string; page: number }, enabled = true) => {
  const qs = new URLSearchParams({ page: String(p.page), pageSize: '25' });
  if (p.category) qs.set('category', p.category);
  if (p.from) qs.set('from', p.from);
  if (p.to) qs.set('to', p.to);
  return useQuery({ queryKey: ['expenses', propertyId, qs.toString()], queryFn: () => api.get<ExpenseListView>(`/properties/${propertyId}/expenses?${qs}`), enabled });
};

/** Stock, orders, invoices and expenses all move together (receiving adds stock, paying adds an expense). */
export function useRefreshBusiness() {
  const queryClient = useQueryClient();
  return () => Promise.all(['inventory', 'inventory-movements', 'purchase-orders', 'supplier-invoices', 'expenses', 'suppliers'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
}
