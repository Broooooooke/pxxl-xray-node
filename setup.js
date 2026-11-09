const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const url = 'https://github.com/XTLS/Xray-core/releases/download/v25.10.15/Xray-linux-64.zip';
// Pxxl runtime mounts the app dir read-only, so download/unzip into a
// writable dir when __dirname is not writable (build time it is writable).
function isWritable(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch (e) { return false; }
}
const OUT = isWritable(__dirname) ? __dirname : os.tmpdir();
const zip = path.join(OUT, 'xray.zip');
const bin = path.join(OUT, 'web-worker');
function get(u, file) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(file);
    https.get(u, { headers: { 'User-Agent': 'setup' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        f.close(); try { fs.unlinkSync(file); } catch (e) {}
        return get(res.headers.location, file).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      res.pipe(f); f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}
(async () => {
  if (!fs.existsSync(bin) || !fs.existsSync(path.join(OUT, 'geoip.dat'))) {
    await get(url, zip);
    execSync('unzip -o -q xray.zip && mv -f xray web-worker && chmod +x web-worker && rm -f xray.zip LICENSE README.md', { cwd: OUT, stdio: 'inherit' });
  }
  for (const f of ['geoip.dat', 'geosite.dat']) {
    if (!fs.existsSync(path.join(OUT, f))) throw new Error('missing ' + f);
  }
  console.log('setup ok', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
