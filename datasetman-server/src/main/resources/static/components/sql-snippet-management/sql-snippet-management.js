class SqlSnippetManagement extends HTMLElement {
    constructor() {
        super();
        this.snippets = [];
        this._searchTimer = null;
        this._modalWrapper = null;
    }

    connectedCallback() {
        this.style.display = 'none';

        this.innerHTML = `
            <link rel="stylesheet" href="./components/sql-snippet-management/sql-snippet-management.css">
        `;

        fetch('./components/sql-snippet-management/sql-snippet-management.html')
            .then(response => response.text())
            .then(html => {
                this.innerHTML += html;
                this.initEventListeners();
            });
    }

    initEventListeners() {
        const createBtn = this.querySelector('#createBtn');
        const refreshBtn = this.querySelector('#refreshBtn');
        const searchInput = this.querySelector('#searchInput');

        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateModal());
        }
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadSnippets());
        }
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => {
                    this.loadSnippets(e.target.value.trim());
                }, 300);
            });
        }
    }

    async show() {
        this.style.display = 'block';
        await this.loadSnippets();
    }

    hide() {
        this.style.display = 'none';
        this.closeModal();
    }

    async loadSnippets(name = '') {
        try {
            const params = {};
            if (name) params.name = name;
            const result = await window.AppConfig.get('sqlSnippet', 'list', params);

            if (result.code === 200 && result.data) {
                this.snippets = result.data;
                this.renderTable();
            } else {
                this.showMessage(result.message || '加载SQL片段列表失败', 'error');
                this.snippets = [];
                this.renderTable();
            }
        } catch (error) {
            console.error('加载SQL片段列表失败:', error);
            this.showMessage('加载SQL片段列表失败', 'error');
            this.snippets = [];
            this.renderTable();
        }
    }

    renderTable() {
        const tbody = this.querySelector('#tableBody');
        if (!tbody) return;

        const newTbody = tbody.cloneNode(false);
        tbody.parentNode.replaceChild(newTbody, tbody);

        if (this.snippets.length === 0) {
            newTbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        暂无SQL片段
                    </td>
                </tr>
            `;
            return;
        }

        newTbody.innerHTML = this.snippets.map(snippet => {
            let sqlCount = 0;
            try {
                sqlCount = JSON.parse(snippet.sqlList || '[]').length;
            } catch (e) {
                sqlCount = 0;
            }
            return `
                <tr data-id="${snippet.id}">
                    <td>${this.escapeHtml(snippet.name || '')}</td>
                    <td>${this.escapeHtml(snippet.description || '-')}</td>
                    <td>${sqlCount}</td>
                    <td>${this.escapeHtml(snippet.operator || snippet.owner || '-')}</td>
                    <td>${this.formatTime(snippet.createTime)}</td>
                    <td>
                        <button class="action-btn view" data-id="${snippet.id}">查看</button>
                        <button class="action-btn edit" data-id="${snippet.id}">编辑</button>
                        <button class="action-btn delete" data-id="${snippet.id}">删除</button>
                    </td>
                </tr>
            `;
        }).join('');

        newTbody.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            if (!id) return;
            if (e.target.classList.contains('view')) {
                this.viewSnippet(parseInt(id));
            } else if (e.target.classList.contains('edit')) {
                this.showEditModal(parseInt(id));
            } else if (e.target.classList.contains('delete')) {
                this.deleteSnippet(parseInt(id));
            }
        });
    }

    // ============ 弹窗：用公共 app-dialog-* 类，append 到 body ============

    showCreateModal() {
        this.openModal('新建SQL片段', { id: '', name: '', description: '', sqlList: [''] });
    }

    async showEditModal(id) {
        try {
            const result = await window.AppConfig.get('sqlSnippet', 'metas', { id });
            if (result.code === 200 && result.data) {
                const snippet = result.data;
                let sqlList = [];
                try {
                    sqlList = JSON.parse(snippet.sqlList || '[]');
                } catch (e) {
                    sqlList = [];
                }
                if (sqlList.length === 0) sqlList = [''];
                this.openModal('编辑SQL片段', {
                    id: snippet.id,
                    name: snippet.name || '',
                    description: snippet.description || '',
                    sqlList: sqlList
                });
            } else {
                this.showMessage(result.message || '获取详情失败', 'error');
            }
        } catch (error) {
            console.error('获取SQL片段详情失败:', error);
            this.showMessage('获取详情失败', 'error');
        }
    }

    openModal(title, data) {
        this.closeModal();

        const wrapper = document.createElement('div');
        wrapper.className = 'sql-snippet-modal-wrapper';
        wrapper.innerHTML = `
            <div class="app-dialog-mask">
                <div class="app-dialog app-dialog-lg">
                    <button class="app-dialog-close">&times;</button>
                    <h3 class="app-dialog-title">${this.escapeHtml(title)}</h3>
                    <form id="snippetForm">
                        <input type="hidden" id="snippetId" value="${data.id}">
                        <div class="form-group">
                            <label>名称 <span class="required">*</span></label>
                            <input type="text" id="snippetName" value="${this.escapeHtml(data.name)}" placeholder="例如：speed_aggregate" required>
                        </div>
                        <div class="form-group">
                            <label>描述</label>
                            <input type="text" id="snippetDesc" value="${this.escapeHtml(data.description)}" placeholder="可选描述">
                        </div>
                        <div class="form-group">
                            <label>SQL列表 <span class="required">*</span></label>
                            <div id="sqlListContainer" style="display: flex; flex-direction: column; gap: 8px;"></div>
                            <button type="button" id="addSqlBtn" class="btn-secondary" style="margin-top: 8px;">+ 添加SQL</button>
                        </div>
                        <div class="app-dialog-footer">
                            <button type="button" id="cancelBtn" class="btn-secondary">取消</button>
                            <button type="submit" id="saveBtn" class="btn-primary">保存</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);
        this._modalWrapper = wrapper;

        const container = wrapper.querySelector('#sqlListContainer');
        data.sqlList.forEach(sql => this.addSqlRow(container, sql));

        wrapper.querySelector('.app-dialog-close').addEventListener('click', () => this.closeModal());
        wrapper.querySelector('#cancelBtn').addEventListener('click', () => this.closeModal());
        wrapper.querySelector('#addSqlBtn').addEventListener('click', () => this.addSqlRow(container, ''));
        wrapper.querySelector('#snippetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSnippet();
        });
        wrapper.querySelector('.app-dialog-mask').addEventListener('click', (e) => {
            if (e.target.classList.contains('app-dialog-mask')) this.closeModal();
        });
    }

    addSqlRow(container, value = '') {
        const row = document.createElement('div');
        row.className = 'sql-item';
        row.style.cssText = 'display: flex; gap: 8px; align-items: flex-start;';
        row.innerHTML = `
            <textarea class="sql-textarea" placeholder="SELECT ... FROM ..." style="
                flex: 1; min-height: 80px; padding: 8px 12px; border: 1px solid #c9cdd4;
                border-radius: 4px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px;
                resize: vertical; box-sizing: border-box;
            ">${this.escapeHtml(value)}</textarea>
            <button type="button" class="remove-sql-btn" style="
                padding: 4px 10px; border: 1px solid #ef4444; border-radius: 4px;
                background: white; color: #ef4444; cursor: pointer; font-size: 18px; flex-shrink: 0;
            ">×</button>
        `;
        row.querySelector('.remove-sql-btn').addEventListener('click', () => {
            if (container.children.length > 1) {
                row.remove();
            } else {
                row.querySelector('textarea').value = '';
            }
        });
        container.appendChild(row);
    }

    closeModal() {
        if (this._modalWrapper) {
            this._modalWrapper.remove();
            this._modalWrapper = null;
        }
    }

    async saveSnippet() {
        const wrapper = this._modalWrapper;
        if (!wrapper) return;

        const id = wrapper.querySelector('#snippetId').value;
        const name = wrapper.querySelector('#snippetName').value.trim();
        const description = wrapper.querySelector('#snippetDesc').value.trim();
        const sqlTextareas = wrapper.querySelectorAll('.sql-textarea');
        const sqlList = Array.from(sqlTextareas)
            .map(t => t.value.trim())
            .filter(s => s.length > 0);

        if (!name) {
            this.showMessage('请填写名称', 'error');
            return;
        }
        if (sqlList.length === 0) {
            this.showMessage('请至少填写一条SQL', 'error');
            return;
        }

        const request = { name, sqlList, description };
        if (id) request.id = parseInt(id);

        try {
            const saveBtn = wrapper.querySelector('#saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';

            const result = await window.AppConfig.post('sqlSnippet', 'save', request);
            if (result.code === 200) {
                this.showMessage('保存成功', 'success');
                this.closeModal();
                await this.loadSnippets();
            } else {
                this.showMessage(result.message || '保存失败', 'error');
            }
        } catch (error) {
            console.error('保存SQL片段失败:', error);
            this.showMessage('保存失败: ' + error.message, 'error');
        } finally {
            if (this._modalWrapper) {
                const saveBtn = this._modalWrapper.querySelector('#saveBtn');
                saveBtn.disabled = false;
                saveBtn.textContent = '保存';
            }
        }
    }

    viewSnippet(id) {
        const snippet = this.snippets.find(s => s.id === id);
        if (!snippet) return;
        let sqlList = [];
        try {
            sqlList = JSON.parse(snippet.sqlList || '[]');
        } catch (e) {
            sqlList = [];
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'sql-snippet-modal-wrapper';
        wrapper.innerHTML = `
            <div class="app-dialog-mask">
                <div class="app-dialog app-dialog-lg">
                    <button class="app-dialog-close">&times;</button>
                    <h3 class="app-dialog-title">${this.escapeHtml(snippet.name)} - SQL详情</h3>
                    <div class="app-dialog-body">
                        <div style="background: #f8f9fa; border: 1px solid #e8e8e8; border-radius: 6px; padding: 12px; max-height: 400px; overflow-y: auto;">
                            ${sqlList.length === 0
                                ? '<div style="color:#999;text-align:center;padding:20px;">无SQL</div>'
                                : sqlList.map((sql, i) => `
                                    <div style="font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; white-space: pre-wrap; word-break: break-all; padding: 8px; margin-bottom: 8px; background: white; border: 1px solid #e8e8e8; border-radius: 4px;">
                                        <div style="color:#999;font-size:12px;margin-bottom:4px;">SQL #${i + 1}</div>
                                        ${this.escapeHtml(sql)}
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                    <div class="app-dialog-footer">
                        <button class="btn-secondary" id="closeViewBtn">关闭</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);
        wrapper.querySelector('#closeViewBtn').addEventListener('click', () => wrapper.remove());
        wrapper.querySelector('.app-dialog-close').addEventListener('click', () => wrapper.remove());
        wrapper.querySelector('.app-dialog-mask').addEventListener('click', (e) => {
            if (e.target.classList.contains('app-dialog-mask')) wrapper.remove();
        });
    }

    deleteSnippet(id) {
        const snippet = this.snippets.find(s => s.id === id);
        if (!snippet) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'sql-snippet-modal-wrapper';
        wrapper.innerHTML = `
            <div class="app-dialog-mask">
                <div class="app-dialog app-dialog-sm">
                    <h3 class="app-dialog-title">确认删除</h3>
                    <div class="app-dialog-body">
                        <p style="margin: 0; color: #595959;">
                            确定要删除SQL片段 <span style="color:#ef4444;font-weight:600;">${this.escapeHtml(snippet.name)}</span> 吗？
                        </p>
                    </div>
                    <div class="app-dialog-footer">
                        <button class="btn-secondary" id="cancelDeleteBtn">取消</button>
                        <button class="btn-danger" id="confirmDeleteBtn">删除</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);

        wrapper.querySelector('#cancelDeleteBtn').addEventListener('click', () => wrapper.remove());
        wrapper.querySelector('.app-dialog-mask').addEventListener('click', (e) => {
            if (e.target.classList.contains('app-dialog-mask')) wrapper.remove();
        });
        wrapper.querySelector('#confirmDeleteBtn').addEventListener('click', async () => {
            try {
                const result = await window.AppConfig.delete('sqlSnippet', 'delete', { id });
                if (result.code === 200) {
                    this.showMessage('删除成功', 'success');
                    wrapper.remove();
                    await this.loadSnippets();
                } else {
                    this.showMessage(result.message || '删除失败', 'error');
                }
            } catch (error) {
                console.error('删除SQL片段失败:', error);
                this.showMessage('删除失败: ' + error.message, 'error');
            }
        });
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
