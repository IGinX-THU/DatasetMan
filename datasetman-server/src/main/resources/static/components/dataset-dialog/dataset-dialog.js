class DatasetDialog extends HTMLElement {
    constructor() {
        super();
        this.mode = 'create'; // 'create' or 'edit'
        this.datasetData = null;
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
                    inset: 0;
                    background: rgba(15, 23, 42, 0.35);
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }
                
                :host(.show) {
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
                    min-height: 250px;
                    font-family: 'Consolas', 'Monaco', monospace;
                    box-sizing: border-box;
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
                    gap: 12px;
                    margin-top: 4px;
                }
                
                .btn-test {
                    padding: 6px 16px;
                    border-radius: 4px;
                    border: none;
                    background: #52c41a;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }
                
                .btn-test:hover {
                    background: #389e0d;
                }
                
                .btn-test:disabled {
                    background: #bfbfbf;
                    cursor: not-allowed;
                }
                
                /* 执行结果显示区 */
                .result-area {
                    margin-top: 8px;
                    border: 1px solid #e2e6ef;
                    border-radius: 6px;
                    padding: 12px;
                    background: #f8f9fa;
                    min-height: 150px;
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .result-placeholder {
                    color: #999;
                    font-size: 12px;
                    text-align: center;
                    padding: 50px 0;
                }
                
                .result-content {
                    font-family: 'Consolas', 'Monaco', monospace;
                    font-size: 12px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-break: break-all;
                }
                
                .result-success {
                    color: #52c41a;
                }
                
                .result-error {
                    color: #ff4d4f;
                }
                
                .result-loading {
                    color: #4c89ff;
                }
            </style>
            
            <div class="modal" id="datasetModal">
                <div class="modal-header">
                    <h3 class="modal-title" id="dialogTitle">创建数据集</h3>
                    <button class="modal-close" id="closeBtn">&times;</button>
                </div>
                
                <div class="modal-body">
                    <form class="modal-form" id="datasetForm">
                        <!-- 名称 -->
                        <div class="modal-form-row">
                            <label class="modal-label">名称 <span style="color: red;">*</span> :</label>
                            <div class="modal-input-wrapper">
                                <input type="text" class="modal-input" id="datasetName" placeholder="请输入数据集名称" />
                            </div>
                        </div>

                        <!-- 备注 -->
                        <div class="modal-form-row">
                            <label class="modal-label">备注 :</label>
                            <div class="modal-input-wrapper">
                                <input type="text" class="modal-input" id="datasetRemark" placeholder="请输入描述信息" />
                            </div>
                        </div>

                        <!-- SQL -->
                        <div class="modal-form-row">
                            <label class="modal-label">SQL <span style="color: red;">*</span> :</label>
                            <div class="modal-input-wrapper">
                                <textarea class="modal-textarea" id="datasetSql" placeholder="请输入SQL查询语句" rows="3"></textarea>
                                <div class="test-row">
                                    <button type="button" class="btn-test" id="testBtn">测试</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 执行结果显示区 -->
                        <div class="modal-form-row">
                            <label class="modal-label">执行结果显示 :</label>
                            <div class="modal-input-wrapper">
                                <div class="result-area" id="resultArea">
                                    <div class="result-placeholder">执行结果将显示在这里</div>
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
        `;
    }

    initEventListeners() {
        // 关闭按钮
        this.shadowRoot.querySelector('#closeBtn').addEventListener('click', () => this.hide());
        this.shadowRoot.querySelector('#cancelBtn').addEventListener('click', () => this.hide());
        
        // 保存按钮
        this.shadowRoot.querySelector('#submitBtn').addEventListener('click', () => this.handleSubmit());
        
        // 测试按钮
        this.shadowRoot.querySelector('#testBtn').addEventListener('click', () => this.handleTest());
    }

    // 显示弹窗 - 创建模式
    showCreate() {
        this.mode = 'create';
        this.datasetData = null;
        this.resetForm();
        this.shadowRoot.querySelector('#dialogTitle').textContent = '新增数据集';
        this.shadowRoot.querySelector('#submitBtn').textContent = '保存';
        this.classList.add('show');
    }

    // 显示弹窗 - 编辑模式
    async showEdit(datasetData) {
        this.mode = 'edit';
        this.datasetData = datasetData;

        // 如果只有 storagePath，先获取完整数据
        if (datasetData.storagePath && !datasetData.datasetName) {
            try {
                const result = await window.AppConfig.get('dataset', 'metas', { path: datasetData.storagePath });
                if (result.code === 200 && result.data) {
                    this.datasetData = result.data;
                    this.fillForm(result.data);
                } else {
                    this.dispatchEvent(new CustomEvent('show-toast', {
                        bubbles: true,
                        composed: true,
                        detail: { message: '获取数据集信息失败: ' + result.message, type: 'error' }
                    }));
                    return;
                }
            } catch (error) {
                console.error('获取数据集信息失败:', error);
                this.dispatchEvent(new CustomEvent('show-toast', {
                    bubbles: true,
                    composed: true,
                    detail: { message: '获取数据集信息失败: ' + error.message, type: 'error' }
                }));
                return;
            }
        } else {
            this.fillForm(datasetData);
        }

        this.shadowRoot.querySelector('#dialogTitle').textContent = '编辑数据集';
        this.shadowRoot.querySelector('#submitBtn').textContent = '保存';
        this.classList.add('show');
    }

    hide() {
        this.classList.remove('show');
    }

    resetForm() {
        this.shadowRoot.querySelector('#datasetForm').reset();
        this.shadowRoot.querySelector('#datasetName').readOnly = false;
        this.clearResult();
    }

    fillForm(data) {
        this.shadowRoot.querySelector('#datasetName').value = data.name || data.datasetName || '';
        this.shadowRoot.querySelector('#datasetName').readOnly = true;
        this.shadowRoot.querySelector('#datasetSql').value = data.sql || data.datasetSql || '';
        this.shadowRoot.querySelector('#datasetRemark').value = data.remark || '';
        this.clearResult();
    }

    clearResult() {
        const resultArea = this.shadowRoot.querySelector('#resultArea');
        resultArea.innerHTML = '<div class="result-placeholder">执行结果将显示在这里</div>';
    }

    showResult(content, type = 'success') {
        const resultArea = this.shadowRoot.querySelector('#resultArea');
        const className = type === 'success' ? 'result-success' : 
                         type === 'error' ? 'result-error' : 
                         type === 'loading' ? 'result-loading' : '';
        resultArea.innerHTML = `<div class="result-content ${className}">${content}</div>`;
    }

    validateForm() {
        const name = this.shadowRoot.querySelector('#datasetName').value.trim();
        const sql = this.shadowRoot.querySelector('#datasetSql').value.trim();
        
        if (!name) {
            this.showResult('请输入数据集名称', 'error');
            return false;
        }
        
        if (!sql) {
            this.showResult('请输入SQL查询语句', 'error');
            return false;
        }
        
        return true;
    }

    async handleTest() {
        if (!this.validateForm()) {
            return;
        }
        
        const testBtn = this.shadowRoot.querySelector('#testBtn');
        testBtn.disabled = true;
        testBtn.textContent = '测试中...';
        this.showResult('正在执行SQL测试...', 'loading');
        
        try {
            const name = this.shadowRoot.querySelector('#datasetName').value.trim();
            const sql = this.shadowRoot.querySelector('#datasetSql').value.trim();
            
            const result = await window.AppConfig.post('dataset', 'testsql', {
                datasetName: name,
                datasetSql: sql
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
        if (!this.validateForm()) return;
        
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '保存中...';
        this.showResult('正在保存数据集...', 'loading');
        
        const formData = {
            datasetName: this.shadowRoot.querySelector('#datasetName').value.trim(),
            datasetSql: this.shadowRoot.querySelector('#datasetSql').value.trim(),
            parent: this.datasetData?.createTime || 0,
            remark: this.shadowRoot.querySelector('#datasetRemark')?.value.trim() || ''
        };
        
        try {
            const result = await window.AppConfig.post('dataset', 'save', formData);
            
            if (result.success) {
                // 触发成功事件
                this.dispatchEvent(new CustomEvent('dataset-saved', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        mode: this.mode,
                        data: result
                    }
                }));
                
                this.showResult(this.mode === 'create' ? '数据集创建成功!' : '数据集保存成功!', 'success');
                
                // 延迟关闭弹窗
                setTimeout(() => {
                    this.hide();
                }, 1000);
            } else {
                this.showResult(result.message || (this.mode === 'create' ? '创建失败' : '保存失败'), 'error');
            }
            
        } catch (error) {
            console.error(this.mode === 'create' ? '创建数据集失败:' : '保存数据集失败:', error);
            this.showResult((this.mode === 'create' ? '创建失败: ' : '保存失败: ') + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '保存';
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
