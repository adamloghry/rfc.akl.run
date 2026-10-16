/** Like Array.prototype.forEach but the callback may `return err.add(...)` to bail out of one item. */
export function each<T>(items: readonly T[], fn: (item: T, index: number) => unknown): void {
  for (let i = 0; i < items.length; i++) fn(items[i], i);
}
