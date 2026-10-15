import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(root, 'node_modules/stockfish/bin');
const targetDir = resolve(root, 'public/assets/stockfish');
const files = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];

await mkdir(targetDir, { recursive: true });
for (const file of files) {
  await copyFile(resolve(sourceDir, file), resolve(targetDir, file));
}
console.log(`Stockfish ${files.join(' + ')} disponibilizado em public/assets/stockfish.`);
