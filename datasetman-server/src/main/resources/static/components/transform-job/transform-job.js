class TransformJob extends HTMLElement {
    constructor() {
        super();
        this.data = [];
        this.pageSize = 10;
        this.currentPage = 1;
        this.currentAction = 'add';
        this.editingJobId = null;
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
        // 使用模拟数据
        const mockData = [
            {
                id: '1',
                jobName: '数据清洗作业',
                jobDesc: '清洗用户数据',
                jobType: 'batch',
                dataFlow: 'dataStream1',
                outputTarget: 'database',
                schedule: '0 0 * * * ?',
                tasks: [],
                status: 'active',
                updateTime: '2025-01-15 10:30:00',
                createTime: '1'
            },
            {
                id: '2',
                jobName: '数据转换作业',
                jobDesc: '转换数据格式',
                jobType: 'streaming',
                dataFlow: 'dataStream2',
                outputTarget: 'file',
                schedule: '0 0 2 * * ?',
                tasks: [],
                status: 'inactive',
                updateTime: '2025-01-14 15:20:00',
                createTime: '2'
            },
            {
                id: '3',
                jobName: '数据同步作业',
                jobDesc: '同步源数据',
                jobType: 'scheduled',
                dataFlow: 'dataStream3',
                outputTarget: 'messageQueue',
                schedule: '0 0 4 * * ?',
                tasks: [],
                status: 'active',
                updateTime: '2025-01-13 09:15:00',
                createTime: '3'
            }
        ];

        this.data = mockData;
        this.totalCount = mockData.length;
        this.updatePagination();
        this.renderTable();
    }

    async loadJobsCount(name, status) {
        try {
            const requestBody = {
                name: name || null,
                status: status || null
            };
            
            const result = await window.AppConfig.post('transformJob', 'count', requestBody);
            
            if (result.success && result.data !== undefined) {
                this.totalCount = result.data;
                this.updatePagination();
            } else {
                this.totalCount = this.data.length;
            }
        } catch (error) {
            console.error('获取数据总量失败:', error);
            this.totalCount = this.data.length;
        }
    }

    async deleteJobFromAPI(createTime) {
        // 模拟删除成功
        this.showToast('作业已删除');
        this.hideModal();
        this.loadJobsFromAPI();
    }

    getJobNameByCreateTime(createTime) {
        const job = this.data.find(j => j.createTime === createTime);
        return job ? job.jobName : '';
    }

    bindEvents() {
        const addJobBtn = this.querySelector('#addJobBtn');
        const modalClose = this.querySelector('#modalClose');
        const modalMask = this.querySelector('#modalMask');
        const applyFilters = this.querySelector('#applyFilters');
        const resetFilters = this.querySelector('#resetFilters');

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

        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.currentPage = 1;
                this.loadJobsFromAPI();
            });
        }

        if (resetFilters) {
            resetFilters.addEventListener('click', () => {
                const inputs = this.querySelectorAll('.filter-input');
                inputs.forEach(input => input.value = '');
                this.currentPage = 1;
                this.loadJobsFromAPI();
            });
        }

        const pagination = this.querySelector('#pagination');
        if (pagination) {
            pagination.addEventListener('page-change', (e) => {
                this.currentPage = e.detail.page;
                this.loadJobsFromAPI();
            });
        }
    }

    initPagination() {
        const pagination = this.querySelector('#pagination');
        if (pagination) {
            pagination.totalCount = 0;
            pagination.currentPage = 1;
            pagination.pageSize = this.pageSize;
        }
    }

    updatePagination() {
        const pagination = this.querySelector('#pagination');
        if (pagination) {
            pagination.totalCount = this.totalCount;
            pagination.currentPage = this.currentPage;
            pagination.pageSize = this.pageSize;
        }
    }

    renderTable() {
        const tbody = this.querySelector('#tableBody');
        if (!tbody) return;

        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">
                        暂无作业数据
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.data.map(job => `
            <tr data-id="${job.id}">
                <td>${job.jobName}</td>
                <td>${job.jobType}</td>
                <td>${job.dataFlow}</td>
                <td>${job.outputTarget}</td>
                <td>${job.schedule}</td>
                <td>
                    <span class="status-badge ${job.status}">${job.status === 'active' ? '运行中' : '已完成'}</span>
                </td>
                <td>${job.updateTime}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn run" data-id="${job.id}">运行</button>
                        <button class="action-btn edit" data-id="${job.id}">编辑</button>
                        <button class="action-btn delete" data-id="${job.id}">删除</button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            if (!id) return;

            if (e.target.classList.contains('run')) {
                this.runJob(id);
            } else if (e.target.classList.contains('edit')) {
                this.showEditModal(id);
            } else if (e.target.classList.contains('delete')) {
                this.showDeleteConfirm(id);
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
                        <button class="cancel-btn" style="
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
                        <button class="confirm-btn" style="
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

        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);

        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const closeBtn = dialog.querySelector('.dialog-close-btn');
        const form = dialog.querySelector('#jobForm');
        const addTaskBtn = dialog.querySelector('#addTask');
        const tasksList = dialog.querySelector('#tasksList');

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

        confirmBtn.addEventListener('click', () => {
            const jobName = form.querySelector('#jobName')?.value.trim();
            const exportFile = form.querySelector('#exportFile')?.value;
            const schedule = form.querySelector('#schedule')?.value.trim();
            const taskList = this.collectTasks();

            if (!jobName || !exportFile || !schedule) {
                this.showToast('请填写完整作业配置', 'error');
                return;
            }

            if (taskList.length === 0) {
                this.showToast('请至少添加一个任务', 'error');
                return;
            }

            for (const task of taskList) {
                if (!task.taskType || !task.timeout) {
                    this.showToast('请填写完整任务信息', 'error');
                    return;
                }
                if (task.taskType === 'python' && !task.dataFlowType) {
                    this.showToast('请填写数据流动方式', 'error');
                    return;
                }
                if (task.taskType === 'python' && !task.pyTaskName) {
                    this.showToast('请选择Transform函数', 'error');
                    return;
                }
                if (task.taskType === 'iginx' && !task.dataset) {
                    this.showToast('请选择数据集', 'error');
                    return;
                }
            }

            closeDialog();
            this.saveJob();
        });
    }

    showEditModal(id) {
        this.currentAction = 'edit';
        this.editingJobId = id;
        const job = this.data.find(j => j.id === id);
        if (!job) return;

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
                        ${this.getJobFormHTML(job)}
                    </div>
                    <div class="dialog-actions" style="
                        display: flex;
                        justify-content: center;
                        gap: 16px;
                        padding: 24px 32px;
                        border-top: 1px solid #e5e7eb;
                        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    ">
                        <button class="cancel-btn" style="
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
                        <button class="confirm-btn" style="
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

        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);

        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const closeBtn = dialog.querySelector('.dialog-close-btn');
        const form = dialog.querySelector('#jobForm');
        const addTaskBtn = dialog.querySelector('#addTask');
        const tasksList = dialog.querySelector('#tasksList');

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

        confirmBtn.addEventListener('click', () => {
            const jobName = form.querySelector('#jobName')?.value.trim();
            const exportFile = form.querySelector('#exportFile')?.value;
            const schedule = form.querySelector('#schedule')?.value.trim();
            const taskList = this.collectTasks();

            if (!jobName || !exportFile || !schedule) {
                this.showToast('请填写完整作业配置', 'error');
                return;
            }

            if (taskList.length === 0) {
                this.showToast('请至少添加一个任务', 'error');
                return;
            }

            for (const task of taskList) {
                if (!task.taskType || !task.timeout) {
                    this.showToast('请填写完整任务信息', 'error');
                    return;
                }
                if (task.taskType === 'python' && !task.dataFlowType) {
                    this.showToast('请填写数据流动方式', 'error');
                    return;
                }
                if (task.taskType === 'python' && !task.pyTaskName) {
                    this.showToast('请选择Transform函数', 'error');
                    return;
                }
                if (task.taskType === 'iginx' && !task.dataset) {
                    this.showToast('请选择数据集', 'error');
                    return;
                }
            }

            closeDialog();
            this.updateJob(id);
        });
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
                        <button class="cancel-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #c9cdd4;
                            border-radius: 4px;
                            background: white;
                            color: #1f2329;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button class="confirm-btn" style="
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

        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);

        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');

        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', () => {
            closeDialog();
            this.deleteJobFromAPI(id);
        });
    }

    getJobFormHTML(job = null) {
        return `
            <form id="jobForm" class="job-form">
                <div class="form-section">
                    <div class="section-title">作业信息</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="jobName">作业名称 <span class="required">*</span></label>
                            <input type="text" id="jobName" name="jobName" placeholder="请输入作业名称" value="${job?.jobName || ''}" required>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <div class="params-block" style="margin-bottom: 32px; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                        <div class="params-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <span style="font-size: 16px; font-weight: 600; color: #1e293b;">任务列表</span>
                            <button class="add-btn" id="addTask" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; width: 32px; height: 32px; font-size: 18px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">+</button>
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
                            <label for="exportFile">导出文件名 <span class="required">*</span></label>
                            <input type="text" id="exportFile" name="exportFile" placeholder="请输入导出文件名" value="${job?.exportFile || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="schedule">调度策略 <span class="required">*</span></label>
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
        const version = task?.version || '';
        const pyTaskName = task?.pyTaskName || '';

        let configHTML = '';
        if (taskType === 'iginx') {
            configHTML = `
                <div style="display: flex; gap: 8px;">
                    <select class="dataset-select" style="flex: 2; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                        <option value="">请选择数据集</option>
                        <option value="${dataset}" ${dataset ? 'selected' : ''}>${dataset}</option>
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
            this.loadDatasets(datasetSelect);
            datasetSelect.addEventListener('change', () => {
                this.loadDatasetVersions(datasetSelect.value, versionSelect);
            });
        }

        if (pyTaskNameSelect && taskTypeSelect?.value === 'python') {
            this.loadTransformFunctions(pyTaskNameSelect);
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

    async loadDatasets(selectElement) {
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
            } else {
                console.error('获取数据集失败:', result.message);
            }
        } catch (error) {
            console.error('加载数据集异常:', error);
        }
    }

    async loadDatasetVersions(datasetName, selectElement) {
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
            } else {
                console.error('获取版本失败:', result.message);
            }
        } catch (error) {
            console.error('加载版本异常:', error);
        }
    }

    async loadTransformFunctions(selectElement) {
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
            } else {
                selectElement.innerHTML = '<option value="">请选择</option>';
            }
        } catch (error) {
            console.error('加载Transform函数失败:', error);
            selectElement.innerHTML = '<option value="">请选择</option>';
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

        const exportFile = form.querySelector('#exportFile')?.value;
        const schedule = form.querySelector('#schedule')?.value.trim();
        const taskList = this.collectTasks();

        const jobData = {
            exportFile,
            schedule,
            taskList
        };

        console.log('Job data to save:', jobData);

        this.showToast('作业创建成功');
        this.hideModal();
        this.loadJobsFromAPI();
    }

    async updateJob(id) {
        const form = this.querySelector('#jobForm');
        if (!form) return;

        const exportFile = form.querySelector('#exportFile')?.value;
        const schedule = form.querySelector('#schedule')?.value.trim();
        const taskList = this.collectTasks();

        const jobData = {
            createTime: id,
            exportFile,
            schedule,
            taskList
        };

        console.log('Job data to update:', jobData);

        this.showToast('作业更新成功');
        this.hideModal();
        this.loadJobsFromAPI();
    }

    collectTasks() {
        const tasksList = this.querySelector('#tasksList');
        if (!tasksList) return [];

        const tasks = [];
        Array.from(tasksList.children).forEach(row => {
            const taskType = row.querySelector('.task-type')?.value;
            const dataFlowType = row.querySelector('.data-flow-type')?.value;
            const timeout = row.querySelector('.timeout')?.value;
            const pyTaskName = row.querySelector('.py-task-name')?.value;
            const datasetSelect = row.querySelector('.dataset-select');
            const versionSelect = row.querySelector('.version-select');

            if (taskType && timeout) {
                const task = {
                    taskType,
                    timeout: parseInt(timeout)
                };

                if (taskType === 'python') {
                    if (dataFlowType) {
                        task.dataFlowType = dataFlowType;
                    }
                    if (pyTaskName) {
                        task.pyTaskName = pyTaskName;
                    }
                } else if (taskType === 'iginx' && datasetSelect) {
                    const dataset = datasetSelect?.value;
                    const version = versionSelect?.value;
                    if (dataset) {
                        task.dataset = dataset;
                    }
                    if (version) {
                        task.version = version;
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

    show() {
        this.style.display = 'block';
        this.loadJobsFromAPI();
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('transform-job', TransformJob);
