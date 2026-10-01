import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import { installFonts } from './styles/fonts';
import { initPwa } from './lib/pwa.svelte';
import App from './App.svelte';

installFonts();
initPwa();

// Last-resort guard: never show a raw JavaScript error to the customer.
function fatal(err: unknown) {
  console.error(err);
  const el = document.getElementById('app');
  if (el && !el.dataset.fatal) {
    el.dataset.fatal = '1';
    el.innerHTML = '<div style="max-width:420px;margin:15vh auto;padding:24px;text-align:center;font-family:system-ui,sans-serif">' +
      '<h1 style="font-size:22px;margin:0 0 8px">Something went wrong</h1>' +
      '<p style="color:#6b5a60;margin:0 0 16px">Life OS hit an unexpected problem. Your saved data is not affected. Reloading usually fixes it.</p>' +
      '<button onclick="location.reload()" style="min-height:44px;padding:0 20px;border-radius:999px;border:0;background:#a5546c;color:#fff;font-weight:600;cursor:pointer">Reload Life OS</button></div>';
  }
}

try {
  mount(App, { target: document.getElementById('app')! });
} catch (e) {
  fatal(e);
}
window.addEventListener('unhandledrejection', (e) => console.error('Unhandled:', e.reason));
