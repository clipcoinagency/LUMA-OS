// Native file-save adapter for the Android build. Android WebView ignores <a download>,
// so backups are written to app cache and handed to the system share sheet
// ("Save to Files", Drive, email, …). Bundled to dist/native-capacitor.js by esbuild, then
// loaded on demand by src/lib/platform/platform.ts's saveTextFile() (it can't be inlined into
// the single-file build since it's native glue specific to this shell).
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
};
