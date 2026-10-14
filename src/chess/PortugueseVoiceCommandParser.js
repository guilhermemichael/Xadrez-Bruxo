class PortugueseVoiceCommandParser {
      static parse(rawText, chessInstance) {
        if (!rawText || !rawText.trim()) {
          return { status: 'error', message: 'Nenhum comando foi reconhecido.' };
        }

        const clean = rawText
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const legalMoves = chessInstance.moves({ verbose: true });

        // 1. Verificar Roque
        if (clean.includes('roque') || clean.includes('rock')) {
          const isQueenside = clean.includes('maior') || clean.includes('grande') || clean.includes('dama') || clean.includes('rainha') || clean.includes('largo');
          const castleMove = legalMoves.find(m =>
            isQueenside ? m.san === 'O-O-O' : m.san === 'O-O'
          ) || legalMoves.find(m => m.san.startsWith('O-O'));

          if (castleMove) {
            return { status: 'ok', move: castleMove };
          }
          return { status: 'error', message: 'O roque não é legal na posição atual.' };
        }

        // 2. Normalizar números e colunas falados por extenso em português
        let normalized = clean
          .replace(/\b(um|uma|primeiro|primeira)\b/g, '1')
          .replace(/\b(dois|duas|segundo|segunda)\b/g, '2')
          .replace(/\b(tres|terceiro|terceira)\b/g, '3')
          .replace(/\b(quatro|quarto|quarta)\b/g, '4')
          .replace(/\b(cinco|quinto|quinta)\b/g, '5')
          .replace(/\b(seis|meia|sexto|sexta)\b/g, '6')
          .replace(/\b(sete|setimo|setima)\b/g, '7')
          .replace(/\b(oito|oitavo|oitava)\b/g, '8')
          .replace(/\b(be|bê)\s*([1-8])\b/g, 'b$2')
          .replace(/\b(ce|cê|se)\s*([1-8])\b/g, 'c$2')
          .replace(/\b(de|dê)\s*([1-8])\b/g, 'd$2')
          .replace(/\b(e|eh|ê)\s*([1-8])\b/g, 'e$2')
          .replace(/\b(efe|fe)\s*([1-8])\b/g, 'f$2')
          .replace(/\b(ge|gê|je)\s*([1-8])\b/g, 'g$2')
          .replace(/\b(aga|ha)\s*([1-8])\b/g, 'h$2')
          .replace(/\b([a-h])\s+([1-8])\b/g, '$1$2');

        // 3. Identificar tipo de peça mencionado
        const pieceMap = [
          { keys: ['peao', 'peoes', 'soldado', 'sentinela'], type: 'p', label: 'Peão' },
          { keys: ['cavalo', 'cavaleiro', 'corcel'], type: 'n', label: 'Cavalo' },
          { keys: ['bispo', 'clero', 'inquisidor'], type: 'b', label: 'Bispo' },
          { keys: ['torre', 'castelo', 'fortaleza'], type: 'r', label: 'Torre' },
          { keys: ['rainha', 'dama', 'soberana'], type: 'q', label: 'Rainha' },
          { keys: ['rei', 'monarca'], type: 'k', label: 'Rei' }
        ];

        let requestedType = null;
        let requestedLabel = 'Peça';
        for (const entry of pieceMap) {
          if (entry.keys.some(k => normalized.includes(k))) {
            requestedType = entry.type;
            requestedLabel = entry.label;
            break;
          }
        }

        // Identificar promoção falada (ex: "Peão para A8 promove para Rainha")
        let spokenPromotion = null;
        if (normalized.includes('promov') || normalized.includes('vira')) {
          if (normalized.includes('cavalo')) spokenPromotion = 'n';
          else if (normalized.includes('torre')) spokenPromotion = 'r';
          else if (normalized.includes('bispo')) spokenPromotion = 'b';
          else spokenPromotion = 'q';
        }

        // 4. Extrair casas algébricas (ex: ["g1", "f3"] ou ["e4"])
        const squareMatches = normalized.match(/[a-h][1-8]/g) || [];

        if (squareMatches.length === 0) {
          return {
            status: 'error',
            message: 'Não identifiquei a casa de destino (ex: "Peão para E4" ou "Cavalo para F3").'
          };
        }

        if (squareMatches.length >= 2) {
          const fromSq = squareMatches[0];
          const toSq = squareMatches[squareMatches.length - 1];
          const exactMatches = legalMoves.filter(m =>
            m.from === fromSq &&
            m.to === toSq &&
            (!requestedType || m.piece === requestedType)
          );

          if (exactMatches.length > 0) {
            const chosen = exactMatches.find(m => !spokenPromotion || m.promotion === spokenPromotion) || exactMatches[0];
            return { status: 'ok', move: chosen };
          }
          return {
            status: 'error',
            message: `Movimento ilegal de ${fromSq.toUpperCase()} para ${toSq.toUpperCase()}.`
          };
        }

        const targetSq = squareMatches[0];
        let candidates = legalMoves.filter(m => m.to === targetSq);

        if (requestedType) {
          candidates = candidates.filter(m => m.piece === requestedType);
        }

        if (spokenPromotion) {
          const promoFiltered = candidates.filter(m => m.promotion === spokenPromotion);
          if (promoFiltered.length > 0) candidates = promoFiltered;
        } else if (candidates.length > 1 && candidates.every(m => m.from === candidates[0].from && m.promotion)) {
          // Mesmo peão promovendo na casa alvo sem peça de promoção especificada -> padrão Rainha
          const queenPromo = candidates.find(m => m.promotion === 'q');
          if (queenPromo) candidates = [queenPromo];
        }

        const disambigMatch = normalized.match(/\bde\s+([a-h1-8])\b/);
        if (disambigMatch && candidates.length > 1) {
          const hint = disambigMatch[1];
          const filtered = candidates.filter(m => m.from.includes(hint));
          if (filtered.length > 0) candidates = filtered;
        }

        if (candidates.length === 1) {
          return { status: 'ok', move: candidates[0] };
        }

        if (candidates.length > 1) {
          return {
            status: 'ambiguous',
            candidates,
            targetSquare: targetSq.toUpperCase(),
            message: `Mais de uma peça (${requestedLabel}) pode avançar para ${targetSq.toUpperCase()}. Escolha a origem:`
          };
        }

        return {
          status: 'error',
          message: `Nenhuma jogada legal leva ${requestedType ? requestedLabel : 'uma peça'} até ${targetSq.toUpperCase()}.`
        };
      }
    }

    /**
     * ============================================================================
     * MÓDULO 4: CONSTRUTOR DE ESCULTURAS 3D MEDIEVAIS (PEÇAS E TEXTURAS PBR)
     * Esculpe cada arquétipo usando LatheGeometry (perfis torneados clássicos),
     * ExtrudeGeometry (cabeça equina anatômica para o Cavalo) e ornamentos em
     * bronze envelhecido, além de mapas de textura procedurais para Marfim e Obsidiana.
     * ============================================================================
     */

export { PortugueseVoiceCommandParser };
