// Serialize native side effects so an old pending update cannot outlive a privacy reset.
let generation = 0;
let tail: Promise<unknown> = Promise.resolve();

export function invalidateNativeAccountTasks() { generation += 1; }

export function runNativeAccountTask<T>(work: () => Promise<T>): Promise<T | undefined> {
  const owner = generation;
  const next = tail.catch(() => {}).then(() => owner === generation ? work() : undefined);
  tail = next;
  return next;
}
