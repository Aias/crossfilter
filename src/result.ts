import deep from "@ranfdev/deepobj";

type AnyObject = Record<string, unknown>;

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

const get = (obj: AnyObject, prop: string): unknown => {
  const value = obj[prop];
  if (isFunction(value)) {
    return value.call(obj);
  }
  return value;
};

/**
 * get value of object at a deep path.
 * if the resolved value is a function,
 * it's invoked with the `this` binding of
 * its parent object and its result is returned.
 *
 * @param obj - the object (e.g. { 'a': [{ 'b': { 'c1': 3, 'c2': 4} }], 'd': {e:1} }; )
 * @param path - deep path (e.g. `d.e` or `a[0].b.c1`. Dot notation (a.0.b) is also supported)
 * @returns the resolved value
 */
const reg = /\[([\w\d]+)\]/g;
export default <TValue>(obj: unknown, path: string): TValue => {
  return deep<TValue>(get, obj, path.replace(reg, '.$1'));
};
