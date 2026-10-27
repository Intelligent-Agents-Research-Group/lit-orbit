import { activeFilters, type FilterState } from './matching';

/**
 * The part of the view a link can carry: the settings of the course, and the
 * study open in the panel. Written into the page's `#fragment` as they change,
 * so the address bar always holds a link to the view on screen, and read back
 * when a page opens on one.
 *
 * The fragment rather than a query string, because a published site is a
 * folder of static files: a browser never sends the fragment to the server,
 * so no host has to be taught about it, and changing it does not reload the
 * page.
 *
 * The shape is `#course=<column>:<value>,<value>;<column>:<value>&study=<row>`.
 * Column names and values come from the user's file and can hold anything, so
 * each is percent-encoded on its own; the separators are all characters
 * `encodeURIComponent` encodes, so none can be mistaken for one.
 */
export interface UrlState {
  filters: FilterState;
  /** Row id of the study open in the panel; `null` when none is. */
  study: number | null;
}

const COURSE_PARAM = 'course';
const STUDY_PARAM = 'study';

/** Read the view a fragment names. A fragment that names nothing, or is malformed, reads as an empty view. */
export function parseUrlState(hash: string): UrlState {
  const state: UrlState = { filters: {}, study: null };
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  if (fragment === '') return state;
  for (const part of fragment.split('&')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (name === COURSE_PARAM) state.filters = parseFilters(value);
    else if (name === STUDY_PARAM) state.study = parseStudy(value);
  }
  return state;
}

/** The fragment naming a view, `#` included, or an empty string when there is nothing to name. */
export function formatUrlState(state: UrlState): string {
  const parts: string[] = [];
  const filters = formatFilters(state.filters);
  if (filters !== '') parts.push(`${COURSE_PARAM}=${filters}`);
  if (state.study !== null) parts.push(`${STUDY_PARAM}=${state.study}`);
  return parts.length === 0 ? '' : '#' + parts.join('&');
}

function parseFilters(encoded: string): FilterState {
  const filters: FilterState = {};
  for (const entry of encoded.split(';')) {
    const separator = entry.indexOf(':');
    if (separator === -1) continue;
    const key = decode(entry.slice(0, separator));
    if (key === null || key === '') continue;
    const values: string[] = [];
    for (const value of entry.slice(separator + 1).split(',')) {
      const decoded = decode(value);
      if (decoded !== null && decoded !== '' && !values.includes(decoded)) values.push(decoded);
    }
    if (values.length > 0) filters[key] = values;
  }
  return filters;
}

function formatFilters(filters: FilterState): string {
  return activeFilters(filters)
    .map(([key, values]) => encodeURIComponent(key) + ':' + values.map(encodeURIComponent).join(','))
    .join(';');
}

function parseStudy(encoded: string): number | null {
  return /^\d+$/.test(encoded) ? Number(encoded) : null;
}

/** `decodeURIComponent` throws on a stray `%`; a value that cannot be read is dropped instead. */
function decode(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Put the view into the address bar without reloading the page or adding to
 * its history: every pill clicked would otherwise be a step for the back
 * button to retrace. An empty view leaves the address clean.
 */
export function replaceUrlState(state: UrlState): void {
  const fragment = formatUrlState(state);
  const current = location.hash === '' ? '' : location.hash;
  if (fragment === current) return;
  history.replaceState(history.state, '', location.pathname + location.search + fragment);
}
