import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(scriptDirectory, '..');
const repositoryDirectory = resolve(webDirectory, '..', '..');
const publicDirectory = resolve(webDirectory, 'public');

await mkdir(publicDirectory, { recursive: true });
await copyFile(
  resolve(repositoryDirectory, 'hotel-pms-landing.html'),
  resolve(publicDirectory, 'hotel-pms-landing.html'),
);
