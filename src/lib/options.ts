import type { SelectOption } from '../components/ui/Select';

/** Turn a list of strings into <select> options with identical value and label. */
export function toOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}
