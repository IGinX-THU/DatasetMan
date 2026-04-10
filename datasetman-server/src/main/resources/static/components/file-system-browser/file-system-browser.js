class FileSystemBrowser extends HTMLElement {
    constructor() {
        super();
        this.currentPath = '';
    }

    connectedCallback() {
        this.innerHTML = `
            <link rel="stylesheet" href="/components/file-system-browser/file-system-browser.css">
            <div class="file-browser">
                <div class="file-toolbar">
                    <div class="breadcrumb" id="breadcrumb"></div>
                    <div class="toolbar-actions">
                        <button class="toolbar-btn blue" type="button" id="refreshBtn">刷新</button>
                        <button class="toolbar-btn green" type="button" id="downloadBtn">下载</button>
                    </div>
                </div>
                <div class="file-content">
                    <div class="file-grid" id="fileGrid"></div>
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
        const downloadBtn = this.querySelector('#downloadBtn');
        const modalClose = this.querySelector('#modalClose');
        const modalMask = this.querySelector('#modalMask');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadFiles());
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadSelected());
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
        this.loadFiles();
    }

    async loadFiles() {
        console.log('加载文件系统数据:', this.currentPath);
        
        // 调用API获取文件数据
        try {
            const result = await window.AppConfig.post('data', 'query', {
                paths: [this.currentPath]
            });

            if (result.success && result.data) {
                this.renderQueryResult(result.data);
            } else {
                console.error('查询失败:', result.message);
                const fileGrid = this.querySelector('#fileGrid');
                if (fileGrid) {
                    fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">查询失败: ' + (result.message || '未知错误') + '</div>';
                }
            }
        } catch (error) {
            console.error('查询文件数据失败:', error);
            const fileGrid = this.querySelector('#fileGrid');
            if (fileGrid) {
                fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">网络错误，无法查询数据</div>';
            }
        }

        this.renderBreadcrumb();
    }

    renderQueryResult(data) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        const { header, records } = data;
        if (!records || records.length === 0) {
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无文件数据</div>';
            return;
        }

        // 获取文件名列（排除key列）
        const fileColumn = header.find(h => h !== 'key');
        if (!fileColumn) {
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">数据格式错误</div>';
            return;
        }

        // 从列名中提取文件名（例如：file_system.images.win10\jpg -> win10.jpg）
        const fileName = fileColumn.split('\\').pop().replace('\\', '.');
        
        // 根据文件后缀判断是否为图片
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const isImage = imageExtensions.includes(fileExtension);

        if (isImage && records.length > 0) {
            // 显示图片预览
            const binaryData = records[0][fileColumn];
            this.renderImagePreview(binaryData, fileName);
        } else {
            // 显示文件列表
            const files = records.map(record => ({
                name: fileName,
                type: 'file',
                size: 'N/A'
            }));
            this.renderFiles(files);
        }
    }

    renderImagePreview(binaryData, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        try {
            // 将二进制字符串转换为Uint8Array
            const uint8Array = this.stringToUint8Array(binaryData);
            
            // 创建Blob
            const blob = new Blob([uint8Array], { type: 'image/jpeg' });
            
            // 创建ObjectURL
            const imageUrl = URL.createObjectURL(blob);

            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <img src="${imageUrl}" alt="${fileName}" style="max-width: 100%; max-height: 600px; border-radius: 8px;">
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('图片数据转换失败:', error);
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">图片数据格式错误</div>';
        }
    }

    stringToUint8Array(str) {
        // 后端使用 new String(bytes, StandardCharsets.UTF_8) 返回
        // 由于二进制数据不是有效的UTF-8，需要逐个字符获取charCodeAt来恢复原始字节
        const uint8Array = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            uint8Array[i] = str.charCodeAt(i) & 0xFF;
        }
        return uint8Array;
    }

    renderFiles(files) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        fileGrid.innerHTML = files.map(file => `
            <div class="file-item" data-name="${file.name}">
                <div class="file-icon">${this.getFileIcon(file.type)}</div>
                <div class="file-name">${file.name}</div>
                <div class="file-size">${file.size}</div>
            </div>
        `).join('');

        // 添加点击事件
        fileGrid.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => {
                const fileName = item.getAttribute('data-name');
                console.log('点击文件:', fileName);
            });
        });
    }

    getFileIcon(type) {
        if (type === 'folder') return '📁';
        if (type === 'file') return '📄';
        return '📄';
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

    downloadSelected() {
        console.log('下载文件');
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast('文件下载成功', 'success');
        }
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
            this.loadFiles();
        }
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('file-system-browser', FileSystemBrowser);
