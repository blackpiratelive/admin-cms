import { unstable_cache, revalidateTag } from "next/cache";

export function createCachedQuery<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  options: { tags: string[]; revalidate?: number }
): T {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return fn;
  }

  try {
    return unstable_cache(fn, keyParts, options);
  } catch {
    return fn;
  }
}

export function purgeTag(tag: string) {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return;
  }
  try {
    (revalidateTag as any)(tag);
  } catch {
    // ignore outside active Next server context
  }
}
