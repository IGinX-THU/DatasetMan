/**
 * 知识图谱管理
 * 复用SQL脚本管理的页面样式与CRUD接口模式：
 * - 列表：服务端分页（query + count），图谱名称/描述/节点与关系路径/数量/操作人/上传时间
 * - 上传弹窗：填写图谱名称等信息，选择节点/关系数据文件上传，
 *   入库到 knowledge_graphs.<图谱名称>.nodes / knowledge_graphs.<图谱名称>.edges
 * - 名称存在检测：输入图谱名称时实时校验是否已存在
 * - 详情：跳转独立页面，G6增量渲染可视化知识图谱
 */
class KnowledgeGraphManagement extends HTMLElement {
    constructor() {
        super();
        this.graphs = [];
        this.totalCount = 0;
        this.currentFilter = ''; // 当前查询条件，翻页时复用
        this._searchTimer = null;
        this._nameCheckTimer = null;
        this.nameExists = false; // 图谱名称是否已存在
        this._isSubmitting = false; // 防止重复提交标志
        this.currentPage = 1;
        this.pageSize = 10;
        this.pendingNodesFile = null;
        this.pendingEdgesFile = null;
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.initEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./components/common-pagination/common-pagination.css">
            <link rel="stylesheet" href="./css/variables.css">
            <link rel="stylesheet" href="./css/base-components.css">
            <link rel="stylesheet" href="./css/workbench-crud-panel.css">
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

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                .data-table th {
                    background: #f8fafc;
                    padding: 12px 16px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    border-bottom: 1px solid #edf0f5;
                    white-space: nowrap;
                }
                .data-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #f3f4f6;
                    color: #2b2f36;
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
                .action-btn.detail {
                    color: #0ea5e9;
                    border-color: #0ea5e9;
                }
                .action-btn.detail:hover {
                    background: #0ea5e9;
                    color: white;
                }

                /* 存储路径列：超长省略显示，悬停看全称 */
                .path-cell {
                    max-width: 260px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-family: 'Consolas', 'Monaco', monospace;
                    color: #475569;
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

                .modal-btn.primary:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
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

                .modal-input.name-conflict {
                    border-color: #ff4d4f;
                    background: #fff2f0;
                }

                /* 名称存在检测提示 */
                .name-check-hint {
                    font-size: 11px;
                    line-height: 1.5;
                    display: none;
                }

                .name-check-hint.ok {
                    display: block;
                    color: #52c41a;
                }

                .name-check-hint.conflict {
                    display: block;
                    color: #ff4d4f;
                }

                .name-check-hint.checking {
                    display: block;
                    color: #1890ff;
                }

                /* 数据文件选择按钮组 */
                .file-button-group {
                    display: flex;
                    gap: 8px;
                }

                .upload-file-btn {
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

                .upload-file-btn:hover {
                    background: #d9f7be;
                    border-color: #389e0d;
                }

                .upload-file-btn.selected {
                    border-style: solid;
                    background: #f0f9ff;
                    border-color: #0ea5e9;
                    color: #0284c7;
                }

                .file-hint {
                    font-size: 11px;
                    color: #8c8c8c;
                    line-height: 1.6;
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
            </style>

            <div class="main-container">
                <div class="parsing-filter-card">
                    <div class="filter-header">筛选</div>
                    <div class="filter-rows">
                        <div class="filter-row">
                            <div class="filter-field">
                                <span class="filter-label">图谱名称</span>
                                <input class="filter-input" id="searchInput" type="text" placeholder="请输入图谱名称" />
                            </div>
                        </div>
                    </div>
                    <div class="filter-actions">
                        <div class="filter-spacer"></div>
                        <button class="filter-btn outline" type="button" id="resetFilters">重置</button>
                        <button class="filter-btn solid" type="button" id="applyFilters">查询</button>
                    </div>
                </div>

                <div class="parsing-table-card">
                    <div class="table-toolbar">
                        <button class="toolbar-btn green" type="button" id="createBtn">上传知识图谱</button>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>图谱名称</th>
                                    <th>描述</th>
                                    <th>节点存储路径</th>
                                    <th>关系存储路径</th>
                                    <th>操作人</th>
                                    <th>上传时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="tableBody"></tbody>
                        </table>
                    </div>
                    <common-pagination id="pagination"></common-pagination>
                </div>
            </div>

            <!-- 上传弹窗 结构复用 -->
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <div class="modal-header">
                        <h4 class="modal-title" id="dialogTitle">上传知识图谱</h4>
                        <button class="modal-close" id="closeBtn">&times;</button>
                    </div>

                    <div class="modal-body">
                        <form class="modal-form" id="graphForm">
                            <div class="modal-form-row">
                                <label class="modal-label">图谱名称 <span style="color: #ff4d4f;">*</span></label>
                                <div class="modal-input-wrapper">
                                    <input type="text" class="modal-input" id="graphName" placeholder="请输入图谱名称" maxlength="50" required>
                                    <div class="name-check-hint" id="nameCheckHint"></div>
                                </div>
                            </div>

                            <div class="modal-form-row">
                                <label class="modal-label">描述</label>
                                <div class="modal-input-wrapper">
                                    <input type="text" class="modal-input" id="graphDesc" placeholder="请输入描述信息（可选）" maxlength="200">
                                </div>
                            </div>

                            <div class="modal-form-row">
                                <label class="modal-label">节点数据 <span style="color: #ff4d4f;">*</span></label>
                                <div class="modal-input-wrapper">
                                    <div class="file-button-group">
                                        <button type="button" class="upload-file-btn" id="uploadNodesBtn">📁 选择节点数据文件</button>
                                        <input type="file" id="nodesFileInput" accept=".csv" style="display: none;">
                                    </div>
                                    <div class="file-hint">仅支持 .csv 文件，文件名不限；节点数据需含节点id列（如 :ID / id），其余列作为节点属性，可含 :LABEL 列作为节点标签</div>
                                </div>
                            </div>

                            <div class="modal-form-row">
                                <label class="modal-label">关系数据 <span style="color: #ff4d4f;">*</span></label>
                                <div class="modal-input-wrapper">
                                    <div class="file-button-group">
                                        <button type="button" class="upload-file-btn" id="uploadEdgesBtn">📁 选择关系数据文件</button>
                                        <input type="file" id="edgesFileInput" accept=".csv" style="display: none;">
                                    </div>
                                    <div class="file-hint">仅支持 .csv 文件，文件名不限；关系数据需含起点/终点列（如 :START_ID / :END_ID），可含 :TYPE 列作为关系类型，其余列作为关系属性</div>
                                </div>
                            </div>

                            <div class="modal-form-row">
                                <label class="modal-label">上传结果</label>
                                <div class="modal-input-wrapper">
                                    <div class="result-area result-placeholder" id="resultArea">
                                        上传结果将显示在这里
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="modal-btn" id="cancelBtn">取消</button>
                        <button type="button" class="modal-btn primary" id="submitBtn">上传</button>
                    </div>
                </div>
            </div>
        `;
    }

    initEventListeners() {
        const createBtn = this.shadowRoot.querySelector('#createBtn');
        const searchInput = this.shadowRoot.querySelector('#searchInput');
        const resetBtn = this.shadowRoot.querySelector('#resetFilters');
        const applyBtn = this.shadowRoot.querySelector('#applyFilters');

        if (createBtn) createBtn.addEventListener('click', () => this.showModal());
        // 查询/重置/输入都回到第一页并重新拉取count
        if (applyBtn) applyBtn.addEventListener('click', () => {
            this.currentPage = 1;
            this.loadGraphs(searchInput?.value.trim() || '');
        });
        if (resetBtn) resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            this.currentPage = 1;
            this.loadGraphs('');
        });
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => {
                    this.currentPage = 1;
                    this.loadGraphs(e.target.value.trim());
                }, 300);
            });
        }

        this.initPagination();

        // 弹窗相关事件绑定
        const closeBtn = this.shadowRoot.querySelector('#closeBtn');
        const cancelBtn = this.shadowRoot.querySelector('#cancelBtn');
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        const uploadNodesBtn = this.shadowRoot.querySelector('#uploadNodesBtn');
        const uploadEdgesBtn = this.shadowRoot.querySelector('#uploadEdgesBtn');
        const nodesFileInput = this.shadowRoot.querySelector('#nodesFileInput');
        const edgesFileInput = this.shadowRoot.querySelector('#edgesFileInput');
        const graphNameInput = this.shadowRoot.querySelector('#graphName');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
        if (submitBtn) submitBtn.addEventListener('click', () => this.handleSubmit());
        if (uploadNodesBtn) uploadNodesBtn.addEventListener('click', () => nodesFileInput.click());
        if (uploadEdgesBtn) uploadEdgesBtn.addEventListener('click', () => edgesFileInput.click());
        if (nodesFileInput) nodesFileInput.addEventListener('change', (e) => this.handleFileSelect(e, 'nodes'));
        if (edgesFileInput) edgesFileInput.addEventListener('change', (e) => this.handleFileSelect(e, 'edges'));
        // 图谱名称输入时实时存在检测（防抖）
        if (graphNameInput) {
            graphNameInput.addEventListener('input', (e) => {
                clearTimeout(this._nameCheckTimer);
                this._nameCheckTimer = setTimeout(() => this.checkNameExists(e.target.value.trim()), 400);
            });
        }

        // 点击遮罩不关闭弹窗，避免误触丢失已填写内容；仅通过关闭/取消按钮关闭
    }

    async show() {
        this.style.display = 'block';
        this.setAttribute('show', '');
        this.currentPage = 1;
        await this.loadGraphs(this.currentFilter);
    }

    hide() {
        this.style.display = 'none';
        this.removeAttribute('show');
        this.closeModal();
    }

    closeModal() {
        const overlay = this.shadowRoot.querySelector('#modalOverlay');
        if (overlay) overlay.classList.remove('show');
        this.pendingNodesFile = null;
        this.pendingEdgesFile = null;
    }

    /**
     * 服务端分页查询：query拉取当前页，count在第一页时刷新总数
     */
    async loadGraphs(name = '') {
        this.currentFilter = name || '';
        try {
            const result = await window.AppConfig.post('knowledgeGraph', 'query', {
                pageNum: this.currentPage,
                pageSize: this.pageSize,
                name: this.currentFilter || null
            });
            if (result.code === 200 && result.data) {
                this.graphs = result.data;
            } else {
                this.showMessage(result.message || '加载知识图谱列表失败', 'error');
                this.graphs = [];
            }
            if (this.currentPage === 1) {
                await this.loadGraphCount(this.currentFilter);
            }
            this.renderTable();
        } catch (error) {
            console.error('加载知识图谱列表失败:', error);
            this.showMessage('加载知识图谱列表失败', 'error');
            this.graphs = [];
            this.renderTable();
        }
    }

    async loadGraphCount(name) {
        try {
            const result = await window.AppConfig.post('knowledgeGraph', 'count', { name: name || null });
            if (result.code === 200 && result.data !== undefined && result.data !== null) {
                this.totalCount = Number(result.data) || 0;
            } else {
                this.totalCount = this.graphs.length;
            }
        } catch (error) {
            console.error('获取知识图谱总数失败:', error);
            this.totalCount = this.graphs.length;
        }
    }

    renderTable() {
        const tbody = this.shadowRoot.querySelector('#tableBody');
        if (!tbody) return;

        this.updatePagination();

        if (this.graphs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #9ca3af;">
                        暂无知识图谱
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.graphs.map(graph => {
            const id = graph.id || graph.createTime;
            return `
                <tr data-id="${id}">
                    <td><strong>${this.escapeHtml(graph.name || '')}</strong></td>
                    <td title="${this.escapeHtml(graph.description || '')}">${this.escapeHtml(graph.description || '-')}</td>
                    <td class="path-cell" title="${this.escapeHtml(graph.nodePath || '')}">${this.escapeHtml(graph.nodePath || '-')}</td>
                    <td class="path-cell" title="${this.escapeHtml(graph.edgePath || '')}">${this.escapeHtml(graph.edgePath || '-')}</td>
                    <td>${this.escapeHtml(graph.operator || graph.owner || '-')}</td>
                    <td>${this.formatTime(graph.createTime)}</td>
                    <td>
                        <button class="action-btn detail" data-id="${id}" data-name="${this.escapeHtml(graph.name || '')}">详情</button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.action-btn.detail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.dataset.name;
                this.openDetailPage(name);
            });
        });
    }

    openDetailPage(name) {
        if (!name) return;
        window.open('/knowledge-graph-detail.html?name=' + encodeURIComponent(name), '_blank');
    }

    initPagination() {
        const pagination = this.shadowRoot.querySelector('#pagination');
        if (pagination) {
            pagination.addEventListener('pagination-change', (e) => {
                this.currentPage = e.detail.currentPage;
                this.pageSize = e.detail.pageSize;
                // 服务端分页：翻页重新查询
                this.loadGraphs(this.currentFilter);
            });
        }
    }

    updatePagination() {
        const pagination = this.shadowRoot.querySelector('#pagination');
        if (pagination && typeof pagination.setPagination === 'function') {
            pagination.setPagination(this.currentPage, this.pageSize, this.totalCount);
        }
    }

    showModal() {
        const overlay = this.shadowRoot.querySelector('#modalOverlay');
        const graphName = this.shadowRoot.querySelector('#graphName');

        this.clearResult();
        graphName.value = '';
        this.shadowRoot.querySelector('#graphDesc').value = '';
        this.pendingNodesFile = null;
        this.pendingEdgesFile = null;
        this.nameExists = false;
        this.updateNameHint('');
        this.updateFileBtnText();

        overlay.classList.add('show');
    }

    /**
     * 图谱名称存在检测：输入防抖调用validate-name
     */
    async checkNameExists(name) {
        const hint = this.shadowRoot.querySelector('#nameCheckHint');
        const nameInput = this.shadowRoot.querySelector('#graphName');
        if (!hint || !nameInput) return;

        if (!name) {
            this.nameExists = false;
            this.updateNameHint('');
            return;
        }

        this.updateNameHint('checking', '正在检测名称...');
        try {
            const result = await window.AppConfig.get('knowledgeGraph', 'validate-name', { name });
            // 输入已变化时丢弃过期结果
            if (nameInput.value.trim() !== name) return;
            if (result.code === 200 && result.data !== undefined && result.data !== null) {
                this.nameExists = !!result.data;
                this.updateNameHint(this.nameExists ? 'conflict' : 'ok',
                    this.nameExists ? `图谱名称「${name}」已存在，请更换名称` : `图谱名称「${name}」可用`);
            } else {
                this.nameExists = false;
                this.updateNameHint('');
            }
        } catch (error) {
            console.error('检测图谱名称失败:', error);
            this.nameExists = false;
            this.updateNameHint('');
        }
    }

    updateNameHint(state, text) {
        const hint = this.shadowRoot.querySelector('#nameCheckHint');
        const nameInput = this.shadowRoot.querySelector('#graphName');
        if (hint) {
            hint.className = 'name-check-hint' + (state ? ' ' + state : '');
            hint.textContent = text || '';
        }
        if (nameInput) {
            nameInput.classList.toggle('name-conflict', state === 'conflict');
        }
    }

    updateFileBtnText() {
        const nodesBtn = this.shadowRoot.querySelector('#uploadNodesBtn');
        const edgesBtn = this.shadowRoot.querySelector('#uploadEdgesBtn');
        if (nodesBtn) {
            const has = !!this.pendingNodesFile;
            nodesBtn.textContent = has
                ? `✓ ${this.pendingNodesFile.name}（${this.formatSize(this.pendingNodesFile.size)}）`
                : '📁 选择节点数据文件';
            nodesBtn.classList.toggle('selected', has);
        }
        if (edgesBtn) {
            const has = !!this.pendingEdgesFile;
            edgesBtn.textContent = has
                ? `✓ ${this.pendingEdgesFile.name}（${this.formatSize(this.pendingEdgesFile.size)}）`
                : '📁 选择关系数据文件';
            edgesBtn.classList.toggle('selected', has);
        }
    }

    handleFileSelect(event, type) {
        const input = event && event.target ? event.target : null;
        const file = input && input.files ? input.files[0] : null;
        if (!file) return;
        // 文件名不限，仅要求 .csv 扩展名
        if (!/\.csv$/i.test(file.name)) {
            this.showMessage('仅支持 .csv 文件', 'error');
            input.value = '';
            return;
        }
        if (type === 'nodes') {
            this.pendingNodesFile = file;
        } else {
            this.pendingEdgesFile = file;
        }
        this.updateFileBtnText();
        this.showResult(`已选择${type === 'nodes' ? '节点' : '关系'}数据文件: ${file.name}，点击"上传"开始入库`, 'loading');
        input.value = '';
    }

    clearResult() {
        const resultArea = this.shadowRoot.querySelector('#resultArea');
        if (resultArea) {
            resultArea.className = 'result-area result-placeholder';
            resultArea.textContent = '上传结果将显示在这里';
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

    async handleSubmit() {
        const name = this.shadowRoot.querySelector('#graphName').value.trim();
        const description = this.shadowRoot.querySelector('#graphDesc').value.trim();

        if (!name) {
            this.showResult('请输入图谱名称', 'error');
            return;
        }
        if (this.nameExists) {
            this.showResult(`图谱名称「${name}」已存在，请更换名称`, 'error');
            return;
        }
        if (!this.pendingNodesFile) {
            this.showResult('请选择节点数据文件', 'error');
            return;
        }
        if (!this.pendingEdgesFile) {
            this.showResult('请选择关系数据文件', 'error');
            return;
        }
        if (this._isSubmitting) return;
        this._isSubmitting = true;

        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '上传中...';
        this.showResult(`正在上传知识图谱「${name}」并入库到 knowledge_graphs.${name}.nodes / knowledge_graphs.${name}.edges ...`, 'loading');

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('nodesFile', this.pendingNodesFile);
        formData.append('edgesFile', this.pendingEdgesFile);

        try {
            const result = await window.AppConfig.upload('knowledgeGraph', 'upload', formData);
            if (result.code === 200 || result.success) {
                const graph = result.data || {};
                this.showResult(`知识图谱「${name}」上传成功！已入库节点 ${this.formatCount(graph.nodeCount)} 个、关系 ${this.formatCount(graph.edgeCount)} 条`, 'success');
                this.showMessage('知识图谱上传成功!', 'success');
                this.closeModal();
                const searchInput = this.shadowRoot.querySelector('#searchInput');
                if (searchInput) searchInput.value = '';
                this.currentPage = 1;
                await this.loadGraphs('');
            } else {
                this.showResult(result.message || '上传失败', 'error');
            }
        } catch (error) {
            console.error('上传知识图谱失败:', error);
            this.showResult('上传失败: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '上传';
            this._isSubmitting = false;
        }
    }

    showMessage(message, type = 'success') {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }

    formatCount(count) {
        if (count === null || count === undefined) return '0';
        return Number(count).toLocaleString('zh-CN');
    }

    formatSize(bytes) {
        if (!bytes && bytes !== 0) return '';
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / 1024 / 1024).toFixed(1) + 'MB';
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

customElements.define('knowledge-graph-management', KnowledgeGraphManagement);
