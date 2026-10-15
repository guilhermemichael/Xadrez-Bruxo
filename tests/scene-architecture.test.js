import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ArcaneChessboard implementa tabuleiro físico chanfrado, base escalonada e coordenadas integradas', () => {
  const boardSource = fs.readFileSync('src/scene/ArcaneChessboard.js', 'utf8');

  // 1. Geometria chanfrada com ExtrudeGeometry
  assert.match(boardSource, /ExtrudeGeometry/);
  assert.match(boardSource, /bevelEnabled:\s*true/);
  assert.match(boardSource, /0\.08/);

  // 2. Base em múltiplos degraus e acabamento em bronze
  assert.match(boardSource, /plinth/i);
  assert.match(boardSource, /cornice/i);
  assert.match(boardSource, /cornerCoords/);
  assert.match(boardSource, /groutBed/);

  // 3. Mapeamento das 64 casas para raycaster e regras
  assert.match(boardSource, /userData\s*=\s*{\s*square:\s*sqName,\s*isLight\s*}/);
  assert.match(boardSource, /squareMeshes\.set\(sqName,\s*mesh\)/);

  // 4. Coordenadas integradas com tipografia Cinzel e cartelas gravadas
  assert.match(boardSource, /createCoordinateTexture/);
  assert.match(boardSource, /Cinzel/);
});

test('ArcanePieceSculptor possui materiais PBR refinados e anel de assentamento nas casas', () => {
  const sculptorSource = fs.readFileSync('src/scene/ArcanePieceSculptor.js', 'utf8');

  // Texturas procedurais dedicadas para marfim e obsidiana
  assert.match(sculptorSource, /ivoryTileColor/);
  assert.match(sculptorSource, /obsidianTileColor/);
  assert.match(sculptorSource, /stoneTileBump/);

  // Anel de assentamento de contato com a casa (evita flutuação visual)
  assert.match(sculptorSource, /groundRing/);
});

test('WizardChessApp delega a construção do tabuleiro ao ArcaneChessboard e protege geometrias', () => {
  const appSource = fs.readFileSync('src/app/WizardChessApp.js', 'utf8');

  assert.match(appSource, /import\s*{\s*ArcaneChessboard\s*}\s*from\s*'\.\.\/scene\/ArcaneChessboard\.js'/);
  assert.match(appSource, /new ArcaneChessboard\(this\.sculptor\)/);
  assert.match(appSource, /this\.arcaneChessboard\.build/);
  assert.match(appSource, /isCachedBoard/);
});
