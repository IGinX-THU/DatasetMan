class SemiStructuredViewer extends HTMLElement {
    constructor() {
        super();
        this.currentPath = '';
    }

    connectedCallback() {
        this.innerHTML = `
            <link rel="stylesheet" href="/components/semi-structured-viewer/semi-structured-viewer.css">
            <div class="semi-structured-viewer">
                <div class="ss-toolbar">
                    <div class="breadcrumb" id="breadcrumb"></div>
                    <div class="toolbar-actions">
                        <button class="toolbar-btn green" type="button" id="copyBtn">复制</button>
                        <button class="toolbar-btn blue" type="button" id="refreshBtn">刷新</button>
                    </div>
                </div>
                <div class="ss-content">
                    <div class="ss-list" id="ssList"></div>
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
        const copyBtn = this.querySelector('#copyBtn');
        const modalClose = this.querySelector('#modalClose');
        const modalMask = this.querySelector('#modalMask');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadDocuments());
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (this.currentDocument) {
                    const jsonStr = JSON.stringify(this.currentDocument, null, 2);
                    this.copyToClipboard(jsonStr);
                }
            });
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
        // 获取当前 path 下的所有子节点路径
        this.childPaths = this.getChildPathsFromTree(path);
        this.loadDocuments();
    }

    getChildPathsFromTree(path) {
        const paths = [];
        const leftSidebarTree = document.querySelector('.left-sidebar .tree');
        if (!leftSidebarTree) return paths;

        // 查找匹配当前 path 的节点（叶子节点）
        const allNodes = leftSidebarTree.querySelectorAll('.tree-node');
        let leafNode = null;
        for (const node of allNodes) {
            const fullPath = node.getAttribute('data-full-path');
            if (fullPath === path) {
                leafNode = node;
                break;
            }
        }

        if (!leafNode) {
            console.log('未找到叶子节点:', path);
            return paths;
        }

        // 获取叶子节点的父节点
        const parentNode = leafNode.closest('.tree-children')?.parentElement;
        if (!parentNode) {
            console.log('未找到父节点');
            return paths;
        }

        // 获取父节点的所有子节点
        const children = parentNode.querySelectorAll('.tree-node');
        children.forEach(child => {
            const childPath = child.getAttribute('data-full-path');
            if (childPath) {
                paths.push(childPath);
            }
        });

        console.log('获取父节点的所有子节点:', path, '子节点:', paths);
        return paths;
    }

    async loadDocuments() {
        console.log('加载半结构化数据:', this.currentPath, '子节点路径:', this.childPaths);
        
        // 调用API获取文档数据，使用所有子节点路径
        if (!this.childPaths || this.childPaths.length === 0) {
            const ssList = this.querySelector('#ssList');
            if (ssList) {
                ssList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无子节点</div>';
            }
            this.renderBreadcrumb();
            return;
        }

        try {
            const result = await window.AppConfig.post('data', 'query', {
                paths: this.childPaths
            });

            if (result.success && result.data) {
                this.renderQueryResult(result.data);
            } else {
                console.error('查询失败:', result.message);
                const ssList = this.querySelector('#ssList');
                if (ssList) {
                    ssList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">查询失败: ' + (result.message || '未知错误') + '</div>';
                }
            }
        } catch (error) {
            console.error('查询文档数据失败:', error);
            const ssList = this.querySelector('#ssList');
            if (ssList) {
                ssList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">网络错误，无法查询数据</div>';
            }
        }

        this.renderBreadcrumb();
    }

    flattenToNested(flatObj) {
        const result = {};
        for (const key in flatObj) {
            if (key === 'key') continue; // Skip the key field
            
            // Remove the prefix 'semi_structured.myDatabase.users.'
            const fieldPath = key.replace(/^semi_structured\.[^.]+\.[^.]+\./, '');
            
            // Split by dots and build nested structure
            const parts = fieldPath.split('.');
            let current = result;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    // Last part, set the value
                    current[part] = flatObj[key];
                } else {
                    // Not the last part, create or get nested object
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part];
                }
            }
        }
        return result;
    }

    renderQueryResult(data) {
        const ssList = this.querySelector('#ssList');
        if (!ssList) return;

        const { header, records } = data;
        if (!records || records.length === 0) {
            ssList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无文档数据</div>';
            return;
        }

        // 将查询结果转换为文档格式，并转换为嵌套结构，同时保留key
        const documents = records.map(record => {
            const key = record.key;
            const nestedDoc = this.flattenToNested(record);
            return { key, doc: nestedDoc };
        });

        this.renderDocuments(documents);
    }

    renderDocuments(documents) {
        const ssList = this.querySelector('#ssList');
        if (!ssList) return;

        // 只取第一个文档
        const { key, doc } = documents[0];
        if (!doc) {
            ssList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无文档数据</div>';
            return;
        }

        // 存储当前文档用于复制
        this.currentDocument = doc;

        const jsonStr = JSON.stringify(doc, null, 2);

        ssList.innerHTML = `
            <div class="ss-item" data-id="${key}">
                <div class="ss-header">
                    <div class="ss-id">${key !== undefined ? `Document (${key})` : 'Document'}</div>
                </div>
                <div class="ss-content">
                    <pre class="json-viewer">${this.escapeHtml(jsonStr)}</pre>
                </div>
            </div>
        `;
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('复制成功', 'success');
            } else {
                alert('复制成功');
            }
        }).catch(err => {
            console.error('复制失败:', err);
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('复制失败', 'error');
            } else {
                alert('复制失败');
            }
        });
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    formatValue(value) {
        if (typeof value === 'string' && value.length > 100) {
            return value.substring(0, 100) + '...';
        }
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value).substring(0, 100) + '...';
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
            this.loadDocuments();
        }
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('semi-structured-viewer', SemiStructuredViewer);
