type ClassValue = string | number | null | undefined | false | ClassDictionary | ClassArray;
type ClassDictionary = Record<string, boolean>;
type ClassArray = ClassValue[];

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (typeof value === 'string' || typeof value === 'number') {
      classes.push(String(value));
      continue;
    }
    if (Array.isArray(value)) {
      const inner = cn(...value);
      if (inner) classes.push(inner);
      continue;
    }
    for (const key of Object.keys(value)) {
      if (value[key]) classes.push(key);
    }
  }
  return classes.join(' ');
}
