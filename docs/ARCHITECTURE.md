# Arquitetura do Xadrez Bruxo

## Objetivo

O projeto usa Vite, JavaScript com módulos ES nativos e dependências versionadas. A migração preserva a experiência Three.js, o motor `chess.js` 0.10.3 e o visual existente, mas remove a dependência de um documento HTML monolítico.

## Entrada e fluxo

- `index.html` contém apenas a estrutura da tela e os pontos de montagem.
- `src/main.js` inicializa os serviços, registra eventos e cria o controlador.
- `src/app/WizardChessApp.js` contém a orquestração da partida e integrações legadas ainda coesas.
- `src/chess/` concentra o parser de comandos e a integração futura de estado/histórico.
- `src/ai/` concentra o Guardião e será o ponto de entrada para Stockfish.
- `src/scene/` concentra a cena, tabuleiro e esculturas 3D.
- `src/ui/` contém o dispatcher de ações DOM e a camada de HUD.
- `src/services/` contém persistência e relógio.
- `src/styles/` contém tokens, estilos próprios e as diretivas Tailwind.

Durante esta primeira migração, as classes que ainda têm forte acoplamento ao ciclo da partida permanecem em um módulo de aplicação único. A separação é incremental: limites de domínio são extraídos sem duplicar estado ou criar módulos artificiais.

## Dependências

As versões de Three.js, OrbitControls e chess.js permanecem compatíveis com as APIs existentes. Lucide e Tailwind deixam de ser carregados por CDN e passam a ser resolvidos pelo npm/Vite.

## Comandos

```text
npm install
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

## Riscos conhecidos

- A cena 3D e o controlador ainda compartilham algumas estruturas internas durante a migração.
- Recursos binários ainda não foram adicionados a `public/assets`; a cena atual gera as esculturas por código.
- Testes visuais de WebGL continuam sendo uma etapa de integração do navegador.
