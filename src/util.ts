/** Small helpers shared by several modules. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}

/** Runs `fn`; any exception goes to `onError` instead of propagating (SDK code never throws into the host). */
export function guard(fn: () => void, onError: (error: unknown) => void): void {
  try {
    fn();
  } catch (error) {
    onError(error);
  }
}
