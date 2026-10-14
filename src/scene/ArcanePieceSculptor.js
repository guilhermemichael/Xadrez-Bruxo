import * as THREE from 'three';

class ArcanePieceSculptor {
      constructor() {
        this.textures = this.generateProceduralStoneTextures();

        // Materiais PBR Refinados: Marfim Envelhecido, Obsidiana Esculpida e Bronze Antigo
        this.materials = {
          w: new THREE.MeshStandardMaterial({
            color: 0xe6dbc8,
            map: this.textures.ivoryColor,
            bumpMap: this.textures.stoneBump,
            bumpScale: 0.012,
            roughnessMap: this.textures.stoneBump,
            roughness: 0.42,
            metalness: 0.08
          }),
          b: new THREE.MeshStandardMaterial({
            color: 0x1e222b,
            map: this.textures.obsidianColor,
            bumpMap: this.textures.stoneBump,
            bumpScale: 0.015,
            roughnessMap: this.textures.stoneBump,
            roughness: 0.34,
            metalness: 0.28
          }),
          bronze: new THREE.MeshStandardMaterial({
            color: 0xc89d5c,
            bumpMap: this.textures.stoneBump,
            bumpScale: 0.008,
            roughness: 0.32,
            metalness: 0.84
          }),
          darkBronze: new THREE.MeshStandardMaterial({
            color: 0x7c5c2b,
            roughness: 0.44,
            metalness: 0.76
          })
        };

        // Cache de Geometrias Torneadas e Esculpidas para máximo desempenho
        this.geometryCache = {};
        this.initSharedGeometries();
      }

      // Gera texturas procedurais em Canvas para veios de mármore, ardósia e micro-relevo de pedra
      generateProceduralStoneTextures() {
        const createCanvasTex = (drawFn) => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          drawFn(ctx, 256, 256);
          const tex = new THREE.CanvasTexture(canvas);
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          return tex;
        };

