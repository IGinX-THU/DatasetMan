/**
 * 知识图谱详情组件（在工作区显示，参考模型/算法详情的交互）
 * show({name}) 后一次全量查询，缓存全量 nodes/edges，再按视图模式渲染：
 * - 力导子图（默认）：G6 4.8.22 + force layout，截取连通子图，单击节点展开一跳邻接；
 * - 全图概览：Sigma.js 2.4.0 (WebGL) + graphology，一次性渲染全部节点+边，
 *   平移缩放只改相机矩阵由 GPU 承担，可承载 5万节点/20万边。
 * 两图按「节点屏幕尺寸」自动双向切换，工具栏层级标签提供手动切换兜底（共用同一入口与阈值）。
 * 判据基准是两张图「初始视图」的节点直径（首帧冻结，不再随缩放/重排/切换改变），
 * 切换后目标图一律回到自己的初始节点大小，不继承源图放大或缩小后的尺寸。
 * 两种模式的画布共存（互斥可见），切换时不销毁、不重建，返回子图保持原有布局与展开状态。
 */
class KnowledgeGraphDetail extends HTMLElement {
    constructor() {
        super();
        this.graph = null;
        this.overview = null;
        this.viewMode = 'subgraph';   // 'subgraph' | 'overview'
        this.overviewNodeCount = 0;
        this.overviewEdgeCount = 0;
        this.graphName = null;
        this.loadedNodeCount = 0;
        this.renderedEdgeCount = 0;
        this.totalNodes = 0;
        this.totalEdges = 0;
        this.hasMore = false;
        this.isLoadingMore = false;
        this.labelColorMap = {};
        this._fitZoom = 1;          // 子图最近一次 fitView 的 zoom（仅用于相机，不再当切换基准）
        this._medianDegree = 0;     // 全量图度数中位数（概览构建前估算节点尺寸）
        // 语义缩放的「初始大小」基准：整次图谱会话只冻结一次，之后的缩放/重排/切换都不改
        this._baseSubgraphPx = null;      // 子图首帧节点直径（CSS px）
        this._baseOverviewPx = null;      // 概览 ratio=1 时的节点直径（CSS px）
        this._switchThresholdsCache = null;
        this._manualLockUntil = 0;  // 手动切换后抑制自动切换的截止时间戳
        this._pendingManualLock = false; // 异步切换完成后需要重新起算锁定窗口
        this._locateShapes = null;  // 定位圈定的两个圆环 shape（8 秒或下次定位时移除）
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.initEventListeners();
    }

    // 首屏一次全量查询 + 渲染连通子图（对齐Neo4j Browser的渲染上限），单击节点展开一跳邻接
    static get MAX_RENDER_NODES() { return 500; }
    /**
     * 语义缩放不再比较 G6 zoom / Sigma ratio 两套数值，统一用「节点屏幕直径（CSS px）」：
     *   子图 G6   D = NODE_BASE_PX * zoom
     *   概览 Sigma D = 2 * size / √ratio（size 公式见 Overview.nodeSizeOf）
     * 两张图各自的「初始视图节点直径」在首帧冻结为 sub0 / ov0，此后永不改写。
     * 阈值只由这两个冻结值推导：T = √(ov0 × sub0) 为交界基准，
     * toOverview = T/√H（缩小侧）、toSubgraph = T×SWITCH_ZOOM_IN_FACTOR（放大侧）。
     * 两侧刻意不对称：G6 滚轮缩小每档 ×0.9（约 1.11 倍/档），Sigma 放大每档
     * ratio÷1.7 ⇒ 节点 ×√1.7（约 1.30 倍/档）；同样的倍率在概览侧只要 2~3 档就跨过，
     * 观感就是「还没放大够就切了」，所以放大侧需要更长的行程。
     * 切换瞬间目标图一律回到自己的初始大小（ov0 / sub0），不继承源图放大或缩小后的尺寸，
     * 基准不随相机历史漂移，每轮切换所需缩放距离恒定。
     */
    static get NODE_BASE_PX() { return 22; }   // G6 defaultNode.size
    // 缩小侧：以 T 为中心的滞回带（√1.5 ≈ 1.225 倍），保证触发后不会立刻反向回跳
    static get SWITCH_HYSTERESIS() { return 1.5; }
    // 放大侧：相对 T 的倍率。调大 = 概览要放得更大才进子图（2.0 → 约 4 档滚轮、节点 ≈7.7px）
    static get SWITCH_ZOOM_IN_FACTOR() { return 2.0; }
    static get SWITCH_MIN_PX() { return 1.2; }
    static get SWITCH_MAX_PX() { return 48; }
    // 模式切换冷却（毫秒），防止阈值附近反复横跳
    static get SWITCH_COOLDOWN_MS() { return 600; }
    // 手动切换后的「自动切换」抑制窗口：避免刚点完层级标签就被滚轮判定反向切回
    static get MANUAL_LOCK_MS() { return 1500; }
    static get NEIGHBOR_LIMIT() { return 50; }
    static get RENDER_BATCH_SIZE() { return 300; }
    // 渲染节点数超过该值时隐藏标签（缩略下不可读），悬浮/属性面板/搜索仍可查看
    static get LABEL_MAX_NODES() { return 600; }
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

                .tool-btn[hidden] { display: none; }

                /* 层级标签是手动切换按钮：与 .tool-btn 同款边框/白底，一眼可辨可点 */
                .mode-label {
                    margin-left: auto;
                    font-size: 12px;
                    color: #4b5563;
                    white-space: nowrap;
                    padding: 5px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    background: #fff;
                    font-family: inherit;
                    line-height: 1.3;
                    cursor: pointer;
                    transition: all .2s;
                }
                .mode-label:hover { color: #4c89ff; background: #f5f8ff; border-color: #4c89ff; }
                .mode-label:active { transform: translateY(1px); }
                .mode-label:focus-visible { outline: 2px solid #4c7cf3; outline-offset: 2px; }

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

                /* 两个画布绝对定位重叠；用 visibility 互斥而不是 display，
                   这样切换时两者尺寸始终有效，G6/Sigma 都无需重算尺寸或重建 */
                #graphContainer,
                #overviewContainer {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                }

                #graphContainer { z-index: 0; }

                #overviewContainer {
                    z-index: 1;
                    overflow: hidden;
                    background: #f5f7fa;
                }

                /* Sigma 把鼠标交互（拖拽/滚轮/点击）绑在最上层的 canvas.sigma-mouse 上，
                   必须保留它的 pointer-events；其余绘制层全部透传，事件统一落在该画布 */
                #overviewContainer canvas { pointer-events: none; }
                #overviewContainer canvas.sigma-mouse { pointer-events: auto; }

                .graph-wrap[data-mode="subgraph"] #overviewContainer {
                    visibility: hidden;
                    pointer-events: none;
                }

