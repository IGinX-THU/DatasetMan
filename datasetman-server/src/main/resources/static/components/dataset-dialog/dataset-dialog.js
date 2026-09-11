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
        this.upstreamDatasetName = null;
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

        // 步骤2：新建模式数据来源卡片（SOURCE / IMPORT）
        this.shadowRoot.querySelectorAll('#typeCardsNew .type-card').forEach(card => {
            card.addEventListener('click', () => {
                this.shadowRoot.querySelectorAll('#typeCardsNew .type-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedType = card.dataset.type;
                this.shadowRoot.querySelectorAll('#newModeSection .type-panel').forEach(p => p.classList.remove('active'));
                const panel = this.shadowRoot.querySelector(`#panel-new-${this.selectedType}`);
                if (panel) panel.classList.add('active');
                this.updateConfirmPreview();
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

        // 父级版本选取后自动填充数据集名称并设为只读
        $('upstreamVersion')?.addEventListener('change', (e) => {
            const selected = e.target.selectedOptions[0];
            const datasetName = selected ? selected.textContent.split(' / ')[0] : '';
            const nameInput = $('datasetName');
            if (nameInput) {
                if (datasetName) {
                    nameInput.value = datasetName;
                    nameInput.disabled = true;
                } else {
                    nameInput.value = '';
                    nameInput.disabled = false;
                }
                this.updateConfirmPreview();
            }
        });

        // SQL脚本选取后加载预览
        $('sqlSnippet')?.addEventListener('change', (e) => {
            const snippetId = e.target.value;
            if (snippetId) {
                this.loadSqlPreview(snippetId);
            } else {
                this.hideSqlPreview();
            }
        });

        // 导入文件选择 & 拖拽
        $('importFile')?.addEventListener('change', (e) => this.handleImportFileSelect(e));
        this.setupImportDragDrop();

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
        this.upstreamDatasetName = null;
        this.hideSqlPreview();
        // 重置导入文件上传区域
        this.resetImportFileArea();
        // 重置新建模式卡片为 SOURCE
        const newCards = this.shadowRoot.querySelectorAll('#typeCardsNew .type-card');
        newCards.forEach(c => c.classList.remove('active'));
        const sourceCard = this.shadowRoot.querySelector('#typeCardsNew .type-card[data-type="SOURCE"]');
        if (sourceCard) sourceCard.classList.add('active');
        this.shadowRoot.querySelectorAll('#newModeSection .type-panel').forEach(p => p.classList.remove('active'));
        const sourcePanel = this.shadowRoot.querySelector('#panel-new-SOURCE');
        if (sourcePanel) sourcePanel.classList.add('active');

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
                this.options.datasets.map(d => (d.versions || []).map(v => `<option value="${v.versionId || v.createTime}" data-dataset-name="${this.escape(d.datasetName)}" data-storage-path="${this.escape(v.storagePath || '')}">${this.escape(d.datasetName)} / ${this.escape(v.versionNo)}</option>`).join('')).join('');
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
            this.upstreamDatasetName = context.datasetName;
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
            const nameInput = $('datasetName');
            if (this.createMode === 'new') {
                // 新建模式：默认选 SOURCE，显示新建模式卡片
                const sourceCard = this.shadowRoot.querySelector('#typeCardsNew .type-card[data-type="SOURCE"]');
                if (sourceCard) sourceCard.click();
                else this.selectedType = 'SOURCE';
                $('newModeSection').style.display = 'block';
                $('existingModeSection').style.display = 'none';
                // 新建模式：名称可编辑，清空父级选择
                if (nameInput) { nameInput.disabled = false; nameInput.value = ''; }
                const upstreamSelect = $('upstreamVersion');
                if (upstreamSelect) { upstreamSelect.disabled = false; upstreamSelect.value = ''; }
            } else {
                $('newModeSection').style.display = 'none';
                $('existingModeSection').style.display = 'block';
                // 已有版本模式：名称由父级版本选择决定，先清空禁用
                if (nameInput) { nameInput.disabled = true; nameInput.value = ''; }
                if (!this.selectedType || this.selectedType === 'SOURCE' || this.selectedType === 'IMPORT') {
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
        if (!datasetName) return this.fail('请输入数据集名称', 'datasetNameError');
        if (this.createMode === 'new') {
            // 新建模式：SOURCE 或 IMPORT
            if (this.selectedType === 'SOURCE') {
                const sourcePath = $('sourcePath').value;
                if (!sourcePath) return this.fail('请选择数据源', 'sourcePathError');
            } else if (this.selectedType === 'IMPORT') {
                const importFile = $('importFile');
                if (!importFile || !importFile.files || !importFile.files.length) {
                    return this.fail('请上传 CSV 文件', 'importFileFieldError');
                }
            }
            // 新建数据集时允许使用已存在的数据集名称（全禁用后可创建同名数据集）
        } else {
            const upstream = $('upstreamVersion').value;
            if (!upstream && !this.upstreamVersionId) return this.fail('请选择父级数据集版本', 'upstreamVersionError');
            if (!this.selectedType) return this.fail('请选择产出方式');
            if (this.selectedType === 'SQL_QUERY') {
                const snippetId = $('sqlSnippet').value;
                if (!snippetId) return this.fail('请选择 SQL 脚本', 'sqlSnippetError');
            } else if (this.selectedType === 'TRANSFORM') {
                const createTime = $('transformJob').value;
                if (!createTime) return this.fail('请选择 Transform 作业', 'transformJobError');
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

    /** 导入文件拖拽上传 */
    setupImportDragDrop() {
        const label = this.shadowRoot.getElementById('importFileLabel');
        if (!label) return;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
            label.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
        });
        ['dragenter', 'dragover'].forEach(ev => {
            label.addEventListener(ev, () => label.classList.add('dragover'), false);
        });
        ['dragleave', 'drop'].forEach(ev => {
            label.addEventListener(ev, () => label.classList.remove('dragover'), false);
        });
        label.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const fileInput = this.shadowRoot.getElementById('importFile');
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(files[0]);
                fileInput.files = dataTransfer.files;
                this.handleImportFileSelect({ target: { files: [files[0]] } });
            }
        }, false);
    }

    /** 导入文件选择处理：校验格式和大小，更新上传区域显示 */
    handleImportFileSelect(event) {
        const file = event.target.files && event.target.files[0];
        const errorEl = this.shadowRoot.getElementById('importFileError');
        const label = this.shadowRoot.getElementById('importFileLabel');
        if (!file) return;
        if (errorEl) errorEl.style.display = 'none';
        // 校验格式
        if (!file.name.toLowerCase().endsWith('.csv')) {
            if (errorEl) { errorEl.textContent = '仅支持 CSV 格式文件'; errorEl.style.display = 'block'; }
            return;
        }
        // 校验大小（1GB）
        if (file.size > 1024 * 1024 * 1024) {
            if (errorEl) { errorEl.textContent = '文件大小不能超过 1GB'; errorEl.style.display = 'block'; }
            return;
        }
        // 更新上传区域显示
        if (label) {
            const existingInput = label.querySelector('.file-input');
            label.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 12px;">📄</div>
                <div style="font-weight: 500; margin-bottom: 8px;">已选择文件: ${this.escape(file.name)}</div>
                <div class="hint">文件大小: ${this.formatFileSize(file.size)}，点击重新选择</div>
            `;
            if (existingInput) label.appendChild(existingInput);
        }
        this.updateConfirmPreview();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /** 重置导入文件上传区域 */
    resetImportFileArea() {
        const label = this.shadowRoot.getElementById('importFileLabel');
        const errorEl = this.shadowRoot.getElementById('importFileError');
        const fileInput = this.shadowRoot.getElementById('importFile');
        const keyInput = this.shadowRoot.getElementById('importKeyColumn');
        if (fileInput) fileInput.value = '';
        if (keyInput) keyInput.value = '';
        if (errorEl) errorEl.style.display = 'none';
        if (label) {
            const existingInput = label.querySelector('.file-input');
            label.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 12px;">📁</div>
                <div style="font-weight: 500; margin-bottom: 8px;">点击选择 CSV 文件或拖拽文件到此处</div>
                <div class="hint">要求第一列必须是 KEY（long 类型），没有可手动指定列名作为 key，不指定则从 0 开始自动生成。</div>
            `;
            if (existingInput) label.appendChild(existingInput);
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
        if (this.selectedType === 'SOURCE' && this.createMode === 'new') {
            return this.shadowRoot.getElementById('sourcePath').value || '<请选择数据源>';
        } else if (this.selectedType === 'IMPORT') {
            return this.previewSqlStoragePath();
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
            if (this.selectedType === 'IMPORT') {
                typeLabel = '导入数据 (IMPORT)';
                const importFile = $('importFile');
                resourceLabel = (importFile && importFile.files && importFile.files.length) ? importFile.files[0].name : '<未选择>';
            } else {
                typeLabel = '数据源挂载 (SOURCE)';
                resourceLabel = $('sourcePath').value || '-';
            }
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
        const submitBtn = $('submitBtn');
        const datasetName = $('datasetName').value.trim();
        const dataModality = $('dataModality').value;
        const remark = $('remark').value.trim();
        if (!datasetName) return this.fail('请输入数据集名称', 'datasetNameError');

        const request = { datasetName, dataModality, remark, provenanceType: this.selectedType };

        if (this.selectedType === 'SOURCE' && this.createMode === 'new') {
            request.provenanceType = 'SOURCE';
            const sourcePath = $('sourcePath').value;
            if (!sourcePath) return this.fail('请选择数据源', 'sourcePathError');
            request.sourcePath = sourcePath;
        } else if (this.selectedType === 'IMPORT' && this.createMode === 'new') {
            request.provenanceType = 'IMPORT';
            const importFile = $('importFile');
            if (!importFile || !importFile.files || !importFile.files.length) {
                return this.fail('请上传 CSV 文件', 'importFileFieldError');
            }
            const file = importFile.files[0];
            const keyColumn = $('importKeyColumn')?.value.trim() || '';
            // 读取文件为 Base64
            submitBtn.disabled = true;
            submitBtn.textContent = '上传文件中...';
            try {
                const base64 = await this.readFileAsBase64(file);
                request.importFileName = file.name;
                request.importFileBase64 = base64;
                if (keyColumn) request.importKeyColumn = keyColumn;
            } catch (err) {
                submitBtn.disabled = false;
                submitBtn.textContent = '创建数据集';
                return this.fail('文件读取失败: ' + err.message, 'importFileFieldError');
            }
        } else {
            const upstream = this.upstreamVersionId || $('upstreamVersion').value;
            if (!upstream) return this.fail('请选择父级数据集版本', 'upstreamVersionError');
            request.upstreamVersionIds = [Number(upstream)];
            if (this.selectedType === 'SQL_QUERY') {
                const snippetId = $('sqlSnippet').value;
                if (!snippetId) return this.fail('请选择 SQL 脚本', 'sqlSnippetError');
                request.sqlSnippetId = Number(snippetId);
            } else if (this.selectedType === 'TRANSFORM') {
                const createTime = $('transformJob').value;
                if (!createTime) return this.fail('请选择 Transform 作业', 'transformJobError');
                request.transformCompareCreateTime = Number(createTime);
            }
        }

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

    fail(msg, fieldId) {
        // 优先在对应输入框下方显示内联错误
        if (fieldId) {
            const errEl = this.shadowRoot.getElementById(fieldId);
            if (errEl) {
                errEl.textContent = msg;
                errEl.classList.add('show');
                return;
            }
        }
        // 无对应字段时使用全局 toast
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(msg, 'error');
        } else {
            const errorBox = this.shadowRoot.getElementById('errorBox');
            if (errorBox) { errorBox.textContent = msg; errorBox.style.display = 'block'; }
        }
    }

    /** 读取文件为 Base64 字符串（去掉 data: 前缀） */
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                // FileReader.readAsDataURL 返回 "data:...;base64,XXXX" 格式，去掉前缀
                const base64 = String(result).split(',')[1] || '';
                resolve(base64);
            };
            reader.onerror = () => reject(reader.error || new Error('读取失败'));
            reader.readAsDataURL(file);
        });
    }

    hideError() {
        const errorBox = this.shadowRoot.getElementById('errorBox');
        if (errorBox) errorBox.style.display = 'none';
        // 清除所有内联字段错误
        this.shadowRoot.querySelectorAll('.field-error').forEach(el => el.classList.remove('show'));
    }

    async loadSqlPreview(snippetId) {
        const area = this.shadowRoot.getElementById('sqlPreviewArea');
        const content = this.shadowRoot.getElementById('sqlPreviewContent');
        if (!area || !content) return;
        area.style.display = 'block';
        content.textContent = '加载中...';
        try {
            const result = await window.AppConfig.get('sqlSnippet', 'metas', { id: snippetId });
            if (result.code === 200 && result.data) {
                let sqlList = [];
                try {
                    sqlList = JSON.parse(result.data.sqlList || '[]');
                } catch (e) {
                    sqlList = [];
                }
                if (sqlList.length === 0) {
                    content.textContent = '该SQL脚本暂无SQL语句';
                } else {
                    content.textContent = sqlList.map(s => '- ' + s).join('\n');
                }
            } else {
                content.textContent = '加载失败: ' + (result.message || '未知错误');
            }
        } catch (error) {
            console.error('加载SQL脚本详情失败:', error);
            content.textContent = '加载失败: ' + error.message;
        }
    }

    hideSqlPreview() {
        const area = this.shadowRoot.getElementById('sqlPreviewArea');
        const content = this.shadowRoot.getElementById('sqlPreviewContent');
        if (area) area.style.display = 'none';
        if (content) content.textContent = '';
    }

    escape(val) {
        return String(val == null ? '' : val).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
    }
}

customElements.define('dataset-dialog', DatasetDialog);
