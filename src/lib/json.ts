import { stripBom } from './text';

/**
 * Reading JSON that came from outside: a file the user loaded, or the
 * site.json of a published site. Both are text anyone may have written or
 * edited by hand, so what comes out is `unknown` until it has been checked.
 */

/** `JSON.parse` on text as a file holds it, byte-order mark and all. */
export function parseJson(text: string): unknown {
  return JSON.parse(stripBom(text));
}

/** True for a plain object: not null, and not a list. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