                .graph-wrap[data-mode="overview"] #graphContainer {
                    visibility: hidden;
                    pointer-events: none;
                }

                .overview-badge {
                    position: absolute;
                    right: 12px;
                    top: 12px;
                    z-index: 12;
                    display: none;
                    padding: 5px 10px;
                    border: 1px solid #d7e3f7;
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.94);
                    color: #1d6feb;
                    font-size: 11px;
                    white-space: nowrap;
                    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
                }

                .graph-wrap[data-mode="overview"] .overview-badge { display: block; }

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

                .legend-line {
                    width: 14px;
                    height: 3px;
                    border-radius: 2px;
                    flex-shrink: 0;
                }

                .legend-sep {
                    width: 100%;
                    font-size: 11px;
                    color: #94a3b8;
                    border-top: 1px solid #eef1f6;
                    padding-top: 4px;
                }

                /* 图例可点击过滤（全图概览模式）：hover 高亮、off 态置灰加删除线 */
                .legend-item.clickable {
                    cursor: pointer;
                    border-radius: 3px;
                    padding: 1px 4px;
                    margin: -1px -4px;
                }

                .legend-item.clickable:hover {
                    background: #eef2fa;
                }

                .legend-item.off {
                    opacity: 0.38;
                    text-decoration: line-through;
                }

                .legend-item i {
                    font-style: normal;
                    color: #9aa5b5;
                    font-size: 11px;
                    margin-left: 2px;
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
                        <span class="header-meta-item" id="breadcrumb" style="color:#4c89ff;display:none;font-weight:600;"></span>
                        <div class="header-stats">
                            <span>节点 <strong id="statLoadedNodes">0</strong>/<span id="statTotalNodes">-</span></span>
                            <span>边 <strong id="statEdges">0</strong>/<span id="statTotalEdges">-</span></span>
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
                    <button class="tool-btn" id="overviewEdgesBtn" hidden>隐藏边</button>
                    <button class="tool-btn" id="edgeLevelBtn" hidden title="默认随缩放自动增减边密度（LOD）；点击可锁定精简/均衡/全量三档；全部边始终在 GPU 缓冲中">边: 自适应</button>
                    <button type="button" class="mode-label" id="modeLabel" title="点击切换到全图概览">力导子图 · G6 ⇄</button>
                </div>

                <div class="main-area">
                    <div class="graph-wrap" data-mode="subgraph">
                        <div id="graphContainer"></div>
                        <div id="overviewContainer"></div>
                        <div class="overview-badge" id="overviewBadge">Sigma.js · WebGL 全图</div>
                        <div class="graph-hint" id="graphHint">滚轮缩放画布；<b>单击节点展开其邻接关系</b>；悬浮查看属性</div>                        <div class="kg-tooltip" id="kgTooltip"></div>
                        <div class="legend" id="legend"></div>
                        <!-- 右下角小属性面板：展示搜索定位/悬浮到的节点或边属性 -->
                        <div class="props-panel" id="propsPanel">
                            <div class="props-panel-header" id="propsPanelToggle">
                                <span>属性</span>
                                <span class="props-toggle-mark" id="propsToggleMark">−</span>
                            </div>
                            <div class="props-panel-body" id="propsPanelBody">
                                <div class="props-placeholder">搜索定位或悬浮节点/边<br>查看属性</div>
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
        // 工具栏按当前视图模式路由：全图概览走 Sigma 相机，力导子图走 G6
        $('#zoomInBtn')?.addEventListener('click', () => {
            if (this.viewMode === 'overview') this.overview && this.overview.zoomIn();
            else if (this.graph) this.graph.zoom(1.2);
        });
        $('#zoomOutBtn')?.addEventListener('click', () => {
            if (this.viewMode === 'overview') this.overview && this.overview.zoomOut();
            else if (this.graph) {
                this.graph.zoom(1 / 1.2);
                this.maybeUpgradeToOverview();
            }
        });
        $('#fitBtn')?.addEventListener('click', () => {
            if (this.viewMode === 'overview') this.overview && this.overview.fit();
            else if (this.graph) {
                this.graph.fitView(30);
                this._fitZoom = this.graph.getZoom();
            }
        });
        $('#relayoutBtn')?.addEventListener('click', () => this.graph && this.graph.layout());
        // 层级标签 = 手动切换兜底入口（与滚轮自动切换共用同一套入口/阈值/守卫）
        $('#modeLabel')?.addEventListener('click', () => this.toggleViewMode());
        $('#overviewEdgesBtn')?.addEventListener('click', () => {
            if (!this.overview) return;
            const hidden = this.overview.toggleEdges();
            $('#overviewEdgesBtn').textContent = hidden ? '显示边' : '隐藏边';
        });
        $('#edgeLevelBtn')?.addEventListener('click', () => {
            if (!this.overview || this._edgeLevelBusy) return;
            this._edgeLevelBusy = true;
            this.showLoading('正在调整边的显示密度...');
            // 让遮罩先绘制一帧，再做一次性的全量重算（约几百毫秒）
            setTimeout(() => {
                try {
                    this.overview.cycleEdgeMode();
                    this.syncEdgeLevelButton();
                } finally {
                    this.hideLoading();
                    this._edgeLevelBusy = false;
                }
            }, 30);
        });
        // 图例可点击过滤（仅全图概览模式）：点击类别/关系项显示或隐藏该类元素
        $('#legend')?.addEventListener('click', (e) => {
            const item = e.target && e.target.closest ? e.target.closest('.legend-item') : null;
            if (!item || !item.dataset || !item.dataset.kind) return;
            if (this.viewMode !== 'overview' || !this.overview || this._edgeLevelBusy) return;
            const kind = item.dataset.kind;
            const key = item.dataset.key || '';
            this._edgeLevelBusy = true;
            this.showLoading('正在按图例过滤...');
            setTimeout(() => {
                try {
                    if (kind === 'node') this.overview.toggleNodeType(key);
                    else if (kind === 'edge') this.overview.toggleEdgeRelType(key);
                    this.renderLegend();
                    this.updateOverviewBadge();
                } finally {
                    this.hideLoading();
                    this._edgeLevelBusy = false;
                }
            }, 30);
        });
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
                if (!container) return;
                const w = container.clientWidth;
                const h = container.clientHeight;
                if (!w || !h) return;
                // 尺寸没变就完全不动画布：changeSize() 会重置 G6 的 canvas 位图，
                // 无谓调用（例如模式切换间接触发的 resize）会让画布变空白。
                if (w === this.graph.get('width') && h === this.graph.get('height')) return;
                this.graph.changeSize(w, h);
                // changeSize 之后必须重绘，且必须晚于 G6 内部的异步绘制调度：
                // 同步或过早的 refresh() 会被节流吞掉，画布就永久空白。
                // 这里下一帧执行一次，再留一个 120ms 的幂等兜底（rAF 在后台标签页可能不触发）。
                // 注意绝不能调 render()：它会 clear 后再 clear，反而把画布再次清空。
                const graph = this.graph;
                const repaint = () => {
                    if (this.graph !== graph || graph.get('destroyed')) return;
                    try {
                        graph.refresh();
                        graph.paint();
                        graph.fitView(30);
                        this._fitZoom = graph.getZoom();
                    } catch (e) { /* 忽略 */ }
                };
                requestAnimationFrame(() => setTimeout(repaint, 0));
                setTimeout(repaint, 120);
            });
        }
    }

    isShown() {
        return this.hasAttribute('show');
    }

    /**
     * 切换到「全图概览」：把首屏已缓存的全量 nodes/edges 交给 Sigma.js 一次性渲染。
     * G6 实例不销毁，仅隐藏画布，「返回子图」时直接恢复原有布局与展开状态。
     */
    async enterOverview() {
        if (this.viewMode === 'overview' || this._switching) return;
        if (!this.allNodes || !this.allNodes.length) {
            this.showMessage('暂无可概览的图数据');
            return;
        }
        const Overview = window.KnowledgeGraphOverview;
        if (!Overview || !Overview.isSupported()) {
            this.showMessage(Overview ? Overview.unsupportedReason() : '全图概览组件未加载');
            return;
        }

        this._switching = true;
        try {
            // 「返回子图 → 再次全图概览」：数据未变则直接复用已上传的 GPU 缓冲，瞬时切回
            if (this.overview && this.overview.canReuse(this.allNodes, this.allEdges)) {
                this.viewMode = 'overview';
                this.applyViewMode();
                this.overview.resume();
                return;
            }

            this.showLoading('正在准备全图数据...');
            // 让 loading 遮罩先绘制一帧，再进行同步的 GPU 上传
            // rAF 在后台标签页可能不触发，加定时器兜底避免切换流程卡死
            await new Promise(resolve => {
                let done = false;
                const finish = () => { if (!done) { done = true; resolve(); } };
                requestAnimationFrame(finish);
                setTimeout(finish, 24);
            });
            const container = this.shadowRoot.querySelector('#overviewContainer');
            if (!container) return;
            if (!this.overview) {
                this.overview = new Overview(container, {
                    colorOf: (labelType) => this.labelColorOf(labelType),
                    onHoverNode: (model, x, y) => {
                        this.renderTooltip('节点', model, x, y, true);
                        this.updatePropsPanel('节点', model);
                    },
                    onHoverMove: (model, x, y) => this.renderTooltip('节点', model, x, y),
                    onLeaveNode: () => this.hideTooltip(),
                    onSelectNode: (model) => this.updatePropsPanel('节点', model),
                    onClearSelection: () => {
                        this.hideTooltip();
                        if (this.overview) this.overview.clearSpotlight();
                    },
                    // 全图概览充当 minimap/规模导航：单击节点 → 返回子图并搜索定位展开
                    onOpenInSubgraph: (model) => this.openInSubgraph(model),
                    // LOD 档位变化 → 同步按钮文案与角标点亮数
                    onLodChange: () => this.syncEdgeLevelButton(),
                    onEdgeModeChange: () => this.syncEdgeLevelButton(),
                    // 尺寸判据下钻：概览节点放大到子图尺度 → 以相机中心最近节点为种子切子图
                    onZoomDrill: (nodeId, px) => this.drillToSubgraph(nodeId, px),
                    // 两图共用同一套尺寸阈值（概览侧判定与宿主侧判定不会各算各的）
                    switchThresholds: () => this.switchThresholds(),
                    // 手动切换后短时间内抑制概览侧的自动下钻，避免刚点完就反向切回
                    isSwitchLocked: () => this.isSwitchLocked()
                });
            }

            const result = await this.overview.render(this.allNodes, this.allEdges,
                (text) => this.showLoading(text));
            this.overviewNodeCount = result.nodes;
            this.overviewEdgeCount = result.edges;
            // 冻结概览「初始视图（ratio=1）」的节点直径。必须在 render 完成后取真实统计值，
            // 且只记这一次：之后概览被缩到多小 / 放到多大都不能改写切换基准。
            this.captureInitialOverviewPx();
            this.viewMode = 'overview';
            this.applyViewMode();
            this.overview.resume();
            this.hideLoading();

            // 后端若返回的是截断数据，明确告知用户，避免"假全图"
            const totalNodes = Number(this.totalNodes || 0);
            const totalEdges = Number(this.totalEdges || 0);
            if ((totalNodes && result.nodes < totalNodes) || (totalEdges && result.edges < totalEdges)) {
                this.showMessage(`接口返回被截断：已渲染 ${result.nodes}/${totalNodes} 节点、${result.edges}/${totalEdges} 边，请检查后端全量查询上限`);
            }
        } catch (error) {
            console.error('全图概览渲染失败:', error);
            this.destroyOverview();
            this.viewMode = 'subgraph';
            this.applyViewMode();
            this.hideLoading();
            this.showMessage('全图概览渲染失败: ' + error.message);
        } finally {
            this._switching = false;
        }
    }

    /**
     * 返回力导子图：G6 画布一直在，重新可见后做一次轻量重绘与视图适配。
     * 无论从「手动切换 / 单击概览节点 / 缩放阈下钻」哪条路径回来，相机一律对齐到
     * 子图自己的初始节点大小，不继承概览刚放大到的尺寸；
     * 单击概览节点定位展开时，后续的 focusSearch / focusItem 仍负责平移到目标节点。
     */
    backToSubgraph() {
        if (this.viewMode !== 'overview') return;
        this.viewMode = 'subgraph';
        // 返回子图时保留聚光灯：再次进入概览可看到「我刚才在看哪」
        const bc = this.shadowRoot.querySelector('#breadcrumb');
        if (bc) bc.style.display = '';
        this.applyViewMode();
        this.hideTooltip();
        if (!this.graph || this.graph.get('destroyed')) return;

        // 两个画布用 visibility 互斥，容器尺寸从未变化，绝不能调用 changeSize()：
        // 它会重置 G6 的 canvas 位图，配合 enableOptimize 视口裁剪后不会自动重绘，
        // 结果就是「返回子图」一片空白。这里只做一次全量重绘 + fitView（≤1000 节点，开销可忽略）。
        // rAF 在后台标签页可能不触发，加定时器兜底。
        let done = false;
        const restore = () => {
            if (done) return;
            done = true;
            if (this.viewMode !== 'subgraph' || !this.graph || this.graph.get('destroyed')) return;
            try {
                this.graph.refresh();
                this.graph.fitView(30);   // 只用来重绘并把图居中，不作为切换基准
                this._fitZoom = this.graph.getZoom();
                // fitView 只保证「当前数据适应画布」（展开过邻居 / 重建过种子子图后会变），
                // 再按冻结的子图初始尺寸反解 zoom，保证每次回来节点都是同一初始大小。
                const px = this.switchThresholds().entrySubgraphPx;
                const target = Math.max(0.02, Math.min(10,
                    px / KnowledgeGraphDetail.NODE_BASE_PX));
                const w = Number(this.graph.get('width')) || 600;
                const h = Number(this.graph.get('height')) || 400;
                this.graph.zoomTo(target, { x: w / 2, y: h / 2 });
            } catch (e) { /* 忽略切换瞬间的竞态 */ }
            if (this._pendingManualLock) { this._pendingManualLock = false; this._armManualLock(); }
        };
        requestAnimationFrame(restore);
        setTimeout(restore, 24);
    }

    /**
     * 全图概览单击节点 → 返回力导子图，回填搜索框并触发搜索定位到该节点，
     * 再自动触发一次"点击"语义（展开其一跳邻接 + 属性面板，expandNode 幂等）。
     * 子图已含该节点：直接搜索定位；未含：先增量加入再展开定位。
     */
    openInSubgraph(model) {
        const id = String((model && model.id != null) ? model.id : (model || ''));
        if (!id || id === 'null' || id === 'undefined') return;
        const label = (model && (model.rawLabel || model.label)) || id;
        // ⓪ 下钻连贯体验：概览侧聚光灯（该节点+一跳邻域高亮、其余变暗）+ 相机平移到该节点，
        //    250ms 后无缝切子图 —— 概览与子图因此成为同一张图的两级缩放，而非两张独立图
        if (this.viewMode === 'overview' && this.overview) {
            this.overview.setSpotlight(id);
            if (this.overview.cancelDrill) this.overview.cancelDrill();
            this.overview.flyToNode(id);
        }
        // ① 搜索框回填节点 ID：概览单击 = 「按 ID 搜索定位」语义
        //    （节点 label 可能是「部件」这类类别词，ID 才是唯一定位标识）
        const input = this.shadowRoot.querySelector('#searchInput');
        if (input) input.value = id;
        // ⓪.5 面包屑：标识当前子图来自哪次下钻
        this.setBreadcrumb(label);
        if (this.viewMode === 'overview') {
            // 等平移动画播完再切（聚光灯预览成为「起跳」动作）
            setTimeout(() => {
                if (this.viewMode === 'overview') this.backToSubgraph();
                if (this.viewMode === 'subgraph') this.locateAndExpandInSubgraph(id, label);
            }, 380);
            return;
        }
        if (this.viewMode !== 'subgraph') return;
        this.locateAndExpandInSubgraph(id, label);
    }

    /** 子图内定位指定节点：增量加入（如未含）→ 展开一跳邻接 → 聚焦 + 属性面板 */
    locateAndExpandInSubgraph(id, label) {
        // backToSubgraph 的重绘走 rAF + 24ms 兜底，等它完成后再定位
        setTimeout(() => {
            if (this.viewMode !== 'subgraph' || !this.graph || this.graph.get('destroyed')) return;
            if (!this.nodeById || !this.nodeById.get(id)) {
                this.showMessage(`子图中未找到节点「${label}」`);
                return;
            }
            // 搜索定位：按精确 ID 命中 + focusItem 聚焦 + 属性面板同步
            const searchLocate = () => setTimeout(() => this.focusSearch(id), 350);
            if (this.graph.findById(id)) {
                this.expandNode(id)
                    .then(searchLocate)
                    .catch((e) => console.warn('子图定位失败:', e));
            } else {
                this.appendIncrementally([this.nodeById.get(id)], [], { skipLayout: true, hideLabels: false })
                    .then(() => this.expandNode(id))
                    .then(searchLocate)
                    .catch((e) => console.warn('子图定位失败:', e));
            }
        }, 80);
    }

    /** 面包屑：标识当前子图的来源（全图概览 › 节点名） */
    setBreadcrumb(label) {
        const bc = this.shadowRoot.querySelector('#breadcrumb');
        if (!bc) return;
        if (label) {
            bc.textContent = '全图 › ' + label;
            bc.style.display = '';
        } else {
            bc.style.display = 'none';
        }
    }

    // ---------- 语义缩放：以「两张图初始视图的节点大小」为固定基准 ----------

    /** 把节点直径钳到安全区间，避免空图 / 极端布局算出 0 或几百 px 的阈值 */
    static clampNodePx(v) {
        const n = Number(v);
        if (!(n > 0)) return KnowledgeGraphDetail.SWITCH_MIN_PX;
        return Math.max(KnowledgeGraphDetail.SWITCH_MIN_PX,
            Math.min(KnowledgeGraphDetail.SWITCH_MAX_PX, n));
    }

    /**
     * 冻结子图初始节点直径：只在首张「有节点、已完成首次 fitView」的子图上记一次。
     * 旧实现把 _fitZoom（每次 fitView 都重算）当基准：返回子图、下钻重建种子子图、
     * 窗口 resize、点「适应画布」都会改写它，而且力导布局未收敛时的 fitView 会虚高，
     * 于是阈值一轮一轮往下漂，用户必须把图缩得非常小才够得到切换点。
     */
    captureInitialSubgraphPx() {
        if (this._baseSubgraphPx != null) return;
        if (!this.graph || this.graph.get('destroyed')) return;
        const nodes = this.graph.getNodes ? this.graph.getNodes() : [];
        if (!nodes || !nodes.length) return;
        const zoom = Number(this.graph.getZoom());
        if (!(zoom > 0)) return;
        this._baseSubgraphPx = KnowledgeGraphDetail.clampNodePx(
            KnowledgeGraphDetail.NODE_BASE_PX * zoom);
        this._switchThresholdsCache = null;
    }

    /** 冻结概览初始节点直径（ratio=1 的默认视图，与当前相机无关） */
    captureInitialOverviewPx() {
        if (this._baseOverviewPx != null) return;
        if (!this.overview || !this.overview.defaultNodeSizePx) return;
        const px = Number(this.overview.defaultNodeSizePx());
        if (!(px > 0)) return;
        this._baseOverviewPx = KnowledgeGraphDetail.clampNodePx(px);
        this._switchThresholdsCache = null;
    }

    /**
     * 子图当前视图下的节点直径。
     * 定位改用「圈定」（只改描边/加圆环，不动 model.size），节点尺寸恒定，
     * 判据天然不会被一次搜索点击带偏。
     */
    subgraphNodePx() {
        const zoom = (this.graph && !this.graph.get('destroyed'))
            ? this.graph.getZoom() : (this._fitZoom || 1);
        return KnowledgeGraphDetail.NODE_BASE_PX * zoom;
    }

    /** 子图初始节点直径：优先用冻结值，冻结前用 fitView 值兜底 */
    subgraphInitialNodePx() {
        if (this._baseSubgraphPx != null) return this._baseSubgraphPx;
        return KnowledgeGraphDetail.clampNodePx(
            KnowledgeGraphDetail.NODE_BASE_PX * (Number(this._fitZoom) || 1));
    }

    /**
     * 概览初始节点直径：冻结值 > 实例真实统计值 > 构建前公式估算。
     * 这些都是 ratio=1 的默认视图尺寸，与用户当前把概览缩到多小 / 放多大无关。
     */
    overviewInitialNodePx() {
        if (this._baseOverviewPx != null) return this._baseOverviewPx;
        if (this.overview && this.overview.defaultNodeSizePx) {
            return KnowledgeGraphDetail.clampNodePx(this.overview.defaultNodeSizePx());
        }
        const O = window.KnowledgeGraphOverview;
        if (!O || !O.nodeSizeOf) return 4;
        const count = (this.allNodes && this.allNodes.length) || 0;
        return KnowledgeGraphDetail.clampNodePx(2 * O.nodeSizeOf(this._medianDegree || 0, count));
    }

    /**
     * 双向切换阈值：只由两张图冻结的「初始大小」推导，与当前相机无关。
     * 交界基准 T = √(ov0 × sub0)；缩小侧 toOverview = T/√H，
     * 放大侧 toSubgraph = T×SWITCH_ZOOM_IN_FACTOR（比缩小侧宽，补偿 Sigma 更大的滚轮步长）。
     * 另给出 entryOverviewPx / entrySubgraphPx（就是两个初始大小）：切换后目标图的落点尺寸，
     * 落点不随阈值调整而变，保证下一轮「缩回概览」的距离仍然恒定。
     */
    switchThresholds() {
        const frozen = this._baseSubgraphPx != null && this._baseOverviewPx != null;
        if (frozen && this._switchThresholdsCache) return this._switchThresholdsCache;
        const clamp = (v) => KnowledgeGraphDetail.clampNodePx(v);
        const ov = clamp(this.overviewInitialNodePx());
        const sub = clamp(this.subgraphInitialNodePx());
        const crossover = Math.sqrt(ov * sub);
        const h = Math.sqrt(KnowledgeGraphDetail.SWITCH_HYSTERESIS);
        const toOverview = clamp(crossover / h);
        const toSubgraph = clamp(crossover * KnowledgeGraphDetail.SWITCH_ZOOM_IN_FACTOR);
        const result = {
            overviewInitial: ov,
            subgraphInitial: sub,
            // 切换后目标图的节点大小 = 它自己的初始大小，绝不继承源图缩放后的尺寸
            entryOverviewPx: ov,
            entrySubgraphPx: sub,
            crossover, toOverview, toSubgraph
        };
        if (frozen) this._switchThresholdsCache = result;
        return result;
    }

    /** 起算「手动切换」的冷却与抑制窗口（切换完成时再调一次，覆盖异步构建耗时） */
    _armManualLock() {
        const now = Date.now();
        this._lastModeSwitch = now;
        this._manualLockUntil = now + KnowledgeGraphDetail.MANUAL_LOCK_MS;
    }

    /** 自动缩放切换是否正处于手动切换后的抑制窗口 */
    isSwitchLocked() {
        return Date.now() < (this._manualLockUntil || 0);
    }

    /**
     * 工具栏层级标签点击 = 手动切换（滚轮自动切换的兜底）。
     * 关键：不新增第二套状态机，只复用 upgradeToOverview / backToSubgraph 两个统一入口；
     * 落点尺寸由 switchThresholds 给出的「目标图初始大小」决定，不看当前缩放状态。
     */
    toggleViewMode() {
        // 手动入口始终优先：手动锁只压制「自动」判定，手动连点仅受 600ms 冷却约束（可立即反悔）
        if (this._switching) return;
        const now = Date.now();
        if (this._lastModeSwitch && now - this._lastModeSwitch < KnowledgeGraphDetail.SWITCH_COOLDOWN_MS) return;
        this._armManualLock();
        this._pendingManualLock = true;   // 异步切换完成后重新起算锁定窗口
        clearTimeout(this._zoomCheckTimer);
        if (this.viewMode === 'subgraph') {
            this.upgradeToOverview();
        } else {
            // 与 openInSubgraph（单击节点回填 ID + 定位展开）语义不同，这里只做纯视图切换
            if (this.overview) this.overview.cancelDrill();
            this.backToSubgraph();
        }
    }

    /** 子图节点缩小到全图概览的尺度 → 自动升级（wheel 缩小手势 / 缩小按钮，250ms 节流后判定） */
    maybeUpgradeToOverview() {
        if (!this.graph || this.graph.get('destroyed')) return;
        if (this.viewMode !== 'subgraph' || this._switching) return;
        const now = Date.now();
        if (this.isSwitchLocked()) return;
        if (this._lastModeSwitch && now - this._lastModeSwitch < KnowledgeGraphDetail.SWITCH_COOLDOWN_MS) return;
        const px = this.subgraphNodePx();
        const { toOverview } = this.switchThresholds();
        if (px > toOverview) return;   // 节点还没缩到触发点
        // 切换前清掉定位圈定的描边/圆环，避免带着高亮跨视图（画布隐藏后圈会残留）
        if (this._locateItem) this._clearLocate();
        this._lastModeSwitch = now;
        this.upgradeToOverview();
    }

    /**
     * 升级为全图概览：切过去后概览节点一律是它自己的初始大小（ratio≈1 的默认视图、整图居中），
     * 不继承子图刚缩小到的尺寸。触发点 T/√H 与初始大小只差约 15%，视觉上仍是平滑衔接。
     */
    async upgradeToOverview() {
        if (this.viewMode === 'overview' || this._switching) return;
        try {
            this._preDrillZoom = this.graph ? this.graph.getZoom() : 1;
            await this.enterOverview();
            if (!this.overview) return;
            // 清除下钻时的聚光灯（否则概览里除邻域外全被调暗，看起来像「啥也不显示」）
            this.overview.clearSpotlight();
            this.overview.setCameraForNodeSize(this.switchThresholds().entryOverviewPx);
        } catch (error) {
            console.error('升级全图概览失败:', error);
            this.showMessage('升级全图概览失败: ' + error.message);
        } finally {
            // 首次构建概览可能耗时数秒，锁定窗口从「切换真正完成」起算才有意义
            if (this._pendingManualLock) { this._pendingManualLock = false; this._armManualLock(); }
        }
    }

    /**
     * 全图概览缩放跨过下钻阈值 → 以相机中心最近节点为种子下钻子图（由概览组件检测并回调）
     */
    drillToSubgraph(seedId, _entryPx) {
        const seed = this.nodeById.get(String(seedId));
        if (!seed) return;
        // entryPx 是触发瞬间概览的节点尺寸，只用于回调契约；目标图落点固定为子图初始大小，
        // 不把它透传下去，避免子图带着「放大后的尺寸」开始、下一轮要缩得更小才能切回。
        this._switching = true;
        this._lastModeSwitch = Date.now();   // 与升概览共用冷却，杜绝双向连跳
        this.viewMode = 'subgraph';
        const finish = () => {
            this._switching = false;
        };
        // 切换前先取消待触发的下钻，避免飞入动画再次回调
        if (this.overview) this.overview.cancelDrill();
        // 概览相机只平移到种子（不改 ratio，保持节点尺寸连续），随后切换画布
        this.overview.flyToNode(String(seedId));
        setTimeout(() => {
            try {
                this.renderSeedSubgraph(String(seedId));
            } catch (error) {
                console.error('下钻渲染失败:', error);
                this.showMessage('下钻渲染失败: ' + error.message);
            } finally {
                finish();
            }
        }, 260);
    }

    /**
     * 以种子节点为根 BFS 收集至多 MAX_RENDER_NODES 个节点的邻域子图，
     * 种子置画布中心、按 BFS 层环形摆位（层=扩散圈层，观感即「以该节点为中心逐圈展开」）。
     * 渲染后 fitView，聚光灯设为种子+邻域（返回概览可回看）。
     */
    async renderSeedSubgraph(seedId) {
        const cap = KnowledgeGraphDetail.MAX_RENDER_NODES;
        // BFS 收集（含种子）
        const order = [seedId];
        const seen = new Set([seedId]);
        for (let head = 0; head < order.length && order.length < cap; head++) {
            const cur = order[head];
            const links = (this.adjacency && this.adjacency.get(cur)) || [];
            for (const e of links) {
                const other = cur === String(e.source) ? String(e.target) : String(e.source);
                if (!seen.has(other)) {
                    seen.add(other);
                    order.push(other);
                }
                if (order.length >= cap) break;
            }
            if (order.length >= cap) break;
        }

        // BFS 层深（用于环形摆位）
        const depthOf = new Map([[seedId, 0]]);
        for (let i = 0; i < order.length; i++) {
            const cur = order[i];
            const d = depthOf.get(cur) || 0;
            const links = (this.adjacency && this.adjacency.get(cur)) || [];
            for (const e of links) {
                const other = cur === String(e.source) ? String(e.target) : String(e.source);
                if (!depthOf.has(other)) depthOf.set(other, d + 1);
            }
        }

        const hideLabels = order.length > KnowledgeGraphDetail.LABEL_MAX_NODES;
        const nodeModels = order.map(id => {
            const raw = this.nodeById.get(id);
            if (!raw) return null;
            const label = raw.label || id;
            const color = this.labelColorOf(raw.labelType || '未分类');
            return {
                id: String(id),
                label: hideLabels ? '' : (String(label).length > 16 ? String(label).slice(0, 15) + '…' : String(label)),
                rawLabel: String(label),
                properties: raw.properties || {},
                labelType: raw.labelType || '',
                style: { fill: color }
            };
        }).filter(Boolean);
        const idSet = new Set(nodeModels.map(m => m.id));
        const edgeModels = [];
        this.allEdges.forEach((e, i) => {
            const src = String(e.source), tgt = String(e.target);
            if (idSet.has(src) && idSet.has(tgt)) {
                edgeModels.push({
                    id: 'seed-e-' + i,
                    source: src,
                    target: tgt,
                    label: String(e.label || ''),
                    rawLabel: String(e.label || ''),
                    properties: e.properties || {},
                    style: {}
                });
            }
        });

        this.destroyGraph();
        // 复用 initGraph：创建 G6 画布（含力导布局配置）并绑定事件，单击展开等交互随之可用
        this.initGraph();
        await this.appendIncrementally(nodeModels, edgeModels);

        // 切换画布可见性（概览隐藏、子图显示）——这是"下钻生效"的关键一步
        this.applyViewMode();
        this.overview.clearSpotlight();

        this.renderedIds = new Set(nodeModels.map(m => String(m.id)));
        this.loadedNodeCount = this.renderedIds.size;
        this.renderedEdgeCount = edgeModels.length;
        this.hasMore = this.renderedIds.size < this.allNodes.length;
        this.setBreadcrumb('全图 › ' + seedId);
        this.overview.setSpotlight(seedId);
        this.updateStats();
        // fitView 只负责重绘 + 居中；_fitZoom 记的是「当前种子子图」的 zoom，不再作为切换基准。
        this.graph.fitView(30);
        this._fitZoom = this.graph.getZoom();
        // 下钻后节点直径固定为冻结的「子图初始大小」，而不是概览里刚放大到的尺寸。
        // 放大侧触发点被刻意推后（节点会比初始大小大），落点仍回初始大小：
        // 画布内容从 5 万点全图换成 500 点带标签的力导子图，观感是「换了一级视图」；
        // 更重要的是落点不随放大行程变化，下一轮缩回概览的距离才恒定、不会越滚越远。
        const px = this.switchThresholds().entrySubgraphPx;
        const target = Math.max(0.02, Math.min(10,
            px / KnowledgeGraphDetail.NODE_BASE_PX));
        const w = Number(this.graph.get('width')) || 600;
        const h = Number(this.graph.get('height')) || 400;
        this.graph.zoomTo(target, { x: w / 2, y: h / 2 });
    }

    /** 子图内相机聚焦到指定节点，并同步右下角属性面板 */
    focusGraphNode(id) {
        if (!this.graph || this.graph.get('destroyed')) return false;
        const item = this.graph.findById(String(id));
        if (!item) return false;
        try {
            this.graph.focusItem(item, true, { easing: 'easeCubic', duration: 400 });
        } catch (e) { /* 忽略 */ }
        this.updatePropsPanel('节点', item.getModel());
        return true;
    }

    /** 同步工具栏按钮、提示文案、统计与画布可见性 */
    applyViewMode() {
        const $ = (id) => this.shadowRoot.querySelector(id);
        const overview = this.viewMode === 'overview';
        const wrap = this.shadowRoot.querySelector('.graph-wrap');
        if (wrap) wrap.dataset.mode = this.viewMode;
        const show = (id, visible) => {
            const el = $(id);
            if (el) el.hidden = !visible;
        };
        show('#relayoutBtn', !overview);   // 重新布局只对 G6 力导子图有意义
        show('#overviewEdgesBtn', overview);
        show('#edgeLevelBtn', overview);
        const edgeBtn = $('#overviewEdgesBtn');
        if (edgeBtn) {
            edgeBtn.textContent = (this.overview && this.overview.edgesHidden) ? '显示边' : '隐藏边';
        }
        const levelBtn = $('#edgeLevelBtn');
        if (levelBtn && this.overview) levelBtn.textContent = this.overview.edgeLevelLabel();
        const modeBtn = $('#modeLabel');
        if (modeBtn) {
            modeBtn.textContent = overview ? '全图概览 · 规模导航 ⇄' : '力导子图 · G6 ⇄';
            modeBtn.title = overview
                ? '点击返回力导子图（滚轮缩放自动切换仍可用）'
                : '点击切换到全图概览（滚轮缩放自动切换仍可用）';
        }
        if ($('#graphHint')) {
            $('#graphHint').innerHTML = overview
                ? '远景只显示<b>高度数骨架</b>节点，滚轮放大逐步浮现更多；<b>放大到节点足够大自动进子图</b>；单击节点回子图定位；点击层级标签可手动切换'
                : '滚轮缩放画布；<b>缩小到节点足够小自动切全图概览</b>；单击节点展开邻接；悬浮查看属性；点击层级标签可手动切换';
        }
        this.updateOverviewBadge();
        this.updateStats();
        this.renderLegend();
    }

    /** 概览角标：总量 + 当前边模式/点亮数，避免"抽样显示"被误认为数据被截断 */
    updateOverviewBadge() {
        const badge = this.shadowRoot.querySelector('#overviewBadge');
        if (!badge) return;
        const lit = this.overview ? this.overview.visibleEdgeCount() : 0;
        badge.textContent = `全图概览 · ${this.overviewNodeCount.toLocaleString('zh-CN')} 节点 / ${this.overviewEdgeCount.toLocaleString('zh-CN')} 边`
            + (this.overview ? ` · ${this.overview.edgeLevelLabel()} · 点亮 ${lit.toLocaleString('zh-CN')}` : '');
    }

    destroyOverview() {
        if (this.overview) {
            try { this.overview.destroy(); } catch (e) { /* 忽略 */ }
            this.overview = null;
        }
        this.overviewNodeCount = 0;
        this.overviewEdgeCount = 0;
    }

    /**
     * show({name})：工作区显示指定图谱详情（与modelDetail的show(selectedModel)模式一致）
     */
    async show(params) {
        const name = typeof params === 'string' ? params : (params && params.name);
        if (!name) return;

        // 重建DOM（清除上次可能的错误态）并销毁旧图，画布尺寸按当前容器重新计算
        this.destroyOverview();          // 先释放上一张图谱的 WebGL 上下文
        this.render();
        this.initEventListeners();
        this.destroyGraph();
        this.viewMode = 'subgraph';
        this.graphName = name;
        this.loadedNodeCount = 0;
        this.renderedEdgeCount = 0;
        this.totalNodes = 0;
        this.totalEdges = 0;
        this.hasMore = false;
        this._fitZoom = 1;
        this._medianDegree = 0;
        // 换一张图谱 = 换一套初始大小基准，必须清空后重新冻结
        this._baseSubgraphPx = null;
        this._baseOverviewPx = null;
        this._switchThresholdsCache = null;
        this.labelColorMap = {};
        this.expandedNodeIds = new Set();
        this.allNodes = null;
        this.allEdges = null;
        this.nodeById = null;
        this.adjacency = null;   // 已单击展开过的节点

        this.style.display = 'flex';
        this.setAttribute('show', '');
        this.renderLegend();
        this.updateStats();
        this.resetPropsPanel();

        try {
            // 一次全量查询（节点表+关系表各查一次），渲染在客户端截取的连通子图上
            this.showLoading('正在加载知识图谱...');
            const result = await window.AppConfig.get('knowledgeGraph', 'data', {
                name,
                mode: 'full'
            });
            if (result.code !== 200 || !result.data) {
                throw new Error(result.message || '查询图数据失败');
            }
            const data = result.data;
            this.renderMeta(data);

            // 全量数据与邻接索引缓存到内存：后续单击展开直接查内存，无需再调接口
            this.allNodes = data.nodes || [];
            this.allEdges = data.edges || [];
            this.nodeById = new Map(this.allNodes.map(n => [String(n.id), n]));
            this.adjacency = new Map();
            this.allEdges.forEach(e => {
                const src = String(e.source), dst = String(e.target);
                if (!this.adjacency.has(src)) this.adjacency.set(src, []);
                if (!this.adjacency.has(dst)) this.adjacency.set(dst, []);
                this.adjacency.get(src).push(e);
                this.adjacency.get(dst).push(e);
            });
            // 概览节点 size 由度数决定；抽样统计中位数，供概览构建前估算「切换后图的节点大小」
            const degSamples = [];
            for (let i = 0; i < this.allNodes.length; i += 4) {
                degSamples.push((this.adjacency.get(String(this.allNodes[i].id)) || []).length);
            }
            degSamples.sort((a, b) => a - b);
            this._medianDegree = degSamples.length
                ? degSamples[Math.floor(degSamples.length / 2)] : 0;

            if (!this.totalNodes) {
                this.hideLoading();
                this.showMessage('该图谱暂无节点数据');
                return;
            }

            // 浏览器渲染上限：沿边滚雪球截取1000个节点的连通子图（类别多样、有连线）
            const sub = this.buildCappedSubgraph(data.nodes || [], data.edges || [],
                KnowledgeGraphDetail.MAX_RENDER_NODES);
            const hideLabels = sub.nodes.length > KnowledgeGraphDetail.LABEL_MAX_NODES;

            this.initGraph();
            for (let i = 0; i < sub.nodes.length; i += KnowledgeGraphDetail.RENDER_BATCH_SIZE) {
                await this.appendIncrementally(sub.nodes.slice(i, i + KnowledgeGraphDetail.RENDER_BATCH_SIZE), [],
                    { skipLayout: true, hideLabels });
                this.showLoading(`正在渲染节点 ${Math.min(i + KnowledgeGraphDetail.RENDER_BATCH_SIZE, sub.nodes.length)}/${sub.nodes.length} ...`);
            }
            const edgeBatch = KnowledgeGraphDetail.RENDER_BATCH_SIZE * 5;
            for (let i = 0; i < sub.edges.length; i += edgeBatch) {
                await this.appendIncrementally([], sub.edges.slice(i, i + edgeBatch),
                    { skipLayout: true, hideLabels });
                this.showLoading(`正在渲染关系 ${Math.min(i + edgeBatch, sub.edges.length)}/${sub.edges.length} ...`);
            }

            this.loadedNodeCount = sub.nodes.length;
            this.hasMore = sub.nodes.length < (data.nodes || []).length;
            this.updateStats();
            this.graph.layout();
            setTimeout(() => {
                try {
                    if (this.graph) {
                        this.graph.fitView(30);
                        this._fitZoom = this.graph.getZoom();
                        // 唯一一次冻结「子图初始大小」：首张有数据、已 fitView 的子图。
                        // 后续所有 fitView / zoomTo / 返回子图 / 重建种子子图都不再改写它。
                        this.captureInitialSubgraphPx();
                    }
                } catch (e) { /* 忽略 */ }
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
        this.destroyOverview();
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

    /**
     * 图例：节点类别 + 关系类型。
     * 全图概览模式下可点击过滤（隐藏/显示该类别或关系），并显示每类计数（类别分布）。
     */
    renderLegend() {
        const legendEl = this.shadowRoot.querySelector('#legend');
        if (!legendEl) return;
        const entries = Object.entries(this.labelColorMap);
        // 全图概览下追加「关系类型」图例，明确不同颜色的边各代表什么
        const overviewMode = this.viewMode === 'overview' && this.overview;
        const edgeEntries = overviewMode ? this.overview.getEdgeLegend() : [];
        const nodeStats = overviewMode ? this.overview.getNodeTypeStats() : null;
        if (!entries.length && !edgeEntries.length) {
            legendEl.classList.remove('visible');
            return;
        }
        legendEl.classList.add('visible');
        const zh = (n) => (n || 0).toLocaleString('zh-CN');
        const nodeHtml = entries.map(([label, color]) => {
            if (!overviewMode) {
                return `
            <span class="legend-item">
                <span class="legend-color" style="background:${color}"></span>${this.escapeHtml(label)}
            </span>
        `;
            }
            const off = this.overview.isNodeTypeFiltered(label);
            const count = nodeStats ? nodeStats.get(label) || 0 : 0;
            return `
            <span class="legend-item clickable${off ? ' off' : ''}" data-kind="node" data-key="${this.escapeHtml(label)}"
                  title="点击显示/隐藏该类别的全部节点">
                <span class="legend-color" style="background:${color}"></span>${this.escapeHtml(label)} <i>${zh(count)}</i>
            </span>
        `;
        }).join('');
        const edgeHtml = edgeEntries.length ? `
            <span class="legend-sep">关系</span>
            ${edgeEntries.map(({ type, color, count }) => {
                const off = this.overview.isEdgeTypeFiltered(type);
                return `
                <span class="legend-item clickable${off ? ' off' : ''}" data-kind="edge" data-key="${this.escapeHtml(type)}"
                      title="点击显示/隐藏该类关系">
                    <span class="legend-line" style="background:${color}"></span>${this.escapeHtml(type)} <i>${zh(count)}</i>
                </span>
            `;
            }).join('')}
        ` : '';
        legendEl.innerHTML = nodeHtml + edgeHtml;
    }

    /** 同步「边: 自适应/手动档」按钮文案与角标点亮数（LOD 跨档 / 切换模式 / 图例过滤后调用） */
    syncEdgeLevelButton() {
        const btn = this.shadowRoot.querySelector('#edgeLevelBtn');
        if (btn && this.overview) btn.textContent = this.overview.edgeLevelLabel();
        this.updateOverviewBadge();
    }

    updateStats() {
        const $ = (id) => this.shadowRoot.querySelector(id);
        if (!$('#statLoadedNodes')) return;
        const overview = this.viewMode === 'overview';
        const shownNodes = overview ? this.overviewNodeCount : this.loadedNodeCount;
        const shownEdges = overview ? this.overviewEdgeCount : this.renderedEdgeCount;
        $('#statLoadedNodes').textContent = shownNodes.toLocaleString('zh-CN');
        $('#statTotalNodes').textContent = this.totalNodes ? this.totalNodes.toLocaleString('zh-CN') : '-';
        $('#statEdges').textContent = shownEdges.toLocaleString('zh-CN');
        $('#statTotalEdges').textContent = this.totalEdges ? this.totalEdges.toLocaleString('zh-CN') : '-';
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
            // G6 只承载 ≤1000 节点的力导子图（全量图已交给 Sigma WebGL），不需要视口裁剪。
            // 不能开 enableOptimize：画布被隐藏或 changeSize 后它会清空位图却不重绘，
            // 导致「返回子图」/窗口缩放后出现空白画布。
            enableOptimize: false,
            defaultNode: {
                size: KnowledgeGraphDetail.NODE_BASE_PX,
                style: {
                    lineWidth: 1
                },
                labelCfg: {
                    position: 'bottom',
                    offset: 4,
                    style: { fontSize: 11, fill: '#4b5563' }
                }
            },
            // 搜索/下钻定位的「圈定」状态：金色粗描边。
            // 只保留 stroke/lineWidth 两个常规属性（G6 撤销状态时能干净还原），
            // 发光放在自建圆环上，环移除即彻底消失；全程不动 size，尺寸判据不受影响。
            nodeStateStyles: {
                locate: { stroke: '#ff9500', lineWidth: 4 }
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
                // 大图优化：边不渲染独立标签文本（几千个text shape严重拖慢交互），类型经悬浮窗查看
                labelCfg: {
                    style: { opacity: 0 }
                }
            }
        });

        // 属性悬浮窗：悬浮到节点/边上跟随鼠标展示，不影响图谱视野
        // 单击节点展开一跳邻接（Neo4j Browser的expand交互）
        this.graph.on('node:click', (evt) => {
            const model = evt.item.getModel();
            this.expandNode(String(model.id));
        });
        // 缩小手势 → 按节点屏幕尺寸判定是否升级全图概览（250ms 节流）。
        // 放大手势不参与判定，避免刚从概览下钻回来又被反向检查。
        const graphContainer = this.shadowRoot.querySelector('#graphContainer');
        if (graphContainer) {
            graphContainer.addEventListener('wheel', (e) => {
                if (e.deltaY <= 0) return;
                clearTimeout(this._zoomCheckTimer);
                this._zoomCheckTimer = setTimeout(() => this.maybeUpgradeToOverview(), 250);
            }, { passive: true });
        }
        this.graph.on('node:mousemove', (evt) => this.showTooltip('节点', evt));
        this.graph.on('edge:mousemove', (evt) => this.showTooltip('边', evt));
        // 右下角属性面板：悬浮时同步更新
        this.graph.on('node:mouseenter', (evt) => {
            this._tooltipForcePos = true;
            this.updatePropsPanel('节点', evt.item.getModel());
            // 仅"可展开"（存在未显示的邻居）的节点悬浮变手指，可展开与否一目了然
            const model = evt.item.getModel();
            const links = (this.adjacency && this.adjacency.get(String(model.id))) || [];
            const expandable = links.some(e => {
                const other = String(model.id) === String(e.source) ? String(e.target) : String(e.source);
                return !this.graph.findById(other);
            });
            try {
                this.graph.updateItem(evt.item, { style: { cursor: expandable ? 'pointer' : 'default' } });
            } catch (ignore) { /* 元素可能已销毁 */ }
        });
        this.graph.on('edge:mouseenter', (evt) => {
            this._tooltipForcePos = true;
            this.updatePropsPanel('边', evt.item.getModel());
        });
        this.graph.on('node:mouseleave', (evt) => {
            this.hideTooltip();
            try {
                this.graph.updateItem(evt.item, { style: { cursor: 'default' } });
            } catch (ignore) { /* 元素可能已销毁 */ }
        });
        this.graph.on('edge:mouseleave', () => this.hideTooltip());
        this.graph.on('canvas:mousemove', () => this.hideTooltip());
        this.graph.on('canvas:click', () => this.hideTooltip());
    }

    /**
     * 增量渲染：分批addItem，避免大图一次性渲染阻塞主线程
     */
    async appendIncrementally(newNodes, newEdges, opts) {
        opts = opts || {};
        const hideLabels = !!opts.hideLabels;
        const nodeModels = newNodes.map(n => {
            const label = n.label || n.id;
            const color = this.labelColorOf(n.labelType || '未分类');
            return {
                id: String(n.id),
                // 全图概览模式不显示标签（缩略下不可读，悬浮/属性面板可查），保持rawLabel供搜索与悬浮
                label: hideLabels ? '' : (String(label).length > 16 ? String(label).slice(0, 15) + '…' : String(label)),
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
            const overlay = this.shadowRoot.querySelector('#loadingOverlay');
            if (loadingText && overlay && !overlay.classList.contains('hidden')) {
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

        // 增量完成后重跑力导布局（全量概览模式由调用方统一做最终布局）
        if (!opts.skipLayout && (nodeModels.length || addedEdges.length)) {
            try {
                this.graph.layout();
            } catch (e) {
                console.warn('布局失败:', e);
            }
        }
        this.renderedEdgeCount += addedEdges.length;
    }

    /**
     * 客户端截取连通子图：分层选锚点 + 沿边滚雪球BFS，每节点最多带入8个邻居，
     * 保证子图类别多样、连通、有连线（与服务端sample同思路，作用于已取回的全量数据）
     */
    buildCappedSubgraph(allNodes, allEdges, cap) {
        if (allNodes.length <= cap) {
            return { nodes: allNodes, edges: allEdges };
        }
        const nodeById = new Map();
        const byLabel = new Map();
        allNodes.forEach(n => {
            nodeById.set(String(n.id), n);
            const label = String(n.labelType || '未分类');
            if (!byLabel.has(label)) byLabel.set(label, []);
            byLabel.get(label).push(n);
        });
        const adjacency = new Map();
        allEdges.forEach(e => {
            const src = String(e.source), dst = String(e.target);
            if (!adjacency.has(src)) adjacency.set(src, []);
            if (!adjacency.has(dst)) adjacency.set(dst, []);
            adjacency.get(src).push(e);
            adjacency.get(dst).push(e);
        });

        const selected = new Set();
        const selectedNodes = [];
        // 分层锚点：每类前几个
        const anchorsPerLabel = Math.max(2, Math.ceil(cap / Math.max(1, byLabel.size) / 5));
        byLabel.forEach(queue => {
            for (let i = 0; i < queue.length && i < anchorsPerLabel; i++) {
                const id = String(queue[i].id);
                if (!selected.has(id)) {
                    selected.add(id);
                    selectedNodes.push(queue[i]);
                }
            }
        });
        // 沿边BFS滚雪球
        const perNodeFanout = 8;
        const queue = selectedNodes.map(n => String(n.id));
        while (selectedNodes.length < cap && queue.length) {
            const nodeId = queue.shift();
            const links = adjacency.get(nodeId) || [];
            let brought = 0;
            for (const e of links) {
                if (selectedNodes.length >= cap || brought >= perNodeFanout) break;
                const other = nodeId === String(e.source) ? String(e.target) : String(e.source);
                const otherNode = nodeById.get(other);
                if (otherNode && !selected.has(other)) {
                    selected.add(other);
                    selectedNodes.push(otherNode);
                    queue.push(other);
                    brought++;
                }
            }
        }
        const selectedEdges = allEdges.filter(e =>
            selected.has(String(e.source)) && selected.has(String(e.target)));
        return { nodes: selectedNodes, edges: selectedEdges };
    }

    /**
     * 邻接扩展：单击节点展开其一跳邻居（增量addItem， Neo4j Browser的expand交互）
     */
    /**
     * 单击展开：直接从内存中的全量数据取一跳邻居（首屏已一次查询缓存），无接口调用
     */
    async expandNode(nodeId) {
        if (!this.graph || this.isLoadingMore) return;
        const links = (this.adjacency && this.adjacency.get(String(nodeId))) || [];
        if (!links.length) {
            this.showMessage(`「${nodeId}」暂无邻接关系`);
            return;
        }
        this.isLoadingMore = true;
        try {
            const neighborIds = [];
            const edges = [];
            for (const e of links) {
                const other = String(nodeId) === String(e.source) ? String(e.target) : String(e.source);
                edges.push(e);
                if (!neighborIds.includes(other)) {
                    neighborIds.push(other);
                }
            }
            // 邻居截断后仅保留两端都保留的边
            const limited = neighborIds.slice(0, KnowledgeGraphDetail.NEIGHBOR_LIMIT);
            const keep = new Set(limited);
            keep.add(String(nodeId));
            const keptEdges = edges.filter(e => keep.has(String(e.source)) && keep.has(String(e.target)));
            const nodes = limited.map(id => this.nodeById.get(id)).filter(Boolean);

            const hideLabels = (this.graph.getNodes().length + nodes.length) > KnowledgeGraphDetail.LABEL_MAX_NODES;
            await this.appendIncrementally(nodes, keptEdges, { hideLabels });
            this.expandedNodeIds.add(String(nodeId));
            // 展开完成后同步右上角统计（节点数以画布实际元素为准）
            this.loadedNodeCount = this.graph.getNodes().length;
            this.updateStats();
        } catch (error) {
            console.error('展开邻接失败:', error);
            this.showMessage('展开邻接失败: ' + error.message);
        } finally {
            this.isLoadingMore = false;
        }
    }

    renderMeta(data) {
        const $ = (id) => this.shadowRoot.querySelector(id);
        const graphInfo = data.graph || {};
        $('#graphTitle').textContent = graphInfo.name || this.graphName;
        $('#graphDesc').textContent = graphInfo.description || '';
        $('#metaNodePath').textContent = '节点路径: ' + (graphInfo.nodePath || '-');
        $('#metaNodePath').title = graphInfo.nodePath || '';
        $('#metaEdgePath').textContent = '边路径: ' + (graphInfo.edgePath || '-');
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
     * 搜索定位：按ID/标签匹配已加载节点并聚焦。
     * @param {string} [exactId] 可选精确节点 ID：概览钻取回填时优先按 ID 命中，
     *        避免标签前缀相同（如「节点1」匹配到「节点10」）时定位到错误节点。
     */
    focusSearch(exactId) {
        const input = this.shadowRoot.querySelector('#searchInput');
        const keyword = input ? input.value.trim().toLowerCase() : '';
        if (!keyword) return;
        // 全图概览：在全量节点里定位，命中后只动相机矩阵（GPU），不做重绘
        if (this.viewMode === 'overview') {
            if (!this.overview || !this.overview.focusSearch(keyword)) {
                this.showMessage('全图中未找到匹配的节点');
            }
            return;
        }
        if (!this.graph) return;
        let target = null;
        if (exactId != null) {
            const item = this.graph.findById(String(exactId));
            if (item) target = item;
        }
        if (!target) {
            target = this.graph.getNodes().find(n => {
                const m = n.getModel();
                return String(m.id).toLowerCase().includes(keyword)
                    || String(m.rawLabel || '').toLowerCase().includes(keyword);
            });
        }
        if (target) {
            this.graph.focusItem(target, true, { easing: 'easeCubic', duration: 400 });
            // 金色描边 + 双层圆环「圈定」命中节点，一眼可辨；8 秒后自动消失
            this._markLocate(target);
            // 画布不再强行拉到固定 zoom=0.8：从概览单击节点回子图时，fitView 给出约 0.25，
            // 这段老逻辑会在 430ms 后把节点直径从约 5.5px 抬到 17.6px，
            // 结果要滚近 20 档才够到「升全图概览」的尺寸阈值。
            // 现在只在当前视图节点确实过小（小于稳定带中点）时补到中点，
            // 命中节点已由描边+双层圆环圈定，无需放大整张画布；相机始终落在两条自动切换阈值之间。
            const { crossover } = this.switchThresholds();
            if (this.subgraphNodePx() < crossover) {
                const targetZoom = Math.max(0.02, Math.min(10,
                    crossover / KnowledgeGraphDetail.NODE_BASE_PX));
                setTimeout(() => {
                    if (!this.graph || this.graph.get('destroyed')) return;
                    try {
                        const pos = this.graph.getItemPosition(target);
                        this.graph.zoomTo(targetZoom, this.graph.graphToCanvasPoint(pos));
                    } catch (e) { /* 忽略 */ }
                }, 430);
            }
            // 搜索结果同步到右下角属性面板
            this.updatePropsPanel('节点', target.getModel());
        } else {
            this.showMessage('未找到匹配的已加载节点（可尝试先加载更多节点）');
        }
    }

    /**
     * 圈定命中节点：节点本身金色粗描边 + 外发光，再叠一圈实线金环和一圈虚线大环（靶心式圈定）。
     * 刻意不放大节点：放大既改变视觉尺寸，又会让「缩小回全图概览」看起来遥遥无期，
     * 而且会让基于节点屏幕尺寸的语义缩放判据变得不可信。
     * 只改状态样式 + 额外 shape，不动 model.size；下一次定位先清旧圈，8 秒后自动消失。
     */
    _markLocate(item) {
        if (!this.graph || this.graph.get('destroyed')) return;
        clearTimeout(this._locateTimer);
        this._clearLocate();
        try {
            this._locateItem = item;
            this.graph.setItemState(item, 'locate', true);
            const group = item.getContainer();
            const size = Number(item.getModel().size) || KnowledgeGraphDetail.NODE_BASE_PX;
            const r = size / 2;
            // 环半径均大于节点半径，不会遮挡节点本体；capture:false 保证不拦截单击展开
            this._locateShapes = [
                group.addShape('circle', {
                    attrs: {
                        x: 0, y: 0, r: r + 8,
                        stroke: '#ff9500', lineWidth: 3,
                        shadowColor: 'rgba(255,149,0,0.9)', shadowBlur: 16
                    },
                    name: 'kg-locate-ring', capture: false
                }),
                group.addShape('circle', {
                    attrs: {
                        x: 0, y: 0, r: r + 17,
                        stroke: '#ffb84d', lineWidth: 2, lineDash: [7, 5],
                        opacity: 0.95
                    },
                    name: 'kg-locate-ring', capture: false
                })
            ];
            // 置于节点下层，标签与节点始终可读
            this._locateShapes.forEach((s) => { try { s.toBack(); } catch (e) { /* 忽略 */ } });
        } catch (e) {
            this._clearLocate();
            return;
        }
        this._locateTimer = setTimeout(() => this._clearLocate(), 8000);
    }

    /** 清除圈定：撤掉 locate 状态样式并移除两个圆环（节点尺寸从未改变，无需恢复） */
    _clearLocate() {
        try {
            if (this._locateItem && !this._locateItem.destroyed) {
                this.graph.setItemState(this._locateItem, 'locate', false);
            }
        } catch (e) { /* 项已被移除则忽略 */ }
        (this._locateShapes || []).forEach((s) => {
            try { s.remove(true); } catch (e) { /* group 已重建则忽略 */ }
        });
        this._locateItem = null;
        this._locateShapes = null;
    }

    /**
     * 属性悬浮窗：跟随鼠标位置展示节点/边属性，不遮挡图谱整体视野
     */
    showTooltip(type, evt) {
        this.renderTooltip(type, evt.item.getModel(), evt.canvasX, evt.canvasY, true);
    }

    /**
     * 悬浮窗渲染（G6 与 Sigma 共用）：内容按元素缓存，位置更新约 40ms 节流，
     * 全图概览的高频 mousemove 因此只有少量 DOM 写入，完全不触碰 WebGL 缓冲。
     */
    renderTooltip(type, model, canvasX, canvasY, forcePos) {
        const tooltip = this.shadowRoot.querySelector('#kgTooltip');
        if (!tooltip) return;
        const itemId = type + ':' + String(model.id);
        if (this._tooltipItemId !== itemId) {
            this._tooltipItemId = itemId;
            tooltip.innerHTML = this.buildPropsHtml(type, model);
        }
        tooltip.classList.add('visible');
        const now = Date.now();
        if (!forcePos && this._tooltipMoveTs && now - this._tooltipMoveTs < 40 && !this._tooltipForcePos) {
            return;
        }
        this._tooltipMoveTs = now;

        // 跟随鼠标位置，靠右/靠下时自动翻转避免溢出
        const wrap = this.shadowRoot.querySelector('.graph-wrap');
        const wrapW = wrap ? wrap.clientWidth : 800;
        const wrapH = wrap ? wrap.clientHeight : 600;
        const tipW = 300;
        let x = canvasX + 14;
        if (x + tipW > wrapW) {
            x = Math.max(4, canvasX - tipW - 14);
        }
        let y = canvasY + 14;
        if (y + 260 > wrapH) {
            y = Math.max(4, canvasY - 260 - 14);
        }
        this._tooltipForcePos = false;
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
     * 构建节点/边属性展示HTML（悬浮窗与右下角属性面板共用）
     */
    buildPropsHtml(type, model) {
        const isNode = type === '节点';
        const props = Object.assign({}, model.properties || {});
        let html = isNode
            ? `<div class="props-title">节点 ${this.escapeHtml(model.id)}【${this.escapeHtml(model.rawLabel || '-')}】</div>`
            : `<div class="props-title">边 ${this.escapeHtml(model.source)} → ${this.escapeHtml(model.target)}【${this.escapeHtml(model.rawLabel || '-')}】</div>`;
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
     * 右下角属性面板：展示搜索定位/悬浮到的节点或边属性
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
            body.innerHTML = '<div class="props-placeholder">搜索定位或悬浮节点/边<br>查看属性</div>';
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
