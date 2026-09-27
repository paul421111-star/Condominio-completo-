/**
 * Carregador BIM dos GLB reais do Parque Firenze.
 *
 * Os GLB vêm com milhares de malhas pequenas (Firenze_Pares tem ~16 mil, com
 * mobília de todos os 224 apartamentos). Desenhar isso para 45 torres gera
 * ~20 mil draw calls por frame. Aqui as malhas são fundidas por
 * (material, pavimento) e cada lote é desenhado uma vez para todas as torres
 * via InstancedMesh. O interior só aparece no pavimento cortado da torre
 * selecionada.
 *
 * Instâncias ocultas são removidas do lote (count reduzido), não escaladas a
 * zero: escala zero ainda processa todos os vértices na GPU.
 */

const GLB_INTERIOR_MATERIALS = new Set([
    'Parede_interna', 'Madeira_piso', 'Porcelanato', 'Madeira_porta', 'Madeira_clara',
    'Bancada_escura', 'Sombra', 'Inox', 'Ceramica', 'Fogao', 'Louca_branca', 'Tecido_claro',
    'Tapete', 'Sofa_azul', 'Roupa_cama', 'Roupa_cama_verde', 'Vaso', 'Planta',
    'Piso_madeira', 'Piso_porcelanato', 'Paredes_internas', 'Portas', 'Mobiliario',
    'Bancada', 'Louca'
]);

// Terreno próprio do GLB; a cena já tem terreno, então não é desenhado.
const GLB_SITE_MATERIALS = new Set(['Asfalto', 'Sinalizacao', 'Terra', 'Tronco', 'Verde', 'Verde_claro']);

// ~40% dos triângulos e só alguns pixels de longe: omitidos além de GLB_DETAIL_DISTANCE.
const GLB_DETAIL_MATERIALS = new Set(['Esquadria_escura', 'Esquadrias', 'Metal', 'Faixa']);
const GLB_DETAIL_DISTANCE = 180;

class GlbTowerLoader {
    constructor(host) {
        this.host = host;
        this.loader = new THREE.GLTFLoader();
        this.templates = { impares: null, pares: null };
        this.isLoaded = false;
        this.spawned = false;

        this.root = new THREE.Group();
        this.root.name = 'glb-instanced-root';
        this.root.visible = false;
        this.host.add(this.root);

        this.batches = [];
        this.pickers = [];
        this.towers = new Map();
        this.towersByParity = { par: [], impar: [] };
    }

    async loadTemplates(onProgress) {
        const loadGlb = (url, label) => new Promise((resolve) => {
            this.loader.load(
                url,
                (gltf) => resolve(gltf.scene),
                (xhr) => {
                    if (xhr.lengthComputable && onProgress) {
                        onProgress(label, (xhr.loaded / xhr.total) * 100);
                    }
                },
                (err) => {
                    console.warn(`[GLB Loader] Erro ao carregar ${url}:`, err);
                    resolve(null);
                }
            );
        });

        const [paresScene, imparesScene] = await Promise.all([
            loadGlb('public/models/Firenze_Pares.glb', 'Pares (28 Andares)'),
            loadGlb('public/models/Firenze_Impares.glb', 'Ímpares (36 Andares)')
        ]);

        if (paresScene) this.templates.pares = this.buildTemplate(paresScene);
        if (imparesScene) this.templates.impares = this.buildTemplate(imparesScene);

        this.isLoaded = !!(this.templates.pares || this.templates.impares);
        return this.isLoaded;
    }

