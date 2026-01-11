const reduceIncrement = (p: number, _v: unknown, _nf: boolean): number => {
  return p + 1;
};

const reduceDecrement = (p: number, _v: unknown, _nf: boolean): number => {
  return p - 1;
};

const reduceAdd = <T>(f: (v: T) => number) => {
  return (p: number, v: T, _nf: boolean, _j?: number): number => {
    return p + +f(v);
  };
};

const reduceSubtract = <T>(f: (v: T) => number) => {
  return (p: number, v: T, _nf: boolean, _j?: number): number => {
    return p - f(v);
  };
};

export default {
  reduceIncrement,
  reduceDecrement,
  reduceAdd,
  reduceSubtract
};