        // 1. Mapa de Relevo/Rugosidade de Pedra Esculpida
        const stoneBump = createCanvasTex((ctx, w, h) => {
          ctx.fillStyle = '#808080';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 4200; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const v = 100 + Math.floor(Math.random() * 55);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, 2, 2);
          }
          // Veios sutis
          ctx.strokeStyle = 'rgba(60, 60, 60, 0.22)';
          ctx.lineWidth = 1.2;
          for (let v = 0; v < 18; v++) {
            ctx.beginPath();
            let cx = Math.random() * w;
            let cy = 0;
            ctx.moveTo(cx, cy);
            while (cy < h) {
              cy += 16;
              cx += (Math.random() - 0.5) * 22;
              ctx.lineTo(cx, cy);
            }
            ctx.stroke();
          }
        });

        // 2. Nuances de Marfim Envelhecido / Mármore Quente
        const ivoryColor = createCanvasTex((ctx, w, h) => {
          const grad = ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#ebe1cf');
          grad.addColorStop(0.5, '#dfd3be');
          grad.addColorStop(1, '#e7dcc8');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = 'rgba(155, 132, 98, 0.16)';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 14; i++) {
            ctx.beginPath();
            let x = Math.random() * w;
            let y = 0;
            ctx.moveTo(x, y);
            while (y < h) {
              y += 20;
              x += (Math.random() - 0.5) * 26;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        });

        // 3. Nuances de Obsidiana / Grafite Mineral
        const obsidianColor = createCanvasTex((ctx, w, h) => {
          const grad = ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#222631');
          grad.addColorStop(0.5, '#181b24');
          grad.addColorStop(1, '#242936');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = 'rgba(180, 195, 220, 0.08)';
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 14; i++) {
            ctx.beginPath();
            let x = Math.random() * w;
            let y = 0;
            ctx.moveTo(x, y);
            while (y < h) {
              y += 20;
              x += (Math.random() - 0.5) * 24;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        });

        return { stoneBump, ivoryColor, obsidianColor };
      }

      initSharedGeometries() {
        const makeLathe = (pts, segs = 24) => {
          const vectors = pts.map(([r, y]) => new THREE.Vector2(r, y));
          const geo = new THREE.LatheGeometry(vectors, segs);
          geo.computeVertexNormals();
          return geo;
        };

        // Base Monumental Torneada comum a toda a coleção
        this.geometryCache.pedestal = makeLathe([
          [0.0, 0.0],
          [0.41, 0.0],
          [0.41, 0.05],
          [0.37, 0.09],
          [0.38, 0.13],
          [0.33, 0.18],
          [0.29, 0.24],
          [0.0, 0.24]
        ], 24);

        // Anel ornamental de bronze da base
        this.geometryCache.baseRing = new THREE.TorusGeometry(0.355, 0.02, 10, 28);

        // Perfil Torneado do PEÃO (Guardião com colarinho e elmo ogival)
        this.geometryCache.pawnBody = makeLathe([
          [0.28, 0.22],
          [0.23, 0.34],
          [0.16, 0.52],
          [0.14, 0.64],
          [0.20, 0.68],
          [0.15, 0.72],
          [0.20, 0.84],
          [0.18, 0.96],
          [0.09, 1.05],
          [0.0, 1.09]
        ], 22);

        // Perfil Torneado da TORRE (Bastião Medieval Robusto)
        this.geometryCache.rookBody = makeLathe([
          [0.30, 0.22],
          [0.27, 0.36],
          [0.23, 0.68],
          [0.22, 0.84],
          [0.29, 0.92],
          [0.30, 1.06],
          [0.21, 1.06],
          [0.21, 0.98],
          [0.0, 0.98]
        ], 16);

        // Perfil Torneado do BISPO (Vestes Litúrgicas e Mitra Gótica)
        this.geometryCache.bishopBody = makeLathe([
          [0.29, 0.22],
          [0.24, 0.38],
          [0.16, 0.66],
          [0.14, 0.84],
          [0.20, 0.89],
          [0.16, 0.93],
          [0.22, 1.08],
          [0.19, 1.24],
          [0.08, 1.36],
          [0.0, 1.40]
        ], 24);

        // Perfil Torneado da RAINHA (Silhueta Soberana Elegante com Cálice)
        this.geometryCache.queenBody = makeLathe([
          [0.31, 0.22],
          [0.26, 0.38],
          [0.18, 0.68],
          [0.15, 0.92],
          [0.22, 0.98],
          [0.17, 1.03],
          [0.23, 1.20],
          [0.26, 1.34],
          [0.18, 1.32],
          [0.14, 1.40],
          [0.0, 1.43]
        ], 26);

        // Perfil Torneado do REI (Monarca Monumental de Ombros Largos)
        this.geometryCache.kingBody = makeLathe([
          [0.33, 0.22],
          [0.28, 0.40],
          [0.20, 0.74],
          [0.18, 0.98],
          [0.25, 1.05],
          [0.20, 1.11],
          [0.25, 1.28],
          [0.28, 1.42],
          [0.19, 1.42],
          [0.16, 1.50],
          [0.0, 1.52]
        ], 24);

        // Escultura Anatômica do CAVALO (Extrusão com Chanfro do Perfil Equino)
        const horseShape = new THREE.Shape();
        horseShape.moveTo(-0.18, 0.22);
        horseShape.lineTo(0.18, 0.22);
        horseShape.bezierCurveTo(0.24, 0.38, 0.21, 0.56, 0.14, 0.72); // Peito forte
        horseShape.lineTo(0.27, 0.67); // Queixo inferior
        horseShape.lineTo(0.35, 0.73); // Focinho
        horseShape.lineTo(0.33, 0.83); // Chanfro nasal
        horseShape.lineTo(0.17, 0.96); // Fronte
        horseShape.lineTo(0.13, 1.14); // Orelha alerta
        horseShape.lineTo(0.03, 1.03); // Nuca
        horseShape.bezierCurveTo(-0.18, 0.96, -0.26, 0.68, -0.21, 0.40); // Dorso arqueado
        horseShape.closePath();

        const extrudeSettings = {
          steps: 1,
          depth: 0.18,
          bevelEnabled: true,
          bevelThickness: 0.055,
          bevelSize: 0.045,
          bevelSegments: 4
        };
        const knightGeo = new THREE.ExtrudeGeometry(horseShape, extrudeSettings);
        knightGeo.center();
        knightGeo.computeVertexNormals();
        this.geometryCache.knightHead = knightGeo;
      }

      createPieceMesh(type, color) {
        const root = new THREE.Group();
        const mainMat = this.materials[color];
        const bronzeMat = this.materials.bronze;

        // 1. Base / Pedestal Torneado
        const pedestal = new THREE.Mesh(this.geometryCache.pedestal, mainMat);
        pedestal.castShadow = true;
        pedestal.receiveShadow = true;
        root.add(pedestal);

        // Anel de Bronze na Base
        const baseRing = new THREE.Mesh(this.geometryCache.baseRing, bronzeMat);
        baseRing.rotation.x = Math.PI / 2;
        baseRing.position.y = 0.135;
        root.add(baseRing);

        // 2. Escultura Específica de Cada Arquétipo
        if (type === 'p') {
          // PEÃO: Guardião Medieval com colar de bronze e escudo frontal esculpido
          const body = new THREE.Mesh(this.geometryCache.pawnBody, mainMat);
          body.castShadow = true;
          body.receiveShadow = true;
          root.add(body);

          const collar = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 8, 22), bronzeMat);
          collar.rotation.x = Math.PI / 2;
          collar.position.y = 0.68;
          root.add(collar);

          // Escudo Tático Frontal em Bronze
          const dirZ = color === 'w' ? -1 : 1;
          const shield = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.04), bronzeMat);
          shield.position.set(0, 0.50, dirZ * 0.17);
          shield.rotation.x = dirZ * -0.12;
          shield.castShadow = true;
          root.add(shield);

        } else if (type === 'r') {
          // TORRE: Fortaleza Monolítica com 6 Ameias, Contrafortes e Anel de Bronze
          const body = new THREE.Mesh(this.geometryCache.rookBody, mainMat);
          body.castShadow = true;
          body.receiveShadow = true;
          root.add(body);

          const towerRing = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.02, 8, 24), bronzeMat);
          towerRing.rotation.x = Math.PI / 2;
          towerRing.position.y = 0.88;
          root.add(towerRing);

          // 4 Contrafortes verticais + 6 Ameias superiores
          for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.08), mainMat);
            buttress.position.set(Math.cos(ang) * 0.22, 0.54, Math.sin(ang) * 0.22);
            buttress.rotation.y = -ang;
            buttress.castShadow = true;
            root.add(buttress);
          }

          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const crenel = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.09), mainMat);
            crenel.position.set(Math.cos(angle) * 0.245, 1.12, Math.sin(angle) * 0.245);
            crenel.rotation.y = -angle;
            crenel.castShadow = true;
            root.add(crenel);
          }

        } else if (type === 'n') {
          // CAVALO: Escultura Equina Anatômica com Crina em Placas de Bronze e Peitoral
          const knightGroup = new THREE.Group();

          const horseMesh = new THREE.Mesh(this.geometryCache.knightHead, mainMat);
          horseMesh.position.y = 0.68;
          horseMesh.castShadow = true;
          horseMesh.receiveShadow = true;
          knightGroup.add(horseMesh);

          // Crina Esculpida em Gomos de Bronze ao longo do dorso
          const manePositions = [
            [-0.14, 0.98, 0.25],
            [-0.19, 0.84, 0.10],
            [-0.21, 0.69, -0.05],
            [-0.19, 0.54, -0.15]
          ];
          manePositions.forEach(([mx, my, rotZ]) => {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.07), bronzeMat);
            plate.position.set(mx, my, 0);
            plate.rotation.z = rotZ;
            plate.castShadow = true;
            knightGroup.add(plate);
          });

          // Olhos em Bronze Brilhante
          const eyeGeo = new THREE.SphereGeometry(0.024, 8, 8);
          const eyeL = new THREE.Mesh(eyeGeo, bronzeMat);
          eyeL.position.set(0.15, 0.92, 0.11);
          const eyeR = new THREE.Mesh(eyeGeo, bronzeMat);
          eyeR.position.set(0.15, 0.92, -0.11);
          knightGroup.add(eyeL, eyeR);

          // Orientar o Cavalo para olhar na direção do exército adversário
          // No shape 2D original, o focinho aponta para +X.
          // Rotacionando +90° (PI/2) em Y, +X passa a apontar para -Z (frente das Brancas)
          knightGroup.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2;
          root.add(knightGroup);

        } else if (type === 'b') {
          // BISPO: Mitra Cerimonial Entalhada, Estola Vertical e Orbe Sagrado
          const body = new THREE.Mesh(this.geometryCache.bishopBody, mainMat);
          body.castShadow = true;
          body.receiveShadow = true;
          root.add(body);

          const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 10, 24), bronzeMat);
          collar.rotation.x = Math.PI / 2;
          collar.position.y = 0.89;
          root.add(collar);

          // Faixa / Estola Cerimonial em Bronze
          const dirZ = color === 'w' ? -1 : 1;
          const stole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.03), bronzeMat);
          stole.position.set(0, 0.58, dirZ * 0.165);
          stole.rotation.x = dirZ * -0.12;
          root.add(stole);

          // Orbe e Pequena Cruz no Topo da Mitra
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 14), bronzeMat);
          orb.position.y = 1.43;
          root.add(orb);

        } else if (type === 'q') {
          // RAINHA: Escultura Soberana com Colar Imperial e Diadema de 8 Pontas e Pérolas
          const body = new THREE.Mesh(this.geometryCache.queenBody, mainMat);
          body.castShadow = true;
          body.receiveShadow = true;
          root.add(body);

          const waistRing = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.02, 10, 24), bronzeMat);
          waistRing.rotation.x = Math.PI / 2;
          waistRing.position.y = 0.98;
          root.add(waistRing);

          const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.024, 10, 26), bronzeMat);
          crownRing.rotation.x = Math.PI / 2;
          crownRing.position.y = 1.34;
          root.add(crownRing);

          // 8 Pontas de Coroa com Esferas no Ápice
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r = 0.215;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.15, 8), bronzeMat);
            spike.position.set(Math.cos(a) * r, 1.42, Math.sin(a) * r);
            root.add(spike);

            const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), bronzeMat);
            pearl.position.set(Math.cos(a) * r, 1.50, Math.sin(a) * r);
            root.add(pearl);
          }

        } else if (type === 'k') {
          // REI: Figura Monumental com Manto Canelado, Coroa Imperial e Cruz Real no Ápice
          const body = new THREE.Mesh(this.geometryCache.kingBody, mainMat);
          body.castShadow = true;
          body.receiveShadow = true;
          root.add(body);

          const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.025, 10, 26), bronzeMat);
          collarRing.rotation.x = Math.PI / 2;
          collarRing.position.y = 1.05;
          root.add(collarRing);

          const crownBand = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.028, 10, 26), bronzeMat);
          crownBand.rotation.x = Math.PI / 2;
          crownBand.position.y = 1.42;
          root.add(crownBand);

          // Florões da Coroa Real
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const jewel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.04), bronzeMat);
            jewel.position.set(Math.cos(a) * 0.245, 1.48, Math.sin(a) * 0.245);
            jewel.rotation.y = -a;
            root.add(jewel);
          }

          // Orbe Imperial + Cruz Patonce Monumental no Topo
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), bronzeMat);
          orb.position.y = 1.56;
          root.add(orb);

          const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.25, 0.055), bronzeMat);
          crossV.position.y = 1.70;
          crossV.castShadow = true;
          root.add(crossV);

          const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.055, 0.055), bronzeMat);
          crossH.position.y = 1.72;
          crossH.castShadow = true;
          root.add(crossH);
        }

        return root;
      }
    }

    /**
     * ============================================================================
     * MÓDULO 5: APLICAÇÃO PRINCIPAL (ORQUESTRADOR 3D, FÍSICA, VOZ E REGRAS)
     * ============================================================================
     */

export { ArcanePieceSculptor };
