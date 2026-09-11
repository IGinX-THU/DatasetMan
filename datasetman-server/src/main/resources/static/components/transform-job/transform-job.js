class TransformJob extends HTMLElement {
    constructor() {
        super();
        this.data = [];
        this.pageSize = 10;
        this.currentPage = 1;
        this.htmlLoaded = false;
        this.pendingJobName = null;
    }

    connectedCallback() {
        this.style.display = 'none'; // 默认隐藏
        
        this.innerHTML = `
            <link rel="stylesheet" href="./components/transform-job/transform-job.css">
            <link rel="stylesheet" href="./components/common-pagination/common-pagination.css">
        `;
        
        // 加载HTML内容
        fetch('./components/transform-job/transform-job.html')
            .then(response => response.text())
            .then(html => {
                this.innerHTML += html;
                this.htmlLoaded = true;
                this.bindEvents();
                this.initPagination();
                
                const modalMask = this.querySelector('#modalMask');
                if (modalMask) {
                    modalMask.hidden = true;
                    modalMask.style.display = 'none';
                }
            });
    }

    async loadJobsFromAPI() {
        try {
            // 获取筛选条件
            const nameFilter = this.querySelector('.filter-input[type="text"]')?.value.trim();
            const statusFilter = this.querySelector('select.filter-input')?.value;

            // 构建请求对象
            const requestBody = {
                pageNum: this.currentPage || 1,
                pageSize: this.pageSize || 10,
                name: nameFilter || null,
                jobState: statusFilter ? parseInt(statusFilter) : null
            };

            console.log('查询参数:', requestBody);
            
            // 调用查询接口
            const result = await window.AppConfig.post('transformJob', 'query', requestBody);
            console.log('查询结果:', result);
            
            if (result.success && result.data) {
                // 后端直接返回List<TransformJobEntity>，转换为前端所需格式
                this.data = result.data.map(job => ({
                    id: job.id, // 使用id作为唯一标识
                    jobId: job.jobId,
                    name: job.name,
                    exportFile: job.exportFiletName,
                    schedule: job.schedule,
                    jobState: job.jobState,
                    createTime: job.createTime,
                    createtime: new Date(job.createTime).toLocaleString('zh-CN')
                }));
                
                // 同时获取总数用于分页（仅在第一页时）
                if (this.currentPage === 1) {
                    await this.loadJobsCount(nameFilter, statusFilter);
                }
                
                console.log('加载的作业数据:', this.data);
                console.log('当前totalCount:', this.totalCount);
                
                // 渲染表格
                this.renderTable();
            } else {
                console.error('加载作业失败:', result.message);
                this.showToast('加载作业失败', 'error');
            }
        } catch (error) {
            console.error('加载作业失败:', error);
            this.showToast('网络错误，无法加载作业', 'error');
        }
    }

    async loadJobsCount(name, status) {
        try {
            // 构建请求对象
            const requestBody = {
                name: name || null,
                jobState: status ? parseInt(status) : null
            };
            
            console.log('查询总量参数:', requestBody);
            
            const result = await window.AppConfig.post('transformJob', 'count', requestBody);
            console.log('总量查询结果:', result);
            
            if (result.success && result.data !== undefined) {
                this.totalCount = result.data;
                this.updatePagination();
            } else {
                console.warn('获取数据总量失败，使用当前数据量');
                this.totalCount = this.data.length;
            }
        } catch (error) {
            console.error('获取数据总量失败:', error);
            this.totalCount = this.data.length;
        }
    }



    bindEvents() {
        const applyFilters = this.querySelector('#applyFilters');
        const resetFilters = this.querySelector('#resetFilters');

        if (resetFilters) {
            resetFilters.addEventListener('click', () => {
                const filterInput = this.querySelector('.filter-input');
                if (filterInput) {
                    filterInput.value = '';
                }
                this.currentPage = 1;
                this.loadJobsFromAPI();
            });
        }

        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.currentPage = 1;
                this.loadJobsFromAPI();
            });
        }

        // Process modal close button
        const closeProcessModal = this.querySelector('#closeProcessModal');
        const processModal = this.querySelector('#processModal');
        if (closeProcessModal && processModal) {
            closeProcessModal.addEventListener('click', () => {
                processModal.hidden = true;
            });
        }

        // Event delegation for refresh, cancel and process buttons
        const tbody = this.querySelector('#tableBody');
        if (tbody) {
            tbody.addEventListener('click', async (e) => {
                const refreshBtn = e.target.closest('.action-btn.refresh');
                const cancelBtn = e.target.closest('.action-btn.cancel');
                const processBtn = e.target.closest('.action-btn.process');

                if (refreshBtn) {
                    const jobId = refreshBtn.dataset.jobId;
                    if (jobId) {
                        await this.refreshJobStatus(jobId);
                    }
                }

                if (cancelBtn) {
                    const jobId = cancelBtn.dataset.jobId;
                    if (jobId) {
                        await this.cancelJob(jobId);
                    }
                }

                if (processBtn) {
                    const jobId = processBtn.dataset.jobId;
                    if (jobId) {
                        await this.showProcessGraph(jobId);
                    }
                }
            });
        }
    }

    updatePagination() {
        const pagination = this.querySelector('#pagination');
        if (pagination && typeof pagination.setPagination === 'function') {
            pagination.setPagination(this.currentPage, this.pageSize, this.totalCount);
        }
    }

    initPagination() {
        const pagination = this.querySelector('#pagination');
        if (pagination) {
            pagination.addEventListener('pagination-change', (e) => {
                this.currentPage = e.detail.currentPage;
                this.loadJobsFromAPI();
            });
        }
    }

    // 添加show方法供main.js调用
    async show(...args) {
        console.log('TransformJob show() 被调用', args);
        this.style.display = 'block';
        // 重置分页到第一页
        this.currentPage = 1;
        
        // 等待HTML加载完成
        if (!this.htmlLoaded) {
            console.log('等待HTML加载...');
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (this.htmlLoaded) {
                        clearInterval(checkInterval);
                        console.log('HTML加载完成');
                        resolve();
                    }
                }, 50);
            });
        }
        
        // 如果传入了作业名称参数，填充到筛选框
        if (args.length > 0 && args[0]) {
            const filterInput = this.querySelector('#jobNameFilter');
            if (filterInput) {
                filterInput.value = args[0];
                console.log('设置筛选条件:', args[0], '当前值:', filterInput.value);
            } else {
                console.error('未找到jobNameFilter元素');
            }
        }
        
        // 每次显示时刷新数据
        console.log('开始加载数据...');
        await this.loadJobsFromAPI();
    }

    hide() {
        this.style.display = 'none';
    }

    renderTable() {
        const tbody = this.querySelector('#tableBody');
        if (!tbody) return;

        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #6b7280;">
                        暂无作业数据
                    </td>
                </tr>
            `;
            return;
        }

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

        tbody.innerHTML = this.data.map(job => {
            // 只有正在运行或等待运行的任务才能取消
            const canCancel = [2, 3, 4, 5].includes(job.jobState);
            const cancelBtn = canCancel
                ? `<button class="action-btn cancel" data-job-id="${job.jobId}" data-create-time="${job.createTime}">取消</button>`
                : '';

            return `
            <tr data-id="${job.createTime}">
                <td>${job.jobId || '-'}</td>
                <td>${statusMap[job.jobState] || '未知'}</td>
                <td>${job.name}</td>
                <td>${job.exportFile || '-'}</td>
                <td>${job.schedule || '-'}</td>
                <td>${job.createtime}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn process" data-job-id="${job.jobId}" data-create-time="${job.createTime}">变化过程</button>
                        <button class="action-btn refresh" data-job-id="${job.jobId}" data-create-time="${job.createTime}">刷新状态</button>
                        ${cancelBtn}
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }


    showToast(message, type = 'success') {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }

    async refreshJobStatus(jobId) {
        try {
            const url = window.AppConfig.api.baseURL + `/api/transform-job/status/${jobId}`;
            const result = await window.AppConfig.request(url, { method: 'GET' });
            if (result.success) {
                this.showToast('状态刷新成功', 'success');
                // Reload the data to show updated status
                await this.loadJobsFromAPI();
            } else {
                this.showToast(result.message || '状态刷新失败', 'error');
            }
        } catch (error) {
            console.error('刷新状态失败:', error);
            this.showToast('网络错误，无法刷新状态', 'error');
        }
    }

    async cancelJob(jobId) {
        try {
            const url = window.AppConfig.api.baseURL + `/api/transform-job/cancel/${jobId}`;
            const result = await window.AppConfig.request(url, { method: 'PUT' });
            if (result.success) {
                this.showToast('任务已取消', 'success');
                // Reload the data to show updated status
                await this.loadJobsFromAPI();
            } else {
                this.showToast(result.message || '取消任务失败', 'error');
            }
        } catch (error) {
            console.error('取消任务失败:', error);
            this.showToast('网络错误，无法取消任务', 'error');
        }
    }

    async showProcessGraph(jobId) {
        try {
            // Get job details from API
            const url = window.AppConfig.api.baseURL + `/api/transform-job/detail/${jobId}`;
            const result = await window.AppConfig.request(url, { method: 'GET' });
            
            if (result.success && result.data) {
                const job = result.data;
                this._currentJob = job; // Store job data for edge popup
                const processModal = this.querySelector('#processModal');
                const processGraph = this.querySelector('#processGraph');
                
                if (processModal && processGraph) {
                    processModal.hidden = false;
                    this.renderProcessGraph(job, processGraph);
                }
            } else {
                this.showToast('获取作业详情失败', 'error');
            }
        } catch (error) {
            console.error('获取作业详情失败:', error);
            this.showToast('网络错误，无法获取作业详情', 'error');
        }
    }

    renderProcessGraph(job, container) {
        // Parse taskList
        const taskList = job.taskList ? JSON.parse(job.taskList) : [];
        
        if (taskList.length === 0) {
            container.innerHTML = '<div class="graph-placeholder">暂无任务数据</div>';
            return;
        }

        // Clear previous chart
        const existingChart = echarts.getInstanceByDom(container);
        if (existingChart) {
            existingChart.dispose();
        }
        container.innerHTML = '';

        // Build nodes and links for the graph
        const nodes = [];
        const links = [];
        let nodeId = 0;

        // Add output node with job data, label depends on exportType
        // exportType: 0=none, 1=file, 2=IGinX
        const exportType = job.exportType != null ? Number(job.exportType) : 1;
        let outputLabel = '结果集: 文件';
        let outputName = '文件';
        if (exportType === 0) {
            outputLabel = '结果集: 日志(log)';
            outputName = '日志(log)';
        } else if (exportType === 2) {
            outputLabel = '结果集: IGinX(transform.*)';
            outputName = 'IGinX(transform.*)';
        } else if (exportType === 1 && job.exportFiletName) {
            outputLabel = `结果集: 文件(${job.exportFiletName})`;
            outputName = `文件(${job.exportFiletName})`;
        }
        const outputNodeId = nodeId++;
        const lines = outputLabel.split('\n');
        const maxLineLength = Math.max(...lines.map(line => line.length));
        const width = maxLineLength * 9 + 40;
        const height = lines.length * 18 + 30;
        nodes.push({
            id: outputNodeId,
            name: outputName,
            type: 'output',
            datasetType: '结果集',
            itemStyle: { color: '#F44336', borderColor: '#F44336' },
            symbolSize: [width, height],
            jobData: job
        });

        // Process each task and build nodes in order
        let previousNodeId = null;
        taskList.forEach((task, index) => {
            const taskType = task.taskType === 1 || task.taskType === 'PYTHON' ? 'python' : 'iginx';
            let currentNodeId = null;
            
            // If it's an iginx task with dataset, use dataset node directly
            if (taskType === 'iginx' && task.dataset) {
                const datasetNodeId = nodeId++;
                currentNodeId = datasetNodeId;
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
                    taskData: task
                });
            }
            // If it's a python task, use task node
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
                    taskData: task
                });
            }

            // Connect to previous node if exists
            if (previousNodeId !== null && currentNodeId !== null) {
                links.push({
                    source: previousNodeId,
                    target: currentNodeId,
                    jobData: this._currentJob
                });
            }

            // Update previous node
            previousNodeId = currentNodeId;
        });

        // Connect last node to output
        if (previousNodeId !== null) {
            links.push({
                source: previousNodeId,
                target: outputNodeId
            });
        }

        // Initialize ECharts with force layout (like lineage graph)
        setTimeout(() => {
            const chart = echarts.init(container);

            const option = {
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
                                const exportType = job.exportType != null ? Number(job.exportType) : 1;
                                if (exportType === 0) return '结果集: 日志(log)';
                                if (exportType === 2) return '结果集: IGinX(transform.*)';
                                return `结果集: 文件(${job.exportFiletName || ''})`;
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
                    edgeSymbol: ['none', 'arrow'],
                    edgeSymbolSize: [0, 15],
                    lineStyle: { 
                        color: '#2196F3', 
                        width: 1.8, 
                        curveness: 0.1, 
                        opacity: 0.8 
                    },
                    data: nodes,
                    links: links
                }]
            };

            chart.setOption(option);

            // Click event: show popup
            chart.on('click', (params) => {
                if (params.dataType === 'edge' || (params.data && params.data.type === 'output')) {
                    this.showJobPopup(params, container);
                } else {
                    this.showProcessPopup(params, container);
                }
            });

            // Resize handler
            const resizeObserver = new ResizeObserver(() => {
                chart.resize();
            });
            resizeObserver.observe(container);

            // Store for cleanup
            container._chart = chart;
            container._resizeObserver = resizeObserver;
        }, 100);
    }

    showJobPopup(params, container) {
        // Remove old popup
        var oldPopup = document.querySelector('.data-popup');
        if (oldPopup) oldPopup.remove();

        // Get job data from the output node
        const job = this._currentJob;
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
        const exportTypeMap = { 0: 'none', 1: 'file', 2: 'IGinX' };
        const exportType = job.exportType != null ? Number(job.exportType) : 1;

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
                    <label class="field-label" style="display:inline-block;width:100px;color:#666;font-weight:600;">输出目标：</label>
                    <span class="field-value">${exportTypeMap[exportType] || '-'}</span>
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

    showProcessPopup(params, container) {
        // Remove old popup
        var oldPopup = document.querySelector('.data-popup');
        if (oldPopup) oldPopup.remove();
        if (!params.data) return;

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

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('transform-job', TransformJob);
