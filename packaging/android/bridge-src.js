// Native adapters for the Android build, bundled to dist/native-capacitor.js by esbuild and loaded on
// demand by src/lib/platform/platform.ts (native glue can't be inlined into the single-file build).
//  • saveTextFile — Android WebView ignores <a download>, so backups are written to app cache and
//    handed to the system share sheet ("Save to Files", Drive, email, …).
//  • notifications — reminders handed to Android's own alarm scheduler, so they fire even when the
//    app is closed or the phone has restarted (the WebView has no web Notification API at all).
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';

const toNative = (i) => ({
  id: i.id, title: i.title, body: i.body, largeBody: i.body,
  extra: { route: i.route || '' },
  ...(i.at ? { schedule: { at: new Date(i.at), allowWhileIdle: true } } : {}),
});

window.LifeOSNative = {
  async saveTextFile(name, text) {
    const written = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: name, dialogTitle: 'Save your Life OS backup', files: [written.uri] });
    } catch (e) {
      if (/cancel/i.test(String(e && e.message))) return { ok: false, cancelled: true };
      throw e;
    }
    return { ok: true, via: 'android-share-sheet', where: 'the place you chose' };
  },

  notifications: {
    async permission() { return (await LocalNotifications.checkPermissions()).display; },
    async request() { return (await LocalNotifications.requestPermissions()).display; },
    /** Replace every pending Life OS reminder with this list ({ id, title, body, at (ms), route }). */
    async replaceAll(items) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      if (items.length) await LocalNotifications.schedule({ notifications: items.map(toNative) });
    },
    async showNow(item) { await LocalNotifications.schedule({ notifications: [toNative({ ...item, at: null })] }); },
    onTap(cb) { void LocalNotifications.addListener('localNotificationActionPerformed', (a) => cb((a.notification && a.notification.extra && a.notification.extra.route) || '')); },
  },
};
