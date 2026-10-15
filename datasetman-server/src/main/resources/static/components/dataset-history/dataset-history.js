class DatasetHistory extends HTMLElement {
    constructor() {
        super();
        this.selection = null;
        this.version = null;
        this.changes = [];
        this.graph = { nodes: [], edges: [] };
        this.sideLineage = false; // 旁系血缘默认不显示，可在工具栏开启
        this.forkMode = false;   // 路径重跑选择模式
        this.forkChain = [];     // 已选路径版本ID（有序）
        this._echartsNodesCache = [];
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
                .graph { width:100%; height:1000px; overflow:hidden; border:1px solid #e5e7eb; border-radius:6px; background:#fafafa; box-sizing:border-box; }
                .node { cursor:pointer; } .node circle { stroke:#fff; stroke-width:3; } .node.focus circle { stroke:#111827; stroke-width:4; }
                .node text { font-size:11px; fill:#374151; text-anchor:middle; }
                .empty { padding:40px; color:#9ca3af; text-align:center; }
                .fork-bar { display:none; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 12px; margin-bottom:12px; background:#fff7ed; border:1px solid #fdba74; border-radius:6px; font-size:13px; color:#9a3412; }
                .fork-chain { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
                .fork-chip { background:#ffedd5; border:1px solid #fdba74; border-radius:10px; padding:2px 8px; font-size:12px; white-space:nowrap; }
                .fork-arrow { color:#c2410c; font-weight:600; }

                /* 血缘图谱节点详情弹窗 */
                .lineage-popup-mask {
                    display:none; position:fixed; inset:0; background:rgba(15,23,42,0.35);
                    z-index:3000; align-items:center; justify-content:center;
                }
                .lineage-popup-mask.show { display:flex; }
                .lineage-popup {
                    background:#fff; border-radius:8px; width:520px; max-width:90vw; max-height:80vh;
                    overflow:hidden; box-shadow:0 12px 32px rgba(15,23,42,0.2);
                    display:flex; flex-direction:column;
                }
                .lineage-popup-header {
                    display:flex; justify-content:space-between; align-items:center;
                    padding:12px 16px; border-bottom:1px solid #e5e7eb; background:#f8fafc;
                }
                .lineage-popup-title { font-size:14px; font-weight:600; color:#1f2937; }
                .lineage-popup-close {
                    border:none; background:transparent; font-size:18px; cursor:pointer;
                    color:#6b7280; width:28px; height:28px; display:flex; align-items:center;
                    justify-content:center; border-radius:4px;
                }
                .lineage-popup-close:hover { background:#f3f4f6; color:#374151; }
                .lineage-popup-body {
                    padding:16px; overflow-y:auto; font-size:13px; line-height:1.8; color:#374151;
                    user-select:text; -webkit-user-select:text; cursor:text;
                }
                .lineage-popup-body .field { margin-bottom:6px; }
                .lineage-popup-body .field-label { color:#6b7280; font-size:12px; margin-right:4px; }
                .lineage-popup-body pre {
                    margin:4px 0; padding:10px; background:#1e293b; color:#e2e8f0;
                    border-radius:5px; white-space:pre-wrap; word-break:break-all;
                    font-size:12px; font-family:'Consolas','Monaco',monospace;
                    max-height:200px; overflow:auto; user-select:text; -webkit-user-select:text;
                }
                .lineage-popup-footer {
                    display:flex; justify-content:flex-end; gap:8px;
                    padding:10px 16px; border-top:1px solid #e5e7eb; background:#f8fafc;
                }
                .lineage-popup-btn {
                    padding:6px 16px; border-radius:5px; cursor:pointer; font-size:13px;
                    border:1px solid #d1d5db; background:#fff; color:#374151;
                }
                .lineage-popup-btn:hover { border-color:#2563eb; color:#2563eb; }
                .lineage-popup-btn.copy {
                    border-color:#2563eb; color:#2563eb;
                }
                .lineage-popup-btn.copy:hover { background:#2563eb; color:#fff; }
            </style>
            <div class="page">
                <div class="card">
                    <div class="header"><h3>数据集档案</h3><div class="actions"><button class="primary" id="newVersion">创建新版本</button><button class="primary" id="editVersion" style="display:none;">编辑</button><button class="danger" id="deleteVersion">禁用当前版本</button></div></div>
                    <div class="info">
                        <div class="item"><label>数据集名称</label><span id="name">-</span></div>
                        <div class="item"><label>版本号</label><span id="versionNo">-</span></div>
                        <div class="item"><label>产出方式</label><span id="type">-</span></div>
                        <div class="item"><label>数据类型</label><span id="dataType">-</span><select id="dataTypeEdit" style="display:none;padding:6px 8px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;">
                            <option value="relational">关系数据</option>
                            <option value="time_series">时序数据</option>
                            <option value="key_value">键值数据</option>
                            <option value="semi_structured">半结构化数据</option>
                            <option value="file_system">文件型数据</option>
                            <option value="text">文本</option>
                            <option value="image">图像</option>
                            <option value="audio">音频</option>
                            <option value="video">视频</option>
                        </select></div>
                        <div class="item"><label>存储路径</label><span id="path">-</span></div>
                        <div class="item"><label>创建者</label><span id="operator">-</span></div>
                        <div class="item"><label>创建时间</label><span id="time">-</span></div>
                        <div class="item wide"><label>版本备注</label><span id="remark">-</span><textarea id="remarkEdit" style="display:none;width:100%;min-height:60px;padding:6px 8px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;resize:vertical;box-sizing:border-box;"></textarea></div>
                        <div class="item wide"><label>版本配置</label><pre id="recipe">-</pre></div>
                    </div>
                </div>
                <div class="card">
                    <div class="header"><h3>变化过程</h3></div>
                    <div id="changeTable"></div>
                </div>
                <div class="card">
                    <div class="header"><h3>血缘图谱</h3></div>
                    <div class="toolbar"><label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;"><input type="checkbox" id="sideLineageToggle">显示旁系血缘</label><button id="focus">聚焦当前版本</button><button id="zoomIn">放大</button><button id="zoomOut">缩小</button><button id="resetView">重置视图</button><button id="forkPath">编辑</button></div>
                    <div class="lineage-notice" id="lineageNotice" style="display:none;margin:0 0 8px;padding:6px 10px;border:1px solid #fde68a;background:#fffbeb;border-radius:6px;font-size:12px;color:#92400e;"></div>
                    <div class="fork-bar" id="forkBar">
                        <span id="forkBarText"></span>
                        <span id="forkBarChain" class="fork-chain"></span>
                        <span style="flex:1;"></span>
                        <button class="primary" id="forkStart" disabled>开始重跑</button>
                        <button id="forkClear">清除</button>
                        <button id="forkExit">退出选择</button>
                    </div>
                    <div class="graph" id="graph"></div>
                </div>
            </div>

            <!-- 血缘图谱节点详情弹窗 -->
            <div class="lineage-popup-mask" id="lineagePopupMask">
                <div class="lineage-popup" id="lineagePopup">
                    <div class="lineage-popup-header">
                        <span class="lineage-popup-title" id="lineagePopupTitle">节点详情</span>
                        <button class="lineage-popup-close" id="lineagePopupClose">&times;</button>
                    </div>
                    <div class="lineage-popup-body" id="lineagePopupBody"></div>
                    <div class="lineage-popup-footer">
                        <button class="lineage-popup-btn copy" id="lineagePopupCopy">复制全部</button>
                        <button class="lineage-popup-btn" id="lineagePopupCloseBtn">关闭</button>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.shadowRoot.querySelector('#focus').addEventListener('click', () => this.focusNode());
        this.shadowRoot.querySelector('#zoomIn').addEventListener('click', () => this.zoomBy(1.25));
        this.shadowRoot.querySelector('#zoomOut').addEventListener('click', () => this.zoomBy(0.8));
        this.shadowRoot.querySelector('#resetView').addEventListener('click', () => this.resetView());
        this.shadowRoot.querySelector('#sideLineageToggle').addEventListener('change', () => this.loadGraph());
        this.shadowRoot.querySelector('#forkPath').addEventListener('click', () => this.toggleForkMode());
        this.shadowRoot.querySelector('#forkStart').addEventListener('click', () => this.startForkRun());
        this.shadowRoot.querySelector('#forkClear').addEventListener('click', () => this.clearForkSelection());
        this.shadowRoot.querySelector('#forkExit').addEventListener('click', () => this.exitForkMode());

        this.shadowRoot.querySelector('#newVersion').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('edit-dataset', { bubbles:true, composed:true, detail:this.version }));
        });
        this.shadowRoot.querySelector('#deleteVersion').addEventListener('click', () => this.deleteCurrent());
        this.shadowRoot.querySelector('#editVersion').addEventListener('click', () => this.toggleEditMode());
    }

    async show(selection) {
        this.setAttribute('show', '');
        this.exitForkMode();
        this.hideNotice();
        this.selection = typeof selection === 'object' ? selection : { storagePath: selection };
        try {
            if (!this.selection.versionId) {
                throw new Error('缺少数据集版本ID，请刷新右侧数据集树');
            }
            if (!this.selection.datasetName) {
                throw new Error('缺少数据集名称，请刷新右侧数据集树');
            }
            const [meta, changes] = await Promise.all([
                window.AppConfig.get('dataset', 'versionMetas', { versionId:this.selection.versionId }),
                window.AppConfig.get('dataset', 'changes', { datasetName:this.selection.datasetName })
            ]);
            if (!(meta.success || meta.code === 200) || !meta.data) throw new Error(meta.message || '版本详情加载失败');
            this.version = meta.data;
            const vid = this.versionIdOf(this.version);
            if (vid == null) {
                throw new Error('版本详情缺少版本ID，无法加载血缘');
            }
            this.changes = ((changes.success || changes.code === 200) && changes.data) ? changes.data : [];
            // 分页复位并定位到当前版本所在页
            this.changePage = 1;
            const curVid = this.version ? this.versionIdOf(this.version) : null;
            const curIdx = curVid == null ? -1 : this.changes.findIndex(c => Number(this.versionIdOf(c)) === Number(curVid));
            if (curIdx >= 0) this.changePage = Math.floor(curIdx / this.changePageSize) + 1;
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
        this.setText('#dataType', this.dataTypeLabel(v.dataModality));
        this.setText('#path', v.storagePath);
        this.setText('#operator', v.operator || '-');
        this.setText('#time', this.formatTime(v.createTime));
        this.setText('#remark', v.remark || '-');
        // 显示编辑按钮
        const editBtn = this.shadowRoot.querySelector('#editVersion');
        if (editBtn) editBtn.style.display = '';
        // 退出编辑模式
        this.exitEditMode();
        let recipe = v.derivationConfig || '{}';
        try { recipe = JSON.stringify(JSON.parse(recipe), null, 2); } catch (e) {}
        this.setText('#recipe', recipe);
    }

    dataTypeLabel(dataType) {
        const labels = {
            relational: '关系数据',
            'time-series': '时序数据', 'time_series': '时序数据',
            'semi-structured': '半结构化数据', 'semi_structured': '半结构化数据',
            'key-value': '键值数据', 'key_value': '键值数据',
            'file-system': '文件型数据', 'file_system': '文件型数据',
            text: '文本',
            image: '图像',
            audio: '音频',
            video: '视频'
        };
        return labels[dataType] || dataType || '-';
    }

    jobStateLabel(jobState) {
        const labels = {
            0: '任务未知', 1: '任务完成', 2: '任务已创建', 3: '任务等待中',
            4: '任务运行中', 5: '任务部分失败中', 6: '任务部分失败',
            7: '任务失败中', 8: '任务失败', 9: '任务取消中', 10: '任务已取消'
        };
        return labels[jobState] || null;
    }

    statusBadge(row) {
        if (row.deleted) return '<span class="badge deleted">已禁用</span>';
        const jobLabel = this.jobStateLabel(row.jobState);
        if (jobLabel) {
            const failStates = [5, 6, 7, 8, 9, 10];
            const cls = failStates.includes(row.jobState) ? 'deleted' : 'active-status';
            return `<span class="badge ${cls}">${jobLabel}</span>`;
        }
        return '<span class="badge active-status">正常</span>';
    }

    renderChangeTable() {
        const container = this.shadowRoot.querySelector('#changeTable');
        if (!this.changes.length) {
            container.innerHTML = '<div class="empty">暂无变化记录</div>';
            return;
        }
        // 分页：版本数多时一次性渲染全表会拖垮页面
        const total = this.changes.length;
        const totalPages = Math.max(1, Math.ceil(total / this.changePageSize));
        if (this.changePage > totalPages) this.changePage = totalPages;
        if (this.changePage < 1) this.changePage = 1;
        const start = (this.changePage - 1) * this.changePageSize;
        const pageRows = this.changes.slice(start, start + this.changePageSize);
        const activeVid = this.versionIdOf(this.version);
        const pageBtnStyle = 'padding:3px 10px;border:1px solid #d1d5db;background:#fff;border-radius:4px;font-size:12px;cursor:pointer;';
        container.innerHTML = `<table><thead><tr><th>版本</th><th>产出方式</th><th>存储路径</th><th>上游版本</th><th>版本配置</th><th>操作人</th><th>时间</th><th>备注</th><th>状态</th></tr></thead><tbody>${pageRows.map(row => {
            const upstreams = (row.upstreams || []).map(u => `${u.datasetName || ''}/${u.versionNo || u.versionId}`).join(', ') || '-';
            const recipe = this.recipeSummary(row.derivationConfig);
            const statusBadge = this.statusBadge(row);
            const vid = row.versionId || row.createTime;
            return `<tr data-version-id="${row.versionId}" class="${row.versionId === activeVid ? 'active' : ''}"><td>${this.escape(row.versionNo)}</td><td><span class="badge ${row.provenanceType}">${this.escape(row.provenanceLabel || row.provenanceType)}</span></td><td><code>${this.escape(row.storagePath || '-')}</code></td><td>${this.escape(upstreams)}</td><td title="${this.escape(JSON.stringify(row.derivationConfig || {}))}">${this.escape(recipe)}</td><td>${this.escape(row.operator || '-')}</td><td>${this.escape(this.formatTime(row.createTime))}</td><td>${this.escape(row.remark || '-')}</td><td>${statusBadge}</td></tr>`;
        }).join('')}</tbody></table>
        <div class="change-pager" style="display:flex;align-items:center;gap:8px;padding:8px 4px;font-size:12px;color:#6b7280;">
            <span>共 ${total} 个版本</span>
            <button data-change-page="first" style="${pageBtnStyle}">首页</button>
            <button data-change-page="prev" style="${pageBtnStyle}" ${this.changePage <= 1 ? 'disabled' : ''}>上一页</button>
            <span>第 ${this.changePage} / ${totalPages} 页</span>
            <button data-change-page="next" style="${pageBtnStyle}" ${this.changePage >= totalPages ? 'disabled' : ''}>下一页</button>
            <button data-change-page="last" style="${pageBtnStyle}">末页</button>
            <span style="margin-left:auto;">每页</span>
            <select data-change-size style="padding:2px 4px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;">
                ${[20, 50, 100].map(n => `<option value="${n}" ${n === this.changePageSize ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <span>条</span>
        </div>`;
        container.querySelectorAll('tbody tr').forEach(row => row.addEventListener('click', () => this.highlight(Number(row.dataset.versionId))));
        const pager = container.querySelector('.change-pager');
        pager.querySelectorAll('button[data-change-page]').forEach(btn => btn.addEventListener('click', () => {
            const act = btn.getAttribute('data-change-page');
            if (act === 'first') this.changePage = 1;
            else if (act === 'prev') this.changePage -= 1;
            else if (act === 'next') this.changePage += 1;
            else if (act === 'last') this.changePage = totalPages;
            this.renderChangeTable();
        }));
        const sizeSel = pager.querySelector('[data-change-size]');
        sizeSel.addEventListener('change', () => {
            this.changePageSize = Number(sizeSel.value);
            this.changePage = 1;
            this.renderChangeTable();
        });
    }


    /** 视口虚拟渲染的单次渲染节点上限，超出部分放大后渐进可见 */
    VIEWPORT_CAP = 2500;
    /** 单次返回节点数保护上限（后端截断）；渲染已虚拟化，可承载大图 */
    MAX_NODES_LIMIT = 30000;
    /** 变化过程表格分页状态 */
    changePage = 1;
    changePageSize = 20;

    async loadGraph() {
        const vid = this.versionIdOf(this.version);
        if (vid == null) {
            this.graph = { nodes:[], edges:[] };
            this.renderGraph();
            return;
        }
        const sideLineage = this.shadowRoot.querySelector('#sideLineageToggle')?.checked ?? false;
        // 完整血缘一次加载（后端 maxNodes 保护），前端视口虚拟渲染保证大图可交互
        const result = await window.AppConfig.get('dataset', 'lineage', { versionId:vid, sideLineage, maxNodes: this.MAX_NODES_LIMIT });
        this.graph = ((result.success || result.code === 200) && result.data) ? result.data : { nodes:[], edges:[] };
        if (this.graph.truncated) {
            this.showNotice(`节点数超出保护上限（${this.MAX_NODES_LIMIT}），已截断显示。`);
        }
        this.renderGraph();
    }

    showNotice(text) {
        const bar = this.shadowRoot.querySelector('#lineageNotice');
        if (!bar) return;
        bar.textContent = text;
        bar.style.display = 'block';
    }

    hideNotice() {
        const bar = this.shadowRoot.querySelector('#lineageNotice');
        if (bar) bar.style.display = 'none';
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

        const edges = this.graph.edges || [];
        const echartsNodes = [];
        const echartsLinks = [];
        const versionKeyMap = new Map(); // versionId -> echarts node id

        // 1. 版本节点（尺寸/标签在渲染子集构建时按 zoom 等比计算）
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
                symbolSize: 30,
                itemStyle: {
                    color: deleted ? '#cbd5e1' : color,
                    borderColor: n.focus ? '#111827' : (deleted ? '#94a3b8' : '#fff'),
                    borderWidth: n.focus ? 4 : 2,
                    shadowBlur: n.focus ? 12 : 0,
                    shadowColor: color,
                    opacity: deleted ? 0.55 : 1
                },
                label: {
                    show: false,
                    position: 'bottom',
                    color: deleted ? '#94a3b8' : '#374151',
                    formatter: () => `${n.datasetName || ''}\n${n.versionNo || ''}`
                },
                nodeType: 'version',
                _lodAlways: n.focus,
                versionData: n
            });
        });

        // 2. 操作节点与边
        const operationNodeSet = new Set();
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

                    const cfg = (toNode && toNode.derivationConfig) || {};
                    const opInfo = this.extractOperationInfo(toNode, cfg);
                    const opLabel = opInfo.type;
                    const opDetail = opInfo.detail;
                    let opFull = opInfo.full;

                    const bindings = cfg.upstreamSqlBindings;
                    if (bindings && opFull.sqlSnippet) {
                        opFull = this.filterOperationFullByUpstream(opFull, bindings, fromVid);
                    }

                    echartsNodes.push({
                        id: opNodeId,
                        name: opDetail ? `${opLabel}\n${opDetail}` : opLabel,
                        symbol: 'roundRect',
                        symbolSize: [110, 40],
                        itemStyle: {
                            color: opInfo.color,
                            borderColor: opInfo.borderColor,
                            borderWidth: 2,
                            borderRadius: 8
                        },
                        label: {
                            show: false,
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

                    echartsLinks.push({
                        source: fromNodeId,
                        target: opNodeId,
                        lineStyle: {
                            color: e.primary ? '#94a3b8' : '#cbd5e1',
                            width: 2,
                            type: e.primary ? 'solid' : 'dashed'
                        }
                    });
                    echartsLinks.push({
                        source: opNodeId,
                        target: toNodeId,
                        lineStyle: {
                            color: e.primary ? '#94a3b8' : '#cbd5e1',
                            width: 2,
                            type: e.primary ? 'solid' : 'dashed'
                        },
                        label: { show: false, formatter: e.relationType || '' }
                    });
                }
            } else {
                echartsLinks.push({
                    source: fromNodeId,
                    target: toNodeId,
                    lineStyle: {
                        color: e.primary ? '#94a3b8' : '#cbd5e1',
                        width: 2,
                        type: e.primary ? 'solid' : 'dashed'
                    },
                    label: { show: false, formatter: e.relationType || '' }
                });
            }
        });

        // 3. 分层布局（确定性坐标，全部节点固定位置）
        const layout = this.computeLayeredLayout(echartsNodes, echartsLinks);
        const positions = layout.positions;
        echartsNodes.forEach(n => {
            const pos = positions.get(n.id);
            if (pos) {
                n.x = pos.x;
                n.y = pos.y;
            }
            n.fixed = true;
        });

        // 4. 禁用版本置灰（指向禁用版本的边与操作节点一并置灰）
        const deletedVersionIds = new Set(
            nodes.filter(n => n.deleted).map(n => String(n.versionId || n.createTime))
        );
        if (deletedVersionIds.size > 0) {
            echartsLinks.forEach(l => {
                const m = /^v_(.+)$/.exec(l.target) ? null : /^op_(.+?)_(.+)$/.exec(l.target);
                if (m && deletedVersionIds.has(m[2])) {
                    l.lineStyle.color = '#d1d5db';
                    l.lineStyle.opacity = 0.55;
                    if (l.label) l.label.color = '#cbd5e1';
                }
                if (/^v_(.+)$/.test(l.target)) {
                    const targetVid = l.target.replace(/^v_/, '');
                    if (deletedVersionIds.has(targetVid)) {
                        l.lineStyle.color = '#d1d5db';
                        l.lineStyle.opacity = 0.55;
                        if (l.label) l.label.color = '#cbd5e1';
                    }
                }
            });
            echartsNodes.forEach(n => {
                if (n.nodeType !== 'operation') return;
                const m = /^op_(.+?)_(.+)$/.exec(n.id);
                if (m && deletedVersionIds.has(m[2])) {
                    n.itemStyle = n.itemStyle || {};
                    n.itemStyle.color = '#e5e7eb';
                    n.itemStyle.borderColor = '#cbd5e1';
                    n.itemStyle.opacity = 0.55;
                    if (n.label) n.label.color = '#9ca3af';
                }
            });
        }

        // 5. 虚拟渲染准备：全量图缓存 + 等比尺寸基准
        this._fullNodes = echartsNodes;
        this._fullLinks = echartsLinks;
        const focusVid = this.version ? this.versionIdOf(this.version) : null;
        this._focusId = focusVid == null ? null : `v_${focusVid}`;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        echartsNodes.forEach(n => {
            if (n.x == null) return;
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        });
        if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }
        const extentW = Math.max(1, maxX - minX);
        const extentH = Math.max(1, maxY - minY);
        // 节点基础尺寸为"数据单位"（约层间距的 1/10），渲染尺寸 = base × zoom，
        // 任意缩放下节点与连线的比例保持一致（地图式等比缩放）
        const spacing = this._estimateSpacing(echartsNodes);
        this._baseNodeSize = Math.max(6, Math.min(40, spacing * 0.10));
        this._baseFontSize = Math.max(8, Math.min(14, spacing * 0.045));

        // 四角锚点（不可见）：把渲染子集的数据包围盒钉在整图范围上，
        // 使 ECharts 的自动适配比例在全图生命周期内恒定，视口裁剪更新不会引起视图漂移
        [[minX - spacing, minY - spacing], [maxX + spacing, minY - spacing],
         [minX - spacing, maxY + spacing], [maxX + spacing, maxY + spacing]].forEach((p, i) => {
            echartsNodes.push({
                id: `__anchor_${i}`, name: '', symbol: 'circle', symbolSize: 0.1,
                x: p[0], y: p[1], fixed: true, itemStyle: { opacity: 0 },
                label: { show: false }, nodeType: 'anchor'
            });
        });

        const chart = window.echarts.init(container);

        // 初始视口：以焦点版本为中心、节点约 24px 的舒适尺寸（视口裁剪，不做整图适配）
        const viewW = container.clientWidth || 1394;
        const viewH = container.clientHeight || 1000;
        const fitScale0 = Math.min(viewW / Math.max(1, extentW + spacing * 2), viewH / Math.max(1, extentH + spacing * 2));
        this._fitScale = fitScale0;
        const focusNode0 = this._focusId ? echartsNodes.find(n => n.id === this._focusId) : null;
        const focusPos = focusNode0 && focusNode0.x != null
            ? [focusNode0.x, focusNode0.y]
            : [minX + extentW / 2, minY + extentH / 2];
        const initZoom = Math.max(1, Math.min(80, 24 / Math.max(0.001, this._baseNodeSize * fitScale0)));
        this._fitView = { zoom: initZoom, center: focusPos };
        // 首屏裁剪矩形（此时坐标系尚未建立，手动计算）
        const totalScale0 = fitScale0 * initZoom;
        this._initialRect = {
            minX: focusPos[0] - viewW / (2 * totalScale0) - spacing * 2,
            maxX: focusPos[0] + viewW / (2 * totalScale0) + spacing * 2,
            minY: focusPos[1] - viewH / (2 * totalScale0) - spacing * 2,
            maxY: focusPos[1] + viewH / (2 * totalScale0) + spacing * 2
        };

        const first = this._buildRenderSubset(chart, initZoom, false);
        const option = {
            tooltip: { show: false },
            series: [{
                type: 'graph',
                layout: 'none',
                roam: true,
                draggable: false,
                zoom: initZoom,
                center: focusPos,
                symbol: 'circle',
                edgeSymbol: ['none', 'arrow'],
                edgeSymbolSize: [0, Math.max(5, Math.min(16, 4 * this._fitScale * initZoom))],
                lineStyle: {
                    color: '#94a3b8',
                    width: Math.max(0.6, Math.min(5, 1.6 * this._fitScale * initZoom)),
                    curveness: 0.05,
                    opacity: 0.8
                },
                label: { show: false },
                emphasis: {
                    focus: 'adjacency',
                    label: { show: true },
                    lineStyle: { width: 3 }
                },
                data: first.data,
                links: first.links
            }]
        };
        chart.setOption(option);
        this._echartsNodesCache = echartsNodes;

        // 缓存节点原始描边样式（路径重跑选择态高亮/还原用）
        echartsNodes.forEach(n => {
            if (n.nodeType === 'version' && n.itemStyle) {
                n._baseStyle = {
                    borderColor: n.itemStyle.borderColor,
                    borderWidth: n.itemStyle.borderWidth,
                    shadowBlur: n.itemStyle.shadowBlur,
                    shadowColor: n.itemStyle.shadowColor
                };
            }
        });

        // 点击节点 -> 路径重跑选择 / 详情弹窗
        chart.on('click', (params) => {
            if (params.dataType !== 'node') return;
            const d = params.data;
            if (this.forkMode) {
                if (d.nodeType === 'version') {
                    this.handleForkNodeClick(d.versionData);
                }
                return;
            }
            if (d.nodeType === 'version') {
                const v = d.versionData;
                const vid = v.versionId || v.createTime;
                this.highlight(vid);
                this.showLineagePopup('版本详情', this.versionPopupContent(v));
            } else if (d.nodeType === 'operation') {
                this.showLineagePopup('操作详情', this.operationPopupContent(d));
            }
        });

        // 缩放/平移 -> 视口裁剪重渲染（防抖）
        chart.on('graphRoam', () => this._handleRoamForRender(chart));

        if (container._resizeObserver) container._resizeObserver.disconnect();
        const resizeObserver = new ResizeObserver(() => {
            chart.resize();
            this._handleRoamForRender(chart);
        });
        resizeObserver.observe(container);
        container._chart = chart;
        container._resizeObserver = resizeObserver;
    }

    _getGraphZoom(chart) {
        try {
            const opt = chart.getOption();
            return (opt.series[0] && opt.series[0].zoom) || 1;
        } catch (e) {
            return 1;
        }
    }

    /** 估计布局最近邻间距（分层布局的行距/列距），作为节点尺寸的数据单位基准 */
    _estimateSpacing(nodes) {
        const pts = nodes.filter(n => n.x != null);
        if (pts.length < 2) return 100;
        const xs = [...new Set(pts.map(n => Math.round(n.x)))].sort((a, b) => a - b);
        const ys = [...new Set(pts.map(n => Math.round(n.y)))].sort((a, b) => a - b);
        const minPositive = arr => {
            let m = Infinity;
            for (let i = 1; i < arr.length; i++) {
                const d = arr[i] - arr[i - 1];
                if (d > 4 && d < m) m = d;
            }
            return m;
        };
        const sx = minPositive(xs), sy = minPositive(ys);
        const s = Math.min(isFinite(sx) ? sx : Infinity, isFinite(sy) ? sy : Infinity);
        return isFinite(s) && s > 0 ? s : 100;
    }

    /** 视口的布局坐标系范围（四角 pointToData） */
    _viewportDataRect(chart) {
        try {
            const seriesModel = chart.getModel().getSeriesByIndex(0);
            const cs = seriesModel && seriesModel.coordinateSystem;
            if (!cs || !cs.pointToData) return null;
            const w = chart.getWidth(), h = chart.getHeight();
            const a = cs.pointToData([0, 0]);
            const b = cs.pointToData([w, h]);
            if (!a || !b) return null;
            return {
                minX: Math.min(a[0], b[0]),
                maxX: Math.max(a[0], b[0]),
                minY: Math.min(a[1], b[1]),
                maxY: Math.max(a[1], b[1])
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * 构建当前应渲染的节点/连线子集（虚拟滚动核心）：
     * 只取视口内（含缓冲）的节点；节点尺寸/标签字号按 zoom 等比换算，
     * 任意缩放下节点与连线的比例保持一致；连线两端可见才渲染。
     */
    _buildRenderSubset(chart, zoom, initial) {
        const full = this._fullNodes || [];
        const fullLinks = this._fullLinks || [];
        let visible = full;
        let rect = null;
        if (chart) {
            rect = this._viewportDataRect(chart);
        }
        if (!rect && initial && this._initialRect) {
            rect = this._initialRect;
        }
        if (rect) {
            const pad = Math.max(this._baseNodeSize * 4, (rect.maxX - rect.minX) * 0.12);
            visible = full.filter(n => n.x != null
                && n.x >= rect.minX - pad && n.x <= rect.maxX + pad
                && n.y >= rect.minY - pad && n.y <= rect.maxY + pad);
        }
        // 锚点恒渲染（撑住数据包围盒，保证适配比例恒定）
        const anchors = full.filter(n => n.nodeType === 'anchor');
        if (anchors.length) {
            const have = new Set(visible.map(n => n.id));
            visible = visible.concat(anchors.filter(a => !have.has(a.id)));
        }
        if (visible.length > this.VIEWPORT_CAP) {
            visible = visible.slice(0, this.VIEWPORT_CAP);
            if (!this._cullOverflow) {
                this._cullOverflow = true;
                this.showNotice('视野内节点过多，已部分渲染，放大可查看更多细节。');
            }
        } else if (this._cullOverflow) {
            this._cullOverflow = false;
            if (!this.graph.truncated) this.hideNotice();
        }
        // 焦点节点恒渲染
        if (this._focusId && !visible.some(n => n.id === this._focusId)) {
            const f = full.find(n => n.id === this._focusId);
            if (f) visible = visible.concat([f]);
        }
        const ids = new Set(visible.map(n => n.id));
        const links = fullLinks.filter(l => ids.has(l.source) && ids.has(l.target));
        // 缩放语义（实测）：ECharts graph 的 symbolSize/edgeSymbolSize 随 option.zoom 缩放
        // （但不随自动适配比例），而连线间距随 fitScale × zoom。因此符号尺寸只乘 fitScale、
        // 不乘 zoom——zoom 在绘制时已自动作用于符号，重复相乘会导致放大时节点巨大、缩成一团
        const fitScale = this._fitScale || 1;
        const symbolSize = Math.max(2, Math.min(200, this._baseNodeSize * fitScale));
        const labelOn = symbolSize * zoom >= 12;
        const fontSize = Math.max(8, Math.min(18, (this._baseFontSize || 11) * fitScale * zoom));
        const data = visible.map(n => ({
            ...n,
            symbolSize: n.id === this._focusId ? Math.round(symbolSize * 1.3 * 10) / 10 : Math.round(symbolSize * 10) / 10,
            label: { ...(n.label || {}), show: labelOn || !!n._lodAlways, fontSize }
        }));
        const edgeW = Math.max(0.5, Math.min(4, 1.6 * fitScale * zoom));
        const arrowSetting = Math.max(3, Math.min(40, 0.5 * this._baseNodeSize * fitScale));
        const styledLinks = links.map(l => ({
            ...l,
            lineStyle: { ...(l.lineStyle || {}), width: edgeW },
            label: { ...(l.label || {}), show: symbolSize * zoom >= 15 && !!l.label?.formatter, fontSize: Math.max(8, Math.min(14, (this._baseFontSize || 11) * fitScale * zoom * 0.8)) }
        }));
        return { data, links: styledLinks, arrowSetting };
    }

    /** 缩放/平移后防抖重建渲染子集 */
    _handleRoamForRender(chart) {
        if (this._roamRenderTimer) clearTimeout(this._roamRenderTimer);
        this._roamRenderTimer = setTimeout(() => {
            if (!chart || chart.isDisposed() || !this._fullNodes) return;
            const zoom = this._getGraphZoom(chart);
            const sub = this._buildRenderSubset(chart, zoom, false);
            // 关键：data 更新时必须同时钉住 zoom/center，否则 ECharts 会按
            // 渲染子集的包围盒重新适配视图，用户的缩放状态被冲掉，
            // 导致节点尺寸与连线间距比例错乱（节点远大于间距、缩成一团）
            let center;
            try {
                const opt = chart.getOption();
                center = opt.series[0] && opt.series[0].center;
            } catch (err) { center = undefined; }
            chart.setOption({
                series: [{
                    zoom: zoom,
                    center: center,
                    data: sub.data,
                    links: sub.links,
                    edgeSymbolSize: [0, Math.max(5, Math.min(16, 4 * px))]
                }]
            }, { lazyUpdate: true, silent: true });
            // 自校准：实测比例与估算不一致时（包围盒留白等误差），按实测值修正节点尺寸
            clearTimeout(this._calibrateTimer);
            this._calibrateTimer = setTimeout(() => {
                if (!chart || chart.isDisposed()) return;
                try {
                    const sm = chart.getModel().getSeriesByIndex(0);
                    const cs = sm.coordinateSystem;
                    if (!cs || !cs.dataToPoint) return;
                    const measured = Math.abs(cs.dataToPoint([0, 260])[1] - cs.dataToPoint([0, 100])[1]) / 160;
                    const expected = this._fitScale * zoom;
                    if (expected > 0 && Math.abs(measured / expected - 1) > 0.15) {
                        this._fitScale *= measured / expected;
                        const sub2 = this._buildRenderSubset(chart, zoom, false);
                        chart.setOption({ series: [{ data: sub2.data, links: sub2.links }] }, { lazyUpdate: true, silent: true });
                    }
                } catch (err) { /* 忽略校准异常 */ }
            }, 200);
        }, 150);
    }

    /**
     * 动态检测力导向布局是否稳定
     * 通过检测节点坐标是否在一段时间内不再变化来判断
     * @param chart ECharts 实例
     * @param maxZoomCount 最大允许缩小次数，默认为 5
     */
    _checkLayoutStable(chart, maxZoomCount = 5) {
        let lastPositions = null;
        let stableCount = 0;
        const checkInterval = 200; // 每 200ms 检测一次
        const stableThreshold = 3; // 连续 3 次坐标不变认为稳定
        
        const check = () => {
            // 图表已被销毁（血缘图重绘/切换视图）时终止检测循环，避免getModel()为null报错
            if (chart.isDisposed()) return;
            const model = chart.getModel();
            if (!model) return;
            const seriesModel = model.getSeriesByIndex(0);
            if (!seriesModel || !seriesModel.coordinateSystem) return;
            
            const cs = seriesModel.coordinateSystem;
            const currentPositions = [];
            
            // 获取所有节点的当前坐标
            seriesModel.getGraph().eachNode(node => {
                const layout = node.getLayout();
                if (layout) {
                    currentPositions.push({ x: layout[0], y: layout[1] });
                }
            });
            
            // 比较坐标是否变化
            if (lastPositions && currentPositions.length === lastPositions.length) {
                let changed = false;
                for (let i = 0; i < currentPositions.length; i++) {
                    const dx = Math.abs(currentPositions[i].x - lastPositions[i].x);
                    const dy = Math.abs(currentPositions[i].y - lastPositions[i].y);
                    if (dx > 1 || dy > 1) { // 坐标变化超过 1px 认为还在移动
                        changed = true;
                        break;
                    }
                }
                
                if (!changed) {
                    stableCount++;
                    if (stableCount >= stableThreshold) {
                        // 布局稳定，检测是否需要缩小
                        this.autoZoomToFit(maxZoomCount);
                        return;
                    }
                } else {
                    stableCount = 0;
                }
            }
            
            lastPositions = currentPositions;
            setTimeout(check, checkInterval);
        };
        
        // 延迟开始检测，给布局一些初始时间
        setTimeout(check, 300);
    }

    /**
     * 自动适配视口。多分量图设可读性缩放下限（0.55）：整图缩得过小时节点与文字都无法辨认，
     * 宁可让边缘角落分量暂时超出视口（可漫游/缩放按钮查看），初始视图以主图为视觉中心。
     * 注意：ECharts 会在初始化/重设 option 时把节点包围盒自动 contain-fit 进画布，
     * 该缩放比例无法从坐标系对象上读取，只能用「像素包围盒 / 布局包围盒」实测得到；
     * 缩放调整必须用 graphRoam（原地生效），setOption 改 zoom 会重建坐标系导致状态丢失。
     */
    autoZoomToFit(maxZoomCount = 5) {
        const container = this.shadowRoot.querySelector('#graph');
        const chart = container && container._chart;
        if (!chart || chart.isDisposed()) return;

        const seriesModel = chart.getModel().getSeriesByIndex(0);
        if (!seriesModel || !seriesModel.coordinateSystem) return;

        const cs = seriesModel.coordinateSystem;
        const width = chart.getWidth();
        const height = chart.getHeight();
        const padding = 36; // 边距：容纳边缘节点的符号半径与下方标签外伸

        // 同时记录布局坐标与屏幕像素坐标的包围盒
        let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
        let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
        let nodeCount = 0;

        seriesModel.getGraph().eachNode(node => {
            const layout = node.getLayout();
            if (!layout) return;

            const pixel = cs.dataToPoint(layout);
            if (!pixel) return;

            nodeCount++;
            const lx = layout[0], ly = layout[1];
            const px = pixel[0], py = pixel[1];

            if (lx < lMinX) lMinX = lx;
            if (lx > lMaxX) lMaxX = lx;
            if (ly < lMinY) lMinY = ly;
            if (ly > lMaxY) lMaxY = ly;
            if (px < pMinX) pMinX = px;
            if (px > pMaxX) pMaxX = px;
            if (py < pMinY) pMinY = py;
            if (py > pMaxY) pMaxY = py;
        });

        if (nodeCount === 0) return;

        const layoutW = Math.max(1, lMaxX - lMinX);
        const layoutH = Math.max(1, lMaxY - lMinY);
        const pxW = Math.max(1, pMaxX - pMinX);
        const pxH = Math.max(1, pMaxY - pMinY);

        // 当前整图缩放 = 像素包围盒 / 布局包围盒
        const curTotal = Math.min(pxW / layoutW, pxH / layoutH);

        // 目标缩放：恰好装进视口（不超过 1，即小图不放大），多分量图不低于可读性下限；
        // 但下限不超过「主图恰好完整可见」的缩放——主图必须完整呈现在视口内，
        // 只有四周的角落分量允许越出视口（可漫游/缩放查看）
        let target = Math.min((width - padding * 2) / layoutW, (height - padding * 2) / layoutH, 1);
        const minZoom = this._multiCompLayout ? 0.55 : 0.2;
        if (target < minZoom) {
            target = minZoom;
        }
        if (this._multiCompLayout && this._mainRect) {
            // 主图包围盒外扩一些余量，容纳边缘节点的符号半径与下方标签，保证完整可见
            const mainW = Math.max(1, this._mainRect.maxX - this._mainRect.minX) + 150;
            const mainH = Math.max(1, this._mainRect.maxY - this._mainRect.minY) + 150;
            const fitMain = Math.min((width - padding * 2) / mainW, (height - padding * 2) / mainH, 1);
            if (target > fitMain) {
                target = fitMain;
            }
        }

        const ratio = target / curTotal;
        if (Math.abs(ratio - 1) > 0.02) {
            chart.dispatchAction({
                type: 'graphRoam',
                seriesIndex: 0,
                zoom: ratio,
                originX: width / 2,
                originY: height / 2
            });
            // 兜底：大图上相对倍率可能因测量误差迭代发散（实测放大到 15 倍指向空白），
            // 调整后若绝对缩放超出合理范围，直接按目标值设置绝对 zoom
            const after = (chart.getOption().series[0].zoom) || 1;
            if (after > 3 || after < 0.05) {
                chart.setOption({ series: [{ zoom: Math.min(Math.max(target, 0.2), 3) }] });
            }
        }

        // 平移：多分量图以主图包围盒中心为视觉中心，单分量图仍以整体包围盒为中心
        let centerX = (pMinX + pMaxX) / 2;
        let centerY = (pMinY + pMaxY) / 2;
        if (this._multiCompLayout && this._mainCenterPos) {
            const mc = cs.dataToPoint([this._mainCenterPos.x, this._mainCenterPos.y]);
            if (mc) {
                centerX = mc[0];
                centerY = mc[1];
            }
        }
        const dx = width / 2 - centerX;
        const dy = height / 2 - centerY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            chart.dispatchAction({
                type: 'graphRoam',
                seriesIndex: 0,
                dx: dx,
                dy: dy
            });
        }
    }

    /**
     * 分层布局：按有向边 from→to 分层，从上往下排列。
     * y 按层（depth），x 在层内均匀分布，力导向从初始位置微调避免重叠。
     * 互相不可达的独立 DAG（弱连通分量）各自独立分层后，
     * 围绕主图（focus 所在分量）分布在四周角落，避免不同 DAG 叠在一起。
     * 返回 { positions: Map<nodeId, {x, y, layer}>, layers: {layer: [nodeId, ...]}, detachedIds: Set<nodeId> }
     */
    computeLayeredLayout(echartsNodes, echartsLinks) {
        const nodeIds = echartsNodes.map(n => n.id);
        const idSet = new Set(nodeIds);

        // 邻接表：有向用于分层，无向用于划分连通分量
        const outgoing = new Map();
        const incoming = new Map();
        const undirected = new Map();
        nodeIds.forEach(id => {
            outgoing.set(id, new Set());
            incoming.set(id, new Set());
            undirected.set(id, new Set());
        });
        echartsLinks.forEach(l => {
            if (idSet.has(l.source) && idSet.has(l.target)) {
                outgoing.get(l.source).add(l.target);
                incoming.get(l.target).add(l.source);
                undirected.get(l.source).add(l.target);
                undirected.get(l.target).add(l.source);
            }
        });

        // 划分弱连通分量：每个互相不可达的独立 DAG 一个分量
        const compIndexOf = new Map();
        const components = [];
        nodeIds.forEach(id => {
            if (compIndexOf.has(id)) return;
            const comp = { ids: [], rect: null };
            const queue = [id];
            compIndexOf.set(id, components.length);
            while (queue.length) {
                const cur = queue.shift();
                comp.ids.push(cur);
                undirected.get(cur).forEach(nb => {
                    if (!compIndexOf.has(nb)) {
                        compIndexOf.set(nb, components.length);
                        queue.push(nb);
                    }
                });
            }
            components.push(comp);
        });

        // focus 所在分量为主动态图；无 focus 时取节点最多的分量
        const focusNode = echartsNodes.find(n => n.nodeType === 'version' && n.versionData && n.versionData.focus);
        const focusId = focusNode ? focusNode.id : null;
        const mainComp = focusId != null
            ? components[compIndexOf.get(focusId)]
            : components.reduce((a, b) => (b.ids.length > a.ids.length ? b : a), components[0]);

        // 多分量时收紧行距与角落间距，控制整体包围盒大小：
        // 布局越大 autoZoomToFit 的缩放比越小，而节点符号是固定像素不随视图缩放，
        // 缩放比过低时相邻节点会在屏幕上相互挤叠
        const multiComp = components.length > 1;
        const rowHeight = multiComp ? 120 : 160;  // 层间距（垂直）
        const colWidth = 200;   // 同层节点间距（水平）
        const positions = new Map();
        const layers = {};

        // 单个分量独立分层：以分量内根节点为基准，向下游 BFS（层递增）、向上游 BFS（层递减）
        const layoutComponent = (comp) => {
            const ids = comp.ids;
            // 根：优先 focus，其次无入边的源头节点，否则任取一个
            const root = (comp === mainComp && focusId != null) ? focusId
                : (ids.find(id => incoming.get(id).size === 0) || ids[0]);

            const layerMap = new Map();
            layerMap.set(root, 0);

            const downQueue = [root];
            while (downQueue.length) {
                const cur = downQueue.shift();
                const curLayer = layerMap.get(cur);
                outgoing.get(cur).forEach(nb => {
                    if (!layerMap.has(nb)) {
                        layerMap.set(nb, curLayer + 1);
                        downQueue.push(nb);
                    }
                });
            }

            const upQueue = [root];
            while (upQueue.length) {
                const cur = upQueue.shift();
                const curLayer = layerMap.get(cur);
                incoming.get(cur).forEach(nb => {
                    if (!layerMap.has(nb)) {
                        layerMap.set(nb, curLayer - 1);
                        upQueue.push(nb);
                    }
                });
            }

            // 分量内仍未被 BFS 覆盖到的节点（环等特殊结构）
            const maxLayer = Math.max(0, ...layerMap.values());
            ids.forEach(id => {
                if (!layerMap.has(id)) layerMap.set(id, maxLayer + 1);
            });

            // 按层分组
            const compLayers = {};
            layerMap.forEach((layer, id) => {
                if (!compLayers[layer]) compLayers[layer] = [];
                compLayers[layer].push(id);
            });

            // 局部坐标：x 行内均匀分布（居中于 0），y 按层从上到下。
            // 超宽层自动折行（每行最多 maxPerRow 个节点）：真实数据里一次合流/分叉
            // 可能让同一层有几十个节点，不折行会把包围盒撑得极宽，
            // 视口适配后缩放比过小，所有节点都缩得无法辨认
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            // 自适应每行节点数：按分量规模与层数估算，避免大分量布局过于细长（宽高比失衡）
            const layerCount = Math.max(1, Object.keys(compLayers).length);
            const maxPerRow = Math.max(6, Math.min(120, Math.round(comp.ids.length / layerCount / 1.5)));
            let yCursor = 0;
            Object.keys(compLayers).map(Number).sort((a, b) => a - b).forEach(layer => {
                const idsInLayer = compLayers[layer];
                const rowCount = Math.ceil(idsInLayer.length / maxPerRow);
                idsInLayer.forEach((id, idx) => {
                    const row = Math.floor(idx / maxPerRow);
                    const col = idx % maxPerRow;
                    const inRow = Math.min(maxPerRow, idsInLayer.length - row * maxPerRow);
                    const x = (col - (inRow - 1) / 2) * colWidth;
                    const y = yCursor + row * rowHeight;
                    positions.set(id, { x, y, layer });
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                });
                yCursor += rowCount * rowHeight;
            });
            comp.rect = { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };

            Object.keys(compLayers).forEach(k => {
                const key = Number(k);
                layers[key] = (layers[key] || []).concat(compLayers[key]);
            });
        };

        components.forEach(layoutComponent);

        // 主分量保持局部坐标不动，其余分量绕其分布在四周角落
        const mainRect = mainComp.rect;
        const GAP = 180;      // 分量与主图包围盒之间的基础间距
        const MARGIN = 110;   // 分量两两之间的最小空隙（需容纳节点符号与标签外扩）
        const placed = [{ minX: mainRect.minX, maxX: mainRect.maxX, minY: mainRect.minY, maxY: mainRect.maxY }];
        // 角落优先：右上、右下、左下、左上，之后依次东、西、北、南（放不下自动往外圈推）
        const slots = [
            { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];

        const detachedIds = new Set();
        // 大的独立 DAG 先挑角落
        const secondaries = components
            .filter(c => c !== mainComp)
            .sort((a, b) => b.ids.length - a.ids.length);

        secondaries.forEach((comp, i) => {
            const rect = comp.rect;
            const w = rect.width;
            const h = rect.height;
            const L = mainRect.minX - GAP, R = mainRect.maxX + GAP;
            const T = mainRect.minY - GAP, B = mainRect.maxY + GAP;
            const slot = slots[i % slots.length];

            // 初始中心：沿 slot 方向贴着主分量外扩边界放置
            const cx = slot.dx > 0 ? R + w / 2 : slot.dx < 0 ? L - w / 2 : (L + R) / 2;
            const cy = slot.dy > 0 ? B + h / 2 : slot.dy < 0 ? T - h / 2 : (T + B) / 2;
            const r = { minX: cx - w / 2, maxX: cx + w / 2, minY: cy - h / 2, maxY: cy + h / 2 };

            // 与已放置分量重叠时，沿两中心连线方向逐步外推，直到互不重叠
            const step = 60;
            for (let iter = 0; iter < 300; iter++) {
                let moved = false;
                for (const p of placed) {
                    const overlapping = r.minX - MARGIN < p.maxX && r.maxX + MARGIN > p.minX
                        && r.minY - MARGIN < p.maxY && r.maxY + MARGIN > p.minY;
                    if (!overlapping) continue;
                    let ddx = (r.minX + r.maxX) / 2 - (p.minX + p.maxX) / 2;
                    let ddy = (r.minY + r.maxY) / 2 - (p.minY + p.maxY) / 2;
                    if (Math.abs(ddx) < 1 && Math.abs(ddy) < 1) { ddx = slot.dx || 1; ddy = slot.dy; }
                    const len = Math.max(1, Math.hypot(ddx, ddy));
                    r.minX += ddx / len * step;
                    r.maxX += ddx / len * step;
                    r.minY += ddy / len * step;
                    r.maxY += ddy / len * step;
                    moved = true;
                }
                if (!moved) break;
            }
            placed.push(r);

            // 分量局部坐标 -> 全局坐标（按摆放后的中心平移）
            const fcx = (r.minX + r.maxX) / 2;
            const fcy = (r.minY + r.maxY) / 2;
            const ocx = (rect.minX + rect.maxX) / 2;
            const ocy = (rect.minY + rect.maxY) / 2;
            comp.ids.forEach(id => {
                const pos = positions.get(id);
                pos.x += fcx - ocx;
                pos.y += fcy - ocy;
                detachedIds.add(id);
            });
        });

        return {
            positions, layers, detachedIds,
            mainCenter: { x: (mainRect.minX + mainRect.maxX) / 2, y: (mainRect.minY + mainRect.maxY) / 2 },
            mainRect: { minX: mainRect.minX, maxX: mainRect.maxX, minY: mainRect.minY, maxY: mainRect.maxY }
        };
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
                detail = 'SQL脚本';
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
            changeProcess: cfg.changeProcess || null,
            description: cfg.description || null,
            potentialUsers: cfg.potentialUsers || null
        };
        return { type, detail, color, borderColor, textColor, full };
    }

    /**
     * 多数据集转换场景下，按上游版本ID过滤操作节点的 SQL 语句。
     * upstreamSqlBindings 结构: { "1234567890": [0, 2], "1234567891": [1, 2] }
     * 为 null 或 fromVid 无绑定则原样返回。
     */
    filterOperationFullByUpstream(opFull, bindings, fromVid) {
        if (!bindings) return opFull;
        const key = String(fromVid);
        const sqlIndices = bindings[key];
        if (!sqlIndices || sqlIndices.length === 0) return opFull;

        const filtered = Object.assign({}, opFull);
        const original = opFull.sqlSnippet;
        if (!original || typeof original !== 'object') {
            return filtered;
        }

        let sqlList = [];
        try {
            sqlList = typeof original.sqlList === 'string'
                ? JSON.parse(original.sqlList)
                : (Array.isArray(original.sqlList) ? original.sqlList : []);
        } catch (e) { sqlList = []; }

        const idxSet = new Set(sqlIndices);
        const filteredList = sqlList.filter((_, i) => idxSet.has(i));
        if (filteredList.length > 0) {
            const filteredSql = Object.assign({}, original);
            filteredSql.sqlList = filteredList;
            filtered.sqlSnippet = filteredSql;
        }
        return filtered;
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
        const jobLabel = this.jobStateLabel(v.jobState);
        if (jobLabel) {
            const failStates = [5, 6, 7, 8, 9, 10];
            const color = failStates.includes(v.jobState) ? '#dc2626' : '#16a34a';
            rows.push(`状态: ${v.deleted ? '<span style="color:#dc2626">已删除</span>' : '<span style="color:#16a34a">正常</span>'} / <span style="color:${color}">${jobLabel}</span>`);
        } else {
            rows.push(`状态: ${v.deleted ? '<span style="color:#dc2626">已删除</span>' : '<span style="color:#16a34a">正常</span>'}`);
        }
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

    /** 版本节点弹窗内容：只显示数据集版本本身的元数据，不显示生成过程（SQL/Transform等由操作节点展示） */
    versionPopupContent(v) {
        if (!v) return '<div class="field">无数据</div>';
        const html = [];
        html.push(`<div class="field"><span class="field-label">数据集 / 版本:</span> <b>${this.escape(v.datasetName)} / ${this.escape(v.versionNo)}</b></div>`);
        html.push(`<div class="field"><span class="field-label">产出方式:</span> ${this.escape(v.provenanceLabel || v.provenanceType)}</div>`);
        html.push(`<div class="field"><span class="field-label">存储路径:</span> <code>${this.escape(v.storagePath || '-')}</code></div>`);
        html.push(`<div class="field"><span class="field-label">操作人:</span> ${this.escape(v.operator || '-')}</div>`);
        html.push(`<div class="field"><span class="field-label">操作时间:</span> ${this.formatTime(v.createTime)}</div>`);
        html.push(`<div class="field"><span class="field-label">客户端IP:</span> ${this.escape(v.clientIp || '-')}</div>`);
        const jobLabel = this.jobStateLabel(v.jobState);
        if (jobLabel) {
            const failStates = [5, 6, 7, 8, 9, 10];
            const color = failStates.includes(v.jobState) ? '#dc2626' : '#16a34a';
            html.push(`<div class="field"><span class="field-label">状态:</span> ${v.deleted ? '<span style="color:#dc2626">已删除</span>' : '<span style="color:#16a34a">正常</span>'} / <span style="color:${color}">${jobLabel}</span></div>`);
        } else {
            html.push(`<div class="field"><span class="field-label">状态:</span> ${v.deleted ? '<span style="color:#dc2626">已删除</span>' : '<span style="color:#16a34a">正常</span>'}</div>`);
        }
        if (v.remark) html.push(`<div class="field"><span class="field-label">备注:</span> ${this.escape(v.remark)}</div>`);
        return html.join('');
    }

    /** 操作节点弹窗内容（结构化、可复制） */
    operationPopupContent(d) {
        const f = d.operationFull || {};
        const html = [];
        html.push(`<div class="field"><b>${this.escape(d.operationType || '操作')}</b></div>`);
        // 操作节点只显示操作相关的元数据（来自 derivationConfig）
        if (f.changeProcess) html.push(`<div class="field"><span class="field-label">变化过程:</span> ${this.escape(f.changeProcess)}</div>`);
        if (f.description) html.push(`<div class="field"><span class="field-label">背景信息:</span> ${this.escape(f.description)}</div>`);
        if (f.potentialUsers) html.push(`<div class="field"><span class="field-label">潜在用户:</span> ${this.escape(typeof f.potentialUsers === 'string' ? f.potentialUsers : JSON.stringify(f.potentialUsers))}</div>`);
        // 操作实体详情
        if (f.sqlSnippet) html.push(this.formatSqlSnippetHtml(f.sqlSnippet));
        if (f.udfFunction) html.push(`<div class="field"><span class="field-label">UDF函数:</span> ${this.escape(typeof f.udfFunction === 'string' ? f.udfFunction : JSON.stringify(f.udfFunction))}</div>`);
        if (f.transformCompare) html.push(this.formatTransformCompareHtml(f.transformCompare));
        if (f.dataArchive) html.push(`<div class="field"><span class="field-label">数据归档:</span> ${this.escape(typeof f.dataArchive === 'string' ? f.dataArchive : JSON.stringify(f.dataArchive))}</div>`);
        return html.join('');
    }

    /** 格式化SQL脚本为可读HTML：显示名称、描述，解析sqlList逐条展示SQL语句 */
    formatSqlSnippetHtml(sql) {
        if (!sql) return '';
        const parts = [];
        if (typeof sql === 'string') {
            parts.push(`<div class="field"><span class="field-label">SQL脚本:</span></div><pre>${this.escape(sql)}</pre>`);
            return parts.join('');
        }
        // 对象：提取 name / description / sqlList
        if (sql.name) parts.push(`<div class="field"><span class="field-label">SQL脚本名称:</span> ${this.escape(sql.name)}</div>`);
        if (sql.description) parts.push(`<div class="field"><span class="field-label">描述:</span> ${this.escape(sql.description)}</div>`);
        let sqlList = [];
        try {
            sqlList = typeof sql.sqlList === 'string' ? JSON.parse(sql.sqlList) : (Array.isArray(sql.sqlList) ? sql.sqlList : []);
        } catch (e) {
            sqlList = [];
        }
        if (sqlList.length > 0) {
            parts.push(`<div class="field"><span class="field-label">SQL语句:</span></div>`);
            sqlList.forEach(s => {
                parts.push(`<pre>- ${this.escape(s)}</pre>`);
            });
        }
        return parts.join('');
    }

    /** 格式化Transform作业为可读HTML：显示名称、任务列表等关键字段 */
    formatTransformCompareHtml(cmp) {
        if (!cmp) return '';
        const parts = [];
        if (typeof cmp === 'string') {
            parts.push(`<div class="field"><span class="field-label">Transform作业:</span></div><pre>${this.escape(cmp)}</pre>`);
            return parts.join('');
        }
        if (cmp.name) parts.push(`<div class="field"><span class="field-label">作业名称:</span> ${this.escape(cmp.name)}</div>`);
        if (cmp.exportFile || cmp.exportFiletName) parts.push(`<div class="field"><span class="field-label">输出文件:</span> ${this.escape(cmp.exportFile || cmp.exportFiletName)}</div>`);
        if (cmp.schedule) parts.push(`<div class="field"><span class="field-label">调度策略:</span> ${this.escape(cmp.schedule)}</div>`);
        // 任务列表
        let taskList = [];
        try {
            taskList = typeof cmp.taskList === 'string' ? JSON.parse(cmp.taskList) : (Array.isArray(cmp.taskList) ? cmp.taskList : []);
        } catch (e) {
            taskList = [];
        }
        if (taskList.length > 0) {
            parts.push(`<div class="field"><span class="field-label">任务列表:</span></div>`);
            taskList.forEach((t, i) => {
                const typeLabel = t.taskType === 0 ? 'IGinX' : (t.taskType === 1 ? 'Python' : '未知');
                const flowLabel = t.dataFlowType === 0 ? 'batch' : (t.dataFlowType === 1 ? 'stream' : '-');
                let detail = '';
                if (t.sqlSnippetName) detail = `SQL脚本: ${t.sqlSnippetName}`;
                else if (t.sqlSnippetId) detail = `SQL脚本#${t.sqlSnippetId}`;
                else if (t.dataset) detail = t.dataset;
                else if (t.pyTaskName) detail = t.pyTaskName;
                parts.push(`<pre>-- 任务 ${i + 1}: ${typeLabel} / ${flowLabel} / 超时${t.timeout || '-'}ms\n${this.escape(detail)}</pre>`);
            });
        }
        return parts.join('');
    }

    /** 显示血缘节点详情弹窗 */
    showLineagePopup(title, contentHtml) {
        const mask = this.shadowRoot.querySelector('#lineagePopupMask');
        const popupTitle = this.shadowRoot.querySelector('#lineagePopupTitle');
        const popupBody = this.shadowRoot.querySelector('#lineagePopupBody');
        if (!mask || !popupBody) return;
        popupTitle.textContent = title;
        popupBody.innerHTML = contentHtml;
        mask.classList.add('show');
        // 绑定关闭和复制按钮（每次重新绑定）
        const closeBtn = this.shadowRoot.querySelector('#lineagePopupClose');
        const closeBtn2 = this.shadowRoot.querySelector('#lineagePopupCloseBtn');
        const copyBtn = this.shadowRoot.querySelector('#lineagePopupCopy');
        const popup = this.shadowRoot.querySelector('#lineagePopup');
        const hide = () => mask.classList.remove('show');
        if (closeBtn) closeBtn.onclick = hide;
        if (closeBtn2) closeBtn2.onclick = hide;
        // 点击遮罩关闭，但点击弹窗内容不关闭
        mask.onclick = (e) => { if (e.target === mask) hide(); };
        if (popup) popup.onclick = (e) => e.stopPropagation();
        if (copyBtn) copyBtn.onclick = () => this.copyLineagePopup(popupBody);
    }

    /** 复制弹窗内容到剪贴板 */
    copyLineagePopup(popupBody) {
        if (!popupBody) return;
        const text = popupBody.innerText;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('已复制到剪贴板');
            }).catch(() => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    }

    fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); this.showToast('已复制到剪贴板'); }
        catch (e) { this.showToast('复制失败，请手动选择复制', 'error'); }
        document.body.removeChild(ta);
    }

    showToast(msg, type = 'success') {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(msg, type);
        } else {
            console.log(`${type}: ${msg}`);
        }
    }

    /** 聚焦当前版本节点：放大并居中 */
    focusNode() {
        const container = this.shadowRoot.querySelector('#graph');
        const chart = container._chart;
        if (!chart || chart.isDisposed() || !this.version) return;
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
        if (!chart || chart.isDisposed()) return;
        // 使用 ECharts graph 的 zoom 属性，配合 roam 实现缩放
        const option = chart.getOption();
        const series = option.series[0] || {};
        const curZoom = series.zoom || 1;
        chart.setOption({ series: [{ zoom: curZoom * factor }] });
        this._handleRoamForRender(chart);
    }

    resetView() {
        // 重置 = 恢复进入页面时的初始状态：按缓存数据重建图谱（重新分层布局并重跑力导向），
        // 与刷新页面的图谱完全一致，且不会重复请求后端
        this.renderGraph();
    }

    // ==================== 血缘路径重跑（分叉新版本树） ====================

    toggleForkMode() {
        if (this.forkMode) {
            this.exitForkMode();
            return;
        }
        this.forkMode = true;
        this.forkChain = [];
        this.shadowRoot.querySelector('#forkBar').style.display = 'flex';
        const btn = this.shadowRoot.querySelector('#forkPath');
        if (btn) btn.classList.add('primary');
        this.updateForkBar();
    }

    exitForkMode() {
        this.forkMode = false;
        this.forkChain = [];
        const bar = this.shadowRoot.querySelector('#forkBar');
        if (bar) bar.style.display = 'none';
        const btn = this.shadowRoot.querySelector('#forkPath');
        if (btn) btn.classList.remove('primary');
        this.applyForkHighlight();
    }

    clearForkSelection() {
        this.forkChain = [];
        this.updateForkBar();
        this.applyForkHighlight();
    }

    isForkStartType(t) {
        // 起始节点不限类型：SOURCE 重新挂载、SQL/Transform 原样重跑（独立根）、IMPORT 用 SELECT * 转化重跑
        return !!t;
    }

    /** 路径选择：首节点为分叉起点；之后点击任意下游节点——若链尾到该节点只有一条路径则自动补全，
     *  多条路径时需依次点击相邻节点，重复点击末尾节点 = 回退一步 */
    handleForkNodeClick(v) {
        if (!v) return;
        const vid = Number(v.versionId || v.createTime);
        if (this.forkChain.length === 0) {
            if (!this.isForkStartType(v.provenanceType)) {
                this.showToast('该节点缺少产出方式，无法作为起始节点', 'error');
                return;
            }
            this.forkChain.push(vid);
            this.updateForkBar();
            this.applyForkHighlight();
            return;
        }
        const last = this.forkChain[this.forkChain.length - 1];
        if (vid === last) {
            this.forkChain.pop();
        } else if (this.forkChain.includes(vid)) {
            this.showToast('该节点已在所选路径中', 'error');
            return;
        } else {
            const paths = this.findDownstreamPaths(last, vid);
            if (paths.length === 1) {
                // 唯一路径：自动补全中间节点
                this.forkChain.push(...paths[0].slice(1));
            } else if (paths.length > 1) {
                if (this.isForkAdjacent(last, vid)) {
                    // 直接相邻：视为明确选择，追加单节点
                    this.forkChain.push(vid);
                } else {
                    this.showToast(`链尾到该节点存在 ${paths.length} 条路径，请沿下游依次点选相邻节点`, 'error');
                    return;
                }
            } else {
                if (this.isForkAdjacent(last, vid)) {
                    this.forkChain.push(vid);
                } else {
                    this.showToast('该节点不在链尾的下游方向，请沿血缘下游选择', 'error');
                    return;
                }
            }
        }
        this.updateForkBar();
        this.applyForkHighlight();
    }

    /** 枚举血缘图中 from 到 to 的下游简单路径（DAG，带数量上限保护） */
    findDownstreamPaths(fromVid, toVid, maxPaths = 50) {
        const edges = (this.graph && this.graph.edges) || [];
        const outgoing = new Map();
        edges.forEach(e => {
            const f = Number(e.from), t = Number(e.to);
            if (!outgoing.has(f)) outgoing.set(f, []);
            outgoing.get(f).push(t);
        });
        const paths = [];
        const path = [Number(fromVid)];
        const target = Number(toVid);
        const dfs = (cur) => {
            if (paths.length >= maxPaths) return;
            if (cur === target) {
                paths.push(path.slice());
                return;
            }
            for (const nb of (outgoing.get(cur) || [])) {
                if (path.includes(nb)) continue; // 简单路径，防环
                path.push(nb);
                dfs(nb);
                path.pop();
                if (paths.length >= maxPaths) return;
            }
        };
        dfs(Number(fromVid));
        return paths;
    }

    isForkAdjacent(prevVid, vid) {
        const edges = (this.graph && this.graph.edges) || [];
        return edges.some(e => Number(e.from) === Number(prevVid) && Number(e.to) === Number(vid));
    }

    updateForkBar() {
        const nodes = (this.graph && this.graph.nodes) || [];
        const byVid = new Map(nodes.map(n => [Number(n.versionId || n.createTime), n]));
        const chainHtml = this.forkChain.map(vid => {
            const n = byVid.get(Number(vid));
            return `<span class="fork-chip">${this.escape(n ? `${n.datasetName}/${n.versionNo}` : vid)}</span>`;
        }).join('<span class="fork-arrow">→</span>');
        this.shadowRoot.querySelector('#forkBarChain').innerHTML = chainHtml;
        this.shadowRoot.querySelector('#forkBarText').textContent = this.forkChain.length === 0
            ? '路径重跑模式：点击任意版本节点作为起始（任意类型均可），再点击下游终点节点即可自动补全唯一路径'
            : `已选 ${this.forkChain.length} 个节点，可继续点击下游终点自动补全，或再次点击末尾节点回退`;
        this.shadowRoot.querySelector('#forkStart').disabled = this.forkChain.length === 0;
    }

    /** 打开重跑对话框：传入路径各节点的元数据（含 derivationConfig 快照） */
    startForkRun() {
        if (!this.forkChain.length) return;
        const nodes = (this.graph && this.graph.nodes) || [];
        const byVid = new Map(nodes.map(n => [Number(n.versionId || n.createTime), n]));
        const steps = this.forkChain.map(vid => {
            const n = byVid.get(Number(vid));
            return {
                versionId: vid,
                datasetName: n ? n.datasetName : '',
                versionNo: n ? n.versionNo : '',
                storagePath: n ? (n.storagePath || '') : '',
                provenanceType: n ? n.provenanceType : '',
                provenanceLabel: n ? (n.provenanceLabel || n.provenanceType) : '',
                derivationConfig: (n && n.derivationConfig) || {}
            };
        });
        const dlg = document.getElementById('lineageForkDialog');
        if (!dlg) {
            this.showToast('路径重跑组件未加载', 'error');
            return;
        }
        dlg.show({ steps });
    }

    /** 选中路径节点橙色描边高亮；未选中时还原原始样式 */
    applyForkHighlight() {
        const container = this.shadowRoot.querySelector('#graph');
        const chart = container && container._chart;
        const cache = this._echartsNodesCache || [];
        if (!chart || chart.isDisposed() || !cache.length) return;
        const selected = new Set((this.forkChain || []).map(Number));
        const data = cache.map(n => {
            if (n.nodeType !== 'version' || !n._baseStyle) return n;
            const vid = n.versionData ? Number(n.versionData.versionId || n.versionData.createTime) : null;
            if (this.forkMode && vid != null && selected.has(vid)) {
                n.itemStyle.borderColor = '#f97316';
                n.itemStyle.borderWidth = 4;
                n.itemStyle.shadowBlur = 12;
                n.itemStyle.shadowColor = '#f97316';
            } else {
                n.itemStyle.borderColor = n._baseStyle.borderColor;
                n.itemStyle.borderWidth = n._baseStyle.borderWidth;
                n.itemStyle.shadowBlur = n._baseStyle.shadowBlur;
                n.itemStyle.shadowColor = n._baseStyle.shadowColor;
            }
            return n;
        });
        chart.setOption({ series: [{ data }] });
    }

    highlight(versionId) {
        // 分页兼容：目标行不在当前页时先翻到对应页再高亮
        const idx = this.changes.findIndex(c => Number(this.versionIdOf(c)) === Number(versionId));
        if (idx >= 0) {
            const targetPage = Math.floor(idx / this.changePageSize) + 1;
            if (targetPage !== this.changePage) {
                this.changePage = targetPage;
                this.renderChangeTable();
            }
        }
        // 高亮变化过程表格中的对应行
        this.shadowRoot.querySelectorAll('#changeTable tbody tr').forEach(row => {
            const rowVid = Number(row.dataset.versionId);
            row.classList.toggle('active', rowVid === versionId || rowVid === Number(versionId));
        });
        const row = this.shadowRoot.querySelector(`#changeTable tr[data-version-id="${versionId}"]`);
        if (row) row.scrollIntoView({ behavior:'smooth', block:'nearest' });
        
        // 从版本数据中获取存储路径
        const version = this.changes.find(c => this.versionIdOf(c) === versionId);
        const storagePath = version ? version.storagePath : null;
        
        // 触发自定义事件，通知右侧数据集树和左侧数据源树高亮对应节点
        this.dispatchEvent(new CustomEvent('highlight-dataset-version', {
            bubbles: true,
            composed: true,
            detail: { versionId: versionId, storagePath: storagePath }
        }));
    }

    async deleteCurrent() {
        if (!this.version) return;
        const vid = this.versionIdOf(this.version);
        if (vid == null) {
            if (window.CommonUtils?.showToast) window.CommonUtils.showToast('版本ID缺失，无法禁用', 'error'); else alert('版本ID缺失，无法禁用');
            return;
        }
        const datasetName = this.version.datasetName || '未命名';
        const versionNo = this.version.versionNo || '-';

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:8px;padding:24px;min-width:400px;max-width:500px;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                <div style="font-size:18px;font-weight:600;margin-bottom:16px;color:#1f2937;">确认禁用版本</div>
                <div style="margin-bottom:24px;color:#595959;line-height:1.6;">
                    确定要禁用数据集 <span style="color:#faad14;font-weight:600;">${datasetName}</span> 的版本 <span style="color:#faad14;font-weight:600;">${versionNo}</span> 吗？<br><br>
                    <strong>此操作仅禁用该版本档案，不会删除对应数据源和数据，可随时重新启用。</strong>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:12px;">
                    <button class="btn-cancel" style="padding:8px 16px;border-radius:4px;border:none;cursor:pointer;font-size:14px;background:#f0f0f0;color:#595959;">取消</button>
                    <button class="btn-confirm-delete" style="padding:8px 16px;border-radius:4px;border:none;cursor:pointer;font-size:14px;background:#faad14;color:#fff;">确认禁用</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('.btn-cancel');
        const confirmBtn = overlay.querySelector('.btn-confirm-delete');
        cancelBtn.addEventListener('click', () => { if (overlay.parentNode) document.body.removeChild(overlay); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay && overlay.parentNode) document.body.removeChild(overlay); });

        confirmBtn.addEventListener('click', async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '处理中...';
            try {
                const result = await window.AppConfig.put('dataset', 'versionToggle', { versionId: vid });
                if (!(result.success || result.code === 200)) throw new Error(result.message || '操作失败');
                if (window.CommonUtils?.showToast) window.CommonUtils.showToast('版本已禁用', 'success');
                this.dispatchEvent(new CustomEvent('dataset-deleted', { bubbles: true, composed: true, detail: this.version }));
                if (window.loadDataSourceTree) await window.loadDataSourceTree();
                if (window.loadDatasetTree) await window.loadDatasetTree();
            } catch (error) {
                if (window.CommonUtils?.showToast) window.CommonUtils.showToast(error.message, 'error'); else alert(error.message);
            } finally {
                if (overlay.parentNode) document.body.removeChild(overlay);
            }
        });
    }

    toggleEditMode() {
        const editBtn = this.shadowRoot.querySelector('#editVersion');
        if (editBtn.textContent === '编辑') {
            this.enterEditMode();
        } else {
            this.saveEdit();
        }
    }

    enterEditMode() {
        const remarkSpan = this.shadowRoot.querySelector('#remark');
        const remarkEdit = this.shadowRoot.querySelector('#remarkEdit');
        if (remarkSpan && remarkEdit) {
            remarkEdit.value = this.version.remark || '';
            remarkSpan.style.display = 'none';
            remarkEdit.style.display = '';
            remarkEdit.focus();
        }
        const dataTypeSpan = this.shadowRoot.querySelector('#dataType');
        const dataTypeEdit = this.shadowRoot.querySelector('#dataTypeEdit');
        if (dataTypeSpan && dataTypeEdit) {
            dataTypeEdit.value = this.version.dataModality || 'relational';
            dataTypeSpan.style.display = 'none';
            dataTypeEdit.style.display = '';
        }
        const editBtn = this.shadowRoot.querySelector('#editVersion');
        if (editBtn) { editBtn.textContent = '保存'; editBtn.style.background = '#16a34a'; editBtn.style.color = '#fff'; }
    }

    exitEditMode() {
        const remarkSpan = this.shadowRoot.querySelector('#remark');
        const remarkEdit = this.shadowRoot.querySelector('#remarkEdit');
        if (remarkSpan && remarkEdit) {
            remarkSpan.style.display = '';
            remarkEdit.style.display = 'none';
        }
        const dataTypeSpan = this.shadowRoot.querySelector('#dataType');
        const dataTypeEdit = this.shadowRoot.querySelector('#dataTypeEdit');
        if (dataTypeSpan && dataTypeEdit) {
            dataTypeSpan.style.display = '';
            dataTypeEdit.style.display = 'none';
        }
        const editBtn = this.shadowRoot.querySelector('#editVersion');
        if (editBtn) { editBtn.textContent = '编辑'; editBtn.style.background = ''; editBtn.style.color = ''; }
    }

    async saveEdit() {
        const vid = this.versionIdOf(this.version);
        if (vid == null) return;
        const remarkEdit = this.shadowRoot.querySelector('#remarkEdit');
        const newRemark = remarkEdit ? remarkEdit.value.trim() : (this.version.remark || '');
        const dataTypeEdit = this.shadowRoot.querySelector('#dataTypeEdit');
        const newDataType = dataTypeEdit ? dataTypeEdit.value : (this.version.dataModality || '');
        const editBtn = this.shadowRoot.querySelector('#editVersion');
        if (editBtn) { editBtn.disabled = true; editBtn.textContent = '保存中...'; }
        try {
            const result = await window.AppConfig.put('dataset', 'versionUpdate', { versionId: vid, remark: newRemark, dataType: newDataType });
            if (!(result.success || result.code === 200)) throw new Error(result.message || '更新失败');
            this.version.remark = newRemark;
            this.version.dataModality = newDataType;
            this.setText('#remark', newRemark || '-');
            this.setText('#dataType', this.dataTypeLabel(newDataType));
            this.exitEditMode();
            if (window.CommonUtils?.showToast) window.CommonUtils.showToast('档案更新成功', 'success');
        } catch (error) {
            if (window.CommonUtils?.showToast) window.CommonUtils.showToast(error.message, 'error'); else alert(error.message);
            this.exitEditMode();
        } finally {
            if (editBtn) editBtn.disabled = false;
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
