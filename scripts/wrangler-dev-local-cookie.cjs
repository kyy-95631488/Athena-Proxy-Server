const { spawn } = require('node:child_process');
const { existsSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cookieFile = process.argv[2] || 'e7f85d69-a99b-4c4d-a8c2-69c1622bfc9d.json';
if (path.basename(cookieFile) !== cookieFile || !cookieFile.toLowerCase().endsWith('.json')) {
  console.error('Pass a cookie JSON filename from the repository root.');
  process.exit(1);
}
const cookiePath = path.join(root, cookieFile);
const wranglerConfigPath = path.join(root, 'wrangler.toml');
const tempConfigPath = path.join(root, `.wrangler-local-cookie-${process.pid}.toml`);

if (!existsSync(cookiePath)) {
  console.error('Cookie JSON file was not found.');
  process.exit(1);
}

let cookies;
try {
  cookies = JSON.parse(readFileSync(cookiePath, 'utf8'));
} catch {
  console.error('Cookie JSON file is not valid JSON.');
  process.exit(1);
}
if (!Array.isArray(cookies) || !cookies.every(cookie =>
  cookie && typeof cookie.name === 'string' && typeof cookie.value === 'string'
)) {
  console.error('Cookie JSON must be an array of cookie objects.');
  process.exit(1);
}

const cookieJsonTomlValue = JSON.stringify(Buffer.from(JSON.stringify(cookies)).toString('base64'));
let config = readFileSync(wranglerConfigPath, 'utf8');
const cookieRegex = /^TERABOX_COOKIE_JSON_B64\s*=.*$/m;
const varsHeader = /^\[vars\]\s*$/m.exec(config);
if (cookieRegex.test(config)) {
  config = config.replace(cookieRegex, `TERABOX_COOKIE_JSON_B64 = ${cookieJsonTomlValue}`);
} else if (varsHeader) {
  const insertionPoint = varsHeader.index + varsHeader[0].length;
  config = `${config.slice(0, insertionPoint)}\nTERABOX_COOKIE_JSON_B64 = ${cookieJsonTomlValue}${config.slice(insertionPoint)}`;
} else {
  config += `\n[vars]\nTERABOX_COOKIE_JSON_B64 = ${cookieJsonTomlValue}\n`;
}
writeFileSync(tempConfigPath, config, { mode: 0o600 });

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(executable, [
  'wrangler', 'dev', '--local', '--port', '8788', '--config', tempConfigPath
], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    unlinkSync(tempConfigPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

child.on('error', error => {
  cleanup();
  console.error(`Could not start Wrangler: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  cleanup();
  process.exitCode = code ?? (signal ? 1 : 0);
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
