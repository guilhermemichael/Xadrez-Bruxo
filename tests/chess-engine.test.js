import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';

const hasMove = (game, from, to, promotion) => game.moves({ verbose: true }).some((move) =>
  move.from === from && move.to === to && (!promotion || move.promotion === promotion)
);

test('movimentos comuns e roque respeitam as regras', () => {
  const game = new Chess();
  assert.equal(hasMove(game, 'e2', 'e4'), true);
  assert.equal(hasMove(game, 'e2', 'e5'), false);

  const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(castle.move('O-O').san, 'O-O');

  const blocked = new Chess('r3k2r/8/8/8/8/8/8/R3KN1R w KQkq - 0 1');
  assert.equal(hasMove(blocked, 'e1', 'g1'), false);
});

test('en passant existe apenas no lance imediatamente posterior', () => {
  const game = new Chess();
  for (const move of ['e4', 'a6', 'e5', 'd5']) assert.ok(game.move(move));
  assert.equal(game.move('exd6').san, 'exd6');
  assert.equal(game.get('d5'), null);

  const expired = new Chess();
  for (const move of ['e4', 'a6', 'e5', 'd5', 'Nf3', 'h6']) assert.ok(expired.move(move));
  assert.equal(hasMove(expired, 'e5', 'd6'), false);
});

test('as quatro promoções são aceitas pelo motor', () => {
  for (const promotion of ['q', 'r', 'b', 'n']) {
    const game = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const move = game.move({ from: 'a7', to: 'a8', promotion });
    assert.equal(move.promotion, promotion);
    assert.equal(game.get('a8').type, promotion);
  }
});

test('xeque-mate, afogamento e material insuficiente são identificados', () => {
  assert.equal(new Chess('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1').in_checkmate(), true);
  assert.equal(new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1').in_stalemate(), true);
  assert.equal(new Chess('8/8/8/8/8/8/2N5/4K2k w - - 0 1').insufficient_material(), true);
});

test('histórico pode ser reconstruído e mantém os lances futuros', () => {
  const source = new Chess();
  for (const move of ['e4', 'e5', 'Nf3', 'Nc6']) assert.ok(source.move(move));
  const allMoves = source.history({ verbose: true });
  const replay = new Chess();
  for (const move of allMoves.slice(0, 2)) replay.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
  const future = allMoves.slice(2).reverse();
  assert.equal(replay.history().join(' '), 'e4 e5');
  assert.deepEqual(future.map((move) => move.san), ['Nc6', 'Nf3']);
});
