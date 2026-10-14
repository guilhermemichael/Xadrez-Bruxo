import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('a entrada usa módulos e não depende dos CDNs legados', () => {
  const index = fs.readFileSync('index.html', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  assert.match(index, /src="\/src\/main\.js"/);
  assert.doesNotMatch(index, /cdn\.tailwindcss|cdnjs\.cloudflare|unpkg\.com/);
  assert.match(main, /WizardChessApp/);
  assert.match(main, /installActionDispatcher/);
});

test('as correções de estabilidade estão presentes no módulo da aplicação', () => {
  const app = fs.readFileSync('src/app/WizardChessApp.js', 'utf8');
  assert.match(app, /playedHistory\.forEach/);
  assert.match(app, /const importedGame = new Chess\(\)/);
  assert.match(app, /const importedPosition = new Chess\(\)/);
  assert.match(app, /const recoveredGame = new Chess\(\)/);
  assert.match(app, /this\.clockRemaining\[moveResult\.color\] \+= this\.clockIncrement/);
  assert.doesNotMatch(app, /this\.isAnimating \|\| this\.chess\.game_over\(\)/);
});
