import { Chess } from 'chess.js';

class GuardianAI {
      constructor() {
        this.pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
        this.pst = {
          p: [
            [0,  0,  0,  0,  0,  0,  0,  0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5,  5, 10, 25, 25, 10,  5,  5],
            [0,  0,  0, 20, 20,  0,  0,  0],
            [5, -5,-10,  0,  0,-10, -5,  5],
            [5, 10, 10,-20,-20, 10, 10,  5],
            [0,  0,  0,  0,  0,  0,  0,  0]
          ],
          n: [
            [-50,-40,-30,-30,-30,-30,-40,-50],
            [-40,-20,  0,  0,  0,  0,-20,-40],
            [-30,  0, 10, 15, 15, 10,  0,-30],
            [-30,  5, 15, 20, 20, 15,  5,-30],
            [-30,  0, 15, 20, 20, 15,  0,-30],
            [-30,  5, 10, 15, 15, 10,  5,-30],
            [-40,-20,  0,  5,  5,  0,-20,-40],
            [-50,-40,-30,-30,-30,-30,-40,-50]
          ],
          b: [
            [-20,-10,-10,-10,-10,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5, 10, 10,  5,  0,-10],
            [-10,  5,  5, 10, 10,  5,  5,-10],
            [-10,  0, 10, 10, 10, 10,  0,-10],
            [-10, 10, 10, 10, 10, 10, 10,-10],
            [-10,  5,  0,  0,  0,  0,  5,-10],
            [-20,-10,-10,-10,-10,-10,-10,-20]
          ],
          r: [
            [0,  0,  0,  0,  0,  0,  0,  0],
            [5, 10, 10, 10, 10, 10, 10,  5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [0,  0,  0,  5,  5,  0,  0,  0]
          ],
          q: [
            [-20,-10,-10, -5, -5,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5,  5,  5,  5,  0,-10],
            [-5,  0,  5,  5,  5,  5,  0, -5],
            [0,  0,  5,  5,  5,  5,  0, -5],
            [-10,  5,  5,  5,  5,  5,  0,-10],
            [-10,  0,  5,  0,  0,  0,  0,-10],
            [-20,-10,-10, -5, -5,-10,-10,-20]
          ],
          k: [
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-20,-30,-30,-40,-40,-30,-30,-20],
            [-10,-20,-20,-20,-20,-20,-20,-10],
            [20, 20,  0,  0,  0,  0, 20, 20],
            [20, 30, 10,  0,  0, 10, 30, 20]
          ]
        };
      }

      evaluateBoard(chessInstance) {
        if (chessInstance.in_checkmate()) {
          return chessInstance.turn() === 'w' ? -99999 : 99999;
        }
        if (chessInstance.in_draw() || chessInstance.in_stalemate() || chessInstance.in_threefold_repetition()) {
          return 0;
        }

        const board = chessInstance.board();
        let score = 0;

        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            const base = this.pieceValues[piece.type] || 0;
            const table = this.pst[piece.type];
            const pstRow = piece.color === 'w' ? r : 7 - r;
            const positional = table ? table[pstRow][c] : 0;

            if (piece.color === 'w') {
              score += base + positional;
            } else {
              score -= base + positional;
            }
          }
        }
        return score;
      }

      chooseBestMove(fen, level = 2) {
        const sim = new Chess(fen);
        const legalMoves = sim.moves({ verbose: true });
        if (legalMoves.length === 0) return null;

        if (level === 1) {
          const captures = legalMoves.filter(m => m.captured);
          if (captures.length > 0 && Math.random() < 0.65) {
            return captures[Math.floor(Math.random() * captures.length)];
          }
          return legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }

        const depth = level === 2 ? 2 : 3;
        const isMaximizing = sim.turn() === 'w';

        legalMoves.sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));

        let bestMove = legalMoves[0];
        let bestValue = isMaximizing ? -Infinity : Infinity;

        for (const move of legalMoves) {
          sim.move(move);
          const value = this.minimax(sim, depth - 1, -Infinity, Infinity, !isMaximizing);
          sim.undo();

          const jitter = (Math.random() - 0.5) * 6;
          const finalVal = value + jitter;

          if (isMaximizing) {
            if (finalVal > bestValue) {
              bestValue = finalVal;
              bestMove = move;
            }
          } else {
            if (finalVal < bestValue) {
              bestValue = finalVal;
              bestMove = move;
            }
          }
        }

        return bestMove;
      }

      minimax(sim, depth, alpha, beta, isMaximizing) {
        if (depth === 0 || sim.game_over()) {
          return this.evaluateBoard(sim);
        }

        const moves = sim.moves({ verbose: true });
        moves.sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));

        if (isMaximizing) {
          let maxEval = -Infinity;
          for (const m of moves) {
            sim.move(m);
            const ev = this.minimax(sim, depth - 1, alpha, beta, false);
            sim.undo();
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
          }
          return maxEval;
        } else {
          let minEval = Infinity;
          for (const m of moves) {
            sim.move(m);
            const ev = this.minimax(sim, depth - 1, alpha, beta, true);
            sim.undo();
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
          }
          return minEval;
        }
      }
    }

    /**
     * ============================================================================
     * MÓDULO 3: INTERPRETADOR DE COMANDOS DE VOZ EM PORTUGUÊS (PT-BR)
     * Traduz linguagem natural ("Cavalo de G1 para F3", "Bispo captura C4", "Roque")
     * em movimentos validados contra o estado oficial do chess.js.
     * ============================================================================
     */

export { GuardianAI };
