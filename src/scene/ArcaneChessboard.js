import * as THREE from 'three';

class ArcaneChessboard {
  constructor(sculptor) {
    this.sculptor = sculptor;
    this.textures = sculptor.textures;
    this.geometries = [];
    this.materials = [];
  }

  createTileGeometry() {
    const shape = new THREE.Shape();
    const halfS = 0.45; // Base 0.90 x 0.90
    shape.moveTo(-halfS, -halfS);
    shape.lineTo(halfS, -halfS);
    shape.lineTo(halfS, halfS);
    shape.lineTo(-halfS, halfS);
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.022,
      bevelSegments: 2
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const topY = geo.boundingBox.max.y;
    // Ajusta o topo exato da face da casa para y = 0.08 (plano de apoio das peças)
    geo.translate(0, 0.08 - topY, 0);
    geo.computeVertexNormals();
    this.geometries.push(geo);
    return geo;
  }

  createCoordinateTexture(char) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);

    // Cartela metálica de bronze chanfrada
    const gradBg = ctx.createLinearGradient(0, 10, 0, 118);
    gradBg.addColorStop(0, 'rgba(42, 34, 24, 0.88)');
    gradBg.addColorStop(0.5, 'rgba(24, 20, 16, 0.92)');
    gradBg.addColorStop(1, 'rgba(15, 12, 10, 0.95)');
    ctx.fillStyle = gradBg;

    // Retângulo com cantos levemente arredondados
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(14 + r, 12);
    ctx.lineTo(114 - r, 12);
    ctx.quadraticCurveTo(114, 12, 114, 12 + r);
    ctx.lineTo(114, 116 - r);
    ctx.quadraticCurveTo(114, 116, 114 - r, 116);
    ctx.lineTo(14 + r, 116);
    ctx.quadraticCurveTo(14, 116, 14, 116 - r);
    ctx.lineTo(14, 12 + r);
    ctx.quadraticCurveTo(14, 12, 14 + r, 12);
    ctx.closePath();
    ctx.fill();

    // Borda em bronze polido com relevo de luz
    ctx.strokeStyle = 'rgba(212, 167, 106, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Tipografia clássica Cinzel gravada em ouro antigo com relevo
    ctx.font = 'bold 64px "Cinzel", "Cinzel Decorative", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Sombra entalhada profunda
    ctx.fillStyle = 'rgba(10, 8, 6, 0.95)';
    ctx.fillText(char, 64, 69);

    // Gradiente dourado celestial na face do caractere
    const gradText = ctx.createLinearGradient(0, 36, 0, 94);
    gradText.addColorStop(0, '#fef0c7');
    gradText.addColorStop(0.4, '#f5d78e');
    gradText.addColorStop(1, '#b88636');
    ctx.fillStyle = gradText;
    ctx.fillText(char, 64, 66);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  build(squareToWorld) {
    const boardGroup = new THREE.Group();
    const squareMeshes = new Map();
    const stoneBump = this.textures.stoneTileBump || this.textures.stoneBump;

    // 1. Materiais PBR de Alta Fidelidade para o Tabuleiro Físico
    const lightSquareMat = new THREE.MeshStandardMaterial({
      color: 0xede4d4,
      map: this.textures.ivoryTileColor || this.textures.ivoryColor,
      bumpMap: stoneBump,
      bumpScale: 0.007,
      roughness: 0.36,
      metalness: 0.04
    });
    this.materials.push(lightSquareMat);

    const darkSquareMat = new THREE.MeshStandardMaterial({
      color: 0x141822,
      map: this.textures.obsidianTileColor || this.textures.obsidianColor,
      bumpMap: stoneBump,
      bumpScale: 0.010,
      roughness: 0.30,
      metalness: 0.20
    });
    this.materials.push(darkSquareMat);

    const frameObsidianMat = new THREE.MeshStandardMaterial({
      color: 0x131720,
      map: this.textures.obsidianColor,
      bumpMap: stoneBump,
      bumpScale: 0.016,
      roughness: 0.42,
      metalness: 0.32
    });
    this.materials.push(frameObsidianMat);

    const basaltPlinthMat = new THREE.MeshStandardMaterial({
      color: 0x0f1117,
      bumpMap: stoneBump,
      bumpScale: 0.024,
      roughness: 0.72,
      metalness: 0.18
    });
    this.materials.push(basaltPlinthMat);

    // 2. Base Arquitetônica Escalonada (Altar Monolítico)
    // 2.1 Plinto Inferior de Granito/Basalto Chancelado
    const plinthGeo = new THREE.BoxGeometry(10.20, 0.36, 10.20);
    this.geometries.push(plinthGeo);
    const plinth = new THREE.Mesh(plinthGeo, basaltPlinthMat);
    plinth.position.y = -0.41;
    plinth.receiveShadow = true;
    boardGroup.add(plinth);

    // 2.2 Cornija Decorativa de Bronze Antigo
    const corniceGeo = new THREE.BoxGeometry(9.82, 0.06, 9.82);
    this.geometries.push(corniceGeo);
    const cornice = new THREE.Mesh(corniceGeo, this.sculptor.materials.bronze);
    cornice.position.y = -0.22;
    cornice.receiveShadow = true;
    boardGroup.add(cornice);

    // 2.3 Moldura Superior em Obsidiana Chanfrada (Face superior alinhada a y = 0.08)
    const frameGeo = new THREE.BoxGeometry(9.50, 0.30, 9.50);
    this.geometries.push(frameGeo);
    const outerFrame = new THREE.Mesh(frameGeo, frameObsidianMat);
    outerFrame.position.y = -0.07;
    outerFrame.receiveShadow = true;
    boardGroup.add(outerFrame);

    // 2.4 Leito Rebaixado de Argamassa / Bronze Oxidado sob as Casas (Sulcos visíveis entre casas)
    const groutGeo = new THREE.BoxGeometry(8.08, 0.14, 8.08);
    this.geometries.push(groutGeo);
    const groutBed = new THREE.Mesh(groutGeo, this.sculptor.materials.darkBronze);
    groutBed.position.y = -0.01;
    groutBed.receiveShadow = true;
    boardGroup.add(groutBed);

    // 2.5 Perímetro de Bronze / Bezel de Contenção das 64 Casas
    const curbLongGeo = new THREE.BoxGeometry(8.36, 0.14, 0.14);
    const curbSideGeo = new THREE.BoxGeometry(0.14, 0.14, 8.08);
    this.geometries.push(curbLongGeo, curbSideGeo);

    const curbNorth = new THREE.Mesh(curbLongGeo, this.sculptor.materials.bronze);
    curbNorth.position.set(0, 0.04, -4.07);
    curbNorth.receiveShadow = true;

    const curbSouth = new THREE.Mesh(curbLongGeo, this.sculptor.materials.bronze);
    curbSouth.position.set(0, 0.04, 4.07);
    curbSouth.receiveShadow = true;

    const curbWest = new THREE.Mesh(curbSideGeo, this.sculptor.materials.bronze);
    curbWest.position.set(-4.07, 0.04, 0);
    curbWest.receiveShadow = true;

    const curbEast = new THREE.Mesh(curbSideGeo, this.sculptor.materials.bronze);
    curbEast.position.set(4.07, 0.04, 0);
    curbEast.receiveShadow = true;

    boardGroup.add(curbNorth, curbSouth, curbWest, curbEast);

    // 2.6 Quatro Cantoneiras Esculpidas de Bronze com Domo e Rebites
    const cornerBaseGeo = new THREE.CylinderGeometry(0.32, 0.40, 0.34, 8);
    const domeGeo = new THREE.SphereGeometry(0.18, 14, 10);
    const rivetGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.04, 8);
    this.geometries.push(cornerBaseGeo, domeGeo, rivetGeo);

    const cornerCoords = [
      [-4.50, -4.50],
      [4.50, -4.50],
      [-4.50, 4.50],
      [4.50, 4.50]
    ];

    cornerCoords.forEach(([cx, cz]) => {
      const cornerGroup = new THREE.Group();
      cornerGroup.position.set(cx, -0.07, cz);

      const base = new THREE.Mesh(cornerBaseGeo, this.sculptor.materials.bronze);
      base.castShadow = true;
      base.receiveShadow = true;
      cornerGroup.add(base);

      const dome = new THREE.Mesh(domeGeo, this.sculptor.materials.bronze);
      dome.position.y = 0.17;
      dome.castShadow = true;
      cornerGroup.add(dome);

      // Rebites ornamentais em cruz
      [
        [0.24, 0],
        [-0.24, 0],
        [0, 0.24],
        [0, -0.24]
      ].forEach(([rx, rz]) => {
        const rivet = new THREE.Mesh(rivetGeo, this.sculptor.materials.bronze);
        rivet.position.set(rx, 0.16, rz);
        cornerGroup.add(rivet);
      });

      boardGroup.add(cornerGroup);
    });

    // 3. 64 Casas em Blocos de Pedra Chanfrados (ExtrudeGeometry Compartilhada)
    const squareGeo = this.createTileGeometry();
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sqName = `${files[f]}${r + 1}`;
        const isLight = (f + r) % 2 !== 0;
        const mesh = new THREE.Mesh(
          squareGeo,
          isLight ? lightSquareMat : darkSquareMat
        );

        const pos = squareToWorld(sqName);
        // A geometria já está centralizada com topo em y = 0.08
        mesh.position.set(pos.x, 0, pos.z);
        mesh.receiveShadow = true;
        mesh.userData = { square: sqName, isLight };

        boardGroup.add(mesh);
        squareMeshes.set(sqName, mesh);
      }
    }

    // 4. Coordenadas Algébricas Integradas (A-H e 1-8) em Cartelas Gravadas
    const coordPlaneGeo = new THREE.PlaneGeometry(0.42, 0.36);
    this.geometries.push(coordPlaneGeo);

    const letterFiles = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (let i = 0; i < 8; i++) {
      // Arquivos (A-H)
      const texF = this.createCoordinateTexture(letterFiles[i]);
      const matF = new THREE.MeshBasicMaterial({ map: texF, transparent: true });
      this.materials.push(matF);

      // Sul (Visão das Brancas)
      const planeFSouth = new THREE.Mesh(coordPlaneGeo, matF);
      planeFSouth.rotation.x = -Math.PI / 2;
      planeFSouth.position.set(i - 3.5, 0.082, 4.45);
      boardGroup.add(planeFSouth);

      // Norte (Visão das Pretas - Rotacionado para visualização correta)
      const planeFNorth = new THREE.Mesh(coordPlaneGeo, matF);
      planeFNorth.rotation.x = -Math.PI / 2;
      planeFNorth.rotation.z = Math.PI;
      planeFNorth.position.set(i - 3.5, 0.082, -4.45);
      boardGroup.add(planeFNorth);

      // Fileiras (1-8)
      const texR = this.createCoordinateTexture(String(i + 1));
      const matR = new THREE.MeshBasicMaterial({ map: texR, transparent: true });
      this.materials.push(matR);

      // Oeste (Lado A)
      const planeRWest = new THREE.Mesh(coordPlaneGeo, matR);
      planeRWest.rotation.x = -Math.PI / 2;
      planeRWest.rotation.z = Math.PI / 2;
      planeRWest.position.set(-4.45, 0.082, 3.5 - i);
      boardGroup.add(planeRWest);

      // Leste (Lado H)
      const planeREast = new THREE.Mesh(coordPlaneGeo, matR);
      planeREast.rotation.x = -Math.PI / 2;
      planeREast.rotation.z = -Math.PI / 2;
      planeREast.position.set(4.45, 0.082, 3.5 - i);
      boardGroup.add(planeREast);
    }

    // 5. Grupos de Destaque Tático (Seleção, Último Lance, Xeque)
    const highlightsGroup = new THREE.Group();
    boardGroup.add(highlightsGroup);

    const statusMarkersGroup = new THREE.Group();
    boardGroup.add(statusMarkersGroup);

    return {
      boardGroup,
      squareMeshes,
      highlightsGroup,
      statusMarkersGroup,
      lightSquareMat,
      darkSquareMat
    };
  }

  dispose() {
    this.geometries.forEach(geo => geo.dispose());
    this.materials.forEach(mat => mat.dispose());
    this.geometries = [];
    this.materials = [];
  }
}

export { ArcaneChessboard };
