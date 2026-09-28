/** Mini program globals the SDK wraps (see lifecycle.ts). Declared loosely on purpose. */
declare let App: ((options: Record<string, unknown>) => unknown) | undefined;
declare let Page: ((options: Record<string, unknown>) => unknown) | undefined;
declare let Component: ((options: Record<string, unknown>) => unknown) | undefined;
declare const wx: import('./platform').WxLike | undefined;
