/**
 * Visualizador Interativo 3D de Planta Baixa dos Apartamentos do Parque Firenze
 * Modela em 3D a planta padrão de 125m² (3 Dormitórios com Varanda Gourmet)
 * e a planta de 80m² (2 Dormitórios), com paredes rebaixadas, piso e mobiliário.
 */

// Pavimentos tipo reais: ímpares (G13/15/17, 3 dorm.) e pares (G12/14/16/18, 2 dorm.).
const FLOOR_PLAN_MODELS = {
    '3dorm': 'public/models/plantas/impares_pavimento_tipo.glb',
    '2dorm': 'public/models/plantas/pares_pavimento_tipo.glb'
};
const FLOOR_PLAN_CUT_HEIGHT = 1.4;

class FloorPlanViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a);

        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 100);
        this.camera.position.set(0, 22, 18);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.localClippingEnabled = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2.05;
        this.controls.target.set(0, 0, 0);

        this.setupLights();
        this.currentApartmentGroup = null;
        this.loadApartment('3dorm');

        window.addEventListener('resize', () => this.onResize());
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => this.onResize());
            this.resizeObserver.observe(this.container);
        }
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(18, 40, 24);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -25;
        dirLight.shadow.camera.right = 25;
        dirLight.shadow.camera.top = 25;
        dirLight.shadow.camera.bottom = -25;
        dirLight.shadow.camera.far = 120;
        dirLight.shadow.bias = -0.0005;
        this.scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.3);
        fillLight.position.set(-10, 15, -10);
        this.scene.add(fillLight);
    }

    onResize() {
        if (!this.container) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (w === 0 || h === 0) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }

    loadApartment(type = '3dorm') {
        this.requestedType = type;
        if (this.currentApartmentGroup) {
            this.scene.remove(this.currentApartmentGroup);
            this.currentApartmentGroup = null;
        }

        const url = FLOOR_PLAN_MODELS[type];
        if (!url || !THREE.GLTFLoader) {
            this.showProcedural(type);
            return;
        }

        this.planCache = this.planCache || {};
        if (!this.planCache[type]) {
            this.planCache[type] = new Promise((resolve, reject) => {
                new THREE.GLTFLoader().load(url, (gltf) => resolve(this.preparePlan(gltf.scene)), undefined, reject);
            });
        }

        this.planCache[type].then((plan) => {
            if (this.requestedType !== type) return;
            this.showGroup(plan);
            this.framePlan(plan);
        }).catch((err) => {
            console.warn('Planta GLB indisponível, usando modelo simplificado:', err);
            if (this.requestedType === type) this.showProcedural(type);
        });
    }

    showGroup(group) {
        if (this.currentApartmentGroup) this.scene.remove(this.currentApartmentGroup);
        this.currentApartmentGroup = group;
        this.scene.add(group);
    }

    showProcedural(type) {
        const aptGroup = new THREE.Group();
        if (type === '3dorm') this.build3DormApartment(aptGroup);
        else this.build2DormApartment(aptGroup);
        this.showGroup(aptGroup);
        this.controls.target.set(0, 0, 0);
        this.camera.position.set(0, 22, 18);
    }

    // Centraliza o pavimento na origem e corta as paredes na altura do corte de planta.
    preparePlan(scene) {
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        scene.position.set(-center.x, -box.min.y, -center.z);

        const holder = new THREE.Group();
        holder.add(scene);
        holder.userData.size = box.getSize(new THREE.Vector3());

        const cut = [new THREE.Plane(new THREE.Vector3(0, -1, 0), FLOOR_PLAN_CUT_HEIGHT)];
        const fixed = new Map();
        scene.traverse((obj) => {
            if (!obj.isMesh) return;
            obj.castShadow = true;
            obj.receiveShadow = true;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            const next = mats.map((m) => {
                if (fixed.has(m)) return fixed.get(m);
                const mat = m.clone();
                mat.clippingPlanes = cut;
                mat.side = THREE.DoubleSide;
                if (mat.transmission) {
                    mat.transmission = 0;
                    mat.transparent = true;
                    mat.opacity = Math.min(mat.opacity, 0.35);
                }
                fixed.set(m, mat);
                return mat;
            });
            obj.material = Array.isArray(obj.material) ? next : next[0];
        });
        return holder;
    }

    framePlan(plan) {
        const size = plan.userData.size;
        const span = Math.max(size.x, size.z);
        this.controls.target.set(0, 0, 0);
        this.camera.position.set(0, span * 1.3, span * 0.85);
        this.camera.near = 0.1;
        this.camera.far = span * 10;
        this.camera.updateProjectionMatrix();
        this.controls.maxDistance = span * 3;
        this.controls.minDistance = 2;
        this.controls.update();
    }

    build3DormApartment(group) {
        // Planta do Parque Firenze 125m² (Tipo 3A/3B):
        // Medidas proporcionais: largura ~14m, profundidade ~12m, paredes h=1.0m (corte isométrico de maquete)
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
        const woodFloorMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.6 });
        const tileFloorMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
        const balconyFloorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 });
        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
        const furnitureWoodMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 });
        const fabricSofaMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const bedSheetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const graniteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });

        // 1. Pisos dos cômodos
        // Sala e Quartos (Laminado/Madeira)
        const livingFloorGeo = new THREE.PlaneGeometry(8, 7);
        livingFloorGeo.rotateX(-Math.PI / 2);
        const livingFloor = new THREE.Mesh(livingFloorGeo, woodFloorMat);
        livingFloor.position.set(-1, 0.02, 1.5);
        livingFloor.receiveShadow = true;
        group.add(livingFloor);

        // Quartos
        const roomsFloorGeo = new THREE.PlaneGeometry(6, 11);
        roomsFloorGeo.rotateX(-Math.PI / 2);
        const roomsFloor = new THREE.Mesh(roomsFloorGeo, woodFloorMat);
        roomsFloor.position.set(4, 0.04, -0.5);
        roomsFloor.receiveShadow = true;
        group.add(roomsFloor);

        // Cozinha e Área de Serviço (Porcelanato)
        const kitchenFloorGeo = new THREE.PlaneGeometry(5, 4);
        kitchenFloorGeo.rotateX(-Math.PI / 2);
        const kitchenFloor = new THREE.Mesh(kitchenFloorGeo, tileFloorMat);
        kitchenFloor.position.set(-2.5, 0.03, -4);
        kitchenFloor.receiveShadow = true;
        group.add(kitchenFloor);

        // A Famosa Varanda Gourmet Parque Firenze (Comprimento total da sala!)
        const balconyFloorGeo = new THREE.PlaneGeometry(8, 3.2);
        balconyFloorGeo.rotateX(-Math.PI / 2);
        const balconyFloor = new THREE.Mesh(balconyFloorGeo, balconyFloorMat);
        balconyFloor.position.set(-1, 0.02, 6.6);
        balconyFloor.receiveShadow = true;
        group.add(balconyFloor);

        // 2. Paredes Cortadas a 1.0m (Estilo Maquete Arquitetônica de Decoração)
        const wallH = 1.0;
        const wallThick = 0.22;

        const walls = [
            // Perímetro
            { x: -1, z: 8.2, w: 8, d: wallThick },   // Frente Varanda
            { x: -5, z: 6.6, w: wallThick, d: 3.2 }, // Lateral esq varanda
            { x: 3, z: 6.6, w: wallThick, d: 3.2 },  // Lateral dir varanda
            { x: -5, z: 0.5, w: wallThick, d: 9 },   // Parede externa esq sala/cozinha
            { x: -2.5, z: -6.0, w: 5, d: wallThick },// Parede fundo cozinha
            { x: 0, z: -4.0, w: wallThick, d: 4 },   // Divisão cozinha/corredor
            { x: 7, z: -0.5, w: wallThick, d: 11 },  // Parede externa quartos
            { x: 4, z: -6.0, w: 6, d: wallThick },   // Fundo quartos
            { x: 4, z: 5.0, w: 6, d: wallThick },    // Frente suíte master
            // Divisões internas dos quartos
            { x: 4, z: -2.0, w: 6, d: wallThick },   // Divisão Q3 / Q2
            { x: 4, z: 1.5, w: 6, d: wallThick },    // Divisão Q2 / Suíte
            // Divisão sala / varanda (Guarda-corpo de vidro de correr)
            { x: -1, z: 5.0, w: 8, d: 0.08, isGlass: true }
        ];

        walls.forEach(w => {
            const geo = new THREE.BoxGeometry(w.w, wallH, w.d);
            const mat = w.isGlass ? glassMat : wallMat;
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(w.x, wallH / 2, w.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
        });

        // 3. Mobiliário da Varanda Gourmet Parque Firenze
        // Churrasqueira de alvenaria com duto
        const bbqGeo = new THREE.BoxGeometry(1.4, 1.8, 1.0);
        const bbq = new THREE.Mesh(bbqGeo, graniteMat);
        bbq.position.set(-4.2, 0.9, 7.5);
        bbq.castShadow = true;
        group.add(bbq);

        // Bancada da pia da churrasqueira
        const sinkBenchGeo = new THREE.BoxGeometry(2.0, 0.85, 0.8);
        const sinkBench = new THREE.Mesh(sinkBenchGeo, graniteMat);
        sinkBench.position.set(-2.5, 0.42, 7.6);
        group.add(sinkBench);

        // Mesa de jantar da varanda com 4 cadeiras
        const bbqTableGeo = new THREE.BoxGeometry(2.2, 0.75, 1.2);
        const bbqTable = new THREE.Mesh(bbqTableGeo, furnitureWoodMat);
        bbqTable.position.set(1.0, 0.375, 6.6);
        group.add(bbqTable);

        // 4. Mobiliário da Sala de Estar e Jantar
        // Sofá em L na Sala de Estar
        const sofaGeo = new THREE.BoxGeometry(3.2, 0.7, 2.0);
        const sofa = new THREE.Mesh(sofaGeo, fabricSofaMat);
        sofa.position.set(-3.0, 0.35, 3.2);
        group.add(sofa);

        // Painel de TV / Home Theater
        const tvRackGeo = new THREE.BoxGeometry(2.8, 0.5, 0.6);
        const tvRack = new THREE.Mesh(tvRackGeo, furnitureWoodMat);
        tvRack.position.set(-3.0, 0.25, 0.2);
        group.add(tvRack);

        // Mesa de Jantar com 6 lugares
        const diningGeo = new THREE.BoxGeometry(2.4, 0.75, 1.4);
        const dining = new THREE.Mesh(diningGeo, furnitureWoodMat);
        dining.position.set(1.0, 0.375, 2.0);
        group.add(dining);

        // 5. Cozinha Americana Planejada
        const kitchenCounterGeo = new THREE.BoxGeometry(4.0, 0.85, 0.8);
        const kitchenCounter = new THREE.Mesh(kitchenCounterGeo, graniteMat);
        kitchenCounter.position.set(-2.8, 0.42, -5.5);
        group.add(kitchenCounter);

        // Geladeira Duplex inox
        const fridgeGeo = new THREE.BoxGeometry(0.9, 1.6, 0.9);
        const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.2 });
        const fridge = new THREE.Mesh(fridgeGeo, fridgeMat);
        fridge.position.set(-0.6, 0.8, -5.4);
        group.add(fridge);

        // 6. Suíte Master com Closet
        // Cama Queen Size
        const bedGeo = new THREE.BoxGeometry(2.2, 0.6, 2.0);
        const bed = new THREE.Mesh(bedGeo, bedSheetMat);
        bed.position.set(5.0, 0.3, 3.2);
        group.add(bed);

        // Armário closet
        const closetGeo = new THREE.BoxGeometry(2.5, 1.2, 0.7);
        const closet = new THREE.Mesh(closetGeo, furnitureWoodMat);
        closet.position.set(2.0, 0.6, 3.2);
        group.add(closet);

        // 7. Dormitório 2 (Solteiro)
        const bed2Geo = new THREE.BoxGeometry(1.2, 0.5, 2.0);
        const bed2 = new THREE.Mesh(bed2Geo, bedSheetMat);
        bed2.position.set(5.5, 0.25, -0.2);
        group.add(bed2);

        // 8. Dormitório 3 (Home Office / Quarto)
        const deskGeo = new THREE.BoxGeometry(1.8, 0.75, 0.8);
        const desk = new THREE.Mesh(deskGeo, furnitureWoodMat);
        desk.position.set(5.0, 0.375, -4.5);
        group.add(desk);

        // Base com rodapé elegante
        const baseGeo = new THREE.BoxGeometry(16, 0.4, 18);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x020617 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(0.5, -0.2, 0.5);
        group.add(base);
    }

    build2DormApartment(group) {
        // Planta do Parque Firenze 80m² (Tipo 2A/2B):
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
        const woodFloorMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.6 });
        const balconyFloorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 });
        const graniteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
        const bedSheetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const furnitureWoodMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 });

        // Piso
        const floorGeo = new THREE.PlaneGeometry(10, 10);
        floorGeo.rotateX(-Math.PI / 2);
        const floor = new THREE.Mesh(floorGeo, woodFloorMat);
        floor.position.set(0, 0.04, 0);
        floor.receiveShadow = true;
        group.add(floor);

        // Varanda Gourmet integrada
        const balcGeo = new THREE.PlaneGeometry(6, 2.4);
        balcGeo.rotateX(-Math.PI / 2);
        const balc = new THREE.Mesh(balcGeo, balconyFloorMat);
        balc.position.set(-2, 0.06, 4.2);
        group.add(balc);

        // Paredes
        const wallH = 1.0;
        const wallThick = 0.2;
        const pWalls = [
            { x: 0, z: 5.4, w: 10, d: wallThick },
            { x: 0, z: -5.0, w: 10, d: wallThick },
            { x: -5, z: 0.2, w: wallThick, d: 10.4 },
            { x: 5, z: 0.2, w: wallThick, d: 10.4 },
            // Divisão interna
            { x: 1, z: 0, w: wallThick, d: 10 },
            { x: 3, z: 0, w: 4, d: wallThick }
        ];

        pWalls.forEach(w => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, wallH, w.d), wallMat);
            m.position.set(w.x, wallH / 2, w.z);
            group.add(m);
        });

        // Cama casal e solteiro
        const bed1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 1.8), bedSheetMat);
        bed1.position.set(3.0, 0.25, 2.8);
        group.add(bed1);

        const bed2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.8), bedSheetMat);
        bed2.position.set(3.0, 0.25, -2.5);
        group.add(bed2);

        // Sofá e TV
        const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x334155 }));
        sofa.position.set(-2.0, 0.3, 1.0);
        group.add(sofa);

        // Bancada gourmet com churrasqueira na varanda
        const bbq = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.8), graniteMat);
        bbq.position.set(-4.2, 0.7, 4.2);
        group.add(bbq);

        const base = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x020617 }));
        base.position.y = -0.35;
        group.add(base);
    }

    animate() {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
