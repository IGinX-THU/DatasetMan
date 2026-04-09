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
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 600px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    max-height: 90vh;
                    overflow-y: auto;
                ">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">新增作业</h3>
                    <div class="dialog-body" style="margin-bottom: 24px;">
                        ${this.getJobFormHTML()}
                    </div>
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
                            border: 1px solid #4c89ff;
                            border-radius: 4px;
                            background: #4c89ff;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
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
        const form = dialog.querySelector('#jobForm');
        const addTaskBtn = dialog.querySelector('#addTask');
        const tasksList = dialog.querySelector('#tasksList');

        // Bind task events
        if (addTaskBtn && tasksList) {
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

        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', () => {
            const jobName = form.querySelector('#jobName')?.value.trim();
            if (!jobName) {
                this.showToast('请输入作业名称', 'error');
                return;
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
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 600px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    max-height: 90vh;
                    overflow-y: auto;
                ">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">编辑作业</h3>
                    <div class="dialog-body" style="margin-bottom: 24px;">
                        ${this.getJobFormHTML(job)}
                    </div>
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
                            border: 1px solid #4c89ff;
                            border-radius: 4px;
                            background: #4c89ff;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
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
        const form = dialog.querySelector('#jobForm');
        const addTaskBtn = dialog.querySelector('#addTask');
        const tasksList = dialog.querySelector('#tasksList');

        // Bind task events
        if (addTaskBtn && tasksList) {
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

        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', () => {
            const jobName = form.querySelector('#jobName')?.value.trim();
            if (!jobName) {
                this.showToast('请输入作业名称', 'error');
                return;
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
                <div class="form-row">
                    <div class="form-group">
                        <label for="jobName">作业名称</label>
                        <input type="text" id="jobName" name="jobName" required placeholder="请输入作业名称" value="${job?.jobName || ''}">
                    </div>
                    <div class="form-group">
                        <label for="jobDesc">作业描述</label>
                        <input type="text" id="jobDesc" name="jobDesc" placeholder="请输入作业描述" value="${job?.jobDesc || ''}">
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="section-title">任务配置</div>
                    <div class="task-config">
                        <div class="task-header">
                            <div class="task-field">
                                <label>作业类型</label>
                                <select id="jobType" class="job-type-select">
                                    <option value="batch" ${job?.jobType === 'batch' ? 'selected' : ''}>批处理作业</option>
                                    <option value="streaming" ${job?.jobType === 'streaming' ? 'selected' : ''}>流式作业</option>
                                    <option value="scheduled" ${job?.jobType === 'scheduled' ? 'selected' : ''}>定时作业</option>
                                </select>
                            </div>
                            <div class="task-field">
                                <label>数据流</label>
                                <select id="dataFlow" class="data-flow-select">
                                    <option value="">请选择数据流</option>
                                    <option value="dataStream1" ${job?.dataFlow === 'dataStream1' ? 'selected' : ''}>数据流1</option>
                                    <option value="dataStream2" ${job?.dataFlow === 'dataStream2' ? 'selected' : ''}>数据流2</option>
                                    <option value="dataStream3" ${job?.dataFlow === 'dataStream3' ? 'selected' : ''}>数据流3</option>
                                </select>
                            </div>
                            <div class="task-field">
                                <label>输出目标</label>
                                <select id="outputTarget" class="output-target-select">
                                    <option value="">请选择输出目标</option>
                                    <option value="database" ${job?.outputTarget === 'database' ? 'selected' : ''}>数据库</option>
                                    <option value="file" ${job?.outputTarget === 'file' ? 'selected' : ''}>文件系统</option>
                                    <option value="messageQueue" ${job?.outputTarget === 'messageQueue' ? 'selected' : ''}>消息队列</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="task-section">
                            <div class="task-title">任务列表</div>
                            <div class="tasks-list" id="tasksList">
                                ${job?.tasks?.map((task, index) => this.getTaskRowHTML(task, index)).join('') || ''}
                            </div>
                            <button type="button" class="add-task-btn" id="addTask">+ 添加任务</button>
                        </div>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule">调度策略</label>
                        <input type="text" id="schedule" name="schedule" placeholder="0 0 * * * ?" value="${job?.schedule || ''}">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>状态</label>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="status" value="active" ${job?.status === 'active' ? 'checked' : ''}>
                                <span class="radio-custom"></span>
                                <span>启用</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="status" value="inactive" ${job?.status === 'inactive' ? 'checked' : ''}>
                                <span class="radio-custom"></span>
                                <span>禁用</span>
                            </label>
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    getTaskRowHTML(task, index) {
        return `
            <div class="task-row" data-index="${index}">
                <div class="task-field">
                    <label>任务名称</label>
                    <input type="text" class="task-name" value="${task.name || ''}" placeholder="请输入任务名称">
                </div>
                <div class="task-field">
                    <label>Transform</label>
                    <select class="task-transform">
                        <option value="">请选择Transform</option>
                        <option value="transform1" ${task?.transform === 'transform1' ? 'selected' : ''}>Transform1</option>
                        <option value="transform2" ${task?.transform === 'transform2' ? 'selected' : ''}>Transform2</option>
                    </select>
                </div>
                <button type="button" class="remove-task">×</button>
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
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                row.remove();
            });
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

        const formData = new FormData(form);
        const jobData = {
            name: formData.get('jobName'),
            description: formData.get('jobDesc'),
            jobType: this.querySelector('#jobType').value,
            dataFlow: this.querySelector('#dataFlow').value,
            outputTarget: this.querySelector('#outputTarget').value,
            schedule: formData.get('schedule'),
            status: this.querySelector('input[name="status"]:checked').value === 'active',
            tasks: this.collectTasks()
        };

        // 模拟创建成功
        this.showToast('作业创建成功');
        this.hideModal();
        this.loadJobsFromAPI();
    }

    async updateJob(id) {
        const form = this.querySelector('#jobForm');
        if (!form) return;

        const formData = new FormData(form);
        const jobData = {
            createTime: id,
            name: formData.get('jobName'),
            description: formData.get('jobDesc'),
            jobType: this.querySelector('#jobType').value,
            dataFlow: this.querySelector('#dataFlow').value,
            outputTarget: this.querySelector('#outputTarget').value,
            schedule: formData.get('schedule'),
            status: this.querySelector('input[name="status"]:checked').value === 'active',
            tasks: this.collectTasks()
        };

        // 模拟更新成功
        this.showToast('作业更新成功');
        this.hideModal();
        this.loadJobsFromAPI();
    }

    collectTasks() {
        const tasksList = this.querySelector('#tasksList');
        if (!tasksList) return [];

        const tasks = [];
        Array.from(tasksList.children).forEach(row => {
            const name = row.querySelector('.task-name')?.value;
            const transform = row.querySelector('.task-transform')?.value;
            if (name && transform) {
                tasks.push({ name, transform });
            }
        });

        return JSON.stringify(tasks);
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
