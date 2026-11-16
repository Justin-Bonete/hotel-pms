import type { ApiKeyView, WebhookDeliveryView, WebhookEndpointView } from '@pms/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useApiKeys = (enabled = true) => useQuery({ queryKey: ['api-keys'], queryFn: () => api.get<ApiKeyView[]>('/integrations/api-keys'), enabled });
export const useWebhooks = (enabled = true) => useQuery({ queryKey: ['webhooks'], queryFn: () => api.get<WebhookEndpointView[]>('/integrations/webhooks'), enabled });
export const useDeliveries = (endpointId: string | null) =>
  useQuery({ queryKey: ['webhook-deliveries', endpointId], queryFn: () => api.get<WebhookDeliveryView[]>(`/integrations/webhooks/${endpointId}/deliveries`), enabled: Boolean(endpointId), refetchInterval: 10_000 });

export function useRefreshIntegrations() {
  const queryClient = useQueryClient();
  return () => Promise.all(['api-keys', 'webhooks', 'webhook-deliveries'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
}