    buildTemplate(scene) {
        const scaleFactor = 0.35;
        scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
        scene.updateMatrixWorld(true);

        const groups = new Map();
        const bounds = new THREE.Box3();
        const v = new THREE.Vector3();

        scene.traverse((mesh) => {
            if (!mesh.isMesh || !mesh.geometry || !mesh.material) return;
            const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            if (GLB_SITE_MATERIALS.has(material.name)) return;

            const interior = GLB_INTERIOR_MATERIALS.has(material.name);
            const floor = this._floorOf(mesh) || 0;
            const key = `${material.uuid}|${floor}`;
            if (!groups.has(key)) {
                groups.set(key, { material, floor, interior, parts: [] });
            }
            groups.get(key).parts.push(mesh);

            if (!interior) {
                const pos = mesh.geometry.attributes.position;
                for (let i = 0; i < pos.count; i += 8) {
                    bounds.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
                }
            }
        });

        const lots = [];
        groups.forEach((g) => {
            if (g.material.roughness !== undefined) {
                g.material.roughness = Math.max(g.material.roughness || 0.5, 0.4);
            }
            lots.push({
                geometry: this._merge(g.parts),
                material: g.material,
                floor: g.floor,
                interior: g.interior,
                detail: GLB_DETAIL_MATERIALS.has(g.material.name)
            });
        });

        return {
            lots,
            size: bounds.getSize(new THREE.Vector3()),
            center: bounds.getCenter(new THREE.Vector3())
        };
    }

