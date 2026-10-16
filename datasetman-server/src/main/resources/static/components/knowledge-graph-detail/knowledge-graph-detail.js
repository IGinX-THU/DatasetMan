/**
 * 知识图谱详情组件（在工作区显示，参考模型/算法详情的交互）
 * show({name}) 后增量加载图数据并用G6 4.8.22渲染：
 * - 顶部图谱元信息与统计；工具栏（搜索/缩放/适配/重布局/加载更多节点）
 * - 主体：G6画布 + 属性侧板；节点按标签着色，点击高亮一跳邻接并展示属性
 */
class KnowledgeGraphDetail extends HTMLElement {
    constructor() {
        super();
        this.graph = null;
        this.graphName = null;
        this.loadedNodeCount = 0;
        this.renderedEdgeCount = 0;
        this.totalNodes = 0;
        this.totalEdges = 0;
        this.hasMore = false;
        this.isLoadingMore = false;
        this.labelColorMap = {};
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.initEventListeners();
    }

    // 每批渲染的节点数与增量加载页大小
    static get RENDER_BATCH_SIZE() { return 100; }
    static get FIRST_PAGE_SIZE() { return 300; }
    static get PAGE_SIZE() { return 300; }
    static get PALETTE() {
        return ['#5B8FF9', '#61DDAA', '#F6BD16', '#7262FD', '#78D3F8', '#9661BC', '#F6903D', '#008685', '#F08BB4', '#E8684A'];
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: none;
                    width: 100%;
                    height: 100%;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    color: #2b2f36;
                }

                :host([show]) {
                    display: flex;
                }

                .detail-layout {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    height: 100%;
                    background: #f5f7fa;
                }

                .detail-header {
                    padding: 6px 20px;
                    background: #fff;
                    border-bottom: 1px solid #e2e6ef;
                }

                /* 单行信息栏：名称/描述/路径/时间 + 右侧统计 */
                .header-top {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    white-space: nowrap;
                    overflow: hidden;
                    min-width: 0;
                }

