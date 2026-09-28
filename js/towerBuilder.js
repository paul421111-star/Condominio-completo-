/**
 * Construtor Tridimensional Procedural das Torres do Parque Firenze
 * Reproduz fielmente a arquitetura das torres CHVN com formato em cruz/trevo,
 * sacadas recuadas com guarda-corpos de vidro, embasamento e caixa de máquinas no topo.
 */

class TowerBuilder {
    constructor(scene) {
        this.scene = scene;
        this.materials = this.initMaterials();
        this.towers = [];
    }

    initMaterials() {
        // Textura procedural canvas para as fachadas com janelas e relevo
        const windowCanvas = document.createElement('canvas');
        windowCanvas.width = 128;
        windowCanvas.height = 256;
        const ctx = windowCanvas.getContext('2d');
        
        // Fundo da fachada em tom bege claro / off-white clássico da Vida Nova
        ctx.fillStyle = '#f0eee9';
        ctx.fillRect(0, 0, 128, 256);
        
        // Frisos verticais e janelas
        ctx.fillStyle = '#2c3e50';
        for (let y = 8; y < 250; y += 16) {
            // Janelas esquerdas
            ctx.fillRect(12, y, 22, 10);
            // Janelas centrais (varanda/portas)
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(48, y, 32, 12);
            // Janelas direitas
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(94, y, 22, 10);
            // Friso do piso
            ctx.fillStyle = '#d6d3cd';
            ctx.fillRect(0, y + 14, 128, 2);
        }

        const facadeTexture = new THREE.CanvasTexture(windowCanvas);
        facadeTexture.wrapS = THREE.RepeatWrapping;
        facadeTexture.wrapT = THREE.RepeatWrapping;
        facadeTexture.repeat.set(1, 4);

        // Textura noturna com janelas iluminadas
        const nightCanvas = document.createElement('canvas');
        nightCanvas.width = 128;
        nightCanvas.height = 256;
        const nCtx = nightCanvas.getContext('2d');
        nCtx.fillStyle = '#0f172a';
        nCtx.fillRect(0, 0, 128, 256);
        for (let y = 8; y < 250; y += 16) {
            // Algumas janelas acesas em tom âmbar quente aconchegante
            if (Math.random() > 0.35) {
                nCtx.fillStyle = Math.random() > 0.5 ? '#fef08a' : '#fde047';
                nCtx.fillRect(12, y, 22, 10);
            }
            if (Math.random() > 0.25) {
                nCtx.fillStyle = '#ffedd5';
                nCtx.fillRect(48, y, 32, 12);
            }
            if (Math.random() > 0.4) {
                nCtx.fillStyle = '#fef08a';
                nCtx.fillRect(94, y, 22, 10);
            }
        }
        const nightTexture = new THREE.CanvasTexture(nightCanvas);
        nightTexture.wrapS = THREE.RepeatWrapping;
        nightTexture.wrapT = THREE.RepeatWrapping;
        nightTexture.repeat.set(1, 4);

        return {
            facadeMain: new THREE.MeshStandardMaterial({
                color: 0xf3f1ec,
                roughness: 0.65,
                metalness: 0.1,
                map: facadeTexture
            }),
            facadeAccent: new THREE.MeshStandardMaterial({
                color: 0x475569, // Frisos cinza chumbo
                roughness: 0.5,
                metalness: 0.2
            }),
            facadeWhite: new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.6,
                metalness: 0.05
            }),
            glassBalcony: new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                metalness: 0.3,
                roughness: 0.1,
                transparent: true,
                opacity: 0.65
            }),
            concretePodium: new THREE.MeshStandardMaterial({
                color: 0x64748b,
                roughness: 0.85
            }),
            roofTech: new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.7
            }),
            beaconRed: new THREE.MeshBasicMaterial({
                color: 0xff0040
            }),
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0xfacc15,
                emissive: 0xeab308,
                emissiveIntensity: 0.5,
                roughness: 0.3
            }),
            nightTexture: nightTexture,
            dayTexture: facadeTexture
        };
    }

    setLightingMode(isNight) {
        if (isNight) {
            this.materials.facadeMain.emissive = new THREE.Color(0xfef08a);
            this.materials.facadeMain.emissiveMap = this.materials.nightTexture;
            this.materials.facadeMain.emissiveIntensity = 0.85;
            this.materials.beaconRed.color = new THREE.Color(0xff0033);
        } else {
            this.materials.facadeMain.emissive = new THREE.Color(0x000000);
            this.materials.facadeMain.emissiveMap = null;
            this.materials.facadeMain.emissiveIntensity = 0;
            this.materials.beaconRed.color = new THREE.Color(0x990022);
        }
        this.materials.facadeMain.needsUpdate = true;
    }

    /**
     * Constrói uma torre com geometria detalhada em formato cruzado
     */
    createTower(grupoId, bloco, x, y, z, rotationY = 0) {
        const grupo = PARQUE_FIRENZE_DATA.grupos[grupoId];
        const is3Dorm = grupo.andaresPorTorre === 36;
        const andares = grupo.andaresPorTorre;
        
        // Escala arquitetônica
        // 36 andares: ~32 unidades ThreeJS de altura
        // 28 andares: ~25 unidades ThreeJS de altura
        const floorHeight = 0.85;
        const towerHeight = andares * floorHeight;
        
        const towerGroup = new THREE.Group();
        towerGroup.position.set(x, y, z);
        towerGroup.rotation.y = rotationY;

        // Dimensões do bloco cruciforme
        const coreSize = is3Dorm ? 12 : 11;
        const wingLength = is3Dorm ? 9.5 : 8.5;
        const wingWidth = is3Dorm ? 11.5 : 10.5;

        // 1. Núcleo central (elevadores, escadas e hall social)
        const coreGeo = new THREE.BoxGeometry(coreSize, towerHeight, coreSize);
        const coreMesh = new THREE.Mesh(coreGeo, this.materials.facadeMain);
        coreMesh.position.y = towerHeight / 2;
        coreMesh.castShadow = true;
        coreMesh.receiveShadow = true;
        coreMesh.userData.bodyHeight = towerHeight;
        towerGroup.add(coreMesh);

        // 2. Quatro asas (Wings) formando a clássica cruz dos prédios Vida Nova
        const wingGeoX = new THREE.BoxGeometry(wingLength * 2 + coreSize, towerHeight, wingWidth);
        const wingMeshX = new THREE.Mesh(wingGeoX, this.materials.facadeMain);
        wingMeshX.position.y = towerHeight / 2;
        wingMeshX.castShadow = true;
        wingMeshX.receiveShadow = true;
        wingMeshX.userData.bodyHeight = towerHeight;
        towerGroup.add(wingMeshX);

        const wingGeoZ = new THREE.BoxGeometry(wingWidth, towerHeight, wingLength * 2 + coreSize);
        const wingMeshZ = new THREE.Mesh(wingGeoZ, this.materials.facadeMain);
        wingMeshZ.position.y = towerHeight / 2;
        wingMeshZ.castShadow = true;
        wingMeshZ.receiveShadow = true;
        wingMeshZ.userData.bodyHeight = towerHeight;
        towerGroup.add(wingMeshZ);

        // 3. Frisos verticais contrastantes e varandas gourmet recuadas
        // Em cada canto e ponta da cruz
        const balconyWidth = is3Dorm ? 6.5 : 5.5;
        const balconyDepth = 1.4;
        const balconyThickness = 0.15;
        const railingHeight = 0.45;

        // Adiciona sacadas ao longo de toda a altura a cada andar
        const balconyGeo = new THREE.BoxGeometry(balconyWidth, balconyThickness, balconyDepth);
        const railingGeo = new THREE.BoxGeometry(balconyWidth, railingHeight, 0.08);

        // Instâncias ordenadas por andar (4 por pavimento): o fatiamento só ajusta `count`.
        const slabs = new THREE.InstancedMesh(balconyGeo, this.materials.facadeWhite, andares * 4);
        const rails = new THREE.InstancedMesh(railingGeo, this.materials.glassBalcony, andares * 4);
        const edge = wingLength + coreSize / 2;
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const p = new THREE.Vector3();
        const one = new THREE.Vector3(1, 1, 1);
        const up = THREE.Object3D.DefaultUp;
        const sides = [
            { dx: 0, dz: 1, rot: 0 },
            { dx: 0, dz: -1, rot: 0 },
            { dx: 1, dz: 0, rot: Math.PI / 2 },
            { dx: -1, dz: 0, rot: Math.PI / 2 }
        ];
        let i = 0;
        for (let f = 1; f <= andares; f++) {
            const floorY = f * floorHeight - floorHeight / 2;
            sides.forEach((s) => {
                q.setFromAxisAngle(up, s.rot);
                const slabOff = edge + balconyDepth / 2 - 0.2;
                const railOff = edge + balconyDepth - 0.2;
                slabs.setMatrixAt(i, m.compose(p.set(s.dx * slabOff, floorY, s.dz * slabOff), q, one));
                rails.setMatrixAt(i, m.compose(p.set(s.dx * railOff, floorY + railingHeight / 2, s.dz * railOff), q, one));
                i++;
            });
        }
        slabs.userData.perFloor = 4;
        rails.userData.perFloor = 4;
        towerGroup.add(slabs, rails);

        // 4. Frisos de canto em cinza chumbo (destaque vertical das torres Vida Nova)
        const cornerPillarGeo = new THREE.BoxGeometry(0.8, towerHeight, 0.8);
        const offsets = [
            { x: coreSize / 2, z: coreSize / 2 },
            { x: -coreSize / 2, z: coreSize / 2 },
            { x: coreSize / 2, z: -coreSize / 2 },
            { x: -coreSize / 2, z: -coreSize / 2 }
        ];
        offsets.forEach(off => {
            const pillar = new THREE.Mesh(cornerPillarGeo, this.materials.facadeAccent);
            pillar.position.set(off.x, towerHeight / 2, off.z);
            pillar.userData.bodyHeight = towerHeight;
            towerGroup.add(pillar);
        });

        // 5. Pavimento Duplex / Cobertura e Caixa de Máquinas (Topo característico)
        const roofBaseGeo = new THREE.BoxGeometry(coreSize * 1.2, 1.2, coreSize * 1.2);
        const roofBase = new THREE.Mesh(roofBaseGeo, this.materials.facadeAccent);
        roofBase.position.y = towerHeight + 0.6;
        roofBase.castShadow = true;
        roofBase.userData.roof = true;
        towerGroup.add(roofBase);

        // Barrilete e Casa de Máquinas dos Elevadores
        const machineRoomGeo = new THREE.BoxGeometry(coreSize * 0.75, 3.2, coreSize * 0.75);
        const machineRoom = new THREE.Mesh(machineRoomGeo, this.materials.roofTech);
        machineRoom.position.y = towerHeight + 1.2 + 1.6;
        machineRoom.castShadow = true;
        machineRoom.userData.roof = true;
        towerGroup.add(machineRoom);

        // Caixa d'água superior com reservatório duplo
        const waterTankGeo = new THREE.BoxGeometry(coreSize * 0.5, 2.0, coreSize * 0.5);
        const waterTank = new THREE.Mesh(waterTankGeo, this.materials.facadeWhite);
        waterTank.position.y = towerHeight + 4.4 + 1.0;
        waterTank.userData.roof = true;
        towerGroup.add(waterTank);

        // Luz de sinalização aérea no topo (Sinalizador noturno vermelho de segurança da ANAC)
        const beaconGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const beacon = new THREE.Mesh(beaconGeo, this.materials.beaconRed);
        beacon.position.y = towerHeight + 6.6;
        beacon.userData.roof = true;
        towerGroup.add(beacon);

        // 6. Base da Torre / Embasamento (Térreo com Hall Social + Entrada Garagem)
        const podiumHeight = 2.4;
        const podiumGeo = new THREE.BoxGeometry(wingLength * 2 + coreSize + 4, podiumHeight, wingLength * 2 + coreSize + 4);
        const podium = new THREE.Mesh(podiumGeo, this.materials.concretePodium);
        podium.position.y = podiumHeight / 2;
        podium.receiveShadow = true;
        podium.castShadow = true;
        towerGroup.add(podium);

        // Marquesa / Cobertura da Entrada Social
        const canopyGeo = new THREE.BoxGeometry(6, 0.4, 4);
        const canopy = new THREE.Mesh(canopyGeo, this.materials.facadeAccent);
        canopy.position.set(0, podiumHeight + 0.2, wingLength + coreSize / 2 + 3);
        towerGroup.add(canopy);

        // Letreiro / Identificação do Bloco
        const tagCanvas = document.createElement('canvas');
        tagCanvas.width = 256;
        tagCanvas.height = 128;
        const tctx = tagCanvas.getContext('2d');
        tctx.fillStyle = '#0f172a';
        tctx.fillRect(0, 0, 256, 128);
        tctx.strokeStyle = grupo.corDestaque;
        tctx.lineWidth = 8;
        tctx.strokeRect(4, 4, 248, 120);
        tctx.fillStyle = '#ffffff';
        tctx.font = 'bold 36px "Segoe UI", sans-serif';
        tctx.textAlign = 'center';
        tctx.fillText(`GRUPO ${grupoId}`, 128, 52);
        tctx.fillStyle = grupo.corDestaque;
        tctx.font = 'bold 44px "Segoe UI", sans-serif';
        tctx.fillText(`BLOCO ${bloco}`, 128, 102);

        const tagTex = new THREE.CanvasTexture(tagCanvas);
        const tagGeo = new THREE.PlaneGeometry(3.2, 1.6);
        const tagMat = new THREE.MeshBasicMaterial({ map: tagTex, side: THREE.DoubleSide });
        const tagMesh = new THREE.Mesh(tagGeo, tagMat);
        tagMesh.position.set(0, podiumHeight + 1.2, wingLength + coreSize / 2 + 5.1);
        towerGroup.add(tagMesh);

        // Collider invisível simplificado para raycasting super rápido
        const colliderGeo = new THREE.BoxGeometry(
            wingLength * 2 + coreSize + 2,
            towerHeight + 8,
            wingLength * 2 + coreSize + 2
        );
        const colliderMat = new THREE.MeshBasicMaterial({
            visible: false
        });
        const collider = new THREE.Mesh(colliderGeo, colliderMat);
        collider.position.y = (towerHeight + 8) / 2;
        collider.userData = {
            isTower: true,
            grupoId: grupoId,
            bloco: bloco,
            towerGroup: towerGroup,
            name: `${grupo.nome} - Bloco ${bloco}`,
            andares: andares,
            tipologia: grupo.tipologia,
            aptosPorAndar: grupo.aptosPorAndar,
            aptosPorTorre: grupo.aptosPorTorre,
            metragem: grupo.metragemTipo,
            totalApartamentosGrupo: grupo.totalApartamentos,
            corDestaque: grupo.corDestaque,
            worldPos: new THREE.Vector3(x, y + towerHeight / 2, z)
        };
        towerGroup.add(collider);

        this.towers.push(collider);
        this.scene.add(towerGroup);

        return towerGroup;
    }
}
