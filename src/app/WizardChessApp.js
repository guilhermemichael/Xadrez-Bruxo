import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Chess } from 'chess.js';
import { ArcaneAudioEngine } from '../services/ArcaneAudioEngine.js';
import { GuardianAI } from '../ai/GuardianAI.js';
import { PortugueseVoiceCommandParser } from '../chess/PortugueseVoiceCommandParser.js';
import { ArcanePieceSculptor } from '../scene/ArcanePieceSculptor.js';
import { ArcaneChessboard } from '../scene/ArcaneChessboard.js';

class WizardChessApp {
      constructor() {
        this.chess = new Chess();
        this.audio = new ArcaneAudioEngine();
        this.ai = new GuardianAI();
        this.sculptor = new ArcanePieceSculptor();

        // Configurações da Partida
        this.gameMode = 'ai';
        this.playerColor = 'w'; // Cor controlada pelo jogador quando enfrenta a IA
        this.startingColor = 'w';
        this.gameStarted = false;
        this.aiDifficulty = 2;
        this.animMode = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'fast' : 'cinema'; // 'cinema' | 'fast' | 'instant'
        this.graphicsQuality = 'high';
        this.captureCameraFocus = true;
        this.redoStack = [];
        this.preferencesKey = 'xadrez-bruxo-preferences-v2';
        this.savedGameKey = 'xadrez-bruxo-saved-game-v2';
        this.clockControl = '600+0';
        this.clockRemaining = { w: 600, b: 600 };
        this.clockIncrement = 0;
        this.clockSide = 'w';
        this.clockExpired = false;
        this.gameConcluded = false;
        this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Estado de Interação e Histórico Visual
        this.selectedSquare = null;
        this.legalTargets = [];
        this.lastMoveSquares = null; // { from, to }
        this.pendingPromotion = null;
        this.isAnimating = false;
        this.aiThinking = false;
        this.sessionToken = 0;

        // Estado dos Painéis Laterais
        this.leftPanelOpen = true;
        this.rightPanelOpen = true;

        // Identidade Persistente das Peças: Map<pieceId, { id, type, color, square, mesh }>
        this.piecesById = new Map();
        this.squareToPieceId = new Map();
        this.nextPieceUid = 1;

        // Sistemas de Animação, Câmera Suave, Destruição e Fogo dos Braseiros
        this.activeAnimations = [];
        this.debrisFragments = [];
        this.shockwaves = [];
        this.emberParticles = [];
        this.cameraShakeTime = 0;
        this.cameraTransition = null; // { startPos, endPos, startTarget, endTarget, elapsed, duration }
        this.checkHaloMesh = null;

        // Inicializar Cena 3D, Salão Monumental, Tabuleiro, Peças, Raycaster e Voz
        this.initThreeScene();
        this.restorePreferences();
        this.buildGreatHallEnvironment();
        this.setGraphicsQuality(this.graphicsQuality);
        this.buildChessboard();
        this.syncPersistentPiecesFromScratch();
        this.initInteractionRaycaster();
        this.initVoiceRecognition();
        this.updateHUD();

        // Em telas pequenas, priorizar o tabuleiro e manter os painéis reabríveis.
        if (window.innerWidth < 640) {
          this.toggleLeftPanel(false);
        }
        // Abaixo do breakpoint lg, as Crônicas começam recolhidas, mas com botão para reabrir.
        if (window.innerWidth < 1024) {
          this.toggleRightPanel(false);
        }

        // Loop de Renderização
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
      }

      // Converte casa algébrica ("e4", "a1", "h8") para coordenadas 3D exatas no mundo
      squareToWorld(square) {
        const file = square.charCodeAt(0) - 97;
        const rank = parseInt(square[1], 10) - 1;
        const x = file - 3.5;
        const z = 3.5 - rank;
        return new THREE.Vector3(x, 0.08, z);
      }

