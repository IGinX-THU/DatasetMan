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
                .badge.deleted { background:#fef2f2; color:#dc2626; }
                .badge.active-status { background:#f0fdf4; color:#16a34a; }
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
        container.innerHTML = `<table><thead><tr><th>版本</th><th>产出方式</th><th>存储路径</th><th>上游版本</th><th>变化配置</th><th>操作人</th><th>时间</th><th>备注</th><th>状态</th></tr></thead><tbody>${this.changes.map(row => {
            const upstreams = (row.upstreams || []).map(u => `${u.datasetName || ''}/${u.versionNo || u.versionId}`).join(', ') || '-';
            const recipe = this.recipeSummary(row.derivationConfig);
            const activeVid = this.versionIdOf(this.version);
            const statusBadge = row.deleted ? '<span class="badge deleted">已删除</span>' : '<span class="badge active-status">正常</span>';
            return `<tr data-version-id="${row.versionId}" class="${row.versionId === activeVid ? 'active' : ''}"><td>${this.escape(row.versionNo)}</td><td><span class="badge ${row.provenanceType}">${this.escape(row.provenanceLabel || row.provenanceType)}</span></td><td><code>${this.escape(row.storagePath || '-')}</code></td><td>${this.escape(upstreams)}</td><td title="${this.escape(JSON.stringify(row.derivationConfig || {}))}">${this.escape(recipe)}</td><td>${this.escape(row.operator || '-')}</td><td>${this.escape(this.formatTime(row.createTime))}</td><td>${this.escape(row.remark || '-')}</td><td>${statusBadge}</td></tr>`;
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

        // 确保 echarts 已加载
        if (!window.echarts) {
            const script = document.createElement('script');
            script.src = './lib/echarts/echarts.min.js';
            script.onload = () => this.renderGraph();
            document.head.appendChild(script);
            container.innerHTML = '<div class="empty">正在加载图表组件...</div>';
            return;
        }

        // 销毁旧图表
        const existing = window.echarts.getInstanceByDom(container);
        if (existing) existing.dispose();

        const colors = {
            SOURCE: '#3b82f6',
            SQL_QUERY: '#06b6d4',
            SELECT: '#06b6d4',
            SELECT_UDF: '#f97316',
            TRANSFORM: '#8b5cf6',
            TRANSFORM_SQL: '#8b5cf6'
        };

        // 构建节点和边
        // 节点类型：version（数据集版本，圆形）、operation（SQL/Transform操作，矩形）
        const echartsNodes = [];
        const echartsLinks = [];
        const versionKeyMap = new Map(); // versionId -> echarts node id

        // 1. 添加版本节点
        nodes.forEach(n => {
            const vid = n.versionId || n.createTime;
            const nodeId = `v_${vid}`;
            versionKeyMap.set(vid, nodeId);
            versionKeyMap.set(n.versionId, nodeId);

            const color = colors[n.provenanceType] || '#64748b';
            echartsNodes.push({
                id: nodeId,
                name: `${n.datasetName}\n${n.versionNo}`,
                symbol: 'circle',
                symbolSize: n.focus ? 60 : 45,
                itemStyle: {
                    color: color,
                    borderColor: n.focus ? '#111827' : '#fff',
                    borderWidth: n.focus ? 4 : 2,
                    shadowBlur: n.focus ? 10 : 0,
                    shadowColor: color
                },
                label: {
                    show: true,
                    position: 'bottom',
                    fontSize: 11,
                    color: '#374151',
                    formatter: () => `${n.datasetName}\n${n.versionNo}`
                },
                nodeType: 'version',
                versionData: n
            });
        });

        // 2. 添加操作节点和边
        // 对于每条边 from->to，如果 to 节点的 provenanceType 是 SQL_QUERY 或 TRANSFORM，
        // 则在 from 和 to 之间插入一个操作节点
        const operationNodeSet = new Set();
        const edges = this.graph.edges || [];
        const nodeMap = new Map();
        nodes.forEach(n => { nodeMap.set(n.versionId || n.createTime, n); });

        edges.forEach((e, idx) => {
            const fromVid = e.from;
            const toVid = e.to;
            const toNode = nodeMap.get(toVid);
            const fromNodeId = versionKeyMap.get(fromVid);
            const toNodeId = versionKeyMap.get(toVid);

            if (!fromNodeId || !toNodeId) return;

            // 如果目标节点是 SQL_QUERY 或 TRANSFORM，插入操作节点
            if (toNode && (toNode.provenanceType === 'SQL_QUERY' || toNode.provenanceType === 'TRANSFORM'
                    || toNode.provenanceType === 'SELECT' || toNode.provenanceType === 'SELECT_UDF'
                    || toNode.provenanceType === 'TRANSFORM_SQL')) {
                const opNodeId = `op_${fromVid}_${toVid}`;
                if (!operationNodeSet.has(opNodeId)) {
                    operationNodeSet.add(opNodeId);

                    // 从 derivationConfig 提取操作信息
                    const config = toNode.derivationConfig || {};
                    let opLabel = toNode.provenanceLabel || toNode.provenanceType;
                    let opDetail = '';
                    if (config.sqlSnippet && config.sqlSnippet.name) {
                        opLabel = 'SQL';
                        opDetail = config.sqlSnippet.name;
                    } else if (config.transformCompare && config.transformCompare.name) {
                        opLabel = 'Transform';
                        opDetail = config.transformCompare.name;
                    }

                    echartsNodes.push({
                        id: opNodeId,
                        name: opDetail ? `${opLabel}\n${opDetail}` : opLabel,
                        symbol: 'roundRect',
                        symbolSize: [100, 40],
                        itemStyle: {
                            color: '#fef3c7',
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            borderRadius: 6
                        },
                        label: {
                            show: true,
                            fontSize: 10,
                            color: '#92400e',
                            formatter: () => opDetail ? `${opLabel}\n${opDetail}` : opLabel
                        },
                        nodeType: 'operation',
                        operationType: opLabel,
                        operationDetail: opDetail
                    });

                    // 边：from -> operation
                    echartsLinks.push({
                        source: fromNodeId,
                        target: opNodeId,
                        lineStyle: {
                            color: e.primary ? '#94a3b8' : '#cbd5e1',
                            width: 2,
                            type: e.primary ? 'solid' : 'dashed'
                        }
                    });
                    // 边：operation -> to
                    echartsLinks.push({
                        source: opNodeId,
                        target: toNodeId,
                        lineStyle: {
                            color: e.primary ? '#94a3b8' : '#cbd5e1',
                            width: 2,
                            type: e.primary ? 'solid' : 'dashed'
                        },
                        label: {
                            show: true,
                            formatter: e.relationType || '',
                            fontSize: 9,
                            color: '#64748b'
                        }
                    });
                }
            } else {
                // 直接连接 from -> to
                echartsLinks.push({
                    source: fromNodeId,
                    target: toNodeId,
                    lineStyle: {
                        color: e.primary ? '#94a3b8' : '#cbd5e1',
                        width: 2,
                        type: e.primary ? 'solid' : 'dashed'
                    },
                    label: {
                        show: true,
                        formatter: e.relationType || '',
                        fontSize: 9,
                        color: '#64748b'
                    }
                });
            }
        });

        // 3. 初始化 ECharts
        const chart = window.echarts.init(container);
        const option = {
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    if (params.dataType === 'node') {
                        const d = params.data;
                        if (d.nodeType === 'version') {
                            const v = d.versionData;
                            return `<b>${v.datasetName} / ${v.versionNo}</b><br/>` +
                                `产出方式: ${v.provenanceLabel || v.provenanceType}<br/>` +
                                `存储路径: ${v.storagePath || '-'}<br/>` +
                                `创建者: ${v.operator || '-'}<br/>` +
                                `创建时间: ${this.formatTime(v.createTime)}`;
                        } else if (d.nodeType === 'operation') {
                            return `<b>${d.operationType}</b>${d.operationDetail ? '<br/>' + d.operationDetail : ''}`;
                        }
                    }
                    return params.name;
                }
            },
            series: [{
                type: 'graph',
                layout: 'force',
                force: {
                    repulsion: 400,
                    edgeLength: [150, 250],
                    gravity: 0.08,
                    layoutAnimation: true
                },
                roam: true,
                draggable: true,
                symbol: 'circle',
                edgeSymbol: ['none', 'arrow'],
                edgeSymbolSize: [0, 12],
                lineStyle: {
                    color: '#94a3b8',
                    width: 2,
                    curveness: 0.15,
                    opacity: 0.8
                },
                label: {
                    show: true,
                    fontSize: 11,
                    color: '#374151'
                },
                emphasis: {
                    focus: 'adjacency',
                    lineStyle: { width: 3 }
                },
                data: echartsNodes,
                links: echartsLinks
            }]
        };
        chart.setOption(option);

        // 点击版本节点 -> 高亮对应行
        chart.on('click', (params) => {
            if (params.dataType === 'node' && params.data.nodeType === 'version') {
                const v = params.data.versionData;
                const vid = v.versionId || v.createTime;
                this.highlight(vid);
            }
        });

        // Resize
        const resizeObserver = new ResizeObserver(() => chart.resize());
        resizeObserver.observe(container);
        container._chart = chart;
        container._resizeObserver = resizeObserver;
    }

    highlight(versionId) {
        this.shadowRoot.querySelectorAll('#changeTable tbody tr').forEach(row => {
            const rowVid = Number(row.dataset.versionId);
            row.classList.toggle('active', rowVid === versionId || rowVid === Number(versionId));
        });
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
