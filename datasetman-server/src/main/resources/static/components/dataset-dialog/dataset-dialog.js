class DatasetDialog extends HTMLElement {
    constructor() {
        super();
        this.mode = 'create'; // 'create' or 'edit'
        this.datasetData = null;
        this.datasources = [];
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
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                
                :host(.show) {
                    display: flex;
                }
                
                .dataset-dialog {
                    background: white;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                }
                
                .dialog-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e8e8e8;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 8px 8px 0 0;
                }
                
                .dialog-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: white;
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: white;
                    cursor: pointer;
                    padding: 0;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: background 0.3s;
                }
                
                .close-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                
                form {
                    padding: 20px;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                .form-label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    color: #262626;
                    margin-bottom: 8px;
                }
                
                .form-label.required::after {
                    content: ' *';
                    color: #ff4d4f;
                }
                
                .form-control {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #d9d9d9;
                    border-radius: 4px;
                    font-size: 14px;
                    transition: all 0.3s;
                    box-sizing: border-box;
                }
                
                .form-control:focus {
                    border-color: #1890ff;
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
                }
                
                .sql-textarea {
                    min-height: 120px;
                    font-family: 'Consolas', 'Monaco', monospace;
                    resize: vertical;
                }
                
                .desc-textarea {
                    min-height: 80px;
                    resize: vertical;
                }
                
                .form-hint {
                    font-size: 12px;
                    color: #8c8c8c;
                    margin-top: 6px;
                }
                
                .error-message {
                    display: none;
                    color: #ff4d4f;
                    font-size: 12px;
                    margin-top: 6px;
                }
                
                .form-control.error {
                    border-color: #ff4d4f;
                }
                
                .form-control.error + .error-message {
                    display: block;
                }
                
                .datasource-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 10px;
                }
                
                .datasource-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: #e6f7ff;
                    border: 1px solid #91d5ff;
                    border-radius: 4px;
                    font-size: 13px;
                    color: #1890ff;
                }
                
                .datasource-tag .remove-tag {
                    cursor: pointer;
                    font-size: 14px;
                    line-height: 1;
                }
                
                .datasource-tag .remove-tag:hover {
                    color: #ff4d4f;
                }
                
                .btn-add-source {
                    padding: 6px 12px;
                    border: 1px dashed #d9d9d9;
                    background: white;
                    border-radius: 4px;
                    font-size: 13px;
                    color: #595959;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .btn-add-source:hover {
                    border-color: #1890ff;
                    color: #1890ff;
                }
                
                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding-top: 10px;
                    border-top: 1px solid #e8e8e8;
                }
                
                .btn-cancel,
                .btn-submit {
                    padding: 10px 24px;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s;
                    border: none;
                }
                
                .btn-cancel {
                    background: #f0f0f0;
                    color: #595959;
                }
                
                .btn-cancel:hover {
                    background: #d9d9d9;
                }
                
                .btn-submit {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                .btn-submit:hover {
                    opacity: 0.9;
                }
                
                .btn-submit:disabled {
                    background: #bfbfbf;
                    cursor: not-allowed;
                }
                
                .btn-submit.loading {
                    position: relative;
                    color: transparent;
                }
                
                .btn-submit.loading::after {
                    content: '';
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    top: 50%;
                    left: 50%;
                    margin-left: -8px;
                    margin-top: -8px;
                    border: 2px solid #ffffff;
                    border-radius: 50%;
                    border-top-color: transparent;
                    animation: spinner 0.8s linear infinite;
                }
                
                @keyframes spinner {
                    to { transform: rotate(360deg); }
                }
                
                /* Datasource Selection Modal */
                .datasource-modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    align-items: center;
                    justify-content: center;
                }
                
                .datasource-modal.show {
                    display: flex;
                }
                
                .datasource-modal-content {
                    background: white;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 400px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                
                .datasource-modal-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid #e8e8e8;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .datasource-modal-header h4 {
                    margin: 0;
                    font-size: 16px;
                }
                
                .datasource-list {
                    padding: 10px 0;
                }
                
                .datasource-option {
                    padding: 12px 20px;
                    cursor: pointer;
                    transition: background 0.3s;
                }
                
                .datasource-option:hover {
                    background: #f5f5f5;
                }
                
                .datasource-option.selected {
                    background: #e6f7ff;
                    color: #1890ff;
                }
                
                @media (max-width: 768px) {
                    .dataset-dialog {
                        width: 95%;
                        max-height: 95vh;
                    }
                    
                    .form-actions {
                        flex-direction: column-reverse;
                    }
                    
                    .btn-cancel,
                    .btn-submit {
                        width: 100%;
                    }
                }
            </style>
            
            <div class="dataset-dialog">
                <div class="dialog-header">
                    <h3 class="dialog-title" id="dialogTitle">创建数据集</h3>
                    <button class="close-btn" id="closeBtn">&times;</button>
                </div>
                
                <form id="datasetForm">
                    <div class="form-group">
                        <label class="form-label required">数据集名称</label>
                        <input type="text" class="form-control" id="datasetName" placeholder="请输入数据集名称" required>
                        <div class="error-message" id="datasetNameError">请输入数据集名称</div>
                    </div>

                    <div class="form-group">
                        <label class="form-label required">SQL定义</label>
                        <textarea class="form-control sql-textarea" id="datasetSql" placeholder="请输入SQL查询语句" required></textarea>
                        <div class="error-message" id="datasetSqlError">请输入SQL定义</div>
                        <div class="form-hint">支持标准SQL语法，可引用多个数据源</div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">数据源</label>
                        <div class="datasource-tags" id="datasourceTags"></div>
                        <button type="button" class="btn-add-source" id="addDatasourceBtn">+ 添加数据源</button>
                    </div>

                    <div class="form-group">
                        <label class="form-label">描述</label>
                        <textarea class="form-control desc-textarea" id="datasetDesc" placeholder="请输入数据集描述（可选）"></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-cancel" id="cancelBtn">取消</button>
                        <button type="submit" class="btn-submit" id="submitBtn">保存</button>
                    </div>
                </form>
            </div>
            
            <!-- 数据源选择弹窗 -->
            <div class="datasource-modal" id="datasourceModal">
                <div class="datasource-modal-content">
                    <div class="datasource-modal-header">
                        <h4>选择数据源</h4>
                        <button class="close-btn" id="closeDatasourceModal" style="color: #666; font-size: 20px;">&times;</button>
                    </div>
                    <div class="datasource-list" id="datasourceList">
                        <div class="datasource-option" data-source="IoTDB">IoTDB - 时序数据库</div>
                        <div class="datasource-option" data-source="MySQL">MySQL - 关系型数据库</div>
                        <div class="datasource-option" data-source="MongoDB">MongoDB - 文档数据库</div>
                        <div class="datasource-option" data-source="Kafka">Kafka - 消息队列</div>
                        <div class="datasource-option" data-source="HDFS">HDFS - 分布式文件系统</div>
                    </div>
                </div>
            </div>
        `;
    }

    initEventListeners() {
        // 关闭按钮
        this.shadowRoot.querySelector('#closeBtn').addEventListener('click', () => this.hide());
        this.shadowRoot.querySelector('#cancelBtn').addEventListener('click', () => this.hide());
        
        // 表单提交
        this.shadowRoot.querySelector('#datasetForm').addEventListener('submit', (e) => this.handleSubmit(e));
        
        // 添加数据源
        this.shadowRoot.querySelector('#addDatasourceBtn').addEventListener('click', () => this.showDatasourceModal());
        
        // 关闭数据源弹窗
        this.shadowRoot.querySelector('#closeDatasourceModal').addEventListener('click', () => this.hideDatasourceModal());
        this.shadowRoot.querySelector('#datasourceModal').addEventListener('click', (e) => {
            if (e.target.id === 'datasourceModal') this.hideDatasourceModal();
        });
        
        // 数据源选择
        this.shadowRoot.querySelectorAll('.datasource-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectDatasource(e.target.dataset.source));
        });
        
        // 点击遮罩关闭
        this.addEventListener('click', (e) => {
            if (e.target === this) this.hide();
        });
    }

    // 显示弹窗 - 创建模式
    showCreate() {
        this.mode = 'create';
        this.datasetData = null;
        this.datasources = [];
        this.resetForm();
        this.shadowRoot.querySelector('#dialogTitle').textContent = '创建数据集';
        this.shadowRoot.querySelector('#submitBtn').textContent = '创建';
        this.classList.add('show');
    }

    // 显示弹窗 - 编辑模式
    showEdit(datasetData) {
        this.mode = 'edit';
        this.datasetData = datasetData;
        this.datasources = datasetData.datasources || [];
        this.fillForm(datasetData);
        this.shadowRoot.querySelector('#dialogTitle').textContent = '编辑数据集';
        this.shadowRoot.querySelector('#submitBtn').textContent = '保存';
        this.classList.add('show');
    }

    hide() {
        this.classList.remove('show');
    }

    resetForm() {
        this.shadowRoot.querySelector('#datasetForm').reset();
        this.shadowRoot.querySelector('#datasetName').classList.remove('error');
        this.shadowRoot.querySelector('#datasetSql').classList.remove('error');
        this.renderDatasourceTags();
    }

    fillForm(data) {
        this.shadowRoot.querySelector('#datasetName').value = data.name || data.datasetName || '';
        this.shadowRoot.querySelector('#datasetSql').value = data.sql || '';
        this.shadowRoot.querySelector('#datasetDesc').value = data.description || data.desc || '';
        this.renderDatasourceTags();
    }

    renderDatasourceTags() {
        const container = this.shadowRoot.querySelector('#datasourceTags');
        container.innerHTML = this.datasources.map(source => `
            <span class="datasource-tag">
                ${source}
                <span class="remove-tag" data-source="${source}">&times;</span>
            </span>
        `).join('');
        
        // 绑定删除标签事件
        container.querySelectorAll('.remove-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const source = e.target.dataset.source;
                this.datasources = this.datasources.filter(s => s !== source);
                this.renderDatasourceTags();
            });
        });
    }

    showDatasourceModal() {
        this.shadowRoot.querySelector('#datasourceModal').classList.add('show');
    }

    hideDatasourceModal() {
        this.shadowRoot.querySelector('#datasourceModal').classList.remove('show');
    }

    selectDatasource(source) {
        if (!this.datasources.includes(source)) {
            this.datasources.push(source);
            this.renderDatasourceTags();
        }
        this.hideDatasourceModal();
    }

    validateForm() {
        let isValid = true;
        
        const name = this.shadowRoot.querySelector('#datasetName').value.trim();
        const sql = this.shadowRoot.querySelector('#datasetSql').value.trim();
        
        if (!name) {
            this.shadowRoot.querySelector('#datasetName').classList.add('error');
            isValid = false;
        } else {
            this.shadowRoot.querySelector('#datasetName').classList.remove('error');
        }
        
        if (!sql) {
            this.shadowRoot.querySelector('#datasetSql').classList.add('error');
            isValid = false;
        } else {
            this.shadowRoot.querySelector('#datasetSql').classList.remove('error');
        }
        
        return isValid;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) return;
        
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        
        const formData = {
            name: this.shadowRoot.querySelector('#datasetName').value.trim(),
            sql: this.shadowRoot.querySelector('#datasetSql').value.trim(),
            description: this.shadowRoot.querySelector('#datasetDesc').value.trim(),
            datasources: this.datasources
        };
        
        try {
            const token = localStorage.getItem('token');
            let url = '/api/datasets';
            let method = 'POST';
            
            if (this.mode === 'edit' && this.datasetData) {
                const datasetId = this.datasetData.id || this.datasetData.datasetId;
                url = `/api/datasets/${datasetId}`;
                method = 'PUT';
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                throw new Error(this.mode === 'create' ? '创建失败' : '保存失败');
            }
            
            const result = await response.json();
            
            // 触发成功事件
            this.dispatchEvent(new CustomEvent('dataset-saved', {
                bubbles: true,
                composed: true,
                detail: {
                    mode: this.mode,
                    data: result
                }
            }));
            
            this.showToast(this.mode === 'create' ? '数据集创建成功' : '数据集保存成功', 'success');
            this.hide();
            
        } catch (error) {
            console.error(this.mode === 'create' ? '创建数据集失败:' : '保存数据集失败:', error);
            this.showToast((this.mode === 'create' ? '创建失败: ' : '保存失败: ') + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    }

    showToast(message, type = 'info') {
        this.dispatchEvent(new CustomEvent('show-toast', {
            bubbles: true,
            composed: true,
            detail: { message, type }
        }));
    }
}

customElements.define('dataset-dialog', DatasetDialog);
