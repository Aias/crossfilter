declare module '@ranfdev/deepobj' {
  type GetFn = (obj: Record<string, unknown>, prop: string) => unknown;
  function deep<TValue>(get: GetFn, obj: unknown, path: string): TValue;
  export default deep;
}
