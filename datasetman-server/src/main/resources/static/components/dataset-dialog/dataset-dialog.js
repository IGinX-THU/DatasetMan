class DatasetDialog extends HTMLElement {
    constructor() {
        super();
        this.options = { sources: [], snippets: [], jobs: [] };
        this.selectedType = 'SOURCE'; // SOURCE | SQL_QUERY | TRANSFORM
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.bindEvents();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: none;
                    width: 100%;
                    height: 100%;
                    overflow: auto;
                    box-sizing: border-box;
                    background: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    color: #1f2937;
                }
                :host([show]) {
                    display: block;
                }
                .container {
                    max-width: 900px;
                    margin: 24px auto;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
                    overflow: hidden;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 18px 24px;
                    border-bottom: 1px solid #e5e7eb;
                    background: #ffffff;
                }
                .title {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 600;
                    color: #111827;
                }
                .close-btn {
                    border: 0;
                    background: transparent;
                    font-size: 22px;
                    line-height: 1;
                    cursor: pointer;
                    color: #9ca3af;
                }
                .close-btn:hover {
                    color: #4b5563;
                }
                .body {
                    padding: 24px;
                }
                .form-section {
                    margin-bottom: 24px;
                }
                .section-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 12px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid #f3f4f6;
                }
                .form-group {
                    margin-bottom: 16px;
                }
                .form-row {
                    display: flex;
                    gap: 16px;
                }
                .form-row .form-group {
                    flex: 1;
                }
                label {
                    display: block;
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 6px;
                    color: #4b5563;
                }
                .required {
                    color: #ef4444;
                }
                input, select, textarea {
                    width: 100%;
                    padding: 9px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 13px;
                    box-sizing: border-box;
                    background: #ffffff;
                    color: #1f2937;
                    transition: border-color 0.2s;
                }
                input:focus, select:focus, textarea:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
                }
                .type-cards {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 14px;
                    margin-bottom: 20px;
                }
                .type-card {
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: #ffffff;
                }
                .type-card:hover {
                    border-color: #93c5fd;
                    background: #f8fafc;
                }
                .type-card.active {
                    border-color: #2563eb;
                    background: #eff6ff;
                }
                .type-card strong {
                    display: block;
                    font-size: 14px;
                    color: #111827;
                    margin-bottom: 4px;
                }
                .type-card span {
                    font-size: 12px;
                    color: #6b7280;
                    line-height: 1.4;
                }
                .type-panel {
                    display: none;
                    background: #fafbff;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 16px;
                    margin-top: 12px;
                }
                .type-panel.active {
                    display: block;
                }
                .footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 16px 24px;
                    border-top: 1px solid #e5e7eb;
                    background: #ffffff;
                }
                .btn {
                    padding: 9px 20px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                .btn-cancel {
                    background: #ffffff;
                    border-color: #d1d5db;
                    color: #374151;
                }
                .btn-cancel:hover { background: #f3f4f6; }
                .btn-primary {
                    background: #2563eb;
                    color: #ffffff;
                }
                .btn-primary:hover { background: #1d4ed8; }
                .error-box {
                    padding: 10px 14px;
                    background: #fef2f2;
                    border: 1px solid #fee2e2;
                    border-radius: 6px;
                    color: #b91c1c;
                    font-size: 13px;
                    margin-bottom: 16px;
                    display: none;
                }
                .hint {
                    font-size: 12px;
                    color: #6b7280;
                    margin-top: 4px;
                }
                .storage-path-box {
                    margin-top: 10px;
                    padding: 8px 12px;
                    background: #f1f5f9;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 12px;
                    color: #334155;
                    display: none;
                    word-break: break-all;
                }
                .storage-path-box .label {
                    color: #64748b;
                    margin-right: 6px;
                }
                .storage-path-box .value {
                    font-family: 'Consolas', 'Monaco', monospace;
                    color: #1e40af;
                }
            </style>

            <div class="container">
                <div class="header">
                    <h3 class="title">创建数据集</h3>
                    <button class="close-btn" id="closeBtn">&times;</button>
                </div>

                <div class="body">
                    <div class="error-box" id="errorBox"></div>

                    <!-- 1. 基本信息 -->
                    <div class="form-section">
                        <div class="section-title">基本信息</div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>数据集名称 <span class="required">*</span></label>
                                <input type="text" id="datasetName" placeholder="例如：vehicle_speed_stats" maxlength="50" required>
                            </div>
                            <div class="form-group">
                                <label>数据类型 <span class="required">*</span></label>
                                <select id="dataModality">
                                    <option value="relational">关系型 (Relational)</option>
                                    <option value="time_series">时序数据 (Time Series)</option>
                                    <option value="key_value">键值 (Key-Value)</option>
                                    <option value="semi_structured">半结构化/文档 (Document)</option>
                                    <option value="file_system">文件系统 (FileSystem)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>备注信息</label>
                            <input type="text" id="remark" placeholder="创建备注（可选）">
                        </div>
                    </div>

                    <!-- 2. 产出方式三选一（仅选取已编排好的资源） -->
                    <div class="form-section">
                        <div class="section-title">产出方式</div>
                        <div class="type-cards">
                            <div class="type-card active" data-type="SOURCE">
                                <strong>1. 数据源</strong>
                                <span>选取已注册的异构数据源，即时挂载为零拷贝数据集。</span>
                            </div>
                            <div class="type-card" data-type="SQL_QUERY">
                                <strong>2. SQL 脚本</strong>
                                <span>选取「SQL脚本托管」中已编排好的脚本执行并物化为新版本。</span>
                            </div>
                            <div class="type-card" data-type="TRANSFORM">
                                <strong>3. Transform 作业</strong>
                                <span>选取已编排完成的 Transform 作业，将其物化输出注册为新版本。</span>
                            </div>
                        </div>

                        <!-- 方式一面板：SOURCE -->
                        <div class="type-panel active" id="panel-SOURCE">
                            <div class="form-group">
                                <label>选取已注册数据源 <span class="required">*</span></label>
                                <select id="sourcePath">
                                    <option value="">请选择数据源...</option>
                                    ${this.options.sources.map(s => `<option value="${s.name}" data-desc="${this.escape(s.desc || '')}">${s.name}${s.desc ? ' (' + this.escape(s.desc) + ')' : ''}</option>`).join('')}
                                </select>
                                <div class="hint">如需接入新引擎，请通过顶部菜单「数据源 → 注册异构数据源」完成接入。</div>
                                <div class="storage-path-box" id="sourcePathBox">
                                    <span class="label">存储路径：</span><span class="value" id="sourcePathValue"></span>
                                </div>
                            </div>
                        </div>

                        <!-- 方式二面板：SQL_QUERY -->
                        <div class="type-panel" id="panel-SQL_QUERY">
                            <div class="form-group">
                                <label>选取已托管 SQL 脚本 <span class="required">*</span></label>
                                <select id="sqlSnippet">
                                    <option value="">请选择 SQL 脚本...</option>
                                    ${this.options.snippets.map(s => `<option value="${s.createTime || s.id}">${this.escape(s.name)}</option>`).join('')}
                                </select>
                                <div class="hint">脚本在「SQL脚本托管」菜单中编排与上传，此处仅选取引用。</div>
                                <div class="storage-path-box" id="sourcePathBox-SQL">
                                    <span class="label">存储路径：</span><span class="value" id="sqlPathValue"></span>
                                </div>
                            </div>
                        </div>

                        <!-- 方式三面板：TRANSFORM -->
                        <div class="type-panel" id="panel-TRANSFORM">
                            <div class="form-group">
                                <label>选取已编排的 Transform 作业 <span class="required">*</span></label>
                                <select id="transformJob">
                                    <option value="">请选择 Transform 作业...</option>
                                    ${this.options.jobs.map(j => `<option value="${j.createTime}" data-export-type="${j.exportType || ''}" data-export-file="${this.escape(j.exportFile || '')}">${this.escape(j.name)}</option>`).join('')}
                                </select>
                                <div class="hint">作业在「Transform 编排」菜单中编排，提交创建时将自动执行并物化输出。</div>
                                <div class="storage-path-box" id="sourcePathBox-TRANSFORM">
                                    <span class="label">存储路径：</span><span class="value" id="transformPathValue"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <button class="btn btn-cancel" id="cancelBtn">取消</button>
                    <button class="btn btn-primary" id="submitBtn">创建数据集</button>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.shadowRoot.querySelector('#closeBtn').addEventListener('click', () => this.hide());
        this.shadowRoot.querySelector('#cancelBtn').addEventListener('click', () => this.hide());
        this.shadowRoot.querySelector('#submitBtn').addEventListener('click', () => this.handleSubmit());

        // 产出方式卡片切换
        this.shadowRoot.querySelectorAll('.type-card').forEach(card => {
            card.addEventListener('click', () => {
                this.shadowRoot.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedType = card.dataset.type;
                this.shadowRoot.querySelectorAll('.type-panel').forEach(p => p.classList.remove('active'));
                const targetPanel = this.shadowRoot.querySelector(`#panel-${this.selectedType}`);
                if (targetPanel) targetPanel.classList.add('active');
                this.updateStoragePathDisplay();
            });
        });

        // 数据源选取后同步数据类型下拉并显示存储路径
        const sourcePathSelect = this.shadowRoot.querySelector('#sourcePath');
        if (sourcePathSelect) {
            sourcePathSelect.addEventListener('change', (e) => {
                const selected = e.target.selectedOptions[0];
                const desc = selected ? selected.getAttribute('data-desc') : '';
                const modalitySelect = this.shadowRoot.querySelector('#dataModality');
                if (modalitySelect && desc) {
                    const option = Array.from(modalitySelect.options).find(o => o.value === desc);
                    if (option) {
                        modalitySelect.value = desc;
                    }
                }
                this.updateStoragePathDisplay();
            });
        }

        // Transform 作业选取后显示物化输出路径
        const transformJobSelect = this.shadowRoot.querySelector('#transformJob');
        if (transformJobSelect) {
            transformJobSelect.addEventListener('change', () => this.updateStoragePathDisplay());
        }

        // 数据集名称输入后实时刷新 SQL 物化路径预览
        const datasetNameInput = this.shadowRoot.querySelector('#datasetName');
        if (datasetNameInput) {
            datasetNameInput.addEventListener('input', () => this.updateStoragePathDisplay());
        }
    }

    /**
     * 复刻后端 normalizePath：将非法字符替换为下划线，折叠连续点号，去除首尾点号
     */
    normalizePath(path) {
        if (!path) return 'value';
        return path
            .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5.]/g, '_')
            .replace(/\.{2,}/g, '.')
            .replace(/^\.|\.$/g, '');
    }

    /**
     * 复刻后端 CommonUtil.generateVersion：v_yyMMdd_HHmmss (Asia/Shanghai)
     */
    generateVersion(timestamp) {
        const date = new Date(timestamp);
        const fmt = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: '2-digit', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        const parts = {};
        fmt.formatToParts(date).forEach(p => { parts[p.type] = p.value; });
        const yy = parts.year;
        const MM = parts.month;
        const dd = parts.day;
        const HH = parts.hour;
        const mm = parts.minute;
        const ss = parts.second;
        return `v_${yy}${MM}${dd}_${HH}${mm}${ss}`;
    }

    /**
     * 复刻后端 nextStoragePath：datasets.<safeName>.<version>
     */
    previewSqlStoragePath() {
        const datasetName = this.shadowRoot.querySelector('#datasetName').value.trim();
        const safeName = this.normalizePath(datasetName).replace(/\./g, '_');
        const version = this.generateVersion(Date.now());
        return `datasets.${safeName || '<数据集名称>'}.${version}`;
    }

    updateStoragePathDisplay() {
        if (this.selectedType === 'SOURCE') {
            const sourcePath = this.shadowRoot.querySelector('#sourcePath').value;
            const box = this.shadowRoot.querySelector('#sourcePathBox');
            const valueEl = this.shadowRoot.querySelector('#sourcePathValue');
            if (sourcePath) {
                if (valueEl) valueEl.textContent = sourcePath;
                if (box) box.style.display = 'block';
            } else {
                if (box) box.style.display = 'none';
            }
        } else if (this.selectedType === 'SQL_QUERY') {
            const box = this.shadowRoot.querySelector('#sourcePathBox-SQL');
            const valueEl = this.shadowRoot.querySelector('#sqlPathValue');
            if (valueEl) valueEl.textContent = this.previewSqlStoragePath();
            if (box) box.style.display = 'block';
        } else if (this.selectedType === 'TRANSFORM') {
            const jobSelect = this.shadowRoot.querySelector('#transformJob');
            const selected = jobSelect.selectedOptions[0];
            const box = this.shadowRoot.querySelector('#sourcePathBox-TRANSFORM');
            const valueEl = this.shadowRoot.querySelector('#transformPathValue');
            if (selected && selected.value) {
                const exportType = selected.getAttribute('data-export-type');
                const exportFile = selected.getAttribute('data-export-file') || '';
                let path = '';
                if (exportType === '2') {
                    // IGinX 输出：列名默认加 transform. 前缀
                    path = 'transform';
                } else if (exportType === '1' && exportFile) {
                    let file = exportFile.replace(/\\/g, '/');
                    file = file.substring(file.lastIndexOf('/') + 1);
                    path = 'file_system.sys_data.job.' + file;
                }
                if (valueEl) valueEl.textContent = path || '无法解析输出路径（需作业 exportType=1 或 2 且有导出信息）';
                if (box) box.style.display = 'block';
            } else {
                if (box) box.style.display = 'none';
            }
        }
    }

    async show(context) {
        this.style.display = 'block';
        this.setAttribute('show', '');
        await this.loadOptions();
        this.render();
        this.bindEvents();

        if (context?.datasetName) {
            const nameInput = this.shadowRoot.querySelector('#datasetName');
            if (nameInput) nameInput.value = context.datasetName;
        }
    }

    hide() {
        this.style.display = 'none';
        this.removeAttribute('show');
        this.hideError();
    }

    async loadOptions() {
        try {
            const [sourcesRes, snippetsRes, jobsRes] = await Promise.all([
                window.AppConfig.get('datasource', 'archives').catch(() => ({ data: [] })),
                window.AppConfig.get('sqlSnippet', 'list').catch(() => ({ data: [] })),
                window.AppConfig.post('transformCompare', 'query', { pageNum: 1, pageSize: 50 }).catch(() => ({ data: [] }))
            ]);

            this.options.sources = sourcesRes.data || [];
            this.options.snippets = snippetsRes.data || [];
            this.options.jobs = jobsRes.data || [];
        } catch (e) {
            console.error('加载选项数据失败:', e);
        }
    }

    async handleSubmit() {
        const datasetName = this.shadowRoot.querySelector('#datasetName').value.trim();
        const dataModality = this.shadowRoot.querySelector('#dataModality').value;
        const remark = this.shadowRoot.querySelector('#remark').value.trim();

        if (!datasetName) return this.fail('请输入数据集名称');

        const request = {
            datasetName,
            dataModality,
            remark,
            provenanceType: this.selectedType
        };

        if (this.selectedType === 'SOURCE') {
            const sourcePath = this.shadowRoot.querySelector('#sourcePath').value;
            if (!sourcePath) return this.fail('请选择数据源');
            request.sourcePath = sourcePath;
        } else if (this.selectedType === 'SQL_QUERY') {
            const snippetId = this.shadowRoot.querySelector('#sqlSnippet').value;
            if (!snippetId) return this.fail('请选择已托管的 SQL 脚本');
            request.sqlSnippetId = Number(snippetId);
        } else if (this.selectedType === 'TRANSFORM') {
            const createTime = this.shadowRoot.querySelector('#transformJob').value;
            if (!createTime) return this.fail('请选择已编排的 Transform 作业');
            request.transformCompareCreateTime = Number(createTime);
        }

        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '创建中...';

        try {
            const result = await window.AppConfig.post('dataset', 'create', request);
            if (result.success || result.code === 200) {
                if (window.CommonUtils?.showToast) {
                    window.CommonUtils.showToast('数据集创建成功', 'success');
                }
                this.dispatchEvent(new CustomEvent('dataset-created', { bubbles: true, composed: true, detail: result.data }));
                if (window.loadDataSourceTree) await window.loadDataSourceTree();
                if (window.loadDatasetTree) await window.loadDatasetTree();
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
        const errorBox = this.shadowRoot.querySelector('#errorBox');
        if (errorBox) {
            errorBox.textContent = msg;
            errorBox.style.display = 'block';
        }
    }

    hideError() {
        const errorBox = this.shadowRoot.querySelector('#errorBox');
        if (errorBox) errorBox.style.display = 'none';
    }

    escape(val) {
        return String(val == null ? '' : val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

customElements.define('dataset-dialog', DatasetDialog);
