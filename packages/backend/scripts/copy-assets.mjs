import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');

mkdirSync(resolve(packageRoot, 'dist'), { recursive: true });
cpSync(resolve(packageRoot, 'src/locales'), resolve(packageRoot, 'dist/locales'), {
	recursive: true,
});
