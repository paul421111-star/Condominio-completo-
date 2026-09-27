/**
 * Implantação do Parque Firenze decalcada da "Planta de Implantação" oficial
 * (7 grupos, 45 torres, 8.400 apartamentos) exibida na maquete do estande.
 *
 * As coordenadas estão em pixels da foto da planta (1024 x 518, norte para
 * cima) e são convertidas para a cena por px(). A Rodovia Régis Bittencourt
 * corre ao sul, a Estrada São Judas a oeste e a Av. João Paulo I a leste.
 */

const SITE_SCALE = 1.5;
const SITE_ORIGIN = { x: 540, y: 280 };

function px(x, y) {
    return { x: (x - SITE_ORIGIN.x) * SITE_SCALE, z: (y - SITE_ORIGIN.y) * SITE_SCALE };
}

function pxPath(points) {
    return points.map(([x, y]) => px(x, y));
}

const SITE_LAYOUT = {
    groundY: 0,
    plateauTop: 1.2,

    boundary: pxPath([
        [95, 330], [105, 300], [130, 285], [185, 266], [262, 230], [300, 208], [330, 192],
        [385, 180], [470, 150], [555, 128], [612, 118], [700, 132], [780, 142], [870, 136],
        [948, 146], [962, 210], [944, 300], [934, 378], [908, 400], [700, 404], [560, 410],
        [420, 416], [250, 422], [110, 426], [62, 420], [70, 362]
    ]),

    // Mata Atlântica preservada: "Área Verde", nascentes e cursos d'água.
    forests: [
        pxPath([
            [440, 205], [470, 172], [545, 152], [546, 305], [668, 305], [668, 150], [700, 150],
            [766, 158], [770, 305], [930, 305], [920, 350], [905, 374], [760, 380], [600, 372],
            [505, 350], [462, 330], [440, 300]
        ]),
        pxPath([[377, 212], [385, 208], [385, 300], [377, 304]]),
        pxPath([[300, 336], [345, 336], [345, 406], [300, 412]]),
        pxPath([[100, 302], [125, 290], [120, 322], [102, 326]])
    ],

    // Cinturão verde ao longo da Régis Bittencourt ("via lateral norte a ser implantada").
    highwayBelt: pxPath([[110, 416], [420, 408], [700, 400], [905, 394]]),

    // Represas / bacias de retenção.
    lakes: [
        { ...px(320, 385), rx: 26, rz: 32, rot: 0 },
        { ...px(486, 320), rx: 30, rz: 14, rot: 0.64 },
        { ...px(618, 342), rx: 80, rz: 15, rot: 0.63 }
    ],

    // Glebas em terra (áreas futuras, em laranja na planta).
    soilLots: [
        pxPath([[72, 342], [92, 338], [100, 405], [66, 408]]),
        pxPath([[348, 336], [405, 340], [420, 408], [350, 412]]),
        pxPath([[445, 372], [520, 375], [520, 408], [448, 410]]),
        pxPath([[874, 150], [944, 152], [958, 212], [936, 262], [874, 262]])
    ],

    roads: {
        // Avenida Interna do Condomínio: Portaria São Judas -> Portaria João Paulo I.
        avenue: pxPath([
            [95, 330], [170, 326], [240, 323], [320, 322], [395, 322], [440, 338], [510, 364],
            [600, 382], [720, 391], [850, 390], [930, 382]
        ]),
        northLoop: pxPath([
            [395, 322], [391, 280], [390, 230], [392, 190], [430, 172], [470, 160], [555, 140],
            [612, 130], [700, 144], [780, 152], [870, 146], [948, 150]
        ]),
        g13g15Access: pxPath([[606, 134], [606, 298]]),
        portaria02: pxPath([[560, 384], [560, 442]]),
        saoJudas: pxPath([[25, 478], [58, 400], [80, 346], [95, 330], [110, 300], [135, 262], [168, 215], [195, 176]]),
        joaoPauloLink: pxPath([[922, 383], [955, 380]]),
        joaoPaulo: pxPath([[978, 414], [958, 396], [940, 350], [934, 280], [948, 210], [968, 140], [998, 60]]),
        br116: pxPath([[-40, 450], [300, 444], [600, 438], [900, 431], [1064, 427]])
    },

    // Rampa e viaduto da Av. João Paulo I sobre a Régis Bittencourt (acesso ao Rodoanel).
    viaduct: { from: px(978, 414), to: px(1040, 478), height: 9 },

    roundabouts: [px(240, 323), px(395, 322), px(560, 384), px(850, 390)],

    gates: [
        { ...px(95, 330), road: 'avenue', at: 0, title: 'PORTARIA 01 • ESTR. SÃO JUDAS' },
        { ...px(560, 418), road: 'portaria02', at: 0.6, title: 'PORTARIA 02 • BR-116' },
        { ...px(928, 382), road: 'avenue', at: 1, title: 'PORTARIA • AV. JOÃO PAULO I' },
        { ...px(905, 148), road: 'northLoop', at: 0.97, title: 'PORTARIA 03' }
    ],

    fountains: [px(170, 326), px(600, 382), px(720, 391)],

    groups: {
        12: {
            plateau: [120, 336, 305, 405],
            leisure: [291, 370],
            towers: [[160, 352], [210, 352], [262, 352], [150, 388], [200, 388], [250, 388]]
        },
        14: {
            plateau: [115, 258, 290, 318],
            leisure: [140, 280],
            towers: [[200, 280], [235, 280], [268, 280], [140, 305], [175, 305], [212, 305]]
        },
        16: {
            plateau: [306, 198, 376, 312],
            leisure: [347, 300],
            towers: [[330, 212], [364, 212], [330, 244], [364, 244], [330, 276], [364, 276]]
        },
        18: {
            plateau: [400, 188, 466, 308],
            leisure: [434, 296],
            towers: [[418, 202], [450, 202], [418, 234], [450, 234], [418, 266], [450, 266]]
        },
        13: {
            plateau: [546, 142, 604, 300],
            leisure: [577, 285],
            towers: [[562, 156], [592, 172], [562, 189], [592, 205], [562, 222], [592, 238], [562, 255]]
        },
        15: {
            plateau: [610, 140, 668, 302],
            leisure: [640, 288],
            towers: [[625, 158], [655, 174], [625, 191], [655, 207], [625, 224], [655, 240], [625, 257]]
        },
        17: {
            plateau: [775, 156, 862, 300],
            leisure: [838, 283],
            towers: [[795, 170], [836, 184], [795, 203], [836, 217], [795, 236], [836, 250], [795, 269]]
        }
    },

    towerPlacements() {
        const blocos = 'ABCDEFG';
        const y = this.plateauTop;
        const list = [];
        Object.entries(this.groups).forEach(([id, g]) => {
            g.towers.forEach(([tx, ty], i) => {
                const p = px(tx, ty);
                list.push({ grupo: Number(id), bloco: blocos[i], x: p.x, y, z: p.z, rot: 0 });
            });
        });
        return list;
    },

    plateauRect(id) {
        const [x1, y1, x2, y2] = this.groups[id].plateau;
        const a = px(x1, y1);
        const b = px(x2, y2);
        return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: b.x - a.x, l: b.z - a.z };
    },

    groupCenter(id) {
        const r = this.plateauRect(id);
        return { x: r.x, z: r.z };
    },

    leisure(id) {
        const [lx, ly] = this.groups[id].leisure;
        return px(lx, ly);
    }
};

