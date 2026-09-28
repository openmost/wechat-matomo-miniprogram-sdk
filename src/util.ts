/** Small helpers shared by several modules. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}
