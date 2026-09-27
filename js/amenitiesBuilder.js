/**
 * Lazer, paisagismo, iluminação e veículos do Parque Firenze.
 *
 * A vegetação segue a planta de implantação: mata densa apenas nas "Áreas
 * Verdes" e nos cinturões perimetrais; na avenida, palmeiras imperiais no
 * canteiro central e nas rotatórias. Tudo que se repete é InstancedMesh.
 */

class AmenitiesBuilder {
    constructor(scene) {
        this.scene = scene;
        this.streetLights = [];
        this.materials = this.initMaterials();
        this.rand = this.seededRandom(20240917);
    }

    seededRandom(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    initMaterials() {
        const courtCanvas = document.createElement('canvas');
        courtCanvas.width = 256;
        courtCanvas.height = 128;
        const cctx = courtCanvas.getContext('2d');
        cctx.fillStyle = '#15803d';
        cctx.fillRect(0, 0, 256, 128);
        cctx.fillStyle = '#0284c7';
        cctx.fillRect(20, 20, 40, 88);
        cctx.fillRect(196, 20, 40, 88);
        cctx.strokeStyle = '#ffffff';
        cctx.lineWidth = 3;
        cctx.strokeRect(10, 10, 236, 108);
        cctx.beginPath();
        cctx.moveTo(128, 10);
        cctx.lineTo(128, 118);
        cctx.stroke();
        cctx.beginPath();
        cctx.arc(128, 64, 30, 0, Math.PI * 2);
        cctx.stroke();

        return {
            poolWater: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.2 }),
            poolDeck: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 }),
            poolEdge: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
            court: new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(courtCanvas), roughness: 0.6 }),
            fence: new THREE.MeshBasicMaterial({ color: 0x64748b, wireframe: true }),
            canopy: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }),
            palmTrunk: new THREE.MeshStandardMaterial({ color: 0xb8ad9a, roughness: 0.8 }),
            palmFrond: new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.7, side: THREE.DoubleSide }),
            lampPost: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 }),
            lampBulb: new THREE.MeshBasicMaterial({ color: 0xfff7d6 }),
            carBody: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.35 }),
            carRoof: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 }),
            fountainStone: new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.6 }),
            fountainWater: new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }),
            market: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 }),
            marketSign: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 }),
            flagPole: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.7, roughness: 0.3 })
        };
    }

    buildAll() {
        const g = new THREE.Group();
        g.name = 'amenities';

        Object.keys(SITE_LAYOUT.groups).forEach((id) => {
            const p = SITE_LAYOUT.leisure(id);
            this.buildLeisureClub(g, p.x, SITE_LAYOUT.plateauTop, p.z, Number(id));
        });

        this.buildForest(g);
        this.buildPalms(g);
        this.buildFountains(g);
        this.buildRoundaboutFlags(g);
        this.buildMiniMarkets(g);
        this.buildStreetLighting(g);
        this.buildMiniatureCars(g);

        this.scene.add(g);
        return g;
    }

    buildLeisureClub(group, x, y, z, grupoId) {
        const club = new THREE.Group();
        club.position.set(x, y, z);
        club.scale.setScalar(0.8);
        club.userData.grupoId = grupoId;

        const deck = new THREE.Mesh(new THREE.BoxGeometry(32, 0.4, 22), this.materials.poolDeck);
        deck.position.y = 0.2;
        deck.receiveShadow = true;
        club.add(deck);

        const edge = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 12), this.materials.poolEdge);
        edge.position.set(-3, 0.3, 0);
        club.add(edge);

        const pool = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 10), this.materials.poolWater);
        pool.position.set(-3, 0.4, 0);
        club.add(pool);

        const kPool = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.5, 24), this.materials.poolWater);
        kPool.position.set(10, 0.4, -4);
        club.add(kPool);

        const courtGroup = new THREE.Group();
        courtGroup.position.set(0, 0.2, -20);
        const court = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 16), this.materials.court);
        court.receiveShadow = true;
        courtGroup.add(court);
        const fence = new THREE.Mesh(new THREE.BoxGeometry(28.4, 3.5, 16.4), this.materials.fence);
        fence.position.y = 1.75;
        courtGroup.add(fence);
        club.add(courtGroup);

        group.add(club);
    }

    // ---------- Mata Atlântica ----------

    isForestBlocked(x, z) {
        const L = SITE_LAYOUT;
        if (L.lakes.some((lake) => SiteGeo.insideEllipse(x, z, lake, 4))) return true;
        if (L.soilLots.some((lot) => SiteGeo.pointInPolygon(x, z, lot))) return true;
        for (const id of Object.keys(L.groups)) {
            const r = L.plateauRect(id);
            if (Math.abs(x - r.x) < r.w / 2 + 4 && Math.abs(z - r.z) < r.l / 2 + 4) return true;
        }
        const clearance = { avenue: 22, br116: 26, joaoPaulo: 13, joaoPauloLink: 14, saoJudas: 11, northLoop: 11, g13g15Access: 9, portaria02: 10 };
        for (const [name, path] of Object.entries(L.roads)) {
            if (SiteGeo.distanceToPath(x, z, path) < clearance[name]) return true;
        }
        return L.roundabouts.some((rb) => Math.hypot(x - rb.x, z - rb.z) < 26);
    }

    buildForest(group) {
        const trees = [];
        const r = this.rand;
        const spacing = 5.2;

        SITE_LAYOUT.forests.forEach((poly) => {
            const b = SiteGeo.polygonBounds(poly);
            for (let x = b.minX; x <= b.maxX; x += spacing) {
                for (let z = b.minZ; z <= b.maxZ; z += spacing) {
                    const tx = x + (r() - 0.5) * spacing;
                    const tz = z + (r() - 0.5) * spacing;
                    if (!SiteGeo.pointInPolygon(tx, tz, poly) || this.isForestBlocked(tx, tz)) continue;
                    trees.push([tx, tz]);
                }
            }
        });

        const beltSamples = SiteGeo.samplePath(SITE_LAYOUT.highwayBelt, 4);
        beltSamples.forEach((s) => {
            for (let k = 0; k < 3; k++) {
                const off = (r() - 0.5) * 16;
                const tx = s.x + s.nx * off + (r() - 0.5) * 3;
                const tz = s.z + s.nz * off + (r() - 0.5) * 3;
                if (!this.isForestBlocked(tx, tz)) trees.push([tx, tz]);
            }
        });

        // Cinturão de mata do lado de fora do muro, em todo o perímetro.
        const boundary = SITE_LAYOUT.boundary;
        for (let i = 0; i < boundary.length; i++) {
            const a = boundary[i];
            const b = boundary[(i + 1) % boundary.length];
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            const nx = -(b.z - a.z) / len;
            const nz = (b.x - a.x) / len;
            for (let d = 0; d < len; d += 4.5) {
                const t = d / len;
                const bx = a.x + (b.x - a.x) * t;
                const bz = a.z + (b.z - a.z) * t;
                const side = SiteGeo.pointInPolygon(bx + nx * 3, bz + nz * 3, boundary) ? -1 : 1;
                for (let k = 0; k < 3; k++) {
                    const off = side * (3 + r() * 16);
                    const tx = bx + nx * off;
                    const tz = bz + nz * off;
                    if (!this.isForestBlocked(tx, tz)) trees.push([tx, tz]);
                }
            }
        }

        const geo = new THREE.IcosahedronGeometry(1, 1);
        const mesh = new THREE.InstancedMesh(geo, this.materials.canopy, trees.length);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const pos = new THREE.Vector3();
        const scl = new THREE.Vector3();
        const color = new THREE.Color();
        const greens = [0x2f5d2a, 0x3b6e2f, 0x4a7c35, 0x29522a, 0x56883c];

        trees.forEach(([x, z], i) => {
            const s = 2.6 + r() * 2.2;
            pos.set(x, 0.3 + s * 0.8, z);
            scl.set(s, s * (0.75 + r() * 0.35), s);
            q.setFromAxisAngle(THREE.Object3D.DefaultUp, r() * Math.PI * 2);
            m.compose(pos, q, scl);
            mesh.setMatrixAt(i, m);
            if (r() < 0.035) color.setHex(0xe8c33a);
            else if (r() < 0.03) color.setHex(0xc06ab0);
            else color.setHex(greens[Math.floor(r() * greens.length)]);
            mesh.setColorAt(i, color);
        });

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.forestMesh = mesh;
    }

    // ---------- Palmeiras imperiais ----------

    createFrondGeometry() {
        const positions = [];
        const fronds = 9;
        for (let i = 0; i < fronds; i++) {
            const a = (i / fronds) * Math.PI * 2;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const pts = [
                [0, 0, -0.35], [0, 0, 0.35], [1.6, 0.35, 0], [3.4, -0.9, 0]
            ].map(([px, py, pz]) => [px * ca - pz * sa, py, px * sa + pz * ca]);
            positions.push(...pts[0], ...pts[2], ...pts[1], ...pts[0], ...pts[3], ...pts[2], ...pts[1], ...pts[2], ...pts[3]);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        return geo;
    }

    buildPalms(group) {
        const L = SITE_LAYOUT;
        const spots = [];
        const nearAny = (x, z, list, d) => list.some((p) => Math.hypot(x - p.x, z - p.z) < d);

        SiteGeo.samplePath(L.roads.avenue, 12).forEach((s) => {
            if (nearAny(s.x, s.z, L.roundabouts, 28) || nearAny(s.x, s.z, L.fountains, 9) || nearAny(s.x, s.z, L.gates, 20)) return;
            spots.push([s.x, s.z]);
        });
        L.roundabouts.forEach((rb) => {
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                spots.push([rb.x + Math.cos(a) * 6, rb.z + Math.sin(a) * 6]);
            }
        });
        L.gates.forEach((gate) => {
            [[-16, 0], [16, 0], [-16, 8], [16, 8]].forEach(([dx, dz]) => spots.push([gate.x + dx, gate.z + dz]));
        });

        const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 1, 7);
        trunkGeo.translate(0, 0.5, 0);
        const trunks = new THREE.InstancedMesh(trunkGeo, this.materials.palmTrunk, spots.length);
        const crowns = new THREE.InstancedMesh(this.createFrondGeometry(), this.materials.palmFrond, spots.length);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const pos = new THREE.Vector3();
        const scl = new THREE.Vector3();

        spots.forEach(([x, z], i) => {
            const h = 13 + this.rand() * 3;
            const base = 0.9;
            m.compose(pos.set(x, base, z), q.identity(), scl.set(1, h, 1));
            trunks.setMatrixAt(i, m);
            q.setFromAxisAngle(THREE.Object3D.DefaultUp, this.rand() * Math.PI);
            m.compose(pos.set(x, base + h, z), q, scl.set(1.1, 1.1, 1.1));
            crowns.setMatrixAt(i, m);
        });

        trunks.castShadow = true;
        crowns.castShadow = true;
        group.add(trunks, crowns);
    }

    buildFountains(group) {
        SITE_LAYOUT.fountains.forEach((f) => {
            const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 1.2, 24), this.materials.fountainStone);
            basin.position.set(f.x, 1.2, f.z);
            const water = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.2, 24), this.materials.fountainWater);
            water.position.set(f.x, 1.8, f.z);
            const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.6, 1.4, 16), this.materials.fountainStone);
            tier.position.set(f.x, 2.6, f.z);
            const jet = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 12, 1, true), this.materials.fountainWater);
            jet.position.set(f.x, 5.4, f.z);
            group.add(basin, water, tier, jet);
        });
    }

    buildRoundaboutFlags(group) {
        const flagColors = [0x16a34a, 0x2563eb, 0xfacc15];
        SITE_LAYOUT.roundabouts.forEach((rb) => {
            flagColors.forEach((c, i) => {
                const x = rb.x + (i - 1) * 2.4;
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10, 6), this.materials.flagPole);
                pole.position.set(x, 6, rb.z);
                const flag = new THREE.Mesh(
                    new THREE.PlaneGeometry(2.2, 1.4),
                    new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide })
                );
                flag.position.set(x + 1.1, 10.2, rb.z);
                group.add(pole, flag);
            });
        });
    }

    buildMiniMarkets(group) {
        const av = SiteGeo.samplePath(SITE_LAYOUT.roads.avenue, 4);
        [0.2, 0.5, 0.78].forEach((t) => {
            const s = av[Math.round(t * (av.length - 1))];
            const x = s.x - s.nx * 22;
            const z = s.z - s.nz * 22;
            const shop = new THREE.Group();
            shop.position.set(x, 0.5, z);
            shop.rotation.y = Math.atan2(s.tx, s.tz);
            const body = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 14), this.materials.market);
            body.position.y = 2;
            body.castShadow = true;
            const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 14.4), this.materials.marketSign);
            sign.position.set(-4.1, 3.6, 0);
            shop.add(body, sign);
            group.add(shop);
        });
    }

    // ---------- Iluminação e veículos ----------

    buildStreetLighting(group) {
        const av = SiteGeo.samplePath(SITE_LAYOUT.roads.avenue, 24);
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 7, 6);
        poleGeo.translate(0, 3.5, 0);
        const bulbGeo = new THREE.SphereGeometry(0.35, 8, 6);
        const poles = new THREE.InstancedMesh(poleGeo, this.materials.lampPost, av.length * 2);
        const bulbs = new THREE.InstancedMesh(bulbGeo, this.materials.lampBulb, av.length * 2);
        const m = new THREE.Matrix4();
        let n = 0;
        av.forEach((s) => {
            [-11.5, 11.5].forEach((off) => {
                const x = s.x + s.nx * off;
                const z = s.z + s.nz * off;
                poles.setMatrixAt(n, m.makeTranslation(x, 0.5, z));
                bulbs.setMatrixAt(n, m.makeTranslation(x, 7.6, z));
                n++;
            });
        });
        group.add(poles, bulbs);

        const lightCount = 12;
        for (let i = 0; i < lightCount; i++) {
            const s = av[Math.round(((i + 0.5) / lightCount) * (av.length - 1))];
            const light = new THREE.PointLight(0xfef08a, 0, 90, 1.5);
            light.position.set(s.x, 9, s.z);
            group.add(light);
            this.streetLights.push(light);
        }
    }

    buildMiniatureCars(group) {
        const cars = [];
        const lanes = [
            ['avenue', [-8.5, -4.5, 4.5, 8.5], 26],
            ['br116', [-15, -10.5, -6, 6, 10.5, 15], 14],
            ['joaoPaulo', [-4, 4], 5],
            ['northLoop', [-3, 3], 8]
        ];
        lanes.forEach(([road, offsets, count]) => {
            const samples = SiteGeo.samplePath(SITE_LAYOUT.roads[road], 3);
            for (let i = 0; i < count; i++) {
                const s = samples[Math.floor(this.rand() * samples.length)];
                const off = offsets[Math.floor(this.rand() * offsets.length)];
                const x = s.x + s.nx * off;
                const z = s.z + s.nz * off;
                if (SITE_LAYOUT.roundabouts.some((rb) => Math.hypot(x - rb.x, z - rb.z) < 24)) continue;
                cars.push({ x, z, rot: Math.atan2(s.tx, s.tz) + (off < 0 ? Math.PI : 0) });
            }
        });

        const bodyGeo = new THREE.BoxGeometry(1.6, 1.0, 3.6);
        bodyGeo.translate(0, 0.9, 0);
        const roofGeo = new THREE.BoxGeometry(1.4, 0.7, 2.0);
        roofGeo.translate(0, 1.75, -0.2);
        const bodies = new THREE.InstancedMesh(bodyGeo, this.materials.carBody, cars.length);
        const roofs = new THREE.InstancedMesh(roofGeo, this.materials.carRoof, cars.length);
        const palette = [0xdc2626, 0x2563eb, 0xf8fafc, 0x1e293b, 0x9ca3af, 0xfacc15];
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const pos = new THREE.Vector3();
        const one = new THREE.Vector3(1, 1, 1);
        const color = new THREE.Color();

        cars.forEach((c, i) => {
            q.setFromAxisAngle(THREE.Object3D.DefaultUp, c.rot);
            m.compose(pos.set(c.x, 0.2, c.z), q, one);
            bodies.setMatrixAt(i, m);
            roofs.setMatrixAt(i, m);
            bodies.setColorAt(i, color.setHex(palette[i % palette.length]));
        });
        bodies.castShadow = true;
        group.add(bodies, roofs);
    }

    setNightLighting(isNight) {
        this.streetLights.forEach((light) => {
            light.intensity = isNight ? 1.4 : 0;
        });
    }
}