      initThreeScene() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x06070b);
        this.scene.fog = new THREE.FogExp2(0x06070b, 0.032);

        this.camera = new THREE.PerspectiveCamera(
          40,
          window.innerWidth / window.innerHeight,
          0.1,
          110
        );
        this.camera.position.set(0, 6.8, 8.0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.18;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
        this.controls.minDistance = 3.8;
        this.controls.maxDistance = 18.0;
        this.controls.target.set(0, 0.25, 0);

        // Cancelar transição automática se o jogador interagir manualmente com a câmera
        this.controls.addEventListener('start', () => {
          this.cameraTransition = null;
        });

        // 1. Luz Hemisférica Atmosférica (Céu Noturno Azulado vs Reflexo Quente do Altar)
        const hemiLight = new THREE.HemisphereLight(0x9cbde8, 0x241d16, 0.62);
        this.scene.add(hemiLight);

        // 2. Luz Direcional Principal (Luar Gótico Frio com Sombras Nítidas e Suaves)
        this.moonLight = new THREE.DirectionalLight(0xd2e3ff, 1.25);
        this.moonLight.position.set(-6.5, 14.0, 6.8);
        this.moonLight.castShadow = true;
        this.moonLight.shadow.mapSize.width = 2048;
        this.moonLight.shadow.mapSize.height = 2048;
        this.moonLight.shadow.camera.near = 2;
        this.moonLight.shadow.camera.far = 30;
        const d = 6.2;
        this.moonLight.shadow.camera.left = -d;
        this.moonLight.shadow.camera.right = d;
        this.moonLight.shadow.camera.top = d;
        this.moonLight.shadow.camera.bottom = -d;
        this.moonLight.shadow.bias = -0.0003;
        this.moonLight.shadow.normalBias = 0.02;
        this.scene.add(this.moonLight);

        // 3. Rim Light Traseiro (Destaque e Contorno de Silhueta para Peças de Obsidiana)
        const rimLight = new THREE.DirectionalLight(0x82aaff, 0.65);
        rimLight.position.set(5.5, 7.5, -9.5);
        this.scene.add(rimLight);

        // 4. Quatro Tochas / Braseiros Quentes nos cantos do altar
        this.torchLights = [];
        this.brazierCoords = [
          [-5.4, 1.35, -5.4],
          [5.4, 1.35, -5.4],
          [-5.4, 1.35, 5.4],
          [5.4, 1.35, 5.4]
        ];
        this.brazierCoords.forEach(([tx, ty, tz]) => {
          const light = new THREE.PointLight(0xff9436, 1.15, 15.0, 1.8);
          light.position.set(tx, ty + 0.55, tz);
          this.scene.add(light);
          this.torchLights.push(light);
        });

        window.addEventListener('resize', () => {
          this.camera.aspect = window.innerWidth / window.innerHeight;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(window.innerWidth, window.innerHeight);
          this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          this.syncRightPanelVisibility();
        });
      }

      // Salão Monumental 3D com Altar Escalonado, Braseiros de Bronze e Colunata Gótica
      buildGreatHallEnvironment() {
        const hallGroup = new THREE.Group();
        const stoneBump = this.sculptor.textures.stoneBump;

        // Piso do Salão de Ardósia com Círculo Rúnico de Bronze Embutido
        const floorMat = new THREE.MeshStandardMaterial({
          color: 0x0b0d12,
          bumpMap: stoneBump,
          bumpScale: 0.02,
          roughness: 0.82,
          metalness: 0.18
        });
        const floor = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 0.5, 64), floorMat);
        floor.position.y = -1.15;
        floor.receiveShadow = true;
        hallGroup.add(floor);

        // Anéis de Bronze no Piso do Salão
        const floorRing1 = new THREE.Mesh(
          new THREE.RingGeometry(6.8, 7.05, 64),
          this.sculptor.materials.darkBronze
        );
        floorRing1.rotation.x = -Math.PI / 2;
        floorRing1.position.y = -0.89;
        hallGroup.add(floorRing1);

        // Altar Monumental em Dois Degraus sob o Tabuleiro
        const altarMat = new THREE.MeshStandardMaterial({
          color: 0x151821,
          bumpMap: stoneBump,
          bumpScale: 0.025,
          roughness: 0.62,
          metalness: 0.25
        });

        const step1 = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.30, 12.4), altarMat);
        step1.position.y = -0.74;
        step1.receiveShadow = true;
        hallGroup.add(step1);

        const step2 = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.28, 11.2), altarMat);
        step2.position.y = -0.48;
        step2.receiveShadow = true;
        hallGroup.add(step2);

        // Braseiros Esculpidos nos 4 Cantos do Altar + Brasas Vivas
        const brazierStandMat = this.sculptor.materials.darkBronze;
        const emberMat = new THREE.MeshBasicMaterial({ color: 0xff7b1c });

        this.brazierCoords.forEach(([bx, by, bz]) => {
          const brazierGroup = new THREE.Group();
          brazierGroup.position.set(bx, -0.14, bz);

          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.15, 12), altarMat);
          pillar.position.y = 0.57;
          pillar.castShadow = true;
          brazierGroup.add(pillar);

          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.20, 0.28, 16), brazierStandMat);
          bowl.position.y = 1.22;
          bowl.castShadow = true;
          brazierGroup.add(bowl);

          const emberCore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), emberMat);
          emberCore.position.y = 1.32;
          emberCore.scale.set(1, 0.55, 1);
          brazierGroup.add(emberCore);

          hallGroup.add(brazierGroup);

          // Criar 4 fagulhas ascendentes por braseiro
          for (let p = 0; p < 4; p++) {
            const spark = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.045, 0),
              new THREE.MeshBasicMaterial({ color: 0xffae42, transparent: true, opacity: 0.85 })
            );
            this.resetEmberParticle(spark, bx, 1.38, bz, Math.random());
            this.scene.add(spark);
            this.emberParticles.push({
              mesh: spark,
              originX: bx,
              originY: 1.38,
              originZ: bz,
              phase: Math.random(),
              speed: 0.45 + Math.random() * 0.4
            });
          }
        });

        // Colunata Gótica Monumental ao redor do Salão
        const pillarMat = new THREE.MeshStandardMaterial({
          color: 0x12151e,
          bumpMap: stoneBump,
          bumpScale: 0.02,
          roughness: 0.72,
          metalness: 0.2
        });

        const numPillars = 12;
        const radius = 14.5;
        for (let i = 0; i < numPillars; i++) {
          const angle = (i / numPillars) * Math.PI * 2;
          const px = Math.cos(angle) * radius;
          const pz = Math.sin(angle) * radius;

          const colGroup = new THREE.Group();
          colGroup.position.set(px, -0.9, pz);
          colGroup.rotation.y = -angle;

          const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.6), pillarMat);
          base.position.y = 0.45;
          colGroup.add(base);

          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 13.5, 12), pillarMat);
          shaft.position.y = 7.4;
          colGroup.add(shaft);

          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.06, 8, 16), brazierStandMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 3.2;
          colGroup.add(ring);

          hallGroup.add(colGroup);
        }

        this.scene.add(hallGroup);
      }

      resetEmberParticle(mesh, ox, oy, oz, progress = 0) {
        mesh.position.set(
          ox + (Math.random() - 0.5) * 0.22,
          oy + progress * 0.95,
          oz + (Math.random() - 0.5) * 0.22
        );
      }

      // Tabuleiro Monumental Esculpido em Pedra, Bronze e Obsidiana (Módulo ArcaneChessboard)
      buildChessboard() {
        this.arcaneChessboard = new ArcaneChessboard(this.sculptor);
        const {
          boardGroup,
          squareMeshes,
          highlightsGroup,
          statusMarkersGroup,
          lightSquareMat,
          darkSquareMat
        } = this.arcaneChessboard.build(this.squareToWorld.bind(this));

        this.boardGroup = boardGroup;
        this.squareMeshes = squareMeshes;
        this.highlightsGroup = highlightsGroup;
        this.statusMarkersGroup = statusMarkersGroup;
        this.lightSquareMat = lightSquareMat;
        this.darkSquareMat = darkSquareMat;

        this.scene.add(this.boardGroup);
      }

      addBoardCoordinates() {
        // Coordenadas integradas e gravadas diretamente na moldura pelo ArcaneChessboard
      }

      /**
       * ==========================================================================
       * SISTEMA DE IDENTIDADE PERSISTENTE DAS PEÇAS E LIMPEZA DE MEMÓRIA
       * ==========================================================================
       */
      disposeObject3D(obj) {
        if (!obj) return;
        obj.traverse(child => {
          if (child.isMesh) {
            // Não descartar geometrias compartilhadas do cache do escultor ou do tabuleiro
            const isCachedSculptor = Object.values(this.sculptor.geometryCache).includes(child.geometry);
            const isCachedBoard = this.arcaneChessboard && this.arcaneChessboard.geometries.includes(child.geometry);
            if (child.geometry && !isCachedSculptor && !isCachedBoard) {
              child.geometry.dispose();
            }
          }
        });
      }

      syncPersistentPiecesFromScratch() {
        for (const piece of this.piecesById.values()) {
          this.scene.remove(piece.mesh);
          this.disposeObject3D(piece.mesh);
        }
        this.piecesById.clear();
        this.squareToPieceId.clear();

        // Limpar fragmentos e ondas de choque remanescentes
        this.debrisFragments.forEach(d => {
          this.scene.remove(d.mesh);
          d.mesh.geometry.dispose();
          d.mesh.material.dispose();
        });
        this.debrisFragments = [];

        this.shockwaves.forEach(w => {
          this.scene.remove(w.mesh);
          w.mesh.geometry.dispose();
          w.mesh.material.dispose();
        });
        this.shockwaves = [];
        this.activeAnimations = [];

        const board = this.chess.board();
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            const square = `${files[c]}${8 - r}`;
            const id = `piece_${this.nextPieceUid++}`;
            const mesh = this.sculptor.createPieceMesh(cell.type, cell.color);
            const worldPos = this.squareToWorld(square);
            mesh.position.copy(worldPos);
            mesh.userData = { pieceId: id };

            this.scene.add(mesh);
            this.piecesById.set(id, {
              id,
              type: cell.type,
              color: cell.color,
              square,
              mesh
            });
            this.squareToPieceId.set(square, id);
          }
        }

        this.renderStatusMarkers();
      }

      // Raycasting para clique nas peças ou casas do tabuleiro
      initInteractionRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        let downPos = { x: 0, y: 0 };

        this.renderer.domElement.addEventListener('pointerdown', (e) => {
          downPos = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('pointerup', (e) => {
          const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
          if (dist > 7) return;
          this.handleBoardClick(e);
        });
      }

      handleBoardClick(event) {
        if (!this.gameStarted || this.gameConcluded || this.isAnimating || this.aiThinking || this.chess.game_over()) return;
        if (this.gameMode === 'ai' && this.chess.turn() !== this.playerColor) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);

        const pieceMeshes = Array.from(this.piecesById.values()).map(p => p.mesh);
        const squareMeshes = Array.from(this.squareMeshes.values());

        const pieceHits = this.raycaster.intersectObjects(pieceMeshes, true);
        let clickedSquare = null;

        if (pieceHits.length > 0) {
          let obj = pieceHits[0].object;
          while (obj && !obj.userData.pieceId) obj = obj.parent;
          if (obj && obj.userData.pieceId) {
            const pData = this.piecesById.get(obj.userData.pieceId);
            if (pData) clickedSquare = pData.square;
          }
        } else {
          const sqHits = this.raycaster.intersectObjects(squareMeshes, false);
          if (sqHits.length > 0) {
            clickedSquare = sqHits[0].object.userData.square;
          }
        }

        if (!clickedSquare) {
          this.clearSelection();
          return;
        }

        // 1. Se clicou em um destino legal da peça já selecionada -> executar lance
        const matchingMove = this.legalTargets.find(m => m.to === clickedSquare);
        if (this.selectedSquare && matchingMove) {
          this.initiateMove(matchingMove.from, matchingMove.to);
          return;
        }

        // 2. Se clicou em uma peça aliada do turno atual -> selecionar
        const pieceOnSquare = this.chess.get(clickedSquare);
        if (pieceOnSquare && pieceOnSquare.color === this.chess.turn()) {
          if (this.selectedSquare === clickedSquare) {
            this.clearSelection();
          } else {
            this.selectSquare(clickedSquare);
          }
          return;
        }

        // 3. Se havia uma peça selecionada e clicou em uma casa ilegal -> dar feedback tático
        if (this.selectedSquare && clickedSquare !== this.selectedSquare) {
          this.triggerIllegalMoveFeedback(clickedSquare);
          return;
        }

        this.clearSelection();
      }

      selectSquare(square) {
        this.selectedSquare = square;
        this.legalTargets = this.chess.moves({ square, verbose: true });
        this.audio.playSelectChime();
        this.renderHighlights();
      }

      clearSelection() {
        this.selectedSquare = null;
        this.legalTargets = [];
        this.renderHighlights();
      }

      triggerIllegalMoveFeedback(targetSquare) {
        this.audio.playIllegalThud();
        document.getElementById('last-move-banner').textContent =
          `Movimento ilegal para ${targetSquare.toUpperCase()}. Escolha uma casa destacada.`;

        // Flash rubro breve na casa inválida clicada
        const pos = this.squareToWorld(targetSquare);
        const errMesh = new THREE.Mesh(
          new THREE.RingGeometry(0.28, 0.44, 24),
          new THREE.MeshBasicMaterial({
            color: 0xdc2626,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
          })
        );
        errMesh.rotation.x = -Math.PI / 2;
        errMesh.position.set(pos.x, 0.095, pos.z);
        this.scene.add(errMesh);
        this.shockwaves.push({ mesh: errMesh, age: 0, maxAge: 0.32, noExpand: true });
      }

      clearGroupChildren(group) {
        while (group.children.length > 0) {
          const child = group.children[0];
          group.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      }

      renderHighlights() {
        this.clearGroupChildren(this.highlightsGroup);
        if (!this.selectedSquare) return;

        // Halo Dourado Duplo sob a Peça Selecionada
        const selPos = this.squareToWorld(this.selectedSquare);
        const selRing = new THREE.Mesh(
          new THREE.RingGeometry(0.36, 0.45, 32),
          new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
          })
        );
        selRing.rotation.x = -Math.PI / 2;
        selRing.position.set(selPos.x, 0.091, selPos.z);
        this.highlightsGroup.add(selRing);

        // Marcadores de Destinos Legais (Runas Azuis para Movimento, Anel Rubro para Captura)
        this.legalTargets.forEach(move => {
          const pos = this.squareToWorld(move.to);
          const isCapture = Boolean(move.captured);

          if (isCapture) {
            const capRing = new THREE.Mesh(
              new THREE.RingGeometry(0.34, 0.46, 28),
              new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.88,
                side: THREE.DoubleSide
              })
            );
            capRing.rotation.x = -Math.PI / 2;
            capRing.position.set(pos.x, 0.091, pos.z);
            this.highlightsGroup.add(capRing);
          } else {
            const dot = new THREE.Mesh(
              new THREE.CircleGeometry(0.14, 24),
              new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide
              })
            );
            dot.rotation.x = -Math.PI / 2;
            dot.position.set(pos.x, 0.091, pos.z);
            this.highlightsGroup.add(dot);

            const outer = new THREE.Mesh(
              new THREE.RingGeometry(0.19, 0.23, 24),
              new THREE.MeshBasicMaterial({
                color: 0x7dd3fc,
                transparent: true,
                opacity: 0.45,
                side: THREE.DoubleSide
              })
            );
            outer.rotation.x = -Math.PI / 2;
            outer.position.set(pos.x, 0.091, pos.z);
            this.highlightsGroup.add(outer);
          }
        });
      }

      // Renderiza indicadores persistentes do Último Lance e Halo de Xeque no Rei ameaçado
      renderStatusMarkers() {
        this.clearGroupChildren(this.statusMarkersGroup);
        this.checkHaloMesh = null;

        // 1. Indicador de Último Movimento (Moldura Âmbar Discreta na Origem e Destino)
        if (this.lastMoveSquares) {
          [this.lastMoveSquares.from, this.lastMoveSquares.to].forEach((sq, idx) => {
            const pos = this.squareToWorld(sq);
            const border = new THREE.Mesh(
              new THREE.RingGeometry(0.41, 0.47, 4),
              new THREE.MeshBasicMaterial({
                color: 0xd97706,
                transparent: true,
                opacity: idx === 1 ? 0.55 : 0.32,
                side: THREE.DoubleSide
              })
            );
            border.rotation.x = -Math.PI / 2;
            border.rotation.z = Math.PI / 4;
            border.position.set(pos.x, 0.089, pos.z);
            this.statusMarkersGroup.add(border);
          });
        }

        // 2. Halo Rubro Pulsante sob o Rei em Xeque
        if (this.chess.in_check()) {
          const turnColor = this.chess.turn();
          for (const piece of this.piecesById.values()) {
            if (piece.type === 'k' && piece.color === turnColor) {
              const kPos = this.squareToWorld(piece.square);
              const checkHalo = new THREE.Mesh(
                new THREE.RingGeometry(0.32, 0.48, 32),
                new THREE.MeshBasicMaterial({
                  color: 0xff2a2a,
                  transparent: true,
                  opacity: 0.9,
                  side: THREE.DoubleSide
                })
              );
              checkHalo.rotation.x = -Math.PI / 2;
              checkHalo.position.set(kPos.x, 0.094, kPos.z);
              this.statusMarkersGroup.add(checkHalo);
              this.checkHaloMesh = checkHalo;
              break;
            }
          }
        }
      }

      /**
       * ==========================================================================
       * EXECUÇÃO DE MOVIMENTOS (INCLUINDO ROQUE, EN PASSANT E PROMOÇÃO)
       * ==========================================================================
       */
      initiateMove(from, to, explicitPromotion = null) {
        if (!this.gameStarted || this.gameConcluded || this.chess.game_over()) return;
        const piece = this.chess.get(from);
        if (!piece) return;

        const isPromotion =
          piece.type === 'p' &&
          ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

        if (isPromotion && !explicitPromotion) {
          const isLegalPromotion = this.chess.moves({ verbose: true }).some(m => m.from === from && m.to === to);
          if (!isLegalPromotion) {
            this.triggerIllegalMoveFeedback(to);
            return;
          }
          this.pendingPromotion = { from, to };
          this.toggleModal('promotion-modal', true);
          return;
        }

        const moveResult = this.chess.move({
          from,
          to,
          promotion: explicitPromotion || 'q'
        });

        if (!moveResult) {
          this.triggerIllegalMoveFeedback(to);
          return;
        }

        // O relógio troca no instante em que o motor aceita o lance. Assim a
        // animação cinematográfica não concede tempo gratuito a cada jogada.
        if (this.clockControl !== 'off' && !this.clockExpired) {
          this.clockRemaining[moveResult.color] += this.clockIncrement;
          this.clockSide = this.chess.turn();
          this.updateClockHUD();
        }
        if (this.chess.game_over()) this.gameConcluded = true;

        this.redoStack = [];
        this.lastMoveSquares = { from: moveResult.from, to: moveResult.to };
        this.clearSelection();
        document.getElementById('ambiguity-box').classList.add('hidden');
        this.performMoveChoreography(moveResult);
      }

      confirmPromotion(pieceType) {
        this.toggleModal('promotion-modal', false);
        if (!this.pendingPromotion) return;
        const { from, to } = this.pendingPromotion;
        this.pendingPromotion = null;
        this.initiateMove(from, to, pieceType);
      }

      cancelPromotion() {
        this.toggleModal('promotion-modal', false);
        this.pendingPromotion = null;
        this.clearSelection();
      }

      /**
       * ==========================================================================
       * COREOGRAFIA DE MOVIMENTAÇÃO E CAPTURA CINEMATOGRÁFICA EM FASES
       * ==========================================================================
       */
      performMoveChoreography(moveResult) {
        const currentToken = this.sessionToken;
        const attackerId = this.squareToPieceId.get(moveResult.from);
        const attacker = this.piecesById.get(attackerId);

        if (!attacker) {
          this.syncPersistentPiecesFromScratch();
          return;
        }

        // Identificar peça capturada (incluindo En Passant)
        let capturedSquare = null;
        if (moveResult.flags.includes('e')) {
          const capturedRank = moveResult.color === 'w' ? '5' : '4';
          capturedSquare = `${moveResult.to[0]}${capturedRank}`;
        } else if (moveResult.captured) {
          capturedSquare = moveResult.to;
        }

        const defenderId = capturedSquare ? this.squareToPieceId.get(capturedSquare) : null;
        const defender = defenderId ? this.piecesById.get(defenderId) : null;

        this.squareToPieceId.delete(moveResult.from);
        if (capturedSquare) this.squareToPieceId.delete(capturedSquare);
        this.squareToPieceId.set(moveResult.to, attackerId);
        attacker.square = moveResult.to;

        // Tratar Roque (mover simultaneamente a Torre correspondente)
        let rookAnimData = null;
        if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
          const rank = moveResult.color === 'w' ? '1' : '8';
          const rookFrom = moveResult.flags.includes('k') ? `h${rank}` : `a${rank}`;
          const rookTo = moveResult.flags.includes('k') ? `f${rank}` : `d${rank}`;
          const rookId = this.squareToPieceId.get(rookFrom);
          const rookPiece = this.piecesById.get(rookId);
          if (rookPiece) {
            this.squareToPieceId.delete(rookFrom);
            this.squareToPieceId.set(rookTo, rookId);
            rookPiece.square = rookTo;
            rookAnimData = {
              piece: rookPiece,
              startPos: rookPiece.mesh.position.clone(),
              endPos: this.squareToWorld(rookTo)
            };
          }
        }

        const startPos = attacker.mesh.position.clone();
        const endPos = this.squareToWorld(moveResult.to);

        const speedMultiplier =
          this.animMode === 'instant' ? 0.04 : this.animMode === 'fast' ? 0.52 : 1.0;

        this.isAnimating = true;
        this.audio.playStoneSlide(0.36 * speedMultiplier);

        if (defender && this.animMode !== 'instant') {
          const duration = 0.88 * speedMultiplier;
          this.activeAnimations.push({
            type: 'capture',
            attacker,
            defender,
            startPos,
            endPos,
            isKnight: attacker.type === 'n',
            elapsed: 0,
            duration,
            shattered: false,
            moveResult,
            currentToken
          });
        } else {
          if (defender) {
            this.shatterPieceIntoDebris(defender, startPos);
          }

          const duration = Math.max(0.05, 0.44 * speedMultiplier);
          this.activeAnimations.push({
            type: 'move',
            attacker,
            rookAnimData,
            startPos,
            endPos,
            isKnight: attacker.type === 'n',
            elapsed: 0,
            duration,
            moveResult,
            currentToken
          });
        }
      }

      // Despedaça a escultura derrotada em múltiplos fragmentos de pedra e bronze com física
      shatterPieceIntoDebris(defender, attackerOriginPos) {
        this.audio.playStoneShatter();
        if (this.graphicsQuality === 'high') {
          this.cameraShakeTime = 0.22;
        }

        const impactOrigin = defender.mesh.position.clone();
        const pushDir = new THREE.Vector3()
          .subVectors(impactOrigin, attackerOriginPos)
          .normalize();

        // Remover e descartar a malha da peça derrotada
        this.scene.remove(defender.mesh);
        this.disposeObject3D(defender.mesh);
        this.piecesById.delete(defender.id);

        const baseStoneMat = this.sculptor.materials[defender.color];
        const bronzeMat = this.sculptor.materials.bronze;
        const fragmentCount = this.graphicsQuality === 'high' ? 24 : 10;

        for (let i = 0; i < fragmentCount; i++) {
          const scale = 0.055 + Math.random() * 0.11;
          const geo = i % 3 === 0
            ? new THREE.DodecahedronGeometry(scale, 0)
            : new THREE.OctahedronGeometry(scale, 0);

          // 20% dos fragmentos são estilhaços de bronze ornamental, 80% são da pedra da peça
          const sourceMat = i % 5 === 0 ? bronzeMat : baseStoneMat;
          const fragMat = sourceMat.clone();
          fragMat.transparent = true;
          fragMat.opacity = 1;

          const fragMesh = new THREE.Mesh(geo, fragMat);
          fragMesh.position.set(
            impactOrigin.x + (Math.random() - 0.5) * 0.28,
            0.18 + Math.random() * 0.85,
            impactOrigin.z + (Math.random() - 0.5) * 0.28
          );
          fragMesh.scale.set(
            0.7 + Math.random() * 0.6,
            0.5 + Math.random() * 0.8,
            0.7 + Math.random() * 0.6
          );
          fragMesh.castShadow = this.graphicsQuality === 'high';
          this.scene.add(fragMesh);

          const velocity = new THREE.Vector3(
            pushDir.x * (1.4 + Math.random() * 2.1) + (Math.random() - 0.5) * 2.5,
            1.7 + Math.random() * 3.1,
            pushDir.z * (1.4 + Math.random() * 2.1) + (Math.random() - 0.5) * 2.5
          );

          const rotVel = new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
          );

          this.debrisFragments.push({
            mesh: fragMesh,
            velocity,
            rotVel,
            age: 0,
            maxAge: 1.55 + Math.random() * 0.45
          });
        }

        // Onda de impacto mágica em bronze no ponto da destruição
        const ringGeo = new THREE.RingGeometry(0.1, 0.22, 28);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(impactOrigin.x, 0.095, impactOrigin.z);
        this.scene.add(ringMesh);
        this.shockwaves.push({ mesh: ringMesh, age: 0, maxAge: 0.45 });
      }

      onMoveAnimationComplete(attacker, moveResult, token) {
        if (token !== this.sessionToken) return;

        // Se houve promoção de peão, esculpir a nova peça mantendo o ID persistente
        if (moveResult.promotion) {
          this.scene.remove(attacker.mesh);
          this.disposeObject3D(attacker.mesh);
          const promotedMesh = this.sculptor.createPieceMesh(moveResult.promotion, attacker.color);
          promotedMesh.position.copy(this.squareToWorld(attacker.square));
          promotedMesh.userData = { pieceId: attacker.id };
          this.scene.add(promotedMesh);
          attacker.mesh = promotedMesh;
          attacker.type = moveResult.promotion;
        }

        this.isAnimating = false;
        this.renderStatusMarkers();
        this.announceAndRecordMove(moveResult);
        this.updateHUD();
        this.persistCurrentGame();

        if (this.chess.game_over()) {
          this.audio.playArcaneChord(true);
          this.showGameOverModal();
          return;
        } else if (this.chess.in_check()) {
          this.audio.playArcaneChord(false);
        }

        if (this.gameMode === 'ai' && this.chess.turn() !== this.playerColor) {
          this.triggerGuardianMove(token);
        }
      }

      triggerGuardianMove(token) {
        if (this.gameConcluded || !this.gameStarted || this.chess.game_over()) return;
        this.aiThinking = true;
        const badge = document.getElementById('guardian-thinking');
        badge.classList.remove('hidden');
        badge.classList.add('inline-flex');

        const currentFen = this.chess.fen();
        const level = this.aiDifficulty;

        setTimeout(() => {
          if (token !== this.sessionToken || this.gameConcluded || !this.gameStarted) return;
          const chosen = this.ai.chooseBestMove(currentFen, level);
          this.aiThinking = false;
          badge.classList.add('hidden');
          badge.classList.remove('inline-flex');

          if (chosen) {
            this.initiateMove(chosen.from, chosen.to, chosen.promotion || 'q');
          }
        }, 420);
      }

      announceAndRecordMove(move) {
        const names = {
          p: 'Peão',
          n: 'Cavalo',
          b: 'Bispo',
          r: 'Torre',
          q: 'Rainha',
          k: 'Rei'
        };
        const pieceName = names[move.piece] || 'Peça';
        let phrase = '';

        if (move.san === 'O-O') {
          phrase = 'Roque menor';
        } else if (move.san === 'O-O-O') {
          phrase = 'Roque maior';
        } else if (move.captured) {
          phrase = `${pieceName} destrói em ${move.to.toUpperCase()}`;
        } else {
          phrase = `${pieceName} para ${move.to.toUpperCase()}`;
        }

        if (move.promotion) {
          phrase += `, promovido a ${names[move.promotion] || 'Rainha'}`;
        }

        if (this.chess.in_checkmate()) {
          phrase += '. Xeque-mate!';
        } else if (this.chess.in_check()) {
          phrase += '. Xeque!';
        }

        document.getElementById('last-move-banner').textContent = `${
          move.color === 'w' ? 'Marfim' : 'Obsidiana'
        }: ${phrase}`;

        this.audio.speakMove(phrase);
      }

      /**
       * ==========================================================================
       * LOOP DE ANIMAÇÃO 3D (60 FPS)
       * ==========================================================================
       */
      animate() {
        requestAnimationFrame(this.animate);
        const dt = Math.min(this.clock.getDelta(), 0.05);
        const elapsedTotal = this.clock.getElapsedTime();
        this.tickChessClock(dt);

        // 1. Oscilação orgânica das tochas e fagulhas dos braseiros
        this.torchLights.forEach((light, idx) => {
          light.intensity = 0.88 + Math.sin(elapsedTotal * 6.5 + idx * 1.7) * 0.12;
        });

        if (this.graphicsQuality === 'high') {
          this.emberParticles.forEach(p => {
            p.mesh.visible = true;
            p.phase += dt * p.speed;
            if (p.phase >= 1) {
              p.phase = 0;
              this.resetEmberParticle(p.mesh, p.originX, p.originY, p.originZ, 0);
            } else {
              p.mesh.position.y = p.originY + p.phase * 1.05;
              p.mesh.position.x += Math.sin(elapsedTotal * 4 + p.phase * 6) * 0.0025;
              p.mesh.material.opacity = Math.sin(p.phase * Math.PI) * 0.85;
            }
          });
        } else {
          this.emberParticles.forEach(p => { p.mesh.visible = false; });
        }

        // 2. Pulso dramático do halo de Xeque
        if (this.checkHaloMesh) {
          const pulse = 1 + Math.sin(elapsedTotal * 7) * 0.08;
          this.checkHaloMesh.scale.set(pulse, pulse, 1);
          this.checkHaloMesh.material.opacity = 0.65 + Math.sin(elapsedTotal * 7) * 0.25;
        }

        // 3. Transição Suave de Câmera
        if (this.cameraTransition) {
          this.cameraTransition.elapsed += dt;
          const ct = Math.min(this.cameraTransition.elapsed / this.cameraTransition.duration, 1);
          const smooth = ct * ct * (3 - 2 * ct);
          this.camera.position.lerpVectors(this.cameraTransition.startPos, this.cameraTransition.endPos, smooth);
          this.controls.target.lerpVectors(this.cameraTransition.startTarget, this.cameraTransition.endTarget, smooth);
          if (ct >= 1) {
            this.cameraTransition = null;
          }
        }

        // 4. Atualizar Animações de Movimento e Captura
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
          const anim = this.activeAnimations[i];
          anim.elapsed += dt;
          const t = Math.min(anim.elapsed / anim.duration, 1);
          const ease = t * t * (3 - 2 * t);

          if (anim.type === 'move') {
            anim.attacker.mesh.position.lerpVectors(anim.startPos, anim.endPos, ease);
            const arcHeight = anim.isKnight ? 0.72 : 0.12;
            // Preserve a altura-base da casa: o arco é aditivo, nunca absoluto.
            const baseY = THREE.MathUtils.lerp(anim.startPos.y, anim.endPos.y, ease);
            anim.attacker.mesh.position.y = baseY + Math.sin(t * Math.PI) * arcHeight;

            if (anim.isKnight) {
              const dirZ = anim.endPos.z > anim.startPos.z ? 1 : -1;
              anim.attacker.mesh.rotation.x = dirZ * Math.sin(t * Math.PI * 2) * 0.18;
            }

            if (anim.rookAnimData) {
              anim.rookAnimData.piece.mesh.position.lerpVectors(
                anim.rookAnimData.startPos,
                anim.rookAnimData.endPos,
                ease
              );
              const rookBaseY = THREE.MathUtils.lerp(anim.rookAnimData.startPos.y, anim.rookAnimData.endPos.y, ease);
              anim.rookAnimData.piece.mesh.position.y = rookBaseY + Math.sin(t * Math.PI) * 0.22;
            }

            if (t >= 1) {
              anim.attacker.mesh.position.copy(anim.endPos);
              anim.attacker.mesh.rotation.set(0, 0, 0);
              if (anim.rookAnimData) {
                anim.rookAnimData.piece.mesh.position.copy(anim.rookAnimData.endPos);
              }
              this.activeAnimations.splice(i, 1);
              this.onMoveAnimationComplete(anim.attacker, anim.moveResult, anim.currentToken);
            }
          } else if (anim.type === 'capture') {
            const impactPoint = new THREE.Vector3().lerpVectors(anim.startPos, anim.endPos, 0.78);

            if (t < 0.56) {
              const subT = t / 0.56;
              const chargeEase = subT * subT;
              anim.attacker.mesh.position.lerpVectors(anim.startPos, impactPoint, chargeEase);
              const jumpH = anim.isKnight ? 0.78 : 0.26;
              anim.attacker.mesh.position.y = anim.startPos.y + Math.sin(subT * Math.PI) * jumpH;

              const dirZ = anim.endPos.z > anim.startPos.z ? 1 : -1;
              anim.attacker.mesh.rotation.x = dirZ * Math.sin(subT * Math.PI) * 0.30;
            } else {
              if (!anim.shattered) {
                anim.shattered = true;
                this.shatterPieceIntoDebris(anim.defender, anim.startPos);
              }
              const subT = (t - 0.56) / 0.44;
              const settleEase = 1 - Math.pow(1 - subT, 2);
              anim.attacker.mesh.position.lerpVectors(impactPoint, anim.endPos, settleEase);
              anim.attacker.mesh.position.y = THREE.MathUtils.lerp(impactPoint.y, anim.endPos.y, settleEase);
              anim.attacker.mesh.rotation.x = 0;
            }

            if (t >= 1) {
              anim.attacker.mesh.position.copy(anim.endPos);
              anim.attacker.mesh.rotation.set(0, 0, 0);
              this.activeAnimations.splice(i, 1);
              this.onMoveAnimationComplete(anim.attacker, anim.moveResult, anim.currentToken);
            }
          }
        }

        // 5. Atualizar Física dos Fragmentos de Pedra
        for (let i = this.debrisFragments.length - 1; i >= 0; i--) {
          const frag = this.debrisFragments[i];
          frag.age += dt;
          frag.velocity.y -= 9.8 * dt;

          frag.mesh.position.addScaledVector(frag.velocity, dt);
          frag.mesh.rotation.x += frag.rotVel.x * dt;
          frag.mesh.rotation.y += frag.rotVel.y * dt;
          frag.mesh.rotation.z += frag.rotVel.z * dt;

          if (frag.mesh.position.y < 0.04) {
            frag.mesh.position.y = 0.04;
            frag.velocity.y *= -0.42;
            frag.velocity.x *= 0.72;
            frag.velocity.z *= 0.72;
          }

          const lifeRatio = frag.age / frag.maxAge;
          if (lifeRatio > 0.65) {
            frag.mesh.material.opacity = Math.max(0, 1 - (lifeRatio - 0.65) / 0.35);
          }

          if (frag.age >= frag.maxAge) {
            this.scene.remove(frag.mesh);
            frag.mesh.geometry.dispose();
            frag.mesh.material.dispose();
            this.debrisFragments.splice(i, 1);
          }
        }

        // 6. Atualizar Ondas de Impacto
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
          const wave = this.shockwaves[i];
          wave.age += dt;
          const p = wave.age / wave.maxAge;
          if (!wave.noExpand) {
            const scale = 1 + p * 3.8;
            wave.mesh.scale.set(scale, scale, 1);
          }
          wave.mesh.material.opacity = Math.max(0, 0.9 * (1 - p));
          if (wave.age >= wave.maxAge) {
            this.scene.remove(wave.mesh);
            wave.mesh.geometry.dispose();
            wave.mesh.material.dispose();
            this.shockwaves.splice(i, 1);
          }
        }

        // 7. Vibração sutil de câmera no impacto (apenas se habilitado)
        if (this.cameraShakeTime > 0 && this.captureCameraFocus && !this.cameraTransition) {
          this.cameraShakeTime -= dt;
          this.controls.target.set(
            (Math.random() - 0.5) * 0.08,
            0.25 + (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.08
          );
        } else if (!this.cameraTransition) {
          this.controls.target.lerp(new THREE.Vector3(0, 0.25, 0), 0.12);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
      }

      /**
       * ==========================================================================
       * INTEGRAÇÃO COM WEB SPEECH API (RECONHECIMENTO DE VOZ EM PORTUGUÊS)
       * ==========================================================================
       */
      initVoiceRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const statusBadge = document.getElementById('voice-status-badge');

        if (!SpeechRec) {
          this.recognition = null;
          statusBadge.textContent = 'Modo Texto';
          return;
        }

        this.recognition = new SpeechRec();
        this.recognition.lang = 'pt-BR';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.isListening = false;

        this.recognition.onstart = () => {
          this.isListening = true;
          document.getElementById('btn-mic').classList.add('mic-listening');
          document.getElementById('btn-mic-label').textContent = 'Escutando...';
          statusBadge.textContent = 'Ouvindo...';
          statusBadge.className = 'text-[10px] px-2 py-0.5 rounded bg-red-900/80 text-red-200 border border-red-500/50';
        };

        this.recognition.onend = () => {
          this.isListening = false;
          document.getElementById('btn-mic').classList.remove('mic-listening');
          document.getElementById('btn-mic-label').textContent = 'Comandar por Voz';
          statusBadge.textContent = 'Pronto (pt-BR)';
          statusBadge.className = 'text-[10px] px-2 py-0.5 rounded bg-stone-800/90 text-stone-300 border border-stone-700';
        };

        this.recognition.onerror = (event) => {
          const feedback = document.getElementById('voice-feedback');
          if (event.error === 'not-allowed') {
            feedback.textContent = 'Permissão de microfone negada. Use o campo de texto abaixo.';
          } else {
            feedback.textContent = 'Voz não captada com clareza. Tente novamente ou digite.';
          }
        };

        this.recognition.onresult = (event) => {
          const spoken = event.results[0][0].transcript;
          this.processNaturalLanguageCommand(spoken);
        };
      }

      toggleVoiceRecognition() {
        if (!this.recognition) {
          document.getElementById('voice-feedback').textContent =
            'Este navegador não disponibiliza Web Speech API direta. Digite sua ordem abaixo!';
          document.getElementById('command-input').focus();
          return;
        }
        if (this.isListening) {
          this.recognition.stop();
        } else {
          try {
            this.recognition.start();
          } catch (e) {
            this.recognition.stop();
          }
        }
      }

      handleTextCommandSubmit(event) {
        event.preventDefault();
        const input = document.getElementById('command-input');
        const val = input.value.trim();
        if (!val) return;
        input.value = '';
        this.processNaturalLanguageCommand(val);
      }

      testVoiceDemo() {
        if (!this.gameStarted || this.gameConcluded || this.isAnimating || this.aiThinking || this.chess.game_over()) return;
        if (this.gameMode === 'ai' && this.chess.turn() !== this.playerColor) return;

        const legal = this.chess.moves({ verbose: true });
        if (legal.length === 0) return;

        const names = { p: 'Peão', n: 'Cavalo', b: 'Bispo', r: 'Torre', q: 'Rainha', k: 'Rei' };
        const captures = legal.filter(m => m.captured);
        const pool = captures.length > 0 ? captures : legal;
        const sample = pool[Math.floor(Math.random() * Math.min(pool.length, 6))];
        const phrase = `${names[sample.piece]} de ${sample.from.toUpperCase()} para ${sample.to.toUpperCase()}`;
        this.processNaturalLanguageCommand(phrase);
      }

      processNaturalLanguageCommand(text) {
        document.getElementById('voice-transcript').textContent = `"${text}"`;
        const feedbackEl = document.getElementById('voice-feedback');
        const coordHint = document.getElementById('voice-coord-hint');
        const ambigBox = document.getElementById('ambiguity-box');
        ambigBox.classList.add('hidden');

        if (this.isAnimating || this.aiThinking) {
          feedbackEl.textContent = 'Aguarde o término do movimento atual.';
          return;
        }

        if (!this.gameStarted) {
          feedbackEl.textContent = 'Inicie uma batalha pelo menu principal primeiro.';
          return;
        }

        if (this.gameMode === 'ai' && this.chess.turn() !== this.playerColor) {
          feedbackEl.textContent = 'Aguarde a jogada do Guardião.';
          return;
        }

        const result = PortugueseVoiceCommandParser.parse(text, this.chess);

        if (result.status === 'ok') {
          const m = result.move;
          coordHint.textContent = `${m.from.toUpperCase()} → ${m.to.toUpperCase()}`;
          feedbackEl.textContent = `Ordem executada: ${m.san}`;
          this.initiateMove(m.from, m.to, m.promotion);
        } else if (result.status === 'ambiguous') {
          coordHint.textContent = `? → ${result.targetSquare}`;
          feedbackEl.textContent = result.message;
          const container = document.getElementById('ambiguity-options');
          container.innerHTML = '';
          result.candidates.forEach(cand => {
            const btn = document.createElement('button');
            btn.className = 'btn-arcane px-2.5 py-1 rounded text-[11px] font-mono text-amber-200';
            btn.textContent = `De ${cand.from.toUpperCase()} (${cand.san})`;
            btn.onclick = () => {
              ambigBox.classList.add('hidden');
              this.initiateMove(cand.from, cand.to, cand.promotion);
            };
            container.appendChild(btn);
          });
          ambigBox.classList.remove('hidden');
        } else {
          coordHint.textContent = '';
          feedbackEl.textContent = result.message;
          this.audio.playIllegalThud();
        }
      }

      /**
       * ==========================================================================
       * ATUALIZAÇÃO DO HUD, VANTAGEM MATERIAL E HISTÓRICO
       * ==========================================================================
       */
      updateHUD() {
        const turn = this.chess.turn();
        const turnDot = document.getElementById('turn-dot');
        const statusText = document.getElementById('status-text');
        const checkBadge = document.getElementById('badge-check');

        const sideName = turn === 'w' ? 'Marfim (Brancas)' : 'Obsidiana (Pretas)';
        const isGuardiansTurn = this.gameMode === 'ai' && turn !== this.playerColor;
        if (turn === 'w') {
          turnDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-100 shadow-[0_0_8px_#fff] shrink-0';
        } else {
          turnDot.className = 'w-2.5 h-2.5 rounded-full bg-stone-500 border border-amber-400/60 shrink-0';
        }
        statusText.textContent = isGuardiansTurn
          ? `Turno do Guardião · ${sideName}`
          : (this.gameMode === 'local' ? `Turno: ${sideName}` : `Sua vez · ${sideName}`);

        if (this.chess.in_check()) {
          checkBadge.classList.remove('hidden');
        } else {
          checkBadge.classList.add('hidden');
        }

        // Histórico Algébrico Completo (lances jogados + lances futuros disponíveis para refazer)
        const playedHistory = this.chess.history({ verbose: true });
        const futureHistory = (this.redoStack || []).slice().reverse();
        const fullHistory = [...playedHistory, ...futureHistory];
        const activePly = playedHistory.length;

        const historyEl = document.getElementById('move-history');
        const moveCounter = document.getElementById('move-counter');
        moveCounter.textContent = `Lance ${Math.floor(fullHistory.length / 2) + 1}`;

        if (fullHistory.length === 0) {
          historyEl.innerHTML = `
            <div class="text-stone-500 italic font-sans text-[11px] py-4 text-center">
              As esculturas aguardam o primeiro comando...
            </div>`;
        } else {
          let html = `
            <div class="flex items-center justify-between px-2 py-1 mb-1.5 rounded text-[11px] bg-stone-900/80 border border-amber-500/20">
              <span class="text-stone-400 text-[10px] uppercase tracking-wider">Navegação:</span>
              <div class="flex items-center gap-2">
                <button type="button" data-action="jumpToPly(0)" class="text-xs ${activePly === 0 ? 'text-amber-300 font-bold underline' : 'text-stone-400 hover:text-white'} underline-offset-2" title="Ver posição inicial">⏮ Início</button>
                <button type="button" data-action="jumpToPly(${fullHistory.length})" class="text-xs ${activePly === fullHistory.length ? 'text-amber-300 font-bold underline' : 'text-stone-400 hover:text-white'} underline-offset-2" title="Ir para o lance mais recente">Fim ⏭</button>
              </div>
            </div>`;

          for (let i = 0; i < fullHistory.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const wMove = fullHistory[i];
            const bMove = fullHistory[i + 1];
            const wPly = i + 1;
            const bPly = i + 2;

            const wClass = activePly === wPly
              ? 'text-amber-200 font-bold bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-500/40'
              : (wPly <= activePly ? 'text-amber-100 hover:text-white' : 'text-stone-500 hover:text-stone-300');

            const bClass = activePly === bPly
              ? 'text-amber-200 font-bold bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-500/40'
              : (bPly <= activePly ? 'text-stone-300 hover:text-white' : 'text-stone-500 hover:text-stone-300');

            html += `
              <div class="flex items-center justify-between px-2 py-0.5 rounded hover:bg-white/5 text-[11px]">
                <span class="text-stone-500 w-7">${moveNum}.</span>
                <button type="button" data-action="jumpToPly(${wPly})" class="${wClass} flex-1 text-left underline-offset-2 hover:underline truncate" title="Ir para lance ${wPly}">${wMove.san}</button>
                <button type="button" data-action="jumpToPly(${bMove ? bPly : wPly})" class="${bClass} flex-1 text-right underline-offset-2 hover:underline truncate" title="${bMove ? 'Ir para lance ' + bPly : ''}">${bMove ? bMove.san : ''}</button>
              </div>`;
          }
          historyEl.innerHTML = html;
          if (activePly === fullHistory.length) {
            historyEl.scrollTop = historyEl.scrollHeight;
          }
        }

        // Cemitério de Peças Capturadas + Cálculo Real de Vantagem Material
        const icons = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
        const weights = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        const capturedByWhite = [];
        const capturedByBlack = [];

        playedHistory.forEach(m => {
          if (m.captured) {
            if (m.color === 'w') capturedByWhite.push(icons[m.captured] || '♟');
            else capturedByBlack.push(icons[m.captured] || '♟');
          }
        });

        let whiteMaterial = 0;
        let blackMaterial = 0;
        const board = this.chess.board();
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            if (cell.color === 'w') whiteMaterial += weights[cell.type] || 0;
            else blackMaterial += weights[cell.type] || 0;
          }
        }

        const diff = whiteMaterial - blackMaterial;
        document.getElementById('material-adv-white').textContent = diff > 0 ? `+${diff}` : '';
        document.getElementById('material-adv-black').textContent = diff < 0 ? `+${Math.abs(diff)}` : '';

        document.getElementById('captured-black').innerHTML =
          capturedByWhite.map(ic => `<span>${ic}</span>`).join('') ||
          '<span class="text-[11px] text-stone-600 italic">Nenhuma</span>';
        document.getElementById('captured-white').innerHTML =
          capturedByBlack.map(ic => `<span>${ic}</span>`).join('') ||
          '<span class="text-[11px] text-stone-600 italic">Nenhuma</span>';
      }

      showGameOverModal() {
        this.gameConcluded = true;
        this.sessionToken++;
        this.aiThinking = false;
        this.isAnimating = false;
        const badge = document.getElementById('guardian-thinking');
        if (badge) { badge.classList.add('hidden'); badge.classList.remove('inline-flex'); }
        const titleEl = document.getElementById('gameover-title');
        const subEl = document.getElementById('gameover-subtitle');

        if (this.chess.in_checkmate()) {
          const winner = this.chess.turn() === 'w' ? 'Obsidiana (Pretas)' : 'Marfim (Brancas)';
          titleEl.textContent = 'Xeque-Mate!';
          subEl.textContent = `Vitória suprema das forças de ${winner} no Salão Arcano.`;
        } else if (this.chess.in_stalemate()) {
          titleEl.textContent = 'Empate por Afogamento';
          subEl.textContent = 'O monarca adversário não possui movimentos legais restantes.';
        } else if (this.chess.in_threefold_repetition()) {
          titleEl.textContent = 'Empate por Tripla Repetição';
          subEl.textContent = 'A mesma configuração de forças repetiu-se três vezes.';
        } else if (this.chess.insufficient_material()) {
          titleEl.textContent = 'Material Insuficiente';
          subEl.textContent = 'Nenhum dos exércitos possui forças suficientes para o xeque-mate.';
        } else {
          titleEl.textContent = 'Empate Declarado';
          subEl.textContent = 'Equilíbrio de forças alcançado pelas leis oficiais do xadrez.';
        }

        this.toggleModal('gameover-modal', true);
      }

      /**
       * ==========================================================================
       * CONTROLES DE CÂMERA CINEMATOGRÁFICA, PAINÉIS E CONFIGURAÇÕES
       * ==========================================================================
       */
      setCameraPreset(preset) {
        ['white', 'top', 'cinema', 'black'].forEach(id => {
          const btn = document.getElementById(`cam-${id}`);
          if (btn) btn.classList.toggle('active', id === preset);
        });

        let targetPos = new THREE.Vector3(0, 6.8, 8.0);
        let endTarget = new THREE.Vector3(0, 0.25, 0);

        if (preset === 'white') {
          targetPos.set(0, 6.8, 8.0);
        } else if (preset === 'black') {
          targetPos.set(0, 6.8, -8.0);
        } else if (preset === 'top') {
          targetPos.set(0, 12.0, 0.01);
          endTarget.set(0, 0, 0);
        } else if (preset === 'cinema') {
          targetPos.set(6.2, 5.0, 6.4);
        }

        this.cameraTransition = {
          startPos: this.camera.position.clone(),
          endPos: targetPos,
          startTarget: this.controls.target.clone(),
          endTarget,
          elapsed: 0,
          duration: 0.72
        };
      }

      toggleLeftPanel(forceState = null) {
        this.leftPanelOpen = forceState !== null ? forceState : !this.leftPanelOpen;
        const panel = document.getElementById('left-panel');
        const expandBtn = document.getElementById('btn-expand-left');
        panel.classList.toggle('panel-collapsed-left', !this.leftPanelOpen);
        expandBtn.classList.toggle('hidden', this.leftPanelOpen);
        expandBtn.classList.toggle('flex', !this.leftPanelOpen);
      }

      syncRightPanelVisibility() {
        const panel = document.getElementById('right-panel');
        if (!panel) return;

        // No mobile, 'hidden' realmente retira o painel da tela; no desktop,
        // o recolhimento é feito pela translação para não alterar o layout.
        const hideForMobile = window.innerWidth < 1024 && !this.rightPanelOpen;
        panel.classList.toggle('hidden', hideForMobile);
      }

      toggleRightPanel(forceState = null) {
        this.rightPanelOpen = forceState !== null ? forceState : !this.rightPanelOpen;
        const panel = document.getElementById('right-panel');
        const expandBtn = document.getElementById('btn-expand-right');
        panel.classList.toggle('panel-collapsed-right', !this.rightPanelOpen);

        if (this.rightPanelOpen) {
          expandBtn.classList.add('hidden', 'lg:hidden');
          expandBtn.classList.remove('flex');
        } else {
          expandBtn.classList.remove('hidden', 'lg:hidden');
          expandBtn.classList.add('flex');
        }

        this.syncRightPanelVisibility();
      }

      toggleHelpModal(forceState = null) {
        this.toggleModal('help-modal', forceState);
      }

      selectStartingColor(color) {
        this.startingColor = color === 'b' ? 'b' : 'w';
        const whiteBtn = document.getElementById('start-color-white');
        const blackBtn = document.getElementById('start-color-black');
        whiteBtn.classList.toggle('selected', this.startingColor === 'w');
        blackBtn.classList.toggle('selected', this.startingColor === 'b');
        whiteBtn.setAttribute('aria-pressed', String(this.startingColor === 'w'));
        blackBtn.setAttribute('aria-pressed', String(this.startingColor === 'b'));
        this.savePreferences();
      }

      updateStartMenuMode(mode) {
        const isAI = mode === 'ai';
        document.getElementById('start-color-group').style.display = isAI ? 'block' : 'none';
        document.getElementById('start-difficulty-group').style.display = isAI ? 'block' : 'none';
      }

      startNewGameFromMenu() {
        const mode = document.getElementById('start-mode').value;
        const color = mode === 'ai' ? this.startingColor : 'w';
        const difficulty = document.getElementById('start-difficulty').value;
        this.startNewGame(mode, color, difficulty);
      }

      startNewGame(mode = 'ai', color = 'w', difficulty = 2) {
        this.gameMode = mode === 'local' ? 'local' : 'ai';
        this.sessionGameMode = this.gameMode;
        this.playerColor = color === 'b' ? 'b' : 'w';
        this.startingColor = this.playerColor;
        this.aiDifficulty = Math.max(1, Math.min(3, parseInt(difficulty, 10) || 2));
        const clockEl = document.getElementById('start-time-control');
        if (clockEl) this.setClockControl(clockEl.value, false);
        this.gameStarted = true;

        // Manter os controles da HUD e do Grimório sincronizados com a tela inicial.
        ['select-mode', 'modal-select-mode', 'start-mode'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = this.gameMode;
        });
        ['select-difficulty', 'modal-select-difficulty', 'start-difficulty'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = String(this.aiDifficulty);
        });
        const showDiff = this.gameMode === 'ai' ? 'flex' : 'none';
        document.getElementById('difficulty-row').style.display = showDiff;
        document.getElementById('modal-difficulty-row').style.display = showDiff;
        document.getElementById('start-screen').classList.add('hidden');
        this.resetGame(true);
        this.setCameraPreset(this.playerColor === 'w' ? 'white' : 'black');
        this.savePreferences();
        document.getElementById('last-move-banner').textContent = this.gameMode === 'ai'
          ? `Partida iniciada. Você controla ${this.playerColor === 'w' ? 'o Marfim' : 'a Obsidiana'}.`
          : 'Duelo local iniciado. Marfim começa a partida.';
      }

      changeGameMode(mode) {
        if (mode !== this.gameMode && this.gameStarted && this.chess.history().length > 0 &&
            !confirm('Trocar o modo reiniciará a partida atual. Deseja continuar?')) {
          document.getElementById('select-mode').value = this.gameMode;
          document.getElementById('modal-select-mode').value = this.gameMode;
          return;
        }
        this.gameMode = mode;
        this.sessionGameMode = mode;
        document.getElementById('select-mode').value = mode;
        document.getElementById('modal-select-mode').value = mode;
        const startMode = document.getElementById('start-mode');
        if (startMode) startMode.value = mode;

        const showDiff = mode === 'ai' ? 'flex' : 'none';
        document.getElementById('difficulty-row').style.display = showDiff;
        document.getElementById('modal-difficulty-row').style.display = showDiff;
        this.resetGame(true);
        this.savePreferences();
      }

      changeDifficulty(level) {
        this.aiDifficulty = parseInt(level, 10) || 2;
        document.getElementById('select-difficulty').value = String(this.aiDifficulty);
        document.getElementById('modal-select-difficulty').value = String(this.aiDifficulty);
        const startDiff = document.getElementById('start-difficulty');
        if (startDiff) startDiff.value = String(this.aiDifficulty);
        this.savePreferences();
      }

      toggleSound() {
        this.audio.sfxEnabled = !this.audio.sfxEnabled;
        document.getElementById('btn-sfx').classList.toggle('active', this.audio.sfxEnabled);
        this.savePreferences();
      }

      toggleVoiceAnnounce() {
        this.audio.ttsEnabled = !this.audio.ttsEnabled;
        document.getElementById('btn-tts').classList.toggle('active', this.audio.ttsEnabled);
        this.savePreferences();
      }

      cycleAnimSpeed() {
        const order = ['cinema', 'fast', 'instant'];
        const labels = { cinema: 'Cinema', fast: 'Rápida', instant: 'Instantânea' };
        const nextIdx = (order.indexOf(this.animMode) + 1) % order.length;
        this.animMode = order[nextIdx];
        document.getElementById('anim-speed-label').textContent = labels[this.animMode];
        document.getElementById('setting-anim').value = this.animMode;
        this.savePreferences();
      }

      setAnimMode(mode) {
        this.animMode = mode;
        const labels = { cinema: 'Cinema', fast: 'Rápida', instant: 'Instantânea' };
        document.getElementById('anim-speed-label').textContent = labels[mode];
      }

      toggleCaptureCameraFocus(enabled) {
        this.captureCameraFocus = Boolean(enabled);
        this.savePreferences();
      }

      setGraphicsQuality(quality) {
        this.graphicsQuality = quality;
        const enableShadows = quality === 'high';
        this.renderer.shadowMap.enabled = enableShadows;
        if (this.moonLight) this.moonLight.castShadow = enableShadows;
        this.renderer.setPixelRatio(enableShadows ? Math.min(window.devicePixelRatio, 2) : 1);
        const qualityEl = document.getElementById('setting-quality');
        if (qualityEl) qualityEl.value = quality;
        this.savePreferences();
      }

      toggleModal(id, forceState = null) {
        const el = document.getElementById(id);
        if (!el) return;
        const show = forceState !== null ? forceState : el.classList.contains('hidden');
        el.classList.toggle('hidden', !show);
        el.classList.toggle('flex', show);
      }

      initialClockValues() {
        if (this.clockControl === 'off') return { w: 0, b: 0 };
        const seconds = Math.max(1, Number(this.clockControl.split('+')[0]) || 600);
        return { w: seconds, b: seconds };
      }

      setClockControl(value, persist = true) {
        if (!/^(off|[0-9]+\+[0-9]+)$/.test(String(value))) value = '600+0';
        this.clockControl = String(value);
        const parts = this.clockControl === 'off' ? [0,0] : this.clockControl.split('+').map(Number);
        this.clockIncrement = parts[1] || 0;
        if (!this.gameStarted || this.chess.history().length === 0) {
          this.clockRemaining = this.initialClockValues(); this.clockSide = 'w'; this.clockExpired = false;
        }
        const el = document.getElementById('start-time-control'); if (el) el.value = this.clockControl;
        this.updateClockHUD(); if (persist) this.savePreferences();
      }

      formatClock(seconds) {
        seconds = Math.max(0, Math.ceil(seconds));
        const m = Math.floor(seconds / 60), sec = seconds % 60;
        return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
      }

      updateClockHUD() {
        const active = this.clockControl !== 'off';
        ['clock-white','clock-black'].forEach((id,i) => {
          const el = document.getElementById(id); if (!el) return;
          el.classList.toggle('hidden', !active);
          el.textContent = this.formatClock(this.clockRemaining[i===0?'w':'b']);
          el.classList.toggle('text-red-300', active && this.clockRemaining[i===0?'w':'b'] <= 30);
          el.classList.toggle('border-red-500/60', active && this.clockRemaining[i===0?'w':'b'] <= 30);
          el.classList.toggle('ring-1', active && this.clockSide === (i===0?'w':'b'));
        });
      }

      tickChessClock(dt) {
        if (!this.gameStarted || this.gameConcluded || this.clockControl === 'off' || this.clockExpired || this.chess.game_over()) return;
        this.clockRemaining[this.clockSide] -= dt;
        if (this.clockRemaining[this.clockSide] <= 0) {
          this.clockRemaining[this.clockSide] = 0; this.clockExpired = true; this.gameConcluded = true;
          const loser = this.clockSide, winner = loser === 'w' ? 'Obsidiana' : 'Marfim';
          this.updateClockHUD();
          this.sessionToken++; this.aiThinking = false; this.isAnimating = false;
          document.getElementById('gameover-title').textContent = 'Tempo esgotado';
          document.getElementById('gameover-subtitle').textContent = `${winner} vence pelo relógio. Em caso de material insuficiente, confirme as regras oficiais antes de registrar o resultado.`;
          this.toggleModal('gameover-modal', true); return;
        }
        this.updateClockHUD();
      }

      savePreferences() {
        try {
          const data = {
            gameMode: this.gameMode, playerColor: this.playerColor, startingColor: this.startingColor,
            aiDifficulty: this.aiDifficulty, animMode: this.animMode, graphicsQuality: this.graphicsQuality,
            captureCameraFocus: this.captureCameraFocus, sfxEnabled: this.audio.sfxEnabled,
            ttsEnabled: this.audio.ttsEnabled, clockControl: this.clockControl
          };
          localStorage.setItem(this.preferencesKey, JSON.stringify(data));
        } catch (err) { console.warn('Não foi possível salvar as preferências locais.', err); }
      }

      restorePreferences() {
        try {
          const raw = localStorage.getItem(this.preferencesKey);
          if (!raw) return;
          const data = JSON.parse(raw);
          if (['ai','local'].includes(data.gameMode)) this.gameMode = data.gameMode;
          if (['w','b'].includes(data.playerColor)) this.playerColor = data.playerColor;
          if (['w','b'].includes(data.startingColor)) this.startingColor = data.startingColor;
          if ([1,2,3].includes(Number(data.aiDifficulty))) this.aiDifficulty = Number(data.aiDifficulty);
          if (['cinema','fast','instant'].includes(data.animMode)) this.animMode = data.animMode;
          if (['high','performance'].includes(data.graphicsQuality)) this.graphicsQuality = data.graphicsQuality;
          if (typeof data.captureCameraFocus === 'boolean') this.captureCameraFocus = data.captureCameraFocus;
          if (typeof data.sfxEnabled === 'boolean') this.audio.sfxEnabled = data.sfxEnabled;
          if (typeof data.ttsEnabled === 'boolean') this.audio.ttsEnabled = data.ttsEnabled;
          if (typeof data.clockControl === 'string' && /^(off|[0-9]+\+[0-9]+)$/.test(data.clockControl)) this.clockControl = data.clockControl;
          const values = {
            'start-mode':this.gameMode, 'select-mode':this.gameMode, 'modal-select-mode':this.gameMode,
            'start-difficulty':String(this.aiDifficulty), 'select-difficulty':String(this.aiDifficulty),
            'modal-select-difficulty':String(this.aiDifficulty), 'setting-quality':this.graphicsQuality,
            'setting-anim':this.animMode, 'setting-cam-focus':this.captureCameraFocus, 'start-time-control':this.clockControl
          };
          Object.entries(values).forEach(([id,value]) => { const el=document.getElementById(id); if(el) { if(el.type==='checkbox') el.checked=value; else el.value=value; } });
          document.getElementById('btn-sfx')?.classList.toggle('active', this.audio.sfxEnabled);
          document.getElementById('btn-tts')?.classList.toggle('active', this.audio.ttsEnabled);
          const showDiff = this.gameMode === 'ai' ? 'flex' : 'none';
          document.getElementById('difficulty-row').style.display = showDiff;
          document.getElementById('modal-difficulty-row').style.display = showDiff;
          this.updateStartMenuMode(this.gameMode);
          this.selectStartingColor(this.startingColor);
          this.setClockControl(this.clockControl, false);
        } catch (err) { console.warn('Preferências locais inválidas; usando padrões.', err); }
      }

      persistCurrentGame() {
        try {
          const pgn = this.chess.pgn();
          localStorage.setItem(this.savedGameKey, JSON.stringify({
            version: 2, pgn, fen: this.chess.fen(), gameMode: this.gameMode,
            playerColor: this.playerColor, aiDifficulty: this.aiDifficulty, clockControl: this.clockControl,
            clockRemaining: this.clockRemaining, clockSide: this.clockSide,
            updatedAt: new Date().toISOString()
          }));
        } catch (err) { console.warn('Não foi possível salvar a recuperação automática.', err); }
      }

      saveGame() {
        this.persistCurrentGame();
        this.savePreferences();
        document.getElementById('last-move-banner').textContent = 'Partida salva neste navegador.';
        alert('Partida salva localmente neste navegador. Ela não é enviada para nenhum servidor.');
      }

      loadSavedGame() {
        let data;
        try { data = JSON.parse(localStorage.getItem(this.savedGameKey) || 'null'); } catch (_) { data = null; }
        if (!data || (!data.pgn && !data.fen)) { alert('Nenhuma partida salva foi encontrada neste navegador.'); return; }
        if (this.chess.history().length && !confirm('Substituir a posição atual pela partida salva?')) return;
        // A recuperação também é transacional: dados corrompidos não podem
        // apagar a posição que o jogador ainda tem aberta.
        const recoveredGame = new Chess();
        let loaded = false;
        if (data.pgn) { try { loaded = recoveredGame.load_pgn(data.pgn); } catch (_) {} }
        if (!loaded && data.fen) { try { loaded = recoveredGame.load(data.fen); } catch (_) {} }
        if (!loaded) { alert('O arquivo de partida salva está inválido ou incompatível.'); return; }
        this.sessionToken++;
        this.aiThinking = false; this.isAnimating = false; this.pendingPromotion = null;
        this.chess = recoveredGame;
        this.gameMode = data.gameMode === 'local' ? 'local' : 'ai';
        this.playerColor = data.playerColor === 'b' ? 'b' : 'w';
        this.aiDifficulty = Math.max(1, Math.min(3, Number(data.aiDifficulty) || 2));
        if (typeof data.clockControl === 'string') this.setClockControl(data.clockControl, false);
        if (data.clockRemaining && Number.isFinite(data.clockRemaining.w) && Number.isFinite(data.clockRemaining.b)) this.clockRemaining = {w:Math.max(0,data.clockRemaining.w),b:Math.max(0,data.clockRemaining.b)};
        this.clockSide = data.clockSide === 'b' ? 'b' : 'w'; this.clockExpired = false; this.updateClockHUD();
        this.gameStarted = true; this.gameConcluded = false; this.redoStack = []; this.lastMoveSquares = null;
        this.syncPersistentPiecesFromScratch(); this.updateHUD();
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('last-move-banner').textContent = 'Partida recuperada do salvamento local.';
        this.savePreferences();
      }

      exportPGN() {
        const pgn = this.chess.pgn({ max_width: 80, newline_char: '\n' });
        if (!pgn.trim()) { alert('Ainda não há lances para exportar.'); return; }
        this.downloadText('xadrez-bruxo-partida.pgn', pgn, 'application/x-chess-pgn');
      }

      importPGN() {
        const pgn = prompt('Cole abaixo o conteúdo PGN da partida:');
        if (pgn === null || !pgn.trim()) return;
        // Carrega primeiro em uma instância isolada: uma entrada inválida nunca
        // deve destruir a partida válida que já está aberta.
        const importedGame = new Chess();
        let loaded = false;
        try { loaded = importedGame.load_pgn(pgn.trim()); } catch (err) { console.warn(err); }
        if (!loaded) { alert('Não foi possível importar esse PGN. Verifique a notação e tente novamente.'); return; }
        this.sessionToken++; this.aiThinking = false; this.isAnimating = false;
        this.chess = importedGame;
        this.gameMode = 'local'; this.gameStarted = true; this.gameConcluded = false; this.redoStack = []; this.lastMoveSquares = null;
        this.syncPersistentPiecesFromScratch(); this.updateHUD(); this.persistCurrentGame();
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('last-move-banner').textContent = 'PGN importado em modo de análise local.';
      }

      showFEN() { prompt('Posição FEN atual (selecione e copie):', this.chess.fen()); }
      importFEN() {
        const fen = prompt('Cole a posição FEN completa:');
        if (fen === null || !fen.trim()) return;
        // Valida em uma instância temporária para preservar a partida atual em
        // caso de erro de digitação ou FEN incompatível.
        const importedPosition = new Chess();
        let ok = false; try { ok = importedPosition.load(fen.trim()); } catch (_) {}
        if (!ok) { alert('FEN inválida. A posição deve conter os campos obrigatórios do formato FEN.'); return; }
        this.sessionToken++; this.aiThinking=false; this.isAnimating=false;
        this.chess = importedPosition;
        this.gameMode='local'; this.gameStarted=true; this.gameConcluded=false; this.redoStack=[]; this.lastMoveSquares=null;
        this.clockRemaining=this.initialClockValues(); this.clockSide=this.chess.turn(); this.clockExpired=false;
        this.syncPersistentPiecesFromScratch(); this.updateHUD(); this.updateClockHUD(); this.persistCurrentGame();
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('last-move-banner').textContent='Posição FEN carregada em modo local.';
      }

      jumpToPly(ply) {
        const played = this.chess.history({ verbose: true });
        const future = (this.redoStack || []).slice().reverse();
        const allMoves = [...played, ...future];
        if (!allMoves.length) return;

        const target = Math.max(0, Math.min(allMoves.length, Number(ply) || 0));
        const replay = new Chess();
        for (let i = 0; i < target; i++) {
          const m = allMoves[i];
          if (!replay.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' })) break;
        }

        this.sessionToken++;
        this.aiThinking = false;
        this.isAnimating = false;
        this.chess = replay;
        this.redoStack = allMoves.slice(target).reverse();

        if (!this.sessionGameMode) this.sessionGameMode = this.gameMode;
        if (target === allMoves.length) {
          this.gameMode = this.sessionGameMode;
        } else {
          this.gameMode = 'local';
        }
        ['select-mode', 'modal-select-mode'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = this.gameMode;
        });

        this.gameConcluded = false;
        this.lastMoveSquares = target > 0 ? { from: allMoves[target - 1].from, to: allMoves[target - 1].to } : null;
        this.clockSide = this.chess.turn();
        this.syncPersistentPiecesFromScratch();
        this.updateHUD();
        this.persistCurrentGame();
        document.getElementById('last-move-banner').textContent = target === 0
          ? 'Histórico: visualizando posição inicial.'
          : `Histórico: visualizando após ${target} lance(s).`;
      }

      async copyFEN() {
        const fen = this.chess.fen();
        try { await navigator.clipboard.writeText(fen); alert('FEN copiado.'); }
        catch (_) { prompt('Copie a posição FEN:', fen); }
      }

      downloadText(filename, content, mime) {
        const blob = new Blob([content], { type: mime + ';charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      rebuildFromRules() {
        this.sessionToken++; this.aiThinking = false; this.isAnimating = false;
        this.pendingPromotion = null; this.activeAnimations = [];
        this.clearSelection(); this.syncPersistentPiecesFromScratch(); this.updateHUD();
        this.persistCurrentGame();
      }

      undoMove() {
        if (!this.chess.history().length) { alert('Não há lances para desfazer.'); return; }
        this.sessionToken++; this.aiThinking = false; this.isAnimating = false;
        const currentHistory = this.chess.history({verbose:true});
        const lastPly = currentHistory[currentHistory.length - 1];
        const plies = this.gameMode === 'ai' && currentHistory.length >= 2 && lastPly && lastPly.color !== this.playerColor ? 2 : 1;
        for (let i=0; i<plies; i++) { const undone=this.chess.undo(); if (undone) this.redoStack.push(undone); }
        this.lastMoveSquares = null; this.rebuildFromRules();
        document.getElementById('last-move-banner').textContent = 'Lance(s) desfeito(s).';
      }

      redoMove() {
        if (!this.redoStack.length) { alert('Não há lances desfeitos para refazer.'); return; }
        this.sessionToken++; this.aiThinking = false; this.isAnimating = false;
        const first = this.redoStack.pop();
        const result = this.chess.move({ from:first.from, to:first.to, promotion:first.promotion || 'q' });
        if (!result) { this.redoStack = []; alert('Não foi possível refazer este lance na posição atual.'); this.rebuildFromRules(); return; }
        // No modo contra IA, reaplica o segundo lance guardado se ele pertence à sequência desfeita.
        if (this.gameMode === 'ai' && this.redoStack.length) {
          const next = this.redoStack[this.redoStack.length-1];
          const candidate = this.chess.moves({ verbose:true }).find(m => m.from===next.from && m.to===next.to && (m.promotion||null)===(next.promotion||null));
          if (candidate) { this.redoStack.pop(); this.chess.move({from:next.from,to:next.to,promotion:next.promotion||'q'}); }
        }
        this.lastMoveSquares = null; this.rebuildFromRules();
        document.getElementById('last-move-banner').textContent = 'Lance(s) refeito(s).';
        if (this.gameMode === 'ai' && !this.gameConcluded && !this.chess.game_over() && this.chess.turn() !== this.playerColor) {
          this.triggerGuardianMove(this.sessionToken);
        }
      }

      returnToMenu() {
        if (this.chess.history().length && !confirm('Voltar ao menu? A partida atual será mantida no salvamento local automático.')) return;
        this.persistCurrentGame(); this.sessionToken++; this.aiThinking=false; this.isAnimating=false;
        this.gameStarted = false; this.gameConcluded = false; this.clearSelection();
        document.getElementById('start-screen').classList.remove('hidden');
      }

      resignGame() {
        if (!this.gameStarted || this.chess.game_over()) return;
        if (!confirm('Deseja realmente desistir desta partida?')) return;
        this.sessionToken++; this.aiThinking=false; this.isAnimating=false; this.gameConcluded=true;
        const winner = this.chess.turn() === 'w' ? 'Obsidiana' : 'Marfim';
        document.getElementById('gameover-title').textContent = 'Desistência';
        document.getElementById('gameover-subtitle').textContent = `${winner} vence por desistência. O estado de regras não foi adulterado; inicie uma nova batalha para jogar novamente.`;
        this.toggleModal('gameover-modal', true);
      }

      offerDraw() {
        if (!this.gameStarted || this.chess.game_over()) return;
        if (this.gameMode === 'local') {
          if (confirm('O outro jogador aceita o empate?')) {
            this.gameConcluded = true;
            document.getElementById('gameover-title').textContent = 'Empate acordado';
            document.getElementById('gameover-subtitle').textContent = 'Os jogadores concordaram em encerrar a partida empatada.';
            this.toggleModal('gameover-modal', true);
          }
        } else {
          alert('No modo contra IA, a oferta de empate não é negociada pelo motor atual. Você pode encerrar a partida ou continuar jogando.');
        }
      }

      resetGame(force = false) {
        if (!force && this.gameStarted && this.chess.history().length > 0 &&
            !window.confirm('Reiniciar a batalha? O progresso atual será substituído.')) return;
        this.sessionToken++;
        this.redoStack = [];
        this.isAnimating = false;
        this.aiThinking = false;
        this.pendingPromotion = null;
        this.lastMoveSquares = null;

        const badge = document.getElementById('guardian-thinking');
        badge.classList.add('hidden');
        badge.classList.remove('inline-flex');
        document.getElementById('ambiguity-box').classList.add('hidden');
        document.getElementById('voice-feedback').textContent = '';
        document.getElementById('voice-coord-hint').textContent = '';
        document.getElementById('last-move-banner').textContent =
          this.gameMode === 'ai'
            ? `Batalha reiniciada. Seu exército: ${this.playerColor === 'w' ? 'Marfim' : 'Obsidiana'}.`
            : 'Duelo local reiniciado. Marfim começa.';

        this.chess.reset();
        this.clockRemaining = this.initialClockValues();
        this.clockSide = 'w'; this.clockExpired = false; this.gameConcluded = false;
        this.updateClockHUD();
        this.clearSelection();
        this.syncPersistentPiecesFromScratch();
        this.updateHUD();
        this.persistCurrentGame();

        // Ao jogar de Pretas, o Guardião controla as Brancas e precisa abrir a partida.
        if (this.gameStarted && this.gameMode === 'ai' && this.chess.turn() !== this.playerColor) {
          this.triggerGuardianMove(this.sessionToken);
        }
      }
    }

export { WizardChessApp };
