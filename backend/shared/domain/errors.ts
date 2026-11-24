export class DomainError extends Error {
  constructor(public readonly code: 'invalid' | 'not_found' | 'forbidden' | 'unauthorized' | 'conflict', message: string) {
    super(message);
  }
}
export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DomainError('invalid', message);
}
