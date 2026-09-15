/**
 * 数据集管理分析组件：右侧数据集树的列表化显示，在此基础上提供
 *   1. 分类管理：按数据类型的分类统计 chips + 类型筛选（数据类型与档案页下拉一致）；
 *   2. 血缘关系：版本的上下游血缘列表（行内操作，弹窗展示）；
 *   3. 影响范围分析：下游受影响数据集与版本链（行内操作，弹窗展示）；
 *   4. 导出：打包下载该数据集树下全部版本数据表CSV + manifest清单 + 质量评估报告PDF；
 *   5. 质量评估：跳转质量测评页并预选该数据集版本；
 *   6. 详情：跳转数据集档案页。
 * 对应后端接口：
 *   GET  /api/dataset/tree            数据集树（列表数据源，含 dataModality/rowCount）
 *   GET  /api/dataset/lineage         血缘图谱数据（关系展示）
 *   GET  /api/dataset/impact          影响范围分析
 *   POST /api/dataset/export-package  打包导出（zip）
 */
class SceneAnalysis extends HTMLElement {
    constructor() {
        super();
        this.style.display = 'none';
        this.rows = [];                   // 扁平化版本行
    }

    async connectedCallback() {
        this._ready = this.loadResources().then(() => this.bindEvents());
        await this._ready;
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

    async show() {
        this.style.display = 'block';
        await (this._ready || Promise.resolve());
        this.refresh();
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

    /** 数据类型标签：与数据集档案页"数据类型"下拉一致 */
    modalityLabel(code) {
        const map = {
            relational: '关系型', 'time-series': '时序', time_series: '时序',
            'semi-structured': '半结构化', semi_structured: '半结构化',
            key_value: '键值', file_system: '文件系统',
            text: '文本', image: '图像', audio: '音频', video: '视频'
        };
        if (!code) return '未标注';
        return map[code] || code;
    }

    bindEvents() {
        this.querySelector('#saRefresh')?.addEventListener('click', () => this.refresh());
        this.querySelector('#saSearchName')?.addEventListener('input', () => this.renderTable());
        this.querySelector('#saTypeFilter')?.addEventListener('change', () => this.renderTable());

        // 分类 chips 点击
        this.querySelector('#saTypeChips')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.sa-chip');
            if (!chip) return;
            this.querySelectorAll('.sa-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const type = chip.dataset.type || '';
            const typeSelect = this.querySelector('#saTypeFilter');
            if (typeSelect) typeSelect.value = type;
            this.renderTable();
        });

        // 弹窗关闭
        this.querySelectorAll('.sa-modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const mask = this.querySelector('#' + btn.dataset.close);
                if (mask) mask.style.display = 'none';
            });
        });
        this.querySelectorAll('.sa-modal-mask').forEach(mask => {
            mask.addEventListener('click', (e) => {
                if (e.target === mask) mask.style.display = 'none';
            });
        });

        // 行内操作（事件委托）
        const tbody = this.querySelector('#saTableBody');
        tbody?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const name = btn.dataset.name;
            const versionId = btn.dataset.versionId;
            switch (btn.dataset.action) {
                case 'lineage': this.showLineage(name, versionId); break;
                case 'impact': this.showImpact(name, versionId); break;
                case 'export': this.exportPackage(name, versionId); break;
                case 'quality': this.showQualityAssessment(name, versionId); break;
                case 'detail': this.showDetail(name, versionId); break;
            }
        });
    }

    /** 刷新：数据集树（列表主体）；分类 chips 由树内 dataModality 聚合 */
    async refresh() {
        const tree = await this.apiGet('/api/dataset/tree');
        this.rows = [];
        (tree || []).forEach(group => {
            (group.versions || []).forEach(v => {
                this.rows.push({
                    datasetName: group.datasetName,
                    versionId: v.versionId,
                    versionNo: v.versionNo,
                    storagePath: v.storagePath,
                    provenanceType: v.provenanceType,
                    createTime: v.createTime,
                    deleted: v.deleted,
                    dataModality: v.dataModality,
                    rowCount: v.rowCount
                });
            });
        });
        this.rows.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
        this.renderChips();
        this.renderTypeFilter();
        this.renderTable();
    }

    typeAggregation() {
        const map = new Map(); // label -> {code, datasets:Set, rowCount}
        this.rows.forEach(r => {
            const code = r.dataModality || '';
            const label = this.modalityLabel(code);
            if (!map.has(label)) map.set(label, { code, datasets: new Set(), rowCount: 0 });
            const item = map.get(label);
            item.datasets.add(r.datasetName);
            item.rowCount += (r.rowCount || 0);
        });
        return Array.from(map.entries()).map(([label, v]) => ({
            label, code: v.code, datasetCount: v.datasets.size, totalRowCount: v.rowCount
        }));
    }

    renderChips() {
        const box = this.querySelector('#saTypeChips');
        const summary = this.querySelector('#saSummary');
        if (!box) return;
        const stats = this.typeAggregation();
        const totalSamples = stats.reduce((sum, d) => sum + d.totalRowCount, 0);
        const datasetCount = new Set(this.rows.map(r => r.datasetName)).size;
        if (summary) {
            summary.textContent = '共 ' + datasetCount + ' 个数据集 / ' + this.rows.length
                + ' 个版本，覆盖 ' + stats.length + ' 类数据类型，样本总量 ' + totalSamples.toLocaleString() + ' 条';
        }
        const activeType = this.querySelector('#saTypeFilter')?.value || '';
        box.innerHTML = '<span class="sa-chip ' + (activeType === '' ? 'active' : '') + '" data-type="">全部 (' + this.rows.length + ')</span>'
            + stats.map(t =>
                '<span class="sa-chip ' + (t.code === activeType ? 'active' : '') + '" data-type="' + t.code + '">'
                + t.label + ' · ' + t.datasetCount + '个数据集 · ' + t.totalRowCount.toLocaleString() + '条</span>'
            ).join('');
    }

    renderTypeFilter() {
        const select = this.querySelector('#saTypeFilter');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">全部数据类型</option>'
            + this.typeAggregation().map(t => '<option value="' + t.code + '">' + t.label + '</option>').join('');
        select.value = current;
    }

    renderTable() {
        const tbody = this.querySelector('#saTableBody');
        if (!tbody) return;
        const type = this.querySelector('#saTypeFilter')?.value || '';
        const kw = (this.querySelector('#saSearchName')?.value || '').trim().toLowerCase();
        const typeLabels = { SOURCE: '数据源挂载', IMPORT: '导入数据', SQL_QUERY: 'SQL查询/转换', TRANSFORM: 'Transform变换' };
        const rows = this.rows.filter(r =>
            (!type || (r.dataModality || '') === type) &&
            (!kw || (r.datasetName || '').toLowerCase().includes(kw)));
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="qa-empty">未查询到数据集。</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(r => {
            const vid = r.versionId || '';
            return '<tr style="' + (r.deleted ? 'color:#999;' : '') + '">'
                + '<td title="' + (r.datasetName || '') + '">' + ((r.datasetName || '').length > 24 ? (r.datasetName || '').slice(0, 24) + '…' : (r.datasetName || '-')) + '</td>'
                + '<td>' + this.modalityLabel(r.dataModality) + '</td>'
                + '<td>' + (r.versionNo || '-') + '</td>'
                + '<td>' + (r.rowCount || 0).toLocaleString() + '</td>'
                + '<td>' + (typeLabels[r.provenanceType] || r.provenanceType || '-') + '</td>'
                + '<td>' + (r.deleted ? '已禁用' : '正常') + '</td>'
                + '<td>' + (r.createTime ? new Date(r.createTime).toLocaleString() : '-') + '</td>'
                + '<td><div class="action-buttons">'
                + '<button class="action-btn edit" data-action="quality" data-name="' + r.datasetName + '" data-version-id="' + vid + '">质量评估</button>'
                + '<button class="action-btn" data-action="lineage" data-name="' + r.datasetName + '" data-version-id="' + vid + '">血缘关系</button>'
                + '<button class="action-btn" data-action="impact" data-name="' + r.datasetName + '" data-version-id="' + vid + '">影响分析</button>'
                + '<button class="action-btn report" title="导出当前版本数据表CSV+manifest清单+质量评估报告PDF" data-action="export" data-name="' + r.datasetName + '" data-version-id="' + vid + '">导出</button>'
                + '<button class="action-btn manage" data-action="detail" data-name="' + r.datasetName + '" data-version-id="' + vid + '">详情</button>'
                + '</div></td></tr>';
        }).join('');
    }

    openModal(id) {
        const mask = this.querySelector('#' + id);
        if (mask) mask.style.display = 'flex';
    }

    /** 血缘关系：以该版本为中心，展示上游来源与下游派生列表 */
    async showLineage(name, versionId) {
        if (!versionId) {
            alert('该版本缺少ID，无法查询血缘。');
            return;
        }
        this.openModal('saRelationModal');
        const upBody = this.querySelector('#saUpstreamBody');
        const downBody = this.querySelector('#saDownstreamBody');
        upBody.innerHTML = '<tr><td colspan="4" class="qa-empty">查询中...</td></tr>';
        downBody.innerHTML = '';

        const data = await this.apiGet('/api/dataset/lineage?versionId=' + encodeURIComponent(versionId) + '&sideLineage=false');
        if (!data) {
            upBody.innerHTML = '<tr><td colspan="4" class="qa-empty">查询失败：版本不存在或无权限。</td></tr>';
            return;
        }
        const nodeById = new Map();
        (data.nodes || []).forEach(n => nodeById.set(String(n.versionId), n));
        const focusId = String(versionId);
        const relLabels = { source: '数据来源', import: '导入', sql: 'SQL查询/转换', transform: 'Transform变换' };

        const upstreams = (data.edges || []).filter(e => String(e.to) === focusId);
        const downstreams = (data.edges || []).filter(e => String(e.from) === focusId);

        upBody.innerHTML = upstreams.length ? upstreams.map(e => {
            const n = nodeById.get(String(e.from));
            return '<tr><td>' + (n ? (n.datasetName || '-') : '-') + '</td>'
                + '<td>' + (n ? (n.versionNo || '-') : e.from) + '</td>'
                + '<td>' + (relLabels[e.relationType] || e.relationType || '-') + '</td>'
                + '<td>' + (e.primary ? '是' : '否') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="qa-empty">无上游来源（根数据集）。</td></tr>';

        downBody.innerHTML = downstreams.length ? downstreams.map(e => {
            const n = nodeById.get(String(e.to));
            return '<tr><td>' + (n ? (n.datasetName || '-') : '-') + '</td>'
                + '<td>' + (n ? (n.versionNo || '-') : e.to) + '</td>'
                + '<td>' + (relLabels[e.relationType] || e.relationType || '-') + '</td>'
                + '<td>' + (n ? (n.provenanceLabel || n.provenanceType || '-') : '-') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="qa-empty">无下游派生版本。</td></tr>';
    }

    async showImpact(name, versionId) {
        if (!versionId) {
            alert('该版本缺少ID，无法分析影响范围。');
            return;
        }
        this.openModal('saImpactModal');
        const tbody = this.querySelector('#saImpactBody');
        const summary = this.querySelector('#saImpactSummary');
        tbody.innerHTML = '<tr><td colspan="6" class="qa-empty">分析中...</td></tr>';
        summary.textContent = '';
        const data = await this.apiGet('/api/dataset/impact?versionId=' + encodeURIComponent(versionId));
        if (!data) {
            tbody.innerHTML = '<tr><td colspan="6" class="qa-empty">分析失败：版本不存在或无权限。</td></tr>';
            return;
        }
        const rows = (data.impactedVersions || []);
        summary.innerHTML = '焦点版本 ' + (data.versionNo || '') + '：受影响数据集 <b>'
            + (data.impactedDatasets || []).length + '</b> 个，受影响版本 <b>' + rows.length
            + '</b> 个，最大级联深度 <b>' + (data.maxDepth || 0) + '</b>，下游样本量合计 <b>'
            + (data.impactedRowCount || 0).toLocaleString() + '</b> 条';
        tbody.innerHTML = rows.length ? rows.map(v =>
            '<tr><td>' + v.datasetName + '</td><td>' + v.versionNo + '</td><td>'
            + (v.provenanceLabel || v.provenanceType || '') + '</td><td>' + v.depth + '</td><td>'
            + (v.path || '') + '</td><td>' + (v.rowCount || 0).toLocaleString() + '</td></tr>').join('')
            : '<tr><td colspan="6" class="qa-empty">该版本没有下游依赖。</td></tr>';
    }

    /** 打包导出：全部版本数据CSV + manifest清单 + 质量评估报告PDF（zip下载） */
    async exportPackage(name, versionId) {
        if (!versionId) {
            alert('该版本缺少ID，无法导出。');
            return;
        }
        try {
            const url = '/api/dataset/export-package?versionId=' + encodeURIComponent(versionId);
            const headers = (window.AppConfig && window.AppConfig.getAuthHeaders())
                ? window.AppConfig.getAuthHeaders() : {};
            const res = await fetch(url, { method: 'POST', headers });
            if (!res.ok) {
                let msg = '导出失败';
                try { msg = (await res.json()).message || msg; } catch (ignore) { /* 非JSON响应 */ }
                throw new Error(msg);
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            let fileName = name + '-标准数据集包.zip';
            const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
            if (match) fileName = decodeURIComponent(match[1]);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        } catch (error) {
            alert(error.message || '导出失败');
        }
    }

    /** 质量评估：跳转质量测评页并预选该数据集版本 */
    showQualityAssessment(name, versionId) {
        if (typeof window.showComponent === 'function') {
            window.showComponent('qualityAssessment', { versionId, datasetName: name });
        }
    }

    /** 详情：跳转数据集档案页 */
    showDetail(name, versionId) {
        const row = this.rows.find(r => String(r.versionId) === String(versionId)) || {};
        if (typeof window.showComponent === 'function') {
            window.showComponent('datasetHistory', {
                versionId: versionId,
                datasetName: name,
                storagePath: row.storagePath
            });
        }
    }
}

customElements.define('scene-analysis', SceneAnalysis);
