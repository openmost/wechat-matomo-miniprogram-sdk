import type { Platform } from './platform';
import type { Params } from './types';

export const VISIT_TIMEOUT_MS = 1_800_000;
const KEY = 'visitor';

/** What the visitor may do with storage: nothing (stored data removed), read only, or read and write. */
export const enum Storage {
  None,
  Read,
  Write,
}

interface VisitorState {
  id: string;
  createdTs: number;
  visitCount: number;
  currentVisitTs: number;
  previousVisitTs: number;
  lastActivityTs: number;
}

export function generateVisitorId(random: () => number): string {
  let id = '';
  for (let i = 0; i < 16; i++) id += Math.floor(random() * 16).toString(16);
  return id;
}

function isState(v: unknown): v is VisitorState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    /^[0-9a-f]{16}$/.test(s.id) &&
    ['createdTs', 'visitCount', 'currentVisitTs', 'previousVisitTs', 'lastActivityTs'].every(
      (k) => typeof s[k] === 'number',
    )
  );
}

const seconds = (ms: number): number => Math.floor(ms / 1000);

/** Matomo visitor id (`_id`) plus the visit counters Matomo JS keeps in its `_pk_id` cookie. */
export class Visitor {
  private state: VisitorState;

  constructor(
    private readonly platform: Platform,
    private storage: Storage,
  ) {
    const stored = storage === Storage.None ? undefined : platform.getItem<unknown>(KEY);
    this.state = isState(stored) ? stored : this.fresh();
    if (storage === Storage.None) platform.removeItem(KEY);
  }

  get id(): string {
    return this.state.id;
  }

  touch(): { newVisit: boolean } {
    const now = this.platform.now();
    const s = this.state;
    const newVisit = s.lastActivityTs === 0 || now - s.lastActivityTs > VISIT_TIMEOUT_MS;
    if (newVisit) {
      s.previousVisitTs = s.currentVisitTs;
      s.currentVisitTs = now;
      s.visitCount += 1;
    }
    s.lastActivityTs = now;
    this.save();
    return { newVisit };
  }

  params(): Params {
    const s = this.state;
    return {
      _id: s.id,
      _idts: seconds(s.createdTs),
      _idvc: s.visitCount,
      _viewts: s.previousVisitTs > 0 ? seconds(s.previousVisitTs) : undefined,
    };
  }

  /** None removes the stored copy; Read keeps it untouched; Write saves the current state. */
  setStorage(storage: Storage): void {
    this.storage = storage;
    if (storage === Storage.None) this.platform.removeItem(KEY);
    else this.save();
  }

  reset(): void {
    this.state = this.fresh();
    this.platform.removeItem(KEY);
  }

  private fresh(): VisitorState {
    return {
      id: generateVisitorId(() => this.platform.random()),
      createdTs: this.platform.now(),
      visitCount: 0,
      currentVisitTs: 0,
      previousVisitTs: 0,
      lastActivityTs: 0,
    };
  }

  private save(): void {
    if (this.storage === Storage.Write) this.platform.setItem(KEY, this.state);
  }
}
