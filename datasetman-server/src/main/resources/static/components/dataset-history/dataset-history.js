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
                    height: 600px;
                    width: 100%;
                    padding: var(--spacing-md);
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
                    
                    <!-- 下半部分：版本历史区域 -->
                    <div class="version-history-section">
                        <div class="section-title">版本历史</div>
                        <div class="horizontal-timeline" id="timelineList">
                            <!-- 时间线项目将通过JS动态生成 -->
                        </div>
                    </div>
                </div>
                
                <!-- 第二个card：血缘图谱 -->
                <div class="dataset-lineage-card">
                    <div class="lineage-header">血缘图谱</div>
                    <div class="lineage-container">
                        <div id="lineageGraph" class="graph-placeholder">
                            血缘图谱加载中...
                        </div>
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
    }

    show(dataset) {
        this.datasetInfo = dataset;
        this.setAttribute('show', '');
        this.renderOverview();
        this.loadHistory();
        this.renderLineageGraph();
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
        if (this._timelineChart) {
            this._timelineChart.dispose();
            this._timelineChart = null;
        }
        if (this._timelineResizeObserver) {
            this._timelineResizeObserver.disconnect();
            this._timelineResizeObserver = null;
        }
    }

    renderOverview() {
        if (!this.datasetInfo) return;

        const datasetName = this.datasetInfo.name || this.datasetInfo.datasetName || '-';
        
        const nameEl = this.shadowRoot.querySelector('#datasetName');
        const createTimeEl = this.shadowRoot.querySelector('#createTime');
        const updateTimeEl = this.shadowRoot.querySelector('#updateTime');
        const sqlEl = this.shadowRoot.querySelector('#datasetSql');
        const developerEl = this.shadowRoot.querySelector('#developer');
        const versionEl = this.shadowRoot.querySelector('#version');

        if (nameEl) nameEl.textContent = datasetName;
        if (createTimeEl) createTimeEl.textContent = this.datasetInfo.createTime || '-';
        if (updateTimeEl) updateTimeEl.textContent = this.datasetInfo.updateTime || '-';
        if (sqlEl) sqlEl.textContent = this.datasetInfo.sql || '-';
        if (developerEl) developerEl.textContent = this.datasetInfo.developer || this.datasetInfo.creator || 'admin';
        if (versionEl) versionEl.textContent = this.datasetInfo.version || 'v1.0.0';
    }

    async loadHistory() {
        // 使用ECharts渲染版本历史时间线
        this.renderVersionTimeline();
    }

    renderVersionTimeline() {
        const timelineContainer = this.shadowRoot.querySelector('#timelineList');
        if (!timelineContainer || typeof echarts === 'undefined') {
            if (timelineContainer) {
                timelineContainer.innerHTML = '<div class="empty-state">图表库加载失败</div>';
            }
            return;
        }

        // 清除之前的图表实例
        const existingChart = echarts.getInstanceByDom(timelineContainer);
        if (existingChart) {
            existingChart.dispose();
        }

        timelineContainer.innerHTML = '';

        // 延迟初始化以确保容器有正确尺寸
        setTimeout(() => {
            const chart = echarts.init(timelineContainer);

            // 分支数据：漫威TVA风格的时间线
            const nodes = [
                { id: 'V1', name: 'V1', x: 0, y: 0, symbolSize: 20, itemStyle: { color: '#1890ff' },
                  time: '2025-04-07 10:00', user: 'engineer', ip: '192.168.1.10',
                  job: 'transform_task_001', func: 'data_clean()', sql: 'CREATE TABLE dataset02', change: '数据集初始化创建' },
                { id: 'V2', name: 'V2', x: 100, y: 0, symbolSize: 20, itemStyle: { color: '#1890ff' },
                  time: '2025-04-07 10:10', user: 'system', ip: '10.0.0.1',
                  job: 'transform_udf_upgrade', func: 'filter_null()', sql: 'ALTER TABLE dataset02 ADD COLUMN status', change: 'UDF升级，新增空值过滤' },
                { id: 'V3', name: 'V3', x: 200, y: 50, symbolSize: 20, itemStyle: { color: '#52c41a' },
                  time: '2025-04-07 10:20', user: 'engineer', ip: '192.168.1.10',
                  job: 'transform_data_refresh', func: 'refresh_data()', sql: 'INSERT OVERWRITE dataset02', change: '全量数据刷新' },
                { id: 'V4', name: 'V4', x: 200, y: -50, symbolSize: 20, itemStyle: { color: '#faad14' },
                  time: '2025-04-07 10:30', user: 'admin', ip: '192.168.1.100',
                  job: 'transform_schema_optimize', func: 'optimize_schema()', sql: 'OPTIMIZE TABLE dataset02', change: '表结构优化，增加索引' },
                { id: 'V5', name: 'V5', x: 300, y: 50, symbolSize: 20, itemStyle: { color: '#52c41a' },
                  time: '2025-04-07 10:40', user: 'algorithm', ip: '192.168.1.11',
                  job: 'transform_feature_extract', func: 'feature_extract()', sql: 'SELECT feature(*) FROM dataset02', change: '特征提取功能' },
                { id: 'V6', name: 'V6', x: 300, y: -50, symbolSize: 20, itemStyle: { color: '#faad14' },
                  time: '2025-04-07 10:50', user: 'analyst', ip: '192.168.1.12',
                  job: 'transform_stat_calc', func: 'stat_calc()', sql: 'CREATE TABLE dataset05 AS SELECT * FROM dataset04', change: '生成业务统计结果' },
                { id: 'V7', name: 'V7', x: 400, y: 0, symbolSize: 20, itemStyle: { color: '#722ed1' },
                  time: '2025-04-07 11:00', user: 'admin', ip: '192.168.1.100',
                  job: 'merge_branches', func: 'merge()', sql: 'MERGE INTO dataset02', change: '合并所有分支' }
            ];

            const links = [
                { source: 'V1', target: 'V2', lineStyle: { color: '#1890ff', curveness: 0 } },
                { source: 'V2', target: 'V3', lineStyle: { color: '#52c41a', curveness: 0.3 } },
                { source: 'V2', target: 'V4', lineStyle: { color: '#faad14', curveness: -0.3 } },
                { source: 'V3', target: 'V5', lineStyle: { color: '#52c41a', curveness: 0 } },
                { source: 'V4', target: 'V6', lineStyle: { color: '#faad14', curveness: 0 } },
                { source: 'V5', target: 'V7', lineStyle: { color: '#722ed1', curveness: -0.3 } },
                { source: 'V6', target: 'V7', lineStyle: { color: '#722ed1', curveness: 0.3 } }
            ];

            const option = {
                title: {
                    text: `数据集 ${this.datasetInfo?.name || 'dataset02'} 版本变更时间线`,
                    left: 'center',
                    textStyle: {
                        fontSize: 14,
                        fontWeight: 'normal',
                        color: '#1f2329'
                    }
                },
                tooltip: {
                    formatter: function(params) {
                        if (params.dataType === 'edge') {
                            return '版本流转';
                        }
                        const d = params.data;
                        return `版本：${d.name}<br>
时间：${d.time}<br>
操作人：${d.user}<br>
IP：${d.ip}<br>
Transform作业：${d.job}<br>
UDF函数：${d.func}<br>
SQL：${d.sql}<br>
变化：${d.change}`;
                    }
                },
                xAxis: { show: false },
                yAxis: { show: false },
                series: [{
                    type: 'graph',
                    layout: 'none',
                    symbolSize: 25,
                    roam: true,
                    label: {
                        show: true,
                        fontSize: 12,
                        fontWeight: 'bold',
                        color: '#1f2329'
                    },
                    edgeSymbol: ['circle', 'arrow'],
                    edgeSymbolSize: [4, 10],
                    edgeLabel: {
                        fontSize: 10
                    },
                    data: nodes,
                    links: links,
                    lineStyle: {
                        width: 2,
                        opacity: 0.8
                    }
                }]
            };

            chart.setOption(option);

            // 监听容器尺寸变化
            const resizeObserver = new ResizeObserver(() => {
                chart.resize();
            });
            resizeObserver.observe(timelineContainer);

            // 存储图表实例和观察器以便清理
            this._timelineChart = chart;
            this._timelineResizeObserver = resizeObserver;
        }, 100);
    }

    renderLineageGraph() {
        const graphContainer = this.shadowRoot.querySelector('#lineageGraph');
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

            const option = {
                tooltip: {
                    formatter: function(params) {
                        if (params.dataType === 'edge') {
                            return `UDF函数：${params.data.func}
Transform作业：${params.data.job}
SQL：${params.data.sql}
操作人：${params.data.user}
时间：${params.data.time}
IP：${params.data.ip}
变化：${params.data.change}`;
                        }
                        return params.name;
                    }
                },
                series: [{
                    type: 'graph',
                    layout: 'force',
                    symbolSize: 50,
                    roam: true,
                    label: { show: true, fontSize: 12 },
                    edgeSymbol: ['none', 'arrow'],
                    edgeSymbolSize: [0, 10],
                    edgeLabel: { show: true, formatter: '{c}', fontSize: 10 },
                    force: { repulsion: 800, edgeLength: 200 },
                    data: [
                        { name: 'dataset01' },
                        { name: 'dataset02' },
                        { name: 'dataset03' },
                        { name: 'dataset04' },
                        { name: 'dataset05' }
                    ],
                    links: [
                        {
                            source: 'dataset01', target: 'dataset02', value: 'UDF清洗',
                            func: 'data_clean()', job: 'transform_task_001', sql: 'SELECT clean(*) FROM dataset01',
                            user: 'engineer', time: '2025-04-07 10:00', ip: '192.168.1.10', change: '空值过滤、格式标准化'
                        },
                        {
                            source: 'dataset02', target: 'dataset03', value: 'UDF特征提取',
                            func: 'feature_extract()', job: 'transform_task_002', sql: 'SELECT feature(*) FROM dataset02',
                            user: 'algorithm', time: '2025-04-07 11:00', ip: '192.168.1.11', change: '提取数据特征'
                        },
                        {
                            source: 'dataset03', target: 'dataset04', value: 'Transform归一化',
                            func: 'normalize()', job: 'transform_task_003', sql: 'INSERT INTO dataset04 SELECT * FROM dataset03',
                            user: 'system', time: '2025-04-07 12:00', ip: '10.0.0.1', change: '数据归一化处理'
                        },
                        {
                            source: 'dataset04', target: 'dataset05', value: 'UDF统计计算',
                            func: 'stat_calc()', job: 'transform_task_004', sql: 'CREATE TABLE dataset05 AS SELECT * FROM dataset04',
                            user: 'analyst', time: '2025-04-07 14:00', ip: '192.168.1.12', change: '生成业务统计结果'
                        }
                    ]
                }]
            };

            chart.setOption(option);

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