const SiteGeo = {
    pointInPolygon(x, z, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i];
            const b = poly[j];
            if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) {
                inside = !inside;
            }
        }
        return inside;
    },

    distanceToPath(x, z, path) {
        let best = Infinity;
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i];
            const b = path[i + 1];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
            best = Math.min(best, Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)));
        }
        return best;
    },

    insideEllipse(x, z, e, margin = 0) {
        const c = Math.cos(e.rot);
        const s = Math.sin(e.rot);
        const dx = x - e.x;
        const dz = z - e.z;
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        return (lx * lx) / ((e.rx + margin) ** 2) + (lz * lz) / ((e.rz + margin) ** 2) <= 1;
    },

    polygonBounds(poly) {
        const xs = poly.map((p) => p.x);
        const zs = poly.map((p) => p.z);
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    },

    // Shape do Three.js fica no plano XY; após rotateX(-PI/2), +Y vira -Z.
    shapeFromPolygon(poly) {
        const shape = new THREE.Shape();
        poly.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)));
        shape.closePath();
        return shape;
    },

    // Curva suave que passa pelos pontos da planta, amostrada a cada `step` unidades.
    samplePath(path, step = 4) {
        const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
        const count = Math.max(2, Math.ceil(curve.getLength() / step));
        const points = curve.getSpacedPoints(count);
        return points.map((p, i) => {
            const t = curve.getTangentAt(i / count);
            return { x: p.x, z: p.z, tx: t.x, tz: t.z, nx: -t.z, nz: t.x };
        });
    }
};
