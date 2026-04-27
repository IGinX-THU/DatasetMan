class TransformJob extends HTMLElement {
    constructor() {
        super();
        this.data = [];
        this.pageSize = 10;
        this.currentPage = 1;
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

        // Event delegation for refresh and cancel buttons
        const tbody = this.querySelector('#tableBody');
        if (tbody) {
            tbody.addEventListener('click', async (e) => {
                const refreshBtn = e.target.closest('.action-btn.refresh');
                const cancelBtn = e.target.closest('.action-btn.cancel');

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
        // 每次显示时刷新数据
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

    show() {
        this.style.display = 'block';
        this.loadJobsFromAPI();
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('transform-job', TransformJob);
