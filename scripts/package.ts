// Generic versioned packager. Builds target, zips to submission/{target}-build-v{version}.zip.
// Usage:
//   npx tsx scripts/package.ts <target> [version]
//   defaults version = package.json version
import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, rmSync, readFileSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const VALID_TARGETS = ['itch', 'poki', 'crazygames', 'gamedistribution', 'playgama', 'discord'] as const;
type Target = (typeof VALID_TARGETS)[number];

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function readPkgVersion(): string {
  const pkgPath = resolve(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
  if (!pkg.version) {
    console.error('[package] package.json missing version');
    process.exit(1);
  }
  return pkg.version;
}

function parseArgs(): { target: Target; version: string } {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: npx tsx scripts/package.ts <target> [version]');
    console.error(`  target: ${VALID_TARGETS.join(' | ')}`);
    process.exit(1);
  }
  const target = args[0] as Target;
  if (!VALID_TARGETS.includes(target)) {
    console.error(`[package] invalid target '${target}'. Valid: ${VALID_TARGETS.join(', ')}`);
    process.exit(1);
  }
  let version = args[1] ?? readPkgVersion();
  if (!SEMVER_RE.test(version)) {
    console.error(`[package] invalid version '${version}' — expected SemVer x.y.z`);
    process.exit(1);
  }
  return { target, version };
}

function run(cmd: string): void {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

const { target, version } = parseArgs();
const distDir = resolve(root, 'dist');
const submissionDir = resolve(root, 'submission');
mkdirSync(submissionDir, { recursive: true });

console.log(`[package] target=${target} version=${version}`);

run(`npx webpack --config webpack.config.js --mode production --env target=${target}`);

if (!existsSync(distDir)) {
  console.error('[package] dist/ missing after build');
  process.exit(1);
}

// itch needs TemplateData copied alongside dist contents (browser host).
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
  console.error(`[package] ${zipName} already exists — bump version or delete the existing zip`);
  process.exit(1);
}

run(`cd "${distDir}" && zip -qr "${zipPath}" .`);

const bytes = statSync(zipPath).size;
const mb = (bytes / (1024 * 1024)).toFixed(2);
if (bytes > MAX_ZIP_BYTES) {
  console.error(`[package] ${zipName} ${mb} MB EXCEEDS 20 MB limit`);
  rmSync(zipPath);
  process.exit(1);
}
console.log(`[package] wrote ${zipName} (${mb} MB)`);
