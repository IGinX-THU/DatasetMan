class DatasetDialog extends HTMLElement {
    constructor() {
        super();
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
                
                /* SQL列表样式 */
                .sql-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .sql-item {
                    display: flex;
                    gap: 8px;
                    align-items: flex-start;
                }
                
                .sql-item-number {
                    min-width: 24px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #e2e6ef;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    color: #5f6b7a;
                }
                
                .sql-item-content {
                    flex: 1;
                    min-width: 0;
                    width: 100%;
                }
                
                .sql-item-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 32px;
                }
                
                .sql-action-btn {
                    padding: 4px 8px;
                    border: 1px solid #e2e6ef;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                    min-width: 32px;
                }
                
                .sql-action-btn:hover {
                    border-color: #4c89ff;
                    color: #4c89ff;
                }
                
                .sql-action-btn.delete:hover {
                    border-color: #ff4d4f;
                    color: #ff4d4f;
                }
                
                .sql-action-btn.test:hover {
                    border-color: #52c41a;
                    color: #52c41a;
                }
                
                .sql-action-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                
                .btn-add-sql {
                    padding: 6px 12px;
                    border: 1px dashed #e2e6ef;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    color: #5f6b7a;
                    transition: all 0.2s;
                    margin-top: 8px;
                }
                
                .btn-add-sql:hover {
                    border-color: #4c89ff;
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
                                <div class="sql-list" id="sqlList">
                                    <!-- SQL列表将动态生成 -->
                                </div>
                                <button type="button" class="btn-add-sql" id="addSqlBtn">+ 添加SQL</button>
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

        // 表单提交事件 - 防止表单默认提交
        this.shadowRoot.querySelector('#datasetForm').addEventListener('submit', (e) => {
            e.preventDefault();
        });

        // 阻止Enter键触发表单提交
        this.shadowRoot.querySelector('#datasetForm').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });

        // 保存按钮 - 使用防抖函数
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');

        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.debounceTimer) return; // 防抖中，直接返回

            this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
            }, 500); // 500ms防抖

            if (this._isSubmitting) return;

            this._isSubmitting = true;
            submitBtn.disabled = true;
            submitBtn.style.pointerEvents = 'none';
            submitBtn.style.opacity = '0.6';

            this.handleSubmit();
        });

        // 添加SQL按钮
        this.shadowRoot.querySelector('#addSqlBtn').addEventListener('click', () => this.addSql());
    }

    // 显示弹窗 - 创建模式
    showCreate() {
        this.mode = 'create';
        this.datasetData = null;
        this.resetForm();
        this.shadowRoot.querySelector('#dialogTitle').textContent = '新增数据集';
        this.shadowRoot.querySelector('#submitBtn').textContent = '保存';
        this.classList.add('show');
        // 确保按钮可点击
        this._isSubmitting = false;
        this.debounceTimer = null; // 清除防抖定时器
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = false;
        submitBtn.style.pointerEvents = '';
        submitBtn.style.opacity = '';
    }

    // 显示弹窗 - 编辑模式
    async showEdit(datasetData) {
        this.mode = 'edit';
        this.datasetData = datasetData;

        // 重置提交状态和按钮
        this._isSubmitting = false;
        this.debounceTimer = null; // 清除防抖定时器
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = false;
        submitBtn.style.pointerEvents = '';
        submitBtn.style.opacity = '';
        submitBtn.textContent = '保存';

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
        this.sqlList = ['']; // 初始化为包含一个空SQL的列表
        this.renderSqlList();
        // 重置提交状态和按钮
        this._isSubmitting = false;
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.disabled = false;
        submitBtn.style.pointerEvents = '';
        submitBtn.style.opacity = '';
        submitBtn.textContent = '保存';
    }

    fillForm(data) {
        this.shadowRoot.querySelector('#datasetName').value = data.name || data.datasetName || '';
        this.shadowRoot.querySelector('#datasetName').readOnly = true;
        this.shadowRoot.querySelector('#datasetRemark').value = data.remark || '';
        this.clearResult();
        
        // 处理SQL列表
        if (data.sql || data.datasetSql) {
            const sqlValue = data.sql || data.datasetSql;
            if (Array.isArray(sqlValue)) {
                this.sqlList = sqlValue;
            } else if (typeof sqlValue === 'string') {
                try {
                    // 尝试解析JSON字符串
                    const parsed = JSON.parse(sqlValue);
                    if (Array.isArray(parsed)) {
                        this.sqlList = parsed;
                    } else {
                        // 如果解析出来不是数组，按分号分割
                        this.sqlList = sqlValue.split(';').map(s => s.trim()).filter(s => s);
                        if (this.sqlList.length === 0) {
                            this.sqlList = [sqlValue];
                        }
                    }
                } catch (e) {
                    // JSON解析失败，按分号分割
                    this.sqlList = sqlValue.split(';').map(s => s.trim()).filter(s => s);
                    if (this.sqlList.length === 0) {
                        this.sqlList = [sqlValue];
                    }
                }
            }
        } else {
            this.sqlList = [''];
        }
        this.renderSqlList();
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
        
        // 更新sqlList
        this.updateSqlListFromDOM();
        
        if (!name) {
            this.showResult('请输入数据集名称', 'error');
            return false;
        }
        
        if (!this.sqlList || this.sqlList.length === 0 || this.sqlList.every(sql => !sql.trim())) {
            this.showResult('请输入至少一条SQL查询语句', 'error');
            return false;
        }
        
        return true;
    }

    async handleTest(index) {
        // 更新sqlList
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
            // 后端是@PostMapping但使用@RequestParam，所以需要POST请求但参数在URL中
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
        if (!this.validateForm()) return;

        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        submitBtn.textContent = '保存中...';
        this.showResult('正在保存数据集...', 'loading');

        // 确保sqlList是最新的
        this.updateSqlListFromDOM();

        // 过滤掉空SQL并清理SQL（去除多余换行符和空格）
        const validSqlList = this.sqlList
            .filter(sql => sql && sql.trim())
            .map(sql => {
                // 去除首尾空格
                let cleanedSql = sql.trim();
                // 将多个连续空格替换为单个空格
                cleanedSql = cleanedSql.replace(/\s+/g, ' ');
                return cleanedSql;
            });
        
        const formData = {
            datasetName: this.shadowRoot.querySelector('#datasetName').value.trim(),
            datasetSql: validSqlList,
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

                // 立即关闭弹窗
                this.hide();
            } else {
                this.showResult(result.message || (this.mode === 'create' ? '创建失败' : '保存失败'), 'error');
                // 失败时重新启用按钮
                this._isSubmitting = false;
                submitBtn.disabled = false;
                submitBtn.style.pointerEvents = '';
                submitBtn.style.opacity = '';
                submitBtn.textContent = '保存';
            }

        } catch (error) {
            console.error(this.mode === 'create' ? '创建数据集失败:' : '保存数据集失败:', error);
            this.showResult((this.mode === 'create' ? '创建失败: ' : '保存失败: ') + error.message, 'error');
            // 失败时重新启用按钮
            this._isSubmitting = false;
            submitBtn.disabled = false;
            submitBtn.style.pointerEvents = '';
            submitBtn.style.opacity = '';
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
    
    // 渲染SQL列表
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
        
        // 绑定事件
        this.bindSqlListEvents();
    }
    
    // 绑定SQL列表事件
    bindSqlListEvents() {
        const sqlListContainer = this.shadowRoot.querySelector('#sqlList');
        
        // 上移按钮
        sqlListContainer.querySelectorAll('[data-action="up"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.moveSqlUp(index);
            });
        });
        
        // 下移按钮
        sqlListContainer.querySelectorAll('[data-action="down"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.moveSqlDown(index);
            });
        });
        
        // 删除按钮
        sqlListContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.deleteSql(index);
            });
        });
        
        // 测试按钮
        sqlListContainer.querySelectorAll('[data-action="test"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.handleTest(index);
            });
        });
    }
    
    // 添加SQL
    addSql() {
        this.updateSqlListFromDOM();
        this.sqlList.push('');
        this.renderSqlList();
    }
    
    // 删除SQL
    deleteSql(index) {
        this.updateSqlListFromDOM();
        this.sqlList.splice(index, 1);
        this.renderSqlList();
    }
    
    // 上移SQL
    moveSqlUp(index) {
        if (index <= 0) return;
        this.updateSqlListFromDOM();
        [this.sqlList[index - 1], this.sqlList[index]] = [this.sqlList[index], this.sqlList[index - 1]];
        this.renderSqlList();
    }
    
    // 下移SQL
    moveSqlDown(index) {
        if (index >= this.sqlList.length - 1) return;
        this.updateSqlListFromDOM();
        [this.sqlList[index], this.sqlList[index + 1]] = [this.sqlList[index + 1], this.sqlList[index]];
        this.renderSqlList();
    }
    
    // 从DOM更新sqlList
    updateSqlListFromDOM() {
        const sqlTextareas = this.shadowRoot.querySelectorAll('.sql-textarea');
        this.sqlList = Array.from(sqlTextareas).map(textarea => textarea.value);
    }
    
    // 获取当前聚焦的SQL输入框索引
    getFocusedSqlIndex() {
        const sqlTextareas = this.shadowRoot.querySelectorAll('.sql-textarea');
        for (let i = 0; i < sqlTextareas.length; i++) {
            if (document.activeElement === sqlTextareas[i]) {
                return i;
            }
        }
        return -1;
    }
}

customElements.define('dataset-dialog', DatasetDialog);
