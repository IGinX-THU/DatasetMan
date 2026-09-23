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
        this._ready = this.loadResources().then(() => {
            this.bindEvents();
            this.initPagination();
        });
        await this._ready;
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

        this._pendingSelect = null;
        if (args.length > 0 && args[0]) {
            if (typeof args[0] === 'object' && args[0].versionId) {
                // 从数据集详情"质量评估"按钮跳转：预选数据集与版本
                this._pendingSelect = args[0];
            } else if (typeof args[0] === 'string') {
                const filterInput = this.querySelector('#qaFilterName');
                if (filterInput) filterInput.value = args[0];
            }
        }

        // 等待组件HTML就绪后再预填（首次打开时 show 可能早于异步模板加载）
        const ready = this._ready || Promise.resolve();
        ready.then(() => {
            this.loadCriteriaOptions();
            this.loadDatasetOptions();
        });
        this.loadRecords().then(() => this.showListView());
    }

    /** 加载数据集与版本下拉（来自数据集树） */
    async loadDatasetOptions() {
        const dsSelect = this.querySelector('#qaDatasetSelect');
        if (!dsSelect) return;
        try {
            const result = await window.AppConfig.get('dataset', 'tree');
            const tree = (result.success || result.code === 200) ? (result.data || []) : [];
            this.datasetTree = tree;
            dsSelect.innerHTML = '<option value="">请选择数据集</option>'
                + tree.map(d => `<option value="${this.escapeHtml(d.datasetName || '')}">${this.escapeHtml(d.datasetName || '')}</option>`).join('');
            // 预选（从数据集详情跳转）
            if (this._pendingSelect && this._pendingSelect.datasetName) {
                const name = this._pendingSelect.datasetName;
                if (tree.some(d => d.datasetName === name)) {
                    dsSelect.value = name;
                    this.fillVersionOptions(name, this._pendingSelect.versionId);
                }
            }
        } catch (error) {
            console.warn('加载数据集列表失败:', error);
        }
    }

    fillVersionOptions(datasetName, preferredVersionId) {
        const vSelect = this.querySelector('#qaVersionSelect');
        if (!vSelect) return;
        const group = (this.datasetTree || []).find(d => d.datasetName === datasetName);
        const versions = (group && group.versions) || [];
        vSelect.disabled = versions.length === 0;
        vSelect.innerHTML = versions.length === 0
            ? '<option value="">该数据集暂无版本</option>'
            : versions.map(v => `<option value="${v.versionId}">${this.escapeHtml(v.versionNo || v.versionId)}</option>`).join('');
        if (preferredVersionId != null) vSelect.value = String(preferredVersionId);
    }

    /** 加载评价准则下拉（供检测时选择权重方案） */
    async loadCriteriaOptions() {
        const select = this.querySelector('#qaCriteriaSelect');
        if (!select) return;
        try {
            if (!window.AppConfig || typeof window.AppConfig.post !== 'function') return;
            const result = await window.AppConfig.post('evaluationCriteria', 'query', { pageNum: 1, pageSize: 100 });
            const list = (result.success || result.code === 200) ? (result.data || []) : [];
            const current = select.value;
            select.innerHTML = '<option value="">默认权重（各20%）</option>'
                + list.map(c => `<option value="${c.id || c.createTime}">${this.escapeHtml(c.name || '')}</option>`).join('');
            if (current) select.value = current;
        } catch (error) {
            console.warn('加载评价准则失败:', error);
        }
    }

    escapeHtml(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** 质量自动检测：绑定数据集版本与评价准则，自动算分并生成报告 */
    async autoDetect() {
        const versionId = this.querySelector('#qaVersionSelect')?.value || '';
        const criteriaId = this.querySelector('#qaCriteriaSelect')?.value || '';
        const sampleSize = this.querySelector('#qaSampleSize')?.value.trim() || '200';
        if (!versionId) {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('请选择数据集与版本', 'error');
            } else {
                alert('请选择数据集与版本');
            }
            return;
        }
        const btn = this.querySelector('#qaAutoDetect');
        if (btn && btn.disabled) return; // 防止请求中二次提交
        if (btn) { btn.disabled = true; btn.textContent = '检测中...'; }
        try {
            const url = window.AppConfig.getApiUrl('qualityAssessment', 'autoDetect')
                + '?versionId=' + encodeURIComponent(versionId)
                + '&sampleSize=' + encodeURIComponent(sampleSize)
                + (criteriaId ? '&criteriaId=' + encodeURIComponent(criteriaId) : '');
            const json = await window.AppConfig.request(url, { method: 'POST' });
            if (!(json.success || json.code === 200)) {
                throw new Error(json.message || '检测失败');
            }
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('自动检测完成，评估报告已生成', 'success');
            }
            this.currentPage = 1;
            await this.loadRecords();
            this.showListView();
        } catch (error) {
            console.error('自动检测失败:', error);
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast(error.message || '自动检测失败', 'error');
            } else {
                alert(error.message || '自动检测失败');
            }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '自动检测并生成报告'; }
        }
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
                const datasetFilter = this.querySelector('#qaFilterDataset')?.value.trim() || null;
                const versionFilter = this.querySelector('#qaFilterVersion')?.value.trim() || null;
                const result = await window.AppConfig.post('qualityAssessment', 'query', { pageNum: this.currentPage, pageSize: this.pageSize, criteriaName: nameFilter, datasetName: datasetFilter, versionNo: versionFilter });
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
                const result = await window.AppConfig.post('qualityAssessment', 'count', { criteriaName: criteriaName || null, datasetName: this.querySelector('#qaFilterDataset')?.value.trim() || null, versionNo: this.querySelector('#qaFilterVersion')?.value.trim() || null });
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

        const printBtn = this.querySelector('#qaPrintReport');
        if (printBtn) printBtn.addEventListener('click', () => this.printReport());

        const autoDetectBtn = this.querySelector('#qaAutoDetect');
        if (autoDetectBtn) autoDetectBtn.addEventListener('click', () => this.autoDetect());

        const dsSelect = this.querySelector('#qaDatasetSelect');
        if (dsSelect) dsSelect.addEventListener('change', () => this.fillVersionOptions(dsSelect.value, null));

        // 表头筛选：输入即自动查询（防抖300ms）
        let debounceTimer = null;
        this.querySelectorAll('[qa-auto-filter]').forEach(input => {
            input.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.currentPage = 1;
                    this.loadRecords().then(() => this.showListView());
                }, 300);
            });
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
        
        // 从 detailJson 解析请求行数和实际抽样行数，动态拼描述（覆盖数据库里存的旧 description）
        // 注意：detailJson 已在 parseEntity() 里被 JSON.parse 成对象了，这里直接用
        let description = record.description || '';
        const detail = record.detailJson || {};
        const requestSize = detail.requestSize;
        const actualSize = detail.sampleSize;
        if (actualSize != null) {
            const sampleInfo = requestSize != null
                ? `请求 ${requestSize} 行，实际抽样 ${actualSize} 行`
                : `抽样 ${actualSize} 行`;
            // 去掉旧描述末尾的括号部分，换成新的 sampleInfo
            const base = description.replace(/（.*抽样.*）$/, '').trim();
            description = `${base}（${sampleInfo}）`;
        }
        if (descEl) descEl.textContent = description;

        this.setText('#qaDatasetName', record.datasetName || '-');
        this.setText('#qaVersionNo', record.versionNo || '-');
        
        // 隐藏抽样信息元素（已整合到描述中）
        const sampleInfoEl = this.querySelector('#qaSampleInfo');
        if (sampleInfoEl) sampleInfoEl.textContent = '';
        
        this.calculateDqi();
        this.loadReport(record);
    }

    setText(selector, value) {
        const el = this.querySelector(selector);
        if (el) el.textContent = value == null ? '-' : value;
    }


    /** 加载并渲染自动生成的评估报告 */
    async loadReport(record) {
        const area = this.querySelector('#qaReportArea');
        const printBtn = this.querySelector('#qaPrintReport');
        if (!area) return;
        const key = this.getRecordKey(record);
        try {
            const result = await window.AppConfig.get('qualityAssessment', 'report', { id: key });
            const raw = (result.success || result.code === 200) ? result.data : null;
            let report = null;
            if (raw) {
                try { report = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { report = null; }
            }
            if (!report) {
                area.innerHTML = '<div class="qa-empty">暂无自动生成报告（该记录为人工配置记录）。</div>';
                if (printBtn) printBtn.style.display = 'none';
                this._report = null;
                return;
            }
            this._report = report;
            const threshold = 95;
            const dims = (report.dimensions || []).map(d => {
                const score = Number(d.score) || 0;
                const failed = score < threshold;
                return `
                <tr style="${failed ? 'background:#fff1f0;' : ''}">
                    <td>${d.name}</td>
                    <td>${d.score}${failed ? ' <span style="color:#ff4d4f;font-size:11px;">(未通过，小于95分)</span>' : ''}</td>
                    <td>${d.weight != null ? (Number(d.weight) * 100).toFixed(0) + '%' : '-'}</td>
                    <td>${d.grade}</td>
                    <td style="max-width:280px;">${d.evidence || '-'}</td>
                    <td style="max-width:280px;">${d.suggestion || '-'}</td>
                </tr>`;
            }).join('');
            // detailJson 已在 parseEntity() 里被 JSON.parse 成对象，这里直接用
            let sampleInfo = '';
            const detail = record.detailJson || {};
            if (detail.sampleSize != null) {
                const req = detail.requestSize;
                const actual = detail.sampleSize;
                sampleInfo = req != null
                    ? `<div style="font-size:12px;color:#666;margin-top:4px;">请求 ${req} 行，实际抽样 ${actual} 行</div>`
                    : `<div style="font-size:12px;color:#666;margin-top:4px;">抽样 ${actual} 行</div>`;
            }
            const wmCfg = (window.AppConfig && window.AppConfig.watermark) || {};
            const wmText = wmCfg.text || '清华大学大数据系统软件国家工程研究中心';
            area.innerHTML = `
                <div class="qa-section-title" style="position:relative;">
                    质量评估报告（自动生成）
                    <span style="position:absolute;right:0;top:0;font-size:11px;color:#bbb;transform:rotate(-6deg);pointer-events:none;user-select:none;">${this.escapeHtml(wmText)}</span>
                </div>
                ${sampleInfo}
                <div class="qa-dqi-card" style="display:flex;">
                    <div>
                        <div class="qa-dqi-label">综合得分（权重加权，默认各20%）</div>
                        <div class="qa-dqi-value">${report.score ?? report.dqi}</div>
                    </div>
                    <div style="margin-left:24px;align-self:center;">
                        <div>质量等级：<b>${report.grade || '-'}</b></div>
                        <div>测评维度数：${report.dimensionCount || (report.dimensions || []).length}</div>
                    </div>
                    <div style="margin-left:24px;align-self:center;color:#555;font-size:13px;max-width:420px;">
                        ${report.conclusion || ''}
                    </div>
                </div>
                <table class="data-table" style="margin-top:12px;">
                    <thead><tr><th>维度</th><th>得分</th><th>权重</th><th>评级</th><th>评分依据</th><th>改进建议</th></tr></thead>
                    <tbody>${dims}</tbody>
                </table>
                <div style="margin-top:10px;font-size:13px;"><b>问题明细：</b><ul>${(report.issues || []).map(i => `<li>${i}</li>`).join('')}</ul></div>
                <div style="font-size:13px;"><b>整改建议：</b><ul>${(report.recommendations || []).map(i => `<li>${i}</li>`).join('')}</ul></div>
            `;
            if (printBtn) printBtn.style.display = '';
        } catch (error) {
            console.warn('加载报告失败:', error);
            area.innerHTML = '<div class="qa-empty">报告加载失败。</div>';
            if (printBtn) printBtn.style.display = 'none';
        }
    }

    /** 打印/导出PDF */
    /** 生成带页眉/水印/页脚的正式评估报告并打印导出（复用 CommonUtils.LocalPDFGenerator） */
    printReport() {
        if (!this._report || !this.currentRecord) {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('请先打开一条含报告的测评记录', 'info');
            }
            return;
        }
        if (!window.CommonUtils || typeof window.CommonUtils.LocalPDFGenerator !== 'function') {
            // 组件脚本未加载时回退为简单打印
            const raw = this._report;
            const win = window.open('', '_blank');
            win.document.write('<pre>' + JSON.stringify(raw, null, 2) + '</pre>');
            win.document.close();
            win.print();
            return;
        }
        const report = this._report;
        const record = this.currentRecord;
        const gen = new window.CommonUtils.LocalPDFGenerator();

        gen.addWatermark();
        gen.addTitle('数据集质量评估报告');

        gen.addSubtitle('一、基本信息');
        gen.addText('数据集名称: ' + (record.datasetName || '-'));
        gen.addText('数据集版本: ' + (record.versionNo || '-'));
        gen.addText('评价准则: ' + (report.criteriaName || record.criteriaName || '-'));
        const detail = record.detailJson || {};
        gen.addText('抽样规模: ' + (detail.sampling
            || ('实际抽样 ' + (detail.sampleSize != null ? detail.sampleSize : '-') + ' 行')));
        gen.addText('测评时间: ' + (report.createTime ? new Date(report.createTime).toLocaleString() : '-'));
        gen.addText('测评人: ' + (report.operator || '-'));
        gen.addSeparator();

        gen.addSubtitle('二、检测结论');
        gen.addText('综合得分 DQI: ' + (report.score != null ? report.score : report.dqi)
            + '（权重加权，达标线95分）', 12, true);
        gen.addText('质量等级: ' + (report.grade || '-'));
        gen.addText('达标情况: ' + (report.passed ? '通过' : '未通过'));
        gen.addText('结论: ' + (report.conclusion || '-'));

        gen.addSubtitle('三、维度得分明细');
        const rows = (report.dimensions || []).map(d => [
            d.name || d.code,
            String(d.score),
            d.weight != null ? (Number(d.weight) * 100).toFixed(0) + '%' : '-',
            d.grade || '-',
            d.evidence || '-'
        ]);
        gen.addTable(['维度', '得分', '权重', '评级', '评分依据（不满足规则的数据项摘要）'], rows);

        gen.addSubtitle('四、问题明细');
        (report.issues || []).forEach(i => gen.addText('· ' + i));
        gen.addSeparator();

        gen.addSubtitle('五、整改建议');
        (report.recommendations || []).forEach(i => gen.addText('· ' + i));

        gen.generateAndDownload('数据集质量评估报告');
    }

    renderList() {
        const tbody = this.querySelector('#qaTableBody');
        if (!tbody) return;

        if (this.records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="qa-empty">暂无测评记录，请在"评价准则"列表点击"提交任务"。</td></tr>';
            return;
        }

        tbody.innerHTML = this.records.map((item, index) => {
            const score = (dim) => item.scores && item.scores[dim] != null ? Number(item.scores[dim]).toFixed(2) : '-';
            return `
                <tr>
                    <td>${item.datasetName || '-'}</td>
                    <td>${item.versionNo || '-'}</td>
                    <td>${item.criteriaName || ''}</td>
                    <td>${item.detailJson && item.detailJson.sampleSize != null ? item.detailJson.sampleSize : '-'}</td>
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

        const recordScores = this.ensureParsed(record, 'scores');
        dims.forEach(dim => {
            const w = weights[dim] !== undefined ? parseFloat(weights[dim]) : 0;
            const score = recordScores[dim] != null ? parseFloat(recordScores[dim]) : NaN;
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
        const threshold = 95; // 4.3.1.6 达标线
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
        ['weights', 'jobs', 'jobIds', 'exportFiles', 'names', 'scores', 'detailJson'].forEach(field => {
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
