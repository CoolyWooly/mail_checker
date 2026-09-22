// Собирает dist/extension-store.zip для Chrome Web Store.
// Отличие от `npm run pack` — в манифесте нет поля `key`: в магазине ID назначает сам
// магазин, а закреплённый ключом ID принадлежит версии из GitHub Releases.
// manifest.json в репозитории не меняется — поле вырезается только в копии для архива.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STAGE = fileURLToPath(new URL('../dist/store/', import.meta.url));
const ZIP = fileURLToPath(new URL('../dist/extension-store.zip', import.meta.url));

rmSync(STAGE, { recursive: true, force: true });
rmSync(ZIP, { force: true });
mkdirSync(STAGE, { recursive: true });

const { key, ...manifest } = JSON.parse(readFileSync(`${ROOT}manifest.json`, 'utf8'));
if (!key) console.warn('В manifest.json нет поля key — вырезать нечего');
writeFileSync(`${STAGE}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

// Манифест берём из промежуточной папки, остальное — из корня, как в `npm run pack`.
execFileSync('zip', ['-q', ZIP, 'manifest.json'], { cwd: STAGE });
execFileSync('zip', ['-qr', ZIP, 'src', 'icons', '-x', '*.DS_Store', '-x', '__MACOSX/*'], { cwd: ROOT });
rmSync(STAGE, { recursive: true, force: true });

console.log(`dist/extension-store.zip — ${manifest.name} ${manifest.version}`);
