/** Who is doing something. userId is null when it is done by an API key rather than a signed-in person. */
export interface Actor {
  organizationId: string;
  userId: string | null;
  /** e.g. "api_key:Website booking widget", recorded in the audit log. */
  via?: string;
}
