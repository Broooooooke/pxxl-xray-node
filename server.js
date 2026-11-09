const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const crypto = require('crypto');
const PORT = process.env.PORT || 8080;
const UUID = process.env.UUID || '';
const WSPATH = process.env.WSPATH || '/ws';
const FALLBACK = process.env.PATH_REGEX || '.*';
// Pxxl runs `node server.js` (not `npm start`) and mounts the app dir
// read-only at runtime, so the Xray binary is fetched at build time
// (postinstall) and the generated config must live in a writable dir.
const CONFIG = path.join(os.tmpdir(), 'config.json');
function findXray() {
  for (const p of [path.join(__dirname, 'web-worker'), path.join(os.tmpdir(), 'web-worker')]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
let XRAY = findXray();
if (!XRAY) {
  // Build-time download was skipped or the binary was not packaged:
  // setup.js downloads to the tmp dir when the app dir is read-only.
  execFileSync('node', [path.join(__dirname, 'setup.js')], { stdio: 'inherit' });
  XRAY = findXray();
}
if (!XRAY) throw new Error('xray binary not found');
function isUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function genUUID() {
  return crypto.randomUUID();
}
const uuid = isUUID(UUID) ? UUID : genUUID();
if (!isUUID(UUID)) console.warn('UUID env invalid/missing, generated random UUID:', uuid);
const wsPath = WSPATH.startsWith('/') ? WSPATH : '/' + WSPATH;
const config = {
  log: { loglevel: 'warning' },
  inbounds: [
    {
      port: parseInt(PORT, 10),
      listen: '0.0.0.0',
      protocol: 'vless',
      settings: { clients: [{ id: uuid, level: 0 }], decryption: 'none' },
      streamSettings: { network: 'ws', wsSettings: { path: wsPath } }
    },
    {
      port: parseInt(PORT, 10) + 1,
      listen: '127.0.0.1',
      protocol: 'vmess',
      settings: { clients: [{ id: uuid, alterId: 0 }] },
      streamSettings: { network: 'ws', wsSettings: { path: wsPath + '-vmess' } }
    }
  ],
  outbounds: [{ protocol: 'freedom', tag: 'direct' }]
};
fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2));
console.log('wspath:', wsPath, 'vmess path:', wsPath + '-vmess');
console.log('uuid:', uuid);
const child = spawn(XRAY, ['-c', CONFIG], { stdio: 'inherit' });
child.on('exit', (c) => process.exit(c ?? 1));
process.on('SIGTERM', () => child.kill('SIGTERM'));
