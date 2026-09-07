/**
 * 完整复用原数据集弹窗的实现，迁移到 SQL 脚本（sqlSnippet）
 */
class SqlSnippetManagement extends HTMLElement {
    constructor() {
        super();
        this.snippets = [];
        this._searchTimer = null;
        this.mode = 'create'; // 'create' or 'edit'
        this.datasetData = null;
        this._isSubmitting = false; // 防止重复提交标志
        this.sqlList = []; // SQL列表
        this.debounceTimer = null; // 防抖定时器
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.initEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: none;
                    width: 100%;
                    height: 100%;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }

                :host([show]) {
                    display: block;
                }

                .main-container {
                    padding: 20px 32px 32px;
                    height: 100%;
                    overflow: auto;
                    box-sizing: border-box;
                }

                .db-table-card {
                    background: #ffffff;
                    border-radius: 8px;
                    border: 1px solid #e2e6ef;
                    padding: 20px 16px 16px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                }

                .table-toolbar {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 16px;
                    align-items: center;
                }

                .search-input {
                    flex: 1;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    padding: 8px 12px;
                    font-size: 13px;
                    color: #1f2329;
                    background: #ffffff;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .search-input:focus {
                    outline: none;
                    border-color: #4c89ff;
                    box-shadow: 0 0 0 2px rgba(76, 137, 255, 0.15);
                }

