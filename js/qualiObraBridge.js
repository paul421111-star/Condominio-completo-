/**
 * Integração com o QualiObra (FVS / Status da Obra).
 *
 * A maquete roda num iframe servido pelo próprio QualiObra (mesmo domínio). O app
 * pai envia o token de login por postMessage; com ele a maquete lê
 * /api/maquete/obra-status e desenha cada torre no estágio real da obra.
 * Aberta fora do QualiObra, a maquete continua com os dados de demonstração.
 */
const OBRA_STAGES = {
    nao_iniciado: { label: 'Não iniciado', color: '#64748b', chip: 'chip-warning' },
    fundacao: { label: 'Fundação / Subsolos', color: '#a16207', chip: 'chip-warning' },
    estrutura: { label: 'Estrutura', color: '#ef4444', chip: 'chip-danger' },
    vedacao: { label: 'Alvenaria / Instalações', color: '#f59e0b', chip: 'chip-warning' },
    acabamento: { label: 'Fachada / Acabamento', color: '#84cc16', chip: 'chip-success' },
    entregue: { label: 'Habite-se', color: '#10b981', chip: 'chip-success' },
    sem_registro: { label: 'Sem lançamentos', color: '#94a3b8', chip: 'chip-warning' }
};

const ACTIVITY_KIND_STYLE = {
    finalizado: { color: '#34d399', text: 'Finalizado' },
    andamento: { color: '#fbbf24', text: 'Em andamento' },
    vazio: { color: '#64748b', text: 'A fazer' }
};

