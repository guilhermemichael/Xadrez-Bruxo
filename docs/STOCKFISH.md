# Integração do Stockfish

## Variante e origem

O projeto utiliza o pacote npm `stockfish` na versão fixa `19.0.1`, distribuição Stockfish.js mantida por Nathan Rugg para o uso do Stockfish no navegador. A variante escolhida é `stockfish-19-lite-single`, com JavaScript e WASM separados.

- JavaScript: aproximadamente 28 KB
- WASM: aproximadamente 1,8 MB
- Threads: uma
- Isolamento entre origens: não exigido
- Licença do engine: GPL-3.0
- Fonte: https://github.com/nmrugg/stockfish.js/

O aviso GPL do pacote está em `node_modules/stockfish/Copying.txt` durante a instalação. A distribuição do projeto deve manter esta referência e revisar as obrigações de redistribuição do GPL-3.0 antes de publicar uma versão distribuída do aplicativo.

## Disponibilização dos assets

`npm run prepare:stockfish` copia os dois arquivos da distribuição npm para `public/assets/stockfish`. O comando `npm run build` executa essa etapa antes do Vite. O Worker usa `import.meta.env.BASE_URL`, portanto a mesma implementação funciona em domínio raiz e em subcaminho.

Os assets não são importados pelo bundle principal. O Worker e o WASM só são carregados quando a primeira resposta da IA é necessária.

## Configuração de dificuldade

Durante o handshake UCI, o módulo lê as opções anunciadas pelo próprio engine. As opções só são enviadas se foram anunciadas:

| Nível | Skill Level | UCI_Elo | Tempo máximo aproximado |
| --- | ---: | ---: | ---: |
| Inicial | 0 | 1350 | 180 ms |
| Intermediário | 8 | 1800 | 650 ms |
| Avançado | 20 | 2400 | 1800 ms |

`UCI_LimitStrength` é ligado apenas nos níveis abaixo do avançado quando a opção existe. A profundidade não é forçada: o limite de tempo permite que a mesma integração se adapte à velocidade do dispositivo.

## Ciclo de vida e fallback

`StockfishEngine` mantém um único Worker por instância, aguarda `uciok` e `readyok`, controla uma única pesquisa, aplica timeout, cancela respostas antigas e encerra o Worker com `quit`/`terminate`.

O resultado UCI é convertido e validado por uma instância temporária de `chess.js` antes de chegar ao objeto oficial da partida. Se a inicialização, o WASM ou a pesquisa falhar, o Guardião legado é usado em profundidade limitada, sem duplicar o estado da partida.

`sessionToken` e a comparação do FEN atual impedem a aplicação de respostas depois de reiniciar, desfazer, refazer, importar, navegar pelo histórico ou encerrar a partida.

## Atualização

Para atualizar a engine, altere a versão fixa em `package.json`, execute `npm install`, confirme os nomes dos arquivos `lite-single` na distribuição, execute `npm run prepare:stockfish` e rode `npm test`, `npm run lint` e `npm run build`. A alteração exige nova revisão da licença e uma validação real no navegador.
