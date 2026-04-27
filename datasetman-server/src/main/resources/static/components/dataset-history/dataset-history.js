class DatasetHistory extends HTMLElement {
    constructor() {
        super();
        this.datasetInfo = null;
        this.historyData = [];
        this._sideLineageEnabled = true;
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.initEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                @import url('../../css/variables.css');
                @import url('../../css/base-components.css');
                
                :host {
                    display: none;
                    width: 100%;
                    height: 100%;
                }
                
                :host([show]) {
                    display: block;
                }
                
                .dataset-detail {
                    padding: var(--spacing-xl) var(--spacing-3xl) var(--spacing-3xl);
                    font-family: var(--font-family-primary);
                    color: var(--text-primary);
                }
                
                .dataset-info-card,
                .dataset-lineage-card {
                    background: var(--bg-primary);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-tertiary);
                    padding: var(--spacing-xl) var(--spacing-2xl) var(--spacing-lg);
                    box-shadow: var(--shadow-sm);
                    margin-bottom: var(--spacing-lg);
                }
                
                .info-header,
                .lineage-header {
                    font-size: var(--font-size-md);
                    color: var(--text-secondary);
                    margin-bottom: var(--spacing-lg);
                }
                
                /* 第一个card的上下两部分 */
                .basic-info-section {
                    margin-bottom: var(--spacing-xl);
                    padding-bottom: var(--spacing-xl);
                    border-bottom: 1px solid var(--border-tertiary);
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-lg);
                }
                
                .section-title-with-name {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                }
                
                .dataset-name {
                    font-size: 16px;
                    font-weight: 600;
                    color: #2b2f36;
                }
                
                .action-buttons {
                    display: flex;
                    gap: 8px;
                }
                
                .edit-button,
                .delete-button {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .edit-button {
                    background: #3b82f6;
                    color: white;
                }
                
                .edit-button:hover {
                    background: #2563eb;
                }
                
                .delete-button {
                    background: #ef4444;
                    color: white;
                }
                
                .delete-button:hover {
                    background: #dc2626;
                }
                
                .basic-info-list {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }
                
                .info-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .info-item.full-width {
                    grid-column: 1 / -1;
                }
                
                .info-label {
                    font-size: var(--font-size-sm);
                    color: var(--text-tertiary);
                }
                
                .info-value {
                    font-size: var(--font-size-sm);
                    color: var(--text-primary);
                    font-weight: 500;
                }
                
                .sql-block {
                    background: #f8f9fa;
                    padding: 12px;
                    border-radius: 4px;
                    font-family: 'Consolas', 'Monaco', monospace;
                    font-size: 13px;
                    white-space: pre-wrap;
                    word-break: break-all;
                    max-height: 200px;
                    overflow-y: auto;
                    border: 1px solid #e8e8e8;
                }
                
                /* 版本历史区域 */
                .version-history-section {
                    padding-top: var(--spacing-sm);
                }
                
                .section-title {
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                    margin-bottom: var(--spacing-md);
                }
                
                .horizontal-timeline {
                    height: 200px;
                    width: 100%;
                }
                
                .timeline-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    min-width: 100px;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 6px;
                    transition: background 0.2s;
                }
                
                .timeline-item:hover {
                    background: #f5f5f5;
                }
                
                .timeline-item.active {
                    background: #e6f7ff;
                }
                
                .timeline-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #3b82f6;
                    margin-bottom: 8px;
                    position: relative;
                }
                
                .timeline-dot::after {
                    content: '';
                    position: absolute;
                    width: 30px;
                    height: 2px;
                    background: #e8e8e8;
                    left: 14px;
                    top: 4px;
                }
                
                .timeline-item:last-child .timeline-dot::after {
                    display: none;
                }
                
                .timeline-content {
                    text-align: center;
                }
                
                .timeline-version {
                    font-size: 13px;
                    font-weight: 600;
                    color: #3b82f6;
                    margin-bottom: 2px;
                }
                
                .timeline-developer {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 2px;
                }
                
                .timeline-date {
                    font-size: 11px;
                    color: #999;
                }
                
                /* 血缘图谱区域 */
                .lineage-container {
                    height: 400px;
                    width: 100%;
                    padding: var(--spacing-md);
                }

                #lineageChart {
                    flex: 1;
                    width: 100%;
                    height: 800px;
                    background-color: #fff;
                    border: 1px solid #e0e0e0;
                }

                /* 视图控制栏 */
                .chart-controls {
                    padding: 10px 15px;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #e0e0e0;
                    display: flex;
                    gap: 15px;
                    align-items: center;
                }

                .control-btn {
                    padding: 6px 12px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background-color: #fff;
                    cursor: pointer;
                    font-size: 12px;
                }

                .control-btn:hover {
                    background-color: #e3f2fd;
                    border-color: #2196F3;
                    color: #2196F3;
                }

                .switch {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                }

                .switch-btn {
                    width: 40px;
                    height: 20px;
                    background-color: #e0e0e0;
                    border-radius: 10px;
                    position: relative;
                    cursor: pointer;
                }

                .switch-btn.on {
                    background-color: #2196F3;
                }

                .switch-dot {
                    width: 16px;
                    height: 16px;
                    background-color: #fff;
                    border-radius: 50%;
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    transition: left 0.2s;
                }

                .switch-btn.on .switch-dot {
                    left: 22px;
                }
                
                .graph-placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #999;
                    background: #f8f9fa;
                    border-radius: var(--radius-md);
                    border: 1px dashed #ddd;
                }
                
                /* 删除确认对话框 */
                .delete-confirm-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                
                .delete-confirm-dialog {
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    min-width: 400px;
                    max-width: 500px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                
                .dialog-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: #1f2937;
                }
                
                .dialog-content {
                    margin-bottom: 24px;
                    color: #595959;
                    line-height: 1.6;
                }
                
                .highlight {
                    color: #ff4d4f;
                    font-weight: 600;
                }
                
                .dialog-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                
                .btn-cancel, .btn-confirm-delete {
                    padding: 8px 16px;
                    border-radius: 4px;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s;
                }
                
                .btn-cancel {
                    background: #f0f0f0;
                    color: #595959;
                }
                
                .btn-cancel:hover {
                    background: #d9d9d9;
                }
                
                .btn-confirm-delete {
                    background: #ff4d4f;
                    color: white;
                }
                
                .btn-confirm-delete:hover {
                    background: #ff7875;
                }
                
                .btn-confirm-delete:disabled {
                    background: #ffccc7;
                    cursor: not-allowed;
                }
            </style>
            
            <div class="dataset-detail">
                <!-- 第一个card：数据集档案 -->
                <div class="dataset-info-card">
                    <div class="info-header">数据集档案</div>
                    
                    <!-- 上半部分：基本信息区域 -->
                    <div class="basic-info-section">
                        <div class="section-header">
                            <div class="section-title-with-name">
                                <span class="dataset-name" id="datasetName">-</span>
                            </div>
                            <div class="action-buttons">
                                <button class="edit-button" id="editBtn">编辑</button>
                                <button class="delete-button" id="deleteBtn">删除</button>
                            </div>
                        </div>
                        <div class="basic-info-list">
                            <div class="info-item">
                                <div class="info-label">版本号</div>
                                <div class="info-value" id="version">-</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">创建时间</div>
                                <div class="info-value" id="createTime">-</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">创建者</div>
                                <div class="info-value" id="developer">-</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">备注信息</div>
                                <div class="info-value" id="remark">-</div>
                            </div>
                            <div class="info-item full-width">
                                <div class="info-label">SQL定义</div>
                                <div class="info-value sql-block" id="datasetSql">-</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 第二个card：版本历史 -->
                <div class="dataset-lineage-card">
                    <div class="lineage-header">版本历史</div>
                    <div class="lineage-container">
                        <div id="lineageGraph" class="graph-placeholder">
                            版本历史加载中...
                        </div>
                    </div>
                </div>
                
                <!-- 第三个card：血缘图谱 -->
                <div class="dataset-lineage-card">
                    <div class="lineage-header">血缘图谱</div>
                    
                    <!-- 视图控制栏 -->
                    <div class="chart-controls">
                        <div class="switch">
                            <span>旁系血缘</span>
                            <div class="switch-btn on" id="sideLineageSwitch">
                                <div class="switch-dot"></div>
                            </div>
                        </div>
                        <button class="control-btn" id="focusProduct">聚焦数据集</button>
                        <button class="control-btn" id="zoomIn">放大 (+10%)</button>
                        <button class="control-btn" id="zoomOut">缩小 (-10%)</button>
                        <button class="control-btn" id="zoomReset">重置视图</button>
                    </div>
                    
                    <div id="lineageChart" class="graph-placeholder">
                        血缘图谱加载中...
                    </div>
                </div>
            </div>
        `;
    }

    initEventListeners() {
        // 编辑按钮
        const editBtn = this.shadowRoot.querySelector('#editBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('edit-dataset', {
                    bubbles: true,
                    composed: true,
                    detail: this.datasetInfo
                }));
            });
        }

        // 删除按钮
        const deleteBtn = this.shadowRoot.querySelector('#deleteBtn');
        console.log('删除按钮元素:', deleteBtn);
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                console.log('删除按钮被点击');
                this.showDeleteConfirmDialog();
            });
        } else {
            console.error('未找到删除按钮元素');
        }

        // 血缘图谱控制栏
        this.initLineageControls();
    }

    initLineageControls() {
        // 旁系血缘开关
        const sideLineageSwitch = this.shadowRoot.querySelector('#sideLineageSwitch');
        if (sideLineageSwitch) {
            sideLineageSwitch.addEventListener('click', () => {
                sideLineageSwitch.classList.toggle('on');
                this._sideLineageEnabled = sideLineageSwitch.classList.contains('on');
                this.renderLineageGraph();
            });
        }

        // 聚焦数据集按钮
        const focusProductBtn = this.shadowRoot.querySelector('#focusProduct');
        if (focusProductBtn) {
            focusProductBtn.addEventListener('click', () => {
                if (this._lineageChart) {
                    this._lineageChart.dispatchAction({
                        type: 'restore'
                    });
                }
            });
        }

        // 放大按钮
        const zoomInBtn = this.shadowRoot.querySelector('#zoomIn');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                if (this._lineageChart) {
                    const option = this._lineageChart.getOption();
                    option.series[0].zoom = (option.series[0].zoom || 1) * 1.1;
                    this._lineageChart.setOption(option);
                }
            });
        }

        // 缩小按钮
        const zoomOutBtn = this.shadowRoot.querySelector('#zoomOut');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                if (this._lineageChart) {
                    const option = this._lineageChart.getOption();
                    option.series[0].zoom = (option.series[0].zoom || 1) * 0.9;
                    this._lineageChart.setOption(option);
                }
            });
        }

        // 重置视图按钮
        const zoomResetBtn = this.shadowRoot.querySelector('#zoomReset');
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => {
                if (this._lineageChart) {
                    this._lineageChart.dispatchAction({
                        type: 'restore'
                    });
                }
            });
        }
    }

    async show(path) {
        this.setAttribute('show', '');
        
        // 调用 /api/dataset/metas 接口获取数据集详情
        try {
            const result = await window.AppConfig.get('dataset', 'metas', { path });

            if (result.code === 200 && result.data) {
                this.datasetInfo = result.data;
                this.renderOverview();
                this.loadHistory();
                this.renderLineageGraph();
            } else {
                console.error('获取数据集详情失败:', result.message);
                this.dispatchEvent(new CustomEvent('show-toast', {
                    bubbles: true,
                    composed: true,
                    detail: { message: '获取数据集详情失败: ' + result.message, type: 'error' }
                }));
            }
        } catch (error) {
            console.error('获取数据集详情失败:', error);
            this.dispatchEvent(new CustomEvent('show-toast', {
                bubbles: true,
                composed: true,
                detail: { message: '获取数据集详情失败: ' + error.message, type: 'error' }
            }));
        }
    }

    hide() {
        this.removeAttribute('show');
        this.datasetInfo = null;

        // 清理图表实例和观察器
        if (this._lineageChart) {
            this._lineageChart.dispose();
            this._lineageChart = null;
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._timelineResizeObserver) {
            this._timelineResizeObserver.disconnect();
            this._timelineResizeObserver = null;
        }
        if (this._timelineSvg) {
            this._timelineSvg.remove();
            this._timelineSvg = null;
        }

        // 清理弹窗
        this.removePopup();
    }

    renderOverview() {
        if (!this.datasetInfo) return;

        const datasetName = this.datasetInfo.datasetName || '-';
        
        const nameEl = this.shadowRoot.querySelector('#datasetName');
        const createTimeEl = this.shadowRoot.querySelector('#createTime');
        const remarkEl = this.shadowRoot.querySelector('#remark');
        const sqlEl = this.shadowRoot.querySelector('#datasetSql');
        const developerEl = this.shadowRoot.querySelector('#developer');
        const versionEl = this.shadowRoot.querySelector('#version');

        if (nameEl) nameEl.textContent = datasetName;
        if (createTimeEl) createTimeEl.textContent = this.formatTime(this.datasetInfo.createTime) || '-';
        if (remarkEl) remarkEl.textContent = this.datasetInfo.remark || '-';
        if (sqlEl) sqlEl.textContent = this.datasetInfo.datasetSql || '-';
        if (developerEl) developerEl.textContent = this.datasetInfo.operator || '-';
        if (versionEl) versionEl.textContent = this.datasetInfo.version || '-';
    }

    formatTime(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    async loadHistory() {
        // 调用版本历史接口
        try {
            const result = await window.AppConfig.get('dataset', 'history', { datasetName: this.datasetInfo.datasetName });

            if (result.code === 200 && result.data) {
                this.historyData = result.data;
                this.renderVersionTimeline(this.historyData);
            } else {
                console.error('获取版本历史失败:', result.message);
                this.dispatchEvent(new CustomEvent('show-toast', {
                    bubbles: true,
                    composed: true,
                    detail: { message: '获取版本历史失败: ' + result.message, type: 'error' }
                }));
            }
        } catch (error) {
            console.error('获取版本历史失败:', error);
            this.dispatchEvent(new CustomEvent('show-toast', {
                bubbles: true,
                composed: true,
                detail: { message: '获取版本历史失败: ' + error.message, type: 'error' }
            }));
        }
    }

    renderVersionTimeline(historyData) {
        const timelineContainer = this.shadowRoot.querySelector('#lineageGraph');
        if (!timelineContainer) {
            return;
        }

        // 检查D3.js是否加载（通过window全局对象）
        if (typeof window.d3 === 'undefined') {
            timelineContainer.innerHTML = '<div class="empty-state">D3.js库加载失败</div>';
            return;
        }

        // 清除之前的图表
        timelineContainer.innerHTML = '';

        // 如果没有版本历史数据
        if (!historyData || historyData.length === 0) {
            timelineContainer.innerHTML = '<div class="empty-state">暂无版本历史</div>';
            return;
        }

        // 延迟初始化以确保容器有正确尺寸
        setTimeout(() => {
            const width = timelineContainer.clientWidth || 800;
            const height = timelineContainer.clientHeight || 400;

            // 使用window.d3访问全局D3对象
            const d3 = window.d3;

            // 创建SVG
            const svg = d3.select(timelineContainer)
                .append('svg')
                .attr('width', width)
                .attr('height', height);

            // 添加标题
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('font-weight', 'normal')
                .attr('fill', '#1f2329')
                .text(`数据集 ${this.datasetInfo?.datasetName || 'dataset'} 版本变更时间线`);

            // 后端已返回树形结构，创建虚拟根节点包含所有根节点
            const virtualRoot = {
                id: 'root',
                name: 'root',
                time: '',
                timestamp: 0,
                color: '#fff',
                user: '',
                ip: '',
                sql: '',
                remark: '',
                deleted: false,
                children: historyData
            };

            // 使用D3 tree layout计算分支层级（用于y坐标）
            const treeLayout = d3.tree()
                .size([height - 100, 100]);  // 只用于计算y坐标

            const root = d3.hierarchy(virtualRoot);
            treeLayout(root);

            // 提取所有节点，过滤掉虚拟根节点
            const allNodes = root.descendants().filter(d => d.data.id !== 'root');

            // 根据时间计算x坐标，使用点比例尺确保节点有最小间距
            const timeScale = d3.scalePoint()
                .domain(allNodes.map(d => d.data.time).sort())
                .range([80, width - 80])
                .padding(0.1);

            // 构建节点数组：x根据时间，y根据tree的分支层级
            const nodes = allNodes.map(d => ({
                id: d.data.id,
                name: d.data.name,
                x: timeScale(d.data.time),  // x根据时间（点比例尺直接使用时间字符串）
                y: d.x + 50,  // y根据tree的分支层级
                time: d.data.time,
                timestamp: d.data.timestamp || new Date(d.data.time).getTime(),  // 如果没有timestamp，从time转换
                color: d.data.color,
                user: d.data.user,
                ip: d.data.ip,
                sql: d.data.sql,
                remark: d.data.remark
            }));

            // 提取连线，过滤掉包含虚拟根节点的连线
            const links = root.links().filter(d => d.source.data.id !== 'root' && d.target.data.id !== 'root').map(d => ({
                source: d.source.data.id,
                target: d.target.data.id,
                color: d.target.data.color
            }));

            // 创建节点ID映射
            const nodeMap = new Map(nodes.map(d => [d.id, d]));

            // 按父节点分组连线
            const linksBySource = new Map();
            links.forEach(link => {
                if (!linksBySource.has(link.source)) {
                    linksBySource.set(link.source, []);
                }
                linksBySource.get(link.source).push(link);
            });

            // 找到所有根节点（没有父节点的节点）
            const rootNodes = nodes.filter(node => {
                return !links.some(link => link.target === node.id);
            });

            // 找到所有叶子节点（没有子节点的节点）
            const leafNodes = nodes.filter(node => {
                return !links.some(link => link.source === node.id);
            });

            // 计算从根节点到每个叶子节点的所有路径及其总时间差
            const allPaths = [];

            rootNodes.forEach(rootNode => {
                leafNodes.forEach(leafNode => {
                    // 使用DFS找到从根节点到叶子节点的所有路径
                    const paths = [];
                    const findPaths = (currentNode, targetNode, currentPath, currentLinks) => {
                        if (currentNode.id === targetNode.id) {
                            paths.push({ nodes: [...currentPath], links: [...currentLinks] });
                            return;
                        }

                        const childLinks = linksBySource.get(currentNode.id);
                        if (!childLinks) return;

                        childLinks.forEach(link => {
                            const nextNode = nodeMap.get(link.target);
                            findPaths(nextNode, targetNode, [...currentPath, nextNode], [...currentLinks, link]);
                        });
                    };

                    findPaths(rootNode, leafNode, [rootNode], []);

                    // 计算每条路径的总时间差
                    paths.forEach(path => {
                        let totalTimeDiff = 0;
                        path.links.forEach(link => {
                            const source = nodeMap.get(link.source);
                            const target = nodeMap.get(link.target);
                            totalTimeDiff += target.timestamp - source.timestamp;
                        });
                        allPaths.push({
                            links: path.links,
                            totalTimeDiff: totalTimeDiff
                        });
                    });
                });
            });

            // 找到总时间差最长的路径（从根到叶子）
            const longestPathByTotal = allPaths.reduce((max, path) => {
                return path.totalTimeDiff > max.totalTimeDiff ? path : max;
            }, allPaths[0]);

            const longestTotalPathLinks = new Set(longestPathByTotal?.links || []);

            // 从每个根节点开始，计算最短时间路径（每个分叉选最小时间差）
            const shortestPathLinks = new Set();

            rootNodes.forEach(rootNode => {
                let currentNode = rootNode;
                while (true) {
                    const childLinks = linksBySource.get(currentNode.id);
                    if (!childLinks || childLinks.length === 0) break;

                    const linksWithTimeDiff = childLinks.map(link => ({
                        link: link,
                        timeDiff: nodeMap.get(link.target).timestamp - currentNode.timestamp
                    }));

                    const minTimeDiffLink = linksWithTimeDiff.reduce((min, item) => {
                        return item.timeDiff < min.timeDiff ? item : min;
                    }, linksWithTimeDiff[0]);

                    shortestPathLinks.add(minTimeDiffLink.link);
                    currentNode = nodeMap.get(minTimeDiffLink.link.target);
                }
            });

            // 从每个根节点开始，计算每个分叉选最大时间差的路径
            const maxStepPathLinks = new Set();

            rootNodes.forEach(rootNode => {
                let currentNode = rootNode;
                while (true) {
                    const childLinks = linksBySource.get(currentNode.id);
                    if (!childLinks || childLinks.length === 0) break;

                    const linksWithTimeDiff = childLinks.map(link => ({
                        link: link,
                        timeDiff: nodeMap.get(link.target).timestamp - currentNode.timestamp
                    }));

                    const maxTimeDiffLink = linksWithTimeDiff.reduce((max, item) => {
                        return item.timeDiff > max.timeDiff ? item : max;
                    }, linksWithTimeDiff[0]);

                    maxStepPathLinks.add(maxTimeDiffLink.link);
                    currentNode = nodeMap.get(maxTimeDiffLink.link.target);
                }
            });

            // 标记节点和连线的颜色
            nodes.forEach(node => {
                const isOnShortestPath = shortestPathLinks.has(links.find(l => l.target === node.id)) ||
                                        shortestPathLinks.has(links.find(l => l.source === node.id));
                const isOnMaxStepPath = maxStepPathLinks.has(links.find(l => l.target === node.id)) ||
                                       maxStepPathLinks.has(links.find(l => l.source === node.id));
                const isOnLongestTotalPath = longestTotalPathLinks.has(links.find(l => l.target === node.id)) ||
                                           longestTotalPathLinks.has(links.find(l => l.source === node.id));
                
                if (isOnLongestTotalPath) {
                    node.pathType = 'longestTotal';
                    node.displayColor = '#1890ff'; // 蓝色
                } else if (isOnMaxStepPath) {
                    node.pathType = 'maxStep';
                    node.displayColor = '#faad14'; // 黄橙色
                } else if (isOnShortestPath) {
                    node.pathType = 'shortest';
                    node.displayColor = '#660099'; // 清华紫色
                } else {
                    node.pathType = 'other';
                    node.displayColor = '#2da44e'; // Git黄绿色
                }
            });

            links.forEach(link => {
                if (longestTotalPathLinks.has(link)) {
                    link.pathType = 'longestTotal';
                    link.displayColor = '#1890ff'; // 蓝色
                } else if (maxStepPathLinks.has(link)) {
                    link.pathType = 'maxStep';
                    link.displayColor = '#faad14'; // 黄橙色
                } else if (shortestPathLinks.has(link)) {
                    link.pathType = 'shortest';
                    link.displayColor = '#660099'; // 清华紫色
                } else {
                    link.pathType = 'other';
                    link.displayColor = '#2da44e'; // Git黄绿色
                }
            });

            // 为每个父节点计算统一的曲线结束x坐标（取所有子节点中最小的target x的1/4位置）
            const curveEndXBySource = new Map();
            linksBySource.forEach((sourceLinks, sourceId) => {
                const source = nodeMap.get(sourceId);
                const minTargetX = Math.min(...sourceLinks.map(link => nodeMap.get(link.target).x));
                const curveDistance = (minTargetX - source.x) / 4;
                curveEndXBySource.set(sourceId, source.x + curveDistance);
            });

            // 自定义路径生成器：先弯后直 - 同一父节点的所有子节点在相同x坐标处转为直线
            const linkPath = function(d) {
                const source = nodeMap.get(d.source);
                const target = nodeMap.get(d.target);

                const sx = source.x + 15;
                const sy = source.y;
                const tx = target.x - 15;
                const ty = target.y;

                // 使用父节点的统一曲线结束x坐标
                const curveEndX = curveEndXBySource.get(d.source);

                // 贝塞尔曲线控制点
                const curveDistance = curveEndX - sx;
                const cp1x = sx + curveDistance * 0.5;
                const cp1y = sy;
                const cp2x = sx + curveDistance * 0.5;
                const cp2y = ty;

                // 路径：起点 -> 贝塞尔曲线 -> 曲线结束点 -> 水平直线 -> 目标点
                return `M ${sx} ${sy}
                        C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curveEndX} ${ty}
                        L ${tx} ${ty}`;
            };

            // 创建主容器用于缩放
            const mainGroup = svg.append('g');

            // 绘制连线
            const link = mainGroup.append('g')
                .selectAll('path')
                .data(links)
                .enter()
                .append('path')
                .attr('d', linkPath)
                .attr('fill', 'none')
                .attr('stroke', d => d.displayColor)
                .attr('stroke-width', d => d.isMainPath ? 3 : 2)
                .attr('opacity', d => d.isMainPath ? 1 : 0.6);

            // 绘制节点
            const node = mainGroup.append('g')
                .selectAll('g')
                .data(nodes)
                .enter()
                .append('g')
                .attr('transform', d => `translate(${d.x}, ${d.y})`);

            // 节点圆形
            node.append('circle')
                .attr('r', 13)
                .attr('fill', d => d.color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    d3.select(this).attr('stroke-width', 4);

                    // 创建tooltip
                    const tooltip = d3.select('body')
                        .append('div')
                        .attr('class', 'd3-tooltip')
                        .style('position', 'absolute')
                        .style('background', 'white')
                        .style('border', '1px solid #ccc')
                        .style('border-radius', '4px')
                        .style('padding', '10px')
                        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
                        .style('font-size', '12px')
                        .style('z-index', '9999')
                        .style('pointer-events', 'none')
                        .style('max-width', '400px')
                        .html(`
                            <div style="font-weight:bold;margin-bottom:5px;">版本：${d.name}</div>
                            <div>时间：${d.time}</div>
                            <div>操作人：${d.user}</div>
                            <div>IP：${d.ip}</div>
                            <div style="margin-top:5px;"><strong>SQL：</strong></div>
                            <div style="word-break:break-all;font-family:monospace;font-size:11px;background:#f5f5f5;padding:5px;border-radius:3px;">${d.sql || '-'}</div>
                            <div style="margin-top:5px;"><strong>备注：</strong>${d.remark || '-'}</div>
                        `);

                    // 定位tooltip
                    tooltip
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY + 10) + 'px');
                })
                .on('mousemove', function(event) {
                    d3.select('.d3-tooltip')
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY + 10) + 'px');
                })
                .on('mouseout', function(event, d) {
                    d3.select(this).attr('stroke-width', 2);
                    d3.select('.d3-tooltip').remove();
                });

            // 节点标签（版本名）
            node.append('text')
                .attr('dy', 35)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(d => d.name);

            // 时间标签（节点下方）
            node.append('text')
                .attr('dy', 45)
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .attr('fill', '#333')
                .text(d => d.time);

            // 添加缩放行为（只在鼠标悬停在图上时才允许缩放）
            const zoom = d3.zoom()
                .scaleExtent([0.5, 3])
                .filter(event => {
                    // 只在鼠标悬停在mainGroup或其子元素上时才允许缩放
                    const target = event.target;
                    return target === mainGroup.node() || mainGroup.node().contains(target);
                })
                .on('zoom', (event) => {
                    mainGroup.attr('transform', event.transform);
                });

            svg.call(zoom);

            // 存储SVG实例和zoom以便清理
            this._timelineSvg = svg;
            this._timelineZoom = zoom;
        }, 100);
    }

    async renderLineageGraph() {
        const graphContainer = this.shadowRoot.querySelector('#lineageChart');
        if (!graphContainer || typeof echarts === 'undefined') {
            if (graphContainer) {
                graphContainer.innerHTML = '<div class="graph-placeholder">图表库加载失败</div>';
            }
            return;
        }

        // 清除之前的图表实例
        const existingChart = echarts.getInstanceByDom(graphContainer);
        if (existingChart) {
            existingChart.dispose();
        }

        graphContainer.innerHTML = '<div class="graph-placeholder">血缘图谱加载中...</div>';

        // 获取数据集路径
        const datasetPath = this.datasetInfo?.storagePath;
        if (!datasetPath) {
            graphContainer.innerHTML = '<div class="graph-placeholder">数据集路径不存在</div>';
            return;
        }

        try {
            // 调用接口获取数据，传递旁系血缘参数
            const url = `/api/transform-job/bloodline?datasetPath=${encodeURIComponent(datasetPath)}&sideLineage=${this._sideLineageEnabled}`;
            const result = await window.AppConfig.request(url);

            if (result.code !== 200 || !result.data) {
                graphContainer.innerHTML = '<div class="graph-placeholder">获取血缘数据失败</div>';
                return;
            }

            const jobs = result.data;
            if (!jobs || jobs.length === 0) {
                graphContainer.innerHTML = '<div class="graph-placeholder">暂无血缘数据</div>';
                return;
            }

            // 构建节点和边
            const nodes = [];
            const links = [];
            const nodeMap = new Map(); // 用于合并相同数据集起点的节点
            let nodeId = 0;

            // 处理每个作业
            jobs.forEach(job => {
                const taskList = job.taskList ? JSON.parse(job.taskList) : [];
                let previousNodeId = null;

                taskList.forEach((task, index) => {
                    const taskType = task.taskType === 1 || task.taskType === 'PYTHON' ? 'python' : 'iginx';
                    let currentNodeId = null;

                    // 如果是IGINX任务且有数据集
                    if (taskType === 'iginx' && task.dataset) {
                        const datasetKey = task.dataset.storagePath || task.dataset.datasetName;
                        
                        // 检查是否已存在相同数据集的节点
                        if (nodeMap.has(datasetKey)) {
                            currentNodeId = nodeMap.get(datasetKey);
                        } else {
                            const datasetNodeId = nodeId++;
                            currentNodeId = datasetNodeId;
                            nodeMap.set(datasetKey, currentNodeId);

                            const label = `数据集: ${task.dataset.datasetName}\n版本: ${task.dataset.version}\n任务类型: IGINX\n数据流类型: ${task.dataFlowType}`;
                            const lines = label.split('\n');
                            const maxLineLength = Math.max(...lines.map(line => line.length));
                            const width = maxLineLength * 9 + 40;
                            const height = lines.length * 18 + 30;

                            nodes.push({
                                id: datasetNodeId,
                                name: task.dataset.datasetName || task.dataset,
                                type: 'dataset',
                                datasetType: '数据集',
                                itemStyle: { color: '#E3F2FD', borderColor: '#2196F3' },
                                symbolSize: [width, height],
                                datasetData: task.dataset,
                                taskData: task,
                                jobData: job
                            });
                        }
                    }
                    // 如果是Python任务
                    else if (taskType === 'python') {
                        const taskNodeId = nodeId++;
                        currentNodeId = taskNodeId;

                        const label = `函数: ${task.pyTaskName}\n任务类型: PYTHON\n数据流类型: ${task.dataFlowType}`;
                        const lines = label.split('\n');
                        const maxLineLength = Math.max(...lines.map(line => line.length));
                        const width = maxLineLength * 9 + 40;
                        const height = lines.length * 18 + 30;

                        nodes.push({
                            id: taskNodeId,
                            name: task.pyTaskName || `Python任务${index + 1}`,
                            type: 'task',
                            datasetType: 'Python函数',
                            itemStyle: { color: '#FFF3E0', borderColor: '#FF9800' },
                            symbolSize: [width, height],
                            taskData: task,
                            jobData: job
                        });
                    }

                    // 连接到前一个节点
                    if (previousNodeId !== null && currentNodeId !== null) {
                        // 检查边是否已存在
                        const linkExists = links.some(link => 
                            link.source === previousNodeId && link.target === currentNodeId
                        );
                        if (!linkExists) {
                            links.push({
                                source: previousNodeId,
                                target: currentNodeId,
                                jobData: job
                            });
                        }
                    }

                    previousNodeId = currentNodeId;
                });

                // 添加结果集节点
                if (previousNodeId !== null) {
                    const outputNodeId = nodeId++;
                    const label = `结果集: ${job.exportFiletName || '导出文件'}`;
                    const lines = label.split('\n');
                    const maxLineLength = Math.max(...lines.map(line => line.length));
                    const width = maxLineLength * 9 + 40;
                    const height = lines.length * 18 + 30;

                    nodes.push({
                        id: outputNodeId,
                        name: job.exportFiletName || '导出文件',
                        type: 'output',
                        datasetType: '结果集',
                        itemStyle: { color: '#F44336', borderColor: '#F44336' },
                        symbolSize: [width, height],
                        jobData: job
                    });

                    links.push({
                        source: previousNodeId,
                        target: outputNodeId,
                        jobData: job
                    });
                }
            });

            graphContainer.innerHTML = '';

            // 延迟初始化以确保容器有正确尺寸
            setTimeout(() => {
                const chart = echarts.init(graphContainer);

                const iginxConfig = {
                    tooltip: { trigger: 'none', enterable: true },
                    series: [{
                        type: 'graph',
                        layout: 'force',
                        force: { repulsion: 600, edgeLength: 350, gravity: 0.05, layoutAnimation: true },
                        roam: true,
                        draggable: true,
                        symbolSize: function(params) {
                            try {
                                return params && params.data && params.data.symbolSize ? params.data.symbolSize : [200, 70];
                            } catch (e) {
                                return [200, 70];
                            }
                        },
                        symbol: 'rect',
                        itemStyle: { 
                            color: '#E3F2FD', 
                            borderColor: '#2196F3', 
                            borderWidth: 1, 
                            borderRadius: 6 
                        },
                        label: {
                            show: true,
                            formatter: function(params) {
                                if (params.data.type === 'dataset') {
                                    const dataset = params.data.datasetData;
                                    const task = params.data.taskData;
                                    const taskType = task.taskType === 1 || task.taskType === 'PYTHON' ? 'PYTHON' : 'IGINX';
                                    const flowType = task.dataFlowType === 'STREAM' ? 'STREAM' : 'BATCH';
                                    return `数据集: ${dataset.datasetName}\n版本: ${dataset.version}\n任务类型: ${taskType}\n数据流类型: ${flowType}`;
                                } else if (params.data.type === 'output') {
                                    const job = params.data.jobData;
                                    return `结果集: ${job.exportFiletName || '导出文件'}`;
                                } else if (params.data.type === 'task') {
                                    const task = params.data.taskData;
                                    const taskType = task.taskType === 1 || task.taskType === 'PYTHON' ? 'PYTHON' : 'IGINX';
                                    const flowType = task.dataFlowType === 'STREAM' ? 'STREAM' : 'BATCH';
                                    const name = task.pyTaskName || '任务';
                                    return `函数: ${name}\n任务类型: ${taskType}\n数据流类型: ${flowType}`;
                                }
                                return params.name;
                            },
                            fontSize: 12, 
                            color: '#333', 
                            lineHeight: 18, 
                            position: 'inside',
                            verticalAlign: 'middle',
                            align: 'center'
                        },
                        lineStyle: { 
                            color: '#2196F3', 
                            width: 1.8, 
                            curveness: 0.1, 
                            opacity: 0.8 
                        },
                        edgeSymbol: ['none', 'arrow'],
                        edgeSymbolSize: [0, 15],
                        data: nodes,
                        links: links
                    }]
                };

                chart.setOption(iginxConfig);

                // Click event: show popup
                chart.on('click', (params) => {
                    if (params.dataType === 'edge' || (params.data && params.data.type === 'output')) {
                        this.showJobPopup(params, graphContainer);
                    } else {
                        this.showPopup(params);
                    }
                });

                // 监听容器尺寸变化
                const resizeObserver = new ResizeObserver(() => {
                    chart.resize();
                });
                resizeObserver.observe(graphContainer);

                // 存储图表实例和观察器以便清理
                this._lineageChart = chart;
                this._resizeObserver = resizeObserver;
            }, 100);
        } catch (error) {
            console.error('获取血缘数据失败:', error);
            graphContainer.innerHTML = '<div class="graph-placeholder">获取血缘数据失败</div>';
        }
    }

    showJobPopup(params, container) {
        // Remove old popup
        var oldPopup = document.querySelector('.data-popup');
        if (oldPopup) oldPopup.remove();

        // Get job data from the edge or output node
        const job = params.data.jobData;
        if (!job) return;

        // Calculate popup position
        var chartRect = container.getBoundingClientRect();
        var popupX = chartRect.left + params.event.offsetX + 15;
        var popupY = chartRect.top + params.event.offsetY + 15;

        var popup = document.createElement('div');
        popup.className = 'data-popup';
        popup.style.cssText = `
            width: 500px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            background: #fff;
            position: absolute;
            z-index: 9999;
            font-size: 12px;
            left: ${popupX}px;
            top: ${popupY}px;
        `;

        const statusMap = {
            0: '未知',
            1: '完成',
            2: '创建',
            3: '等待运行',
            4: '运行中',
            5: '部分失败中',
            6: '部分失败',
            7: '失败中',
            8: '失败',
            9: '取消中',
            10: '取消'
        };
        
        popup.innerHTML = `
            <div class="popup-header" style="
                padding: 10px 15px;
                background: #fafafa;
                border-bottom: 1px solid #e0e0e0;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 14px;
            ">
                <span>📋 ${job.name || '作业信息'}</span>
                <span class="popup-close" style="cursor:pointer;font-size:18px;">&times;</span>
            </div>
            <div class="popup-body" style="padding:15px;">
                <div class="popup-field" style="margin-bottom:12px;">
                    <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">作业ID：</label>
                    <span class="field-value">${job.jobId || '-'}</span>
                </div>
                <div class="popup-field" style="margin-bottom:12px;">
                    <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">作业状态：</label>
                    <span class="field-value">${statusMap[job.jobState] || '未知'}</span>
                </div>
                <div class="popup-field" style="margin-bottom:12px;">
                    <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">调度策略：</label>
                    <span class="field-value">${job.schedule || '-'}</span>
                </div>
                <div class="popup-field" style="margin-bottom:12px;">
                    <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">创建时间：</label>
                    <span class="field-value">${job.createTime ? new Date(job.createTime).toLocaleString('zh-CN') : '-'}</span>
                </div>
                <div class="popup-field" style="margin-bottom:12px;">
                    <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作人：</label>
                    <span class="field-value">${job.operator || '-'}</span>
                </div>
                <div class="popup-field" style="margin-bottom:12px;">
                    <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作IP：</label>
                    <span class="field-value">${job.clientIp || '-'}</span>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Close button handler
        const closeBtn = popup.querySelector('.popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                popup.remove();
            });
        }

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 5000);
    }

    showPopup(params) {
        // Remove old popup
        var oldPopup = document.querySelector('.data-popup');
        if (oldPopup) oldPopup.remove();
        if (!params.data) return;

        // Calculate popup position
        var chartDom = this.shadowRoot.querySelector('#lineageChart');
        var chartRect = chartDom.getBoundingClientRect();
        var popupX = chartRect.left + params.event.offsetX + 15;
        var popupY = chartRect.top + params.event.offsetY + 15;

        var popup = document.createElement('div');
        popup.className = 'data-popup';
        popup.style.cssText = `
            width: 500px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            background: #fff;
            position: absolute;
            z-index: 9999;
            font-size: 12px;
            left: ${popupX}px;
            top: ${popupY}px;
        `;

        // Dataset node popup (use datasetData from node)
        if (params.data.type === 'dataset') {
            const dataset = params.data.datasetData;
            const task = params.data.taskData;
            
            popup.innerHTML = `
                <div class="popup-header" style="
                    padding: 10px 15px;
                    background: #fafafa;
                    border-bottom: 1px solid #e0e0e0;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                ">
                    <span>📊 ${dataset.datasetName}</span>
                    <span class="popup-close" style="cursor:pointer;font-size:18px;">&times;</span>
                </div>
                <div class="popup-body" style="padding:15px;">
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">版本号：</label>
                        <span class="field-value">${dataset.version || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">存储路径：</label>
                        <span class="field-value">${dataset.storagePath || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">创建时间：</label>
                        <span class="field-value">${dataset.createTime ? new Date(dataset.createTime).toLocaleString('zh-CN') : '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作人：</label>
                        <span class="field-value">${dataset.operator || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作IP：</label>
                        <span class="field-value">${dataset.clientIp || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">SQL定义：</label>
                        <span class="field-value"><pre style="background:#f8f9fa;padding:8px;border-radius:4px;margin:0;overflow-x:auto;">${dataset.datasetSql || '-'}</pre></span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">备注信息：</label>
                        <span class="field-value multi-line" style="white-space:pre-wrap;">${dataset.remark || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">数据流类型：</label>
                        <span class="field-value">${task.dataFlowType || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">超时时间：</label>
                        <span class="field-value">${task.timeout ? task.timeout + 'ms' : '-'}</span>
                    </div>
                </div>
            `;
        }
        // Output node popup (TransformJobEntity fields except taskList)
        else if (params.data.type === 'output') {
            const job = params.data.jobData;
            const statusMap = {
                0: '未知',
                1: '完成',
                2: '创建',
                3: '等待运行',
                4: '运行中',
                5: '部分失败中',
                6: '部分失败',
                7: '失败中',
                8: '失败',
                9: '取消中',
                10: '取消'
            };
            
            popup.innerHTML = `
                <div class="popup-header" style="
                    padding: 10px 15px;
                    background: #fafafa;
                    border-bottom: 1px solid #e0e0e0;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                ">
                    <span>📁 ${job.exportFiletName || '导出文件'}</span>
                    <span class="popup-close" style="cursor:pointer;font-size:18px;">&times;</span>
                </div>
                <div class="popup-body" style="padding:15px;">
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">作业ID：</label>
                        <span class="field-value">${job.jobId || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">作业名称：</label>
                        <span class="field-value">${job.name || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">作业状态：</label>
                        <span class="field-value">${statusMap[job.jobState] || '未知'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">调度策略：</label>
                        <span class="field-value">${job.schedule || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">创建时间：</label>
                        <span class="field-value">${job.createTime ? new Date(job.createTime).toLocaleString('zh-CN') : '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作人：</label>
                        <span class="field-value">${job.operator || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作IP：</label>
                        <span class="field-value">${job.clientIp || '-'}</span>
                    </div>
                </div>
            `;
        }
        // Task node popup (Python tasks only)
        else if (params.data.type === 'task') {
            const task = params.data.taskData;
            const taskType = task.taskType === 1 || task.taskType === 'PYTHON' ? 'PYTHON' : 'IGINX';
            
            popup.innerHTML = `
                <div class="popup-header" style="
                    padding: 10px 15px;
                    background: #fafafa;
                    border-bottom: 1px solid #e0e0e0;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                ">
                    <span>⚙️ ${task.pyTaskName || 'Python函数'}</span>
                    <span class="popup-close" style="cursor:pointer;font-size:18px;">&times;</span>
                </div>
                <div class="popup-body" style="padding:15px;">
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">任务类型：</label>
                        <span class="field-value">${taskType}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">数据流类型：</label>
                        <span class="field-value">${task.dataFlowType || '-'}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">超时时间：</label>
                        <span class="field-value">${task.timeout ? task.timeout + 'ms' : '-'}</span>
                    </div>
                </div>
            `;
        }

        document.body.appendChild(popup);

        // Close button handler
        const closeBtn = popup.querySelector('.popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                popup.remove();
            });
        }

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 5000);
    }

    removePopup() {
        const popup = document.querySelector('.data-popup');
        if (popup) popup.remove();
    }

    showDeleteConfirmDialog() {
        console.log('showDeleteConfirmDialog 被调用');

        // 从右侧树获取选中的节点
        const rightSidebarTree = document.querySelector('.right-sidebar .tree');
        if (!rightSidebarTree) {
            console.error('未找到右侧树');
            return;
        }

        const activeNode = rightSidebarTree.querySelector('.tree-node.active');
        if (!activeNode) {
            console.error('未找到选中的节点');
            return;
        }

        // 获取叶子节点完整路径
        const fullPath = activeNode.getAttribute('data-full-path');
        console.log('叶子节点完整路径:', fullPath);

        // 从路径中提取版本（最后一部分）
        const version = fullPath.split('.').pop();
        console.log('版本:', version);

        // 获取父节点名称（数据集名）
        const parentNode = activeNode.closest('.tree-children')?.parentElement;
        const parentSpan = parentNode?.querySelector('span');
        const datasetName = parentSpan?.textContent?.trim() || '未命名';
        console.log('父节点名称（数据集名）:', datasetName);

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 24px;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            ">
                <div style="
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: #1f2937;
                ">确认删除</div>
                <div style="
                    margin-bottom: 24px;
                    color: #595959;
                    line-height: 1.6;
                ">
                    确定要删除数据集 <span style="color: #ff4d4f; font-weight: 600;">${datasetName}</span> 吗？<br>
                    版本: ${version}<br><br>
                    <strong>此操作不可恢复，删除后将无法找回！</strong>
                </div>
                <div style="
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                ">
                    <button class="btn-cancel" style="
                        padding: 8px 16px;
                        border-radius: 4px;
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                        background: #f0f0f0;
                        color: #595959;
                    ">取消</button>
                    <button class="btn-confirm-delete" style="
                        padding: 8px 16px;
                        border-radius: 4px;
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                        background: #ff4d4f;
                        color: white;
                    ">确认删除</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('.btn-cancel');
        const confirmBtn = overlay.querySelector('.btn-confirm-delete');

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        confirmBtn.addEventListener('click', async () => {
            console.log('确认删除按钮被点击');
            confirmBtn.disabled = true;
            confirmBtn.textContent = '删除中...';
            await this.performDelete();
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }

    async performDelete() {
        console.log('performDelete 被调用');

        // 从右侧树获取选中的节点
        const rightSidebarTree = document.querySelector('.right-sidebar .tree');
        if (!rightSidebarTree) {
            console.error('未找到右侧树');
            return;
        }

        const activeNode = rightSidebarTree.querySelector('.tree-node.active');
        if (!activeNode) {
            console.error('未找到选中的节点');
            return;
        }

        // 获取叶子节点路径（版本）
        const path = activeNode.getAttribute('data-full-path');
        console.log('准备删除数据集, path:', path);

        try {
            const result = await window.AppConfig.delete('dataset', 'delete', { path });

            if (result.success) {
                this.dispatchEvent(new CustomEvent('show-toast', {
                    bubbles: true,
                    composed: true,
                    detail: { message: '数据集删除成功', type: 'success' }
                }));

                this.dispatchEvent(new CustomEvent('dataset-deleted', {
                    bubbles: true,
                    composed: true,
                    detail: { path }
                }));

                this.hide();
            } else {
                throw new Error(result.message || '删除失败');
            }

        } catch (error) {
            console.error('删除数据集失败:', error);
            this.dispatchEvent(new CustomEvent('show-toast', {
                bubbles: true,
                composed: true,
                detail: { message: '删除失败: ' + error.message, type: 'error' }
            }));
        }
    }
}

customElements.define('dataset-history', DatasetHistory);
