class FileSystemBrowser extends HTMLElement {
    constructor() {
        super();
        this.currentPath = '';
        this.currentImageUrl = null;
        this.currentFileName = null;
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
        const parts = fileColumn.split('\\');
        const fileName = parts[parts.length - 2] + '.' + parts[parts.length - 1];
        
        // 根据文件后缀判断文件类型
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
        const isImage = imageExtensions.includes(fileExtension);
        const isVideo = videoExtensions.includes(fileExtension);
        const isMedia = isImage || isVideo;

        if (isMedia && records.length > 0) {
            // 显示媒体预览
            // 如果有多条记录，按照key顺序合并解码后的字节数组
            let binaryData;
            if (records.length > 1) {
                // 按key排序
                const sortedRecords = [...records].sort((a, b) => a.key - b.key);
                // 分别解码每个Base64字符串为Uint8Array，然后合并
                const byteArrays = sortedRecords.map(r => this.base64ToUint8Array(r[fileColumn]));
                // 计算总长度
                const totalLength = byteArrays.reduce((sum, arr) => sum + arr.length, 0);
                // 创建合并后的Uint8Array
                const mergedArray = new Uint8Array(totalLength);
                let offset = 0;
                for (const arr of byteArrays) {
                    mergedArray.set(arr, offset);
                    offset += arr.length;
                }
                // 将合并后的字节数组重新编码为Base64传递给渲染函数
                binaryData = this.uint8ArrayToBase64(mergedArray);
                console.log('合并了', records.length, '条记录的媒体数据，总长度:', totalLength);
            } else {
                binaryData = records[0][fileColumn];
            }

            if (isImage) {
                this.renderImagePreview(binaryData, fileName);
            } else if (isVideo) {
                this.renderVideoPreview(binaryData, fileName);
            }
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

    renderVideoPreview(binaryData, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        try {
            console.log('开始处理视频数据，文件名:', fileName);
            console.log('原始数据长度:', binaryData ? binaryData.length : 'null');

            if (!binaryData || binaryData.length === 0) {
                throw new Error('视频数据为空');
            }

            // 后端现在使用Base64编码，直接解码
            const uint8Array = this.base64ToUint8Array(binaryData);
            console.log('转换后的Uint8Array长度:', uint8Array.length);

            // 根据文件扩展名确定MIME类型
            const fileExtension = fileName.split('.').pop().toLowerCase();
            const mimeTypes = {
                'mp4': 'video/mp4',
                'avi': 'video/x-msvideo',
                'mov': 'video/quicktime',
                'mkv': 'video/x-matroska',
                'webm': 'video/webm',
                'flv': 'video/x-flv',
                'wmv': 'video/x-ms-wmv'
            };
            const mimeType = mimeTypes[fileExtension] || 'video/mp4';
            console.log('使用的MIME类型:', mimeType);

            // 创建Blob
            const blob = new Blob([uint8Array], { type: mimeType });
            console.log('Blob创建成功，大小:', blob.size, 'bytes');

            // 创建ObjectURL
            const videoUrl = URL.createObjectURL(blob);
            console.log('ObjectURL创建成功:', videoUrl);

            // 存储当前视频信息用于下载
            this.currentImageUrl = videoUrl;
            this.currentFileName = fileName;

            // 添加has-preview类以启用全屏预览布局
            fileGrid.classList.add('has-preview');

            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <video src="${videoUrl}" controls class="preview-video"
                               onerror="console.error('视频加载失败'); this.parentElement.innerHTML='<div style=\\'padding: 20px; text-align: center; color: #999;\\'>视频无法显示</div>'">
                        </video>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('视频数据转换失败:', error);
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">视频数据格式错误: ' + error.message + '</div>';
        }
    }

    renderImagePreview(binaryData, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        try {
            console.log('开始处理图片数据，文件名:', fileName);
            console.log('原始数据长度:', binaryData ? binaryData.length : 'null');

            if (!binaryData || binaryData.length === 0) {
                throw new Error('图片数据为空');
            }

            // 后端现在使用Base64编码，直接解码
            const uint8Array = this.base64ToUint8Array(binaryData);
            console.log('转换后的Uint8Array长度:', uint8Array.length);

            // 检查JPEG文件头 (FF D8 FF)
            if (uint8Array.length >= 2) {
                console.log('文件头前两个字节:', uint8Array[0].toString(16), uint8Array[1].toString(16));
                if (uint8Array[0] !== 0xFF || uint8Array[1] !== 0xD8) {
                    console.warn('警告：不是标准的JPEG文件头');
                }
            }

            // 根据文件扩展名确定MIME类型
            const fileExtension = fileName.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp'
            };
            const mimeType = mimeTypes[fileExtension] || 'image/jpeg';
            console.log('使用的MIME类型:', mimeType);

            // 创建Blob
            const blob = new Blob([uint8Array], { type: mimeType });
            console.log('Blob创建成功，大小:', blob.size, 'bytes');

            // 创建ObjectURL
            const imageUrl = URL.createObjectURL(blob);
            console.log('ObjectURL创建成功:', imageUrl);

            // 存储当前图片信息用于下载
            this.currentImageUrl = imageUrl;
            this.currentFileName = fileName;

            // 添加has-preview类以启用全屏预览布局
            fileGrid.classList.add('has-preview');

            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <img src="${imageUrl}" alt="${fileName}" class="preview-image"
                             onload="console.log('图片加载成功')"
                             onerror="console.error('图片加载失败'); this.parentElement.innerHTML='<div style=\\'padding: 20px; text-align: center; color: #999;\\'>图片无法显示</div>'">
                    </div>
                </div>
                <div class="lightbox" id="lightbox" style="display: none;">
                    <div class="lightbox-toolbar">
                        <button class="lightbox-btn" id="zoomOut">-</button>
                        <span class="lightbox-zoom" id="zoomLevel">100%</span>
                        <button class="lightbox-btn" id="zoomIn">+</button>
                        <button class="lightbox-btn lightbox-close" id="lightboxClose">×</button>
                    </div>
                    <div class="lightbox-content-wrapper">
                        <img src="${imageUrl}" alt="${fileName}" class="lightbox-content" id="lightboxImage">
                    </div>
                </div>
            `;

            // 添加图片点击事件，打开浮窗
            const previewImage = fileGrid.querySelector('.preview-image');
            const lightbox = fileGrid.querySelector('#lightbox');
            const lightboxClose = fileGrid.querySelector('#lightboxClose');
            const lightboxImage = fileGrid.querySelector('#lightboxImage');
            const zoomIn = fileGrid.querySelector('#zoomIn');
            const zoomOut = fileGrid.querySelector('#zoomOut');
            const zoomLevel = fileGrid.querySelector('#zoomLevel');

            let currentZoom = 1;

            const updateZoom = () => {
                lightboxImage.style.transform = `scale(${currentZoom})`;
                zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
            };

            if (previewImage && lightbox) {
                previewImage.addEventListener('click', () => {
                    lightbox.style.display = 'flex';
                    currentZoom = 1;
                    updateZoom();
                });
            }

            if (lightboxClose && lightbox) {
                lightboxClose.addEventListener('click', () => {
                    lightbox.style.display = 'none';
                });
            }

            if (lightbox) {
                lightbox.addEventListener('click', (e) => {
                    if (e.target === lightbox) {
                        lightbox.style.display = 'none';
                    }
                });
            }

            if (zoomIn) {
                zoomIn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentZoom = Math.min(currentZoom + 0.25, 5);
                    updateZoom();
                });
            }

            if (zoomOut) {
                zoomOut.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentZoom = Math.max(currentZoom - 0.25, 0.25);
                    updateZoom();
                });
            }
        } catch (error) {
            console.error('图片数据转换失败:', error);
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">图片数据格式错误: ' + error.message + '</div>';
        }
    }

    base64ToUint8Array(base64) {
        // 解码Base64字符串为Uint8Array
        const binaryString = atob(base64);
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
        }
        return uint8Array;
    }

    uint8ArrayToBase64(uint8Array) {
        // 将Uint8Array编码为Base64字符串
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
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
        if (this.currentImageUrl && this.currentFileName) {
            const link = document.createElement('a');
            link.href = this.currentImageUrl;
            link.download = this.currentFileName;
            link.click();
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('文件下载成功', 'success');
            }
        } else {
            if (window.CommonUtils && window.CommonUtils.showToast) {
                window.CommonUtils.showToast('没有可下载的文件', 'error');
            }
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