                .header-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1f2329;
                    flex-shrink: 0;
                }

                .header-desc,
                .header-meta-item {
                    font-size: 11px;
                    color: #9ca3af;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    min-width: 0;
                }

                .header-desc {
                    max-width: 200px;
                }

                .header-meta-item {
                    font-family: 'Consolas', 'Monaco', monospace;
                }

                .header-stats {
                    margin-left: auto;
                    display: flex;
                    gap: 14px;
                    font-size: 12px;
                    color: #5f6b7a;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .header-stats strong {
                    color: #1d6feb;
                    font-weight: 600;
                }

                .toolbar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 20px;
                    background: #fff;
                    border-bottom: 1px solid #e8ecf3;
                    flex-wrap: nowrap;
                    overflow-x: auto;
                }

                .tool-btn {
                    padding: 5px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    background: #fff;
                    cursor: pointer;
                    font-size: 12px;
                    color: #4b5563;
                    white-space: nowrap;
                    transition: all 0.2s;
                }

                .tool-btn:hover {
                    border-color: #4c89ff;
                    color: #4c89ff;
                }

                .tool-btn.primary {
                    background: #4c89ff;
                    border-color: #4c89ff;
                    color: #fff;
                }

                .tool-btn.primary:hover {
                    background: #3d7bf7;
                }

                .tool-btn:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                }

                .search-input {
                    width: 220px;
                    padding: 5px 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    outline: none;
                    transition: border-color 0.2s;
                }

                .search-input:focus {
                    border-color: #4c89ff;
                }

                .main-area {
                    flex: 1;
                    display: flex;
                    min-height: 0;
                }

                .graph-wrap {
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                }

                #graphContainer {
                    width: 100%;
                    height: 100%;
                }

                /* 属性悬浮窗：跟随鼠标，不占用图谱视野 */
                .kg-tooltip {
                    display: none;
                    position: absolute;
                    z-index: 30;
                    max-width: 300px;
                    max-height: 260px;
                    overflow: auto;
                    padding: 8px 10px;
                    background: rgba(255, 255, 255, 0.97);
                    border: 1px solid #e2e6ef;
                    border-radius: 6px;
                    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.15);
                    font-size: 12px;
                    color: #2b2f36;
                    pointer-events: none;
                    word-break: break-all;
                }

                .kg-tooltip.visible {
                    display: block;
                }

                .kg-tooltip .tt-title {
                    font-weight: 600;
                    color: #1f2329;
                    margin-bottom: 4px;
                    padding-bottom: 4px;
                    border-bottom: 1px dashed #e2e6ef;
                }

                .kg-tooltip .tt-row {
                    display: flex;
                    gap: 6px;
                    line-height: 1.6;
                }

                .kg-tooltip .tt-key {
                    color: #8c8c8c;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .kg-tooltip .tt-empty {
                    color: #9ca3af;
                }

                /* 左上角小属性面板 */
                .props-panel {
                    position: absolute;
                    left: 12px;
                    top: 12px;
                    z-index: 20;
                    width: 250px;
                    max-height: 220px;
                    display: flex;
                    flex-direction: column;
                    background: rgba(255, 255, 255, 0.97);
                    border: 1px solid #e2e6ef;
                    border-radius: 6px;
                    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.15);
                    font-size: 12px;
                    color: #2b2f36;
                    overflow: hidden;
                }

                .props-panel.collapsed {
                    max-height: none;
                }

                .props-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 10px;
                    font-weight: 600;
                    color: #1f2329;
                    cursor: pointer;
                    background: #f8fafc;
                    border-bottom: 1px solid #eef1f6;
                    user-select: none;
                }

                .props-panel.collapsed .props-panel-header {
                    border-bottom: none;
                }

                .props-toggle-mark {
                    color: #8c8c8c;
                    font-size: 13px;
                    line-height: 1;
                }

                .props-panel-body {
                    overflow: auto;
                    padding: 8px 10px;
                    min-height: 34px;
                }

                .props-panel.collapsed .props-panel-body {
                    display: none;
                }

                .props-placeholder {
                    color: #9ca3af;
                    text-align: center;
                    padding: 8px 4px;
                    line-height: 1.7;
                }

                .props-row {
                    display: flex;
                    gap: 6px;
                    line-height: 1.6;
                    word-break: break-all;
                }

                .props-key {
                    color: #8c8c8c;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .props-title {
                    font-weight: 600;
                    color: #1f2329;
                    margin-bottom: 4px;
                    padding-bottom: 4px;
                    border-bottom: 1px dashed #e2e6ef;
                }

                .graph-hint {
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    z-index: 10;
                    padding: 6px 12px;
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid #e2e6ef;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #5f6b7a;
                    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
                    max-width: 46%;
                }

                .legend {
                    position: absolute;
                    bottom: 12px;
                    left: 12px;
                    z-index: 10;
                    display: none;
                    flex-wrap: wrap;
                    gap: 6px 12px;
                    padding: 8px 12px;
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid #e2e6ef;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #5f6b7a;
                    max-width: 60%;
                    max-height: 110px;
                    overflow: auto;
                }

                .legend.visible { display: flex; }

                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .legend-color {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .loading-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(245, 247, 250, 0.85);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    z-index: 100;
                }

                .loading-overlay.hidden { display: none; }

                .spinner {
                    width: 34px;
                    height: 34px;
                    border: 3px solid #dbe4f0;
                    border-top-color: #4c89ff;
                    border-radius: 50%;
                    animation: kg-spin 0.8s linear infinite;
                }

                @keyframes kg-spin {
                    to { transform: rotate(360deg); }
                }

                .loading-text {
                    font-size: 13px;
                    color: #5f6b7a;
                }

                .error-box {
                    margin: 60px auto;
                    max-width: 480px;
                    background: #fff2f0;
                    border: 1px solid #ffccc7;
                    color: #cf1322;
                    padding: 20px 24px;
                    border-radius: 8px;
                    font-size: 13px;
                    line-height: 1.8;
                }
            </style>

            <div class="detail-layout">
                <div class="detail-header">
                    <div class="header-top">
                        <span class="header-title" id="graphTitle">知识图谱详情</span>
                        <span class="header-desc" id="graphDesc" title=""></span>
                        <span class="header-meta-item" id="metaNodePath" title=""></span>
                        <span class="header-meta-item" id="metaEdgePath" title=""></span>
                        <span class="header-meta-item" id="metaTime" title=""></span>
                        <div class="header-stats">
                            <span>节点 <strong id="statLoadedNodes">0</strong>/<span id="statTotalNodes">-</span></span>
                            <span>关系 <strong id="statEdges">0</strong>/<span id="statTotalEdges">-</span></span>
                        </div>
                    </div>
                </div>

                <div class="toolbar">
                    <input class="search-input" id="searchInput" type="text" placeholder="搜索节点ID/标签定位..." />
                    <button class="tool-btn" id="searchBtn" title="搜索定位">搜索</button>
                    <button class="tool-btn" id="zoomInBtn">放大</button>
                    <button class="tool-btn" id="zoomOutBtn">缩小</button>
                    <button class="tool-btn" id="fitBtn">适配画布</button>
                    <button class="tool-btn" id="relayoutBtn">重新布局</button>
                    <button class="tool-btn primary" id="loadMoreBtn" disabled>加载更多节点</button>
                </div>

                <div class="main-area">
                    <div class="graph-wrap">
                        <div id="graphContainer"></div>
                        <div class="graph-hint">滚轮缩放画布，拖拽平移/移动节点，悬浮到节点或关系上查看属性</div>
                        <div class="kg-tooltip" id="kgTooltip"></div>
                        <div class="legend" id="legend"></div>
                        <!-- 右下角小属性面板：展示搜索定位/悬浮到的节点或关系属性 -->
                        <div class="props-panel" id="propsPanel">
                            <div class="props-panel-header" id="propsPanelToggle">
                                <span>属性</span>
                                <span class="props-toggle-mark" id="propsToggleMark">−</span>
                            </div>
                            <div class="props-panel-body" id="propsPanelBody">
                                <div class="props-placeholder">搜索定位或悬浮节点/关系<br>查看属性</div>
                            </div>
                        </div>
                        <div class="loading-overlay hidden" id="loadingOverlay">
                            <div class="spinner"></div>
                            <div class="loading-text" id="loadingText">正在加载知识图谱...</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="loading-overlay" id="initOverlay" style="display:none;">
                <div class="spinner"></div>
                <div class="loading-text" id="initLoadingText">正在加载知识图谱...</div>
            </div>
        `;
    }

    initEventListeners() {
        const $ = (id) => this.shadowRoot.querySelector(id);
        $('#zoomInBtn')?.addEventListener('click', () => this.graph && this.graph.zoom(1.2));
        $('#zoomOutBtn')?.addEventListener('click', () => this.graph && this.graph.zoom(1 / 1.2));
        $('#fitBtn')?.addEventListener('click', () => this.graph && this.graph.fitView(30));
        $('#relayoutBtn')?.addEventListener('click', () => this.graph && this.graph.layout());
        $('#loadMoreBtn')?.addEventListener('click', () => this.loadMore());
        // 搜索定位：点击"搜索"按钮或输入框回车
        $('#searchBtn')?.addEventListener('click', () => this.focusSearch());
        $('#searchInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.focusSearch();
        });
        // 右下角属性面板折叠/展开
        $('#propsPanelToggle')?.addEventListener('click', () => {
            const panel = $('#propsPanel');
            const mark = $('#propsToggleMark');
            if (panel && mark) {
                panel.classList.toggle('collapsed');
                mark.textContent = panel.classList.contains('collapsed') ? '＋' : '−';
            }
        });

        // window监听只绑定一次（show会重建shadow DOM，元素级监听随重建自动更新）
        if (!this._windowBound) {
            this._windowBound = true;
            window.addEventListener('resize', () => {
                if (!this.graph || this.graph.get('destroyed') || !this.isShown()) return;
                const container = this.shadowRoot.querySelector('#graphContainer');
                const w = container.clientWidth;
                const h = container.clientHeight;
                if (w && h) this.graph.changeSize(w, h);
            });
        }
    }

    isShown() {
        return this.hasAttribute('show');
    }

    /**
     * show({name})：工作区显示指定图谱详情（与modelDetail的show(selectedModel)模式一致）
     */
    async show(params) {
        const name = typeof params === 'string' ? params : (params && params.name);
        if (!name) return;

        // 重建DOM（清除上次可能的错误态）并销毁旧图，画布尺寸按当前容器重新计算
        this.render();
        this.initEventListeners();
        this.destroyGraph();
        this.graphName = name;
        this.loadedNodeCount = 0;
        this.renderedEdgeCount = 0;
        this.totalNodes = 0;
        this.totalEdges = 0;
        this.hasMore = false;
        this.labelColorMap = {};

        this.style.display = 'flex';
        this.setAttribute('show', '');
        this.renderLegend();
        this.updateStats();
        this.resetPropsPanel();

        try {
            this.showLoading('正在加载知识图谱...');
            const data = await this.fetchPage(name, 0, KnowledgeGraphDetail.FIRST_PAGE_SIZE);
            this.renderMeta(data);

            if (!this.totalNodes) {
                this.hideLoading();
                this.showMessage('该图谱暂无节点数据');
                return;
            }

            this.initGraph();
            await this.appendIncrementally(data.nodes, data.edges);
            this.loadedNodeCount = data.loadedNodeCount || data.nodes.length;
            this.hasMore = !!data.hasMore;
            this.updateStats();
            setTimeout(() => {
                try { this.graph && this.graph.fitView(30); } catch (e) { /* 忽略 */ }
            }, 100);
            this.hideLoading();
        } catch (error) {
            console.error('加载知识图谱失败:', error);
            this.hideLoading();
            this.shadowRoot.querySelector('.detail-layout').innerHTML =
                `<div class="error-box">⛔ 加载知识图谱失败: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    hide() {
        this.style.display = 'none';
        this.removeAttribute('show');
        this.destroyGraph();
    }

    destroyGraph() {
        if (this.graph && !this.graph.get('destroyed')) {
            try {
                this.graph.clear();
                this.graph.destroy();
            } catch (e) { /* 忽略销毁异常 */ }
        }
        this.graph = null;
    }

    labelColorOf(label) {
        if (!this.labelColorMap[label]) {
            const used = Object.keys(this.labelColorMap).length;
            this.labelColorMap[label] = KnowledgeGraphDetail.PALETTE[used % KnowledgeGraphDetail.PALETTE.length];
            this.renderLegend();
        }
        return this.labelColorMap[label];
    }

    renderLegend() {
        const legendEl = this.shadowRoot.querySelector('#legend');
        if (!legendEl) return;
        const entries = Object.entries(this.labelColorMap);
        if (!entries.length) {
            legendEl.classList.remove('visible');
            return;
        }
        legendEl.classList.add('visible');
        legendEl.innerHTML = entries.map(([label, color]) => `
            <span class="legend-item">
                <span class="legend-color" style="background:${color}"></span>${this.escapeHtml(label)}
            </span>
        `).join('');
    }

    updateStats() {
        const $ = (id) => this.shadowRoot.querySelector(id);
        if (!$('#statLoadedNodes')) return;
        $('#statLoadedNodes').textContent = this.loadedNodeCount.toLocaleString('zh-CN');
        $('#statTotalNodes').textContent = this.totalNodes ? this.totalNodes.toLocaleString('zh-CN') : '-';
        $('#statEdges').textContent = this.renderedEdgeCount.toLocaleString('zh-CN');
        $('#statTotalEdges').textContent = this.totalEdges ? this.totalEdges.toLocaleString('zh-CN') : '-';
        const loadMoreBtn = $('#loadMoreBtn');
        loadMoreBtn.disabled = !this.hasMore || this.isLoadingMore;
        loadMoreBtn.textContent = this.hasMore
            ? (this.isLoadingMore ? '加载中...' : '加载更多节点')
            : '已加载全部节点';
    }

    initGraph() {
        const container = this.shadowRoot.querySelector('#graphContainer');
        const width = container.clientWidth || 600;
        const height = container.clientHeight || 400;

        this.graph = new G6.Graph({
            container: container,
            width,
            height,
            // 增量渲染：初始不放入数据，后续通过addItem逐批加入
            modes: {
                default: ['drag-canvas', 'zoom-canvas', 'drag-node']
            },
            layout: {
                type: 'force',
                preventOverlap: true,
                nodeSpacing: 30,
                linkDistance: 110,
                nodeStrength: -300,
                edgeStrength: 0.1,
                alphaDecay: 0.028,
                alphaMin: 0.001
            },
            animate: false,
            defaultNode: {
                size: 26,
                style: {
                    lineWidth: 1.5,
                    stroke: '#fff',
                    shadowBlur: 4,
                    shadowColor: 'rgba(15,23,42,0.12)'
                },
                labelCfg: {
                    position: 'bottom',
                    offset: 4,
                    style: { fontSize: 11, fill: '#4b5563' }
                }
            },
            defaultEdge: {
                type: 'line',
                style: {
                    stroke: '#b8c4d6',
                    lineWidth: 1.2,
                    endArrow: {
                        path: G6.Arrow.triangle(7, 8, 0),
                        fill: '#b8c4d6'
                    }
                },
                labelCfg: {
                    autoRotate: true,
                    style: {
                        fontSize: 10,
                        fill: '#8c8c8c',
                        background: { fill: '#ffffff', stroke: '#e2e6ef', padding: [1, 3, 1, 3] }
                    }
                }
            }
        });

        // 属性悬浮窗：悬浮到节点/关系上跟随鼠标展示，不影响图谱视野
        this.graph.on('node:mousemove', (evt) => this.showTooltip('节点', evt));
        this.graph.on('edge:mousemove', (evt) => this.showTooltip('关系', evt));
        // 右下角属性面板：悬浮时同步更新
        this.graph.on('node:mouseenter', (evt) => this.updatePropsPanel('节点', evt.item.getModel()));
        this.graph.on('edge:mouseenter', (evt) => this.updatePropsPanel('关系', evt.item.getModel()));
        this.graph.on('node:mouseleave', () => this.hideTooltip());
        this.graph.on('edge:mouseleave', () => this.hideTooltip());
        this.graph.on('canvas:mousemove', () => this.hideTooltip());
        this.graph.on('canvas:click', () => this.hideTooltip());
    }

    /**
     * 增量渲染：分批addItem，避免大图一次性渲染阻塞主线程
     */
    async appendIncrementally(newNodes, newEdges) {
        const nodeModels = newNodes.map(n => {
            const label = n.label || n.id;
            const color = this.labelColorOf(n.labelType || '未分类');
            return {
                id: String(n.id),
                label: String(label).length > 16 ? String(label).slice(0, 15) + '…' : String(label),
                rawLabel: String(label),
                properties: n.properties || {},
                style: { fill: color },
                labelType: n.labelType || ''
            };
        });

        const knownEdges = new Set();
        this.graph.getEdges().forEach(e => {
            const m = e.getModel();
            knownEdges.add(m.source + '\u0000' + m.target + '\u0000' + (m.rawLabel || ''));
        });

        const loadingText = this.shadowRoot.querySelector('#loadingText');
        for (let i = 0; i < nodeModels.length; i += KnowledgeGraphDetail.RENDER_BATCH_SIZE) {
            const batch = nodeModels.slice(i, i + KnowledgeGraphDetail.RENDER_BATCH_SIZE);
            this.graph.setAutoPaint(false);
            batch.forEach(m => {
                if (!this.graph.findById(m.id)) {
                    this.graph.add('node', m);
                }
            });
            this.graph.paint();
            this.graph.setAutoPaint(true);
            if (loadingText) {
                loadingText.textContent = `正在增量渲染节点 ${Math.min(i + KnowledgeGraphDetail.RENDER_BATCH_SIZE, nodeModels.length)}/${nodeModels.length} ...`;
            }
            // 让出主线程，保持页面可响应
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // 加入两端点已存在的边（服务端已保证，此处再兜底校验）
        const addedEdges = newEdges.filter(e => {
            const source = String(e.source);
            const target = String(e.target);
            const label = String(e.label || '');
            const key = source + '\u0000' + target + '\u0000' + label;
            if (knownEdges.has(key)) return false;
            if (!this.graph.findById(source) || !this.graph.findById(target)) return false;
            knownEdges.add(key);
            return true;
        });

        this.graph.setAutoPaint(false);
        addedEdges.forEach(e => {
            this.graph.add('edge', {
                source: String(e.source),
                target: String(e.target),
                label: String(e.label || ''),
                rawLabel: String(e.label || ''),
                properties: e.properties || {}
            });
        });
        this.graph.paint();
        this.graph.setAutoPaint(true);

        // 增量完成后重跑力导布局
        if (nodeModels.length || addedEdges.length) {
            try {
                this.graph.layout();
            } catch (e) {
                console.warn('布局失败:', e);
            }
        }
        this.renderedEdgeCount += addedEdges.length;
    }

    async fetchPage(name, offset, limit) {
        const result = await window.AppConfig.get('knowledgeGraph', 'data', {
            name,
            nodeOffset: offset,
            nodeLimit: limit
        });
        if (result.code !== 200 || !result.data) {
            throw new Error(result.message || '查询图数据失败');
        }
        return result.data;
    }

    async loadMore() {
        if (!this.hasMore || this.isLoadingMore) return;
        this.isLoadingMore = true;
        this.updateStats();
        this.showLoading('正在加载更多节点...');
        try {
            const data = await this.fetchPage(this.graphName, this.loadedNodeCount, KnowledgeGraphDetail.PAGE_SIZE);
            await this.appendIncrementally(data.nodes, data.edges);
            this.loadedNodeCount = data.loadedNodeCount || (this.loadedNodeCount + data.nodes.length);
            this.hasMore = !!data.hasMore;
        } catch (error) {
            console.error('加载更多节点失败:', error);
            this.showMessage('加载更多节点失败: ' + error.message);
        } finally {
            this.isLoadingMore = false;
            this.hideLoading();
            this.updateStats();
        }
    }

    renderMeta(data) {
        const $ = (id) => this.shadowRoot.querySelector(id);
        const graphInfo = data.graph || {};
        $('#graphTitle').textContent = graphInfo.name || this.graphName;
        $('#graphDesc').textContent = graphInfo.description || '';
        $('#metaNodePath').textContent = '节点路径: ' + (graphInfo.nodePath || '-');
        $('#metaNodePath').title = graphInfo.nodePath || '';
        $('#metaEdgePath').textContent = '关系路径: ' + (graphInfo.edgePath || '-');
        $('#metaEdgePath').title = graphInfo.edgePath || '';
        const opTime = graphInfo.createTime
            ? new Date(graphInfo.createTime).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '-';
        $('#metaTime').textContent = '上传时间: ' + opTime;
        const descEl = $('#graphDesc');
        descEl.textContent = graphInfo.description || '';
        descEl.title = graphInfo.description || '';
        this.totalNodes = Number(data.totalNodes || 0);
        this.totalEdges = Number(data.totalEdges || 0);
    }

    /**
     * 搜索定位：按ID/标签匹配已加载节点并聚焦
     */
    focusSearch() {
        const input = this.shadowRoot.querySelector('#searchInput');
        const keyword = input ? input.value.trim().toLowerCase() : '';
        if (!keyword || !this.graph) return;
        const target = this.graph.getNodes().find(n => {
            const m = n.getModel();
            return String(m.id).toLowerCase().includes(keyword)
                || String(m.rawLabel || '').toLowerCase().includes(keyword);
        });
        if (target) {
            this.graph.focusItem(target, true, { easing: 'easeCubic', duration: 400 });
            // 搜索结果同步到右下角属性面板
            this.updatePropsPanel('节点', target.getModel());
        } else {
            this.showMessage('未找到匹配的已加载节点（可尝试先加载更多节点）');
        }
    }

    /**
     * 属性悬浮窗：跟随鼠标位置展示节点/关系属性，不遮挡图谱整体视野
     */
    showTooltip(type, evt) {
        const tooltip = this.shadowRoot.querySelector('#kgTooltip');
        if (!tooltip) return;
        tooltip.innerHTML = this.buildPropsHtml(type, evt.item.getModel());
        tooltip.classList.add('visible');

        // 跟随鼠标位置，靠右/靠下时自动翻转避免溢出
        const wrap = this.shadowRoot.querySelector('.graph-wrap');
        const wrapW = wrap ? wrap.clientWidth : 800;
        const wrapH = wrap ? wrap.clientHeight : 600;
        const tipW = 300;
        let x = evt.canvasX + 14;
        if (x + tipW > wrapW) {
            x = Math.max(4, evt.canvasX - tipW - 14);
        }
        let y = evt.canvasY + 14;
        if (y + 260 > wrapH) {
            y = Math.max(4, evt.canvasY - 260 - 14);
        }
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    hideTooltip() {
        const tooltip = this.shadowRoot.querySelector('#kgTooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }

    /**
     * 构建节点/关系属性展示HTML（悬浮窗与右下角属性面板共用）
     */
    buildPropsHtml(type, model) {
        const isNode = type === '节点';
        const props = Object.assign({}, model.properties || {});
        let html = isNode
            ? `<div class="props-title">节点 ${this.escapeHtml(model.id)}【${this.escapeHtml(model.rawLabel || '-')}】</div>`
            : `<div class="props-title">关系 ${this.escapeHtml(model.source)} → ${this.escapeHtml(model.target)}【${this.escapeHtml(model.rawLabel || '-')}】</div>`;
        const keys = Object.keys(props);
        if (keys.length) {
            html += keys.map(k =>
                `<div class="props-row"><span class="props-key">${this.escapeHtml(k)}:</span><span>${this.escapeHtml(props[k])}</span></div>`
            ).join('');
        } else {
            html += `<div class="props-placeholder">无其他属性</div>`;
        }
        return html;
    }

    /**
     * 右下角属性面板：展示搜索定位/悬浮到的节点或关系属性
     */
    updatePropsPanel(type, model) {
        const body = this.shadowRoot.querySelector('#propsPanelBody');
        if (body) {
            body.innerHTML = this.buildPropsHtml(type, model);
        }
        const panel = this.shadowRoot.querySelector('#propsPanel');
        if (panel && panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            const mark = this.shadowRoot.querySelector('#propsToggleMark');
            if (mark) mark.textContent = '−';
        }
    }

    resetPropsPanel() {
        const body = this.shadowRoot.querySelector('#propsPanelBody');
        if (body) {
            body.innerHTML = '<div class="props-placeholder">搜索定位或悬浮节点/关系<br>查看属性</div>';
        }
    }

    showLoading(text) {
        const overlay = this.shadowRoot.querySelector('#loadingOverlay');
        if (!overlay) return;
        this.shadowRoot.querySelector('#loadingText').textContent = text;
        overlay.classList.remove('hidden');
    }

    hideLoading() {
        const overlay = this.shadowRoot.querySelector('#loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

    showMessage(message) {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

customElements.define('knowledge-graph-detail', KnowledgeGraphDetail);
