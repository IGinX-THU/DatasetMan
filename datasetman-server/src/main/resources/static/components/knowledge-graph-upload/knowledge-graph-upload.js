/**
 * 知识图谱上传组件（弹窗形式，参考模型/算法上传的交互）
 * - 弹窗展示，不占用工作区
 * - 节点/关系文件支持点击选择或拖拽上传（.csv，文件名不限）
 * - 图谱名称实时存在检测
 * - 对齐创建数据集的导入模式：文件读取为Base64后随JSON提交
 * - 上传成功后派发 knowledge-graph-uploaded 事件（main.js刷新右侧知识图谱面板）
 */
class KnowledgeGraphUpload extends HTMLElement {
    constructor() {
        super();
        this.nameExists = false;
        this._isSubmitting = false;
        this._nameCheckTimer = null;
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
            <style>
                :host {
                    display: none;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }

                /* 弹窗遮罩 */
                .modal-overlay {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.35);
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                }

                :host([show]) .modal-overlay {
                    display: flex;
                }

                .modal {
                    background: white;
                    border-radius: 8px;
                    width: 95%;
                    max-width: 640px;
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
                    gap: 6px;
                }

                .modal-input {
                    width: 100%;
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

                .name-check-hint {
                    font-size: 11px;
                    line-height: 1.5;
                    display: none;
                }

                .name-check-hint.ok { display: block; color: #52c41a; }
                .name-check-hint.conflict { display: block; color: #ff4d4f; }
                .name-check-hint.checking { display: block; color: #1890ff; }

                /* 拖拽上传区域（参考模型上传的file-upload-area） */
                .file-upload-area {
                    border: 2px dashed #d1d5db;
                    border-radius: 6px;
                    padding: 14px 16px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: #fafbff;
                }

                .file-upload-area:hover,
                .file-upload-area.dragover {
                    border-color: #4c89ff;
                    background: #f0f5ff;
                }

                .upload-icon {
                    font-size: 22px;
                    line-height: 1;
                    margin-bottom: 4px;
                }

                .upload-text {
                    font-size: 12px;
                    color: #5f6b7a;
                }

                .upload-text em {
                    color: #4c89ff;
                    font-style: normal;
                }

                .file-hint {
                    font-size: 11px;
                    color: #8c8c8c;
                    line-height: 1.6;
                    text-align: left;
                }

                /* 已选文件行 */
                .file-chip {
                    display: none;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #0284c7;
                }

                .file-chip.visible {
                    display: flex;
                }

                .file-chip .file-chip-name {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .file-chip .file-chip-remove {
                    border: none;
                    background: transparent;
                    color: #ef4444;
                    cursor: pointer;
                    font-size: 14px;
                    line-height: 1;
                    padding: 0 2px;
                }
            </style>

            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <div class="modal-header">
                        <h4 class="modal-title">构建知识图谱</h4>
                        <button class="modal-close" id="closeBtn">&times;</button>
                    </div>

                    <div class="modal-body">
                        <form class="modal-form" id="graphForm">
                            <div class="modal-form-row">
                                <label class="modal-label">图谱名称 <span style="color: #ff4d4f;">*</span></label>
                                <div class="modal-input-wrapper">
                                    <input type="text" class="modal-input" id="graphName" placeholder="请输入图谱名称" maxlength="50">
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
                                    <div class="file-upload-area" id="nodesDropArea">
                                        <div class="upload-icon" id="nodesUploadIcon">📄</div>
                                        <div class="upload-text" id="nodesUploadText">点击选择或<em>拖拽</em>.csv文件到此处</div>
                                    </div>
                                    <input type="file" id="nodesFileInput" accept=".csv" style="display: none;">
                                    <div class="file-chip" id="nodesFileChip">
                                        <span class="file-chip-name" id="nodesFileName"></span>
                                        <button type="button" class="file-chip-remove" id="nodesFileRemove" title="移除文件">&times;</button>
                                    </div>
                                    <div class="file-hint">仅支持 .csv 文件，文件名不限；需含节点id列（如 :ID / id），可含 :LABEL 列作为节点标签，其余列作为节点属性</div>
                                </div>
                            </div>

                            <div class="modal-form-row">
                                <label class="modal-label">关系数据 <span style="color: #ff4d4f;">*</span></label>
                                <div class="modal-input-wrapper">
                                    <div class="file-upload-area" id="edgesDropArea">
                                        <div class="upload-icon" id="edgesUploadIcon">🔗</div>
                                        <div class="upload-text" id="edgesUploadText">点击选择或<em>拖拽</em>.csv文件到此处</div>
                                    </div>
                                    <input type="file" id="edgesFileInput" accept=".csv" style="display: none;">
                                    <div class="file-chip" id="edgesFileChip">
                                        <span class="file-chip-name" id="edgesFileName"></span>
                                        <button type="button" class="file-chip-remove" id="edgesFileRemove" title="移除文件">&times;</button>
                                    </div>
                                    <div class="file-hint">仅支持 .csv 文件，文件名不限；需含起点/终点列（如 :START_ID / :END_ID），可含 :TYPE 列作为关系类型，其余列作为关系属性</div>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="modal-btn" id="cancelBtn">取消</button>
                        <button type="button" class="modal-btn primary" id="submitBtn">构建</button>
                    </div>
                </div>
            </div>
        `;
    }

    initEventListeners() {
        const $ = (id) => this.shadowRoot.querySelector(id);
        const closeBtn = $('#closeBtn');
        const cancelBtn = $('#cancelBtn');
        const submitBtn = $('#submitBtn');
        const graphNameInput = $('#graphName');

        if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hide());
        if (submitBtn) submitBtn.addEventListener('click', () => this.handleSubmit());
        // 点击遮罩不关闭弹窗，避免误触丢失已填写内容

        // 名称输入实时存在检测（防抖）
        if (graphNameInput) {
            graphNameInput.addEventListener('input', (e) => {
                clearTimeout(this._nameCheckTimer);
                this._nameCheckTimer = setTimeout(() => this.checkNameExists(e.target.value.trim()), 400);
            });
        }

        // 节点文件：点击选择 + 拖拽上传
        this.bindDropArea('#nodesDropArea', '#nodesFileInput', 'nodes');
        this.bindDropArea('#edgesDropArea', '#edgesFileInput', 'edges');

        // 已选文件的移除按钮
        $('#nodesFileRemove')?.addEventListener('click', () => this.removeFile('nodes'));
        $('#edgesFileRemove')?.addEventListener('click', () => this.removeFile('edges'));
    }

    /**
     * 绑定拖拽上传区域：点击打开文件选择，dragover/dragleave高亮，drop取文件
     */
    bindDropArea(areaSelector, inputSelector, type) {
        const area = this.shadowRoot.querySelector(areaSelector);
        const input = this.shadowRoot.querySelector(inputSelector);
        if (!area || !input) return;

        area.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this.handleFileSelect(file, type);
            input.value = '';
        });

        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });
        area.addEventListener('dragleave', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
        });
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0], type);
            }
        });
    }

    show() {
        this.resetForm();
        this.style.display = 'block';
        this.setAttribute('show', '');
    }

    hide() {
        this.style.display = 'none';
        this.removeAttribute('show');
    }

    resetForm() {
        const $ = (id) => this.shadowRoot.querySelector('#' + id);
        const nameInput = $('graphName');
        if (nameInput) nameInput.value = '';
        const descInput = $('graphDesc');
        if (descInput) descInput.value = '';
        this.pendingNodesFile = null;
        this.pendingEdgesFile = null;
        this.nameExists = false;
        this.updateNameHint('', '');
        this.updateFileChip('nodes');
        this.updateFileChip('edges');
    }

    removeFile(type) {
        if (type === 'nodes') {
            this.pendingNodesFile = null;
        } else {
            this.pendingEdgesFile = null;
        }
        this.updateFileChip(type);
    }

    async checkNameExists(name) {
        const nameInput = this.shadowRoot.querySelector('#graphName');
        if (!name) {
            this.nameExists = false;
            this.updateNameHint('', '');
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
                this.updateNameHint('', '');
            }
        } catch (error) {
            console.error('检测图谱名称失败:', error);
            this.nameExists = false;
            this.updateNameHint('', '');
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

    handleFileSelect(file, type) {
        // 文件名不限，仅要求 .csv 扩展名
        if (!/\.csv$/i.test(file.name)) {
            this.showMessage('仅支持 .csv 文件', 'error');
            return;
        }
        if (type === 'nodes') {
            this.pendingNodesFile = file;
        } else {
            this.pendingEdgesFile = file;
        }
        this.updateFileChip(type);
    }

    updateFileChip(type) {
        const file = type === 'nodes' ? this.pendingNodesFile : this.pendingEdgesFile;
        const chip = this.shadowRoot.querySelector('#' + type + 'FileChip');
        const area = this.shadowRoot.querySelector('#' + type + 'DropArea');
        if (!chip || !area) return;
        if (file) {
            chip.classList.add('visible');
            this.shadowRoot.querySelector('#' + type + 'FileName').textContent =
                `${file.name}（${this.formatSize(file.size)}）`;
            area.style.display = 'none';
        } else {
            chip.classList.remove('visible');
            area.style.display = '';
        }
    }

    async handleSubmit() {
        const name = this.shadowRoot.querySelector('#graphName').value.trim();
        const description = this.shadowRoot.querySelector('#graphDesc').value.trim();

        if (!name) {
            this.showMessage('请输入图谱名称', 'error');
            return;
        }
        if (this.nameExists) {
            this.showMessage(`图谱名称「${name}」已存在，请更换名称`, 'error');
            return;
        }
        if (!this.pendingNodesFile) {
            this.showMessage('请选择节点数据文件', 'error');
            return;
        }
        if (!this.pendingEdgesFile) {
            this.showMessage('请选择关系数据文件', 'error');
            return;
        }
        if (this._isSubmitting) return;
        this._isSubmitting = true;

        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '构建中...';

        // 对齐创建数据集的导入模式：文件读取为Base64后随JSON提交
        try {
            const nodesBase64 = await this.readFileAsBase64(this.pendingNodesFile);
            const edgesBase64 = await this.readFileAsBase64(this.pendingEdgesFile);

            this.showMessage(`正在导入知识图谱「${name}」...`);
            const result = await window.AppConfig.post('knowledgeGraph', 'upload', {
                name,
                description,
                nodesFileName: this.pendingNodesFile.name,
                nodesFileBase64: nodesBase64,
                edgesFileName: this.pendingEdgesFile.name,
                edgesFileBase64: edgesBase64
            });
            if (result.code === 200 || result.success) {
                const graph = result.data || {};
                this.showMessage(`知识图谱「${name}」构建成功！已入库节点 ${this.formatCount(graph.nodeCount)} 个、关系 ${this.formatCount(graph.edgeCount)} 条`, 'success');
                // 通知main.js刷新右侧知识图谱面板
                document.dispatchEvent(new CustomEvent('knowledge-graph-uploaded', {
                    detail: { name }
                }));
                this.hide();
            } else {
                this.showMessage(result.message || '构建失败', 'error');
            }
        } catch (error) {
            console.error('构建知识图谱失败:', error);
            this.showMessage('构建失败: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '构建';
            this._isSubmitting = false;
        }
    }

    /** 读取文件为Base64字符串（去掉data:前缀），与创建数据集的readFileAsBase64一致 */
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
}

customElements.define('knowledge-graph-upload', KnowledgeGraphUpload);
