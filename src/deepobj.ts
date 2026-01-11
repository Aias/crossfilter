type Indexable = Record<string, unknown>;
type Action<TReturn> = (obj: Indexable, prop: string) => TReturn;

const isIndexable = (value: unknown): value is Indexable => {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
};

const deepobj = <TReturn>(action: Action<TReturn>, obj: unknown, path: string): TReturn => {
  const parts = path.split('.');
  const last = parts.pop() ?? '';
  let target: Indexable = isIndexable(obj) ? obj : {};

  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    const next = target[key];
    if (isIndexable(next)) {
      target = next;
      continue;
    }
    const created: Indexable = {};
    target[key] = created;
    target = created;
  }

  return action(target, last);
};

export default deepobj;
