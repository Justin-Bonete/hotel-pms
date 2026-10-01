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
}

export interface DeviceSession {
  id: string;
  device: string | null;
  ip: string | null;
  signedInAt: string;
  lastActiveAt: string;
  current: boolean;
}
