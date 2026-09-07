class DatasetHistory extends HTMLElement {
    constructor() {
        super();
        this.selection = null;
        this.version = null;
        this.changes = [];
        this.graph = { nodes: [], edges: [] };
        this.sideLineage = true;
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.bindEvents();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display:none; height:100%; overflow:auto; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#1f2937; }
                :host([show]) { display:block; }
                .page { padding:24px 32px; }
                .card { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:18px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
                .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
                h3 { margin:0; font-size:16px; }
                .actions { display:flex; gap:8px; }
                button { padding:7px 14px; border-radius:5px; cursor:pointer; font-size:13px; border:1px solid #d1d5db; background:#fff; }
                .primary { background:#2563eb; color:#fff; border-color:#2563eb; }
                .danger { background:#ef4444; color:#fff; border-color:#ef4444; }
                .info { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px 24px; }
                .item label { display:block; color:#6b7280; font-size:12px; margin-bottom:5px; }
                .item span { font-size:14px; word-break:break-all; }
                .item.wide { grid-column:1/-1; }
                pre { margin:0; padding:12px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:5px; white-space:pre-wrap; font-size:12px; max-height:180px; overflow:auto; }
                .toolbar { display:flex; gap:12px; align-items:center; margin-bottom:12px; }
                .switch { display:flex; align-items:center; gap:6px; font-size:13px; }
                table { width:100%; border-collapse:collapse; font-size:13px; }
                th,td { padding:10px 12px; border-bottom:1px solid #e5e7eb; text-align:left; vertical-align:top; }
                th { background:#f8fafc; color:#4b5563; }
                tbody tr { cursor:pointer; }
                tbody tr:hover { background:#f9fafb; }
                tbody tr.active { background:#dbeafe; }
                .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; white-space:nowrap; }
                .SOURCE { background:#dbeafe; color:#1d4ed8; }
                .SQL_QUERY, .SELECT, .SELECT_UDF { background:#cffafe; color:#0e7490; }
                .TRANSFORM, .TRANSFORM_SQL { background:#ede9fe; color:#6d28d9; }
                .graph { width:100%; min-height:380px; overflow:auto; border:1px solid #e5e7eb; border-radius:6px; background:#fafafa; }
                .node { cursor:pointer; } .node circle { stroke:#fff; stroke-width:3; } .node.focus circle { stroke:#111827; stroke-width:4; }
                .node text { font-size:11px; fill:#374151; text-anchor:middle; }
                .empty { padding:40px; color:#9ca3af; text-align:center; }
            </style>
            <div class="page">
                <div class="card">
                    <div class="header"><h3>数据集档案</h3><div class="actions"><button class="primary" id="newVersion">创建新版本</button><button class="danger" id="deleteVersion">删除当前版本</button></div></div>
                    <div class="info">
                        <div class="item"><label>数据集名称</label><span id="name">-</span></div>
                        <div class="item"><label>版本号</label><span id="versionNo">-</span></div>
                        <div class="item"><label>产出方式</label><span id="type">-</span></div>
                        <div class="item"><label>存储路径</label><span id="path">-</span></div>
                        <div class="item"><label>创建者</label><span id="operator">-</span></div>
                        <div class="item"><label>创建时间</label><span id="time">-</span></div>
                        <div class="item wide"><label>版本备注</label><span id="remark">-</span></div>
                        <div class="item wide"><label>变化配置</label><pre id="recipe">-</pre></div>
                    </div>
                </div>
                <div class="card">
                    <div class="header"><h3>变化过程</h3></div>
                    <div id="changeTable"></div>
                </div>
                <div class="card">
                    <div class="header"><h3>血缘图谱</h3></div>
                    <div class="toolbar"><label class="switch"><input type="checkbox" id="sideLineage" checked> 显示旁系血缘</label><button id="focus">聚焦当前版本</button></div>
                    <div class="graph" id="graph"></div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.shadowRoot.querySelector('#sideLineage').addEventListener('change', e => {
            this.sideLineage = e.target.checked;
            this.loadGraph();
        });
        this.shadowRoot.querySelector('#focus').addEventListener('click', () => this.highlight(this.version?.id));
        this.shadowRoot.querySelector('#newVersion').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('edit-dataset', { bubbles:true, composed:true, detail:this.version }));
        });
        this.shadowRoot.querySelector('#deleteVersion').addEventListener('click', () => this.deleteCurrent());
    }

    async show(selection) {
        this.setAttribute('show', '');
        this.selection = typeof selection === 'object' ? selection : { storagePath: selection };
        try {
            if (!this.selection.versionId) {
                throw new Error('缺少数据集版本ID，请刷新右侧数据集树');
            }
            if (!this.selection.datasetId) {
                throw new Error('缺少数据集ID，请刷新右侧数据集树');
            }
            const [meta, changes] = await Promise.all([
                window.AppConfig.get('dataset', 'versionMetas', { versionId:this.selection.versionId }),
                window.AppConfig.get('dataset', 'changes', { datasetId:this.selection.datasetId })
            ]);
            if (!(meta.success || meta.code === 200) || !meta.data) throw new Error(meta.message || '版本详情加载失败');
            this.version = meta.data;
            const vid = this.versionIdOf(this.version);
            if (vid == null) {
                throw new Error('版本详情缺少版本ID，无法加载血缘');
            }
            this.changes = ((changes.success || changes.code === 200) && changes.data) ? changes.data : [];
            this.renderOverview();
            this.renderChangeTable();
            await this.loadGraph();
        } catch (error) {
            this.shadowRoot.querySelector('#changeTable').innerHTML = `<div class="empty">${this.escape(error.message)}</div>`;
        }
    }

    hide() {
        this.removeAttribute('show');
    }

    renderOverview() {
        const v = this.version;
        const labels = {
            SOURCE: '数据源挂载',
            SQL_QUERY: 'SQL查询/转换',
            TRANSFORM: 'Transform变换',
            SELECT: 'SQL查询',
            SELECT_UDF: 'SQL+UDF处理',
            TRANSFORM_SQL: 'Transform变换'
        };
        this.setText('#name', v.datasetName);
        this.setText('#versionNo', v.versionNo);
        this.setText('#type', labels[v.provenanceType] || v.provenanceType);
        this.setText('#path', v.storagePath);
        this.setText('#operator', v.operator || '-');
        this.setText('#time', this.formatTime(v.createTime));
        this.setText('#remark', v.remark || '-');
        let recipe = v.derivationConfig || '{}';
        try { recipe = JSON.stringify(JSON.parse(recipe), null, 2); } catch (e) {}
        this.setText('#recipe', recipe);
    }

    renderChangeTable() {
        const container = this.shadowRoot.querySelector('#changeTable');
        if (!this.changes.length) {
            container.innerHTML = '<div class="empty">暂无变化记录</div>';
            return;
        }
        container.innerHTML = `<table><thead><tr><th>版本</th><th>产出方式</th><th>存储路径</th><th>上游版本</th><th>变化配置</th><th>操作人</th><th>时间</th><th>备注</th></tr></thead><tbody>${this.changes.map(row => {
            const upstreams = (row.upstreams || []).map(u => `${u.datasetName || ''}/${u.versionNo || u.versionId}`).join(', ') || '-';
            const recipe = this.recipeSummary(row.derivationConfig);
            const activeVid = this.versionIdOf(this.version);
            return `<tr data-version-id="${row.versionId}" class="${row.versionId === activeVid ? 'active' : ''}"><td>${this.escape(row.versionNo)}</td><td><span class="badge ${row.provenanceType}">${this.escape(row.provenanceLabel || row.provenanceType)}</span></td><td><code>${this.escape(row.storagePath || '-')}</code></td><td>${this.escape(upstreams)}</td><td title="${this.escape(JSON.stringify(row.derivationConfig || {}))}">${this.escape(recipe)}</td><td>${this.escape(row.operator || '-')}</td><td>${this.escape(this.formatTime(row.createTime))}</td><td>${this.escape(row.remark || '-')}</td></tr>`;
        }).join('')}</tbody></table>`;
        container.querySelectorAll('tbody tr').forEach(row => row.addEventListener('click', () => this.highlight(Number(row.dataset.versionId))));
    }

    async loadGraph() {
        const vid = this.versionIdOf(this.version);
        if (vid == null) {
            this.graph = { nodes:[], edges:[] };
            this.renderGraph();
            return;
        }
        const result = await window.AppConfig.get('dataset', 'lineage', { versionId:vid, sideLineage:this.sideLineage });
        this.graph = ((result.success || result.code === 200) && result.data) ? result.data : { nodes:[], edges:[] };
        this.renderGraph();
    }

    renderGraph() {
        const container = this.shadowRoot.querySelector('#graph');
        const nodes = this.graph.nodes || [];
        if (!nodes.length) {
            container.innerHTML = '<div class="empty">暂无血缘数据</div>';
            return;
        }
        const ordered = [...nodes].sort((a,b) => a.createTime - b.createTime);
        const datasetRows = [...new Set(ordered.map(n => n.datasetId))];
        const width = Math.max(760, ordered.length * 170 + 100);
        const height = Math.max(360, datasetRows.length * 130 + 100);
        const position = new Map();
        ordered.forEach((n,i) => position.set(n.versionId, { x:80 + i * 160, y:80 + datasetRows.indexOf(n.datasetId) * 120 }));
        const colors = {
            SOURCE: '#3b82f6',
            SQL_QUERY: '#06b6d4',
            SELECT: '#06b6d4',
            SELECT_UDF: '#f97316',
            TRANSFORM: '#8b5cf6',
            TRANSFORM_SQL: '#8b5cf6'
        };
        container.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"></path></marker></defs>${(this.graph.edges || []).map(e => {
            const from=position.get(e.from), to=position.get(e.to); if(!from||!to)return '';
            return `<line x1="${from.x+24}" y1="${from.y}" x2="${to.x-24}" y2="${to.y}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="${e.primary ? '' : '6 5'}" marker-end="url(#arrow)"></line><text x="${(from.x+to.x)/2}" y="${(from.y+to.y)/2-7}" font-size="10" fill="#64748b" text-anchor="middle">${this.escape(e.relationType)}</text>`;
        }).join('')}${ordered.map(n => { const p=position.get(n.versionId); return `<g class="node ${n.focus?'focus':''}" data-version-id="${n.versionId}" transform="translate(${p.x},${p.y})"><circle r="24" fill="${colors[n.provenanceType] || '#64748b'}"></circle><text y="42">${this.escape(n.datasetName)}</text><text y="57">${this.escape(n.versionNo)}</text></g>`; }).join('')}</svg>`;
        container.querySelectorAll('.node').forEach(node => node.addEventListener('click', () => this.highlight(Number(node.dataset.versionId))));
    }

    highlight(versionId) {
        this.shadowRoot.querySelectorAll('#changeTable tbody tr').forEach(row => row.classList.toggle('active', Number(row.dataset.versionId) === versionId));
        this.shadowRoot.querySelectorAll('.node').forEach(node => node.classList.toggle('focus', Number(node.dataset.versionId) === versionId));
        const row = this.shadowRoot.querySelector(`#changeTable tr[data-version-id="${versionId}"]`);
        if (row) row.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }

    async deleteCurrent() {
        if (!this.version || !window.confirm(`确定删除 ${this.version.datasetName}/${this.version.versionNo} 吗？`)) return;
        const vid = this.versionIdOf(this.version);
        if (vid == null) {
            if (window.CommonUtils?.showToast) window.CommonUtils.showToast('版本ID缺失，无法删除', 'error'); else alert('版本ID缺失，无法删除');
            return;
        }
        try {
            const result = await window.AppConfig.delete('dataset', 'versionDelete', { versionId:vid });
            if (!(result.success || result.code === 200)) throw new Error(result.message || '删除失败');
            this.dispatchEvent(new CustomEvent('dataset-deleted', { bubbles:true, composed:true, detail:this.version }));
            if (window.loadDataSourceTree) await window.loadDataSourceTree();
            if (window.loadDatasetTree) await window.loadDatasetTree();
        } catch (error) {
            if (window.CommonUtils?.showToast) window.CommonUtils.showToast(error.message, 'error'); else alert(error.message);
        }
    }

    recipeSummary(config) {
        if (!config) return '-';
        return config.sqlSnippetName || config.transformJobName || config.tablePrefix || '-';
    }

    /** 与后端树组装保持一致：id 缺失时回退到 createTime 作为版本ID */
    versionIdOf(v) {
        if (!v) return null;
        const id = v.id != null ? v.id : v.createTime;
        return id != null ? Number(id) : null;
    }

    setText(selector, value) { this.shadowRoot.querySelector(selector).textContent = value == null || value === '' ? '-' : value; }
    formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN') : '-'; }
    escape(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
}

customElements.define('dataset-history', DatasetHistory);
