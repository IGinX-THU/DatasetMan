/**
 * 评价准则组件
 * 每个维度配置权重并绑定一条 Transform 编排记录；
 * 可保存准则，并在列表页将四条编排一起提交，生成质量测评记录。
 */
class EvaluationCriteria extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.style.display = 'none';
        this.criteriaList = [];
        this.jobs = [];
        this.editingId = null;
        this.pageSize = 10;
        this.currentPage = 1;
        this.totalCount = 0;
        this.defaultWeights = {
            qcom: 0.3,
            qcon: 0.2,
            qtim: 0.2,
            qval: 0.3
        };
    }

    async connectedCallback() {
        await this.loadResources();
        setTimeout(() => {
            this.bindEvents();
            this.initPagination();
        }, 100);
    }

    async loadResources() {
        try {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = './components/evaluation-criteria/evaluation-criteria.css';
            this.shadowRoot.appendChild(cssLink);

            const paginationCss = document.createElement('link');
            paginationCss.rel = 'stylesheet';
            paginationCss.href = './components/common-pagination/common-pagination.css';
            this.shadowRoot.appendChild(paginationCss);
        } catch (error) {
            console.error('Failed to load CSS:', error);
        }

        if (window.location.protocol === 'file:') {
            this.shadowRoot.innerHTML += this.getFallbackHTML();
        } else {
            try {
                const response = await fetch('./components/evaluation-criteria/evaluation-criteria.html');
                const html = await response.text();
                this.shadowRoot.innerHTML += html;
            } catch (error) {
                console.error('Failed to load HTML:', error);
                this.shadowRoot.innerHTML += this.getFallbackHTML();
            }
        }
    }

    getFallbackHTML() {
        return `<div class="ec-container">
            <div class="ec-toolbar"><div class="ec-title">评价准则</div></div>
            <div class="ec-content"><div class="ec-empty">加载失败，请刷新重试。</div></div>
        </div>`;
    }

    show() {
        this.style.display = 'block';
        this.showListView();
    }

    hide() {
        this.style.display = 'none';
    }

    initPagination() {
        const pagination = this.shadowRoot.querySelector('#ecPagination');
        if (pagination) {
            pagination.addEventListener('pagination-change', (e) => {
                this.currentPage = e.detail.currentPage;
                this.loadCriteriaList();
            });
        }
    }

    updatePagination() {
        const pagination = this.shadowRoot.querySelector('#ecPagination');
        if (pagination && typeof pagination.setPagination === 'function') {
            pagination.setPagination(this.currentPage, this.pageSize, this.totalCount);
        }
    }

    bindEvents() {
        const addBtn = this.shadowRoot.querySelector('#ecAddBtn');
        if (addBtn) addBtn.addEventListener('click', () => this.showFormView());

        const modalClose = this.shadowRoot.querySelector('#ecModalClose');
        if (modalClose) modalClose.addEventListener('click', () => this.hideFormView());

        const cancelBtn = this.shadowRoot.querySelector('#ecCancelBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideFormView());

        const form = this.shadowRoot.querySelector('#ecForm');
        if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.saveCriteria(); });

        const applyFilters = this.shadowRoot.querySelector('#ecApplyFilters');
        if (applyFilters) applyFilters.addEventListener('click', () => {
            this.currentPage = 1;
            this.showListView();
        });

        const resetFilters = this.shadowRoot.querySelector('#ecResetFilters');
        if (resetFilters) resetFilters.addEventListener('click', () => {
            const filterInput = this.shadowRoot.querySelector('#ecFilterName');
            if (filterInput) filterInput.value = '';
            this.currentPage = 1;
            this.showListView();
        });

        this.shadowRoot.querySelectorAll('.ec-weight-input').forEach(input => {
            input.addEventListener('input', () => this.updateWeightSummary());
            input.addEventListener('change', () => this.updateWeightSummary());
        });
    }

    updateWeightSummary() {
        const sumEl = this.shadowRoot.querySelector('#ecWeightSum');
        const hintEl = this.shadowRoot.querySelector('#ecWeightHint');
        if (!sumEl || !hintEl) return;

        let sum = 0;
        Object.keys(this.defaultWeights).forEach(dim => {
            const input = this.shadowRoot.querySelector(`.ec-weight-input[data-dim="${dim}"]`);
            const v = parseFloat(input ? input.value : NaN);
            sum += isNaN(v) ? 0 : v;
        });
        sum = Math.round(sum * 100) / 100;
        sumEl.textContent = sum.toFixed(2);
        if (Math.abs(sum - 1) > 0.001) {
            hintEl.textContent = '权重合计必须等于1';
            hintEl.classList.add('ec-weight-hint-error');
        } else {
            hintEl.textContent = '';
            hintEl.classList.remove('ec-weight-hint-error');
        }
    }

    async showListView() {
        await this.loadCriteriaList();
        this.renderList();
    }

    hideFormView() {
        const modal = this.shadowRoot.querySelector('#ecFormModal');
        if (modal) modal.hidden = true;
    }

    async showFormView(record = null) {
        await this.loadJobsFromAPI();

        const titleEl = this.shadowRoot.querySelector('#ecModalTitle');
        if (titleEl) titleEl.textContent = record ? '编辑评价准则' : '新增评价准则';

        this.editingId = record ? record.id : null;
        const editIdInput = this.shadowRoot.querySelector('#ecEditId');
        if (editIdInput) editIdInput.value = this.editingId || '';

        const nameInput = this.shadowRoot.querySelector('#ecName');
        const descInput = this.shadowRoot.querySelector('#ecDescription');
        if (nameInput) nameInput.value = record ? record.name || '' : '';
        if (descInput) descInput.value = record ? record.description || '' : '';

        const dims = ['qcom', 'qcon', 'qtim', 'qval'];
        dims.forEach(dim => {
            const weightInput = this.shadowRoot.querySelector(`.ec-weight-input[data-dim="${dim}"]`);
            const jobSelect = this.shadowRoot.querySelector(`.ec-job-select[data-dim="${dim}"]`);
            const weight = record && record.weights && record.weights[dim] !== undefined ? record.weights[dim] : this.defaultWeights[dim];
            const jobId = record && record.jobs && record.jobs[dim] ? record.jobs[dim] : '';
            if (weightInput) weightInput.value = weight;
            if (jobSelect) {
                const option = jobSelect.querySelector(`option[value="${jobId}"]`);
                jobSelect.value = option ? jobId : '';
            }
        });

        this.updateWeightSummary();

        const modal = this.shadowRoot.querySelector('#ecFormModal');
        if (modal) modal.hidden = false;
    }

    renderList() {
        const tbody = this.shadowRoot.querySelector('#ecTableBody');
        if (!tbody) return;

        if (this.criteriaList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="ec-empty">暂无评价准则，请点击"新增"添加。</td></tr>';
            return;
        }

        tbody.innerHTML = this.criteriaList.map((item, index) => {
            const dimJob = dim => {
                const jobId = item.jobs && item.jobs[dim] ? item.jobs[dim] : '';
                if (!jobId) return '-';
                const job = this.jobs.find(j => String(j.id) === String(jobId));
                return job ? job.name : jobId;
            };
            return `
                <tr>
                    <td>${item.name || ''}</td>
                    <td>${item.description || ''}</td>
                    <td>${dimJob('qcom')}</td>
                    <td>${dimJob('qcon')}</td>
                    <td>${dimJob('qtim')}</td>
                    <td>${dimJob('qval')}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" data-index="${index}">编辑</button>
                            <button class="action-btn delete" data-index="${index}">删除</button>
                            <button class="action-btn run" data-index="${index}">提交测评</button>
                            <button class="action-btn manage" data-index="${index}">管理</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.bindListEvents();
    }

    bindListEvents() {
        this.shadowRoot.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.showFormView(this.criteriaList[index]);
            });
        });

        this.shadowRoot.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const index = parseInt(e.target.dataset.index);
                if (confirm('确定删除该评价准则吗？')) {
                    await this.deleteCriteria(this.criteriaList[index].id);
                }
            });
        });

        this.shadowRoot.querySelectorAll('.action-btn.run').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.showSubmitConfirm(this.criteriaList[index]);
            });
        });

        this.shadowRoot.querySelectorAll('.action-btn.manage').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.navigateToQualityAssessment(this.criteriaList[index]);
            });
        });
    }

    showSubmitConfirm(criteria) {
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
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">确认提交测评</h3>
                    <p style="margin: 0 0 24px 0; color: #646a73; line-height: 1.5;">
                        确定要提交准则 "${criteria.name || ''}" 的测评任务吗？
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
                        ">确认提交</button>
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
            dialogContent.addEventListener('click', (e) => e.stopPropagation());
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
            if (confirmBtn.disabled) return;
            confirmBtn.disabled = true;
            confirmBtn.textContent = '提交中...';
            confirmBtn.style.opacity = '0.6';
            confirmBtn.style.cursor = 'not-allowed';
            try {
                await this.submitTasks(criteria);
            } catch (error) {
                console.error('提交测评失败:', error);
            } finally {
                closeDialog();
            }
        });
    }

    navigateToQualityAssessment(criteria) {
        if (typeof window.showComponent === 'function') {
            window.showComponent('qualityAssessment', criteria ? criteria.name : null);
        }
    }

    async loadCriteriaList() {
        try {
            if (window.AppConfig && typeof window.AppConfig.post === 'function') {
                const nameFilter = this.shadowRoot.querySelector('#ecFilterName')?.value.trim() || null;
                const result = await window.AppConfig.post('evaluationCriteria', 'query', { pageNum: this.currentPage, pageSize: this.pageSize, name: nameFilter });
                this.criteriaList = result.success && result.data ? result.data.map(item => this.parseEntity(item)) : [];
                if (this.currentPage === 1) {
                    await this.loadCriteriaCount(nameFilter);
                }
            } else {
                this.criteriaList = [];
            }
        } catch (error) {
            console.error('加载评价准则失败:', error);
            this.criteriaList = [];
        }
    }

    async loadCriteriaCount(name) {
        try {
            if (window.AppConfig && typeof window.AppConfig.post === 'function') {
                const result = await window.AppConfig.post('evaluationCriteria', 'count', { name: name || null });
                if (result.success && result.data !== undefined) {
                    this.totalCount = result.data;
                    this.updatePagination();
                }
            }
        } catch (error) {
            console.error('获取评价准则总数失败:', error);
            this.totalCount = this.criteriaList.length;
        }
    }

    async deleteCriteria(id) {
        try {
            if (window.AppConfig && typeof window.AppConfig.delete === 'function') {
                await window.AppConfig.delete('evaluationCriteria', 'delete', { id });
            }
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('删除成功', 'success');
            }
            await this.showListView();
        } catch (error) {
            console.error('删除评价准则失败:', error);
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('删除失败', 'error');
            }
        }
    }

    async loadJobsFromAPI() {
        if (window.AppConfig && typeof window.AppConfig.post === 'function') {
            try {
                const result = await window.AppConfig.post('transformCompare', 'query', { pageNum: 1, pageSize: 100, name: null });
                if (result.success && result.data) {
                    this.jobs = result.data.map(job => ({
                        id: job.createTime || job.id || job.name,
                        name: job.name,
                        exportFile: job.exportFile || ''
                    }));
                } else {
                    this.jobs = [];
                }
            } catch (error) {
                console.error('加载Transform编排失败:', error);
                this.jobs = [];
            }
        } else {
            this.jobs = [];
        }

        this.populateJobSelects();
    }

    populateJobSelects() {
        const selects = this.shadowRoot.querySelectorAll('.ec-job-select');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">请选择编排</option>';
            this.jobs.forEach(job => {
                const option = document.createElement('option');
                option.value = job.id;
                option.textContent = job.name || job.id;
                option.title = `jobId: ${job.id}${job.exportFile ? ' | 导出: ' + job.exportFile : ''}`;
                select.appendChild(option);
            });
            if (currentValue) {
                select.value = currentValue;
            }
        });
    }

    getFormCriteria() {
        const name = this.shadowRoot.querySelector('#ecName')?.value.trim() || '';
        const description = this.shadowRoot.querySelector('#ecDescription')?.value.trim() || '';
        const form = { name, description };

        Object.keys(this.defaultWeights).forEach(dim => {
            const weightInput = this.shadowRoot.querySelector(`.ec-weight-input[data-dim="${dim}"]`);
            const jobSelect = this.shadowRoot.querySelector(`.ec-job-select[data-dim="${dim}"]`);
            const jobId = jobSelect ? jobSelect.value : '';
            const job = this.jobs.find(j => String(j.id) === String(jobId));
            form[dim] = {
                weight: weightInput ? parseFloat(weightInput.value) : this.defaultWeights[dim],
                transformId: jobId,
                name: job && job.name ? job.name : '',
                exportFile: job && job.exportFile ? job.exportFile : ''
            };
        });

        return form;
    }

    async saveCriteria() {
        const form = this.getFormCriteria();
        if (!form.name) {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('请输入准则名称', 'warning');
            }
            return;
        }

        const dims = Object.keys(this.defaultWeights);
        for (const dim of dims) {
            if (!form[dim] || !form[dim].transformId) {
                if (window.CommonUtils && window.CommonUtils.showToast) {
                    window.CommonUtils.showToast(`请选择${this.getDimLabel(dim)}的Transform编排`, 'warning');
                }
                return;
            }
        }

        const sum = dims.reduce((a, dim) => a + (isNaN(form[dim].weight) ? 0 : form[dim].weight), 0);
        if (Math.abs(sum - 1) > 0.001) {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('权重合计必须等于1', 'warning');
            }
            return;
        }

        if (this.editingId) {
            form.id = this.editingId;
        }

        try {
            await this.saveCriteriaToBackend(form);
            this.hideFormView();
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('保存成功', 'success');
            }
            await this.showListView();
        } catch (error) {
            console.error('保存评价准则失败:', error);
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast(error.message || '保存失败', 'error');
            }
        }
    }

    async saveCriteriaToBackend(form) {
        if (!window.AppConfig || typeof window.AppConfig.post !== 'function') {
            throw new Error('API未配置');
        }
        const result = await window.AppConfig.post('evaluationCriteria', 'save', form);
        if (!result.success) {
            throw new Error(result.message || '保存失败');
        }
        return result.data;
    }

    async submitTasks(criteria) {
        if (!criteria) return;
        const target = criteria;
        const dims = Object.keys(this.defaultWeights);
        const jobIds = {};
        for (const dim of dims) {
            const transformId = target.jobs && target.jobs[dim];
            if (!transformId) continue;
            try {
                const url = window.AppConfig.getApiUrl('transformJob', 'commit').replace('{createTime}', encodeURIComponent(transformId));
                const headers = window.AppConfig.getAuthHeaders();
                const response = await fetch(url, { method: 'PUT', headers });
                const result = await response.json();
                if (result.success || result.code === 200) {
                    const jobData = result.data;
                    jobIds[dim] = jobData ? (jobData.jobId || '') : '';
                } else {
                    console.warn(`${this.getDimLabel(dim)}提交返回:`, result.message);
                }
            } catch (error) {
                console.warn(`${this.getDimLabel(dim)}提交失败:`, error);
            }
        }

        const buildDim = (dim) => ({
            weight: target.weights && target.weights[dim],
            transformId: target.jobs && target.jobs[dim],
            jobId: jobIds[dim] || '',
            exportFile: target.exportFiles && target.exportFiles[dim],
            name: target.names && target.names[dim],
            score: null
        });

        try {
            const record = {
                criteriaId: target.id || target.createTime || null,
                criteriaName: target.name,
                description: target.description || '',
                qcom: buildDim('qcom'),
                qcon: buildDim('qcon'),
                qtim: buildDim('qtim'),
                qval: buildDim('qval'),
                dqi: '',
                passed: ''
            };
            const result = await window.AppConfig.post('qualityAssessment', 'save', record);
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('测评已提交', 'success');
            }
        } catch (error) {
            console.error('生成质量测评记录失败:', error);
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('任务已提交但生成测评记录失败', 'warning');
            }
        }
    }

    getDimLabel(dim) {
        const labels = { qcom: '完整性', qcon: '一致性', qtim: '时效性', qval: '有效性' };
        return labels[dim] || dim;
    }

    parseEntity(item) {
        if (!item) return item;
        ['weights', 'jobs', 'exportFiles', 'names'].forEach(field => {
            if (item[field] && typeof item[field] === 'string') {
                try { item[field] = JSON.parse(item[field]); }
                catch (e) { item[field] = {}; }
            }
        });
        return item;
    }
}

if (!customElements.get('evaluation-criteria')) {
    customElements.define('evaluation-criteria', EvaluationCriteria);
}
