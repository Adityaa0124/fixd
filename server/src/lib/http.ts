export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const bad = (m: string) => new HttpError(400, m);
export const notFound = (m = 'not found') => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);

export const LANES = {
  needs_review: ['open'],
  spot_check: ['auto_applied'],
  no_change: ['no_change'],
  done: ['approved', 'edited', 'rejected', 'confirmed', 'acknowledged'],
} as const;
export type Lane = keyof typeof LANES;
export const isLane = (x: unknown): x is Lane => typeof x === 'string' && Object.hasOwn(LANES, x);
