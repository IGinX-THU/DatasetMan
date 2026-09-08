/**
 * 数据集创建弹窗组件 - 三步向导
 * 参考 register-embedded 组件的弹窗模式
 */
class DatasetDialog extends HTMLElement {
    constructor() {
        super();
        this.options = { sources: [], snippets: [], jobs: [], datasets: [] };
        this.currentStep = 1;
        this.createMode = null; // 'new' | 'existing'
        this.selectedType = null; // SOURCE | SQL_QUERY | TRANSFORM
        this.upstreamVersionId = null;
        this.upstreamDatasetId = null;
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        await this.loadResources();
        this.bindEvents();
        this.hide();
    }

    async loadResources() {
        try {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = './components/dataset-dialog/dataset-dialog.css';
            this.shadowRoot.appendChild(cssLink);
        } catch (error) {
            console.error('Failed to load CSS:', error);
        }
        try {
            const response = await fetch('./components/dataset-dialog/dataset-dialog.html');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            this.shadowRoot.innerHTML += html;
        } catch (error) {
            console.error('Failed to load HTML template:', error);
        }
    }

    bindEvents() {
        const $ = (id) => this.shadowRoot.getElementById(id);

        $('closeBtn')?.addEventListener('click', () => this.hide());
        $('cancelBtn')?.addEventListener('click', () => this.hide());
        $('prevBtn')?.addEventListener('click', () => this.prevStep());
        $('nextBtn')?.addEventListener('click', () => this.nextStep());
        $('submitBtn')?.addEventListener('click', () => this.handleSubmit());

        // 步骤1：模式卡片
        this.shadowRoot.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                this.shadowRoot.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.createMode = card.dataset.mode;
            });
        });

        // 步骤2：产出方式卡片（已有版本模式）
        this.shadowRoot.querySelectorAll('#typeCardsExisting .type-card').forEach(card => {
            card.addEventListener('click', () => {
                this.shadowRoot.querySelectorAll('#typeCardsExisting .type-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedType = card.dataset.type;
                this.shadowRoot.querySelectorAll('#existingModeSection .type-panel').forEach(p => p.classList.remove('active'));
                const panel = this.shadowRoot.querySelector(`#panel-${this.selectedType}`);
                if (panel) panel.classList.add('active');
            });
        });

        // 数据源选取后同步数据类型
        $('sourcePath')?.addEventListener('change', (e) => {
            const selected = e.target.selectedOptions[0];
            const desc = selected ? selected.getAttribute('data-desc') : '';
            const modalitySelect = $('dataModality');
            if (modalitySelect && desc) {
                const option = Array.from(modalitySelect.options).find(o => o.value === desc);
                if (option) modalitySelect.value = desc;
            }
            this.updateSourcePathDisplay();
        });

        // 数据集名称输入后刷新预览
        $('datasetName')?.addEventListener('input', () => this.updateConfirmPreview());

        // 提示链接点击跳转
        this.shadowRoot.querySelectorAll('.hint-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.hide();
                const id = link.id;
                if (id === 'link-register-source') {
                    document.getElementById('menu-register-heterogeneous-data-source')?.click();
                } else if (id === 'link-sql-snippet') {
                    document.getElementById('menu-sql-snippet-management')?.click();
                } else if (id === 'link-transform-compare') {
                    document.getElementById('menu-job-orchestration')?.click();
                }
            });
        });
    }

    show(context) {
        this.removeAttribute('hidden');
        this.style.display = 'flex';

        // 重置状态
        this.currentStep = 1;
        this.createMode = 'new'; // 默认选中新建数据集
        this.selectedType = null;
        this.upstreamVersionId = null;
        this.upstreamDatasetId = null;

        // 加载选项数据后填充下拉
        this.loadOptions().then(() => {
            this.populateOptions();
            this.handleContext(context);
        });
    }

    hide() {
        this.setAttribute('hidden', '');
        this.style.display = 'none';
        this.hideError();
    }

    async loadOptions() {
        try {
            const [sourcesRes, snippetsRes, jobsRes, treeRes] = await Promise.all([
                window.AppConfig.get('datasource', 'archives').catch(() => ({ data: [] })),
                window.AppConfig.get('sqlSnippet', 'list').catch(() => ({ data: [] })),
                window.AppConfig.post('transformCompare', 'query', { pageNum: 1, pageSize: 50 }).catch(() => ({ data: [] })),
                window.AppConfig.get('dataset', 'tree').catch(() => ({ data: [] }))
            ]);
            this.options.sources = sourcesRes.data || [];
            this.options.snippets = snippetsRes.data || [];
            this.options.jobs = jobsRes.data || [];
            this.options.datasets = treeRes.data || [];
        } catch (e) {
            console.error('加载选项数据失败:', e);
        }
    }

    populateOptions() {
        const $ = (id) => this.shadowRoot.getElementById(id);

        // 数据源下拉
        const sourceSelect = $('sourcePath');
        if (sourceSelect) {
            sourceSelect.innerHTML = '<option value="">请选择数据源...</option>' +
                this.options.sources.map(s => `<option value="${s.name}" data-desc="${this.escape(s.desc || '')}">${s.name}${s.desc ? ' (' + this.escape(s.desc) + ')' : ''}</option>`).join('');
        }

        // 父级版本下拉
        const upstreamSelect = $('upstreamVersion');
        if (upstreamSelect) {
            upstreamSelect.innerHTML = '<option value="">请选择父级版本...</option>' +
                this.options.datasets.map(d => (d.versions || []).map(v => `<option value="${v.versionId || v.createTime}" data-dataset-id="${d.datasetId}" data-storage-path="${this.escape(v.storagePath || '')}">${this.escape(d.datasetName)} / ${this.escape(v.versionNo)}</option>`).join('')).join('');
        }

        // SQL 脚本下拉
        const sqlSelect = $('sqlSnippet');
        if (sqlSelect) {
            sqlSelect.innerHTML = '<option value="">请选择 SQL 脚本...</option>' +
                this.options.snippets.map(s => `<option value="${s.createTime || s.id}">${this.escape(s.name)}</option>`).join('');
        }

        // Transform 作业下拉
        const transformSelect = $('transformJob');
        if (transformSelect) {
            transformSelect.innerHTML = '<option value="">请选择 Transform 作业...</option>' +
                this.options.jobs.map(j => `<option value="${j.createTime}" data-export-type="${j.exportType || ''}" data-export-file="${this.escape(j.exportFile || '')}">${this.escape(j.name)}</option>`).join('');
        }
    }

    handleContext(context) {
        const $ = (id) => this.shadowRoot.getElementById(id);

        // 如果从详情页传入 context（已有父级版本），跳过步骤1
        const ctxVersionId = context && (context.versionId || context.id || context.createTime);
        if (context && ctxVersionId) {
            this.upstreamVersionId = ctxVersionId;
            this.upstreamDatasetId = context.datasetId;
            this.createMode = 'existing';

            // 显示已有版本模式，隐藏新建模式
            $('newModeSection').style.display = 'none';
            $('existingModeSection').style.display = 'block';

            // 父级选择器只读并自动选中
            const upstreamSelect = $('upstreamVersion');
            if (upstreamSelect) {
                upstreamSelect.disabled = true;
                const opt = upstreamSelect.querySelector(`option[value="${ctxVersionId}"]`);
                if (opt) opt.selected = true;
            }

            // 预填数据集名称并设为只读（沿用父级数据集名称）
            if (context.datasetName) {
                const nameInput = $('datasetName');
                if (nameInput) {
                    nameInput.value = context.datasetName;
                    nameInput.disabled = true;
                }
            }

            // 默认选 SQL_QUERY
            const sqlCard = this.shadowRoot.querySelector('#typeCardsExisting .type-card[data-type="SQL_QUERY"]');
            if (sqlCard) sqlCard.click();

            this.goToStep(2);
        } else {
            // 默认新建模式，隐藏已有版本模式
            this.shadowRoot.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
            this.shadowRoot.querySelector('.mode-card[data-mode="new"]')?.classList.add('active');
            $('newModeSection').style.display = 'none';
            $('existingModeSection').style.display = 'none';
            this.goToStep(1);
        }
    }

    goToStep(step) {
        this.currentStep = step;
        const $ = (id) => this.shadowRoot.getElementById(id);

        // 更新面板显示
        this.shadowRoot.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
        $(`step${step}Panel`)?.classList.add('active');

        // 更新步骤指示器
        this.shadowRoot.querySelectorAll('.step').forEach(s => {
            const sNum = parseInt(s.dataset.step);
            s.classList.remove('active', 'done');
            if (sNum < step) s.classList.add('done');
            else if (sNum === step) s.classList.add('active');
        });

        // 更新按钮
        $('prevBtn').style.display = step > 1 ? 'inline-block' : 'none';
        $('nextBtn').style.display = step < 3 ? 'inline-block' : 'none';
        $('submitBtn').style.display = step === 3 ? 'inline-block' : 'none';

        // 步骤3时生成确认摘要
        if (step === 3) this.updateConfirmPreview();
    }

    nextStep() {
        this.hideError();
        if (this.currentStep === 1) {
            if (!this.createMode) return this.fail('请选择创建模式');
            const $ = (id) => this.shadowRoot.getElementById(id);
            if (this.createMode === 'new') {
                this.selectedType = 'SOURCE';
                $('newModeSection').style.display = 'block';
                $('existingModeSection').style.display = 'none';
            } else {
                $('newModeSection').style.display = 'none';
                $('existingModeSection').style.display = 'block';
                if (!this.selectedType) {
                    const sqlCard = this.shadowRoot.querySelector('#typeCardsExisting .type-card[data-type="SQL_QUERY"]');
                    if (sqlCard) sqlCard.click();
                }
            }
            this.goToStep(2);
        } else if (this.currentStep === 2) {
            if (!this.validateStep2()) return;
            this.goToStep(3);
        }
    }

    prevStep() {
        this.hideError();
        if (this.currentStep > 1) this.goToStep(this.currentStep - 1);
    }

    validateStep2() {
        const $ = (id) => this.shadowRoot.getElementById(id);
        const datasetName = $('datasetName').value.trim();
        if (!datasetName) return this.fail('请输入数据集名称');
        if (this.createMode === 'new') {
            const sourcePath = $('sourcePath').value;
            if (!sourcePath) return this.fail('请选择数据源');
        } else {
            const upstream = $('upstreamVersion').value;
            if (!upstream && !this.upstreamVersionId) return this.fail('请选择父级数据集版本');
            if (!this.selectedType) return this.fail('请选择产出方式');
            if (this.selectedType === 'SQL_QUERY') {
                const snippetId = $('sqlSnippet').value;
                if (!snippetId) return this.fail('请选择 SQL 脚本');
            } else if (this.selectedType === 'TRANSFORM') {
                const createTime = $('transformJob').value;
                if (!createTime) return this.fail('请选择 Transform 作业');
            }
        }
        return true;
    }

    updateSourcePathDisplay() {
        const sourcePath = this.shadowRoot.getElementById('sourcePath').value;
        const box = this.shadowRoot.getElementById('sourcePathBox');
        const valueEl = this.shadowRoot.getElementById('sourcePathValue');
        if (sourcePath) {
            if (valueEl) valueEl.textContent = sourcePath;
            if (box) box.style.display = 'block';
        } else {
            if (box) box.style.display = 'none';
        }
    }

    normalizePath(path) {
        if (!path) return 'value';
        return path.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5.]/g, '_').replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
    }

    generateVersion(timestamp) {
        const date = new Date(timestamp);
        const fmt = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: '2-digit', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const parts = {};
        fmt.formatToParts(date).forEach(p => { parts[p.type] = p.value; });
        return `v_${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
    }

    previewSqlStoragePath() {
        const datasetName = this.shadowRoot.getElementById('datasetName').value.trim();
        const safeName = this.normalizePath(datasetName).replace(/\./g, '_');
        const version = this.generateVersion(Date.now());
        return `datasets.${safeName || '<数据集名称>'}.${version}`;
    }

    getStoragePathPreview() {
        if (this.createMode === 'new' || this.selectedType === 'SOURCE') {
            return this.shadowRoot.getElementById('sourcePath').value || '<请选择数据源>';
        } else if (this.selectedType === 'SQL_QUERY') {
            return this.previewSqlStoragePath();
        } else if (this.selectedType === 'TRANSFORM') {
            const jobSelect = this.shadowRoot.getElementById('transformJob');
            const selected = jobSelect.selectedOptions[0];
            if (selected && selected.value) {
                const exportType = selected.getAttribute('data-export-type');
                const exportFile = selected.getAttribute('data-export-file') || '';
                if (exportType === '2') return 'transform';
                if (exportType === '1' && exportFile) {
                    let file = exportFile.replace(/\\/g, '/');
                    file = file.substring(file.lastIndexOf('/') + 1);
                    return 'file_system.sys_data.job.' + file;
                }
                return '<无法解析输出路径>';
            }
            return '<请选择 Transform 作业>';
        }
        return '-';
    }

    updateConfirmPreview() {
        const $ = (id) => this.shadowRoot.getElementById(id);
        const datasetName = $('datasetName').value.trim() || '-';
        const dataModality = $('dataModality').value;
        const remark = $('remark').value.trim() || '-';
        const modalityLabels = { relational: '关系型', time_series: '时序数据', key_value: '键值', semi_structured: '半结构化/文档', file_system: '文件系统' };

        let modeLabel, typeLabel, resourceLabel;
        if (this.createMode === 'new') {
            modeLabel = '新建数据集';
            typeLabel = '数据源挂载 (SOURCE)';
            resourceLabel = $('sourcePath').value || '-';
        } else {
            modeLabel = '基于已有版本创建新版本';
            const upstreamSelect = $('upstreamVersion');
            const upstreamVal = this.upstreamVersionId || upstreamSelect.value;
            const upstreamOpt = upstreamSelect.querySelector(`option[value="${upstreamVal}"]`);
            typeLabel = this.selectedType === 'SQL_QUERY' ? 'SQL查询/转换 (SQL_QUERY)' : 'Transform作业 (TRANSFORM)';
            resourceLabel = upstreamOpt ? `父级: ${upstreamOpt.textContent}` : '父级: <未选择>';
            if (this.selectedType === 'SQL_QUERY') {
                const snippetOpt = $('sqlSnippet').selectedOptions[0];
                resourceLabel += `<br>SQL脚本: ${snippetOpt && snippetOpt.value ? snippetOpt.textContent : '<未选择>'}`;
            } else if (this.selectedType === 'TRANSFORM') {
                const jobOpt = $('transformJob').selectedOptions[0];
                resourceLabel += `<br>Transform作业: ${jobOpt && jobOpt.value ? jobOpt.textContent : '<未选择>'}`;
            }
        }

        $('summaryBox').innerHTML = `
            <div class="summary-row"><div class="summary-label">创建模式</div><div class="summary-value">${modeLabel}</div></div>
            <div class="summary-row"><div class="summary-label">产出方式</div><div class="summary-value">${typeLabel}</div></div>
            <div class="summary-row"><div class="summary-label">资源选择</div><div class="summary-value">${resourceLabel}</div></div>
            <div class="summary-row"><div class="summary-label">数据集名称</div><div class="summary-value">${this.escape(datasetName)}</div></div>
            <div class="summary-row"><div class="summary-label">数据类型</div><div class="summary-value">${modalityLabels[dataModality] || dataModality}</div></div>
            <div class="summary-row"><div class="summary-label">备注</div><div class="summary-value">${this.escape(remark)}</div></div>
        `;
        $('confirmPathValue').textContent = this.getStoragePathPreview();
    }

    async handleSubmit() {
        this.hideError();
        const $ = (id) => this.shadowRoot.getElementById(id);
        const datasetName = $('datasetName').value.trim();
        const dataModality = $('dataModality').value;
        const remark = $('remark').value.trim();
        if (!datasetName) return this.fail('请输入数据集名称');

        const request = { datasetName, dataModality, remark, provenanceType: this.selectedType };

        if (this.createMode === 'new' || this.selectedType === 'SOURCE') {
            request.provenanceType = 'SOURCE';
            const sourcePath = $('sourcePath').value;
            if (!sourcePath) return this.fail('请选择数据源');
            request.sourcePath = sourcePath;
        } else {
            const upstream = this.upstreamVersionId || $('upstreamVersion').value;
            if (!upstream) return this.fail('请选择父级数据集版本');
            request.upstreamVersionIds = [Number(upstream)];
            if (this.selectedType === 'SQL_QUERY') {
                const snippetId = $('sqlSnippet').value;
                if (!snippetId) return this.fail('请选择 SQL 脚本');
                request.sqlSnippetId = Number(snippetId);
            } else if (this.selectedType === 'TRANSFORM') {
                const createTime = $('transformJob').value;
                if (!createTime) return this.fail('请选择 Transform 作业');
                request.transformCompareCreateTime = Number(createTime);
            }
        }

        const submitBtn = $('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '创建中...';

        try {
            const result = await window.AppConfig.post('dataset', 'create', request);
            if (result.success || result.code === 200) {
                this.dispatchEvent(new CustomEvent('dataset-created', { bubbles: true, composed: true, detail: result.data }));
                this.hide();
            } else {
                this.fail(result.message || '创建失败');
            }
        } catch (error) {
            console.error('创建数据集失败:', error);
            this.fail(error.message || '网络或系统异常');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '创建数据集';
        }
    }

    fail(msg) {
        const errorBox = this.shadowRoot.getElementById('errorBox');
        if (errorBox) { errorBox.textContent = msg; errorBox.style.display = 'block'; }
    }

    hideError() {
        const errorBox = this.shadowRoot.getElementById('errorBox');
        if (errorBox) errorBox.style.display = 'none';
    }

    escape(val) {
        return String(val == null ? '' : val).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
    }
}

customElements.define('dataset-dialog', DatasetDialog);
