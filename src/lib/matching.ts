import { cellValues, type Study } from '../data/model';

/**
 * The user's course profile: column key → the values chosen for it. A course
 * is not always one thing ("300 and 400 level", "Python and Java"), so a
 * filter holds several values; an empty list means "not set".
 */
export type FilterState = Record<string, string[]>;

export type ActiveFilter = readonly [key: string, values: string[]];

export function activeFilters(filters: FilterState): ActiveFilter[] {
  return Object.entries(filters)
    .filter(([, values]) => values.length > 0)
    .map(([key, values]) => [key, values] as const);
}

/**
 * How many of the active filters this study satisfies. Within one filter the
 * chosen values are alternatives - a study counts if it shares any of them -
 * while the filters themselves stack up.
 */
export function matchCount(study: Study, active: ActiveFilter[]): number {
  return active.filter(([key, values]) => cellValues(study.data, key).some((value) => values.includes(value))).length;
}
