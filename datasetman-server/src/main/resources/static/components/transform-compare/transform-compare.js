class TransformCompare extends HTMLElement {
    constructor() {
        super();
        this.data = [];
        this.pageSize = 10;
        this.currentPage = 1;
        this.currentAction = 'add';
        this.editingJobId = null;
    }

    connectedCallback() {
        console.log('TransformCompare connectedCallback 被调用');
        this.style.display = 'none'; // 默认隐藏
        
        this.innerHTML = `
            <link rel="stylesheet" href="./components/transform-compare/transform-compare.css">
            <link rel="stylesheet" href="./components/common-pagination/common-pagination.css">
        `;
        
        // 加载HTML内容
        fetch('./components/transform-compare/transform-compare.html')
            .then(response => response.text())
            .then(html => {
                this.innerHTML += html;
                console.log('TransformCompare HTML 加载完成');
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

            // 构建请求对象
            const requestBody = {
                pageNum: this.currentPage || 1,
                pageSize: this.pageSize || 10,
                name: nameFilter || null
            };

            console.log('查询参数:', requestBody);
            
            // 调用查询接口
            const result = await window.AppConfig.post('transformCompare', 'query', requestBody);
            console.log('查询结果:', result);
            
            if (result.success && result.data) {
                // 后端直接返回List<TransformCompareEntity>，转换为前端所需格式
                this.data = result.data.map(job => ({
                    id: job.id, // 使用id作为唯一标识
                    name: job.name,
                    exportFile: job.exportFile,
                    schedule: job.schedule,
                    createTime: job.createTime,
                    createtime: new Date(job.createTime).toLocaleString('zh-CN')
                }));
                
                // 同时获取总数用于分页（仅在第一页时）
                if (this.currentPage === 1) {
                    await this.loadJobsCount(nameFilter);
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

    async loadJobsCount(name) {
        try {
            // 构建请求对象
            const requestBody = {
                name: name || null
            };
            
            console.log('查询总量参数:', requestBody);
            
            const result = await window.AppConfig.post('transformCompare', 'count', requestBody);
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

    async deleteJobFromAPI(createTime) {
        try {
            const result = await window.AppConfig.delete('transformCompare', 'delete', { createTime });

            if (result.success) {
                this.showToast('作业已删除');
                this.loadJobsFromAPI();
            } else {
                this.showToast(result.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除作业失败:', error);
            this.showToast('网络错误，删除失败', 'error');
        }
    }

    async commitJobFromAPI(createTime) {
        try {
            const url = window.AppConfig.getApiUrl('transformJob', 'commit').replace('{createTime}', createTime);
            const headers = window.AppConfig.getAuthHeaders();

            const response = await fetch(url, {
                method: 'PUT',
                headers: headers
            });

            const result = await response.json();

            if (result.code === 200 || result.success) {
                this.showToast('任务已提交');
                await this.loadJobsFromAPI();
            } else {
                this.showToast(result.message || '提交失败', 'error');
            }
        } catch (error) {
            console.error('提交任务失败:', error);
            this.showToast('网络错误，提交失败', 'error');
        }
    }

    getJobNameByCreateTime(createTime) {
        const job = this.data.find(j => j.createTime == createTime);
        return job ? job.name : '';
    }

    navigateToTransformJob(jobName) {
        console.log('navigateToTransformJob 被调用，作业名称:', jobName);
        // 隐藏当前组件
        this.hide();
        
        // 显示transform-job组件并传递作业名称参数
        if (typeof window.showComponent === 'function') {
            console.log('调用 window.showComponent');
            window.showComponent('transformJob', jobName);
        } else {
            console.error('window.showComponent函数未找到');
        }
    }

    bindEvents() {
        console.log('TransformCompare bindEvents 被调用');
        const addJobBtn = this.querySelector('#addJobBtn');
        const modalClose = this.querySelector('#modalClose');
        const modalMask = this.querySelector('#modalMask');
        const applyFilters = this.querySelector('#applyFilters');
        const resetFilters = this.querySelector('#resetFilters');

        console.log('查找元素:', {
            addJobBtn: !!addJobBtn,
            modalClose: !!modalClose,
            modalMask: !!modalMask,
            applyFilters: !!applyFilters,
            resetFilters: !!resetFilters
        });

        if (addJobBtn) {
            addJobBtn.addEventListener('click', () => this.showAddModal());
        }

        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideModal());
        }

        if (modalMask) {
            modalMask.addEventListener('click', (e) => {
                if (e.target === modalMask) {
                    this.hideModal();
                }
            });
        }

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
        // 每次显示时刷新数据
        await this.loadJobsFromAPI();
        this.renderTable();
    }

    hide() {
        this.style.display = 'none';
    }

    renderTable() {
        console.log('renderTable 被调用，数据条数:', this.data.length);
        const tbody = this.querySelector('#tableBody');
        if (!tbody) return;

        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #6b7280;">
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
            5: '失败中',
            6: '失败',
            7: '取消中',
            8: '取消'
        };

        tbody.innerHTML = this.data.map(job => `
            <tr data-id="${job.createTime}">
                <td>${job.name}</td>
                <td>${job.exportFile || '-'}</td>
                <td>${job.schedule || '-'}</td>
                <td>${job.createtime}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn run" data-id="${job.createTime}">提交</button>
                        <button class="action-btn manage" data-name="${job.name}">管理</button>
                        <button class="action-btn edit" data-id="${job.createTime}">编辑</button>
                        <button class="action-btn delete" data-id="${job.createTime}">删除</button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.addEventListener('click', (e) => {
            console.log('表格点击事件触发，目标:', e.target, '类名:', e.target.className);
            const id = e.target.getAttribute('data-id');
            const name = e.target.getAttribute('data-name');
            console.log('data-id:', id, 'data-name:', name);
            
            if (e.target.classList.contains('edit')) {
                this.showEditModal(id);
            } else if (e.target.classList.contains('run')) {
                this.showRunConfirm(id);
            } else if (e.target.classList.contains('delete')) {
                this.showDeleteConfirm(id);
            } else if (e.target.classList.contains('manage')) {
                console.log('检测到管理按钮点击');
                this.navigateToTransformJob(name);
            }
        });
    }

    showAddModal() {
        this.currentAction = 'add';
        this.editingJobId = null;
        const dialogHtml = `
            <div class="dialog-mask" style="
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            ">
                <div class="dialog-content" style="
                    background: white;
                    border-radius: 12px;
                    max-width: 1000px;
                    width: 95%;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    max-height: 90vh;
                    overflow: hidden;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                ">
                    <div class="dialog-header" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 24px 32px;
                        border-bottom: 1px solid #e5e7eb;
                        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    ">
                        <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: #1e293b;">新增作业</h3>
                        <button class="dialog-close-btn" style="
                            background: none;
                            border: none;
                            font-size: 24px;
                            color: #64748b;
                            cursor: pointer;
                            padding: 8px;
                            width: 40px;
                            height: 40px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 8px;
                            transition: all 0.2s ease;
                        ">&times;</button>
                    </div>
                    <div class="dialog-body" style="
                        flex: 1;
                        padding: 32px;
                        overflow-y: auto;
                        background: #fafbfc;
                    ">
                        ${this.getJobFormHTML()}
                    </div>
                    <div class="dialog-actions" style="
                        display: flex;
                        justify-content: center;
                        gap: 16px;
                        padding: 24px 32px;
                        border-top: 1px solid #e5e7eb;
                        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    ">
                        <button type="button" class="cancel-btn" style="
                            padding: 12px 32px;
                            border-radius: 8px;
                            font-size: 15px;
                            font-weight: 600;
                            cursor: pointer;
                            border: 2px solid #e5e7eb;
                            background: white;
                            color: #64748b;
                            transition: all 0.2s ease;
                            letter-spacing: 0.025em;
                            min-width: 120px;
                        ">取消</button>
                        <button type="button" class="confirm-btn" style="
                            padding: 12px 32px;
                            border-radius: 8px;
                            font-size: 15px;
                            font-weight: 600;
                            cursor: pointer;
                            border: 2px solid #3b82f6;
                            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                            color: white;
                            box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
                            transition: all 0.2s ease;
                            letter-spacing: 0.025em;
                            min-width: 120px;
                        ">确定</button>
                    </div>
                </div>
            </div>
        `;

        // 移除任何已存在的dialog
        const existingDialogs = document.querySelectorAll('.dialog-mask');
        existingDialogs.forEach(d => {
            if (d.parentNode) {
                d.parentNode.removeChild(d);
            }
        });

        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);

        const dialogMask = dialog.querySelector('.dialog-mask');
        const dialogContent = dialog.querySelector('.dialog-content');
        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const closeBtn = dialog.querySelector('.dialog-close-btn');
        const form = dialog.querySelector('#jobForm');
        const addTaskBtn = dialog.querySelector('#addTask');
        const tasksList = dialog.querySelector('#tasksList');

        // 阻止dialog-content点击事件冒泡到dialog-mask
        if (dialogContent) {
            dialogContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // 阻止表单默认提交行为
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
            });
        }

        // Schedule编辑器事件绑定
        const scheduleEditor = form.querySelector('#scheduleEditor');
        const scheduleInput = form.querySelector('#schedule');
        if (scheduleEditor && scheduleInput) {
            // 设置初始值
            if (scheduleInput.value) {
                scheduleEditor.setValue(scheduleInput.value);
            }
            // 监听schedule变化
            scheduleEditor.addEventListener('schedule-change', (e) => {
                scheduleInput.value = e.detail.schedule;
            });
        }

        // 导出类型变化事件绑定
        const exportTypeSelect = form.querySelector('#exportType');
        const exportFileRow = form.querySelector('#exportFileRow');
        if (exportTypeSelect && exportFileRow) {
            exportTypeSelect.addEventListener('change', (e) => {
                const exportType = parseInt(e.target.value);
                exportFileRow.style.display = exportType === 1 ? 'block' : 'none';
                const exportFileInput = form.querySelector('#exportFile');
                if (exportFileInput) {
                    exportFileInput.required = exportType === 1;
                }
            });
        }

        if (addTaskBtn && tasksList) {
            addTaskBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const taskRow = document.createElement('div');
                taskRow.className = 'task-card';
                taskRow.innerHTML = this.getTaskRowHTML({}, tasksList.children.length);
                tasksList.appendChild(taskRow);
                this.bindTaskRowEvents(taskRow);
                this.updateTaskButtons();
            });
        }

        if (tasksList) {
            Array.from(tasksList.children).forEach(row => {
                this.bindTaskRowEvents(row);
            });
        }

        const closeDialog = () => {
            try {
                if (dialog && dialog.parentNode) {
                    dialog.parentNode.removeChild(dialog);
                }
            } catch (e) {
                console.error('关闭弹窗失败:', e);
            }
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeDialog);
        }

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', async () => {
            const jobName = form.querySelector('#jobName')?.value.trim();
            const exportType = parseInt(form.querySelector('#exportType')?.value);
            const exportFile = form.querySelector('#exportFile')?.value;
            const schedule = form.querySelector('#schedule')?.value.trim();
            const taskList = this.collectTasks(tasksList);

            if (!jobName || isNaN(exportType)) {
                this.showToast('请填写完整作业配置', 'error');
                return;
            }

            if (exportType === 1 && !exportFile) {
                this.showToast('请填写导出文件路径', 'error');
                return;
            }

            if (taskList.length === 0) {
                this.showToast('请至少添加一个任务', 'error');
                return;
            }

            for (const task of taskList) {
                if (task.taskType === null || task.taskType === undefined || !task.timeout) {
                    this.showToast('请填写完整任务信息', 'error');
                    return;
                }
                if (task.dataFlowType === null || task.dataFlowType === undefined) {
                    this.showToast('请填写数据流动方式', 'error');
                    return;
                }
                if (task.taskType === 1 && !task.pyTaskName) {
                    this.showToast('请选择Transform函数', 'error');
                    return;
                }
                if (task.taskType === 0 && !task.dataset) {
                    this.showToast('请选择数据集', 'error');
                    return;
                }
            }

            const jobData = {
                name: jobName,
                exportType: exportType,
                exportFile: exportType === 1 ? exportFile : null,
                schedule,
                taskList
            };

            console.log('Job data to save:', jobData);

            try {
                const result = await window.AppConfig.post('transformCompare', 'save', jobData);
                if (result.success) {
                    this.showToast('作业创建成功');
                    closeDialog();
                    this.loadJobsFromAPI();
                } else {
                    this.showToast(result.message || '作业创建失败', 'error');
                }
            } catch (error) {
                console.error('保存作业失败:', error);
                this.showToast('作业创建失败', 'error');
            }
        });
    }

    async showEditModal(createTime) {
        this.currentAction = 'edit';
        this.editingJobId = createTime;

        try {
            // 从API获取作业详情
            const result = await window.AppConfig.get('transformCompare', 'detail', { createTime });
            
            if (result.success && result.data) {
                const job = result.data;
                // 转换taskType和dataFlowType为字符串，以便前端回显
                const taskList = job.taskList ? JSON.parse(job.taskList).map(task => ({
                    ...task,
                    taskType: task.taskType === 1 ? 'python' : (task.taskType === 0 ? 'iginx' : ''),
                    dataFlowType: task.dataFlowType === 1 ? 'stream' : (task.dataFlowType === 0 ? 'batch' : '')
                })) : [];
                
                const frontendJob = {
                    id: job.id,
                    name: job.name,
                    exportType: job.exportType != null ? job.exportType : 0,
                    exportFile: job.exportFile,
                    schedule: job.schedule,
                    taskList: taskList
                };
                
                const dialogHtml = `
                    <div class="dialog-mask" style="
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2000;
                    ">
                        <div class="dialog-content" style="
                            background: white;
                            border-radius: 12px;
                            max-width: 1000px;
                            width: 95%;
                            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                            max-height: 90vh;
                            overflow: hidden;
                            position: relative;
                            display: flex;
                            flex-direction: column;
                        ">
                            <div class="dialog-header" style="
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                padding: 24px 32px;
                                border-bottom: 1px solid #e5e7eb;
                                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                            ">
                                <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: #1e293b;">编辑作业</h3>
                                <button class="dialog-close-btn" style="
                                    background: none;
                                    border: none;
                                    font-size: 24px;
                                    color: #64748b;
                                    cursor: pointer;
                                    padding: 8px;
                                    width: 40px;
                                    height: 40px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    border-radius: 8px;
                                    transition: all 0.2s ease;
                                ">&times;</button>
                            </div>
                            <div class="dialog-body" style="
                                flex: 1;
                                padding: 32px;
                                overflow-y: auto;
                                background: #fafbfc;
                            ">
                                ${this.getJobFormHTML(frontendJob)}
                            </div>
                            <div class="dialog-actions" style="
                                display: flex;
                                justify-content: center;
                                gap: 16px;
                                padding: 24px 32px;
                                border-top: 1px solid #e5e7eb;
                                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                            ">
                                <button type="button" class="cancel-btn" style="
                                    padding: 12px 32px;
                                    border-radius: 8px;
                                    font-size: 15px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    border: 2px solid #e5e7eb;
                                    background: white;
                                    color: #64748b;
                                    transition: all 0.2s ease;
                                    letter-spacing: 0.025em;
                                    min-width: 120px;
                                ">取消</button>
                                <button type="button" class="confirm-btn" style="
                                    padding: 12px 32px;
                                    border-radius: 8px;
                                    font-size: 15px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    border: 2px solid #3b82f6;
                                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                                    color: white;
                                    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
                                    transition: all 0.2s ease;
                                    letter-spacing: 0.025em;
                                    min-width: 120px;
                                ">保存</button>
                            </div>
                        </div>
                    </div>
                `;

                // 移除任何已存在的dialog
                const existingDialogs = document.querySelectorAll('.dialog-mask');
                existingDialogs.forEach(d => {
                    if (d.parentNode) {
                        d.parentNode.removeChild(d);
                    }
                });

                const dialog = document.createElement('div');
                dialog.innerHTML = dialogHtml;
                document.body.appendChild(dialog);

                const dialogMask = dialog.querySelector('.dialog-mask');
                const dialogContent = dialog.querySelector('.dialog-content');
                const cancelBtn = dialog.querySelector('.cancel-btn');
                const confirmBtn = dialog.querySelector('.confirm-btn');
                const closeBtn = dialog.querySelector('.dialog-close-btn');
                const form = dialog.querySelector('#jobForm');
                const addTaskBtn = dialog.querySelector('#addTask');
                const tasksList = dialog.querySelector('#tasksList');

                // 阻止dialog-content点击事件冒泡到dialog-mask
                if (dialogContent) {
                    dialogContent.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }

                // 阻止表单默认提交行为
                if (form) {
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                    });
                }

                // Schedule编辑器事件绑定
                const scheduleEditor = form.querySelector('#scheduleEditor');
                const scheduleInput = form.querySelector('#schedule');
                if (scheduleEditor && scheduleInput) {
                    // 设置初始值
                    if (scheduleInput.value) {
                        scheduleEditor.setValue(scheduleInput.value);
                    }
                    // 监听schedule变化
                    scheduleEditor.addEventListener('schedule-change', (e) => {
                        scheduleInput.value = e.detail.schedule;
                    });
                }

                // 导出类型变化事件绑定
                const exportTypeSelect = form.querySelector('#exportType');
                const exportFileRow = form.querySelector('#exportFileRow');
                if (exportTypeSelect && exportFileRow) {
                    exportTypeSelect.addEventListener('change', (e) => {
                        const exportType = parseInt(e.target.value);
                        exportFileRow.style.display = exportType === 1 ? 'block' : 'none';
                        const exportFileInput = form.querySelector('#exportFile');
                        if (exportFileInput) {
                            exportFileInput.required = exportType === 1;
                        }
                    });
                }

                if (addTaskBtn && tasksList) {
                    addTaskBtn.addEventListener('click', () => {
                        const taskRow = document.createElement('div');
                        taskRow.className = 'task-card';
                        taskRow.innerHTML = this.getTaskRowHTML({}, tasksList.children.length);
                        tasksList.appendChild(taskRow);
                        this.bindTaskRowEvents(taskRow);
                        this.updateTaskButtons();
                    });
                }

                if (tasksList) {
                    Array.from(tasksList.children).forEach(row => {
                        this.bindTaskRowEvents(row);
                    });
                }

                const closeDialog = () => {
                    document.body.removeChild(dialog);
                };

                if (closeBtn) {
                    closeBtn.addEventListener('click', closeDialog);
                }

                cancelBtn.addEventListener('click', closeDialog);

                confirmBtn.addEventListener('click', async () => {
                    const jobName = form.querySelector('#jobName')?.value.trim();
                    const exportType = parseInt(form.querySelector('#exportType')?.value);
                    const exportFile = form.querySelector('#exportFile')?.value;
                    const schedule = form.querySelector('#schedule')?.value.trim();
                    const taskList = this.collectTasks(tasksList);

                    if (!jobName || isNaN(exportType)) {
                        this.showToast('请填写完整作业配置', 'error');
                        return;
                    }

                    if (exportType === 1 && !exportFile) {
                        this.showToast('请填写导出文件路径', 'error');
                        return;
                    }

                    if (taskList.length === 0) {
                        this.showToast('请至少添加一个任务', 'error');
                        return;
                    }

                    for (const task of taskList) {
                        if (task.taskType === null || task.taskType === undefined || !task.timeout) {
                            this.showToast('请填写完整任务信息', 'error');
                            return;
                        }
                        if (task.dataFlowType === null || task.dataFlowType === undefined) {
                            this.showToast('请填写数据流动方式', 'error');
                            return;
                        }
                        if (task.taskType === 1 && !task.pyTaskName) {
                            this.showToast('请选择Transform函数', 'error');
                            return;
                        }
                        if (task.taskType === 0 && !task.dataset) {
                            this.showToast('请选择数据集', 'error');
                            return;
                        }
                    }

                    const jobData = {
                        createTime: createTime,
                        name: jobName,
                        exportType: exportType,
                        exportFile: exportType === 1 ? exportFile : null,
                        schedule,
                        taskList
                    };

                    console.log('Job data to update:', jobData);

                    try {
                        const result = await window.AppConfig.post('transformCompare', 'save', jobData);
                        if (result.success) {
                            this.showToast('作业更新成功');
                            this.loadJobsFromAPI();
                            closeDialog();
                        } else {
                            this.showToast(result.message || '作业更新失败', 'error');
                        }
                    } catch (error) {
                        console.error('更新作业失败:', error);
                        this.showToast('作业更新失败', 'error');
                    }
                });
            } else {
                this.showToast('获取作业详情失败', 'error');
            }
        } catch (error) {
            console.error('获取作业详情失败:', error);
            this.showToast('网络错误，无法获取作业详情', 'error');
        }
    }

    showDeleteConfirm(id) {
        const jobName = this.getJobNameByCreateTime(id);
        const dialogHtml = `
            <div class="dialog-mask" style="
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            ">
                <div class="dialog-content" style="
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                ">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">确认删除</h3>
                    <p style="margin: 0 0 24px 0; color: #646a73; line-height: 1.5;">
                        确定要删除作业 "${jobName}" 吗？<br><br>
                        <span style="color: #f5222d;">此操作不可恢复！</span>
                    </p>
                    <div class="dialog-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" class="cancel-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #c9cdd4;
                            border-radius: 4px;
                            background: white;
                            color: #1f2329;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button type="button" class="confirm-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #f5222d;
                            border-radius: 4px;
                            background: #f5222d;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                        ">确认删除</button>
                    </div>
                </div>
            </div>
        `;

        // 移除任何已存在的dialog
        const existingDialogs = document.querySelectorAll('.dialog-mask');
        existingDialogs.forEach(d => {
            if (d.parentNode) {
                d.parentNode.removeChild(d);
            }
        });

        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);

        const dialogMask = dialog.querySelector('.dialog-mask');
        const dialogContent = dialog.querySelector('.dialog-content');
        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');

        // 阻止dialog-content点击事件冒泡到dialog-mask
        if (dialogContent) {
            dialogContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        const closeDialog = () => {
            try {
                if (dialog && dialog.parentNode) {
                    dialog.parentNode.removeChild(dialog);
                }
            } catch (e) {
                console.error('关闭弹窗失败:', e);
            }
        };

        // 点击dialog-mask关闭对话框
        if (dialogMask) {
            dialogMask.addEventListener('click', closeDialog);
        }

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', async () => {
            try {
                await this.deleteJobFromAPI(id);
            } catch (error) {
                console.error('删除作业失败:', error);
            } finally {
                closeDialog();
            }
        });
    }

    showRunConfirm(id) {
        const jobName = this.getJobNameByCreateTime(id);

        // 移除任何已存在的dialog
        const existingDialogs = document.querySelectorAll('.dialog-mask');
        existingDialogs.forEach(d => {
            if (d.parentNode) {
                d.parentNode.removeChild(d);
            }
        });

        const dialogHtml = `
            <div class="dialog-mask" style="
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            ">
                <div class="dialog-content" style="
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                ">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">确认运行</h3>
                    <p style="margin: 0 0 24px 0; color: #646a73; line-height: 1.5;">
                        确定要运行作业 "${jobName}" 吗？
                    </p>
                    <div class="dialog-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" class="cancel-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #c9cdd4;
                            border-radius: 4px;
                            background: white;
                            color: #1f2329;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button type="button" class="confirm-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #3b82f6;
                            border-radius: 4px;
                            background: #3b82f6;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                        ">确认运行</button>
                    </div>
                </div>
            </div>
        `;

        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);

        const dialogMask = dialog.querySelector('.dialog-mask');
        const dialogContent = dialog.querySelector('.dialog-content');
        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');

        if (dialogContent) {
            dialogContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        const closeDialog = () => {
            try {
                if (dialog && dialog.parentNode) {
                    dialog.parentNode.removeChild(dialog);
                }
            } catch (e) {
                console.error('关闭弹窗失败:', e);
            }
        };

        if (dialogMask) {
            dialogMask.addEventListener('click', closeDialog);
        }

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', async () => {
            try {
                await this.commitJobFromAPI(id);
            } catch (error) {
                console.error('运行作业失败:', error);
            } finally {
                closeDialog();
            }
        });
    }

    getJobFormHTML(job = null) {
        const isEdit = job !== null;
        const isAdmin = window.MenuPermission?.getCurrentRole() === 'ADMIN';
        
        // 根据用户角色生成导出类型选项
        let exportTypeOptions = '';
        if (isAdmin) {
            exportTypeOptions = `
                <option value="0" ${job?.exportType === 0 ? 'selected' : ''}>none</option>
                <option value="2" ${job?.exportType === 2 ? 'selected' : ''}>IGinX</option>
                <option value="1" ${job?.exportType === 1 || job?.exportType === undefined || job?.exportType === null ? 'selected' : ''}>file</option>
            `;
        } else {
            exportTypeOptions = `
                <option value="0" ${job?.exportType === 0 ? 'selected' : ''}>none</option>
                <option value="1" ${job?.exportType === 1 || job?.exportType === undefined || job?.exportType === null ? 'selected' : ''}>file</option>
            `;
        }
        
        return `
            <form id="jobForm" class="job-form">
                <div class="form-section">
                    <div class="section-title">作业信息</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="jobName">作业名称 <span class="required">*</span></label>
                            <input type="text" id="jobName" name="jobName" placeholder="请输入作业名称" value="${job?.name || ''}" ${isEdit ? 'readonly' : ''} required>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <div class="params-block" style="margin-bottom: 32px; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                        <div class="params-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <span style="font-size: 16px; font-weight: 600; color: #1e293b;">任务列表</span>
                            <button type="button" class="add-btn" id="addTask" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; width: 32px; height: 32px; font-size: 18px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">+</button>
                        </div>
                        <div class="tasks-list" id="tasksList" style="display: flex; flex-direction: column; gap: 16px;">
                            ${job?.taskList?.map((task, index) => this.getTaskRowHTML(task, index, job.taskList.length)).join('') || ''}
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <div class="section-title">作业配置</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="exportType">输出目标 <span class="required">*</span></label>
                            <select id="exportType" name="exportType" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                ${exportTypeOptions}
                            </select>
                        </div>
                    </div>
                    <div class="form-row" id="exportFileRow" style="display: ${job?.exportType === 1 || job?.exportType === undefined || job?.exportType === null ? 'block' : 'none'};">
                        <div class="form-group">
                            <label for="exportFile">输出文件名 <span class="required">*</span></label>
                            <input type="text" id="exportFile" name="exportFile" placeholder="请输入输出文件名" value="${job?.exportFile || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="schedule">调度策略</label>
                            <input type="text" id="schedule" name="schedule" placeholder="请输入调度策略" value="${job?.schedule || ''}" style="margin-bottom: 12px;">
                            <schedule-editor id="scheduleEditor"></schedule-editor>
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    getTaskRowHTML(task, index, totalTasks = 0) {
        const taskType = task?.taskType || '';
        const dataFlowType = task?.dataFlowType || '';
        const timeout = task?.timeout || '';
        const dataset = task?.dataset || '';
        const pyTaskName = task?.pyTaskName || '';

        // 解析dataset路径，提取数据集名称和版本
        let datasetName = '';
        let version = '';
        if (dataset) {
            if (dataset.startsWith('datasets.')) {
                const parts = dataset.split('.');
                if (parts.length >= 3) {
                    datasetName = parts[1];
                    version = parts[2];
                }
            } else {
                // 如果不是标准格式，直接使用dataset作为datasetName
                datasetName = dataset;
            }
        }

        let configHTML = '';
        if (taskType === 'iginx') {
            configHTML = `
                <div style="display: flex; gap: 8px;">
                    <select class="dataset-select" style="flex: 2; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                        <option value="">请选择数据集</option>
                        <option value="${datasetName}" ${datasetName ? 'selected' : ''}>${datasetName}</option>
                    </select>
                    <select class="version-select" style="flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                        <option value="">请选择版本</option>
                        <option value="${version}" ${version ? 'selected' : ''}>${version}</option>
                    </select>
                </div>
            `;
        } else if (taskType === 'python') {
            configHTML = `
                <select class="py-task-name" data-selected="${pyTaskName}" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                    <option value="">请选择Transform函数</option>
                    <option value="${pyTaskName}" ${pyTaskName ? 'selected' : ''}>${pyTaskName}</option>
                </select>
            `;
        } else {
            configHTML = '<span style="color: #9ca3af; font-size: 14px;">请先选择任务类型</span>';
        }

        return `
            <div class="task-card" data-index="${index}" style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
                <div class="task-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <span style="font-size: 16px; font-weight: 600; color: #1e293b;">任务 ${index + 1}</span>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="move-task-up-btn" style="padding: 6px 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: white; cursor: pointer; font-size: 14px;" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button type="button" class="move-task-down-btn" style="padding: 6px 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: white; cursor: pointer; font-size: 14px;" ${index === totalTasks - 1 ? 'disabled' : ''}>↓</button>
                        <button type="button" class="remove-task" style="padding: 6px 12px; border: 1px solid #ef4444; border-radius: 6px; background: white; color: #ef4444; cursor: pointer; font-size: 18px; font-weight: bold;">×</button>
                    </div>
                </div>
                <div class="task-body" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
                    <div style="display: flex; flex-direction: column;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #475569;">任务类型 <span style="color: #ef4444;">*</span></label>
                        <select class="task-type" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                            <option value="">请选择</option>
                            <option value="iginx" ${taskType === 'iginx' ? 'selected' : ''}>IGinX</option>
                            <option value="python" ${taskType === 'python' ? 'selected' : ''}>Python</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #475569;">数据流动方式 <span style="color: #ef4444;">*</span></label>
                        <select class="data-flow-type" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                            <option value="">请选择</option>
                            <option value="stream" ${dataFlowType === 'stream' ? 'selected' : ''}>stream</option>
                            <option value="batch" ${dataFlowType === 'batch' ? 'selected' : ''}>batch</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #475569;">超时时间(ms) <span style="color: #ef4444;">*</span></label>
                        <input type="number" class="timeout" value="${timeout}" placeholder="10000000" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                    </div>
                </div>
                <div class="task-config" style="padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #475569;">
                        ${taskType === 'iginx' ? '数据集 <span style="color: #ef4444;">*</span>' : taskType === 'python' ? 'Transform函数 <span style="color: #ef4444;">*</span>' : '配置'}
                    </label>
                    <div class="config-content iginx-config" style="display: ${taskType === 'iginx' ? 'block' : 'none'};">
                        ${configHTML}
                    </div>
                    <div class="config-content python-config" style="display: ${taskType === 'python' ? 'block' : 'none'};">
                        ${configHTML}
                    </div>
                    <div class="config-content default-config" style="display: ${!taskType ? 'block' : 'none'};">
                        ${configHTML}
                    </div>
                </div>
            </div>
        `;
    }

    bindFormEvents() {
        const form = this.querySelector('#jobForm');
        const addTaskBtn = this.querySelector('#addTask');
        const tasksList = this.querySelector('#tasksList');
        const modalFooter = this.querySelector('#modalFooter');

        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                const taskRow = document.createElement('div');
                taskRow.className = 'task-row';
                taskRow.innerHTML = this.getTaskRowHTML({}, tasksList.children.length);
                tasksList.appendChild(taskRow);
                this.bindTaskRowEvents(taskRow);
            });
        }

        if (tasksList) {
            Array.from(tasksList.children).forEach(row => {
                this.bindTaskRowEvents(row);
            });
        }

        if (modalFooter) {
            modalFooter.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                const id = e.target.getAttribute('data-id');

                if (action === 'close') {
                    this.hideModal();
                } else if (action === 'delete' && id) {
                    this.deleteJobFromAPI(id);
                } else if (action === 'save') {
                    this.saveJob();
                } else if (action === 'update' && id) {
                    this.updateJob(id);
                }
            });
        }
    }

    bindTaskRowEvents(row) {
        const removeBtn = row.querySelector('.remove-task');
        const moveUpBtn = row.querySelector('.move-task-up-btn');
        const moveDownBtn = row.querySelector('.move-task-down-btn');
        const taskTypeSelect = row.querySelector('.task-type');
        const pyTaskNameSelect = row.querySelector('.py-task-name');
        const datasetSelect = row.querySelector('.dataset-select');
        const versionSelect = row.querySelector('.version-select');

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                row.remove();
                this.updateTaskButtons();
            });
        }

        if (moveUpBtn) {
            moveUpBtn.addEventListener('click', () => {
                const tasksList = row.parentElement;
                const prevRow = row.previousElementSibling;
                if (prevRow) {
                    tasksList.insertBefore(row, prevRow);
                    this.updateTaskButtons();
                }
            });
        }

        if (moveDownBtn) {
            moveDownBtn.addEventListener('click', () => {
                const tasksList = row.parentElement;
                const nextRow = row.nextElementSibling;
                if (nextRow) {
                    tasksList.insertBefore(nextRow, row);
                    this.updateTaskButtons();
                }
            });
        }

        if (taskTypeSelect) {
            taskTypeSelect.addEventListener('change', (e) => {
                const taskType = e.target.value;
                const iginxConfig = row.querySelector('.task-config .iginx-config');
                const pythonConfig = row.querySelector('.task-config .python-config');
                const defaultConfig = row.querySelector('.task-config .default-config');
                const configLabel = row.querySelector('.task-config label');

                if (iginxConfig && pythonConfig && defaultConfig) {
                    iginxConfig.style.display = taskType === 'iginx' ? 'block' : 'none';
                    pythonConfig.style.display = taskType === 'python' ? 'block' : 'none';
                    defaultConfig.style.display = !taskType ? 'block' : 'none';

                    // 动态更新内容
                    if (taskType === 'iginx') {
                        iginxConfig.innerHTML = `
                            <div style="display: flex; gap: 8px;">
                                <select class="dataset-select" style="flex: 2; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                    <option value="">请选择数据集</option>
                                </select>
                                <select class="version-select" style="flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                    <option value="">请选择版本</option>
                                </select>
                            </div>
                        `;
                        const newDatasetSelect = iginxConfig.querySelector('.dataset-select');
                        const newVersionSelect = iginxConfig.querySelector('.version-select');
                        if (newDatasetSelect) {
                            this.loadDatasets(newDatasetSelect);
                            newDatasetSelect.addEventListener('change', () => {
                                this.loadDatasetVersions(newDatasetSelect.value, newVersionSelect);
                            });
                        }
                    } else if (taskType === 'python') {
                        pythonConfig.innerHTML = `
                            <select class="py-task-name" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                <option value="">请选择Transform函数</option>
                            </select>
                        `;
                        const newPySelect = pythonConfig.querySelector('.py-task-name');
                        if (newPySelect) {
                            this.loadTransformFunctions(newPySelect);
                        }
                    }
                }

                if (configLabel) {
                    if (taskType === 'iginx') {
                        configLabel.innerHTML = '数据集 <span style="color: #ef4444;">*</span>';
                    } else if (taskType === 'python') {
                        configLabel.innerHTML = 'Transform函数 <span style="color: #ef4444;">*</span>';
                    } else {
                        configLabel.innerHTML = '配置';
                    }
                }
            });
        }

        if (datasetSelect && versionSelect) {
            const currentDatasetValue = datasetSelect.value;
            const currentVersionValue = versionSelect.value;
            this.loadDatasets(datasetSelect, () => {
                datasetSelect.value = currentDatasetValue;
            });
            datasetSelect.addEventListener('change', () => {
                this.loadDatasetVersions(datasetSelect.value, versionSelect);
            });
            if (currentDatasetValue) {
                this.loadDatasetVersions(currentDatasetValue, versionSelect, () => {
                    versionSelect.value = currentVersionValue;
                });
            }
        }

        if (pyTaskNameSelect && taskTypeSelect?.value === 'python') {
            const currentPyValue = pyTaskNameSelect.value;
            this.loadTransformFunctions(pyTaskNameSelect, () => {
                pyTaskNameSelect.value = currentPyValue;
            });
        }
    }

    updateTaskButtons() {
        const tasksList = this.querySelector('#tasksList');
        if (!tasksList) return;

        const rows = Array.from(tasksList.querySelectorAll('.task-row'));
        rows.forEach((row, index) => {
            const moveUpBtn = row.querySelector('.move-task-up-btn');
            const moveDownBtn = row.querySelector('.move-task-down-btn');
            if (moveUpBtn) moveUpBtn.disabled = index === 0;
            if (moveDownBtn) moveDownBtn.disabled = index === rows.length - 1;
        });
    }

    async loadDatasets(selectElement, callback) {
        try {
            selectElement.innerHTML = '<option value="">请选择数据集</option>';
            
            // 从数据源树获取数据集
            const result = await window.AppConfig.get('datasource', 'tree');
            
            if (result.success && result.data) {
                // 提取数据集（datasets开头的数据源）
                const datasetNames = new Set();
                result.data.forEach(item => {
                    const path = typeof item === 'string' ? item : item.path;
                    if (path && path.startsWith('datasets.')) {
                        // 路径格式: datasets.dataset01.version
                        const parts = path.split('.');
                        if (parts.length >= 2) {
                            datasetNames.add(parts[1]);
                        }
                    }
                });
                
                datasetNames.forEach(datasetName => {
                    const option = document.createElement('option');
                    option.value = datasetName;
                    option.textContent = datasetName;
                    selectElement.appendChild(option);
                });
                
                if (callback) callback();
            } else {
                console.error('获取数据集失败:', result.message);
            }
        } catch (error) {
            console.error('加载数据集异常:', error);
        }
    }

    async loadDatasetVersions(datasetName, selectElement, callback) {
        try {
            selectElement.innerHTML = '<option value="">请选择版本</option>';
            if (!datasetName) return;
            
            // 从数据源树获取版本
            const result = await window.AppConfig.get('datasource', 'tree');
            
            if (result.success && result.data) {
                // 提取指定数据集的版本
                const versions = new Set();
                result.data.forEach(item => {
                    const path = typeof item === 'string' ? item : item.path;
                    if (path && path.startsWith(`datasets.${datasetName}.`)) {
                        // 路径格式: datasets.dataset01.version
                        const parts = path.split('.');
                        if (parts.length >= 3) {
                            versions.add(parts[2]);
                        }
                    }
                });
                
                versions.forEach(version => {
                    const option = document.createElement('option');
                    option.value = version;
                    option.textContent = version;
                    selectElement.appendChild(option);
                });
                
                if (callback) callback();
            } else {
                console.error('获取版本失败:', result.message);
            }
        } catch (error) {
            console.error('加载版本异常:', error);
        }
    }

    async loadTransformFunctions(selectElement, callback) {
        try {
            const url = window.AppConfig.getApiUrl('transform', 'query').replace('{type}', 'transform');
            const headers = window.AppConfig.getAuthHeaders();

            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            const result = await response.json();
            const selectedValue = selectElement.getAttribute('data-selected');

            if (result.code === 200 && result.data) {
                selectElement.innerHTML = '<option value="">请选择</option>';
                result.data.forEach(transform => {
                    const option = document.createElement('option');
                    option.value = transform.className;
                    option.textContent = transform.name;
                    if (transform.className === selectedValue) {
                        option.selected = true;
                    }
                    selectElement.appendChild(option);
                });
                
                if (callback) callback();
            } else {
                console.error('获取Transform函数失败:', result.message);
            }
        } catch (error) {
            console.error('加载Transform函数异常:', error);
        }
    }

    showModal(title, content, buttons = []) {
        const modalMask = this.querySelector('#modalMask');
        const modalTitle = this.querySelector('#modalTitle');
        const modalBody = this.querySelector('#modalBody');
        const modalFooter = this.querySelector('#modalFooter');

        if (!modalMask || !modalTitle || !modalBody || !modalFooter) {
            console.error('Modal elements not found');
            return;
        }

        modalTitle.textContent = title;
        modalBody.innerHTML = content;

        if (buttons.length > 0) {
            modalFooter.innerHTML = buttons.map(btn => 
                `<button class="${btn.class}" data-action="${btn.action}" ${btn.id ? `data-id="${btn.id}"` : ''}>${btn.text}</button>`
            ).join('');

            // Remove old event listeners
            modalFooter.replaceWith(modalFooter.cloneNode(true));
            const newModalFooter = this.querySelector('#modalFooter');
            
            newModalFooter.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;

                if (action === 'close') {
                    this.hideModal();
                } else if (action === 'submit') {
                    this.saveJob();
                } else if (action === 'edit' && id) {
                    this.updateJob(id);
                } else if (action === 'delete' && id) {
                    this.deleteJobFromAPI(id);
                }
            });
        } else {
            modalFooter.innerHTML = '';
        }

        modalMask.hidden = false;
        modalMask.style.display = 'flex';
    }

    hideModal() {
        const modalMask = this.querySelector('#modalMask');
        if (modalMask) {
            modalMask.hidden = true;
            modalMask.style.display = 'none';
        }
    }

    async saveJob() {
        const form = this.querySelector('#jobForm');
        if (!form) return;

        const jobName = form.querySelector('#jobName')?.value.trim();
        const exportFile = form.querySelector('#exportFile')?.value;
        const schedule = form.querySelector('#schedule')?.value.trim();
        const taskList = this.collectTasks();

        const jobData = {
            name: jobName,
            exportFiletName: exportFile,
            schedule,
            taskList
        };

        console.log('Job data to save:', jobData);

        try {
            const result = await window.AppConfig.post('job', 'save', jobData);
            if (result.success) {
                this.showToast('作业创建成功');
                this.hideModal();
                this.loadJobsFromAPI();
            } else {
                this.showToast(result.message || '作业创建失败', 'error');
            }
        } catch (error) {
            console.error('保存作业失败:', error);
            this.showToast('作业创建失败', 'error');
        }
    }

    async updateJob(id) {
        const form = this.querySelector('#jobForm');
        if (!form) return;

        const jobName = form.querySelector('#jobName')?.value.trim();
        const exportFile = form.querySelector('#exportFile')?.value;
        const schedule = form.querySelector('#schedule')?.value.trim();
        const taskList = this.collectTasks();

        const jobData = {
            createTime: id,
            name: jobName,
            exportFiletName: exportFile,
            schedule,
            taskList
        };

        console.log('Job data to update:', jobData);

        try {
            const result = await window.AppConfig.post('transformCompare', 'save', jobData);
            if (result.success) {
                this.showToast('作业更新成功');
                this.hideModal();
                this.loadJobsFromAPI();
            } else {
                this.showToast(result.message || '作业更新失败', 'error');
            }
        } catch (error) {
            console.error('更新作业失败:', error);
            this.showToast('作业更新失败', 'error');
        }
    }

    collectTasks(tasksList = null) {
        const list = tasksList || this.querySelector('#tasksList');
        if (!list) return [];

        const tasks = [];
        Array.from(list.children).forEach(row => {
            const taskType = row.querySelector('.task-type')?.value;
            const dataFlowType = row.querySelector('.data-flow-type')?.value;
            const timeout = row.querySelector('.timeout')?.value;
            const pyTaskName = row.querySelector('.py-task-name')?.value;
            const datasetSelect = row.querySelector('.dataset-select');
            const versionSelect = row.querySelector('.version-select');

            if (taskType && timeout) {
                const task = {
                    taskType: taskType === 'python' ? 1 : 0,
                    timeout: parseInt(timeout)
                };

                // 始终设置dataFlowType，即使为空，以便验证能正确检测
                if (dataFlowType) {
                    task.dataFlowType = dataFlowType === 'stream' ? 1 : 0;
                } else {
                    task.dataFlowType = null;
                }

                if (taskType === 'python') {
                    if (pyTaskName) {
                        task.pyTaskName = pyTaskName;
                    }
                } else if (taskType === 'iginx' && datasetSelect) {
                    const dataset = datasetSelect?.value;
                    const version = versionSelect?.value;
                    if (dataset && version) {
                        task.dataset = `datasets.${dataset}.${version}`;
                    }
                }

                tasks.push(task);
            }
        });

        return tasks;
    }

    async runJob(id) {
        // 模拟运行成功
        this.showToast('作业运行成功');
    }

    showToast(message, type = 'success') {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }

    async show() {
        this.style.display = 'block';
        // 重置分页到第一页
        this.currentPage = 1;
        await this.loadJobsFromAPI();
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('transform-compare', TransformCompare);
