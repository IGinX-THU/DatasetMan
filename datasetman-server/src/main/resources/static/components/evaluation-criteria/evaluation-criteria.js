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
        this.defaultWeights = { qcom: 0.25, qcon: 0.25, qtim: 0.25, qval: 0.25 };
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

        const titleEl = this.shadowRoot.querySelector('#ecModalTitle');
        if (titleEl) titleEl.textContent = record ? '编辑评价准则' : '新增评价准则';

        this.editingId = record ? (record.id || record.createTime) : null;
        const editIdInput = this.shadowRoot.querySelector('#ecEditId');
        if (editIdInput) editIdInput.value = this.editingId || '';

        const nameInput = this.shadowRoot.querySelector('#ecName');
        const descInput = this.shadowRoot.querySelector('#ecDescription');
        if (nameInput) {
            nameInput.value = record ? record.name || '' : '';
            nameInput.readOnly = !!record;
        }
        if (descInput) descInput.value = record ? record.description || '' : '';

        const dims = Object.keys(this.defaultWeights);
        dims.forEach(dim => {
            const weightInput = this.shadowRoot.querySelector(`.ec-weight-input[data-dim="${dim}"]`);
            const weight = record && record.weights && record.weights[dim] !== undefined ? record.weights[dim] : this.defaultWeights[dim];
            if (weightInput) weightInput.value = weight;
        });

        this.updateWeightSummary();

        const modal = this.shadowRoot.querySelector('#ecFormModal');
        if (modal) modal.hidden = false;
    }

    renderList() {
        const tbody = this.shadowRoot.querySelector('#ecTableBody');
        if (!tbody) return;

        if (this.criteriaList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="ec-empty">暂无评价准则，请点击"新增"添加。</td></tr>';
            return;
        }

        tbody.innerHTML = this.criteriaList.map((item, index) => {
            const w = dim => item.weights && item.weights[dim] !== undefined && item.weights[dim] !== null
                ? Number(item.weights[dim]).toFixed(2) : '-';
            return `
                <tr>
                    <td>${item.name || ''}</td>
                    <td>${item.description || ''}</td>
                    <td>${w('qcom')}</td>
                    <td>${w('qcon')}</td>
                    <td>${w('qtim')}</td>
                    <td>${w('qval')}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" data-index="${index}">编辑</button>
                            <button class="action-btn delete" data-index="${index}">删除</button>
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
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.showDeleteConfirm(this.criteriaList[index]);
            });
        });

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



    getFormCriteria() {
        const name = this.shadowRoot.querySelector('#ecName')?.value.trim() || '';
        const description = this.shadowRoot.querySelector('#ecDescription')?.value.trim() || '';
        const form = { name, description };

        Object.keys(this.defaultWeights).forEach(dim => {
            const weightInput = this.shadowRoot.querySelector(`.ec-weight-input[data-dim="${dim}"]`);
            form[dim] = { weight: weightInput ? parseFloat(weightInput.value) : this.defaultWeights[dim] };
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
