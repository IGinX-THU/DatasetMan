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
                    <div class="toolbar"><label class="switch"><input type="checkbox" id="sideLineage" checked> 显示旁系血缘</label><button id="focus">聚焦当前版本</button><button id="zoomIn">放大</button><button id="zoomOut">缩小</button><button id="resetView">重置视图</button></div>
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
        this.shadowRoot.querySelector('#focus').addEventListener('click', () => this.focusNode());
        this.shadowRoot.querySelector('#zoomIn').addEventListener('click', () => this.zoomBy(1.25));
        this.shadowRoot.querySelector('#zoomOut').addEventListener('click', () => this.zoomBy(0.8));
        this.shadowRoot.querySelector('#resetView').addEventListener('click', () => this.resetView());
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
            const deleted = !!n.deleted;
            echartsNodes.push({
                id: nodeId,
                name: `${n.datasetName || ''}\n${n.versionNo || ''}`,
                symbol: 'circle',
                symbolSize: n.focus ? 64 : 48,
                itemStyle: {
                    color: deleted ? '#cbd5e1' : color,
                    borderColor: n.focus ? '#111827' : (deleted ? '#94a3b8' : '#fff'),
                    borderWidth: n.focus ? 4 : 2,
                    shadowBlur: n.focus ? 12 : 0,
                    shadowColor: color,
                    opacity: deleted ? 0.55 : 1
                },
                label: {
                    show: true,
                    position: 'bottom',
                    fontSize: 11,
                    color: deleted ? '#94a3b8' : '#374151',
                    formatter: () => `${n.datasetName || ''}\n${n.versionNo || ''}`
                },
                nodeType: 'version',
                versionData: n
            });
        });

        // 2. 添加操作节点和边
        //    对于每条 from->to 边，若 to 节点 provenanceType 为 SQL_QUERY/TRANSFORM 等，
        //    在 from 与 to 之间插入一个操作节点，承载 SQL/Transform/UDF 等元数据。
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

            const derivType = toNode ? toNode.provenanceType : null;
            const isOperationTarget = derivType === 'SQL_QUERY' || derivType === 'TRANSFORM'
                || derivType === 'SELECT' || derivType === 'SELECT_UDF'
                || derivType === 'TRANSFORM_SQL';

            if (isOperationTarget) {
                const opNodeId = `op_${fromVid}_${toVid}`;
                if (!operationNodeSet.has(opNodeId)) {
                    operationNodeSet.add(opNodeId);

                    // 从 derivationConfig 提取操作信息
                    const cfg = (toNode && toNode.derivationConfig) || {};
                    const opInfo = this.extractOperationInfo(toNode, cfg);
                    const opLabel = opInfo.type;
                    const opDetail = opInfo.detail;
                    const opFull = opInfo.full;

                    echartsNodes.push({
                        id: opNodeId,
                        name: opDetail ? `${opLabel}\n${opDetail}` : opLabel,
                        symbol: 'roundRect',
                        symbolSize: [120, 44],
                        itemStyle: {
                            color: opInfo.color,
                            borderColor: opInfo.borderColor,
                            borderWidth: 2,
                            borderRadius: 8
                        },
                        label: {
                            show: true,
                            fontSize: 10,
                            color: opInfo.textColor,
                            formatter: () => opDetail ? `${opLabel}\n${opDetail}` : opLabel
                        },
                        nodeType: 'operation',
                        operationType: opLabel,
                        operationDetail: opDetail,
                        operationFull: opFull,
                        fromVersionId: fromVid,
                        toVersionId: toVid
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
                            show: !!e.relationType,
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
                        show: !!e.relationType,
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
                enterable: true,
                confine: true,
                formatter: (params) => {
                    if (params.dataType === 'node') {
                        const d = params.data;
                        if (d.nodeType === 'version') {
                            return this.versionTooltip(d.versionData);
                        } else if (d.nodeType === 'operation') {
                            return this.operationTooltip(d);
                        }
                    }
                    return this.escape(params.name);
                }
            },
            series: [{
                type: 'graph',
                layout: 'force',
                force: {
                    repulsion: 600,
                    edgeLength: [180, 320],
                    gravity: 0.05,
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
        if (container._resizeObserver) container._resizeObserver.disconnect();
        const resizeObserver = new ResizeObserver(() => chart.resize());
        resizeObserver.observe(container);
        container._chart = chart;
        container._resizeObserver = resizeObserver;
    }

    /** 从 derivationConfig 中提取操作节点的展示信息 */
    extractOperationInfo(versionNode, cfg) {
        const provenance = versionNode ? versionNode.provenanceType : null;
        const sql = cfg.sqlSnippet || cfg.sql || null;
        const cmp = cfg.transformCompare || cfg.transformJob || null;
        const archive = cfg.dataArchive || null;
        const udf = cfg.udfFunction || cfg.udf || cfg.functions || null;

        let type = '操作';
        let detail = '';
        let color = '#fef3c7';
        let borderColor = '#f59e0b';
        let textColor = '#92400e';

        if (provenance === 'SQL_QUERY' || provenance === 'SELECT' || provenance === 'SELECT_UDF') {
            type = 'SQL';
            color = '#cffafe'; borderColor = '#06b6d4'; textColor = '#0e7490';
            if (sql && typeof sql === 'object') {
                detail = sql.name || sql.scriptName || '';
            } else if (typeof sql === 'string') {
                detail = 'SQL片段';
            }
            if (udf) {
                type = 'SQL+UDF';
                color = '#ffedd5'; borderColor = '#f97316'; textColor = '#9a3412';
            }
        } else if (provenance === 'TRANSFORM' || provenance === 'TRANSFORM_SQL') {
            type = 'Transform';
            color = '#ede9fe'; borderColor = '#8b5cf6'; textColor = '#6d28d9';
            if (cmp && typeof cmp === 'object') {
                detail = cmp.name || cmp.jobName || cmp.transformName || '';
            }
        }

        const full = {
            type,
            sqlSnippet: sql,
            transformCompare: cmp,
            dataArchive: archive,
            udfFunction: udf,
            operator: versionNode ? versionNode.operator : null,
            operateTime: versionNode ? this.formatTime(versionNode.createTime) : null,
            operateIp: versionNode ? versionNode.clientIp : null,
            remark: versionNode ? versionNode.remark : null,
            changeProcess: cfg.changeProcess || cfg.description || null,
            description: cfg.description || (versionNode ? versionNode.remark : null),
            potentialUsers: cfg.potentialUsers || null
        };
        return { type, detail, color, borderColor, textColor, full };
    }

    /** 版本节点 tooltip：还原旧实现的丰富字段 */
    versionTooltip(v) {
        if (!v) return '';
        const cfg = v.derivationConfig || {};
        const rows = [];
        rows.push(`<b>${this.escape(v.datasetName)} / ${this.escape(v.versionNo)}</b>`);
        rows.push(`产出方式: ${this.escape(v.provenanceLabel || v.provenanceType)}`);
        rows.push(`存储路径: <code>${this.escape(v.storagePath || '-')}</code>`);
        rows.push(`操作人: ${this.escape(v.operator || '-')}`);
        rows.push(`操作时间: ${this.formatTime(v.createTime)}`);
        rows.push(`客户端IP: ${this.escape(v.clientIp || '-')}`);
        rows.push(`状态: ${v.deleted ? '<span style="color:#dc2626">已删除</span>' : '<span style="color:#16a34a">正常</span>'}`);
        if (v.remark) rows.push(`备注: ${this.escape(v.remark)}`);
        const desc = cfg.description || cfg.background;
        if (desc) rows.push(`背景信息: ${this.escape(desc)}`);
        const change = cfg.changeProcess || cfg.change;
        if (change) rows.push(`变化过程: ${this.escape(change)}`);
        const users = cfg.potentialUsers;
        if (users) rows.push(`潜在用户: ${this.escape(typeof users === 'string' ? users : JSON.stringify(users))}`);
        const sql = cfg.sqlSnippet || cfg.sql;
        if (sql) rows.push(`SQL脚本: <pre style="margin:4px 0;max-width:380px;white-space:pre-wrap">${this.escape(typeof sql === 'string' ? sql : JSON.stringify(sql, null, 2))}</pre>`);
        const udf = cfg.udfFunction || cfg.udf || cfg.functions;
        if (udf) rows.push(`UDF函数: ${this.escape(typeof udf === 'string' ? udf : JSON.stringify(udf))}`);
        const cmp = cfg.transformCompare || cfg.transformJob;
        if (cmp) rows.push(`Transform作业: ${this.escape(typeof cmp === 'string' ? cmp : JSON.stringify(cmp, null, 2))}`);
        return rows.join('<br/>');
    }

    /** 操作节点 tooltip */
    operationTooltip(d) {
        const f = d.operationFull || {};
        const rows = [];
        rows.push(`<b>${this.escape(d.operationType || '操作')}</b>`);
        if (d.operationDetail) rows.push(`名称: ${this.escape(d.operationDetail)}`);
        if (f.operator) rows.push(`操作人: ${this.escape(f.operator)}`);
        if (f.operateTime) rows.push(`操作时间: ${this.escape(f.operateTime)}`);
        if (f.operateIp) rows.push(`客户端IP: ${this.escape(f.operateIp)}`);
        if (f.remark) rows.push(`备注: ${this.escape(f.remark)}`);
        if (f.changeProcess) rows.push(`变化过程: ${this.escape(f.changeProcess)}`);
        if (f.description) rows.push(`背景信息: ${this.escape(f.description)}`);
        if (f.potentialUsers) rows.push(`潜在用户: ${this.escape(typeof f.potentialUsers === 'string' ? f.potentialUsers : JSON.stringify(f.potentialUsers))}`);
        if (f.sqlSnippet) rows.push(`SQL脚本: <pre style="margin:4px 0;max-width:380px;white-space:pre-wrap">${this.escape(typeof f.sqlSnippet === 'string' ? f.sqlSnippet : JSON.stringify(f.sqlSnippet, null, 2))}</pre>`);
        if (f.udfFunction) rows.push(`UDF函数: ${this.escape(typeof f.udfFunction === 'string' ? f.udfFunction : JSON.stringify(f.udfFunction))}`);
        if (f.transformCompare) rows.push(`Transform配置: <pre style="margin:4px 0;max-width:380px;white-space:pre-wrap">${this.escape(typeof f.transformCompare === 'string' ? f.transformCompare : JSON.stringify(f.transformCompare, null, 2))}</pre>`);
        if (f.dataArchive) rows.push(`数据归档: ${this.escape(typeof f.dataArchive === 'string' ? f.dataArchive : JSON.stringify(f.dataArchive))}`);
        return rows.join('<br/>');
    }

    /** 聚焦当前版本节点：放大并居中 */
    focusNode() {
        const container = this.shadowRoot.querySelector('#graph');
        const chart = container._chart;
        if (!chart || !this.version) return;
        const vid = this.versionIdOf(this.version);
        if (vid == null) return;
        const nodeId = `v_${vid}`;
        chart.dispatchAction({ type: 'focusNode', seriesIndex: 0, nodeId });
        chart.dispatchAction({ type: 'highlight', seriesIndex: 0, nodeId });
        this.highlight(vid);
    }

    zoomBy(factor) {
        const container = this.shadowRoot.querySelector('#graph');
        const chart = container._chart;
        if (!chart) return;
        const option = chart.getOption();
        const series = option.series[0] || {};
        const curZoom = series.zoom || 1;
        // ECharts graph roam 通过 setOption 改 zoom 不直接生效，使用 dispatchAction 平移缩放
        // 这里使用 dataZoom 思路不可行，改用 setOption + force 重新布局的方式不可取，
        // 因此使用 ECharts 内部 zoom 行为：通过 setOption 修改 series.zoom
        chart.setOption({ series: [{ zoom: curZoom * factor }] });
    }

    resetView() {
        const container = this.shadowRoot.querySelector('#graph');
        const chart = container._chart;
        if (!chart) return;
        chart.setOption({ series: [{ zoom: 1, center: null }] });
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
