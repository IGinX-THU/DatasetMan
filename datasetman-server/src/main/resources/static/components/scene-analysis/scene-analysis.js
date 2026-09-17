/**
 * 数据集管理组件：右侧数据集树的列表化显示，在此基础上提供
 *   1. 分类管理：按数据类型的分类统计 chips + 类型筛选（数据类型与档案页下拉一致）；
 *   2. 血缘关系：版本的上下游血缘列表（行内操作，弹窗展示）；
 *   3. 影响范围分析：下游受影响数据集与版本链（行内操作，弹窗展示）；
 *   4. 导出：打包下载该版本数据（文件型为原始文件，其余为CSV）+ manifest清单 + 质量评估报告PDF；
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
        this.pageSize = 10;
        this.currentPage = 1;
        this.total = 0;
    }

    async connectedCallback() {
        this._ready = this.loadResources().then(() => this.bindEvents());
        await this._ready;
    }

    async loadResources() {
        this.innerHTML = `
            <link rel="stylesheet" href="./components/scene-analysis/scene-analysis.css">
            <link rel="stylesheet" href="./components/common-pagination/common-pagination.css">
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
            relational: '关系数据', 'time-series': '时序数据', time_series: '时序数据',
            'semi-structured': '半结构化数据', semi_structured: '半结构化数据',
            'key-value': '键值数据', key_value: '键值数据',
            'file-system': '文件型数据', file_system: '文件型数据',
            text: '文本', image: '图像', audio: '音频', video: '视频'
        };
        if (!code) return '未标注';
        return map[code] || code;
    }

    bindEvents() {
        this.querySelector('#saRefresh')?.addEventListener('click', () => this.refresh());
        let debounceTimer = null;
        this.querySelector('#saSearchName')?.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.refresh(1), 300);
        });
        this.querySelector('#saTypeFilter')?.addEventListener('change', () => this.refresh(1));
        this.initPagination();

        // 分类 chips 点击
        this.querySelector('#saTypeChips')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.sa-chip');
            if (!chip) return;
            this.querySelectorAll('.sa-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const type = chip.dataset.type || '';
            const typeSelect = this.querySelector('#saTypeFilter');
            if (typeSelect) typeSelect.value = type;
            this.refresh(1);
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
                case 'toggle': this.toggleVersion(name, versionId); break;
            }
        });
    }

    /** 刷新：后端分页查询（POST /api/dataset/list/query，含已禁用版本） */
    async refresh(page) {
        if (page) this.currentPage = page;
        const headers = (window.AppConfig && window.AppConfig.getAuthHeaders())
            ? window.AppConfig.getAuthHeaders() : { 'Content-Type': 'application/json' };
        const body = {
            pageNum: this.currentPage,
            pageSize: this.pageSize,
            datasetName: (this.querySelector('#saSearchName')?.value || '').trim() || null,
            dataModality: this.querySelector('#saTypeFilter')?.value || null
        };
        try {
            const [queryRes, countRes] = await Promise.all([
                fetch('/api/dataset/list/query', { method: 'POST', headers,
                    body: JSON.stringify(body) }).then(r => r.json()),
                fetch('/api/dataset/list/count', { method: 'POST', headers,
                    body: JSON.stringify(body) }).then(r => r.json())
            ]);
            this.rows = (queryRes.code === 200 || queryRes.success) ? (queryRes.data || []) : [];
            this.total = (countRes.code === 200 || countRes.success) ? Number(countRes.data || 0) : 0;
        } catch (error) {
            console.error('加载数据集列表失败:', error);
            this.rows = [];
            this.total = 0;
        }
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
            summary.textContent = '本页 ' + datasetCount + ' 个数据集 / ' + this.rows.length
                + ' 个版本，合计 ' + this.total + ' 个版本（含已禁用），本页样本量 ' + totalSamples.toLocaleString() + ' 条';
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
        // 与创建数据集向导"数据类型"下拉完全一致的选项（适配 - 与 _ 两种编码写法）
        // 以注册数据源弹窗"数据模态"下拉的值为准（仅此5类），创建/编辑/筛选三处一致
        const allTypes = [
            ['', '全部数据类型'],
            ['relational', '关系数据'],
            ['time_series', '时序数据'],
            ['key_value', '键值数据'],
            ['semi_structured', '半结构化数据'],
            ['file_system', '文件型数据']
        ];
        select.innerHTML = allTypes.map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('');
        select.value = current;
    }

    totalPages() {
        return Math.max(1, Math.ceil(this.total / this.pageSize));
    }

    renderTable() {
        const tbody = this.querySelector('#saTableBody');
        if (!tbody) return;
        this.updatePagination();
        if (!this.rows.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="qa-empty">未查询到数据集。</td></tr>';
            return;
        }
        const rows = this.rows.map(r => Object.assign({}, r, {
            versionId: r.versionId || r.id || r.createTime
        }));
        const typeLabels = { SOURCE: '数据源挂载', IMPORT: '导入数据', SQL_QUERY: 'SQL查询/转换', TRANSFORM: 'Transform变换' };
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
                + '<td><div class="sa-actions">'
                + '<button class="sa-btn quality" data-action="quality" data-name="' + r.datasetName + '" data-version-id="' + vid + '">质量评估</button>'
                + '<button class="sa-btn ' + (r.deleted ? 'enable' : 'disable') + '" data-action="toggle" data-name="' + r.datasetName + '" data-version-id="' + vid + '">' + (r.deleted ? '启用' : '禁用') + '</button>'
                + '<button class="sa-btn lineage" data-action="lineage" data-name="' + r.datasetName + '" data-version-id="' + vid + '">关系</button>'
                + '<button class="sa-btn impact" data-action="impact" data-name="' + r.datasetName + '" data-version-id="' + vid + '">影响</button>'
                + '<button class="sa-btn export" data-action="export" data-name="' + r.datasetName + '" data-version-id="' + vid + '" title="' + (r.dataModality === 'file_system' || r.dataModality === 'file-system' ? '导出当前版本原始文件+manifest清单+质量评估报告PDF' : '导出当前版本数据表CSV+manifest清单+质量评估报告PDF') + '">导出</button>'
                + '<button class="sa-btn detail" data-action="detail" data-name="' + r.datasetName + '" data-version-id="' + vid + '">详情</button>'
                + '</div></td></tr>';
        }).join('');
    }

    initPagination() {
        const pagination = this.querySelector('#pagination');
        if (pagination) {
            pagination.addEventListener('pagination-change', (e) => {
                this.currentPage = e.detail.currentPage;
                this.pageSize = e.detail.pageSize;
                this.refresh();
            });
        }
    }

    updatePagination() {
        const pagination = this.querySelector('#pagination');
        if (pagination && typeof pagination.setPagination === 'function') {
            pagination.setPagination(this.currentPage, this.pageSize, this.total);
        }
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
        if (window.showGlobalLoading) {
            window.showGlobalLoading('正在导出数据...');
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
        } finally {
            if (window.hideGlobalLoading) {
                window.hideGlobalLoading();
            }
        }
    }

    /** 质量评估：跳转质量测评页并预选该数据集版本 */
    showQualityAssessment(name, versionId) {
        if (typeof window.showComponent === 'function') {
            window.showComponent('qualityAssessment', { versionId, datasetName: name });
        }
    }

    /** 启用/禁用版本（原详情页列表操作，移至此处） */
    async toggleVersion(name, versionId) {
        if (!versionId) {
            alert('该版本缺少ID，无法操作。');
            return;
        }
        try {
            const result = await window.AppConfig.put('dataset', 'versionToggle', { versionId: Number(versionId) });
            if (!(result.success || result.code === 200)) throw new Error(result.message || '操作失败');
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast(result.data ? '已禁用' : '已启用', 'success');
            }
            // 同步刷新右侧数据集树与本列表
            if (window.loadDatasetTree) await window.loadDatasetTree();
            await this.refresh();
        } catch (error) {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast(error.message || '操作失败', 'error');
            } else {
                alert(error.message || '操作失败');
            }
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
