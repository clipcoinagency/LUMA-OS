// A single "data changed" signal. Every write bumps it; views re-query when it changes.
// (Queries are cheap — Phase 0 measured a month range on 21k records in ~60 ms.)
export const changes = $state({ version: 0 });

export function bump() {
  changes.version += 1;
}
