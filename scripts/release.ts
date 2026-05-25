// Local release orchestrator (CI replacement).
// Validates levels, type-checks, builds 4 platform targets, zips each into submission/.
// Usage:
//   npm run release [-- --targets poki,crazygames,gamedistribution,itch] [--version 0.1.2]
// Default version = package.json version. Each zip → submission/{target}-build-v{version}.zip.
import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, rmSync, readFileSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const TARGETS = ['poki', 'crazygames', 'gamedistribution', 'itch'] as const;
type Target = (typeof TARGETS)[number];

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function run(cmd: string): void {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

function step(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function readPkgVersion(): string {
  const pkgPath = resolve(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
  if (!pkg.version) {
    console.error('[release] package.json missing version');
    process.exit(1);
  }
  return pkg.version;
}

function parseTargets(): Target[] {
  const argIdx = process.argv.indexOf('--targets');
  if (argIdx < 0) return [...TARGETS];
  const list = process.argv[argIdx + 1];
  if (!list) return [...TARGETS];
  const requested = list.split(',').map((s) => s.trim()) as Target[];
  return requested.filter((t) => TARGETS.includes(t));
}

function parseVersion(): string {
  const argIdx = process.argv.indexOf('--version');
  const v = argIdx >= 0 ? process.argv[argIdx + 1] : readPkgVersion();
  if (!SEMVER_RE.test(v)) {
    console.error(`[release] invalid version '${v}' — expected SemVer x.y.z`);
    process.exit(1);
  }
  return v;
}

const selected = parseTargets();
const version = parseVersion();
const submissionDir = resolve(root, 'submission');
mkdirSync(submissionDir, { recursive: true });
console.log(`[release] version=${version} targets=[${selected.join(', ')}]`);

const failures: string[] = [];

step('validate-levels');
try { run('npm run --silent validate-levels'); }
catch { failures.push('validate-levels'); }

step('tsc --noEmit');
try { run('npx tsc --noEmit'); }
catch { failures.push('tsc'); }

if (failures.length > 0) {
  console.error(`\n[release] pre-flight failed: ${failures.join(', ')}`);
  process.exit(1);
}

const results: { target: Target; zipPath: string; bytes: number; ok: boolean }[] = [];

for (const target of selected) {
  step(`build target=${target}`);
  try {
    run(`npx webpack --config webpack.config.js --mode production --env target=${target}`);
  } catch {
    results.push({ target, zipPath: '', bytes: 0, ok: false });
    continue;
  }

  const distDir = resolve(root, 'dist');
  if (!existsSync(distDir)) {
    console.error(`[release] dist/ missing after build ${target}`);
    results.push({ target, zipPath: '', bytes: 0, ok: false });
    continue;
  }

  // itch needs TemplateData copied into dist before zip (browser host)
  if (target === 'itch') {
    const templateData = resolve(root, 'marketing', 'TemplateData');
    if (existsSync(templateData)) {
      const dst = resolve(distDir, 'TemplateData');
      mkdirSync(dst, { recursive: true });
      cpSync(templateData, dst, { recursive: true });
    }
  }

  const zipName = `${target}-build-v${version}.zip`;
  const zipPath = resolve(submissionDir, zipName);
  if (existsSync(zipPath)) {
    console.error(`[release] ${zipName} exists — bump version or delete the existing zip`);
    results.push({ target, zipPath, bytes: 0, ok: false });
    continue;
  }
  step(`zip ${target}`);
  try {
    run(`cd "${distDir}" && zip -qr "${zipPath}" .`);
  } catch {
    results.push({ target, zipPath, bytes: 0, ok: false });
    continue;
  }

  const bytes = statSync(zipPath).size;
  const ok = bytes <= MAX_ZIP_BYTES;
  results.push({ target, zipPath, bytes, ok });
  if (!ok) {
    console.error(`[release] ${target} zip ${bytes} bytes EXCEEDS ${MAX_ZIP_BYTES}`);
  }
}

step('summary');
for (const r of results) {
  const mb = (r.bytes / (1024 * 1024)).toFixed(2);
  const flag = r.ok ? 'OK' : 'FAIL';
  console.log(`  [${flag}] ${r.target.padEnd(18)} ${mb} MB  ${r.zipPath}`);
}

const anyFail = results.some((r) => !r.ok);
if (anyFail) {
  console.error('\n[release] one or more targets failed');
  process.exit(1);
}
console.log('\n[release] all targets OK');
