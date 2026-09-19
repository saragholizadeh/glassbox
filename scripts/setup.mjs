#!/usr/bin/env node
/**
 * `npm run setup` — create .env if it does not exist yet.
 *
 * A tiny node script rather than `cp`, so this works on Windows too.
 */

import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, '.env.example');
const target = path.join(root, '.env');

if (existsSync(target)) {
  console.log('\n  .env already exists — left it alone.');
} else {
  copyFileSync(example, target);
  console.log('\n  created .env from .env.example');
}

console.log(`
  Next:

    npm run up      start the infrastructure
    npm run check   confirm it is all reachable
    npm run dev     run the three services
`);
