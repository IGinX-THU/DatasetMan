/**
 * 知识图谱「全图概览」渲染器 —— Sigma.js 2.4.0 (WebGL) + graphology 0.25.4
 *
 * 与力导子图（G6 / Canvas / force layout）彻底分工：
 *   - 力导子图：G6，最多几百个节点，单击展开一跳邻居，力导布局重排；
 *   - 全图概览：本模块，一次性渲染全部节点 + 全部边（目标 ≥50,000 节点 / ≥200,000 边）。
 *
 * 流畅性设计（针对 5万节点 / 20万边）：
 *   1. 数据只灌一次：graphology 建图 → Sigma 一次性把节点/边打包成 WebGL 缓冲；
 *      之后平移缩放只改相机矩阵，由 GPU 重投影，主线程不重排、不逐帧重建几何。
 *   2. 建图分块 + 让出主线程，加载遮罩可正常绘制，不出现长时间白屏。
 *   3. 布局两阶段：先 O(N+E)「随机播种 + 邻域平均松弛 + 半径分位数归一」出均匀圆盘
 *      （随机播种让各类颜色均匀混布；松弛让相连节点靠拢、hub 聚中心），
 *      再用 ForceAtlas2（Barnes-Hut 近似，vendor 于 lib/sigma/forceatlas2.esm.min.js）
 *      分块迭代 ~150-300 轮做力导向精化：拉开簇团、留出簇间空隙，真力导向观感。
 *   4. 交互绝不调 renderer.refresh()：那会 O(N+E) 全量重算。
 *      点击/搜索只走相机动画 + 一张轻量 2D overlay 画布画一跳邻域（≤600 点）。
 *   5. 20万条边按关系类型共用最多 16 个属性对象（Sigma 内部会浅拷贝），显著降低 JS 堆占用。
 *   6. 边显隐走 nodeReducer/edgeReducer：「自适应 LOD」由相机 ratio 联动，也可手动锁定档位；
 *      类别/关系图例可点击过滤。切换档位才触发一次 refresh()（用户主动操作），
 *      全部边/节点始终在 GPU 缓冲中，平移缩放从不 O(N+E) 重算。
 *   7. 定位：本视图充当「全图 minimap / 规模导航」——单击节点即回调宿主，
 *      由宿主切回力导子图并定位展开该节点（对齐 Neo4j Bloom 的概览→钻取模型）。
 *
 * Shadow DOM 兼容：Sigma 的 MouseCaptor 在 document 上判断 e.target === container，
 * 而 shadow DOM 会把 e.target 重定向到宿主元素，导致 hover 失效。
 * 因此这里在容器上补一个 mousemove 桥接，直接向 captor 派发带本地坐标的 mousemove。
 */
class KnowledgeGraphOverview {
    constructor(container, hooks) {
        this.container = container;
        this.hooks = hooks || {};
        this.renderer = null;
        this.graph = null;
        this.overlay = null;
        this.overlayCtx = null;
        this._sourceNodes = null;
        this._sourceEdges = null;
        this.nodeIndex = new Map();   // id -> { rawLabel, labelType, properties, degree }
        this._spotlight = null;       // 聚光灯节点集合（下钻预览/返回回看）
        this._dimNodeCache = new Map();
        this._dimEdgeCache = null;
        this._drillArmed = true;      // 缩放下钻武装位（缩回远景时重新武装）
        this._drillTimer = null;
        this._userZoomIn = false;     // 只有用户滚轮/按钮「放大」才允许自动下钻
        this._wheelHandler = null;    // mouseCaptor 的 wheel 订阅（destroy 时解绑）
        this._nodeSizeRef = 2;        // 概览节点 size 中位数（ratio=1 时的像素半径）
        this.selectedNode = null;
        this.selectedNeighbors = [];
        this.neighborCount = 0;
        this.hoveredKey = null;
        this.edgesHidden = false;
        this.edgeMode = 'auto';   // 'auto' 缩放联动 LOD | 'manual' 手动档位
        this.edgeLevel = KnowledgeGraphOverview.EDGE_LEVEL;
        this._lodLevel = 1;          // 初始相机 ratio=1 → 中景档
        this._lastAppliedLod = 1;
        this._lodTimer = null;
        this._refreshTimer = null;
        this._nodeTypeFilter = new Set();  // 被隐藏的节点类别
        this._edgeTypeFilter = new Set();  // 被隐藏的关系类型
        this._hiddenNodeCache = new Map(); // 颜色 -> 隐藏版节点属性对象（复用，避免 refresh 产生海量临时对象）
        this._edgeTypeByIndex = [];        // 边序号 -> 关系类型（边 ID 固定为 'e'+序号）
        this._edgeTypeCounts = new Map();  // 关系类型 -> 边数（供图例计数）
        this.nodeTypeCounts = new Map();   // 节点类别 -> 数量（供图例计数）
        this._edgeCount = 0;
        this._hiddenEdgeCache = new Map();  // 按颜色复用 hidden 版属性对象，避免 refresh 时产生海量临时对象
        this._sizedEdgeCache = new Map();   // 按「颜色|线宽」复用变宽版属性对象
        this._camRatio = 1;                 // 当前相机 ratio（camera updated 事件同步）
        this._destroyed = false;            // destroy() 置位：让 render 中的异步循环及时中断
        this._lastSizeRatio = 1;            // 上次做边宽补偿时的 ratio（漂移检测）
        this._lodHiddenNodes = new Set();   // 节点 LOD：当前档位下被隐藏的低度数节点
        this._nodeLodLevel = -1;            // 已应用节点 LOD 的档位
        this.edgeTypeColors = new Map();  // 关系类型 -> 颜色（供图例使用）
        this._hoverHandler = null;
        this._leaveHandler = null;
        this._drawOverlay = this.drawOverlay.bind(this);
    }

    /** 分块大小：每块灌完后让出一次主线程 */
    static get NODE_CHUNK() { return 5000; }
    static get EDGE_CHUNK() { return 12000; }
    /** FA2 精化每块迭代数：每块结束 yield 一次并刷新进度（块内同步阻塞，块间让出主线程） */
    static get FA2_CHUNK() { return 15; }
    /** 一跳邻域 overlay 最多画多少个邻居（避免 hub 节点画上万条线） */
    static get OVERLAY_NEIGHBOR_LIMIT() { return 600; }
    /** 边默认色（未标注关系类型时使用） */
    static get EDGE_COLOR() { return '#8496b3'; }
    /** 按关系类型着色：不同关系的边交织成可辨识的彩色线网，而不是一层灰雾 */
    static get EDGE_PALETTE() {
        return ['#7b8fb5', '#a07bb0', '#6d9d91', '#b08761',
                '#b0718b', '#6d92ae', '#97935f', '#8b8ba8'];
    }
    static get MAX_EDGE_TYPES() { return 16; }
    /** Sigma 的 line 程序在屏幕上最少 1.7px，size 只影响放大后的观感 */
    static get EDGE_SIZE() { return 0.35; }
    /**
     * 边显示档位：全部边始终在 GPU 缓冲里，按档位点亮不同比例。
     * 21 万条边同时铺满一屏时线与线之间没有空隙，只会是一整块底色，
     * 因此默认抽样点亮一部分，用户可一键切到「全量」看真实规模。
     */
    static get EDGE_LEVELS() {
        return [
            { label: '边: 精简', percent: 12, filter: '' },
            { label: '边: 均衡', percent: 35, filter: 'brightness(0.94)' },
            { label: '边: 全量', percent: 100, filter: 'brightness(1.06)' }
        ];
    }
    static get EDGE_LEVEL() { return 0; }
    /**
     * 缩放联动语义缩放（LOD）档位：ratio 越大 = 拉得越远（点越挤），点亮比例越低；
     * ratio 越小 = 放得越大，点亮越多、标签阈值越低（标签越多）。
     * minRatio 是进入该档的下限（ratio ≥ minRatio 命中，从大到小依次判定）。
     * 相机停止变化 260ms 后才跨档重算一次，拖动/缩放过程中绝不 refresh。
     */
    static get LOD_LEVELS() {
        return [
            { minRatio: 2,        percent: 8,   labelThreshold: 7,   label: '远景' },
            { minRatio: 1,        percent: 18,  labelThreshold: 5.5, label: '中景' },
            { minRatio: 0.35,     percent: 40,  labelThreshold: 3.5, label: '近景' },
            { minRatio: 0.12,     percent: 75,  labelThreshold: 1.5, label: '细看' },
            { minRatio: -1,       percent: 100, labelThreshold: 0,   label: '细看' }
        ];
    }
    /** 相机更新后到应用 LOD 的静默期（用户停止缩放/拖动多久后才重算） */
    static get LOD_SETTLE_MS() { return 260; }

