class DatasetHistory extends HTMLElement {
    constructor() {
        super();
        this.datasetInfo = null;
        this.historyData = [];
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
                                <div class="info-label">创建者</div>
                                <div class="info-value" id="developer">-</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">版本号</div>
                                <div class="info-value" id="version">-</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">创建时间</div>
                                <div class="info-value" id="createTime">-</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">更新时间</div>
                                <div class="info-value" id="updateTime">-</div>
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
                // TODO: 实现旁系血缘切换逻辑
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
        const updateTimeEl = this.shadowRoot.querySelector('#updateTime');
        const sqlEl = this.shadowRoot.querySelector('#datasetSql');
        const developerEl = this.shadowRoot.querySelector('#developer');
        const versionEl = this.shadowRoot.querySelector('#version');

        if (nameEl) nameEl.textContent = datasetName;
        if (createTimeEl) createTimeEl.textContent = this.formatTime(this.datasetInfo.createTime) || '-';
        if (updateTimeEl) updateTimeEl.textContent = this.formatTime(this.datasetInfo.createTime) || '-';
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
        // 使用ECharts渲染版本历史时间线
        this.renderVersionTimeline();
    }

    renderVersionTimeline() {
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
                .text(`数据集 ${this.datasetInfo?.name || 'dataset02'} 版本变更时间线`);

            // 定义节点数据（tree结构）
            const treeData = {
                id: 'V1', name: 'V1', time: '2025-04-07 10:00', color: '#1890ff',
                user: 'engineer', ip: '192.168.1.10',
                job: 'transform_task_001', func: 'data_clean()', sql: 'CREATE TABLE dataset02', change: '数据集初始化创建',
                children: [
                    {
                        id: 'V2', name: 'V2', time: '2025-04-07 10:10', color: '#1890ff',
                        user: 'system', ip: '10.0.0.1',
                        job: 'transform_udf_upgrade', func: 'filter_null()', sql: 'ALTER TABLE dataset02 ADD COLUMN status', change: 'UDF升级，新增空值过滤',
                        children: [
                            {
                                id: 'V3', name: 'V3', time: '2025-04-07 10:20', color: '#52c41a',
                                user: 'engineer', ip: '192.168.1.10',
                                job: 'transform_data_refresh', func: 'refresh_data()', sql: 'INSERT OVERWRITE dataset02', change: '全量数据刷新',
                                children: [
                                    {
                                        id: 'V5', name: 'V5', time: '2025-04-07 10:40', color: '#52c41a',
                                        user: 'algorithm', ip: '192.168.1.11',
                                        job: 'transform_feature_extract', func: 'feature_extract()', sql: 'SELECT feature(*) FROM dataset02', change: '特征提取功能'
                                    }
                                ]
                            },
                            {
                                id: 'V4', name: 'V4', time: '2025-04-07 10:30', color: '#faad14',
                                user: 'admin', ip: '192.168.1.100',
                                job: 'transform_schema_optimize', func: 'optimize_schema()', sql: 'OPTIMIZE TABLE dataset02', change: '表结构优化，增加索引',
                                children: [
                                    {
                                        id: 'V6', name: 'V6', time: '2025-04-07 10:50', color: '#faad14',
                                        user: 'analyst', ip: '192.168.1.12',
                                        job: 'transform_stat_calc', func: 'stat_calc()', sql: 'CREATE TABLE dataset05 AS SELECT * FROM dataset04', change: '生成业务统计结果'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            // 使用D3 tree layout计算分支层级（用于y坐标）
            const treeLayout = d3.tree()
                .size([height - 100, 100]);  // 只用于计算y坐标

            const root = d3.hierarchy(treeData);
            treeLayout(root);

            // 提取所有节点
            const allNodes = root.descendants();

            // 根据时间计算x坐标
            const timeScale = d3.scaleTime()
                .domain(d3.extent(allNodes, d => new Date(d.data.time)))
                .range([80, width - 80]);

            // 构建节点数组：x根据时间，y根据tree的分支层级
            const nodes = allNodes.map(d => ({
                id: d.data.id,
                name: d.data.name,
                x: timeScale(new Date(d.data.time)),  // x根据时间
                y: d.x + 50,  // y根据tree的分支层级
                time: d.data.time,
                color: d.data.color,
                user: d.data.user,
                ip: d.data.ip,
                job: d.data.job,
                func: d.data.func,
                sql: d.data.sql,
                change: d.data.change
            }));

            // 提取连线
            const links = root.links().map(d => ({
                source: d.source.data.id,
                target: d.target.data.id,
                color: d.target.data.color
            }));

            // 创建节点ID映射
            const nodeMap = new Map(nodes.map(d => [d.id, d]));

            // 自定义路径生成器：同一父节点的所有子节点曲线结束点x坐标对齐，圆心向内弯曲
            const linkPath = function(d) {
                const source = nodeMap.get(d.source);
                const target = nodeMap.get(d.target);
                
                const sx = source.x + 15;
                const sy = source.y;
                const tx = target.x - 15;
                const ty = target.y;
                
                // 曲线结束点：基于父节点x坐标 + 固定偏移
                const curveEndX = sx + 80;
                
                // 贝塞尔曲线控制点：圆心向内弯曲
                // 控制点在曲线中段，y值在sy和ty之间
                const midX = (sx + curveEndX) / 2;
                const midY = (sy + ty) / 2;
                
                const cp1x = midX;
                const cp1y = sy;
                const cp2x = midX;
                const cp2y = ty;
                
                // 曲线 + 水平收尾
                return `M ${sx} ${sy} 
                        C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curveEndX} ${ty}
                        L ${tx} ${ty}`;
            };

            // 绘制连线
            const link = svg.append('g')
                .selectAll('path')
                .data(links)
                .enter()
                .append('path')
                .attr('d', linkPath)
                .attr('fill', 'none')
                .attr('stroke', d => d.color)
                .attr('stroke-width', 2)
                .attr('opacity', 0.8);

            // 绘制节点
            const node = svg.append('g')
                .selectAll('g')
                .data(nodes)
                .enter()
                .append('g')
                .attr('transform', d => `translate(${d.x}, ${d.y})`);

            // 节点圆形
            node.append('circle')
                .attr('r', 15)
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
                        .html(`
                            <div style="font-weight:bold;margin-bottom:5px;">版本：${d.name}</div>
                            <div>时间：${d.time}</div>
                            <div>操作人：${d.user}</div>
                            <div>IP：${d.ip}</div>
                            <div>Transform作业：${d.job}</div>
                            <div>UDF函数：${d.func}</div>
                            <div>SQL：${d.sql}</div>
                            <div>变化：${d.change}</div>
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
                .attr('dy', 5)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#fff')
                .text(d => d.name);

            // 时间标签（节点下方）
            node.append('text')
                .attr('dy', 45)
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .attr('fill', '#333')
                .text(d => d.time);

            // 存储SVG实例以便清理
            this._timelineSvg = svg;
        }, 100);
    }

    renderLineageGraph() {
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

        graphContainer.innerHTML = '';

        // 延迟初始化以确保容器有正确尺寸
        setTimeout(() => {
            const chart = echarts.init(graphContainer);

            const iginxConfig = {
                tooltip: { trigger: 'none', enterable: true },
                series: [{
                    type: 'graph',
                    layout: 'force',
                    force: { repulsion: 450, edgeLength: 280, gravity: 0.05, layoutAnimation: true },
                    roam: true,
                    draggable: true,
                    symbolSize: [200, 70],
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
                            var [name, db] = params.name.split('|');
                            var type = params.data.datasetType || '作业';
                            return `${name}\n[${type}] ${db}`;
                        },
                        fontSize: 12, 
                        color: '#333', 
                        lineHeight: 20, 
                        position: 'center'
                    },
                    lineStyle: { 
                        color: '#2196F3', 
                        width: 1.8, 
                        curveness: 0.1, 
                        opacity: 0.8 
                    },
                    edgeSymbol: ['none', 'arrow'],
                    edgeSymbolSize: [0, 12],
                    data: [
                        {
                            id: 'iginx_raw',
                            name: 'RAW_DATA|IGinX',
                            type: 'dataset',
                            datasetType: '原始时序数据',
                            database: 'IGinX',
                            operator: '张三',
                            operateTime: '2024-05-01 09:00:00',
                            operateIp: '192.168.1.101',
                            udfFunction: '无（原始数据未处理）',
                            transformJob: '无',
                            sqlScript: '无',
                            changeProcess: '从设备采集系统导入原始时序数据，包含device_001-device_100共100台设备的温度采集值，采集频率1分钟/次，数据格式为原始JSON。',
                            description: 'IGinX原始时序数据集，存储设备实时温度采集数据，未经过任何清洗和标准化处理，存在空值、异常值和单位不统一问题。',
                            potentialUsers: '数据采集组、数据清洗组',
                            itemStyle: { color: '#E8F5E9', borderColor: '#4CAF50' }
                        },
                        {
                            id: 'demo_product_v1',
                            name: 'DEMO_PRODUCT|demo1',
                            type: 'dataset',
                            datasetType: '清洗后数据',
                            database: 'IGinX/demo1',
                            operator: '张三',
                            operateTime: '2024-05-10 14:00:00',
                            operateIp: '192.168.1.108',
                            udfFunction: 'basic_clean_udf（空值/异常值过滤）',
                            transformJob: 'clean_job_001（单次清洗作业）',
                            sqlScript: 'SELECT device_id, time, temperature FROM RAW_DATA WHERE temperature IS NOT NULL AND temperature BETWEEN 0 AND 100;',
                            changeProcess: '1. 过滤空值：移除temperature字段为空的记录；2. 异常值过滤：保留0-100℃范围内的温度值；3. 数据裁剪：仅保留device_001-device_050共50台核心设备数据；4. 格式转换：将JSON转为IGinX标准列式存储。',
                            description: '基于原始数据完成初步清洗的数据集，解决了空值和明显异常值问题，保留核心设备数据，为后续标准化打下基础。',
                            potentialUsers: '数据分析师、算法组（初步测试）',
                            itemStyle: { color: '#FFF3E0', borderColor: '#FF9800' }
                        },
                        {
                            id: 'demo_product_v2',
                            name: 'DEMO_PRODUCT|ABBY2',
                            type: 'dataset',
                            datasetType: '标准化业务数据',
                            database: 'IGinX/ABBY2',
                            operator: '张三',
                            operateTime: '2024-05-20 14:30:25',
                            operateIp: '192.168.1.108',
                            udfFunction: 'data_clean_udf（完整清洗函数）',
                            transformJob: 'transform_job_001（V2.1批量转换作业）',
                            sqlScript: `-- IGinX Transform批量转换SQL（V2.1）
-- 作者：张三 时间：2024-05-20
SELECT 
    time AS collect_time,
    device_id AS device_code,
    data_clean_udf(temperature) AS temperature_℃,
    device_model,
    collect_location
FROM IGinX.raw_data 
WHERE 
    device_id LIKE 'device_001%' 
    AND collect_time >= '2024-05-01 00:00:00'
INTO DEMO_PRODUCT V2.1
PARTITION BY collect_time
WITH TRANSFORM OPTIONS (
    'batch_size' = '10000',
    'parallelism' = '8'
);`,
                            changeProcess: '1. 字段清洗：调用data_clean_udf完成温度值的空值填充、类型转换、华氏度转摄氏度、范围校验；2. 字段重命名：time→collect_time（采集时间）、device_id→device_code（设备编码），提升可读性；3. 维度补充：关联设备档案表，新增device_model（设备型号）、collect_location（采集地点）字段；4. 分区优化：按collect_time字段分区，提升时间范围查询性能；5. 批量处理：设置8并行度，批量处理896万条数据，总耗时4分45秒。',
                            description: 'DEMO_PRODUCT数据集最终生产版本，完成了全量数据的清洗、标准化和维度补充，适配线上业务的高性能查询和模型推理需求，数据质量和查询效率均达到生产级别要求。',
                            potentialUsers: '算法组（李四、王五）、数据分析组（赵六）、业务组（钱七）、运维组（孙八）',
                            itemStyle: { color: '#E3F2FD', borderColor: '#2196F3' }
                        },
                        {
                            id: 'transform_task',
                            name: 'TRANSFORM|作业',
                            type: 'task',
                            operator: '张三',
                            operateTime: '2024-05-20 14:30:25',
                            operateIp: '192.168.1.108',
                            udfFunction: `def data_clean_udf(value):
    """
    IGinX温度数据清洗UDF函数（V2.1）
    参数：value - 原始温度值（可能为None/字符串/数值）
    返回：清洗后的浮点型温度值（℃）
    """
    if value is None or value == '':
        return 0.0
    try:
        temp = float(value)
        # 华氏度转摄氏度 (℉ - 32) × 5/9
        if temp > 100: # 判定为华氏度
            temp = (temp - 32) * 5 / 9
        # 范围校验（0-100℃）
        return max(0.0, min(100.0, temp))
    except:
        return 0.0`,
                            transformJob: `作业详情：
- 作业ID：transform_job_001
- 作业名称：DEMO_PRODUCT V2.1批量转换
- 作业类型：IGinX Transform批量处理
- 作业版本：V2.1
- 运行状态：成功（success）
- 运行时长：4分45秒
- 处理数据量：896万条
- 并行度：8
- 批处理大小：10000条/批`,
                            sqlScript: `-- IGinX Transform批量转换SQL（V2.1）
-- 作者：张三 时间：2024-05-20
-- 功能：从原始数据生成标准化业务数据集
SELECT 
    time AS collect_time,          -- 采集时间（重命名）
    device_id AS device_code,      -- 设备编码（重命名）
    data_clean_udf(temperature) AS temperature_℃, -- 清洗后的温度值
    device_model,                  -- 设备型号（关联补充）
    collect_location               -- 采集地点（关联补充）
FROM IGinX.raw_data 
WHERE 
    device_id LIKE 'device_001%'   -- 仅保留核心设备
    AND collect_time >= '2024-05-01 00:00:00' -- 时间范围过滤
INTO DEMO_PRODUCT V2.1            -- 输出到V2.1版本
PARTITION BY collect_time         -- 按采集时间分区
WITH TRANSFORM OPTIONS (
    'batch_size' = '10000',        -- 批处理大小
    'parallelism' = '8'            -- 并行度
);`,
                            changeProcess: '本次作业是DEMO_PRODUCT数据集的最终生产版本转换，基于V1.0-V1.1的迭代优化，重点解决了三个核心问题：1. UDF函数性能优化：将原有逐行处理改为批量处理，性能提升8倍；2. 数据分区不合理：新增按时间分区，查询效率提升90%；3. 维度信息缺失：关联设备档案表补充型号和地点字段，满足业务分析需求。最终生成的V2.1版本数据集完全满足线上使用要求。',
                            description: 'IGinX Transform批量转换作业，负责将清洗后的数据集转换为标准化的生产版本数据集，包含完整的UDF函数调用、字段映射、分区配置和批量处理逻辑，是数据集从测试版到生产版的核心转换环节。',
                            potentialUsers: '算法组（李四、王五）、数据分析组（赵六）、业务组（钱七）、运维组（孙八）',
                            symbolSize: 25,
                            itemStyle: { color: '#F44336', borderColor: '#F44336' }
                        }
                    ],
                    links: [
                        { source: 'iginx_raw', target: 'demo_product_v1', type: 'direct' },
                        { source: 'demo_product_v1', target: 'transform_task', type: 'task' },
                        { source: 'transform_task', target: 'demo_product_v2', type: 'task' }
                    ]
                }],
                visualMap: { show: false, dimension: 1, categories: ['dataset', 'task'], inRange: { color: ['#2196F3', '#F44336'] } }
            };

            chart.setOption(iginxConfig);

            // 点击事件：显示详细弹窗
            chart.on('click', (params) => {
                this.showPopup(params);
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
    }

    showPopup(params) {
        // 移除旧弹窗
        var oldPopup = document.querySelector('.data-popup');
        if (oldPopup) oldPopup.remove();
        if (!params.data) return;

        // 计算弹窗位置
        var chartDom = this.shadowRoot.querySelector('#lineageChart');
        var chartRect = chartDom.getBoundingClientRect();
        var popupX = chartRect.left + params.event.offsetX + 15;
        var popupY = chartRect.top + params.event.offsetY + 15;

        var popup = document.createElement('div');
        popup.className = 'data-popup';
        popup.style.left = popupX + 'px';
        popup.style.top = popupY + 'px';
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

        // 数据集节点弹窗（含类型/所属库）
        if (params.data.type === 'dataset') {
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
                    <span>📊 ${params.name.split('|')[0]}</span>
                    <span class="popup-close" style="cursor:pointer;font-size:18px;">&times;</span>
                </div>
                <div class="popup-body" style="padding:15px;">
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">数据集类型：</label>
                        <span class="field-value"><span class="field-tag" style="background-color:#e3f2fd;color:#2196F3;border-radius:3px;font-size:10px;margin-right:5px;padding:2px 6px;">${params.data.datasetType}</span></span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">所属库：</label>
                        <span class="field-value">${params.data.database}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作人：</label>
                        <span class="field-value">${params.data.operator}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作时间：</label>
                        <span class="field-value">${params.data.operateTime}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作IP：</label>
                        <span class="field-value">${params.data.operateIp}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">UDF函数：</label>
                        <span class="field-value"><pre style="background:#f8f9fa;padding:8px;border-radius:4px;margin:0;overflow-x:auto;">${params.data.udfFunction}</pre></span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">Transform作业：</label>
                        <span class="field-value multi-line" style="white-space:pre-wrap;">${params.data.transformJob}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">SQL脚本：</label>
                        <span class="field-value"><pre style="background:#f8f9fa;padding:8px;border-radius:4px;margin:0;overflow-x:auto;">${params.data.sqlScript}</pre></span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">变化过程：</label>
                        <span class="field-value multi-line" style="white-space:pre-wrap;">${params.data.changeProcess}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">描述信息：</label>
                        <span class="field-value multi-line" style="white-space:pre-wrap;">${params.data.description}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">潜在用户：</label>
                        <span class="field-value">${params.data.potentialUsers}</span>
                    </div>
                </div>
            `;
        }
        // 作业节点弹窗
        else if (params.data.type === 'task') {
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
                    <span>⚙️ IGinX Transform作业</span>
                    <span class="popup-close" style="cursor:pointer;font-size:18px;">&times;</span>
                </div>
                <div class="popup-body" style="padding:15px;">
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作人：</label>
                        <span class="field-value">${params.data.operator}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作时间：</label>
                        <span class="field-value">${params.data.operateTime}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">操作IP：</label>
                        <span class="field-value">${params.data.operateIp}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">UDF函数：</label>
                        <span class="field-value"><pre style="background:#f8f9fa;padding:8px;border-radius:4px;margin:0;overflow-x:auto;">${params.data.udfFunction}</pre></span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">Transform作业：</label>
                        <span class="field-value multi-line" style="white-space:pre-wrap;">${params.data.transformJob}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">SQL脚本：</label>
                        <span class="field-value"><pre style="background:#f8f9fa;padding:8px;border-radius:4px;margin:0;overflow-x:auto;">${params.data.sqlScript}</pre></span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">变化过程：</label>
                        <span class="field-value multi-line" style="white-space:pre-wrap;">${params.data.changeProcess}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">描述信息：</label>
                        <span class="field-value multi-line" style="white-space:pre-wrap;">${params.data.description}</span>
                    </div>
                    <div class="popup-field" style="margin-bottom:12px;">
                        <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">潜在用户：</label>
                        <span class="field-value">${params.data.potentialUsers}</span>
                    </div>
                </div>
            `;
        }

        // 添加弹窗并绑定关闭事件
        document.body.appendChild(popup);
        popup.querySelector('.popup-close').onclick = () => popup.remove();
    }

    removePopup() {
        const popup = document.querySelector('.data-popup');
        if (popup) popup.remove();
    }

    showDeleteConfirmDialog() {
        console.log('showDeleteConfirmDialog 被调用, datasetInfo:', this.datasetInfo);
        if (!this.datasetInfo) {
            console.error('datasetInfo 为空，无法显示删除对话框');
            return;
        }

        const datasetName = this.datasetInfo.name || this.datasetInfo.datasetName || '未命名';
        const version = this.datasetInfo.version || 'v1.0.0';

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
        console.log('performDelete 被调用, datasetInfo:', this.datasetInfo);
        try {
            const token = localStorage.getItem('token');
            const datasetId = this.datasetInfo.id || this.datasetInfo.datasetId;
            console.log('准备删除数据集, datasetId:', datasetId, 'token:', token ? '存在' : '不存在');

            const response = await fetch(`/api/datasets/${datasetId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('删除失败');
            }

            this.dispatchEvent(new CustomEvent('show-toast', {
                bubbles: true,
                composed: true,
                detail: { message: '数据集删除成功', type: 'success' }
            }));

            this.dispatchEvent(new CustomEvent('dataset-deleted', {
                bubbles: true,
                composed: true,
                detail: { datasetId }
            }));

            this.hide();

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
