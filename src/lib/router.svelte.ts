// Hash router: works identically on file://, https, Tauri and Capacitor (no server rewrites needed).
import type { ModuleId } from './db/schema';

export type Route =
  | { name: 'dashboard' }
  | { name: 'module'; module: ModuleId }
  | { name: 'settings'; section?: string }
  | { name: 'dev'; page: 'design' | 'data' };

const MODULE_SET = new Set(['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance']);

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b] = parts;
  if (!a || a === 'dashboard') return { name: 'dashboard' };
  if (MODULE_SET.has(a)) return { name: 'module', module: a as ModuleId };
  if (a === 'settings') return { name: 'settings', section: b };
  if (a === 'dev') return { name: 'dev', page: b === 'data' ? 'data' : 'design' };
  return { name: 'dashboard' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'dashboard': return '#/dashboard';
    case 'module': return `#/${r.module}`;
    case 'settings': return r.section ? `#/settings/${r.section}` : '#/settings';
    case 'dev': return `#/dev/${r.page}`;
  }
}

class Router {
  route = $state<Route>(typeof location !== 'undefined' ? parse(location.hash) : { name: 'dashboard' });

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => { this.route = parse(location.hash); });
    }
  }

  go(r: Route) {
    const h = href(r);
    if (location.hash !== h) location.hash = h;
    else this.route = r;
  }
}

export const router = new Router();
