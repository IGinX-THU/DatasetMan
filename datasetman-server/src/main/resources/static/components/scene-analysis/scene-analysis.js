/**
 * 场景分析组件：数据类型统计、数据集关系提取、影响范围分析、质量评估报告、标准包导出。
 * 对应后端接口：
 *   GET  /api/dataset/categories
 *   GET  /api/dataset/relations
 *   GET  /api/dataset/impact
 *   POST /api/dataset/export-package
 *   GET  /api/quality-assessment/report
 */
class SceneAnalysis extends HTMLElement {
    constructor() {
        super();
        this.style.display = 'none';
    }

    async connectedCallback() {
        await this.loadResources();
        this.bindEvents();
    }

    async loadResources() {
        this.innerHTML = `
            <link rel="stylesheet" href="./components/scene-analysis/scene-analysis.css">
        `;
        try {
            const response = await fetch('./components/scene-analysis/scene-analysis.html');
            this.innerHTML += await response.text();
        } catch (error) {
            console.error('Failed to load scene-analysis HTML:', error);
        }
    }

    show() {
        this.style.display = 'block';
        this.loadCategories();
    }

    hide() {
        this.style.display = 'none';
    }

    async apiGet(url) {
        const headers = (window.AppConfig && window.AppConfig.getAuthHeaders())
            ? window.AppConfig.getAuthHeaders() : { 'Content-Type': 'application/json' };
        const response = await fetch(url, { method: 'GET', headers });
        const result = await response.json();
        return (result.code === 200 || result.success) ? result.data : null;
    }

    async apiPost(url) {
        const headers = (window.AppConfig && window.AppConfig.getAuthHeaders())
            ? window.AppConfig.getAuthHeaders() : { 'Content-Type': 'application/json' };
        const response = await fetch(url, { method: 'POST', headers });
        const result = await response.json();
        return (result.code === 200 || result.success) ? result.data : null;
    }