    _merge(meshes) {
        let vertexCount = 0;
        let indexCount = 0;
        meshes.forEach((m) => {
            const g = m.geometry;
            vertexCount += g.attributes.position.count;
            indexCount += g.index ? g.index.count : g.attributes.position.count;
        });

        const positions = new Float32Array(vertexCount * 3);
        const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
        const v = new THREE.Vector3();
        let vOffset = 0;
        let iOffset = 0;

        meshes.forEach((m) => {
            const g = m.geometry;
            const pos = g.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
                positions[(vOffset + i) * 3] = v.x;
                positions[(vOffset + i) * 3 + 1] = v.y;
                positions[(vOffset + i) * 3 + 2] = v.z;
            }
            if (g.index) {
                for (let i = 0; i < g.index.count; i++) indices[iOffset + i] = g.index.getX(i) + vOffset;
                iOffset += g.index.count;
            } else {
                for (let i = 0; i < pos.count; i++) indices[iOffset + i] = vOffset + i;
                iOffset += pos.count;
            }
            vOffset += pos.count;
        });

        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setIndex(new THREE.BufferAttribute(indices, 1));
        merged.computeBoundingSphere();
        return merged;
    }

    ensureSpawned(placements) {
        if (this.spawned || !this.isLoaded) return;
        const isImpar = (p) => [13, 15, 17].includes(p.grupo);
        if (this.templates.pares) this._spawn(this.templates.pares, placements.filter((p) => !isImpar(p)), 'par');
        if (this.templates.impares) this._spawn(this.templates.impares, placements.filter(isImpar), 'impar');
        this.spawned = true;
    }

    setVisible(visible) {
        this.root.visible = visible;
    }

    _spawn(template, placements, parity) {
        placements.forEach((p) => {
            const key = `G${p.grupo}_BLOCO_${p.bloco}`;
            const grupo = PARQUE_FIRENZE_DATA.grupos[p.grupo];
            const floors = parity === 'impar' ? 36 : 28;
            const dummy = new THREE.Object3D();
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(0, p.rot || 0, 0);
            dummy.updateMatrix();

            const tower = {
                isGlbTower: true,
                isTower: true,
                towerKey: key,
                grupoId: p.grupo,
                bloco: p.bloco,
                parity,
                floors,
                andares: floors,
                name: `${grupo.nome} - Bloco ${p.bloco}`,
                address: grupo.endereco,
                tipologia: grupo.tipologia,
                aptosPorAndar: grupo.aptosPorAndar,
                aptosPorTorre: grupo.aptosPorTorre,
                metragem: grupo.metragemTipo,
                totalApartamentosGrupo: grupo.totalApartamentos,
                corDestaque: grupo.corDestaque,
                worldPos: new THREE.Vector3(p.x, p.y + 20, p.z),
                lodPos: new THREE.Vector3(p.x, p.y + template.size.y / 2, p.z),
                matrix: dummy.matrix.clone(),
                color: new THREE.Color(0xffffff),
                sliceFloor: null,
                sliceMode: 'slice',
                far: true
            };
            this.towers.set(key, tower);
            this.towersByParity[parity].push(tower);
        });

        template.lots.forEach((lot) => {
            const inst = new THREE.InstancedMesh(lot.geometry, lot.material, placements.length);
            inst.castShadow = false;
            inst.receiveShadow = false;
            inst.frustumCulled = false;
            inst.userData = { floor: lot.floor, interior: lot.interior, detail: lot.detail, parity };
            inst.setColorAt(0, new THREE.Color(0xffffff));
            this.root.add(inst);
            this.batches.push(inst);
            this._rebuildBatch(inst);
        });

        const geo = new THREE.BoxGeometry(
            Math.max(template.size.x, 1),
            Math.max(template.size.y, 1),
            Math.max(template.size.z, 1)
        );
        const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
        placements.forEach((p) => {
            const picker = new THREE.Mesh(geo, mat);
            picker.rotation.y = p.rot || 0;
            const offset = template.center.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rot || 0);
            picker.position.set(p.x, p.y, p.z).add(offset);
            picker.userData = this.towers.get(`G${p.grupo}_BLOCO_${p.bloco}`);
            this.root.add(picker);
            this.pickers.push(picker);
        });
    }

    _floorOf(object) {
        let node = object;
        while (node) {
            const match = (node.name || '').match(/PAVIMENTO_(\d+)/i);
            if (match) return parseInt(match[1], 10);
            node = node.parent;
        }
        return null;
    }

    _shows(batch, tower) {
        const { floor, interior, detail } = batch.userData;
        const target = tower.sliceFloor;
        if (interior) return target !== null && floor === target;
        if (detail && tower.far) return false;
        if (target === null) return true;
        if (tower.sliceMode === 'isolate_only') return floor === target || floor === 0;
        return floor <= target;
    }

    _rebuildBatch(batch) {
        let n = 0;
        this.towersByParity[batch.userData.parity].forEach((tower) => {
            if (!this._shows(batch, tower)) return;
            batch.setMatrixAt(n, tower.matrix);
            batch.setColorAt(n, tower.color);
            n++;
        });
        batch.count = n;
        batch.visible = n > 0;
        batch.instanceMatrix.needsUpdate = true;
        if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    }

    _rebuildParity(parity) {
        this.batches.forEach((batch) => {
            if (batch.userData.parity === parity) this._rebuildBatch(batch);
        });
    }

    updateLod(cameraPosition) {
        if (!this.spawned || !this.root.visible) return;
        const dirty = new Set();
        this.towers.forEach((tower) => {
            const far = tower.lodPos.distanceTo(cameraPosition) > GLB_DETAIL_DISTANCE;
            if (far !== tower.far) {
                tower.far = far;
                dirty.add(tower.parity);
            }
        });
        dirty.forEach((parity) => {
            this.batches.forEach((batch) => {
                if (batch.userData.parity === parity && batch.userData.detail) this._rebuildBatch(batch);
            });
        });
    }

    isolateFloor(towerKey, floorNumber, mode = 'slice') {
        const tower = this.towers.get(towerKey);
        if (!tower) return;
        tower.sliceFloor = parseInt(floorNumber, 10);
        tower.sliceMode = mode;
        this._rebuildParity(tower.parity);
    }

    isolateUnit(towerKey) {
        this.resetTowerVisibility(towerKey);
    }

    resetTowerVisibility(towerKey) {
        const tower = this.towers.get(towerKey);
        if (!tower) return;
        tower.sliceFloor = null;
        this._rebuildParity(tower.parity);
    }

    applyWorkStatusHeatmap(enabled) {
        if (!this.spawned) return;
        this.towers.forEach((tower) => {
            const grupo = PARQUE_FIRENZE_DATA.grupos[tower.grupoId];
            if (!grupo) return;
            const pct = grupo.statusObra.progressoGeral;
            let hex = 0xffffff;
            if (enabled) {
                if (pct < 60) hex = 0xef4444;
                else if (pct < 85) hex = 0xf59e0b;
                else if (pct < 100) hex = 0x84cc16;
                else hex = 0x10b981;
            }
            tower.color.setHex(hex);
        });
        this._rebuildParity('par');
        this._rebuildParity('impar');
    }
}
