class KeyValueViewer extends HTMLElement {
    constructor() {
        super();
        this.currentPath = '';
    }

    connectedCallback() {
        this.innerHTML = `
            <link rel="stylesheet" href="/components/key-value-viewer/key-value-viewer.css">
            <div class="key-value-viewer">
                <div class="kv-toolbar">
                    <div class="breadcrumb" id="breadcrumb"></div>
                    <div class="toolbar-actions">
                        <button class="toolbar-btn blue" type="button" id="refreshBtn">刷新</button>
                    </div>
                </div>
                <div class="kv-content">
                    <div class="kv-tree" id="kvTree"></div>
                </div>
            </div>

            <div class="modal-mask" id="modalMask" hidden>
                <div class="modal">
                    <div class="modal-header">
                        <span id="modalTitle">提示</span>
                        <button class="modal-close" id="modalClose">×</button>
                    </div>
                    <div class="modal-body" id="modalBody"></div>
                    <div class="modal-footer" id="modalFooter"></div>
                </div>
            </div>
        `;

        this.initEventListeners();
    }

    initEventListeners() {
        const refreshBtn = this.querySelector('#refreshBtn');
        const modalClose = this.querySelector('#modalClose');
        const modalMask = this.querySelector('#modalMask');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadKeys());
        }

        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideModal());
        }

        if (modalMask) {
            modalMask.addEventListener('click', (e) => {
                if (e.target === modalMask) {
                    this.hideModal();
                }
            });
        }
    }

    setPath(path) {
        this.currentPath = path;
        this.hashKeyPath = null;
        this.hashValuePath = null;
        this.wildcardPath = null;
        this.loadKeys();
    }

    setHashPaths(hashKey, hashValue) {
        this.hashKeyPath = hashKey;
        this.hashValuePath = hashValue;
        // 设置父路径为hash节点的路径（去掉.key和.value后缀）
        const parentPath = hashKey.substring(0, hashKey.lastIndexOf('.'));
        this.currentPath = parentPath;
    }

    setWildcardPath(wildcardPath) {
        this.wildcardPath = wildcardPath;
        // 设置父路径为通配符路径去掉*
        this.currentPath = wildcardPath.replace('*', '');
        this.hashKeyPath = null;
        this.hashValuePath = null;
    }

    async loadKeys() {
        console.log('加载键值对数据:', this.currentPath);
        
        // 调用API获取键值对数据
        try {
            let paths = [this.currentPath];
            
            // 如果是通配符路径（hash结构），使用通配符路径
            if (this.wildcardPath) {
                paths = [this.wildcardPath];
            } else if (this.hashKeyPath && this.hashValuePath) {
                // 如果是hash结构，添加key和value路径
                paths = [this.hashKeyPath, this.hashValuePath];
            }
            
            const result = await window.AppConfig.post('data', 'query', {
                paths: paths
            });

            if (result.success && result.data) {
                this.renderQueryResult(result.data);
            } else {
                console.error('查询失败:', result.message);
                const kvTree = this.querySelector('#kvTree');
                if (kvTree) {
                    kvTree.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">查询失败: ' + (result.message || '未知错误') + '</div>';
                }
            }
        } catch (error) {
            console.error('查询键值对数据失败:', error);
            const kvTree = this.querySelector('#kvTree');
            if (kvTree) {
                kvTree.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">网络错误，无法查询数据</div>';
            }
        }

        this.renderBreadcrumb();
    }

    renderQueryResult(data) {
        const kvTree = this.querySelector('#kvTree');
        if (!kvTree) return;

        const { header, records } = data;
        if (!records || records.length === 0) {
            kvTree.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无键值对数据</div>';
            return;
        }

        // 如果是通配符路径（hash结构），将key和value记录合并为hash条目
        if (this.wildcardPath) {
            // 查找以.key和.value结尾的列
            const keyColumn = header.find(h => h.endsWith('.key'));
            const valueColumn = header.find(h => h.endsWith('.value'));
            
            if (keyColumn && valueColumn && records.length > 0) {
                const keys = records.map(record => {
                    const keyValue = record[keyColumn];
                    const valueValue = record[valueColumn];
                    
                    if (keyValue !== undefined && valueValue !== undefined) {
                        return {
                            key: keyValue,
                            type: this.inferType(valueValue),
                            value: valueValue,
                            isHash: true
                        };
                    }
                    return null;
                }).filter(k => k !== null);
                
                if (keys.length > 0) {
                    this.renderKeys(keys);
                    return;
                }
            }
        }

        // 如果是hash结构，将key和value记录合并为hash条目
        if (this.hashKeyPath && this.hashValuePath) {
            // 查找key和value对应的列名（精确匹配）
            const keyColumn = header.find(h => h === this.hashKeyPath);
            const valueColumn = header.find(h => h === this.hashValuePath);
            
            if (keyColumn && valueColumn && records.length > 0) {
                const record = records[0];
                const keyValue = record[keyColumn];
                const valueValue = record[valueColumn];
                
                if (keyValue !== undefined && valueValue !== undefined) {
                    const keys = [{
                        key: keyValue,
                        type: this.inferType(valueValue),
                        value: valueValue,
                        isHash: true
                    }];
                    
                    this.renderKeys(keys);
                    return;
                }
            }
        }

        // 将查询结果转换为键值对格式
        const keys = records.map(record => {
            const key = record.key;
            const valueColumn = header.find(h => h !== 'key');
            const type = this.inferType(record[valueColumn]);
            return {
                key: key,
                type: type,
                value: record[valueColumn]
            };
        });

        this.renderKeys(keys);
    }

    inferType(value) {
        if (typeof value === 'string') {
            if (value.startsWith('{') || value.startsWith('[')) return 'json';
            return 'string';
        }
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        return 'unknown';
    }

    renderKeys(keys) {
        const kvTree = this.querySelector('#kvTree');
        if (!kvTree) return;

        kvTree.innerHTML = keys.map(kv => `
            <div class="kv-item ${kv.isHash ? 'kv-hash' : ''}" data-key="${kv.key}" data-type="${kv.type}" data-value="${this.escapeHtml(String(kv.value))}">
                <button class="kv-copy-btn kv-type-badge ${kv.type}" title="复制">复制</button>
                <div class="kv-item-header">
                    ${kv.isHash ? '<div class="kv-hash-icon">🔑</div>' : ''}
                    <div class="kv-key">${this.escapeHtml(kv.key)}</div>
                </div>
                <div class="kv-value">${this.formatValue(kv.value)}</div>
            </div>
        `).join('');

        // 添加点击事件
        kvTree.querySelectorAll('.kv-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('kv-copy-btn')) return;
                const key = item.getAttribute('data-key');
                const type = item.getAttribute('data-type');
                console.log('点击键值对:', key, type);
            });
        });

        // 添加复制按钮事件
        kvTree.querySelectorAll('.kv-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = e.target.closest('.kv-item').getAttribute('data-value');
                this.copyToClipboard(value);
                this.showToast('已复制到剪贴板');
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('复制失败:', err);
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    }

    showToast(message) {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(message, 'success');
        } else {
            const toast = document.createElement('div');
            toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #333;
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            font-size: 14px;
        `;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        }
    }

    formatValue(value) {
        if (typeof value === 'string' && value.length > 100) {
            return value.substring(0, 100) + '...';
        }
        return String(value);
    }

    renderBreadcrumb() {
        const breadcrumb = this.querySelector('#breadcrumb');
        if (!breadcrumb) return;

        const parts = this.currentPath.split('.');
        const breadcrumbHtml = parts.map((part, index) => {
            const isLast = index === parts.length - 1;
            if (isLast) {
                return `<span class="breadcrumb-item">${part}</span>`;
            }
            return `<span class="breadcrumb-item">${part}</span><span class="breadcrumb-separator">/</span>`;
        }).join('');

        breadcrumb.innerHTML = breadcrumbHtml;
    }

    showModal(title, content, buttons = []) {
        const modalMask = this.querySelector('#modalMask');
        const modalTitle = this.querySelector('#modalTitle');
        const modalBody = this.querySelector('#modalBody');
        const modalFooter = this.querySelector('#modalFooter');

        if (!modalMask || !modalTitle || !modalBody || !modalFooter) return;

        modalTitle.textContent = title;
        modalBody.innerHTML = content;

        modalFooter.innerHTML = buttons.map(btn => `
            <button class="modal-btn ${btn.class}" data-action="${btn.text}">${btn.text}</button>
        `).join('');

        modalFooter.querySelectorAll('.modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const buttonText = btn.getAttribute('data-action');
                const button = buttons.find(b => b.text === buttonText);
                if (button && button.onClick) {
                    button.onClick();
                }
            });
        });

        modalMask.hidden = false;
    }

    hideModal() {
        const modalMask = this.querySelector('#modalMask');
        if (modalMask) {
            modalMask.hidden = true;
        }
    }

    show(path) {
        this.style.display = 'block';
        if (path) {
            this.setPath(path);
        } else {
            this.loadKeys();
        }
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('key-value-viewer', KeyValueViewer);
