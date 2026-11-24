import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function launch(label, folder) {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: path.join(root, folder),
    stdio: 'inherit',
    shell: true,
  });
  child.on('exit', (code) => {
    if (code) console.error(`${label} stopped (${code}).`);
  });
  return child;
}

console.log('Starting APEX API and the club portal…');
console.log('Portal: http://localhost:5173');

const api = launch('API', 'server');
const web = launch('Portal', 'client');

function shutdown() {
  api.kill();
  web.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