                .toolbar-btn {
                    padding: 6px 14px;
                    border: none;
                    border-radius: 4px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: white;
                }
                .toolbar-btn.green {
                    background: #10b981;
                }
                .toolbar-btn.green:hover { background: #059669; }
                .toolbar-btn.blue {
                    background: #4c89ff;
                }
                .toolbar-btn.blue:hover { background: #3d7bf7; }

                .table-wrapper {
                    overflow-x: auto;
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .data-table th, .data-table td {
                    padding: 10px 14px;
                    text-align: left;
                    border-bottom: 1px solid #edf0f5;
                }
                .data-table th {
                    background: #f8fafc;
                    font-weight: 600;
                    color: #374151;
                    white-space: nowrap;
                }
                .data-table tbody tr:hover {
                    background: #f8fafc;
                }

                /* 列表中的操作按钮 */
                .action-btn {
                    padding: 4px 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: #fff;
                    margin-right: 6px;
                }
                .action-btn.edit {
                    color: #4c89ff;
                    border-color: #4c89ff;
                }
                .action-btn.edit:hover {
                    background: #4c89ff;
                    color: white;
                }
                .action-btn.delete {
                    color: #ef4444;
                    border-color: #ef4444;
                }
                .action-btn.delete:hover {
                    background: #ef4444;
                    color: white;
                }

                /* 原数据集弹窗全部样式：100% 还原 */
                .modal-overlay {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.35);
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                }
                
                .modal-overlay.show {
                    display: flex;
                }
                
                .modal {
                    background: white;
                    border-radius: 8px;
                    width: 95%;
                    max-width: 800px;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid #e2e6ef;
                }
                
                .modal-title {
                    font-size: 14px;
                    font-weight: 500;
                    color: #1f2329;
                    margin: 0;
                }
                
                .modal-close {
                    border: none;
                    background: transparent;
                    font-size: 18px;
                    cursor: pointer;
                    color: #8c8c8c;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }
                
                .modal-close:hover {
                    background: #f5f5f5;
                    color: #595959;
                }
                
                .modal-body {
                    padding: 16px;
                }
                
                .modal-footer {
                    padding: 12px 16px 16px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }
                
                .modal-btn {
                    padding: 6px 14px;
                    border-radius: 4px;
                    border: 1px solid #e2e6ef;
                    background: white;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }
                
                .modal-btn:hover {
                    border-color: #4c89ff;
                    color: #4c89ff;
                }
                
                .modal-btn.primary {
                    background: #4c89ff;
                    color: #fff;
                    border-color: #4c89ff;
                }
                
                .modal-btn.primary:hover {
                    background: #3d7bf7;
                }
                
                /* 表单样式 - 复用 parsing-rules */
                .modal-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                
                .modal-form-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                
                .modal-label {
                    min-width: 80px;
                    color: #5f6b7a;
                    font-size: 12px;
                    padding-top: 8px;
                }
                
                .modal-input-wrapper {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .modal-input {
                    flex: 1;
                    border: 1px solid #e2e6ef;
                    border-radius: 4px;
                    padding: 8px 12px;
                    font-size: 13px;
                    background: #fafbff;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                
                .modal-input:focus {
                    border-color: #4c89ff;
                    outline: none;
                    background: white;
                }
                
                .modal-textarea {
                    flex: 1;
                    border: 1px solid #e2e6ef;
                    border-radius: 4px;
                    padding: 8px 12px;
                    font-size: 13px;
                    background: #fafbff;
                    resize: vertical;
                    min-height: 120px;
                    font-family: 'Consolas', 'Monaco', monospace;
                    box-sizing: border-box;
                    width: 100%;
                }
                
                .modal-textarea:focus {
                    border-color: #4c89ff;
                    outline: none;
                    background: white;
                }
                
                /* 测试按钮行 */
                .test-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .test-btn {
                    padding: 6px 14px;
                    border-radius: 4px;
                    border: 1px solid #52c41a;
                    background: #f6ffed;
                    color: #52c41a;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }
                
                .test-btn:hover {
                    background: #52c41a;
                    color: white;
                }
                
                .test-btn:disabled {
                    border-color: #d9d9d9;
                    background: #f5f5f5;
                    color: #bfbfbf;
                    cursor: not-allowed;
                }
                
                /* 结果显示区域 */
                .result-area {
                    margin-top: 8px;
                    padding: 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: 'Consolas', 'Monaco', monospace;
                    white-space: pre-wrap;
                    word-break: break-all;
                    max-height: 150px;
                    overflow-y: auto;
                }
                
                .result-placeholder {
                    color: #8c8c8c;
                    background: #fafafa;
                    border: 1px dashed #e8e8e8;
                }
                
                .result-success {
                    color: #52c41a;
                    background: #f6ffed;
                    border: 1px solid #b7eb8f;
                }
                
                .result-error {
                    color: #ff4d4f;
                    background: #fff2f0;
                    border: 1px solid #ffccc7;
                }
                
                .result-loading {
                    color: #1890ff;
                    background: #e6f7ff;
                    border: 1px solid #91d5ff;
                }
                
                /* SQL列表样式 */
                .sql-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .sql-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 12px;
                    background: #fafbff;
                    border: 1px solid #e2e6ef;
                    border-radius: 4px;
                }
                
                .sql-item-number {
                    min-width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #4c89ff;
                    color: white;
                    border-radius: 50%;
                    font-size: 12px;
                    font-weight: 500;
                    margin-top: 4px;
                }
                
                .sql-item-content {
                    flex: 1;
                }
                
                .sql-item-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .sql-action-btn {
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid #e2e6ef;
                    background: white;
                    cursor: pointer;
                    font-size: 11px;
                    color: #5f6b7a;
                    transition: all 0.2s;
                }
                
                .sql-action-btn:hover:not(:disabled) {
                    border-color: #4c89ff;
                    color: #4c89ff;
                }
                
                .sql-action-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                
                .sql-action-btn.delete {
                    color: #ff4d4f;
                    border-color: #ffccc7;
                }
                
                .sql-action-btn.delete:hover:not(:disabled) {
                    background: #ff4d4f;
                    color: white;
                    border-color: #ff4d4f;
                }
                
                .sql-action-btn.test {
                    color: #52c41a;
                    border-color: #b7eb8f;
                }
                
                .sql-action-btn.test:hover:not(:disabled) {
                    background: #52c41a;
                    color: white;
                    border-color: #52c41a;
                }
                
                .add-sql-btn {
                    padding: 8px;
                    border: 1px dashed #4c89ff;
                    border-radius: 4px;
                    background: #fafbff;
                    color: #4c89ff;
                    cursor: pointer;
                    font-size: 12px;
                    text-align: center;
                    transition: all 0.2s;
                }
                
                .add-sql-btn:hover {
                    background: #f0f5ff;
                    border-color: #3d7bf7;
                }

                .sql-button-group {
                    display: flex;
                    gap: 8px;
                }

                .upload-sql-btn {
                    padding: 8px 16px;
                    border: 1px dashed #52c41a;
                    border-radius: 4px;
                    background: #f6ffed;
                    color: #52c41a;
                    cursor: pointer;
                    font-size: 12px;
                    text-align: center;
                    transition: all 0.2s;
                    flex: 1;
                }

                .upload-sql-btn:hover {
                    background: #d9f7be;
                    border-color: #389e0d;
                }
            </style>

            <div class="main-container">
                <div class="db-table-card">
                    <div class="table-toolbar">
                        <input type="text" id="searchInput" class="search-input" placeholder="按名称搜索SQL脚本...">
                        <button class="toolbar-btn green" type="button" id="createBtn">新建SQL脚本</button>
                        <button class="toolbar-btn blue" type="button" id="refreshBtn">刷新</button>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>名称</th>
                                    <th>描述</th>
                                    <th>SQL数量</th>
                                    <th>创建者</th>
                                    <th>创建时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="tableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 原数据集弹窗 100% 结构移植 -->
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <div class="modal-header">
                        <h4 class="modal-title" id="dialogTitle">新建SQL脚本</h4>
                        <button class="modal-close" id="closeBtn">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <form class="modal-form" id="datasetForm">
                            <div class="modal-form-row">
                                <label class="modal-label">脚本名称 <span style="color: #ff4d4f;">*</span></label>
                                <div class="modal-input-wrapper">
                                    <input type="text" class="modal-input" id="datasetName" placeholder="请输入SQL脚本名称" maxlength="50" required>
                                </div>
                            </div>

                            <div class="modal-form-row">
                                <label class="modal-label">描述</label>
                                <div class="modal-input-wrapper">
                                    <input type="text" class="modal-input" id="datasetDesc" placeholder="请输入描述信息（可选）" maxlength="200">
                                </div>
                            </div>
                            
                            <div class="modal-form-row">
                                <label class="modal-label">SQL定义 <span style="color: #ff4d4f;">*</span></label>
                                <div class="modal-input-wrapper">
                                    <div class="sql-list" id="sqlList">
                                        <!-- SQL列表将通过JS动态生成 -->
                                    </div>
                                    <div class="sql-button-group">
                                        <button type="button" class="add-sql-btn" id="addSqlBtn" style="flex: 1;">+ 添加SQL查询语句</button>
                                        <button type="button" class="upload-sql-btn" id="uploadSqlBtn">📁 上传SQL文件</button>
                                        <input type="file" id="sqlFileInput" accept=".sql,.txt" style="display: none;">
                                    </div>
                                </div>
                            </div>

                            <div class="modal-form-row">
                                <label class="modal-label">执行结果</label>
                                <div class="modal-input-wrapper">
                                    <div class="result-area result-placeholder" id="resultArea">
                                        执行结果将显示在这里
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="modal-btn" id="cancelBtn">取消</button>
                        <button type="button" class="modal-btn primary" id="submitBtn">保存</button>
                    </div>
                </div>
            </div>
        `;
    }

    initEventListeners() {
        const createBtn = this.shadowRoot.querySelector('#createBtn');
        const refreshBtn = this.shadowRoot.querySelector('#refreshBtn');
        const searchInput = this.shadowRoot.querySelector('#searchInput');

        if (createBtn) createBtn.addEventListener('click', () => this.showModal('create'));
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadSnippets());
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => this.loadSnippets(e.target.value.trim()), 300);
            });
        }

        // 弹窗相关事件绑定（与原 dataset-dialog.js 保持一致）
        const closeBtn = this.shadowRoot.querySelector('#closeBtn');
        const cancelBtn = this.shadowRoot.querySelector('#cancelBtn');
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        const addSqlBtn = this.shadowRoot.querySelector('#addSqlBtn');
        const uploadSqlBtn = this.shadowRoot.querySelector('#uploadSqlBtn');
        const sqlFileInput = this.shadowRoot.querySelector('#sqlFileInput');
        const overlay = this.shadowRoot.querySelector('#modalOverlay');

        if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hide());
        if (submitBtn) submitBtn.addEventListener('click', () => this.handleSubmit());
        if (addSqlBtn) addSqlBtn.addEventListener('click', () => this.addSql());
        if (uploadSqlBtn) uploadSqlBtn.addEventListener('click', () => sqlFileInput.click());
        if (sqlFileInput) sqlFileInput.addEventListener('change', (e) => this.handleSqlFileUpload(e));

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.hide();
            });
        }
    }

    async show() {
        this.style.display = 'block';
        this.setAttribute('show', '');
        await this.loadSnippets();
    }

    hide() {
        this.style.display = 'none';
        this.removeAttribute('show');
        const overlay = this.shadowRoot.querySelector('#modalOverlay');
        if (overlay) overlay.classList.remove('show');
        this.datasetData = null;
    }

    async loadSnippets(name = '') {
        try {
            const params = {};
            if (name) params.name = name;
            const result = await window.AppConfig.get('sqlSnippet', 'list', params);
            if (result.code === 200 && result.data) {
                this.snippets = result.data;
            } else {
                this.showMessage(result.message || '加载SQL脚本列表失败', 'error');
                this.snippets = [];
            }
            this.renderTable();
        } catch (error) {
            console.error('加载SQL脚本列表失败:', error);
            this.showMessage('加载SQL脚本列表失败', 'error');
            this.snippets = [];
            this.renderTable();
        }
    }

    renderTable() {
        const tbody = this.shadowRoot.querySelector('#tableBody');
        if (!tbody) return;

        if (this.snippets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #9ca3af;">
                        暂无SQL脚本
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.snippets.map(snippet => {
            let sqlCount = 0;
            try {
                sqlCount = JSON.parse(snippet.sqlList || '[]').length;
            } catch (e) {
                sqlCount = 0;
            }
            return `
                <tr data-id="${snippet.id}">
                    <td><strong>${this.escapeHtml(snippet.name || '')}</strong></td>
                    <td>${this.escapeHtml(snippet.description || '-')}</td>
                    <td><span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 500;">${sqlCount} 条</span></td>
                    <td>${this.escapeHtml(snippet.operator || snippet.owner || '-')}</td>
                    <td>${this.formatTime(snippet.createTime)}</td>
                    <td>
                        <button class="action-btn edit" data-id="${snippet.id}">编辑</button>
                        <button class="action-btn delete" data-id="${snippet.id}">删除</button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.showModal('edit', id);
            });
        });

        tbody.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.deleteSnippet(id);
            });
        });
    }

    async showModal(mode = 'create', id = null) {
        this.mode = mode;
        const dialogTitle = this.shadowRoot.querySelector('#dialogTitle');
        const datasetName = this.shadowRoot.querySelector('#datasetName');
        const datasetDesc = this.shadowRoot.querySelector('#datasetDesc');
        const overlay = this.shadowRoot.querySelector('#modalOverlay');

        this.clearResult();

        if (mode === 'create') {
            dialogTitle.textContent = '新建SQL脚本';
            datasetName.value = '';
            datasetName.readOnly = false;
            datasetDesc.value = '';
            this.datasetData = null;
            this.sqlList = [''];
            this.renderSqlList();
        } else {
            dialogTitle.textContent = '编辑SQL脚本';
            datasetName.readOnly = true;
            try {
                const result = await window.AppConfig.get('sqlSnippet', 'metas', { id });
                if (result.code === 200 && result.data) {
                    const snippet = result.data;
                    this.datasetData = snippet;
                    datasetName.value = snippet.name || '';
                    datasetDesc.value = snippet.description || '';
                    try {
                        this.sqlList = JSON.parse(snippet.sqlList || '[]');
                    } catch (e) {
                        this.sqlList = [];
                    }
                    if (this.sqlList.length === 0) this.sqlList = [''];
                    this.renderSqlList();
                } else {
                    this.showMessage(result.message || '获取详情失败', 'error');
                    return;
                }
            } catch (err) {
                this.showMessage('获取详情失败: ' + err.message, 'error');
                return;
            }
        }

        overlay.classList.add('show');
    }

    clearResult() {
        const resultArea = this.shadowRoot.querySelector('#resultArea');
        if (resultArea) {
            resultArea.className = 'result-area result-placeholder';
            resultArea.textContent = '执行结果将显示在这里';
        }
    }

    showResult(content, type = 'success') {
        const resultArea = this.shadowRoot.querySelector('#resultArea');
        if (!resultArea) return;
        const className = type === 'success' ? 'result-success' : 
                         type === 'error' ? 'result-error' : 
                         type === 'loading' ? 'result-loading' : 'result-placeholder';
        resultArea.className = `result-area ${className}`;
        resultArea.textContent = content;
    }

    renderSqlList() {
        const sqlListContainer = this.shadowRoot.querySelector('#sqlList');
        sqlListContainer.innerHTML = '';
        
        this.sqlList.forEach((sql, index) => {
            const sqlItem = document.createElement('div');
            sqlItem.className = 'sql-item';
            sqlItem.innerHTML = `
                <div class="sql-item-number">${index + 1}</div>
                <div class="sql-item-content">
                    <textarea class="modal-textarea sql-textarea" data-index="${index}" placeholder="请输入SQL查询语句" rows="1">${sql}</textarea>
                </div>
                <div class="sql-item-actions">
                    <button type="button" class="sql-action-btn" data-action="up" data-index="${index}" title="上移" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button type="button" class="sql-action-btn" data-action="down" data-index="${index}" title="下移" ${index === this.sqlList.length - 1 ? 'disabled' : ''}>↓</button>
                    <button type="button" class="sql-action-btn delete" data-action="delete" data-index="${index}" title="删除" ${this.sqlList.length === 1 ? 'disabled' : ''}>×</button>
                    <button type="button" class="sql-action-btn test" data-action="test" data-index="${index}" title="测试">测试</button>
                </div>
            `;
            sqlListContainer.appendChild(sqlItem);
        });
        
        this.bindSqlListEvents();
    }

    bindSqlListEvents() {
        const sqlListContainer = this.shadowRoot.querySelector('#sqlList');
        
        sqlListContainer.querySelectorAll('[data-action="up"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.moveSqlUp(index);
            });
        });
        
        sqlListContainer.querySelectorAll('[data-action="down"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.moveSqlDown(index);
            });
        });
        
        sqlListContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.deleteSql(index);
            });
        });
        
        sqlListContainer.querySelectorAll('[data-action="test"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.handleTest(index);
            });
        });
    }

    addSql() {
        this.updateSqlListFromDOM();
        this.sqlList.push('');
        this.renderSqlList();
    }

    deleteSql(index) {
        this.updateSqlListFromDOM();
        if (this.sqlList.length > 1) {
            this.sqlList.splice(index, 1);
            this.renderSqlList();
        } else {
            this.sqlList[0] = '';
            this.renderSqlList();
        }
    }

    moveSqlUp(index) {
        if (index <= 0) return;
        this.updateSqlListFromDOM();
        [this.sqlList[index - 1], this.sqlList[index]] = [this.sqlList[index], this.sqlList[index - 1]];
        this.renderSqlList();
    }

    moveSqlDown(index) {
        if (index >= this.sqlList.length - 1) return;
        this.updateSqlListFromDOM();
        [this.sqlList[index], this.sqlList[index + 1]] = [this.sqlList[index + 1], this.sqlList[index]];
        this.renderSqlList();
    }

    updateSqlListFromDOM() {
        const sqlTextareas = this.shadowRoot.querySelectorAll('.sql-textarea');
        this.sqlList = Array.from(sqlTextareas).map(textarea => textarea.value);
    }

    handleSqlFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.parseAndFillSql(content);
            event.target.value = '';
        };
        reader.onerror = () => {
            this.showResult('文件读取失败', 'error');
        };
        reader.readAsText(file);
    }

    parseAndFillSql(content) {
        const sqlStatements = content
            .split(';')
            .map(sql => sql.trim())
            .filter(sql => sql.length > 0)
            .map(sql => sql + ';');

        if (sqlStatements.length === 0) {
            this.showResult('未找到有效的SQL语句', 'error');
            return;
        }

        this.updateSqlListFromDOM();
        
        if (this.sqlList.length === 0 || (this.sqlList.length === 1 && !this.sqlList[0].trim())) {
            this.sqlList = sqlStatements;
        } else {
            this.sqlList = [...this.sqlList, ...sqlStatements];
        }

        this.renderSqlList();
        this.showResult(`成功加载 ${sqlStatements.length} 条SQL语句`, 'success');
    }

    async handleTest(index) {
        this.updateSqlListFromDOM();
        const sqlToTest = this.sqlList[index];
        
        if (!sqlToTest || !sqlToTest.trim()) {
            this.showResult('请输入要测试的SQL查询语句', 'error');
            return;
        }
        
        const testBtn = this.shadowRoot.querySelector(`[data-action="test"][data-index="${index}"]`);
        testBtn.disabled = true;
        testBtn.textContent = '测试中...';
        this.showResult('正在执行SQL测试...', 'loading');
        
        try {
            const url = window.AppConfig.getApiUrl('dataset', 'testsql');
            const queryString = new URLSearchParams({ sql: sqlToTest.trim() }).toString();
            const fullUrl = url + (url.includes('?') ? '&' : '?') + queryString;
            
            const result = await window.AppConfig.request(fullUrl, {
                method: 'POST'
            });
            
            if (result.success) {
                this.showResult(JSON.stringify(result.data, null, 2), 'success');
            } else {
                this.showResult(`测试失败: ${result.message || 'SQL执行失败'}`, 'error');
            }
            
        } catch (error) {
            console.error('SQL测试失败:', error);
            this.showResult(`测试失败: ${error.message}`, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = '测试';
        }
    }

    async handleSubmit() {
        const name = this.shadowRoot.querySelector('#datasetName').value.trim();
        const description = this.shadowRoot.querySelector('#datasetDesc').value.trim();

        this.updateSqlListFromDOM();
        
        if (!name) {
            this.showResult('请输入SQL脚本名称', 'error');
            return;
        }

        if (name.length > 50) {
            this.showResult('SQL脚本名称长度不能超过50个字符', 'error');
            return;
        }

        const validSqlList = this.sqlList
            .filter(sql => sql && sql.trim())
            .map(sql => {
                let cleanedSql = sql.trim();
                cleanedSql = cleanedSql.replace(/\\s+/g, ' ');
                return cleanedSql;
            });

        if (validSqlList.length === 0) {
            this.showResult('请输入至少一条SQL查询语句', 'error');
            return;
        }

        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '保存中...';
        this.showResult('正在保存SQL脚本...', 'loading');

        const request = {
            name,
            description,
            sqlList: validSqlList
        };
        if (this.datasetData && this.datasetData.id) {
            request.id = this.datasetData.id;
        }

        try {
            const result = await window.AppConfig.post('sqlSnippet', 'save', request);
            if (result.code === 200 || result.success) {
                this.showMessage(this.mode === 'create' ? 'SQL脚本创建成功!' : 'SQL脚本保存成功!', 'success');
                this.hide();
                await this.loadSnippets();
            } else {
                this.showResult(result.message || '保存失败', 'error');
            }
        } catch (error) {
            console.error('保存SQL脚本失败:', error);
            this.showResult('保存失败: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '保存';
        }
    }

    async deleteSnippet(id) {
        const snippet = this.snippets.find(s => s.id === id);
        if (!snippet) return;

        if (!window.confirm(`确定要删除SQL脚本「${snippet.name}」吗？`)) return;

        try {
            const result = await window.AppConfig.delete('sqlSnippet', 'delete', { id });
            if (result.code === 200 || result.success) {
                this.showMessage('删除成功', 'success');
                await this.loadSnippets();
            } else {
                this.showMessage(result.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除SQL脚本失败:', error);
            this.showMessage('删除失败: ' + error.message, 'error');
        }
    }

    showMessage(message, type = 'success') {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }

    formatTime(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

customElements.define('sql-snippet-management', SqlSnippetManagement);
