/**
 * Aplicação Principal: Parque Firenze Digital Twin
 * Cooperativa Habitacional Vida Nova (CHVN) - Embu das Artes / SP
 * Suporte completo a BIM-lite, GLB Real, Hierarquia, FVS, Ocorrências e GIS
 */

class ParqueFirenzeApp {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Construtores
        this.towerBuilder = null;
        this.terrainBuilder = null;
        this.amenitiesBuilder = null;
        this.glbLoader = null;
        this.floorPlanViewer = null;

        // Grupos de Camadas (Layers)
        this.layers = {
            buildings: new THREE.Group(),
            roads: new THREE.Group(),
            trees: new THREE.Group(),
            amenities: new THREE.Group(),
            lake: new THREE.Group(),
            gates: new THREE.Group(),
            occurrences: new THREE.Group()
        };

        // Estado do Digital Twin
        this.currentMode = 'day';
        this.isGlbMode = false;
        this.isWorkStatusMode = false;
        this.selectedTower = null;
        this.selectedFloor = 36;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isTransitioningCamera = false;

        // Pins de Ocorrências 3D
        this.occurrencePins = [];

        this.init();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.setupLighting();

        // Inicializa construtores de geometria
        this.towerBuilder = new TowerBuilder(this.layers.buildings);
        this.terrainBuilder = new TerrainBuilder(this.scene);
        this.amenitiesBuilder = new AmenitiesBuilder(this.scene);
        this.glbLoader = new GlbTowerLoader(this.layers.buildings);
        window.glbTowerLoader = this.glbLoader;

        // Monta cena e camadas
        this.buildDigitalTwin();

        // Inicializa visualizador de planta baixa 3D
        this.floorPlanViewer = new FloorPlanViewer('floorplan-canvas');

        // Pré-carrega os GLBs reais em segundo plano
        this.glbLoader.loadTemplates((label, pct) => {
            console.log(`[GLB Loader] Carregando ${label}: ${pct.toFixed(0)}%`);
        }).then((ok) => {
            if (ok) {
                console.log("Modelos GLB oficiais (Firenze_Pares e Firenze_Impares) prontos!");
                const glbBtn = document.getElementById('glb-mode-label');
                if (glbBtn) glbBtn.textContent = 'GLB Real';
            }
        });

        // Eventos e UI
        this.setupEvents();
        this.setupSidebarEvents();
        this.setupLayersEvents();
        this.setupOccurrencePins();

