/**
 * Terreno, vias, represas e portarias do Parque Firenze a partir de SITE_LAYOUT.
 *
 * Camadas empilhadas com pequenos desníveis para não brigarem no depth buffer:
 * base da maquete < gramado < mata/terra < água < asfalto < canteiro/faixas.
 */

const TERRAIN_Y = {
    table: -0.6,
    grass: 0,
    forestFloor: 0.25,
    soil: 0.25,
    water: 0.35,
    road: 0.5,
    marking: 0.62,
    median: 0.9
};

class TerrainBuilder {
    constructor(scene) {
        this.scene = scene;
        this.materials = this.initMaterials();
    }

    initMaterials() {
        const laneCanvas = document.createElement('canvas');
        laneCanvas.width = 64;
        laneCanvas.height = 256;
        const lctx = laneCanvas.getContext('2d');
        lctx.fillStyle = '#2b2d31';
        lctx.fillRect(0, 0, 64, 256);
        lctx.fillStyle = '#f8fafc';
        lctx.fillRect(2, 0, 3, 256);
        lctx.fillRect(59, 0, 3, 256);
        lctx.fillRect(30, 0, 4, 120);
        const laneTexture = new THREE.CanvasTexture(laneCanvas);
        laneTexture.wrapS = THREE.RepeatWrapping;
        laneTexture.wrapT = THREE.RepeatWrapping;
        laneTexture.anisotropy = 4;

        return {
            table: new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.95 }),
            tableTrim: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 }),
            lawn: new THREE.MeshStandardMaterial({ color: 0x7fae5a, roughness: 0.9 }),
            forestFloor: new THREE.MeshStandardMaterial({ color: 0x3f6b33, roughness: 0.95 }),
            soil: new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.95 }),
            water: new THREE.MeshStandardMaterial({ color: 0x3b7fb8, roughness: 0.15, metalness: 0.35 }),
            waterEdge: new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 }),
            asphalt: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.85 }),
            lane: new THREE.MeshStandardMaterial({ map: laneTexture, roughness: 0.8 }),
            medianGrass: new THREE.MeshStandardMaterial({ color: 0x5f9a45, roughness: 0.9 }),
            curb: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.7 }),
            cooper: new THREE.MeshStandardMaterial({ color: 0xb4532a, roughness: 0.85 }),
            sidewalk: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 }),
            plateau: new THREE.MeshStandardMaterial({ color: 0xc7ccd4, roughness: 0.85 }),
            plateauWall: new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 }),
            barrier: new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.8 })
        };
    }

    buildAll() {
        const group = new THREE.Group();
        group.name = 'terrain';

        this.buildTable(group);
        this.buildPolygon(group, SITE_LAYOUT.boundary, this.materials.lawn, TERRAIN_Y.grass);
        SITE_LAYOUT.forests.forEach((f) => this.buildPolygon(group, f, this.materials.forestFloor, TERRAIN_Y.forestFloor));
        SITE_LAYOUT.soilLots.forEach((s) => this.buildPolygon(group, s, this.materials.soil, TERRAIN_Y.soil));
        this.buildLakes(group);
        this.buildPlateaus(group);
        this.buildRoads(group);
        this.buildRoundabouts(group);
        this.buildGates(group);

        this.scene.add(group);
        return group;
    }

    buildTable(group) {
        const all = [
            ...SITE_LAYOUT.boundary,
            ...Object.values(SITE_LAYOUT.roads).flat()
        ];
        const b = SiteGeo.polygonBounds(all);
        const margin = 30;
        const w = b.maxX - b.minX + margin * 2;
        const l = b.maxZ - b.minZ + margin * 2;
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;

        const top = new THREE.Mesh(new THREE.BoxGeometry(w, 4, l), this.materials.table);
        top.position.set(cx, TERRAIN_Y.table - 2, cz);
        top.receiveShadow = true;
        group.add(top);

        const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 8, 14, l + 8), this.materials.tableTrim);
        trim.position.set(cx, TERRAIN_Y.table - 11, cz);
        group.add(trim);
    }

    buildPolygon(group, poly, material, y) {
        const geo = new THREE.ShapeGeometry(SiteGeo.shapeFromPolygon(poly));
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.y = y;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }

    buildLakes(group) {
        SITE_LAYOUT.lakes.forEach((lake) => {
            const edge = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.materials.waterEdge);
            edge.rotation.x = -Math.PI / 2;
            edge.scale.set(lake.rx + 3, lake.rz + 3, 1);
            const edgeHolder = new THREE.Group();
            edgeHolder.position.set(lake.x, TERRAIN_Y.water - 0.05, lake.z);
            edgeHolder.rotation.y = lake.rot;
            edgeHolder.add(edge);
            group.add(edgeHolder);

            const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.materials.water);
            water.rotation.x = -Math.PI / 2;
            water.scale.set(lake.rx, lake.rz, 1);
            const holder = new THREE.Group();
            holder.position.set(lake.x, TERRAIN_Y.water, lake.z);
            holder.rotation.y = lake.rot;
            holder.add(water);
            group.add(holder);
        });
    }

    buildPlateaus(group) {
        const h = SITE_LAYOUT.plateauTop;
        Object.keys(SITE_LAYOUT.groups).forEach((id) => {
            const r = SITE_LAYOUT.plateauRect(id);
            const slab = new THREE.Mesh(new THREE.BoxGeometry(r.w, h, r.l), this.materials.plateau);
            slab.position.set(r.x, h / 2, r.z);
            slab.receiveShadow = true;
            group.add(slab);

            const wall = new THREE.Mesh(new THREE.BoxGeometry(r.w + 2, 1.6, r.l + 2), this.materials.plateauWall);
            wall.position.set(r.x, 0.5, r.z);
            group.add(wall);
        });
    }

    // Faixa plana que acompanha a curva, deslocada `offset` para o lado sul/direito da via.
    ribbon(samples, width, offset, y, material, vRepeatLength = 0) {
        const positions = [];
        const uvs = [];
        const indices = [];
        let dist = 0;
        samples.forEach((s, i) => {
            if (i > 0) dist += Math.hypot(s.x - samples[i - 1].x, s.z - samples[i - 1].z);
            const cx = s.x + s.nx * offset;
            const cz = s.z + s.nz * offset;
            const hw = width / 2;
            positions.push(cx - s.nx * hw, y, cz - s.nz * hw, cx + s.nx * hw, y, cz + s.nz * hw);
            const v = vRepeatLength ? dist / vRepeatLength : 0;
            uvs.push(0, v, 1, v);
            if (i > 0) {
                const a = (i - 1) * 2;
                indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, material);
        mesh.receiveShadow = true;
        return mesh;
    }

    buildRoads(group) {
        const R = SITE_LAYOUT.roads;
        const m = this.materials;
        this.samples = {};
        Object.entries(R).forEach(([name, path]) => {
            this.samples[name] = SiteGeo.samplePath(path, 4);
        });

        // Avenida principal: duas pistas, canteiro com palmeiras, pista de cooper e calçada.
        const av = this.samples.avenue;
        group.add(this.ribbon(av, 22, 0, TERRAIN_Y.road, m.asphalt));
        group.add(this.ribbon(av, 8.5, -6.5, TERRAIN_Y.marking, m.lane, 24));
        group.add(this.ribbon(av, 8.5, 6.5, TERRAIN_Y.marking, m.lane, 24));
        group.add(this.ribbon(av, 4.4, 0, TERRAIN_Y.median - 0.1, m.curb));
        group.add(this.ribbon(av, 3.6, 0, TERRAIN_Y.median, m.medianGrass));
        group.add(this.ribbon(av, 3.2, 14.5, TERRAIN_Y.marking, m.cooper));
        group.add(this.ribbon(av, 3, -13.5, TERRAIN_Y.marking, m.sidewalk));

        group.add(this.ribbon(this.samples.northLoop, 12, 0, TERRAIN_Y.road, m.lane, 24));
        group.add(this.ribbon(this.samples.northLoop, 2.6, 8, TERRAIN_Y.marking, m.cooper));
        group.add(this.ribbon(this.samples.g13g15Access, 9, 0, TERRAIN_Y.road, m.lane, 24));
        group.add(this.ribbon(this.samples.portaria02, 12, 0, TERRAIN_Y.road, m.lane, 24));
        group.add(this.ribbon(this.samples.saoJudas, 12, 0, TERRAIN_Y.road, m.lane, 24));
        group.add(this.ribbon(this.samples.joaoPaulo, 16, 0, TERRAIN_Y.road, m.lane, 24));
        group.add(this.ribbon(this.samples.joaoPauloLink, 20, 0, TERRAIN_Y.road, m.asphalt));
        this.buildViaduct(group);

        // BR-116: duas pistas de três faixas com barreira central.
        const br = this.samples.br116;
        group.add(this.ribbon(br, 40, 0, TERRAIN_Y.road, m.asphalt));
        group.add(this.ribbon(br, 17, -10.5, TERRAIN_Y.marking, m.lane, 30));
        group.add(this.ribbon(br, 17, 10.5, TERRAIN_Y.marking, m.lane, 30));
        group.add(this.ribbon(br, 1.2, 0, TERRAIN_Y.median, m.barrier));
    }

    buildViaduct(group) {
        const { from, to, height } = SITE_LAYOUT.viaduct;
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const len = Math.hypot(dx, dz);
        const rotY = Math.atan2(dx, dz);
        const segments = 24;
        const segLen = len / segments;
        // Rampa suave nas pontas (25% do comprimento de cada lado) e tabuleiro plano no meio.
        const profile = (t) => {
            const r = Math.min(1, Math.min(t, 1 - t) / 0.25);
            return TERRAIN_Y.road + height * r * r * (3 - 2 * r);
        };

        for (let i = 0; i < segments; i++) {
            const t0 = i / segments;
            const t1 = (i + 1) / segments;
            const y0 = profile(t0);
            const y1 = profile(t1);
            const seg = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, Math.hypot(segLen, y1 - y0) + 0.05), this.materials.lane);
            const tm = (t0 + t1) / 2;
            seg.position.set(from.x + dx * tm, (y0 + y1) / 2 - 0.4, from.z + dz * tm);
            seg.rotation.order = 'YXZ';
            seg.rotation.y = rotY;
            seg.rotation.x = -Math.atan2(y1 - y0, segLen);
            seg.castShadow = true;
            seg.receiveShadow = true;
            group.add(seg);

            if (i % 3 === 1 && y0 > 3) {
                const pier = new THREE.Mesh(new THREE.BoxGeometry(10, y0 - 0.8, 1.6), this.materials.barrier);
                pier.position.set(from.x + dx * tm, (y0 - 0.8) / 2, from.z + dz * tm);
                pier.rotation.y = rotY;
                group.add(pier);
            }
        }
    }

    buildRoundabouts(group) {
        SITE_LAYOUT.roundabouts.forEach((rb) => {
            const ring = new THREE.Mesh(new THREE.RingGeometry(9, 21, 40), this.materials.asphalt);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(rb.x, TERRAIN_Y.marking + 0.02, rb.z);
            ring.receiveShadow = true;
            group.add(ring);

            const curb = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 1.0, 40), this.materials.curb);
            curb.position.set(rb.x, TERRAIN_Y.median - 0.2, rb.z);
            group.add(curb);

            const island = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 8.8, 1.1, 40), this.materials.medianGrass);
            island.position.set(rb.x, TERRAIN_Y.median, rb.z);
            island.receiveShadow = true;
            group.add(island);
        });
    }

    buildGates(group) {
        SITE_LAYOUT.gates.forEach((g) => {
            const samples = this.samples[g.road];
            const s = samples[Math.round(g.at * (samples.length - 1))];
            this.createGateStructure(group, g.x, TERRAIN_Y.road, g.z, Math.atan2(s.tx, s.tz), g.title);
        });
    }

    createGateStructure(group, x, y, z, rotY, title) {
        const gateGroup = new THREE.Group();
        gateGroup.position.set(x, y, z);
        gateGroup.rotation.y = rotY;

        const boothMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        [-8, 0, 8].forEach((bx) => {
            const booth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.4, 5), boothMat);
            booth.position.set(bx, 1.7, 0);
            booth.castShadow = true;
            gateGroup.add(booth);
        });

        const canopy = new THREE.Mesh(
            new THREE.BoxGeometry(26, 0.8, 12),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.3 })
        );
        canopy.position.set(0, 5.2, 0);
        canopy.castShadow = true;
        gateGroup.add(canopy);

        const barMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
        [-4, 4].forEach((bx) => {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, 0.18), barMat);
            bar.position.set(bx, 1.0, 3);
            gateGroup.add(bar);
        });

        const cv = document.createElement('canvas');
        cv.width = 512;
        cv.height = 64;
        const c = cv.getContext('2d');
        c.fillStyle = '#0f172a';
        c.fillRect(0, 0, 512, 64);
        c.fillStyle = '#38bdf8';
        c.font = 'bold 26px "Segoe UI", sans-serif';
        c.textAlign = 'center';
        c.fillText(title, 256, 42);
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(24, 3),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide })
        );
        sign.position.set(0, 6.4, 6.05);
        gateGroup.add(sign);

        group.add(gateGroup);
    }
}
