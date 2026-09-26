// "Today" as reactive state: rolls over at local midnight (and when the tab wakes up), so a
// dashboard left open overnight shows the new day instead of yesterday's.
import { today, type DateKey } from './util/dates';

export const clock = $state<{ today: DateKey; hour: number }>({ today: today(), hour: new Date().getHours() });

function tick() {
  const t = today();
  const h = new Date().getHours();
  if (t !== clock.today) clock.today = t;
  if (h !== clock.hour) clock.hour = h;
}

if (typeof window !== 'undefined') {
  setInterval(tick, 30_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