    /**
     * 节点 LOD：各档位（远景→细看）保留的「度数排名前 K%」节点。
     * 5 万节点全画出来（视口约 1200×700）平均点距只有 ~4px，糊成一团实心球——
     * 主流大图工具（Neo4j Bloom / Linkurious / Graphistry / GraphMaps）从不一次
     * 呈现全部实体：远景只画高度数骨架，滚轮放大逐档浮现更多节点与边。
     * 关联边在 edgeReducer 里随端点隐藏一并消失，远景自然只剩稀疏骨架。
     */
    static get NODE_LOD_KEEP() { return [0.05, 0.12, 0.3, 0.6, 1]; }

    /**
     * 能力检测：WebGL 可用，并且支持 32 位索引。
     * 20 万条边在 Sigma 的矩形边程序下约 120 万顶点，超过 Uint16 索引上限，
     * 必须是 WebGL2 或带 OES_element_index_uint 扩展的 WebGL1。
     */
    /**
     * 语义缩放的共用刻度：节点的屏幕直径（CSS px）。
     * - 概览 Sigma：节点 shader 里 u_ratio = 1/√camera.ratio、u_scale = pixelRatio，
     *   gl_PointSize = size * 2 * u_ratio * u_scale ⇒ CSS 直径 D = 2*size/√ratio。
     * - 子图 G6：圆形节点随画布矩阵线性缩放 ⇒ D = defaultNode.size * zoom（见宿主 NODE_BASE_PX）。
     * 两图各自换算成同一个 px 量再比较，切换判据与两套 zoom/ratio 数值彻底解耦。
     */
    /** 概览节点半径 size：布局写图与宿主「构建前估算」共用同一公式，保证阈值不失真 */
    static nodeSizeOf(deg, nodeCount) {
        const sizeScale = Math.min(1, Math.sqrt(3500 / Math.max(1, nodeCount)));
        return Math.max(0.9, Math.min(14, (3.4 + 2.4 * Math.log10(1 + deg)) * sizeScale));
    }
    static get MIN_CAMERA_RATIO() { return 0.0005; }  // 与 renderer 设置一致
    static get MAX_CAMERA_RATIO() { return 4; }
    /** 缩放停更后多久才做切换判定 */
    static get DRILL_SETTLE_MS() { return 600; }

    static isSupported() {
        if (KnowledgeGraphOverview._supported !== undefined) return KnowledgeGraphOverview._supported;
        if (!window.Sigma || !window.graphology) return (KnowledgeGraphOverview._supported = false);
        try {
            const probe = document.createElement('canvas');
            const gl = probe.getContext('webgl2') || probe.getContext('webgl');
            if (!gl) return (KnowledgeGraphOverview._supported = false);
            const webgl2 = typeof WebGL2RenderingContext !== 'undefined'
                && gl instanceof WebGL2RenderingContext;
            const ok = webgl2 || !!gl.getExtension('OES_element_index_uint');
            const lose = gl.getExtension('WEBGL_lose_context');
            if (lose) lose.loseContext();
            return (KnowledgeGraphOverview._supported = ok);
        } catch (e) {
            return (KnowledgeGraphOverview._supported = false);
        }
    }

    static unsupportedReason() {
        if (!window.Sigma || !window.graphology) return 'Sigma.js / graphology 组件未加载';
        return '当前浏览器不支持 WebGL2（或 32 位索引扩展），无法渲染 20 万级关系边';
    }

