class DatasetDialog extends HTMLElement {
    constructor() {
        super();
        this.currentStep = 1;
        this.totalSteps = 4;
        this.options = { sources: [], datasets: [], snippets: [], udfs: [], jobs: [] };
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
                .wizard-container {
                    max-width: 960px;
                    margin: 24px auto;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
                    overflow: hidden;
                }
                .wizard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 28px;
                    border-bottom: 1px solid #e5e7eb;
                    background: #ffffff;
                }
                .wizard-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #111827;
                }
                .close-btn {
                    border: 0;
                    background: transparent;
                    font-size: 24px;
                    line-height: 1;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 4px;
                }
                .close-btn:hover {
                    color: #4b5563;
                }
                .steps {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    padding: 20px 28px 0;
                    gap: 12px;
                }
                .step-indicator {
                    padding: 10px 12px;
                    text-align: center;
                    border-radius: 6px;
                    color: #6b7280;
                    background: #f3f4f6;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .step-indicator.active {
                    color: #ffffff;
                    background: #2563eb;
                }
                .step-indicator.done {
                    color: #1d4ed8;
                    background: #dbeafe;
                }
                .wizard-body {
                    padding: 28px;
                    min-height: 380px;
                }
                .step-panel {
                    display: none;
                }
                .step-panel.active {
                    display: block;
                }
                .section-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: #1f2937;
                    margin-bottom: 18px;
                }
                .types-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 14px;
                }
                .type-card {
                    border: 1.5px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 16px 18px;
                    cursor: pointer;
                    background: #ffffff;
                    transition: all 0.15s ease;
                }
                .type-card:hover {
                    border-color: #93c5fd;
                    background: #f8fafc;
                }
                .type-card.selected {
                    border-color: #2563eb;
                    background: #eff6ff;
                }
                .type-card strong {
                    display: block;
                    margin-bottom: 6px;
                    color: #111827;
                    font-size: 14px;
                }
                .type-card span {
                    color: #6b7280;
                    font-size: 13px;
                    line-height: 1.5;
                }
                .form-group {
                    margin-bottom: 18px;
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                label {
                    display: block;
                    margin-bottom: 7px;
                    color: #374151;
                    font-size: 14px;
                    font-weight: 500;
                }
                input, select, textarea {
                    width: 100%;
                    box-sizing: border-box;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    padding: 10px 12px;
                    font-size: 14px;
                    background: #ffffff;
                    color: #1f2937;
                    outline: none;
                    transition: border-color 0.15s;
                }
                input:focus, select:focus, textarea:focus {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                select[multiple] {
                    min-height: 120px;
                }
                textarea {
                    min-height: 80px;
                    resize: vertical;
                }
                .required {
                    color: #ef4444;
                }
                .hint {
                    color: #6b7280;
                    font-size: 12px;
                    margin-top: 5px;
                }
                .empty {
                    color: #9ca3af;
                    padding: 30px;
                    text-align: center;
                    background: #f9fafb;
                    border-radius: 6px;
                }
                .summary {
                    display: grid;
                    grid-template-columns: 140px 1fr;
                    gap: 12px;
                    font-size: 14px;
                    background: #f9fafb;
                    padding: 18px;
                    border-radius: 8px;
                }
                .summary dt {
                    color: #6b7280;
                    font-weight: 500;
                }
                .summary dd {
                    margin: 0;
                    color: #111827;
                    word-break: break-all;
                }
                .wizard-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 18px 28px;
                    border-top: 1px solid #e5e7eb;
                    background: #fafafa;
                }
                .right-actions {
                    display: flex;
                    gap: 10px;
                }
                button.action-btn {
                    padding: 9px 22px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.15s ease;
                }
                .secondary-btn {
                    border: 1px solid #d1d5db;
                    background: #ffffff;
                    color: #374151;
                }
                .secondary-btn:hover {
                    background: #f3f4f6;
                }
                .primary-btn {
                    border: 1px solid #2563eb;
                    background: #2563eb;
                    color: #ffffff;
                }
                .primary-btn:hover {
                    background: #1d4ed8;
                }
                button:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }
                .error-box {
                    display: none;
                    color: #dc2626;
                    font-size: 13px;
                    margin-bottom: 16px;
                    padding: 10px 14px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 6px;
                }
            </style>
            <div class="wizard-container">
                <div class="wizard-header">
                    <h3 class="wizard-title" id="wizardTitle">创建数据集</h3>
                    <button class="close-btn" id="closeBtn" type="button" title="关闭">&times;</button>
                </div>
                <div class="steps">
                    <div class="step-indicator" data-step="1">1. 类型与名称</div>
                    <div class="step-indicator" data-step="2">2. 配置数据源 / 上游</div>
                    <div class="step-indicator" data-step="3">3. 配置变换</div>
                    <div class="step-indicator" data-step="4">4. 确认创建</div>
                </div>
                <div class="wizard-body">
                    <div class="error-box" id="errorBox"></div>
                    <section class="step-panel" data-step="1">
                        <div class="section-title">选择数据集产出方式</div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>数据集名称 <span class="required">*</span></label>
                                <input id="datasetName" maxlength="80" placeholder="已有名称将追加新版本">
                            </div>
                            <div class="form-group">
                                <label>数据类型 (Data Type) <span class="required">*</span></label>
                                <select id="datasetModality">
                                    <option value="relational" selected>关系数据 (relational)</option>
                                    <option value="time_series">时序数据 (time_series)</option>
                                    <option value="key_value">键值数据 (key_value)</option>
                                    <option value="semi_structured">半结构化数据 (semi_structured)</option>
                                    <option value="file_system">文件型数据 (file_system)</option>
                                </select>
                            </div>
                        </div>
                        <div class="types-grid">
                            <div class="type-card" data-type="SOURCE">
                                <strong>注册数据源</strong>
                                <span>接入并挂载一个外部数据源作为初始数据集。</span>
                            </div>
                            <div class="type-card" data-type="SELECT">
                                <strong>数据源的一部分</strong>
                                <span>执行 SELECT 并将查询结果物化为新版本。</span>
                            </div>
                            <div class="type-card" data-type="SELECT_UDF">
                                <strong>SELECT + UDF</strong>
                                <span>执行包含 UDF 的 SELECT，保存处理后的具体结果。</span>
                            </div>
                            <div class="type-card" data-type="TRANSFORM_SQL">
                                <strong>Transform 结果</strong>
                                <span>使用已完成 Transform 作业的物化输出。</span>
                            </div>
                        </div>
                    </section>
                    <section class="step-panel" data-step="2">
                        <div id="upstreamContent"></div>
                    </section>
                    <section class="step-panel" data-step="3">
                        <div id="configContent"></div>
                    </section>
                    <section class="step-panel" data-step="4">
                        <div class="section-title">确认数据集版本信息</div>
                        <dl class="summary" id="summary"></dl>
                        <div class="form-group" style="margin-top:20px">
                            <label>描述</label>
                            <textarea id="description" placeholder="数据集描述（可选）"></textarea>
                        </div>
                        <div class="form-group">
                            <label>版本备注</label>
                            <textarea id="remark" placeholder="本次变化说明（可选）"></textarea>
                        </div>
                    </section>
                </div>
                <div class="wizard-footer">
                    <button class="action-btn secondary-btn" id="cancelBtn" type="button">关闭</button>
                    <div class="right-actions">
                        <button class="action-btn secondary-btn" id="prevBtn" type="button">上一步</button>
                        <button class="action-btn primary-btn" id="nextBtn" type="button">下一步</button>
                        <button class="action-btn primary-btn" id="submitBtn" type="button">完成并创建</button>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.shadowRoot.querySelector('#closeBtn').addEventListener('click', () => this.hide());
        this.shadowRoot.querySelector('#cancelBtn').addEventListener('click', () => this.hide());
        this.shadowRoot.querySelector('#prevBtn').addEventListener('click', () => this.go(this.currentStep - 1));
        this.shadowRoot.querySelector('#nextBtn').addEventListener('click', () => {
            if (this.validateStep()) this.go(this.currentStep + 1);
        });
        this.shadowRoot.querySelector('#submitBtn').addEventListener('click', () => this.submit());
        this.shadowRoot.querySelectorAll('.type-card').forEach(card => card.addEventListener('click', () => {
            this.shadowRoot.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        }));
    }

    show(data) {
        this.setAttribute('show', '');
        this.currentStep = 1;
        const titleEl = this.shadowRoot.querySelector('#wizardTitle');
        const nameInput = this.shadowRoot.querySelector('#datasetName');
        const descInput = this.shadowRoot.querySelector('#description');
        const remarkInput = this.shadowRoot.querySelector('#remark');

        if (data && (data.datasetName || data.name)) {
            titleEl.textContent = '创建数据集新版本';
            nameInput.value = data.datasetName || data.name || '';
        } else {
            titleEl.textContent = '创建数据集';
            nameInput.value = '';
        }
        if (descInput) descInput.value = '';
        if (remarkInput) remarkInput.value = '';
        this.shadowRoot.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
        this.loadOptions().then(() => this.go(1));
    }

    showCreate() {
        this.show();
    }

    showEdit(data) {
        this.show(data);
    }

    hide() {
        this.removeAttribute('show');
    }

    async loadOptions() {
        const jobQuery = { pageNum: 1, pageSize: 500 };
        const [sources, datasets, snippets, udfs, jobs] = await Promise.allSettled([
            window.AppConfig.get('datasource', 'list'),
            window.AppConfig.get('dataset', 'tree'),
            window.AppConfig.get('sqlSnippet', 'list'),
            window.AppConfig.request(window.AppConfig.getApiUrl('udf', 'query').replace('{type}', 'udf')),
            window.AppConfig.post('transformJob', 'query', jobQuery)
        ]);
        this.options.sources = this.resultData(sources).map(s => ({ value: s.dataPrefix ? `${s.schemaPrefix}.${s.dataPrefix}` : s.schemaPrefix, label: s.dataPrefix ? `${s.schemaPrefix}.${s.dataPrefix}` : s.schemaPrefix }));
        this.options.datasets = this.resultData(datasets);
        this.options.snippets = this.resultData(snippets);
        this.options.udfs = this.resultData(udfs);
        this.options.jobs = this.resultData(jobs).filter(j => j.jobState === 1);
    }

    resultData(settled) {
        if (settled.status !== 'fulfilled') return [];
        const result = settled.value;
        return (result && (result.success || result.code === 200) && Array.isArray(result.data)) ? result.data : [];
    }

    go(step) {
        if (step < 1 || step > this.totalSteps) return;
        this.currentStep = step;
        this.shadowRoot.querySelectorAll('.step-panel').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === step));
        this.shadowRoot.querySelectorAll('.step-indicator').forEach(el => {
            const n = Number(el.dataset.step);
            el.classList.toggle('active', n === step);
            el.classList.toggle('done', n < step);
        });
        if (step === 2) this.renderUpstream();
        if (step === 3) this.renderConfig();
        if (step === 4) this.renderSummary();
        this.shadowRoot.querySelector('#prevBtn').style.visibility = step === 1 ? 'hidden' : 'visible';
        this.shadowRoot.querySelector('#nextBtn').style.display = step === 4 ? 'none' : 'inline-block';
        this.shadowRoot.querySelector('#submitBtn').style.display = step === 4 ? 'inline-block' : 'none';
        this.hideError();
    }

    selectedType() {
        return this.shadowRoot.querySelector('.type-card.selected')?.dataset.type || '';
    }

    renderUpstream() {
        const type = this.selectedType();
        const container = this.shadowRoot.querySelector('#upstreamContent');
        if (type === 'SOURCE') {
            container.innerHTML = `
                <div class="section-title">填写外部数据源连接信息</div>
                <div class="form-group">
                    <label>数据源类型 <span class="required">*</span></label>
                    <select id="srcStorageEngineType">
                        <option value="">请选择数据源类型</option>
                        <option value="1">iotdb12</option>
                        <option value="2">influxdb</option>
                        <option value="3">filesystem</option>
                        <option value="4" selected>relational</option>
                        <option value="5">mongodb</option>
                        <option value="6">redis</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>主机地址 <span class="required">*</span></label>
                        <input id="srcHost" placeholder="如 127.0.0.1" value="127.0.0.1">
                    </div>
                    <div class="form-group">
                        <label>端口 <span class="required">*</span></label>
                        <input id="srcPort" type="number" placeholder="如 3306" value="3306">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>模式前缀 (Schema Prefix) <span class="required">*</span></label>
                        <input id="srcSchemaPrefix" placeholder="虚拟前缀，如 mysql8">
                    </div>
                    <div class="form-group">
                        <label>数据前缀 (Data Prefix)</label>
                        <input id="srcDataPrefix" placeholder="原数据库表名，如 t_user（可选）">
                    </div>
                </div>
                <div class="form-row" id="srcAuthFields">
                    <div class="form-group">
                        <label>用户名</label>
                        <input id="srcUsername" placeholder="请输入用户名" value="root">
                    </div>
                    <div class="form-group">
                        <label>密码</label>
                        <input id="srcPassword" type="password" placeholder="请输入密码">
                    </div>
                </div>
                <div id="srcRelationalFields" style="display:block;">
                    <div class="form-group">
                        <label>数据库引擎</label>
                        <select id="srcRelationalEngine">
                            <option value="mysql">MySQL</option>
                            <option value="postgresql">PostgreSQL</option>
                            <option value="oracle">Oracle</option>
                            <option value="oceanbase">OceanBase</option>
                            <option value="dm">Dameng</option>
                        </select>
                    </div>
                </div>
                <div id="srcFsFields" style="display:none;">
                    <div class="form-group">
                        <label>IGinX节点端口 <span class="required">*</span></label>
                        <input id="srcIginxPort" type="number" placeholder="6888" value="6888">
                    </div>
                    <div class="form-group">
                        <label>历史数据文件读取目录 <span class="required">*</span></label>
                        <input id="srcDummyDir" placeholder="请输入文件读取绝对目录">
                    </div>
                </div>
                <div id="srcInfluxFields" style="display:none;">
                    <div class="form-group">
                        <label>InfluxDB URL <span class="required">*</span></label>
                        <input id="srcInfluxUrl" placeholder="http://localhost:8086/">
                    </div>
                    <div class="form-group">
                        <label>访问令牌</label>
                        <input id="srcInfluxToken" placeholder="请输入访问令牌">
                    </div>
                </div>
                <div id="srcMongoFields" style="display:none;">
                    <div class="form-group">
                        <label>MongoDB连接字符串</label>
                        <input id="srcMongoUri" placeholder="mongodb://localhost:27017">
                    </div>
                </div>
                <div class="hint">配置将直接注册外部存储引擎并作为 SOURCE 数据集初始版本挂载。</div>
            `;
            const typeSelect = container.querySelector('#srcStorageEngineType');
            typeSelect.addEventListener('change', () => {
                const val = typeSelect.value;
                const authFields = container.querySelector('#srcAuthFields');
                const relationalFields = container.querySelector('#srcRelationalFields');
                const fsFields = container.querySelector('#srcFsFields');
                const influxFields = container.querySelector('#srcInfluxFields');
                const mongoFields = container.querySelector('#srcMongoFields');

                authFields.style.display = (val === '1' || val === '2' || val === '4' || val === '6') ? 'grid' : 'none';
                relationalFields.style.display = (val === '4') ? 'block' : 'none';
                fsFields.style.display = (val === '3') ? 'block' : 'none';
                influxFields.style.display = (val === '2') ? 'block' : 'none';
                mongoFields.style.display = (val === '5') ? 'block' : 'none';

                const mainModality = this.shadowRoot.querySelector('#datasetModality');
                if (mainModality) {
                    if (val === '1' || val === '2') mainModality.value = 'time_series';
                    else if (val === '3') mainModality.value = 'file_system';
                    else if (val === '4') mainModality.value = 'relational';
                    else if (val === '5') mainModality.value = 'semi_structured';
                    else if (val === '6') mainModality.value = 'key_value';
                }
            });
            return;
        }
        const options = this.options.datasets.flatMap(d => (d.versions || []).map(v => ({ id: v.versionId, text: `${d.datasetName} / ${v.versionNo}`, path: v.storagePath })));
        container.innerHTML = `
            <div class="section-title">选择上游数据集版本</div>
            <div class="form-group">
                <label>主上游版本 <span class="required">*</span></label>
                <select id="upstreamVersion">
                    <option value="">请选择</option>
                    ${options.map(o => `<option value="${o.id}" data-path="${this.escape(o.path)}">${this.escape(o.text)}</option>`).join('')}
                </select>
                <div class="hint">新版本将基于该上游数据进行处理，并在血缘图谱中建立依赖关系。</div>
            </div>
        `;
    }

    renderConfig() {
        const type = this.selectedType();
        const container = this.shadowRoot.querySelector('#configContent');
        if (type === 'SOURCE') {
            container.innerHTML = `
                <div class="section-title">数据源挂载信息</div>
                <div class="empty">已在第 2 步配置完整数据源连接参数，无需额外 SQL 变换配置。</div>
            `;
        } else if (type === 'SELECT' || type === 'SELECT_UDF') {
            container.innerHTML = `
                <div class="section-title">配置 SQL 变换</div>
                <div class="form-group">
                    <label>SQL片段 <span class="required">*</span></label>
                    <select id="sqlSnippet">
                        <option value="">请选择</option>
                        ${this.options.snippets.map(s => `<option value="${s.id}">${this.escape(s.name)}</option>`).join('')}
                    </select>
                    <div class="hint">SQL可使用 {upstream} 占位符引用主上游路径。</div>
                </div>
                ${type === 'SELECT_UDF' ? `
                    <div class="form-group">
                        <label>涉及的 UDF <span class="required">*</span></label>
                        <select id="udfNames" multiple>
                            ${this.options.udfs.map(u => `<option value="${this.escape(u.name)}">${this.escape(u.name)}</option>`).join('')}
                        </select>
                    </div>
                ` : ''}
            `;
        } else {
            container.innerHTML = `
                <div class="section-title">选择已完成的 Transform 任务</div>
                <div class="form-group">
                    <label>Transform任务 <span class="required">*</span></label>
                    <select id="transformJob">
                        <option value="">请选择</option>
                        ${this.options.jobs.map(j => `<option value="${this.escape(j.jobId)}">${this.escape(j.name)} (${this.escape(j.jobId)})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>物化输出路径</label>
                    <input id="transformOutputPath" placeholder="文件导出任务可留空；IGinX输出请填写路径">
                    <div class="hint">任务必须已完成且结果已经落盘。</div>
                </div>
            `;
        }
    }

    validateStep() {
        if (this.currentStep === 1) {
            if (!this.shadowRoot.querySelector('#datasetName').value.trim()) return this.fail('请输入数据集名称');
            if (!this.selectedType()) return this.fail('请选择数据集产出方式');
        }
        if (this.currentStep === 2) {
            if (this.selectedType() === 'SOURCE') {
                const engineType = this.shadowRoot.querySelector('#srcStorageEngineType')?.value;
                const host = this.shadowRoot.querySelector('#srcHost')?.value?.trim();
                const port = this.shadowRoot.querySelector('#srcPort')?.value?.trim();
                const schema = this.shadowRoot.querySelector('#srcSchemaPrefix')?.value?.trim();
                if (!engineType) return this.fail('请选择数据源类型');
                if (!host) return this.fail('请输入主机地址');
                if (!port) return this.fail('请输入端口号');
                if (!schema) return this.fail('请输入模式前缀');
            } else {
                if (!this.shadowRoot.querySelector('#upstreamVersion')?.value) return this.fail('请选择上游版本');
            }
        }
        if (this.currentStep === 3) {
            const type = this.selectedType();
            if ((type === 'SELECT' || type === 'SELECT_UDF') && !this.shadowRoot.querySelector('#sqlSnippet')?.value) return this.fail('请选择SQL片段');
            if (type === 'SELECT_UDF' && this.selectedValues('#udfNames').length === 0) return this.fail('请选择至少一个UDF');
            if (type === 'TRANSFORM_SQL' && !this.shadowRoot.querySelector('#transformJob')?.value) return this.fail('请选择已完成的Transform任务');
        }
        this.hideError();
        return true;
    }

    renderSummary() {
        const type = this.selectedType();
        const typeLabels = { SOURCE: '注册数据源', SELECT: 'SELECT', SELECT_UDF: 'SELECT + UDF', TRANSFORM_SQL: 'Transform结果' };
        const datasetName = this.shadowRoot.querySelector('#datasetName').value.trim();
        let upstream = '-';
        let config = '-';

        if (type === 'SOURCE') {
            const host = this.shadowRoot.querySelector('#srcHost')?.value;
            const port = this.shadowRoot.querySelector('#srcPort')?.value;
            const schema = this.shadowRoot.querySelector('#srcSchemaPrefix')?.value;
            upstream = '无（外部数据源接入）';
            config = `${schema} (${host}:${port})`;
        } else {
            upstream = this.shadowRoot.querySelector('#upstreamVersion')?.selectedOptions[0]?.textContent || '-';
            config = this.shadowRoot.querySelector('#sqlSnippet')?.selectedOptions[0]?.textContent || this.shadowRoot.querySelector('#transformJob')?.selectedOptions[0]?.textContent || '-';
        }

        this.shadowRoot.querySelector('#summary').innerHTML = `
            <dt>数据集名称</dt><dd>${this.escape(datasetName)}</dd>
            <dt>产出方式</dt><dd>${typeLabels[type] || type}</dd>
            <dt>上游版本</dt><dd>${this.escape(upstream)}</dd>
            <dt>配置概要</dt><dd>${this.escape(config)}</dd>
        `;
    }

    buildSourceRegisterData() {
        const type = parseInt(this.shadowRoot.querySelector('#srcStorageEngineType')?.value);
        const host = this.shadowRoot.querySelector('#srcHost')?.value?.trim();
        const port = parseInt(this.shadowRoot.querySelector('#srcPort')?.value?.trim());
        const schema = this.shadowRoot.querySelector('#srcSchemaPrefix')?.value?.trim();
        const dataPrefix = this.shadowRoot.querySelector('#srcDataPrefix')?.value?.trim();
        const username = this.shadowRoot.querySelector('#srcUsername')?.value?.trim();
        const password = this.shadowRoot.querySelector('#srcPassword')?.value?.trim();
        const modality = this.shadowRoot.querySelector('#datasetModality')?.value?.trim();

        const datasetName = this.shadowRoot.querySelector('#datasetName')?.value?.trim();
        const description = this.shadowRoot.querySelector('#description')?.value?.trim() || '';

        const data = {
            storageEngineType: type,
            ip: host,
            port: port,
            schemaPrefix: schema,
            hasData: true,
            isReadOnly: true,
            datasetName: datasetName,
            dataModality: modality || 'relational',
            description: description
        };
        if (dataPrefix) data.dataPrefix = dataPrefix;
        if (username) data.username = username;
        if (password) data.password = password;

        if (type === 4) { // relational
            data.engine = this.shadowRoot.querySelector('#srcRelationalEngine')?.value || 'mysql';
        } else if (type === 3) { // fs
            const igPort = this.shadowRoot.querySelector('#srcIginxPort')?.value;
            const dummyDir = this.shadowRoot.querySelector('#srcDummyDir')?.value?.trim();
            if (igPort) data.iginxPort = parseInt(igPort);
            if (dummyDir) data.dummyDir = dummyDir;
        } else if (type === 2) { // influx
            const url = this.shadowRoot.querySelector('#srcInfluxUrl')?.value?.trim();
            const token = this.shadowRoot.querySelector('#srcInfluxToken')?.value?.trim();
            if (url) data.url = url;
            if (token) data.token = token;
        } else if (type === 5) { // mongo
            const uri = this.shadowRoot.querySelector('#srcMongoUri')?.value?.trim();
            if (uri) data.mongodbUri = uri;
        }
        return data;
    }

    buildRequest() {
        const type = this.selectedType();
        const upstream = this.shadowRoot.querySelector('#upstreamVersion')?.value;
        const request = {
            datasetName: this.shadowRoot.querySelector('#datasetName').value.trim(),
            provenanceType: type,
            dataModality: this.shadowRoot.querySelector('#datasetModality')?.value || 'relational',
            description: this.shadowRoot.querySelector('#description')?.value.trim() || '',
            remark: this.shadowRoot.querySelector('#remark')?.value.trim() || ''
        };
        if (upstream) request.upstreamVersionIds = [Number(upstream)];
        if (type === 'SELECT' || type === 'SELECT_UDF') request.sqlSnippetId = Number(this.shadowRoot.querySelector('#sqlSnippet')?.value);
        if (type === 'SELECT_UDF') request.udfNames = this.selectedValues('#udfNames');
        if (type === 'TRANSFORM_SQL') {
            request.transformJobId = this.shadowRoot.querySelector('#transformJob')?.value;
            request.transformOutputPath = this.shadowRoot.querySelector('#transformOutputPath')?.value.trim() || '';
        }
        return request;
    }

    selectedValues(selector) {
        const el = this.shadowRoot.querySelector(selector);
        return el ? Array.from(el.selectedOptions).map(o => o.value) : [];
    }

    async submit() {
        if (!this.validateStep()) return;
        const button = this.shadowRoot.querySelector('#submitBtn');
        button.disabled = true;
        button.textContent = '创建中...';
        try {
            const type = this.selectedType();
            let result;
            if (type === 'SOURCE') {
                const sourceData = this.buildSourceRegisterData();
                result = await window.AppConfig.post('datasource', 'register', sourceData);
            } else {
                result = await window.AppConfig.post('dataset', 'create', this.buildRequest());
            }

            if (!(result.success || result.code === 200)) throw new Error(result.message || '创建失败');
            this.hide();
            this.dispatchEvent(new CustomEvent('dataset-saved', { bubbles:true, composed:true, detail:{ mode:'create', data:result } }));
        } catch (error) {
            this.fail(error.message || '创建失败');
        } finally {
            button.disabled = false;
            button.textContent = '完成并创建';
        }
    }

    fail(message) {
        const el = this.shadowRoot.querySelector('#errorBox');
        el.textContent = message;
        el.style.display = 'block';
        return false;
    }

    hideError() {
        this.shadowRoot.querySelector('#errorBox').style.display = 'none';
    }

    escape(value) {
        return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
}

customElements.define('dataset-dialog', DatasetDialog);
