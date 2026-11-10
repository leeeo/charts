import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'dist'), { recursive: true, force: true });
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const r = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (r.status !== 0) process.exit(r.status ?? 1);
mkdirSync(join(root, 'dist'), { recursive: true });
// One stylesheet: the core rules, then each chart type's own rules (src/charts/<type>.css) in name order.
const charts = join(root, 'src', 'charts');
const parts = [readFileSync(join(root, 'src', 'chart.css'), 'utf8')];
for (const f of readdirSync(charts).filter((f) => f.endsWith('.css')).sort()) parts.push(`/* ${f} */\n` + readFileSync(join(charts, f), 'utf8'));
writeFileSync(join(root, 'dist', 'chart.css'), parts.join('\n'));
console.log('build ok');
