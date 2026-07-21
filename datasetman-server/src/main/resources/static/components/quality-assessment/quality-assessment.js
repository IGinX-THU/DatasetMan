/**
 * 质量测评组件
 * 展示“评价准则”提交生成的测评记录列表；
 * 点击“综合质量得分”进入详情页，综合展示 4 个 Transform 任务的 jobId、导出文件名、状态，
 * 并支持输入各维度得分，按准则权重自动计算 DQI。
 */
class QualityAssessment extends HTMLElement {
    constructor() {
        super();
        this.style.display = 'none';
        this.records = [];
        this.dimensionLabels = {
            qcom: '完整性',
            qcon: '一致性',
            qtim: '时效性',
            qval: '有效性'
        };
        this.pageSize = 10;
        this.currentPage = 1;
        this.totalCount = 0;
        this.statusMap = {
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
    }

    async connectedCallback() {
        await this.loadResources();
        this.bindEvents();
        this.initPagination();
    }

    async loadResources() {
        this.innerHTML = `
            <link rel="stylesheet" href="./components/quality-assessment/quality-assessment.css">
            <link rel="stylesheet" href="./components/common-pagination/common-pagination.css">
        `;

        if (window.location.protocol === 'file:') {
            this.innerHTML += this.getFallbackHTML();
        } else {
            try {
                const response = await fetch('./components/quality-assessment/quality-assessment.html');
                const html = await response.text();
                this.innerHTML += html;
            } catch (error) {
                console.error('Failed to load HTML:', error);
                this.innerHTML += this.getFallbackHTML();
            }
        }
    }

    getFallbackHTML() {
        return `<div class="qa-container">
            <div class="qa-toolbar"><div class="qa-title">质量测评</div></div>
            <div class="qa-content"><div class="qa-empty">加载失败，请刷新重试。</div></div>
        </div>`;
    }

    show(...args) {
        this.style.display = 'block';

        if (args.length > 0 && args[0]) {
            const filterInput = this.querySelector('#qaFilterName');
            if (filterInput) {
                filterInput.value = args[0];
            }
        }

        this.loadRecords().then(() => this.showListView());
    }

    hide() {
        this.style.display = 'none';
    }

    initPagination() {
        const pagination = this.querySelector('#qaPagination');
        if (pagination) {
            pagination.addEventListener('pagination-change', (e) => {
                this.currentPage = e.detail.currentPage;
                this.loadRecords().then(() => this.renderList());
            });
        }
    }

    updatePagination() {
        const pagination = this.querySelector('#qaPagination');
        if (pagination && typeof pagination.setPagination === 'function') {
            pagination.setPagination(this.currentPage, this.pageSize, this.totalCount);
        }
    }

    async loadRecords() {
        try {
            if (window.AppConfig && typeof window.AppConfig.post === 'function') {
                const nameFilter = this.querySelector('#qaFilterName')?.value.trim() || null;
                const result = await window.AppConfig.post('qualityAssessment', 'query', { pageNum: this.currentPage, pageSize: this.pageSize, criteriaName: nameFilter });
                console.log('[QA] loadRecords result=', result);
                this.records = result.success && result.data ? result.data.map(item => this.parseEntity(item)) : [];
                console.log('[QA] loadRecords parsed records=', this.records);
                if (this.currentPage === 1) {
                    await this.loadRecordsCount(nameFilter);
                }
            } else {
                this.records = [];
            }
        } catch (error) {
            console.error('加载测评记录失败:', error);
            this.records = [];
        }
    }

    async loadRecordsCount(criteriaName) {
        try {
            if (window.AppConfig && typeof window.AppConfig.post === 'function') {
                const result = await window.AppConfig.post('qualityAssessment', 'count', { criteriaName: criteriaName || null });
                console.log('[QA] count result=', result);
                if (result.success && result.data !== undefined) {
                    this.totalCount = parseInt(result.data, 10) || 0;
                } else {
                    this.totalCount = this.records.length;
                }
                this.updatePagination();
            }
        } catch (error) {
            console.error('获取测评记录总数失败:', error);
            this.totalCount = this.records.length;
            this.updatePagination();
        }
    }

    bindEvents() {
        const backBtn = this.querySelector('#qaBackBtn');
        if (backBtn) backBtn.addEventListener('click', () => this.showListView());

        const queryBtn = this.querySelector('#qaQueryBtn');
        if (queryBtn) queryBtn.addEventListener('click', () => this.queryAndRenderTasks());

        const saveBtn = this.querySelector('#qaSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveScores());

        const applyFilters = this.querySelector('#qaApplyFilters');
        if (applyFilters) applyFilters.addEventListener('click', () => {
            this.currentPage = 1;
            this.loadRecords().then(() => this.showListView());
        });

        const resetFilters = this.querySelector('#qaResetFilters');
        if (resetFilters) resetFilters.addEventListener('click', () => {
            const filterInput = this.querySelector('#qaFilterName');
            if (filterInput) filterInput.value = '';
            this.currentPage = 1;
            this.loadRecords().then(() => this.showListView());
        });

        const tableBody = this.querySelector('#qaTableBody');
        if (tableBody) {
            tableBody.addEventListener('click', (e) => {
                const indexAttr = e.target.dataset.index;
                if (indexAttr === undefined) return;
                const index = parseInt(indexAttr);
                if (e.target.classList.contains('action-btn') && e.target.classList.contains('edit')) {
                    const key = this.getRecordKey(this.records[index]);
                    if (key) this.showDetailView(key);
                }
            });
        }
    }

    showListView() {
        const listView = this.querySelector('#qaListView');
        const detailView = this.querySelector('#qaDetailView');
        if (listView) listView.style.display = 'block';
        if (detailView) detailView.style.display = 'none';
        this.renderList();
    }

    showDetailView(key) {
        const listView = this.querySelector('#qaListView');
        const detailView = this.querySelector('#qaDetailView');
        if (listView) listView.style.display = 'none';
        if (detailView) detailView.style.display = 'block';

        const record = this.records.find(r => this.getRecordKey(r) === key);
        console.log('[QA] showDetailView key=', key, 'record=', record ? { id: record.id, createTime: record.createTime, criteriaName: record.criteriaName, scores: record.scores } : null);
        this.currentRecord = record || null;
        if (!record) {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('未找到测评记录', 'error');
            }
            this.showListView();
            return;
        }

        const recordIdInput = this.querySelector('#qaRecordId');
        if (recordIdInput) recordIdInput.value = record.id;

        const nameEl = this.querySelector('#qaCriteriaName');
        const descEl = this.querySelector('#qaCriteriaDescription');
        if (nameEl) nameEl.textContent = record.criteriaName || '-';
        if (descEl) descEl.textContent = record.description || '';

        this.renderDimensionTasks(record);
        this.calculateDqi();
        this.queryAndRenderTasks();
    }

    renderList() {
        const tbody = this.querySelector('#qaTableBody');
        if (!tbody) return;

        if (this.records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="qa-empty">暂无测评记录，请在"评价准则"列表点击"提交任务"。</td></tr>';
            return;
        }

        tbody.innerHTML = this.records.map((item, index) => {
            const score = (dim) => item.scores && item.scores[dim] != null ? Number(item.scores[dim]).toFixed(2) : '-';
            return `
                <tr>
                    <td>${item.criteriaName || ''}</td>
                    <td>${this.formatTime(item.createTime)}</td>
                    <td>${score('qcom')}</td>
                    <td>${score('qcon')}</td>
                    <td>${score('qtim')}</td>
                    <td>${score('qval')}</td>
                    <td>${item.dqi != null && item.dqi !== '' ? Number(item.dqi).toFixed(2) : '-'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" data-index="${index}">综合质量得分</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    formatTime(ts) {
        if (!ts) return '';
        const date = new Date(Number(ts));
        return isNaN(date.getTime()) ? String(ts) : date.toLocaleString();
    }

    renderDimensionTasks(record) {
        const container = this.querySelector('#qaDimensionTasks');
        if (!container) return;

        console.log('[QA] renderDimensionTasks scores raw=', record.scores, 'type=', typeof record.scores);
        const scores = this.ensureParsed(record, 'scores');
        const weights = this.ensureParsed(record, 'weights');
        const jobIds = this.ensureParsed(record, 'jobIds');
        const exportFiles = this.ensureParsed(record, 'exportFiles');
        const names = this.ensureParsed(record, 'names');
        console.log('[QA] ensureParsed scores=', scores, 'weights=', weights);

        const dims = ['qcom', 'qcon', 'qtim', 'qval'];
        container.innerHTML = dims.map(dim => {
            const label = this.dimensionLabels[dim];
            const jobId = jobIds[dim] || '-';
            const exportFile = exportFiles[dim] || '-';
            const name = names[dim] || '';
            const weight = weights[dim] !== undefined ? weights[dim] : '';
            const score = scores[dim] != null ? scores[dim] : '';
            if (dim === 'qcom') console.log('[QA] qcom score=', score);
            return `
                <div class="qa-dim-task-row" data-dim="${dim}">
                    <span class="qa-dim-label">${label}</span>
                    <div class="qa-dim-info">
                        <div class="qa-dim-info-item">
                            <span class="qa-dim-info-label">jobId：</span>
                            <span class="qa-dim-info-value qa-dim-job" id="qaJob_${dim}">${jobId}</span>
                        </div>
                        <div class="qa-dim-info-item">
                            <span class="qa-dim-info-label">作业名称：</span>
                            <span class="qa-dim-info-value">${name || '-'}</span>
                        </div>
                        <div class="qa-dim-info-item">
                            <span class="qa-dim-info-label">导出文件名：</span>
                            <span class="qa-dim-info-value">${exportFile}</span>
                        </div>
                        <div class="qa-dim-info-item">
                            <span class="qa-dim-info-label">权重：</span>
                            <span class="qa-dim-info-value">${weight !== '' ? Number(weight).toFixed(2) : '-'}</span>
                        </div>
                        <div class="qa-dim-info-item">
                            <span class="qa-dim-info-label">状态：</span>
                            <span class="qa-dim-info-value qa-dim-status" id="qaStatus_${dim}">未查询</span>
                        </div>
                    </div>
                    <div class="qa-dim-score">
                        <label>得分 (0-100)</label>
                        <input type="number" min="0" max="100" step="0.01" class="qa-score-input" data-dim="${dim}" value="${score}" required>
                    </div>
                </div>
            `;
        }).join('');

        this.querySelectorAll('.qa-score-input').forEach(input => {
            input.addEventListener('input', () => this.calculateDqi());
            input.addEventListener('change', () => this.calculateDqi());
        });
    }

    async queryAndRenderTasks() {
        const record = this.currentRecord;
        if (!record) return;

        const jobIds = this.ensureParsed(record, 'jobIds');
        const dims = ['qcom', 'qcon', 'qtim', 'qval'];
        let successCount = 0;
        let failCount = 0;
        for (const dim of dims) {
            const jobId = jobIds[dim] || '';
            if (!jobId) continue;
            try {
                const detail = await this.fetchJobDetail(jobId);
                const statusEl = this.querySelector(`#qaStatus_${dim}`);
                if (statusEl) {
                    const code = detail && detail.jobState;
                    const text = detail ? (this.statusMap[code] || '未知') : '查询失败';
                    statusEl.textContent = text;
                    statusEl.className = 'qa-dim-info-value qa-dim-status ' + this.getStatusClass(code);
                }
                if (detail) { successCount++; } else { failCount++; }
            } catch (error) {
                console.warn(`查询${this.dimensionLabels[dim]}任务失败:`, error);
                failCount++;
                const statusEl = this.querySelector(`#qaStatus_${dim}`);
                if (statusEl) {
                    statusEl.textContent = '查询失败';
                    statusEl.className = 'qa-dim-info-value qa-dim-status qa-status-fail';
                }
            }
        }

        if (window.CommonUtils && window.CommonUtils.showToast) {
            if (failCount > 0) {
                window.CommonUtils.showToast(`查询完成：${successCount}个成功，${failCount}个失败`, 'warning');
            } else if (successCount > 0) {
                window.CommonUtils.showToast('任务查询完成', 'success');
            } else {
                window.CommonUtils.showToast('暂无可查询的任务', 'info');
            }
        }
    }

    async fetchJobDetail(jobId) {
        if (!window.AppConfig || typeof window.AppConfig.getApiUrl !== 'function') {
            return null;
        }
        try {
            const url = window.AppConfig.getApiUrl('transformJob', 'status').replace('{jobId}', encodeURIComponent(jobId));
            const headers = window.AppConfig.getAuthHeaders();
            const response = await fetch(url, { method: 'GET', headers });
            const result = await response.json();
            if (result.code === 200 || result.success) {
                return result.data;
            }
        } catch (error) {
            console.warn('查询任务状态失败:', error);
        }
        return null;
    }

    getStatusClass(code) {
        if (code === 1) return 'qa-status-pass';
        if (code === 4 || code === 3) return 'qa-status-running';
        if (code === 2) return 'qa-status-created';
        if ([5, 6, 7, 8].includes(code)) return 'qa-status-fail';
        if ([9, 10].includes(code)) return 'qa-status-fail';
        return '';
    }

    calculateDqi() {
        const record = this.currentRecord;
        if (!record) return;

        const weights = this.ensureParsed(record, 'weights');
        const dims = ['qcom', 'qcon', 'qtim', 'qval'];
        let sum = 0;
        let allFilled = true;
        const scores = {};

        dims.forEach(dim => {
            const input = this.querySelector(`.qa-score-input[data-dim="${dim}"]`);
            const w = weights[dim] !== undefined ? parseFloat(weights[dim]) : 0;
            const score = parseFloat(input ? input.value : NaN);
            if (isNaN(score) || score < 0 || score > 100) {
                allFilled = false;
            } else {
                scores[dim] = score;
                sum += score * w;
            }
        });

        const card = this.querySelector('#qaDqiCard');
        const valueEl = this.querySelector('#qaDqiValue');
        const statusEl = this.querySelector('#qaStatus');
        if (!card || !valueEl || !statusEl) return;

        card.style.display = 'flex';

        if (!allFilled) {
            valueEl.textContent = '-';
            statusEl.textContent = '-';
            statusEl.className = 'qa-status';
            return;
        }

        const dqi = Math.round(sum * 100) / 100;
        const threshold = 95;
        const passed = dqi >= threshold &&
            scores.qcom >= threshold &&
            scores.qcon >= threshold &&
            scores.qtim >= threshold &&
            scores.qval >= threshold;

        valueEl.textContent = dqi.toFixed(2);
        statusEl.textContent = passed ? '通过' : '未通过';
        statusEl.className = `qa-status ${passed ? 'qa-status-pass' : 'qa-status-fail'}`;

        this.currentDqi = dqi;
        this.currentPassed = passed;
    }

    async saveScores() {
        const record = this.currentRecord;
        if (!record) return;

        const weights = this.ensureParsed(record, 'weights');
        const dims = ['qcom', 'qcon', 'qtim', 'qval'];
        const scores = {};
        let dqi = 0;
        let valid = true;

        dims.forEach(dim => {
            const input = this.querySelector(`.qa-score-input[data-dim="${dim}"]`);
            const w = weights[dim] !== undefined ? parseFloat(weights[dim]) : 0;
            const value = parseFloat(input ? input.value : NaN);
            if (isNaN(value) || value < 0 || value > 100) {
                valid = false;
                return;
            }
            scores[dim] = value;
            dqi += value * w;
        });

        if (!valid) {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('请输入合法的维度得分（0-100）', 'error');
            }
            return;
        }

        dqi = Math.round(dqi * 100) / 100;
        const threshold = 95;
        const passed = dqi >= threshold &&
            scores.qcom >= threshold &&
            scores.qcon >= threshold &&
            scores.qtim >= threshold &&
            scores.qval >= threshold;

        record.scores = scores;
        record.dqi = dqi;
        record.passed = passed;

        try {
            if (!window.AppConfig || typeof window.AppConfig.post !== 'function') {
                throw new Error('API未配置');
            }
            const eWeights = this.ensureParsed(record, 'weights');
            const eJobs = this.ensureParsed(record, 'jobs');
            const eJobIds = this.ensureParsed(record, 'jobIds');
            const eExportFiles = this.ensureParsed(record, 'exportFiles');
            const eNames = this.ensureParsed(record, 'names');
            const buildDim = (dim) => ({
                weight: eWeights[dim],
                transformId: eJobs[dim],
                jobId: eJobIds[dim],
                exportFile: eExportFiles[dim],
                name: eNames[dim],
                score: scores[dim]
            });
            const recordToSave = {
                id: record.id || record.createTime,
                criteriaId: record.criteriaId,
                criteriaName: record.criteriaName,
                description: record.description || '',
                qcom: buildDim('qcom'),
                qcon: buildDim('qcon'),
                qtim: buildDim('qtim'),
                qval: buildDim('qval'),
                dqi: dqi.toFixed(2),
                passed: String(passed)
            };
            const result = await window.AppConfig.post('qualityAssessment', 'save', recordToSave);
            if (!result.success) {
                throw new Error(result.message || '保存失败');
            }
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('保存成功', 'success');
            }
            this.calculateDqi();
            await this.loadRecords();
            const key = this.getRecordKey(this.currentRecord);
            const updatedRecord = key ? this.records.find(r => this.getRecordKey(r) === key) : null;
            if (updatedRecord) {
                this.currentRecord = updatedRecord;
            }
            this.renderDimensionTasks(this.currentRecord);
            this.calculateDqi();
            this.queryAndRenderTasks();
        } catch (error) {
            console.error('保存得分失败:', error);
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast(error.message || '保存失败', 'error');
            }
        }
    }

    getRecordKey(record) {
        if (!record) return null;
        if (record.id != null) return String(record.id);
        if (record.createTime != null) return String(record.createTime);
        return null;
    }

    ensureParsed(record, field) {
        if (!record[field]) return {};
        if (typeof record[field] === 'string') {
            try {
                const parsed = JSON.parse(record[field]);
                if (typeof parsed === 'string') {
                    try { return JSON.parse(parsed); }
                    catch (e2) { return {}; }
                }
                return parsed;
            } catch (e) { return {}; }
        }
        return record[field];
    }

    parseEntity(item) {
        if (!item) return item;
        console.log('[QA] parseEntity raw item=', item);
        ['weights', 'jobs', 'jobIds', 'exportFiles', 'names', 'scores'].forEach(field => {
            if (item[field] && typeof item[field] === 'string') {
                try {
                    item[field] = JSON.parse(item[field]);
                    if (typeof item[field] === 'string') {
                        try { item[field] = JSON.parse(item[field]); }
                        catch (e2) { item[field] = {}; }
                    }
                } catch (e) { item[field] = {}; }
            } else if (item[field] == null) {
                item[field] = {};
            }
        });
        return item;
    }
}

if (!customElements.get('quality-assessment')) {
    customElements.define('quality-assessment', QualityAssessment);
}
