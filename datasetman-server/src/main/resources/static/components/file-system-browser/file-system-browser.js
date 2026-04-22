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

        this.loadLibraries();
        this.initEventListeners();
    }

    loadLibraries() {
        // 加载PDF.js
        if (typeof pdfjsLib === 'undefined') {
            const pdfScript = document.createElement('script');
            pdfScript.src = '/lib/pdfjs/pdf.min.js';
            pdfScript.onload = () => {
                console.log('PDF.js加载成功');
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdfjs/pdf.worker.min.js';
            };
            document.head.appendChild(pdfScript);
        }

        // 加载mammoth
        if (typeof mammoth === 'undefined') {
            const mammothScript = document.createElement('script');
            mammothScript.src = '/lib/mammoth/mammoth.browser.min.js';
            mammothScript.onload = () => {
                console.log('mammoth加载成功');
            };
            document.head.appendChild(mammothScript);
        }

        // 加载SheetJS
        if (typeof XLSX === 'undefined') {
            const xlsxScript = document.createElement('script');
            xlsxScript.src = '/lib/xlsx/xlsx.full.min.js';
            xlsxScript.onload = () => {
                console.log('SheetJS加载成功');
            };
            document.head.appendChild(xlsxScript);
        }

        // 加载pptx-preview
        if (typeof pptxPreview === 'undefined') {
            const pptxPreviewScript = document.createElement('script');
            pptxPreviewScript.src = '/lib/pptx-preview/pptx-preview.umd.js';
            pptxPreviewScript.onload = () => {
                console.log('pptx-preview加载成功');
            };
            document.head.appendChild(pptxPreviewScript);
        }
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

        // 显示loading
        const fileGrid = this.querySelector('#fileGrid');
        if (fileGrid) {
            fileGrid.innerHTML = '<div class="loading">加载中...</div>';
        }

        // 调用API获取文件数据
        try {
            // 使用流式查询接口处理大文件，现在返回二进制数据
            const blob = await window.AppConfig.postBinary('data', 'fs/query', {
                paths: [this.currentPath]
            });
            
            // 使用setTimeout让loading有机会渲染
            setTimeout(() => {
                this.renderBinaryPreview(blob, this.currentPath);
            }, 0);
        } catch (error) {
            console.error('查询文件数据失败:', error);
            const fileGrid = this.querySelector('#fileGrid');
            if (fileGrid) {
                fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">网络错误，无法查询数据</div>';
            }
        }

        this.renderBreadcrumb();
    }

    renderBinaryPreview(blob, filePath) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        // 从路径提取文件名
        const fileName = filePath.split('\\').pop().split('/').pop();
        
        // 根据文件后缀判断文件类型
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
        const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
        const textExtensions = ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md', 'log', 'css', 'js', 'java', 'py', 'sql'];
        const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
        const isImage = imageExtensions.includes(fileExtension);
        const isVideo = videoExtensions.includes(fileExtension);
        const isAudio = audioExtensions.includes(fileExtension);
        const isText = textExtensions.includes(fileExtension);
        const isDocument = documentExtensions.includes(fileExtension);
        const isPreviewable = isImage || isVideo || isAudio || isText;

        if (isPreviewable) {
            // 创建预览内容
            fileGrid.classList.add('has-preview');
            
            if (isImage) {
                const imageUrl = URL.createObjectURL(blob);
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-content">
                            <img src="${imageUrl}" alt="${fileName}" style="max-width: 100%; max-height: 600px; object-fit: contain;">
                        </div>
                    </div>
                `;
            } else if (isVideo) {
                // 检查blob大小
                if (blob.size === 0) {
                    console.error('视频数据为空，Blob大小为0字节');
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-content">
                                <div style="color: red; text-align: center; padding: 20px;">
                                    视频数据为空，无法播放。请检查后端日志。
                                </div>
                            </div>
                        </div>
                    `;
                    return;
                }
                
                // 尝试多种MIME类型以提高兼容性
                const mimeTypes = [
                    `video/${fileExtension}`,
                    'video/mp4',
                    'video/webm',
                    'video/ogg',
                    'video/quicktime',
                    'video/x-msvideo',
                    'video/x-matroska'
                ];
                
                const videoBlob = new Blob([blob], { type: mimeTypes[0] });
                const videoUrl = URL.createObjectURL(videoBlob);
                
                // 创建多个source标签以提高兼容性
                let sourcesHtml = mimeTypes.map(type => 
                    `<source src="${videoUrl}" type="${type}">`
                ).join('');
                
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-content">
                            <video id="videoPlayer" controls style="max-width: 100%; max-height: 600px;">
                                ${sourcesHtml}
                                您的浏览器不支持视频播放。
                            </video>
                            <div id="videoError" style="color: red; display: none; margin-top: 10px;"></div>
                            <div id="videoFallback" style="display: none; margin-top: 10px;">
                                <button onclick="window.AppConfig.downloadBlob('${fileName}', '${videoUrl}')" style="padding: 8px 16px; cursor: pointer;">下载视频</button>
                            </div>
                        </div>
                    </div>
                `;
                
                console.log('视频MIME类型尝试:', mimeTypes);
                console.log('视频Blob大小:', blob.size, '字节');
                
                // 添加视频加载错误处理
                const videoElement = document.getElementById('videoPlayer');
                const errorDiv = document.getElementById('videoError');
                
                videoElement.addEventListener('loadstart', () => {
                    console.log('视频开始加载');
                });
                
                videoElement.addEventListener('progress', () => {
                    console.log('视频加载进度:', videoElement.buffered.length > 0 ? videoElement.buffered.end(0) : 0);
                });
                
                videoElement.addEventListener('loadedmetadata', () => {
                    console.log('视频元数据加载成功，时长:', videoElement.duration, '秒');
                    console.log('视频尺寸:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                    console.log('视频当前时间:', videoElement.currentTime);
                    
                    if (videoElement.duration === Infinity || isNaN(videoElement.duration)) {
                        errorDiv.style.display = 'block';
                        errorDiv.textContent = '视频时长无法获取，可能元数据损坏';
                    }
                    
                    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                        errorDiv.style.display = 'block';
                        errorDiv.textContent = '视频尺寸为0，可能视频轨道损坏';
                    }
                });
                
                videoElement.addEventListener('canplay', () => {
                    console.log('视频可以播放');
                });
                
                videoElement.addEventListener('canplaythrough', () => {
                    console.log('视频可以流畅播放');
                });
                
                videoElement.addEventListener('error', (e) => {
                    console.error('视频加载错误:', e);
                    console.error('错误代码:', videoElement.error ? videoElement.error.code : 'unknown');
                    console.error('错误消息:', videoElement.error ? videoElement.error.message : 'unknown');
                    errorDiv.style.display = 'block';
                    errorDiv.textContent = '视频加载失败，可能是不支持的编码格式或文件损坏。请尝试下载后使用本地播放器播放。';
                    document.getElementById('videoFallback').style.display = 'block';
                });
                
                videoElement.addEventListener('stalled', () => {
                    console.warn('视频加载停滞');
                });
                
                videoElement.addEventListener('waiting', () => {
                    console.log('视频缓冲中...');
                });
            } else if (isAudio) {
                const audioUrl = URL.createObjectURL(blob);
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-content">
                            <audio controls style="width: 100%;">
                                <source src="${audioUrl}" type="audio/${fileExtension}">
                                您的浏览器不支持音频播放。
                            </audio>
                        </div>
                    </div>
                `;
            } else if (isText) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const textContent = e.target.result;
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-content">
                                <pre style="white-space: pre-wrap; word-wrap: break-word; max-height: 600px; overflow: auto;">${this.escapeHtml(textContent)}</pre>
                            </div>
                        </div>
                    `;
                };
                reader.readAsText(blob);
            }
        } else if (isDocument) {
            // 文档文件，转换为Uint8Array后调用相应的预览方法
            console.log('处理文档文件，blob类型:', typeof blob, '构造函数:', blob?.constructor?.name);
            
            // 使用Blob的arrayBuffer()方法（Promise-based）转换为ArrayBuffer
            if (blob instanceof Blob) {
                blob.arrayBuffer().then(arrayBuffer => {
                    const uint8Array = new Uint8Array(arrayBuffer);
                    this.handleDocumentPreview(uint8Array, fileExtension, fileName, fileGrid);
                }).catch(error => {
                    console.error('Blob转换为ArrayBuffer失败:', error);
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-content">
                                <div style="color: #999; text-align: center; padding: 20px;">
                                    文件读取失败: ${error.message}
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else if (blob instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(blob);
                this.handleDocumentPreview(uint8Array, fileExtension, fileName, fileGrid);
            } else if (blob instanceof Uint8Array) {
                this.handleDocumentPreview(blob, fileExtension, fileName, fileGrid);
            } else {
                console.error('未知的blob类型:', typeof blob, blob);
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-content">
                            <div style="color: #999; text-align: center; padding: 20px;">
                                文件数据格式错误
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            // 不支持预览的文件类型
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-content">
                        <div style="color: #999; text-align: center; padding: 20px;">
                            此文件类型不支持在线预览
                        </div>
                    </div>
                </div>
            `;
        }
    }

    handleDocumentPreview(uint8Array, fileExtension, fileName, fileGrid) {
        // 检查数据是否为空
        if (!uint8Array || uint8Array.length === 0) {
            console.error('文档数据为空，无法预览');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-content">
                        <div style="color: #999; text-align: center; padding: 20px;">
                            文件数据为空，无法预览。请检查文件是否存在或后端是否正确返回数据。
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        console.log('文档数据长度:', uint8Array.length, '字节');

        // PDF文件使用PDF.js预览
        if (fileExtension === 'pdf') {
            this.renderPdfPreview(uint8Array, fileName);
            return;
        }

        // Word文档使用mammoth预览
        if (fileExtension === 'docx') {
            this.renderDocxPreview(uint8Array, fileName);
            return;
        }

        // Excel文件使用SheetJS预览
        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            this.renderXlsxPreview(uint8Array, fileName);
            return;
        }

        // PowerPoint文件使用PptxViewJS预览
        if (fileExtension === 'pptx' || fileExtension === 'ppt') {
            this.renderPptxPreview(uint8Array, fileName);
            return;
        }

        // 其他文档类型暂不支持在线预览
        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-content">
                    <div style="color: #999; text-align: center; padding: 20px;">
                        此文件类型不支持在线预览
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
        const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
        const textExtensions = ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md', 'log', 'css', 'js', 'java', 'py', 'sql'];
        const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
        const isImage = imageExtensions.includes(fileExtension);
        const isVideo = videoExtensions.includes(fileExtension);
        const isAudio = audioExtensions.includes(fileExtension);
        const isText = textExtensions.includes(fileExtension);
        const isDocument = documentExtensions.includes(fileExtension);
        const isPreviewable = isImage || isVideo || isAudio || isText;

        if (isPreviewable && records.length > 0) {
            // 显示文件预览
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
                console.log('合并了', records.length, '条记录的文件数据，总长度:', totalLength);
            } else {
                binaryData = records[0][fileColumn];
            }

            // 根据文件类型调用相应的预览方法
            if (isImage) {
                this.renderImagePreview(binaryData, fileName);
            } else if (isVideo) {
                this.renderVideoPreview(binaryData, fileName);
            } else if (isAudio) {
                this.renderAudioPreview(binaryData, fileName);
            } else if (isText) {
                this.renderTextPreview(binaryData, fileName);
            }
        } else if (isDocument && records.length > 0) {
            // 文档文件，提供下载提示
            let binaryData;
            if (records.length > 1) {
                const sortedRecords = [...records].sort((a, b) => a.key - b.key);
                const byteArrays = sortedRecords.map(r => this.base64ToUint8Array(r[fileColumn]));
                const totalLength = byteArrays.reduce((sum, arr) => sum + arr.length, 0);
                const mergedArray = new Uint8Array(totalLength);
                let offset = 0;
                for (const arr of byteArrays) {
                    mergedArray.set(arr, offset);
                    offset += arr.length;
                }
                binaryData = this.uint8ArrayToBase64(mergedArray);
                console.log('合并了', records.length, '条记录的文档数据，总长度:', totalLength);
            } else {
                binaryData = records[0][fileColumn];
            }
            this.renderDocumentPreview(binaryData, fileName);
        } else if (records.length > 0) {
            // 不支持在线预览的文件，提供下载提示
            let binaryData;
            if (records.length > 1) {
                const sortedRecords = [...records].sort((a, b) => a.key - b.key);
                const byteArrays = sortedRecords.map(r => this.base64ToUint8Array(r[fileColumn]));
                const totalLength = byteArrays.reduce((sum, arr) => sum + arr.length, 0);
                const mergedArray = new Uint8Array(totalLength);
                let offset = 0;
                for (const arr of byteArrays) {
                    mergedArray.set(arr, offset);
                    offset += arr.length;
                }
                binaryData = this.uint8ArrayToBase64(mergedArray);
                console.log('合并了', records.length, '条记录的文件数据，总长度:', totalLength);
            } else {
                binaryData = records[0][fileColumn];
            }
            this.renderDownloadPreview(binaryData, fileName);
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

    renderAudioPreview(binaryData, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        try {
            console.log('开始处理音频数据，文件名:', fileName);

            if (!binaryData || binaryData.length === 0) {
                throw new Error('音频数据为空');
            }

            const uint8Array = this.base64ToUint8Array(binaryData);
            console.log('转换后的Uint8Array长度:', uint8Array.length);

            const fileExtension = fileName.split('.').pop().toLowerCase();
            const mimeTypes = {
                'mp3': 'audio/mpeg',
                'wav': 'audio/wav',
                'ogg': 'audio/ogg',
                'flac': 'audio/flac',
                'aac': 'audio/aac',
                'm4a': 'audio/mp4'
            };
            const mimeType = mimeTypes[fileExtension] || 'audio/mpeg';

            const blob = new Blob([uint8Array], { type: mimeType });
            const audioUrl = URL.createObjectURL(blob);

            this.currentImageUrl = audioUrl;
            this.currentFileName = fileName;

            fileGrid.classList.add('has-preview');

            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <audio src="${audioUrl}" controls class="preview-audio"
                               onerror="console.error('音频加载失败'); this.parentElement.innerHTML='<div style=\\'padding: 20px; text-align: center; color: #999;\\'>音频无法显示</div>'">
                        </audio>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('音频数据转换失败:', error);
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">音频数据格式错误: ' + error.message + '</div>';
        }
    }

    renderTextPreview(binaryData, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        try {
            console.log('开始处理文本数据，文件名:', fileName);

            if (!binaryData || binaryData.length === 0) {
                throw new Error('文本数据为空');
            }

            const uint8Array = this.base64ToUint8Array(binaryData);
            const decoder = new TextDecoder('utf-8');
            const textContent = decoder.decode(uint8Array);

            this.currentImageUrl = null;
            this.currentFileName = fileName;

            fileGrid.classList.add('has-preview');

            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <pre class="preview-text">${this.escapeHtml(textContent)}</pre>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('文本数据转换失败:', error);
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">文本数据格式错误: ' + error.message + '</div>';
        }
    }

    renderDocumentPreview(binaryData, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        try {
            console.log('开始处理文档数据，文件名:', fileName);

            if (!binaryData || binaryData.length === 0) {
                throw new Error('文档数据为空');
            }

            const uint8Array = this.base64ToUint8Array(binaryData);
            const fileExtension = fileName.split('.').pop().toLowerCase();

            // PDF文件使用PDF.js预览
            if (fileExtension === 'pdf') {
                this.renderPdfPreview(uint8Array, fileName);
                return;
            }

            // Word文档使用mammoth预览
            if (fileExtension === 'docx') {
                this.renderDocxPreview(uint8Array, fileName);
                return;
            }

            // Excel文件使用SheetJS预览
            if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                this.renderXlsxPreview(uint8Array, fileName);
                return;
            }

            // PowerPoint文件使用PptxViewJS预览
            if (fileExtension === 'pptx' || fileExtension === 'ppt') {
                this.renderPptxPreview(uint8Array, fileName);
                return;
            }

            // 其他文档类型（Office等）暂不支持在线预览
            const mimeTypes = {
                'doc': 'application/msword',
                'ppt': 'application/vnd.ms-powerpoint',
                'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            };
            const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';

            const blob = new Blob([uint8Array], { type: mimeType });
            const documentUrl = URL.createObjectURL(blob);

            this.currentImageUrl = documentUrl;
            this.currentFileName = fileName;

            fileGrid.classList.add('has-preview');

            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>此文件类型不支持在线预览</p>
                            <button class="download-btn" id="downloadDocumentBtn">下载文件</button>
                        </div>
                    </div>
                </div>
            `;

            const downloadBtn = fileGrid.querySelector('#downloadDocumentBtn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    this.downloadSelected();
                });
            }
        } catch (error) {
            console.error('文档数据转换失败:', error);
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">文档数据格式错误: ' + error.message + '</div>';
        }
    }

    renderPdfPreview(uint8Array, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        fileGrid.classList.add('has-preview');

        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-header" style="display: flex; align-items: center; justify-content: space-between;">
                    <span class="file-name">${fileName}</span>
                    <div id="pdfPagination" style="display: none; align-items: center;">
                        <button class="toolbar-btn" id="prevPageBtn" style="padding: 4px 12px; margin-right: 8px; border: 1px solid #1976D2; background: #1976D2; color: #fff; cursor: pointer; border-radius: 4px;">上一页</button>
                        <span id="pageInfo" style="margin-right: 8px; font-size: 13px; color: #666;">第 1 页 / 共 1 页</span>
                        <button class="toolbar-btn" id="nextPageBtn" style="padding: 4px 12px; border: 1px solid #1976D2; background: #1976D2; color: #fff; cursor: pointer; border-radius: 4px;">下一页</button>
                    </div>
                </div>
                <div class="preview-content">
                    <div id="pdfContainer" style="width: 100%; height: 600px; overflow: auto; display: flex; justify-content: center;">
                        <div id="pdfLoader" style="display: flex; justify-content: center; align-items: center; height: 100%;">
                            <div style="text-align: center;">
                                <div style="margin-bottom: 10px;">正在加载PDF...</div>
                            </div>
                        </div>
                        <canvas id="pdfCanvas"></canvas>
                    </div>
                </div>
            </div>
        `;

        // 使用PDF.js渲染PDF
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdfjs/pdf.worker.min.js';
            
            // 设置当前文件信息以便下载
            const blob = new Blob([uint8Array], { type: 'application/pdf' });
            this.currentImageUrl = URL.createObjectURL(blob);
            this.currentFileName = fileName;
            
            const loadingTask = pdfjsLib.getDocument(uint8Array);
            loadingTask.promise.then((pdf) => {
                console.log('PDF加载成功，页数:', pdf.numPages);
                
                const pdfLoader = fileGrid.querySelector('#pdfLoader');
                if (pdfLoader) {
                    pdfLoader.style.display = 'none';
                }

                const pdfContainer = fileGrid.querySelector('#pdfContainer');
                const canvas = fileGrid.querySelector('#pdfCanvas');
                const pagination = fileGrid.querySelector('#pdfPagination');
                const pageInfo = fileGrid.querySelector('#pageInfo');
                const prevBtn = fileGrid.querySelector('#prevPageBtn');
                const nextBtn = fileGrid.querySelector('#nextPageBtn');
                
                let currentPage = 1;
                const totalPages = pdf.numPages;
                
                pagination.style.display = 'flex';
                pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
                
                const renderPage = (pageNum) => {
                    pdf.getPage(pageNum).then((page) => {
                        const viewport = page.getViewport({ scale: 1.5 });
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        const renderContext = {
                            canvasContext: canvas.getContext('2d'),
                            viewport: viewport
                        };
                        
                        page.render(renderContext).promise.then(() => {
                            console.log(`PDF第${pageNum}页渲染完成`);
                        }).catch((error) => {
                            console.error('PDF渲染失败:', error);
                        });
                    });
                };
                
                renderPage(currentPage);
                
                prevBtn.addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
                        renderPage(currentPage);
                    }
                });
                
                nextBtn.addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
                        renderPage(currentPage);
                    }
                });
            }).catch((error) => {
                console.error('PDF加载失败:', error);
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-header">
                            <span class="file-name">${fileName}</span>
                        </div>
                        <div class="preview-content">
                            <div class="document-preview-info">
                                <p>PDF加载失败: ${error.message}</p>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            console.error('PDF.js未加载');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>PDF.js库未加载</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    renderDocxPreview(uint8Array, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        fileGrid.classList.add('has-preview');

        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-header">
                    <span class="file-name">${fileName}</span>
                </div>
                <div class="preview-content">
                    <div id="docxContainer" style="width: 100%; height: 600px; overflow: auto;">
                        <div id="docxLoader" style="display: flex; justify-content: center; align-items: center; height: 100%;">
                            <div style="text-align: center;">
                                <div style="margin-bottom: 10px;">正在加载Word文档...</div>
                            </div>
                        </div>
                        <div id="docxViewer" style="padding: 20px; font-family: 'Times New Roman', serif; line-height: 1.6;"></div>
                    </div>
                </div>
            </div>
        `;

        // 使用mammoth渲染Word文档
        if (typeof mammoth !== 'undefined') {
            // 设置当前文件信息以便下载
            const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            this.currentImageUrl = URL.createObjectURL(blob);
            this.currentFileName = fileName;
            
            mammoth.convertToHtml({arrayBuffer: uint8Array})
                .then((result) => {
                    console.log('Word文档渲染完成');
                    const docxLoader = fileGrid.querySelector('#docxLoader');
                    if (docxLoader) {
                        docxLoader.style.display = 'none';
                    }
                    const docxViewer = fileGrid.querySelector('#docxViewer');
                    if (docxViewer) {
                        // 添加样式以改善格式显示
                        const styledHtml = `
                            <style>
                                #docxViewer h1 { font-size: 24px; font-weight: bold; margin: 20px 0 10px 0; color: #333; }
                                #docxViewer h2 { font-size: 20px; font-weight: bold; margin: 18px 0 9px 0; color: #444; }
                                #docxViewer h3 { font-size: 18px; font-weight: bold; margin: 16px 0 8px 0; color: #555; }
                                #docxViewer p { margin: 10px 0; text-align: justify; }
                                #docxViewer table { border-collapse: collapse; width: 100%; margin: 15px 0; }
                                #docxViewer th, #docxViewer td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                #docxViewer th { background-color: #f5f5f5; font-weight: bold; }
                                #docxViewer ul, #docxViewer ol { margin: 10px 0; padding-left: 20px; }
                                #docxViewer li { margin: 5px 0; }
                                #docxViewer strong { font-weight: bold; }
                                #docxViewer em { font-style: italic; }
                                #docxViewer u { text-decoration: underline; }
                            </style>
                            ${result.value}
                        `;
                        docxViewer.innerHTML = styledHtml;
                    }
                })
                .catch((error) => {
                    console.error('Word文档渲染失败:', error);
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-header">
                                <span class="file-name">${fileName}</span>
                            </div>
                            <div class="preview-content">
                                <div class="document-preview-info">
                                    <p>Word文档加载失败: ${error.message}</p>
                                </div>
                            </div>
                        </div>
                    `;
                });
        } else {
            console.error('mammoth库未加载');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>mammoth库未加载</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    renderXlsxPreview(uint8Array, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        fileGrid.classList.add('has-preview');

        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-header">
                    <span class="file-name">${fileName}</span>
                </div>
                <div class="preview-content">
                    <div id="xlsxContainer" style="width: 100%; height: 600px; overflow: auto;">
                        <div id="xlsxLoader" style="display: flex; justify-content: center; align-items: center; height: 100%;">
                            <div style="text-align: center;">
                                <div style="margin-bottom: 10px;">正在加载Excel文件...</div>
                            </div>
                        </div>
                        <div id="xlsxViewer" style="padding: 20px;"></div>
                    </div>
                </div>
            </div>
        `;

        // 使用SheetJS渲染Excel文件
        if (typeof XLSX !== 'undefined') {
            // 设置当前文件信息以便下载
            const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            this.currentImageUrl = URL.createObjectURL(blob);
            this.currentFileName = fileName;
            
            try {
                const workbook = XLSX.read(uint8Array, { type: 'array' });
                const xlsxLoader = fileGrid.querySelector('#xlsxLoader');
                if (xlsxLoader) {
                    xlsxLoader.style.display = 'none';
                }
                const xlsxViewer = fileGrid.querySelector('#xlsxViewer');
                if (xlsxViewer) {
                    // 渲染所有工作表
                    let html = '<div style="margin-bottom: 20px;">';
                    workbook.SheetNames.forEach((sheetName, index) => {
                        const worksheet = workbook.Sheets[sheetName];
                        const htmlTable = XLSX.utils.sheet_to_html(worksheet);
                        html += `
                            <div style="margin-bottom: 30px;">
                                <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #333;">工作表: ${sheetName}</h3>
                                <div style="overflow-x: auto;">
                                    ${htmlTable}
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    
                    // 添加表格样式
                    const styledHtml = `
                        <style>
                            #xlsxViewer table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                            #xlsxViewer th, #xlsxViewer td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
                            #xlsxViewer th { background-color: #f5f5f5; font-weight: bold; }
                            #xlsxViewer tr:nth-child(even) { background-color: #f9f9f9; }
                        </style>
                        ${html}
                    `;
                    xlsxViewer.innerHTML = styledHtml;
                }
            } catch (error) {
                console.error('Excel文件渲染失败:', error);
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-header">
                            <span class="file-name">${fileName}</span>
                        </div>
                        <div class="preview-content">
                            <div class="document-preview-info">
                                <p>Excel文件加载失败: ${error.message}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            console.error('SheetJS库未加载');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>SheetJS库未加载</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    renderPptxPreview(uint8Array, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        fileGrid.classList.add('has-preview');

        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-header">
                    <span class="file-name">${fileName}</span>
                </div>
                <div class="preview-content">
                    <div id="pptxContainer" style="width: 100%; height: 600px; overflow: auto;">
                        <div id="pptxLoader" style="display: flex; justify-content: center; align-items: center; height: 100%;">
                            <div style="text-align: center;">
                                <div style="margin-bottom: 10px;">正在加载PowerPoint文件...</div>
                            </div>
                        </div>
                        <div id="pptxWrapper" style="width: 100%; height: 100%;"></div>
                    </div>
                </div>
            </div>
        `;

        // 使用pptx-preview渲染PowerPoint文件
        if (typeof pptxPreview !== 'undefined' && pptxPreview.init) {
            // 设置当前文件信息以便下载
            const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
            this.currentImageUrl = URL.createObjectURL(blob);
            this.currentFileName = fileName;

            const pptxLoader = fileGrid.querySelector('#pptxLoader');
            const pptxWrapper = fileGrid.querySelector('#pptxWrapper');

            try {
                console.log('开始加载PowerPoint文件，uint8Array长度:', uint8Array.length);

                // 获取ArrayBuffer
                const arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
                console.log('ArrayBuffer长度:', arrayBuffer.byteLength);

                // 初始化pptx-preview预览器
                const pptxPreviewer = pptxPreview.init(pptxWrapper, {
                    width: 960,
                    height: 540
                });

                // 调用preview方法预览文件
                pptxPreviewer.preview(arrayBuffer)
                    .then(() => {
                        console.log('PowerPoint文件加载成功');
                        if (pptxLoader) {
                            pptxLoader.style.display = 'none';
                        }
                    })
                    .catch((error) => {
                        console.error('PowerPoint加载失败:', error);
                        fileGrid.innerHTML = `
                            <div class="file-preview">
                                <div class="preview-header">
                                    <span class="file-name">${fileName}</span>
                                </div>
                                <div class="preview-content">
                                    <div class="document-preview-info">
                                        <p>PowerPoint文件加载失败: ${error.message}</p>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
            } catch (error) {
                console.error('PowerPoint渲染失败:', error);
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-header">
                            <span class="file-name">${fileName}</span>
                        </div>
                        <div class="preview-content">
                            <div class="document-preview-info">
                                <p>PowerPoint文件渲染失败: ${error.message}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            console.error('pptx-preview库未加载');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>pptx-preview库未加载</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    renderDownloadPreview(binaryData, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        try {
            console.log('开始处理文件数据，文件名:', fileName);

            if (!binaryData || binaryData.length === 0) {
                throw new Error('文件数据为空');
            }

            const uint8Array = this.base64ToUint8Array(binaryData);
            const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
            const fileUrl = URL.createObjectURL(blob);

            this.currentImageUrl = fileUrl;
            this.currentFileName = fileName;

            fileGrid.classList.add('has-preview');

            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>此文件类型不支持在线预览</p>
                            <button class="download-btn" id="downloadFileBtn">下载文件</button>
                        </div>
                    </div>
                </div>
            `;

            const downloadBtn = fileGrid.querySelector('#downloadFileBtn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    this.downloadSelected();
                });
            }
        } catch (error) {
            console.error('文件数据转换失败:', error);
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">文件数据格式错误: ' + error.message + '</div>';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

            // 检查文件大小，超过500MB的文件建议下载而非预览（流式查询支持大文件预览）
            const fileSizeMB = (binaryData.length * 0.75) / (1024 * 1024); // Base64编码后约为原始大小的4/3
            if (fileSizeMB > 5000) {
                console.log('文件过大(' + fileSizeMB.toFixed(2) + 'MB)，建议下载而非预览');
                fileGrid.classList.add('has-preview');
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-header">
                            <span class="file-name">${fileName}</span>
                        </div>
                        <div class="preview-content">
                            <div style="color: #999;">文件过大(${fileSizeMB.toFixed(2)}MB)，不支持在线预览</div>
                        </div>
                    </div>
                `;
                
                // 设置下载信息
                const uint8Array = this.base64ToUint8Array(binaryData);
                const blob = new Blob([uint8Array], { type: 'video/mp4' });
                this.currentImageUrl = URL.createObjectURL(blob);
                this.currentFileName = fileName;
                return;
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
