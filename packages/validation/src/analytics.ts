import { MAX_ANALYTICS_DAYS, inclusiveDays } from '@pms/types';
import { z } from 'zod';
import { dateSchema } from './reservations';

export const analyticsQuerySchema = z
  .object({ propertyId: z.string().uuid().optional(), from: dateSchema, to: dateSchema })
  .refine((v) => v.from <= v.to, { path: ['to'], message: 'The end date can’t be before the start date' })
  .refine((v) => v.from > v.to || inclusiveDays(v.from, v.to) <= MAX_ANALYTICS_DAYS, { path: ['to'], message: `Choose a range of at most ${MAX_ANALYTICS_DAYS} days` });

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
