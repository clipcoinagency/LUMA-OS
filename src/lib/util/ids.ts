export function newId(prefix = ''): string {
  const c = globalThis.crypto;
  const raw = c && typeof c.randomUUID === 'function'
    ? c.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  return prefix ? `${prefix}_${raw}` : raw;
}