class QualiObraBridge {
    constructor(app) {
        this.app = app;
        this.token = null;
        this.byKey = new Map();
        this.updatedAt = null;
        this.embedded = window.parent !== window;
        this.materials = {
            concrete: new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95 }),
            masonry: new THREE.MeshStandardMaterial({ color: 0xb4764f, roughness: 0.9 }),
            crane: new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5, metalness: 0.3 })
        };
        if (!this.embedded) return;

        window.addEventListener('message', (e) => this.onMessage(e));
        window.parent.postMessage({ type: 'maquete:ready' }, location.origin);
        this.refreshTimer = setInterval(() => this.token && this.refresh(), 5 * 60 * 1000);
    }

    onMessage(e) {
        if (e.origin !== location.origin || e.source !== window.parent) return;
        const msg = e.data || {};
        if (msg.type === 'qualiobra:auth' && typeof msg.token === 'string') {
            this.token = msg.token;
            this.refresh();
        }
    }

    async refresh() {
        this.setBadge('QualiObra: carregando status da obra…');
        try {
            const res = await fetch('/api/maquete/obra-status', {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.apply(data.towers || []);
            this.updatedAt = new Date();
            const hh = this.updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            this.setBadge(`QualiObra conectado • ${this.byKey.size} torres • ${hh}`);
        } catch (err) {
            console.warn('[QualiObra]', err);
            this.setBadge(`QualiObra indisponível (${err.message})`, true);
        }
    }

    apply(towers) {
        this.byKey.clear();
        towers.forEach((t) => this.byKey.set(`${t.group}_${t.block}`, t));
        this.app.towerBuilder.towers.forEach((col) => {
            const d = col.userData;
            const info = this.byKey.get(`${d.grupoId}_${d.bloco}`) || null;
            d.fvs = info;
            this.renderStage(d, info);
        });
        if (this.app.selectedTower) this.app.showTowerDetails(this.app.selectedTower);
        if (this.app.isWorkStatusMode) this.app.toggleWorkStatusHeatmap(true);
    }

    builtFloors(d, info) {
        if (!info || info.stage === 'sem_registro') return d.andares;
        if (info.structureFloors == null) return Math.round(d.andares / 2);
        return Math.max(0, Math.min(d.andares, info.structureFloors));
    }

    renderStage(d, info) {
        const group = d.towerGroup;
        if (!group) return;
        const stage = info?.stage || 'sem_registro';
        const raw = stage === 'nao_iniciado' || stage === 'fundacao' || stage === 'estrutura';
        const bodyMat = raw ? this.materials.concrete : stage === 'vedacao' ? this.materials.masonry : null;
        const finished = stage === 'acabamento' || stage === 'entregue' || stage === 'sem_registro';

        group.children.forEach((child) => {
            if (!child.isMesh) return;
            const u = child.userData;
            if (u.bodyHeight) {
                if (!u.stageOrigMat) u.stageOrigMat = child.material;
                child.material = bodyMat || u.stageOrigMat;
            }
            if (u.perFloor && child.material === this.app.towerBuilder.materials.glassBalcony) {
                child.visible = finished;
            }
        });

        const floors = this.builtFloors(d, info);
        this.app.sliceProceduralTower(d, floors);
        if (!info?.roofDone && stage !== 'sem_registro') {
            group.children.forEach((c) => { if (c.userData.roof) c.visible = false; });
        }
        this.setCrane(d, stage === 'estrutura' ? floors * 0.85 : null);
    }

    setCrane(d, height) {
        const group = d.towerGroup;
        if (group.userData.crane) {
            group.remove(group.userData.crane);
            group.userData.crane = null;
        }
        if (height == null) return;

        const crane = new THREE.Group();
        const mastH = height + 14;
        const mast = new THREE.Mesh(new THREE.BoxGeometry(1.4, mastH, 1.4), this.materials.crane);
        mast.position.y = mastH / 2;
        const jib = new THREE.Mesh(new THREE.BoxGeometry(34, 0.9, 0.9), this.materials.crane);
        jib.position.set(-9, mastH, 0);
        const counterweight = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2), this.materials.concrete);
        counterweight.position.set(6.5, mastH - 0.6, 0);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2), this.materials.crane);
        cab.position.set(0, mastH - 1.6, 1.4);
        crane.add(mast, jib, counterweight, cab);
        crane.traverse((m) => { m.castShadow = true; });
        crane.position.set(13, 0, 13);
        crane.rotation.y = (d.bloco.charCodeAt(0) % 4) * 0.7;
        group.add(crane);
        group.userData.crane = crane;
    }

    openBlock(group, block) {
        if (!this.embedded) return;
        window.parent.postMessage({ type: 'maquete:open-block', group, block }, location.origin);
    }

    setBadge(text, isError = false) {
        const el = document.getElementById('qualiobra-badge');
        if (!el) return;
        el.textContent = text;
        el.classList.remove('hidden');
        el.classList.toggle('is-error', isError);
    }

    renderTowerCard(d) {
        const info = d.fvs;
        const box = document.getElementById('detail-obra-etapas');
        const openBtn = document.getElementById('btn-open-qualiobra');
        if (openBtn) {
            openBtn.classList.toggle('hidden', !this.embedded);
            openBtn.onclick = () => this.openBlock(d.grupoId, d.bloco);
        }
        if (!info || !box) return false;

        const stage = OBRA_STAGES[info.stage] || OBRA_STAGES.sem_registro;
        const bar = document.getElementById('detail-obra-bar');
        if (bar) bar.style.width = `${info.progress}%`;
        const pct = document.getElementById('detail-obra-pct');
        if (pct) pct.textContent = `${info.progress}% das etapas`;
        const fase = document.getElementById('detail-obra-fase');
        if (fase) {
            fase.textContent = stage.label;
            fase.className = `chip-status ${stage.chip}`;
        }

        const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const structure = info.structureFloors == null ? 'em andamento' : `${info.structureFloors} de ${d.andares} lajes`;
        const current = info.activities.filter((a) => a.kind === 'andamento');
        const rows = (current.length ? current : info.activities.filter((a) => a.kind !== 'vazio').slice(-4))
            .map((a) => {
                const st = ACTIVITY_KIND_STYLE[a.kind];
                const detail = a.statusText && a.kind === 'andamento' ? ` — ${esc(a.statusText)}` : '';
                return `<div class="spec-row"><span class="spec-label">${esc(a.label)}:</span>` +
                    `<span class="spec-val" style="color:${st.color};">${st.text}${detail}</span></div>`;
            }).join('');

        box.innerHTML = `
            <div class="spec-row"><span class="spec-label">Estrutura:</span><span class="spec-val">${structure}</span></div>
            <div class="spec-row"><span class="spec-label">Etapas finalizadas:</span><span class="spec-val">${info.done} de ${info.activities.length}</span></div>
            ${rows || '<div style="font-size: 11px; color: #64748b;">Nenhuma etapa lançada no Status da Obra.</div>'}
            <div style="font-size: 10px; color: #64748b; margin-top: 6px;">Fonte: QualiObra • Status da Obra${info.updatedAt ? ` • ${new Date(info.updatedAt).toLocaleDateString('pt-BR')}` : ''}</div>`;
        return true;
    }
}
