export type ScopeType = "ORGANIZATION" | "GROUP" | "PROPERTY";

export interface ApiMeta { page: number; pageSize: number; total: number }
export interface ApiSuccess<T> { data: T; meta?: ApiMeta }
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown[] };
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  organization: { id: string; name: string; slug: string };
}

export interface AuthPayload {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

export interface PropertySummary {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  city: string | null;
  region: string | null;
  groupName: string | null;
  roomCount: number;
}

export interface PropertyDetail extends PropertySummary {
  groupId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
}

export interface DeviceSession {
  id: string;
  device: string | null;
  ip: string | null;
  signedInAt: string;
  lastActiveAt: string;
  current: boolean;
}

export * from './permissions';
export * from './rooms';

export interface AccessSummary {
  roles: Array<{ key: string; scopeType: ScopeType; scopeId: string }>;
  /** permission -> where it applies. all=true means every property in the organization. */
  permissions: Record<string, { all: boolean; propertyIds: string[] }>;
  /** 'ALL' or the property ids this user can see at all. */
  visibleProperties: 'ALL' | string[];
}
