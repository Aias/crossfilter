export interface ComparableObject {
  valueOf(): string | number | boolean;
}

export type NaturallyOrderedValue = string | number | boolean | ComparableObject;
