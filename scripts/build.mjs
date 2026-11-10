import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'dist'), { recursive: true, force: true });
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const r = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (r.status !== 0) process.exit(r.status ?? 1);
mkdirSync(join(root, 'dist'), { recursive: true });
copyFileSync(join(root, 'src', 'chart.css'), join(root, 'dist', 'chart.css'));
console.log('build ok');