    bindEvents() {
        // tab 切换
        this.querySelectorAll('.sa-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.querySelectorAll('.sa-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const name = tab.dataset.tab;
                ['Category', 'Relation', 'Impact', 'Report'].forEach(v => {
                    const el = this.querySelector('#sa' + v + 'View');
                    if (el) el.style.display = (v.toLowerCase() === name) ? 'block' : 'none';
                });
                if (name === 'category') this.loadCategories();
            });
        });

        this.querySelector('#saRelationApply')?.addEventListener('click', () => this.loadRelations());
        this.querySelector('#saImpactApply')?.addEventListener('click', () => this.loadImpact());
        this.querySelector('#saExportPackage')?.addEventListener('click', () => this.exportPackage());
        this.querySelector('#saReportApply')?.addEventListener('click', () => this.loadReport());
        this.querySelector('#saReportPrint')?.addEventListener('click', () => this.printReport());
        this.querySelector('#saAutoDetect')?.addEventListener('click', () => this.autoDetect());
    }

    async autoDetect() {
        const container = this.querySelector('#saReportResult');
        const versionId = this.querySelector('#saDetectVersionId')?.value.trim();
        if (!versionId) {
            container.innerHTML = '<div class="qa-empty">请输入数据集版本ID。</div>';
            return;
        }
        container.innerHTML = '<div class="qa-empty">正在对数据集实际数据抽样检测...</div>';
        const sampleSize = this.querySelector('#saSampleSize')?.value.trim() || '200';
        const entity = await this.apiPost('/api/quality-assessment/auto-detect?versionId=' + encodeURIComponent(versionId)
            + '&sampleSize=' + encodeURIComponent(sampleSize));
        if (!entity) {
            container.innerHTML = '<div class="qa-empty">自动检测失败：版本不存在或无权限。</div>';
            return;
        }
        // 检测完成后立即展示自动生成的报告
        const idInput = this.querySelector('#saReportId');
        if (idInput) idInput.value = entity.id || entity.createTime;
        await this.loadReport();
    }

    async loadCategories() {
        const tbody = this.querySelector('#saCategoryTableBody');
        const summary = this.querySelector('#saCategorySummary');
        const data = await this.apiGet('/api/dataset/categories');
        if (!data || !data.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="qa-empty">暂无分类数据。</td></tr>';
            summary.textContent = '';
            return;
        }
        const totalSamples = data.reduce((s, d) => s + (d.totalRowCount || 0), 0);
        const covered = data.filter(d => d.datasetCount > 0).length;
        summary.textContent = `已覆盖 ${covered} 类数据类型，样本总量 ${totalSamples.toLocaleString()} 条`;
        tbody.innerHTML = data.map(d => `
            <tr>
                <td>${d.label}</td>
                <td>${d.datasetCount}</td>
                <td>${d.versionCount}</td>
                <td>${(d.totalRowCount || 0).toLocaleString()}</td>
                <td>${(d.datasetNames || []).join(', ')}</td>
            </tr>`).join('');
    }

    async loadRelations() {
        const tbody = this.querySelector('#saRelationTableBody');
        tbody.innerHTML = '<tr><td colspan="4" class="qa-empty">提取中...</td></tr>';
        const name = this.querySelector('#saRelationFilter')?.value.trim();
        const url = '/api/dataset/relations' + (name ? '?datasetName=' + encodeURIComponent(name) : '');
        const data = await this.apiGet(url);
        if (!data || !data.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="qa-empty">未提取到关系。</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(r => `
            <tr>
                <td>${r.fromDataset}</td>
                <td><span class="sa-relation-badge sa-relation-${r.relationType}">${r.relationLabel}</span></td>
                <td>${r.toDataset}</td>
                <td>${r.evidence || ''}</td>
            </tr>`).join('');
    }

    async loadImpact() {
        const container = this.querySelector('#saImpactResult');
        const versionId = this.querySelector('#saImpactVersionId')?.value.trim();
        if (!versionId) {
            container.innerHTML = '<div class="qa-empty">请输入版本ID。</div>';
            return;
        }
        container.innerHTML = '<div class="qa-empty">分析中...</div>';
        const data = await this.apiGet('/api/dataset/impact?versionId=' + encodeURIComponent(versionId));
        if (!data) {
            container.innerHTML = '<div class="qa-empty">分析失败：版本不存在或无权限。</div>';
            return;
        }
        const rows = (data.impactedVersions || []);
        const item = rows.map(v => `
            <tr>
                <td>${v.datasetName}</td><td>${v.versionNo}</td><td>${v.provenanceLabel || v.provenanceType || ''}</td>
                <td>${v.depth}</td><td>${v.path || ''}</td><td>${(v.rowCount || 0).toLocaleString()}</td>
            </tr>`).join('');
        container.innerHTML = `
            <div class="parsing-table-card">
                <div class="sa-summary">
                    焦点版本 ${data.datasetName || ''} ${data.versionNo || ''}：
                    受影响数据集 <b>${(data.impactedDatasets || []).length}</b> 个，
                    受影响版本 <b>${rows.length}</b> 个，
                    最大级联深度 <b>${data.maxDepth || 0}</b>，
                    下游样本量合计 <b>${(data.impactedRowCount || 0).toLocaleString()}</b> 条
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>数据集</th><th>版本</th><th>产出方式</th><th>级联深度</th><th>版本链路径</th><th>样本量</th></tr></thead>
                        <tbody>${item || '<tr><td colspan="6" class="qa-empty">该版本没有下游依赖。</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    async exportPackage() {
        const versionId = this.querySelector('#saImpactVersionId')?.value.trim();
        if (!versionId) {
            alert('请先输入版本ID再导出标准数据集包。');
            return;
        }
        const data = await this.apiPost('/api/dataset/export-package?versionId=' + encodeURIComponent(versionId));
        if (data) {
            alert('标准化数据集清单已生成并写入服务器导出目录（manifest.json）。\n\n' + JSON.stringify(data, null, 2).slice(0, 1500));
        } else {
            alert('导出失败：版本不存在或无权限。');
        }
    }

    async loadReport() {
        const container = this.querySelector('#saReportResult');
        const id = this.querySelector('#saReportId')?.value.trim();
        if (!id) {
            container.innerHTML = '<div class="qa-empty">请输入测评记录ID。</div>';
            return;
        }
        const raw = await this.apiGet('/api/quality-assessment/report?id=' + encodeURIComponent(id));
        if (!raw) {
            container.innerHTML = '<div class="qa-empty">未找到测评记录或报告。</div>';
            return;
        }
        let report;
        try { report = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { report = null; }
        if (!report) {
            container.innerHTML = '<div class="qa-empty">报告解析失败。</div>';
            return;
        }
        this._report = report;
        const dims = (report.dimensions || []).map(d => `
            <tr>
                <td>${d.name}</td><td>${d.score}</td><td>${Number(d.weight * 100).toFixed(0)}%</td>
                <td>${d.grade}</td>
                <td style="max-width:260px;">${d.evidence || '-'}</td>
                <td style="max-width:260px;">${d.suggestion || '-'}</td>
            </tr>`).join('');
        container.innerHTML = `
            <div class="sa-report-card" id="saReportCard">
                <h3>${report.title || '数据集质量评估报告'}</h3>
                <div class="sa-report-meta">
                    准则：${report.criteriaName || '-'}　|　测评时间：${report.createTime ? new Date(report.createTime).toLocaleString() : '-'}　|　评定人：${report.operator || '-'}　|　测评维度数：${report.dimensionCount || (report.dimensions || []).length}
                </div>
                <div class="sa-dqi ${report.passed ? 'sa-dqi-pass' : 'sa-dqi-fail'}">
                    综合得分：<b>${report.score ?? report.dqi}</b>（权重加权，默认各20%）　质量等级：<b>${report.grade || '-'}</b>　${report.passed ? '✅ 达标' : '❌ 未达标'}
                </div>
                <p class="sa-conclusion">${report.conclusion || ''}</p>
                <table class="data-table">
                    <thead><tr><th>维度</th><th>得分</th><th>权重</th><th>评级</th><th>评分依据</th><th>改进建议</th></tr></thead>
                    <tbody>${dims}</tbody>
                </table>
                <div class="sa-report-section"><b>问题明细</b><ul>${(report.issues || []).map(i => `<li>${i}</li>`).join('')}</ul></div>
                <div class="sa-report-section"><b>整改建议</b><ul>${(report.recommendations || []).map(i => `<li>${i}</li>`).join('')}</ul></div>
            </div>`;
    }

    printReport() {
        const card = this.querySelector('#saReportCard');
        if (!card) {
            alert('请先查看一份报告再打印。');
            return;
        }
        const win = window.open('', '_blank');
        win.document.write('<html><head><title>质量评估报告</title>' +
            '<style>body{font-family:"Microsoft YaHei",sans-serif;padding:24px;color:#333}' +
            'table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px}' +
            'h3{border-bottom:2px solid #1890ff;padding-bottom:8px}ul{padding-left:20px}</style></head><body>'
            + card.innerHTML + '</body></html>');
        win.document.close();
        win.print();
    }
}

customElements.define('scene-analysis', SceneAnalysis);