        // Inicia loop de renderização
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        console.log("Parque Firenze Digital Twin inicializado com sucesso.");
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.00045);

        // Adiciona camadas principais à cena
        Object.values(this.layers).forEach(layer => this.scene.add(layer));
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 2, 5000);
        this.camera.position.set(60, 1000, 1300);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.container.appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 2000;
        this.controls.maxPolarAngle = Math.PI / 2.05;
        this.controls.target.set(60, 0, 0);
    }

    setupLighting() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(this.ambientLight);

        this.skyLight = new THREE.HemisphereLight(0x87ceeb, 0x3d7835, 0.45);
        this.scene.add(this.skyLight);

        this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.3);
        this.sunLight.position.set(540, 840, 480);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 3000;
        this.sunLight.shadow.camera.left = -800;
        this.sunLight.shadow.camera.right = 800;
        this.sunLight.shadow.camera.top = 800;
        this.sunLight.shadow.camera.bottom = -800;
        this.sunLight.shadow.bias = -0.0004;
        this.scene.add(this.sunLight);

        this.showroomSpot1 = new THREE.SpotLight(0xfff7ed, 0, 600, Math.PI / 3, 0.4);
        this.showroomSpot1.position.set(-150, 300, 150);
        this.scene.add(this.showroomSpot1);

        this.showroomSpot2 = new THREE.SpotLight(0xfff7ed, 0, 600, Math.PI / 3, 0.4);
        this.showroomSpot2.position.set(150, 300, -150);
        this.scene.add(this.showroomSpot2);
    }

    buildDigitalTwin() {
        // Terreno e Implantação
        this.terrainBuilder.buildAll();

        // Implantação oficial: 45 torres nas posições da planta (js/siteLayout.js)
        this.towerPlacements = SITE_LAYOUT.towerPlacements();
        this.syncLayoutData();

        // Constrói as 45 torres procedurais iniciais
        this.proceduralTowerObjects = [];
        this.towerPlacements.forEach(t => {
            const mesh = this.towerBuilder.createTower(t.grupo, t.bloco, t.x, t.y, t.z, t.rot);
            const towerKey = `G${t.grupo}_BLOCO_${t.bloco}`;
            mesh.userData.towerKey = towerKey;
            const collider = this.towerBuilder.towers[this.towerBuilder.towers.length - 1];
            if (collider) collider.userData.towerKey = towerKey;
            this.proceduralTowerObjects.push(mesh);
        });

        // Áreas de Lazer e Paisagismo
        this.amenitiesBuilder.buildAll();
    }

    // Centros de grupo e pinos de ocorrência derivam das torres, para acompanhar a implantação.
    syncLayoutData() {
        const floorHeight = 0.85;
        Object.entries(PARQUE_FIRENZE_DATA.grupos).forEach(([id, grupo]) => {
            if (SITE_LAYOUT.groups[id]) grupo.posicaoCentro = SITE_LAYOUT.groupCenter(id);
        });
        PARQUE_FIRENZE_DATA.ocorrenciasList.forEach((ocorr) => {
            const t = this.towerPlacements.find((p) => `G${p.grupo}_BLOCO_${p.bloco}` === ocorr.torreKey);
            if (!t) return;
            const floors = PARQUE_FIRENZE_DATA.grupos[t.grupo].andaresPorTorre;
            ocorr.posicao3D = { x: t.x, y: t.y + floors * floorHeight + 6, z: t.z };
        });
    }

    setupOccurrencePins() {
        PARQUE_FIRENZE_DATA.ocorrenciasList.forEach(ocorr => {
            const pinGroup = new THREE.Group();
            pinGroup.position.set(ocorr.posicao3D.x, ocorr.posicao3D.y, ocorr.posicao3D.z);

            // Cone do marcador
            const coneGeo = new THREE.ConeGeometry(1.6, 4.0, 16);
            coneGeo.rotateX(Math.PI);
            const pinMat = new THREE.MeshStandardMaterial({
                color: ocorr.corPin,
                emissive: ocorr.corPin,
                emissiveIntensity: 0.6,
                roughness: 0.3
            });
            const cone = new THREE.Mesh(coneGeo, pinMat);
            cone.position.y = 2.0;
            pinGroup.add(cone);

            // Esfera superior
            const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
            const sphere = new THREE.Mesh(sphereGeo, pinMat);
            sphere.position.y = 4.2;
            pinGroup.add(sphere);

            pinGroup.userData = {
                isOccurrencePin: true,
                occurrenceData: ocorr
            };

            this.layers.occurrences.add(pinGroup);
            this.occurrencePins.push(pinGroup);
        });
    }

    toggleGlbMode() {
        if (!this.glbLoader.isLoaded) {
            alert("Os modelos GLB reais estão sendo finalizados. Tente novamente em alguns segundos.");
            return;
        }

        this.isGlbMode = !this.isGlbMode;
        const btnLabel = document.getElementById('glb-mode-label');

        if (this.isGlbMode) {
            this.proceduralTowerObjects.forEach(m => m.visible = false);
            this.glbLoader.ensureSpawned(this.towerPlacements);
            this.glbLoader.setVisible(true);
            if (this.isWorkStatusMode) this.glbLoader.applyWorkStatusHeatmap(true);
            if (btnLabel) btnLabel.textContent = 'GLB Ativo';
        } else {
            this.glbLoader.setVisible(false);
            this.proceduralTowerObjects.forEach(m => m.visible = true);
            if (btnLabel) btnLabel.textContent = 'GLB Real';
        }
        document.getElementById('btn-toggle-glb')?.classList.toggle('active', this.isGlbMode);
    }

    setupSidebarEvents() {
        // Busca Global
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                if (!query) return;

                // Busca por Grupo (ex: "g13", "13", "grupo 15")
                const matchGrupo = query.match(/(?:grupo|g)?\s*(\d{2})/);
                if (matchGrupo) {
                    const gId = parseInt(matchGrupo[1], 10);
                    if (PARQUE_FIRENZE_DATA.grupos[gId]) {
                        this.selectGroup(gId);
                        return;
                    }
                }

                // Busca por Bloco
                const matchBloco = query.match(/bloco\s*([a-g])/i);
                if (matchBloco) {
                    const b = matchBloco[1].toUpperCase();
                    const tower = this.towerBuilder.towers.find(t => t.userData.bloco === b);
                    if (tower) {
                        this.showTowerDetails(tower.userData);
                        return;
                    }
                }

                // Busca por Ocorrência (ex: "401", "ocorr")
                const matchOcorr = PARQUE_FIRENZE_DATA.ocorrenciasList.find(o => o.id.toLowerCase().includes(query));
                if (matchOcorr) {
                    this.flyTo(
                        new THREE.Vector3(matchOcorr.posicao3D.x, matchOcorr.posicao3D.y, matchOcorr.posicao3D.z),
                        new THREE.Vector3(matchOcorr.posicao3D.x + 25, matchOcorr.posicao3D.y + 20, matchOcorr.posicao3D.z + 30)
                    );
                    this.openOccurrenceModal(matchOcorr);
                }
            });
        }

        // Clique na lista de Grupos
        document.querySelectorAll('#groups-hierarchy-list .hierarchy-item').forEach(item => {
            item.addEventListener('click', () => {
                const gId = parseInt(item.dataset.group, 10);
                this.selectGroup(gId);
                document.querySelectorAll('#groups-hierarchy-list .hierarchy-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Slider de Andar / Slice
        const floorSlider = document.getElementById('floor-range-slider');
        const floorValLabel = document.getElementById('slider-current-val');
        const activeFloorTag = document.getElementById('active-floor-label');

        if (floorSlider) {
            floorSlider.addEventListener('input', (e) => {
                const floor = parseInt(e.target.value, 10);
                this.selectedFloor = floor;
                if (floorValLabel) floorValLabel.textContent = `Pavimento ${floor}`;
                if (activeFloorTag) activeFloorTag.textContent = `PAV. ${floor}`;

                if (this.selectedTower) {
                    if (this.isGlbMode) {
                        this.glbLoader.isolateFloor(this.selectedTower.towerKey, floor, 'slice');
                    } else {
                        // Oculta andares superiores na torre procedural
                        this.sliceProceduralTower(this.selectedTower, floor);
                    }
                }
            });
        }

        const resetSliceBtn = document.getElementById('btn-reset-floor-slice');
        if (resetSliceBtn) {
            resetSliceBtn.addEventListener('click', () => {
                if (floorSlider) floorSlider.value = 36;
                if (floorValLabel) floorValLabel.textContent = 'Pavimento 36';
                if (activeFloorTag) activeFloorTag.textContent = 'INTEIRO';
                if (this.selectedTower) {
                    if (this.isGlbMode) {
                        this.glbLoader.resetTowerVisibility(this.selectedTower.towerKey);
                    } else {
                        this.resetProceduralTower(this.selectedTower);
                    }
                }
            });
        }

        // Abas do Inspetor Direito
        document.querySelectorAll('.inspector-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.inspector-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const targetPane = document.getElementById(btn.dataset.tab);
                if (targetPane) targetPane.classList.add('active');
            });
        });

        // Alternador de Navegador Lateral
        const btnToggleSidebar = document.getElementById('btn-toggle-left-sidebar');
        const leftSidebar = document.getElementById('left-sidebar');
        if (btnToggleSidebar && leftSidebar) {
            btnToggleSidebar.addEventListener('click', () => {
                this.setSidebarOpen(leftSidebar.classList.contains('hidden'));
            });
        }
        this.setupResponsiveLayout();

        // Alternador de GLB
        const btnToggleGlb = document.getElementById('btn-toggle-glb');
        if (btnToggleGlb) {
            btnToggleGlb.addEventListener('click', () => this.toggleGlbMode());
        }
    }

    isCompactLayout() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    setSidebarOpen(open) {
        const leftSidebar = document.getElementById('left-sidebar');
        if (!leftSidebar) return;
        leftSidebar.classList.toggle('hidden', !open);
        document.getElementById('btn-toggle-left-sidebar')?.classList.toggle('active', open);
        if (open && this.isCompactLayout()) {
            document.getElementById('tower-details-card')?.classList.add('hidden');
        }
    }

    // Os painéis laterais são posicionados entre o topo e o rodapé do HUD,
    // cujas alturas mudam com a largura da tela.
    setupResponsiveLayout() {
        const root = document.documentElement;
        const top = document.querySelector('.hud-top-section');
        const footer = document.querySelector('.footer-bar');
        const sync = () => {
            const gap = this.isCompactLayout() ? 8 : 12;
            if (top) root.style.setProperty('--hud-top', `${top.getBoundingClientRect().bottom + gap}px`);
            if (footer) root.style.setProperty('--hud-bottom', `${window.innerHeight - footer.getBoundingClientRect().top + gap}px`);
        };
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(sync);
            if (top) ro.observe(top);
            if (footer) ro.observe(footer);
        }
        window.addEventListener('resize', sync);
        sync();

        if (this.isCompactLayout()) this.setSidebarOpen(false);
    }

    setupLayersEvents() {
        const bindLayer = (id, layerKey) => {
            const cb = document.getElementById(id);
            if (cb && this.layers[layerKey]) {
                cb.addEventListener('change', (e) => {
                    this.layers[layerKey].visible = e.target.checked;
                });
            }
        };

        bindLayer('layer-buildings', 'buildings');
        bindLayer('layer-occurrences', 'occurrences');
    }

    selectGroup(grupoId) {
        const grupo = PARQUE_FIRENZE_DATA.grupos[grupoId];
        if (!grupo) return;

        const target = new THREE.Vector3(grupo.posicaoCentro.x, 20, grupo.posicaoCentro.z);
        const camPos = new THREE.Vector3(grupo.posicaoCentro.x + 60, 170, grupo.posicaoCentro.z + 230);
        this.flyTo(target, camPos, 1100);

        // Seleciona Bloco A do grupo como foco
        const tower = this.towerBuilder.towers.find(t => t.userData.grupoId === grupoId && t.userData.bloco === 'A');
        if (tower) {
            this.showTowerDetails(tower.userData);
        }
    }

    sliceProceduralTower(towerData, targetFloor) {
        if (!towerData.towerGroup) return;
        const floorHeight = 0.85;
        const maxH = targetFloor * floorHeight;

        towerData.towerGroup.children.forEach((child) => {
            if (!child.isMesh) return;
            const d = child.userData;
            if (d.perFloor) {
                child.count = targetFloor * d.perFloor;
            } else if (d.bodyHeight) {
                const h = Math.min(maxH, d.bodyHeight);
                child.scale.y = h / d.bodyHeight;
                child.position.y = h / 2;
            } else if (d.roof) {
                child.visible = targetFloor >= towerData.andares;
            }
        });
    }

    resetProceduralTower(towerData) {
        if (!towerData.towerGroup) return;
        this.sliceProceduralTower(towerData, towerData.andares);
    }

    setMode(mode) {
        this.currentMode = mode;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        switch (mode) {
            case 'day':
                this.scene.background = new THREE.Color(0x7dd3fc);
                this.scene.fog.color = new THREE.Color(0x7dd3fc);
                this.sunLight.color = new THREE.Color(0xfffbeb);
                this.sunLight.intensity = 1.3;
                this.sunLight.position.set(540, 840, 480);
                this.ambientLight.intensity = 0.65;
                this.skyLight.intensity = 0.45;
                this.showroomSpot1.intensity = 0;
                this.showroomSpot2.intensity = 0;
                this.towerBuilder.setLightingMode(false);
                this.amenitiesBuilder.setNightLighting(false);
                break;

            case 'sunset':
                this.scene.background = new THREE.Color(0xfdba74);
                this.scene.fog.color = new THREE.Color(0xfdba74);
                this.sunLight.color = new THREE.Color(0xf97316);
                this.sunLight.intensity = 1.6;
                this.sunLight.position.set(-840, 240, 300);
                this.ambientLight.intensity = 0.45;
                this.skyLight.intensity = 0.4;
                this.showroomSpot1.intensity = 0;
                this.showroomSpot2.intensity = 0;
                this.towerBuilder.setLightingMode(false);
                this.amenitiesBuilder.setNightLighting(false);
                break;

            case 'night':
                this.scene.background = new THREE.Color(0x020617);
                this.scene.fog.color = new THREE.Color(0x020617);
                this.sunLight.color = new THREE.Color(0x1e293b);
                this.sunLight.intensity = 0.15;
                this.ambientLight.intensity = 0.2;
                this.skyLight.intensity = 0.2;
                this.showroomSpot1.intensity = 0;
                this.showroomSpot2.intensity = 0;
                this.towerBuilder.setLightingMode(true);
                this.amenitiesBuilder.setNightLighting(true);
                break;

            case 'maquette':
                this.scene.background = new THREE.Color(0x090d16);
                this.scene.fog.color = new THREE.Color(0x090d16);
                this.sunLight.intensity = 0.5;
                this.ambientLight.intensity = 0.4;
                this.skyLight.intensity = 0.2;
                this.showroomSpot1.intensity = 1.8;
                this.showroomSpot2.intensity = 1.8;
                this.towerBuilder.setLightingMode(false);
                this.amenitiesBuilder.setNightLighting(false);
                break;
        }
    }

    setCameraPreset(view) {
        switch (view) {
            case 'general':
                this.toggleWorkStatusHeatmap(false);
                this.flyTo(new THREE.Vector3(60, 0, 0), new THREE.Vector3(60, 1000, 1300));
                break;
            case 'g13':
                this.toggleWorkStatusHeatmap(false);
                this.selectGroup(13);
                break;
            case 'g15':
                this.toggleWorkStatusHeatmap(false);
                this.selectGroup(15);
                break;
            case 'g17':
                this.toggleWorkStatusHeatmap(false);
                this.selectGroup(17);
                break;
            case 'g12':
                this.toggleWorkStatusHeatmap(false);
                this.selectGroup(12);
                break;
            case 'g18':
                this.toggleWorkStatusHeatmap(false);
                this.selectGroup(18);
                break;
            case 'lake':
                this.toggleWorkStatusHeatmap(false);
                {
                    const lake = SITE_LAYOUT.lakes[2];
                    this.flyTo(new THREE.Vector3(lake.x, 2, lake.z), new THREE.Vector3(lake.x - 40, 120, lake.z + 190));
                }
                break;
            case 'gate':
                this.toggleWorkStatusHeatmap(false);
                {
                    const gate = SITE_LAYOUT.gates[0];
                    this.flyTo(new THREE.Vector3(gate.x + 30, 4, gate.z), new THREE.Vector3(gate.x - 50, 45, gate.z + 70));
                }
                break;
            case 'status-obra':
                this.toggleWorkStatusHeatmap(true);
                this.flyTo(new THREE.Vector3(60, 10, -20), new THREE.Vector3(60, 620, 760));
                break;
            case 'ocorrencias':
                this.toggleWorkStatusHeatmap(false);
                this.flyTo(new THREE.Vector3(60, 10, -20), new THREE.Vector3(160, 480, 560));
                break;
        }
    }

    toggleWorkStatusHeatmap(enable) {
        this.isWorkStatusMode = enable;
        if (this.isGlbMode) {
            this.glbLoader.applyWorkStatusHeatmap(enable);
        } else {
            this.towerBuilder.towers.forEach(col => {
                const grp = PARQUE_FIRENZE_DATA.grupos[col.userData.grupoId];
                if (grp && col.userData.towerGroup) {
                    const pct = grp.statusObra.progressoGeral;
                    let color = 0x10b981;
                    if (pct < 60) color = 0xef4444;
                    else if (pct < 85) color = 0xf59e0b;
                    else if (pct < 100) color = 0x84cc16;

                    col.userData.towerGroup.traverse(child => {
                        if (child.isMesh && child.material) {
                            if (enable) {
                                if (!child.userData.origMat) child.userData.origMat = child.material;
                                child.material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 });
                            } else if (child.userData.origMat) {
                                child.material = child.userData.origMat;
                            }
                        }
                    });
                }
            });
        }
    }

    flyTo(targetPos, cameraPos, duration = 1200) {
        if (this.isTransitioningCamera) return;
        this.isTransitioningCamera = true;

        const startTarget = this.controls.target.clone();
        const startCamPos = this.camera.position.clone();
        const startTime = performance.now();

        const animateCamera = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            this.controls.target.lerpVectors(startTarget, targetPos, ease);
            this.camera.position.lerpVectors(startCamPos, cameraPos, ease);

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            } else {
                this.isTransitioningCamera = false;
            }
        };

        requestAnimationFrame(animateCamera);
    }

    setupEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.checkHover(e);
        });

        window.addEventListener('click', (e) => {
            if (e.target.closest('#hud-container') || e.target.closest('.modal')) return;
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.checkClick();
        });

        // Toolbar botões
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setCameraPreset(btn.dataset.view);
                document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMode(btn.dataset.mode);
            });
        });

        // Modais
        const modalFloorPlan = document.getElementById('modal-floorplan');
        const openPlanBtn = document.getElementById('btn-open-floorplan');
        const closePlanBtn = document.getElementById('btn-close-floorplan');

        if (openPlanBtn && modalFloorPlan) {
            openPlanBtn.addEventListener('click', () => {
                modalFloorPlan.classList.add('active');
                const activeTab = document.querySelector('.tab-plan-btn.active');
                this.showPlanSpecs(activeTab ? activeTab.dataset.plan : '3dorm');
                setTimeout(() => this.floorPlanViewer.onResize(), 100);
            });
        }
        if (closePlanBtn && modalFloorPlan) {
            closePlanBtn.addEventListener('click', () => {
                modalFloorPlan.classList.remove('active');
            });
        }

        document.querySelectorAll('.tab-plan-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-plan-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.floorPlanViewer.loadApartment(btn.dataset.plan);
                this.showPlanSpecs(btn.dataset.plan);
            });
        });

        const closeSideBtn = document.getElementById('btn-close-sidebar');
        if (closeSideBtn) {
            closeSideBtn.addEventListener('click', () => {
                document.getElementById('tower-details-card').classList.add('hidden');
            });
        }
    }

    showPlanSpecs(type) {
        const spec = PARQUE_FIRENZE_DATA.plantas[type === '2dorm' ? 'tipo2' : 'tipo3'];
        const el = document.getElementById('plan-specs-text');
        if (!spec || !el) return;
        const items = spec.ambientes.map((a) => `<li>${a}</li>`).join('');
        el.innerHTML = `
            <h4 style="color: #38bdf8; margin-bottom: 6px;">${spec.nome}</h4>
            <p style="font-size: 12px; color: #fbbf24; margin-bottom: 8px;">${spec.pavimento}</p>
            <div style="font-size: 13px; line-height: 1.5; color: #cbd5e1;">
                <p><strong>Área Privativa:</strong> ${spec.areaPrivativa}</p>
                <p><strong>Configuração:</strong> ${spec.dormitorios} Dormitórios (${spec.suites})</p>
                <p><strong>Vagas de Garagem:</strong> ${spec.vagasGaragem}</p>
                <p><strong>Destaque Arquitetônico:</strong> ${spec.destaque}</p>
                <div style="margin-top: 8px;"><strong>Ambientes Principais:</strong></div>
                <ul style="padding-left: 18px; margin-top: 4px; font-size: 12px; color: #94a3b8;">${items}</ul>
            </div>`;
    }

    towerPickList() {
        if (this.isGlbMode && this.glbLoader.root.visible) return this.glbLoader.pickers;
        return this.towerBuilder.towers;
    }

    checkHover(e) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.towerPickList());

        const tooltip = document.getElementById('hover-tooltip');

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            const data = hit.userData;

            if (tooltip) {
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX + 16}px`;
                tooltip.style.top = `${e.clientY + 16}px`;
                tooltip.innerHTML = `
                    <div style="font-weight: bold; color: ${data.corDestaque};">${data.name}</div>
                    <div style="font-size: 11px; opacity: 0.85;">${data.andares} Andares • ${data.tipologia}</div>
                    <div style="font-size: 11px; color: #38bdf8;">${data.metragem}</div>
                `;
            }
            document.body.style.cursor = 'pointer';
        } else {
            if (tooltip) tooltip.style.display = 'none';
            document.body.style.cursor = 'default';
        }
    }

    checkClick() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Verifica primeiro clique em pins de ocorrências
        const pinHits = this.raycaster.intersectObjects(this.occurrencePins, true);
        if (pinHits.length > 0) {
            let pinObj = pinHits[0].object;
            while (pinObj && !pinObj.userData.isOccurrencePin) {
                pinObj = pinObj.parent;
            }
            if (pinObj && pinObj.userData.occurrenceData) {
                this.openOccurrenceModal(pinObj.userData.occurrenceData);
                return;
            }
        }

        // Verifica clique em torres
        const towerHits = this.raycaster.intersectObjects(this.towerPickList());
        if (towerHits.length > 0) {
            this.showTowerDetails(towerHits[0].object.userData);
        }
    }

    showTowerDetails(data) {
        this.selectedTower = data;
        const card = document.getElementById('tower-details-card');
        if (!card) return;

        card.classList.remove('hidden');
        if (this.isCompactLayout()) this.setSidebarOpen(false);

        const setVal = (id, text, color) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = text;
                if (color) el.style.color = color;
            }
        };

        const grupoObj = PARQUE_FIRENZE_DATA.grupos[data.grupoId];

        setVal('detail-tower-title', data.name, data.corDestaque);
        setVal('detail-andares', `${data.andares} Andares`);
        setVal('detail-tipologia', data.tipologia);
        setVal('detail-aptos-andar', `${data.aptosPorAndar} por andar`);
        setVal('detail-aptos-torre', `${data.aptosPorTorre} Apartamentos`);
        setVal('detail-metragens', data.metragem);
        setVal('detail-total-grupo', `${data.totalApartamentosGrupo} Apartamentos`);

        if (grupoObj) {
            setVal('detail-address', grupoObj.endereco);
            setVal('detail-subsolos', grupoObj.subsolos);
            setVal('detail-construida-grupo', grupoObj.areaConstruida);
            setVal('detail-grupo-desc', grupoObj.descricao);

            // Aba Obra
            const obraPct = grupoObj.statusObra.progressoGeral;
            const barEl = document.getElementById('detail-obra-bar');
            if (barEl) barEl.style.width = `${obraPct}%`;
            setVal('detail-obra-pct', `${obraPct}% Concluído`);
            setVal('detail-obra-fase', grupoObj.statusObra.fase);
        }

        // Popula Lista de FVS na aba 3
        const fvsContainer = document.getElementById('detail-fvs-list');
        if (fvsContainer) {
            const towerFvs = PARQUE_FIRENZE_DATA.fvsList.filter(f => f.torre.includes(`Grupo ${data.grupoId}`));
            if (towerFvs.length > 0) {
                fvsContainer.innerHTML = towerFvs.map(f => `
                    <div style="background: rgba(15, 23, 42, 0.5); padding: 8px; border-radius: 6px; cursor: pointer; border: 1px solid rgba(255,255,255,0.06);" onclick="window.app.openFvsModal('${f.id}')">
                        <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 11px;">
                            <span style="color: #38bdf8;">${f.id}</span>
                            <span class="chip-status ${f.resultado === 'CONFORME' ? 'chip-success' : 'chip-warning'}">${f.resultado}</span>
                        </div>
                        <div style="font-size: 11px; margin-top: 4px; color: #cbd5e1;">${f.servico}</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Pav. ${f.pavimento} • ${f.inspetor}</div>
                    </div>
                `).join('');
            } else {
                fvsContainer.innerHTML = `<div style="font-size: 11px; color: #64748b;">Nenhuma FVS cadastrada para esta torre no momento.</div>`;
            }
        }

        // Popula Lista de Ocorrências na aba 4
        const ocorrContainer = document.getElementById('detail-ocorr-list');
        if (ocorrContainer) {
            const towerOcorr = PARQUE_FIRENZE_DATA.ocorrenciasList.filter(o => o.torreNome.includes(`Grupo ${data.grupoId}`));
            if (towerOcorr.length > 0) {
                ocorrContainer.innerHTML = towerOcorr.map(o => `
                    <div style="background: rgba(15, 23, 42, 0.5); padding: 8px; border-radius: 6px; cursor: pointer; border: 1px solid rgba(255,255,255,0.06);" onclick="window.app.openOccurrenceModal(PARQUE_FIRENZE_DATA.ocorrenciasList.find(x => x.id === '${o.id}'))">
                        <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 11px;">
                            <span style="color: ${o.corPin};">${o.id} • ${o.severidade}</span>
                            <span class="chip-status ${o.status === 'RESOLVIDA' ? 'chip-success' : 'chip-danger'}">${o.status}</span>
                        </div>
                        <div style="font-size: 11px; margin-top: 4px; color: #cbd5e1;">${o.titulo}</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Prazo: ${o.prazo} • ${o.responsavel}</div>
                    </div>
                `).join('');
            } else {
                ocorrContainer.innerHTML = `<div style="font-size: 11px; color: #64748b;">Nenhuma ocorrência em aberto para esta torre.</div>`;
            }
        }

        // Move a câmera para enquadrar a torre
        const target = data.worldPos.clone();
        const camPos = new THREE.Vector3(target.x + 45, target.y + 40, target.z + 55);
        this.flyTo(target, camPos, 900);
    }

    openFvsModal(fvsId) {
        const fvs = PARQUE_FIRENZE_DATA.fvsList.find(f => f.id === fvsId);
        if (!fvs) return;

        const modal = document.getElementById('modal-fvs-detail');
        const body = document.getElementById('fvs-modal-body');
        const title = document.getElementById('fvs-modal-title');

        if (title) title.textContent = `${fvs.id} — ${fvs.servico}`;
        if (body) {
            body.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div><strong>Local:</strong> ${fvs.torre} - Pavimento ${fvs.pavimento}</div>
                    <div><strong>Unidade:</strong> ${fvs.unidade}</div>
                    <div><strong>Inspetor:</strong> ${fvs.inspetor}</div>
                    <div><strong>Data da Vistoria:</strong> ${fvs.data}</div>
                </div>
                <h4 style="color: #38bdf8; margin-bottom: 8px;">Checklist de Verificação:</h4>
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px;">
                    ${fvs.itensChecklist.map(i => `
                        <div style="display: flex; justify-content: space-between; background: rgba(30,41,59,0.5); padding: 8px; border-radius: 4px;">
                            <span>${i.item}</span>
                            <span class="chip-status ${i.status === 'OK' ? 'chip-success' : 'chip-warning'}">${i.status}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="background: rgba(16,185,129,0.1); border: 1px solid #10b981; padding: 12px; border-radius: 6px; text-align: center;">
                    <strong>Parecer Final:</strong> <span style="color: #34d399;">${fvs.resultado}</span>
                </div>
            `;
        }

        if (modal) modal.classList.add('active');
    }

    openOccurrenceModal(ocorr) {
        alert(`[Digital Twin] Ocorrência 3D: ${ocorr.id}\n\nLocal: ${ocorr.torreNome} - Pav. ${ocorr.pavimento}\nSeveridade: ${ocorr.severidade}\nTítulo: ${ocorr.titulo}\nStatus: ${ocorr.status}\nResponsável: ${ocorr.responsavel}\nPrazo: ${ocorr.prazo}`);
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.glbLoader.updateLod(this.camera.position);

        // Animação sutil de pulsação nos pins de ocorrências 3D
        if (this.occurrencePins.length > 0) {
            const scalePulse = 1.0 + Math.sin(time * 0.005) * 0.15;
            this.occurrencePins.forEach(p => {
                p.scale.set(scalePulse, scalePulse, scalePulse);
            });
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new ParqueFirenzeApp();
});
