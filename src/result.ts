function property(object: unknown, key: string): unknown {
  if (object === null || object === undefined)
    throw new TypeError("Cannot read properties of null or undefined");
  const value: unknown = Reflect.get(Object(object), key);
  return value;
}

export default function result(object: unknown, path: string): unknown {
  const parts = path.replace(/\[([\w\d]+)\]/g, ".$1").split(".");
  let parent = object;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = property(parent, parts[i]) || {};
    if (!isObject(parent) || !Reflect.set(parent, parts[i], next)) {
      throw new TypeError("Cannot assign a property on the path");
    }
    parent = next;
  }
  const value = property(parent, parts[parts.length - 1]);
  if (typeof value === "function") {
    const resolved: unknown = Reflect.apply(value, parent, []);
    return resolved;
  }
  return value;
}

function isObject(value: unknown): value is object {
  return value !== null && (typeof value === "object" || typeof value === "function");
}