    /**
     * 让出主线程给加载遮罩一次绘制机会。
     * 后台标签页 / 无头浏览器里 rAF 可能完全不触发，必须加 setTimeout 兜底，
     * 否则整个构建 Promise 会永久挂起。
     */
    yieldFrame() {
        return new Promise(resolve => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(finish);
            setTimeout(finish, 24);
        });
    }

    report(onProgress, text) {
        if (typeof onProgress === 'function') onProgress(text);
    }

    /**
     * 聚光灯：仅高亮指定节点及其一跳邻域（下钻预览/返回回看）。传空清除。
     */
    setSpotlight(id) {
        if (!id || !this.graph || !this.graph.hasNode(id)) {
            this.clearSpotlight();
            return;
        }
        const neigh = new Set([id]);
        this.graph.forEachNeighbor(id, (nb) => neigh.add(nb));
        this._spotlight = neigh;
        this.renderer.refresh();
    }

    clearSpotlight() {
        if (!this._spotlight) return;
        this._spotlight = null;
        if (this.renderer) this.renderer.refresh();
    }

    /**
     * 相机飞入指定节点（250ms 平移）。只平移、不改 ratio：
     * 切换前后节点尺寸必须连续，若这里顺带把 ratio 压到 0.12，节点会突然胀大 3 倍。
     * getNodeDisplayData 返回归一化 [0,1] 坐标，与相机 x/y 同坐标系；
     * graph 原始坐标是布局半径上千的数，直接拿来设置相机会飞到图外。
     */
    flyToNode(id) {
        if (!this.renderer || !this.graph || !this.graph.hasNode(id)) return;
        const d = this.renderer.getNodeDisplayData(String(id));
        if (!d) return;
        this.renderer.getCamera().animate({ x: d.x, y: d.y }, { duration: 250 });
    }

    /** 当前（或指定 ratio）视图下代表节点的屏幕直径，CSS px */
    nodeSizePx(ratio) {
        let r = Number(ratio);
        if (!(r > 0)) {
            r = this.renderer ? this.renderer.getCamera().getState().ratio : 1;
        }
        r = Math.max(KnowledgeGraphOverview.MIN_CAMERA_RATIO,
            Math.min(KnowledgeGraphOverview.MAX_CAMERA_RATIO, r));
        return 2 * this._nodeSizeRef / Math.sqrt(r);
    }

    /** 全图默认视图（ratio=1）下的节点直径 */
    defaultNodeSizePx() { return this.nodeSizePx(1); }

    /**
     * 切换瞬间保持「尺寸连续」：由 D = 2*size/√r 反解 r = (2*size/D)²，
     * 把目标图相机设成节点直径恰好等于切换前直径的视图，并居中整张图。
     * 这样切过去的一帧里点不放大也不缩小，视觉上只是同一张图换了渲染器。
     */
    setCameraForNodeSize(px) {
        if (!this.renderer) return;
        const target = Math.max(0.5, Number(px) || this.defaultNodeSizePx());
        const ratio = Math.max(KnowledgeGraphOverview.MIN_CAMERA_RATIO,
            Math.min(KnowledgeGraphOverview.MAX_CAMERA_RATIO,
                Math.pow(2 * this._nodeSizeRef / target, 2)));
        const cam = this.renderer.getCamera();
        cam.setState({ x: 0.5, y: 0.5, ratio });
        this._camRatio = cam.getState().ratio;
        // 程序化相机变化不允许触发下钻；重新武装但不置用户手势位
        this._userZoomIn = false;
        clearTimeout(this._drillTimer);
        this._drillArmed = true;
        this._applyLod(false);
        this.renderer.render();
    }

    /** 渲染概览所需的节点度数（供聚光灯外的常规显示） */
    nodeDegree(id) {
        const m = this.nodeIndex.get(id);
        return m ? m.degree : 0;
    }

    /**
     * 一次性构建并渲染全图。
     * @param {Array} nodes 全量节点 [{id, label, labelType, properties}]
     * @param {Array} edges 全量边   [{source, target, label, properties}]
     * @param {Function} onProgress 进度文案回调
     * @returns {Promise<{nodes:number, edges:number, skippedEdges:number, elapsedMs:number}>}
     */
    /**
     * ForceAtlas2 分块精化：图已在 graphology 实例中，assign 直接改写节点 x/y。
     * 迭代数按节点规模自适应；先归一到单位圆盘（FA2 的 speed 模型虽尺度自适应，
     * 归一后常数更稳定），结束后再缩放回外半径 ≈ R 的 spacing 尺度，
     * 节点大小/点距体系与 LOD 阈值保持不变。库未加载或已 destroy 时静默跳过。
     */
    async _refineWithForceAtlas2(graph, nodeCount, R, onProgress) {
        const FA2 = window.ForceAtlas2;
        if (!FA2 || typeof FA2.assign !== 'function') return;
        // 迭代数按规模自适应（Node 实测 20k:100 轮 ≈7s、50k:60 轮 ≈13s）：
        // 60 轮在 5 万节点下占用率已从实心球 ~0.78 降到 ~0.60（簇间空隙可见）
        const ITER = nodeCount > 30000 ? 60 : nodeCount > 8000 ? 100 : 250;
        const CHUNK = KnowledgeGraphOverview.FA2_CHUNK;
        const settings = {
            barnesHutOptimize: nodeCount > 1500,   // 大图用 Barnes-Hut：斥力 O(N²) → O(N log N)
            barnesHutTheta: 1.2,   // 网格搜索：与 0.9 效果相同但快 ~30%
            gravity: 5,            // 向心引力：防外围节点飞散（过低会爆炸性扩散）
            scalingRatio: 2,       // 斥力强度：配合 gravity=5 占用率最优
            slowDown: 4,           // 阻尼：抑制振荡，收敛更平稳
            edgeWeightInfluence: 0,
            strongGravityMode: false,
            adjustSizes: false,
            linLogMode: false,
            outboundAttractionDistribution: false
        };
        const scaleCoords = (s) => {
            graph.forEachNode((n, a) => {
                graph.setNodeAttribute(n, 'x', a.x * s);
                graph.setNodeAttribute(n, 'y', a.y * s);
            });
        };
        const measureMaxR = () => {
            let m = 0;
            graph.forEachNode((n, a) => {
                const r = Math.sqrt(a.x * a.x + a.y * a.y);
                if (r > m) m = r;
            });
            return m;
        };
        this._fa2Debug = { ran: true, iters: ITER };
        let maxR = measureMaxR();
        this._fa2Debug.before = maxR;
        scaleCoords(1 / maxR);                 // 归一到单位圆盘
        for (let done = 0; done < ITER; done += CHUNK) {
            if (this._destroyed) {
                this._fa2Debug.cancelled = done;
                return;
            }
            FA2.assign(graph, { iterations: Math.min(CHUNK, ITER - done), settings });
            this.report(onProgress,
                `正在力导向散开（${Math.min(done + CHUNK, ITER)}/${ITER} 轮）...`);
            await this.yieldFrame();
        }
        maxR = measureMaxR();
        this._fa2Debug.after = maxR;
        scaleCoords(R / maxR);                 // 缩放回外半径 ≈ R
        this._fa2Debug.final = measureMaxR();
    }

    async render(nodes, edges, onProgress) {
        const started = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.destroy();
        // destroy() 在这里只作状态重置：随后整个 render 在飞，取消标志必须复位
        this._destroyed = false;

        const G = window.graphology;
        const graph = new G.MultiDirectedGraph(); // 允许同一对节点之间存在多种关系，不丢边
        this.graph = graph;

        const nodeCount = nodes.length;
        const edgeCount = edges.length;
        const degree = new Map();

        // ① 度数统计（O(E)），用于节点大小、层级排序、属性面板
        for (let i = 0; i < edgeCount; i++) {
            const e = edges[i];
            const s = String(e.source), t = String(e.target);
            degree.set(s, (degree.get(s) || 0) + 1);
            degree.set(t, (degree.get(t) || 0) + 1);
        }

        // ② 邻接表（O(E)）：供「邻域平均」松弛使用。悬空边/自环跳过。
        const indexById = new Map();
        for (let i = 0; i < nodeCount; i++) indexById.set(String(nodes[i].id), i);
        const adj = new Array(nodeCount);
        for (let i = 0; i < edgeCount; i++) {
            const si = indexById.get(String(edges[i].source));
            const ti = indexById.get(String(edges[i].target));
            if (si === undefined || ti === undefined || si === ti) continue;
            (adj[si] || (adj[si] = [])).push(ti);
            (adj[ti] || (adj[ti] = [])).push(si);
        }

        this.report(onProgress, `正在计算 ${nodeCount.toLocaleString('zh-CN')} 个节点的布局...`);
        await this.yieldFrame();

        // ③ O(N+E) 伪力导布局：随机播种 → 邻域平均松弛 → 半径分位数归一。
        //    此前「BFS 序列 + 螺旋铺盘」的问题：BFS 层与节点类别强相关，同类别节点
        //    占据同一段序列 ⇒ 铺成圆盘后表现为同色同心圆环。改为三步：
        //    a. 随机播种（节点 ID 哈希 → 均匀圆盘分布，确定性可复现）——颜色天然随机混布；
        //    b. 邻域平均松弛（相连节点相互靠拢）——边短、成簇、hub 聚中心，观感接近力导；
        //    c. 半径分位数归一（按半径排名映射到 R·√q）——圆盘密度均匀、外轮廓圆形。
        const spacing = 12;                                  // 目标平均点距（坐标单位）
        const R = spacing * Math.sqrt(nodeCount / Math.PI);  // 圆盘半径：N·d² 面积
        const colorOf = this.hooks.colorOf || (() => '#5B8FF9');
        // Sigma 的 node.size 是「相机 ratio=1 时的像素半径」（最终直径 = 2*size/√ratio）。
        // 5 万节点铺在 1200×700 视口里，平均点距只有约 4px，大节点会连成色块；
        // 因此按节点总数自动收缩半径，hub 仍比普通点大，但不再糊成一片。
        // 公式抽到 nodeSizeOf：宿主在概览构建之前也能算出「切换后图的节点大小」。
        const largeGraph = nodeCount > 10000;
        const sizeSamples = [];   // 抽样统计代表节点尺寸，作为语义缩放的尺寸基准

        // FNV-1a 哈希 → [0,1)：同一条数据每次布局结果完全一致
        const hash01 = (s, salt) => {
            let h = (2166136261 ^ salt) >>> 0;
            for (let k = 0; k < s.length; k++) {
                h ^= s.charCodeAt(k);
                h = Math.imul(h, 16777619) >>> 0;
            }
            return h / 4294967296;
        };
        let px = new Float64Array(nodeCount);
        let py = new Float64Array(nodeCount);
        for (let i = 0; i < nodeCount; i++) {
            const idStr = String(nodes[i].id);
            const rr = R * Math.sqrt(hash01(idStr, 1));            // √ 均匀 → 圆盘面积均匀
            const th = 2 * Math.PI * hash01(idStr, 0x9E3779B1);
            px[i] = rr * Math.cos(th);
            py[i] = rr * Math.sin(th);
        }

        // b. 邻域平均松弛：pos ← ½·自身 + ½·邻居均值，三轮 Jacobi。
        //    纯随机摆放会让所有边变成横穿全盘的长线；松弛让相连节点相互靠拢，
        //    树状/稀疏部分围绕其 hub 聚成簇，高度数 hub 因平均大量邻居而趋近中心。
        this.report(onProgress, '正在松弛布局（相连节点相互靠拢）...');
        await this.yieldFrame();
        const RELAX_ITERS = 3;
        for (let iter = 0; iter < RELAX_ITERS; iter++) {
            const nx = new Float64Array(nodeCount);
            const ny = new Float64Array(nodeCount);
            for (let i = 0; i < nodeCount; i++) {
                const nb = adj[i];
                if (!nb || !nb.length) { nx[i] = px[i]; ny[i] = py[i]; continue; }
                let sx = 0, sy = 0;
                for (let j = 0; j < nb.length; j++) { sx += px[nb[j]]; sy += py[nb[j]]; }
                nx[i] = 0.5 * px[i] + 0.5 * sx / nb.length;
                ny[i] = 0.5 * py[i] + 0.5 * sy / nb.length;
            }
            px = nx; py = ny;
            if ((iter + 1) % 2 === 0) {
                this.report(onProgress, `正在松弛布局（第 ${iter + 1}/${RELAX_ITERS} 轮）...`);
                await this.yieldFrame();
            }
        }

        // c. 半径分位数归一：松弛会使密集子图收缩到中心、稀疏部分留在外围。
        //    按松弛后的半径「排名」映射到均匀圆盘目标半径 R·√q（保持径向次序与角度，
        //    邻近节点映射后仍邻近），既还原均匀密度，又保证外轮廓是完整圆形。
        this.report(onProgress, '正在归一化圆盘密度...');
        await this.yieldFrame();
        const byRadius = Array.from({ length: nodeCount }, (_, i) => i)
            .sort((a, b) => (px[a] * px[a] + py[a] * py[a]) - (px[b] * px[b] + py[b] * py[b]));
        for (let k = 0; k < nodeCount; k++) {
            const i = byRadius[k];
            const target = R * Math.sqrt((k + 0.5) / nodeCount);
            const cur = Math.sqrt(px[i] * px[i] + py[i] * py[i]);
            const s = cur > 1e-9 ? target / cur : 0;
            px[i] *= s; py[i] *= s;
        }

        for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];
            const id = String(n.id);
            // 确定性微扰（±0.55d）：避免分位数归一后坐标重合/网格化
            const j1 = (((Math.imul(i + 1, 2654435761) >>> 0) % 1000) / 1000 - 0.5) * spacing * 1.1;
            const j2 = (((Math.imul(i + 7, 2246822519) >>> 0) % 1000) / 1000 - 0.5) * spacing * 1.1;
            const gx = px[i] + j1;
            const gy = py[i] + j2;
            const deg = degree.get(id) || 0;
            const rawLabel = String(n.label == null ? id : n.label);
            const labelType = String(n.labelType || '未分类');
            this.nodeTypeCounts.set(labelType, (this.nodeTypeCounts.get(labelType) || 0) + 1);

            const nodeSize = KnowledgeGraphOverview.nodeSizeOf(deg, nodeCount);
            if (sizeSamples.length < 4096 && (i % 8 === 0)) sizeSamples.push(nodeSize);
            if (!graph.hasNode(id)) {
                graph.addNode(id, {
                    x: gx,
                    y: gy,
                    size: nodeSize,
                    color: colorOf(labelType),
                    label: rawLabel.length > 16 ? rawLabel.slice(0, 15) + '…' : rawLabel,
                    zIndex: Math.min(100, deg)
                });
            }
            this.nodeIndex.set(id, {
                rawLabel,
                labelType,
                properties: n.properties || {},
                degree: deg
            });

            if ((i + 1) % KnowledgeGraphOverview.NODE_CHUNK === 0) {
                this.report(onProgress,
                    `正在灌入节点 ${(i + 1).toLocaleString('zh-CN')}/${nodeCount.toLocaleString('zh-CN')} ...`);
                await this.yieldFrame();
            }
        }

        // 代表节点尺寸取抽样中位数：hub 只有少数，用中位节点才符合用户眼里「一个点多大」
        sizeSamples.sort((a, b) => a - b);
        this._nodeSizeRef = sizeSamples.length
            ? sizeSamples[Math.floor(sizeSamples.length / 2)] : 2;

        // 节点 LOD 阈值：各档位「度数排名前 K%」的分界线（O(N log N)，一次预计算）
        const degsDesc = Array.from({ length: nodeCount }, (_, i) =>
            degree.get(String(nodes[i].id)) || 0).sort((a, b) => b - a);
        this._degreeThresholds = KnowledgeGraphOverview.NODE_LOD_KEEP.map(keep =>
            degsDesc[Math.max(0, Math.min(nodeCount - 1, Math.floor(nodeCount * keep) - 1))]);

        this.report(onProgress, `正在灌入 ${edgeCount.toLocaleString('zh-CN')} 条关系...`);
        await this.yieldFrame();

        // ④ 边：按关系类型共用少量属性对象（Sigma 内部 Object.assign 浅拷贝后使用，不会写回）。
        //    不同关系用不同颜色，21 万条边才不会糊成一层与背景同色的灰雾。
        //    悬空边（端点缺失）跳过并计数，保证 WebGL 缓冲里没有非法引用。
        const palette = KnowledgeGraphOverview.EDGE_PALETTE;
        const maxTypes = KnowledgeGraphOverview.MAX_EDGE_TYPES;
        const edgeAttrCache = new Map();   // 关系类型 -> 共享属性对象
        const typeColors = new Map();      // 关系类型 -> 颜色（供图例使用）
        const edgeTypeByIndex = new Array(edgeCount);  // 边序号 -> 关系类型
        const typeCounts = new Map();      // 关系类型 -> 边数（供图例计数）
        let skippedEdges = 0;
        for (let i = 0; i < edgeCount; i++) {
            const e = edges[i];
            const s = String(e.source), t = String(e.target);
            if (graph.hasNode(s) && graph.hasNode(t)) {
                const relType = String(e.label || e.type || e.labelType || '');
                edgeTypeByIndex[i] = relType;
                typeCounts.set(relType, (typeCounts.get(relType) || 0) + 1);
                let attrs = edgeAttrCache.get(relType);
                if (!attrs) {
                    const color = typeColors.size < maxTypes
                        ? palette[typeColors.size % palette.length]
                        : KnowledgeGraphOverview.EDGE_COLOR;
                    typeColors.set(relType, color);
                    attrs = {
                        type: 'line',
                        size: KnowledgeGraphOverview.EDGE_SIZE,
                        color
                    };
                    edgeAttrCache.set(relType, attrs);
                }
                graph.addDirectedEdgeWithKey('e' + i, s, t, attrs);
            } else {
                skippedEdges++;
            }
            if ((i + 1) % KnowledgeGraphOverview.EDGE_CHUNK === 0) {
                this.report(onProgress,
                    `正在灌入关系 ${(i + 1).toLocaleString('zh-CN')}/${edgeCount.toLocaleString('zh-CN')} ...`);
                await this.yieldFrame();
            }
        }

        // ⑤ ForceAtlas2 力导向精化：圆盘初始布局只有均匀密度，看不出社区结构；
        //    FA2 用 Barnes-Hut 近似把相连簇拉开、簇间留出空隙（主流大图的力导向观感）。
        //    分块执行保证进度条持续刷新、界面不假死；库缺失时静默跳过。
        await this._refineWithForceAtlas2(graph, nodeCount, R, onProgress);

        this.report(onProgress, '正在一次性上传 WebGL 缓冲...');
        await this.yieldFrame();

        // ⑤ 单次构造 = 单次 GPU 上传。此后所有平移/缩放只动相机矩阵
        this.renderer = new window.Sigma(graph, this.container, {
            allowInvalidContainer: true,
            renderEdgeLabels: false,
            renderLabels: true,
            hideLabelsOnMove: true,
            hideEdgesOnMove: false,
            enableEdgeClickEvents: false,
            enableEdgeHoverEvents: false,
            enableEdgeWheelEvents: false,
            defaultNodeColor: '#5B8FF9',
            defaultEdgeColor: KnowledgeGraphOverview.EDGE_COLOR,
            // 图例类别过滤：被隐藏的类别节点标 hidden，其关联边在 edgeReducer 里一并隐藏
            nodeReducer: (node, data) => this._reduceNode(node, data),
            // 边密度分档/图例过滤：全部边都进缓冲，reducer 只决定这一帧点亮哪些
            edgeReducer: (edge, data) => this._reduceEdge(edge, data),
            labelFont: 'Arial',
            labelSize: 10,
            labelWeight: 'normal',
            labelColor: { color: '#4b5563' },
            labelRenderedSizeThreshold: largeGraph ? 5 : 8,
            labelDensity: 1,
            labelGridCellSize: 120,
            stagePadding: 30,
            zIndex: true,
            minCameraRatio: 0.0005,
            maxCameraRatio: 4
        });

        this.edgeTypeColors = typeColors;
        this._edgeTypeByIndex = edgeTypeByIndex;
        this._edgeTypeCounts = typeCounts;
        this._edgeCount = graph.size;
        // 初始相机 ratio=1 → 中景档；_applyLod 会在 bindEvents 后按真实 ratio 校准
        this._lodLevel = 1;
        this._lastAppliedLod = 1;
        this.createOverlay();
        this.bindEvents();
        this._applyEdgeFilter();
        this._applyLod(true);
        // 记住数据源引用：「返回子图 → 再次全图概览」可直接复用已上传的 GPU 缓冲
        this._sourceNodes = nodes;
        this._sourceEdges = edges;

        const elapsedMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
        console.info(`[全图概览] Sigma/WebGL 就绪：${graph.order} 节点 / ${graph.size} 边` +
            (skippedEdges ? `（跳过悬空边 ${skippedEdges}）` : '') + `，耗时 ${elapsedMs}ms`);

        return { nodes: graph.order, edges: graph.size, skippedEdges, elapsedMs };
    }

    /** 附加一张 2D 画布：只画选中节点的一跳邻域，与 WebGL 主图完全解耦 */
    createOverlay() {
        const canvas = document.createElement('canvas');
        canvas.className = 'kg-overview-overlay';
        canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:2;';
        this.container.appendChild(canvas);
        this.overlay = canvas;
        this.overlayCtx = canvas.getContext('2d');
    }

    bindEvents() {
        const renderer = this.renderer;
        const toModel = (key) => this.nodeModel(key);

        // 只认「用户主动放大」手势：Sigma 的滚轮监听挂在内层 canvas 上并 stopPropagation，
        // 外层容器收不到 wheel，必须订阅 mouseCaptor。delta > 0 = 放大（getWheelDelta 取反 deltaY）。
        // 程序化相机动画（切图、飞入、居中）不会置位，因此不会误触发自动切换。
        const wheelCaptor = renderer.getMouseCaptor();
        this._wheelHandler = (e) => { if (e && e.delta > 0) this._userZoomIn = true; };
        wheelCaptor.on('wheel', this._wheelHandler);

        renderer.on('enterNode', ({ node, event }) => {
            this.hoveredKey = node;
            if (this.hooks.onHoverNode) {
                this.hooks.onHoverNode(toModel(node), event.x, event.y);
            }
        });
        renderer.on('leaveNode', () => {
            this.hoveredKey = null;
            if (this.hooks.onLeaveNode) this.hooks.onLeaveNode();
        });
        renderer.on('clickNode', ({ node }) => {
            // 单击 = 钻取：返回子图 → 搜索框回填节点标签 → 触发搜索定位 → 自动展开一跳邻接。
            // 概览充当全图 minimap / 规模导航，单击即下钻，无需双击。
            if (this.hooks.onOpenInSubgraph) this.hooks.onOpenInSubgraph(this.nodeModel(node));
        });
        renderer.on('clickStage', () => this.clearSelection());
        renderer.on('afterRender', this._drawOverlay);

        // 缩放联动语义缩放（LOD）：相机停止变化后跨档才重算，拖动过程中绝不 refresh
        renderer.getCamera().on('updated', () => this._onCameraUpdated());

        // Shadow DOM 下 e.target 被重定向到宿主，Sigma 自带的 document 级 hover 判定失效，
        // 这里在容器上补发带本地坐标的 mousemove，让 captor 正常做四叉树命中
        const captor = renderer.getMouseCaptor();
        this._hoverHandler = (e) => {
            if (!this.renderer) return;
            const rect = this.container.getBoundingClientRect();
            const coords = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                sigmaDefaultPrevented: false,
                preventSigmaDefault: function () { this.sigmaDefaultPrevented = true; },
                original: e
            };
            captor.emit('mousemove', coords);
            if (this.hoveredKey && this.hooks.onHoverMove) {
                this.hooks.onHoverMove(toModel(this.hoveredKey), coords.x, coords.y);
            }
        };
        this._leaveHandler = () => {
            this.hoveredKey = null;
            if (this.hooks.onLeaveNode) this.hooks.onLeaveNode();
        };
        this.container.addEventListener('mousemove', this._hoverHandler);
        this.container.addEventListener('mouseleave', this._leaveHandler);

        // Sigma 原生 window.resize 会置 needToSoftProcess，触发 O(N+E) 重算；
        // 20 万边时拖动窗口会连续卡住。改成「立即 GPU 重绘 + 静止后防抖一次软重算」，
        // 软重算只用于刷新四叉树/标签网格的像素尺寸。
        const originalResize = renderer.activeListeners && renderer.activeListeners.handleResize;
        if (originalResize) window.removeEventListener('resize', originalResize);
        if (renderer.activeListeners) {
            renderer.activeListeners.handleResize = () => {
                if (!this.renderer) return;
                try { this.renderer.render(); } catch (e) { /* 尺寸切换瞬间的竞态，忽略 */ }
                clearTimeout(this._resizeTimer);
                this._resizeTimer = setTimeout(() => {
                    if (this.renderer) this.renderer.refresh();
                }, 250);
            };
            window.addEventListener('resize', renderer.activeListeners.handleResize);
        }
    }

    nodeModel(key) {
        const meta = this.nodeIndex.get(key) || {};
        const props = Object.assign({}, meta.properties || {});
        props['类别'] = meta.labelType || '未分类';
        props['度数'] = meta.degree || 0;
        return { id: key, rawLabel: meta.rawLabel || key, properties: props };
    }

    /** 选中节点：只做相机动画 + overlay 重绘，绝不触发全量 refresh() */
    selectNode(key, opts) {
        if (!this.renderer || !this.graph || !this.graph.hasNode(key)) return;
        const neighbours = this.graph.neighbors(key);
        this.selectedNode = key;
        this.neighborCount = neighbours.length;
        this.selectedNeighbors = neighbours.slice(0, KnowledgeGraphOverview.OVERLAY_NEIGHBOR_LIMIT);

        const data = this.renderer.getNodeDisplayData(key);
        if (data) {
            const camera = this.renderer.getCamera();
        const order = this.graph.order;
        const targetRatio = order > 20000 ? 0.12 : (order > 3000 ? 0.25 : 0.5);
        camera.animate({ x: data.x, y: data.y, ratio: targetRatio }, { duration: 350 });
        }
        const model = this.nodeModel(key);
        model.properties['一跳邻居'] = this.neighborCount;
        if (this.hooks.onSelectNode && !(opts && opts.silent)) this.hooks.onSelectNode(model);
        this.drawOverlay();
    }

    clearSelection() {
        if (!this.selectedNode) return;
        this.selectedNode = null;
        this.selectedNeighbors = [];
        this.neighborCount = 0;
        this.drawOverlay();
        if (this.hooks.onClearSelection) this.hooks.onClearSelection();
    }

    /** 每次 sigma 渲染后同步 overlay（相机动画期间也会触发，但最多画 600 个点） */
    drawOverlay() {
        if (!this.renderer || !this.overlayCtx) return;
        const dim = this.renderer.getDimensions();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, dim.width), h = Math.max(1, dim.height);
        const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
        if (this.overlay.width !== pw || this.overlay.height !== ph) {
            this.overlay.width = pw;
            this.overlay.height = ph;
            this.overlay.style.width = w + 'px';
            this.overlay.style.height = h + 'px';
        }
        const ctx = this.overlayCtx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (!this.selectedNode) return;

        const pos = (key) => {
            const d = this.renderer.getNodeDisplayData(key);
            if (!d) return null;
            const p = this.renderer.framedGraphToViewport(d);
            if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) return null;
            return p;
        };
        const center = pos(this.selectedNode);
        if (!center) return;

        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(76,137,255,0.42)';
        ctx.beginPath();
        for (let i = 0; i < this.selectedNeighbors.length; i++) {
            const p = pos(this.selectedNeighbors[i]);
            if (!p) continue;
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        ctx.fillStyle = '#1d6feb';
        for (let i = 0; i < this.selectedNeighbors.length; i++) {
            const p = pos(this.selectedNeighbors[i]);
            if (p) ctx.fillRect(p.x - 1.6, p.y - 1.6, 3.2, 3.2);
        }
        ctx.strokeStyle = '#1d6feb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, 9, 0, Math.PI * 2);
        ctx.stroke();
    }

    /** 搜索定位：全量节点里精确匹配优先，其次模糊匹配；命中后走相机动画 */
    focusSearch(keyword) {
        if (!this.renderer || !keyword) return false;
        const k = String(keyword).toLowerCase();
        let hit = null;
        for (const [id, meta] of this.nodeIndex) {
            if (id.toLowerCase() === k || String(meta.rawLabel).toLowerCase() === k) { hit = id; break; }
        }
        if (!hit) {
            for (const [id, meta] of this.nodeIndex) {
                if (id.toLowerCase().includes(k) || String(meta.rawLabel).toLowerCase().includes(k)) {
                    hit = id; break;
                }
            }
        }
        if (!hit) return false;
        this.selectNode(hit);
        return true;
    }

    zoomIn() {
        if (!this.renderer) return;
        this._userZoomIn = true;   // 工具栏主动放大同样算「用户放大意图」
        this.renderer.getCamera().animatedZoom({ duration: 180 });
    }

    zoomOut() {
        if (!this.renderer) return;
        this._userZoomIn = false;
        this.renderer.getCamera().animatedUnzoom({ duration: 180 });
    }

    fit() {
        if (!this.renderer) return;
        this.clearSelection();
        this._userZoomIn = false;
        this.renderer.getCamera().animatedReset({ duration: 300 });
    }

    /** 20 万条边的显隐：切 WebGL 画布 CSS，零重算 */
    toggleEdges() {
        if (!this.renderer) return this.edgesHidden;
        this.edgesHidden = !this.edgesHidden;
        const c = this.renderer.getCanvases().edges;
        if (c) c.style.visibility = this.edgesHidden ? 'hidden' : 'visible';
        return this.edgesHidden;
    }

    /**
     * 边显示模式：'auto'（默认）由相机 ratio 联动 LOD；'manual' 锁定精简/均衡/全量三档。
     * 切档只改 reducer 的点亮比例 + 画布 CSS 滤镜，然后做一次全量重算（用户主动操作，
     * 约几百毫秒）；平移/缩放本身仍只动相机矩阵。
     */
    cycleEdgeMode() {
        if (this.edgeMode === 'auto') {
            this.edgeMode = 'manual';
            this.edgeLevel = 0;
        } else if (this.edgeLevel < KnowledgeGraphOverview.EDGE_LEVELS.length - 1) {
            this.edgeLevel++;
        } else {
            // 全量 → 回到自适应：强制下一次跨档判定生效
            this.edgeMode = 'auto';
            this._lastAppliedLod = -1;
            this._applyEdgeFilter();
            this._applyLod(true);
            return this.edgeMode;
        }
        this._applyEdgeFilter();
        if (this.renderer) this.renderer.refresh();
        if (this.hooks.onEdgeModeChange) this.hooks.onEdgeModeChange();
        return this.edgeMode;
    }

    /** 当前生效的边点亮百分比（auto=LOD 档位，manual=手动档位） */
    currentEdgePercent() {
        if (this.edgeMode === 'manual') {
            return KnowledgeGraphOverview.EDGE_LEVELS[this.edgeLevel].percent;
        }
        return KnowledgeGraphOverview.LOD_LEVELS[Math.max(0, Math.min(
            KnowledgeGraphOverview.LOD_LEVELS.length - 1, this._lodLevel))].percent;
    }

    edgeLevelLabel() {
        if (this.edgeMode === 'auto') {
            const lod = KnowledgeGraphOverview.LOD_LEVELS[Math.max(0, Math.min(
                KnowledgeGraphOverview.LOD_LEVELS.length - 1, this._lodLevel))];
            return `边: 自适应 ${lod.percent}%`;
        }
        const cfg = KnowledgeGraphOverview.EDGE_LEVELS[this.edgeLevel];
        return cfg.percent === 100 ? cfg.label : `${cfg.label} ${cfg.percent}%`;
    }

    visibleEdgeCount() {
        return Math.round(this._edgeCount * this.currentEdgePercent() / 100);
    }

    _applyEdgeFilter() {
        if (!this.renderer) return;
        const c = this.renderer.getCanvases().edges;
        if (!c) return;
        c.style.filter = this.edgeMode === 'manual'
            ? KnowledgeGraphOverview.EDGE_LEVELS[this.edgeLevel].filter
            : '';
    }

    // ---------- 缩放联动语义缩放（LOD） ----------

    _onCameraUpdated() {
        if (!this.renderer) return;
        this._camRatio = this.renderer.getCamera().getState().ratio;
        clearTimeout(this._lodTimer);
        // 拖动/缩放过程中绝不 refresh；停止 260ms 后若跨档或线宽漂移则做一次重算
        this._lodTimer = setTimeout(() => this._applyLod(false), KnowledgeGraphOverview.LOD_SETTLE_MS);
        // 缩放停更后按「节点屏幕尺寸」判定是否该进子图（阈值由宿主统一给出）
        clearTimeout(this._drillTimer);
        this._drillTimer = setTimeout(() => this._maybeDrill(),
            KnowledgeGraphOverview.DRILL_SETTLE_MS);
    }

    /**
     * 尺寸判据下钻：节点放大到与子图默认视图相当（toSubgraph）时才回调宿主，
     * 并把切换瞬间的节点直径一起传过去，让子图把相机接到同一尺寸上。
     * 缩回 toOverview 以下重新武装；触发一次后解除武装，避免边界反复横跳。
     */
    _maybeDrill() {
        if (this._destroyed || !this.renderer) return;
        // 手动切换后的抑制窗口内不做自动判定，避免刚点完层级标签就被反向切回
        if (this.hooks.isSwitchLocked && this.hooks.isSwitchLocked()) return;
        const thresholds = this.hooks.switchThresholds && this.hooks.switchThresholds();
        if (!thresholds) return;
        const px = this.nodeSizePx();   // 读实时相机，不用动画期间的缓存值
        if (px <= thresholds.toOverview) {
            this._drillArmed = true;
            this._userZoomIn = false;
            return;
        }
        if (px < thresholds.toSubgraph || !this._drillArmed || !this._userZoomIn) return;
        this._drillArmed = false;
        this._userZoomIn = false;
        const id = this.getNodeNearCamera();
        if (id && this.hooks.onZoomDrill) this.hooks.onZoomDrill(id, px);
    }

    /**
     * 相机中心最近的节点id（O(N) 遍历；调用侧已节流）。
     * 必须用归一化后的显示坐标：graph 原始坐标与相机 x/y 不在同一量纲。
     */
    getNodeNearCamera() {
        if (!this.renderer || !this.graph) return null;
        const state = this.renderer.getCamera().getState();
        const cx = state.x, cy = state.y;
        let best = null, bestD = Infinity;
        this.graph.forEachNode((node) => {
            const d = this.renderer.getNodeDisplayData(node);
            if (!d) return;
            const dx = d.x - cx, dy = d.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD) { bestD = d2; best = node; }
        });
        return best;
    }

    /**
     * 相机回到「近景」档比例（返回子图前的衔接位）
     */
    zoomToNearLevel() {
        if (!this.renderer) return;
        this.renderer.getCamera().animate({ ratio: 0.35 }, { duration: 300 });
    }

    /**
     * 取消待触发的缩放下钻（按钮/动画驱动的相机变化时使用）
     */
    cancelDrill() {
        clearTimeout(this._drillTimer);
        this._drillArmed = false;
        this._userZoomIn = false;
    }

    /** 相机 ratio 相对上次边宽补偿的漂移是否超过 18%（超过则需要 refresh 重算补偿） */
    _sizeDrifted() {
        const cur = Math.sqrt(this._camRatio || 1);
        const last = Math.sqrt(this._lastSizeRatio || 1);
        return Math.abs(cur - last) / last > 0.18;
    }

    /**
     * 节点 LOD：档位 idx 只显示度数排名前 NODE_LOD_KEEP[idx] 的节点（hub 骨架）。
     * 仅在档位变化或 force 时重建隐藏集（O(N)），返回「是否发生了变化」。
     */
    _applyNodeLod(idx, force) {
        if (!this._degreeThresholds) return false;
        if (!force && idx === this._nodeLodLevel) return false;
        this._nodeLodLevel = idx;
        const threshold = this._degreeThresholds[idx];
        const hidden = new Set();
        if (threshold > 0) {
            this.nodeIndex.forEach((meta, id) => {
                if ((meta.degree || 0) < threshold) hidden.add(id);
            });
        }
        this._lodHiddenNodes = hidden;
        return true;
    }

    _applyLod(force) {
        if (!this.renderer || !this.graph) return;
        const levels = KnowledgeGraphOverview.LOD_LEVELS;
        const ratio = this.renderer.getCamera().getState().ratio;
        let idx = levels.length - 1;
        for (let i = 0; i < levels.length; i++) {
            if (ratio >= levels[i].minRatio) { idx = i; break; }
        }
        // 节点 LOD（远景只显示高度数骨架）在任何边模式下都随缩放生效
        const nodeLodChanged = this._applyNodeLod(idx, force === true);
        // 缩放后补偿边宽（恒定屏幕线宽）：线宽漂移超 18% 就重算一次
        const sizeDrifted = this._sizeDrifted();
        if (this.edgeMode !== 'auto') {
            if (!force) {
                if (nodeLodChanged || sizeDrifted) this.renderer.refresh();
                this._lastSizeRatio = this._camRatio || 1;
            }
            return;
        }
        this._lodLevel = idx;
        if (this.edgeMode !== 'auto') return;

        // 标签阈值随缩放联动：越放大显示越多标签。setSetting 内部会自行 refresh，
        // 因此只在阈值没变且跨档时才手动 refresh 一次，避免连续两次全量重算。
        let thresholdChanged = false;
        try {
            const want = levels[idx].labelThreshold;
            if (this.renderer.getSetting('labelRenderedSizeThreshold') !== want) {
                this.renderer.setSetting('labelRenderedSizeThreshold', want);
                thresholdChanged = true;
            }
        } catch (e) { /* 设置项不可用时忽略，只影响标签密度 */ }
        const crossed = this._lastAppliedLod !== idx;
        this._lastAppliedLod = idx;
        this._lastSizeRatio = this._camRatio || 1;
        if (!thresholdChanged && (crossed || sizeDrifted || nodeLodChanged)) {
            this.renderer.refresh();
        }
        if (crossed && this.hooks.onLodChange) {
            this.hooks.onLodChange(idx, levels[idx]);
        }
    }

    /** 图例过滤等用户操作触发的一次性全量重算（防抖合并连续点击） */
    scheduleRefresh() {
        if (!this.renderer) return;
        clearTimeout(this._refreshTimer);
        this._refreshTimer = setTimeout(() => {
            if (this.renderer) this.renderer.refresh();
        }, 120);
    }

    // ---------- 图例点击过滤（节点类别 / 关系类型） ----------

    toggleNodeType(labelType) {
        if (this._nodeTypeFilter.has(labelType)) this._nodeTypeFilter.delete(labelType);
        else this._nodeTypeFilter.add(labelType);
        this.scheduleRefresh();
        return this._nodeTypeFilter.has(labelType);
    }

    toggleEdgeRelType(relType) {
        if (this._edgeTypeFilter.has(relType)) this._edgeTypeFilter.delete(relType);
        else this._edgeTypeFilter.add(relType);
        this.scheduleRefresh();
        return this._edgeTypeFilter.has(relType);
    }

    isNodeTypeFiltered(labelType) { return this._nodeTypeFilter.has(labelType); }
    isEdgeTypeFiltered(relType) { return this._edgeTypeFilter.has(relType); }

    /** Sigma process() 时对每个节点调用：节点 LOD 隐藏低度数节点 + 被过滤的类别整类隐藏 */
    _reduceNode(node, data) {
        // 聚光灯（下钻预览/返回回看）：仅高亮选中节点及其一跳邻域，其余变暗缩小
        if (this._spotlight && this._spotlight.size && !this._spotlight.has(node)) {
            let dim = this._dimNodeCache.get(data.color);
            if (!dim) {
                dim = Object.assign({}, data, {
                    color: '#D3DAE6',
                    label: null,
                    size: Math.max(1, (data.size || 2) * 0.3)
                });
                this._dimNodeCache.set(data.color, dim);
            }
            return dim;
        }
        if (this._lodHiddenNodes && this._lodHiddenNodes.size && this._lodHiddenNodes.has(node)) {
            return this._hiddenNodeOf(data);
        }
        if (!this._nodeTypeFilter.size) return data;
        const meta = this.nodeIndex.get(node);
        if (meta && this._nodeTypeFilter.has(meta.labelType)) {
            return this._hiddenNodeOf(data);
        }
        return data;
    }

    _hiddenNodeOf(data) {
        let hidden = this._hiddenNodeCache.get(data.color);
        if (!hidden) {
            hidden = Object.assign({}, data, { hidden: true });
            this._hiddenNodeCache.set(data.color, hidden);
        }
        return hidden;
    }

    /**
     * Sigma process() 时对每条边调用，三层过滤依次生效：
     *   ① 关系类型被图例隐藏 → 隐藏；
     *   ② 任一端点的节点类别被图例隐藏 → 隐藏（隐藏类别时其关联边一起消失）；
     *   ③ 按 currentEdgePercent（LOD 或手动档）做稳定哈希抽样，同一档位点亮的总是同一批边。
     */
    _reduceEdge(edge, data) {
        // 聚光灯激活：两端点均在聚光灯内的边才显示
        if (this._spotlight && this._spotlight.size) {
            const ends = this.graph.extremities(edge);
            if (!this._spotlight.has(ends[0]) || !this._spotlight.has(ends[1])) {
                let dim = this._dimEdgeCache;
                if (!dim) {
                    dim = Object.assign({}, data, { color: '#E2E7EF', size: 0.4 });
                    this._dimEdgeCache = dim;
                }
                return dim;
            }
        }
        if (this._edgeTypeFilter.size) {
            const idx = Number(edge.slice(1)) || 0;
            if (this._edgeTypeFilter.has(this._edgeTypeByIndex[idx])) return this._hiddenEdgeOf(data);
        }
        if (this._nodeTypeFilter.size || (this._lodHiddenNodes && this._lodHiddenNodes.size)) {
            const ends = this.graph.extremities(edge);
            // 节点 LOD：任一端点是本档位被隐藏的低度数节点 → 边一并隐藏
            if (this._lodHiddenNodes && this._lodHiddenNodes.size &&
                (this._lodHiddenNodes.has(ends[0]) || this._lodHiddenNodes.has(ends[1]))) {
                return this._hiddenEdgeOf(data);
            }
            if (this._nodeTypeFilter.size) {
                const m0 = this.nodeIndex.get(ends[0]);
                const m1 = this.nodeIndex.get(ends[1]);
                if ((m0 && this._nodeTypeFilter.has(m0.labelType)) ||
                    (m1 && this._nodeTypeFilter.has(m1.labelType))) {
                    return this._hiddenEdgeOf(data);
                }
            }
        }
        const percent = this.currentEdgePercent();
        // 恒定屏幕线宽：Sigma 按「SQRT 规则」把边厚渲染为 size/√ratio（放大时变粗），
        // 这里预先乘 √ratio 抵消，使任何缩放级别下边线宽恒定为 EDGE_SIZE。
        // 相机停止变化后 _applyLod 会因线宽漂移触发一次 refresh，让补偿值跟上新 ratio。
        const camRatio = this._camRatio || 1;
        const zoomComp = Math.min(3, Math.max(0.02, Math.sqrt(camRatio)));
        const size = KnowledgeGraphOverview.EDGE_SIZE * zoomComp;
        if (size !== data.size) data = this._sizedEdgeOf(data, size);
        if (percent >= 100) return data;
        const n = Number(edge.slice(1)) || 0;
        if (((Math.imul(n, 2654435761) >>> 0) % 100) < percent) return data;
        return this._hiddenEdgeOf(data);
    }

    /** 按「颜色|线宽」复用带尺寸的边属性对象，避免 refresh 时产生海量临时对象 */
    _sizedEdgeOf(data, size) {
        const key = data.color + '|' + size;
        let sized = this._sizedEdgeCache.get(key);
        if (!sized) {
            sized = Object.assign({}, data, { size });
            this._sizedEdgeCache.set(key, sized);
        }
        return sized;
    }

    _hiddenEdgeOf(data) {
        let hidden = this._hiddenEdgeCache.get(data.color);
        if (!hidden) {
            hidden = Object.assign({}, data, { hidden: true });
            this._hiddenEdgeCache.set(data.color, hidden);
        }
        return hidden;
    }

    /** 关系类型 -> 颜色 + 边数，供 UI 图例使用 */
    getEdgeLegend() {
        return Array.from(this.edgeTypeColors.entries())
            .map(([type, color]) => ({
                type: type || '未分类关系',
                color,
                count: this._edgeTypeCounts.get(type) || 0
            }));
    }

    /** 节点类别 -> 数量，供 UI 图例计数（类别分布） */
    getNodeTypeStats() {
        return new Map(this.nodeTypeCounts);
    }

    /** 同一份数据再次进入概览时无需重建图与 GPU 缓冲 */
    canReuse(nodes, edges) {
        return !!(this.renderer && this._sourceNodes === nodes && this._sourceEdges === edges);
    }

    /** 尺寸变化时 Sigma 自己监听 window.resize；这里补一次轻量重绘（不重建缓冲） */
    resume() {
        if (!this.renderer) return;
        this.renderer.resize();
        this.renderer.render();
        this._applyEdgeFilter();
    }

    /** 释放 WebGL 上下文：避免反复进入/退出导致浏览器上下文数量耗尽 */
    destroy() {
        this._destroyed = true;
        clearTimeout(this._resizeTimer);
        clearTimeout(this._lodTimer);
        clearTimeout(this._refreshTimer);
        clearTimeout(this._drillTimer);
        this._resizeTimer = this._lodTimer = this._refreshTimer = this._drillTimer = null;
        this._lastClick = null;
        this._userZoomIn = false;
        if (this._wheelHandler && this.renderer) {
            try { this.renderer.getMouseCaptor().off('wheel', this._wheelHandler); } catch (e) { /* 已释放 */ }
            this._wheelHandler = null;
        }
        this._nodeTypeFilter.clear();
        this._edgeTypeFilter.clear();
        this._hiddenNodeCache.clear();
        this._edgeTypeByIndex = [];
        this._edgeTypeCounts.clear();
        this.nodeTypeCounts.clear();
        this._lodLevel = 1;
        this._lastAppliedLod = 1;
        if (this._hoverHandler) {
            this.container.removeEventListener('mousemove', this._hoverHandler);
            this._hoverHandler = null;
        }
        if (this._leaveHandler) {
            this.container.removeEventListener('mouseleave', this._leaveHandler);
            this._leaveHandler = null;
        }
        if (this.renderer) {
            try {
                const canvases = this.renderer.getCanvases();
                Object.keys(canvases).forEach(id => {
                    const c = canvases[id];
                    const gl = c.getContext('webgl2') || c.getContext('webgl');
                    if (gl) {
                        const lose = gl.getExtension('WEBGL_lose_context');
                        if (lose) lose.loseContext();
                    }
                });
                this.renderer.kill();
            } catch (e) {
                console.warn('释放全图概览渲染器异常:', e);
            }
        }
        this.renderer = null;
        this.graph = null;
        this._sourceNodes = null;
        this._sourceEdges = null;
        this.overlay = null;
        this.overlayCtx = null;
        this.nodeIndex.clear();
        this.edgeTypeColors.clear();
        this._hiddenEdgeCache.clear();
        this._sizedEdgeCache.clear();
        this._edgeCount = 0;
        this.selectedNode = null;
        this.selectedNeighbors = [];
        this.hoveredKey = null;
        this.edgesHidden = false;
        // kill() 会清空 container 子节点；这里兜底，确保 overlay 也被移除
        while (this.container && this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
    }
}

window.KnowledgeGraphOverview = KnowledgeGraphOverview;
