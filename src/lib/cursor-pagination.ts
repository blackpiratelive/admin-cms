export interface CursorPaginationParams {
  cursor?: string | null;
  limit?: number;
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Helper to build SQL condition for cursor pagination on date/timestamp strings.
 */
export function buildCursorCondition(
  column: any,
  cursor: string | null | undefined
) {
  if (!cursor) return undefined;
  return cursor;
}
