/** Friendly label for the "signed-in devices" list. Best-effort, not for security decisions. */
export function describeDevice(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';
  const os = /Windows/i.test(userAgent)
    ? 'Windows'
    : /iPhone|iPad/i.test(userAgent)
      ? 'iOS'
      : /Android/i.test(userAgent)
        ? 'Android'
        : /Mac OS X/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Unknown OS';
  const browser = /Edg\//i.test(userAgent)
    ? 'Edge'
    : /Firefox\//i.test(userAgent)
      ? 'Firefox'
      : /Chrome\//i.test(userAgent)
        ? 'Chrome'
        : /Safari\//i.test(userAgent)
          ? 'Safari'
          : 'Browser';
  return `${browser} on ${os}`;
}
