class FileSystemBrowser extends HTMLElement {
    constructor() {
        super();
        this.currentPath = '';
        this.currentImageUrl = null;
        this.currentFileName = null;
        this.currentVideoPlayer = null;
        this.videoJsLoaded = false;
    }

    loadVideoJs(callback) {
        if (this.videoJsLoaded && typeof videojs !== 'undefined') {
            callback();
            return;
        }

        // 加载video.js CSS
        if (!document.querySelector('link[href*="video-js.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/lib/videojs/video-js.css';
            document.head.appendChild(cssLink);
        }

        // 加载video.js JS
        if (!document.querySelector('script[src*="video.min.js"]')) {
            const script = document.createElement('script');
            script.src = '/lib/videojs/video.min.js';
            script.onload = () => {
                this.videoJsLoaded = true;
                callback();
            };
            script.onerror = () => {
                console.error('video.js加载失败，回退到原生播放器');
                callback();
            };
            document.head.appendChild(script);
        } else {
            this.videoJsLoaded = true;
            callback();
        }
    }

    cleanupVideoPlayer() {
        if (this.currentVideoPlayer) {
            try {
                this.currentVideoPlayer.dispose();
            } catch (e) {
                console.error('清理video.js播放器失败:', e);
            }
            this.currentVideoPlayer = null;
        }
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

        // 加载JSZip (docx-preview依赖)
        if (typeof JSZip === 'undefined') {
            const jszipScript = document.createElement('script');
            jszipScript.src = '/lib/jszip/jszip.min.js';
            jszipScript.onload = () => {
                console.log('JSZip加载成功');
                // JSZip加载完成后，再加载docx-preview
                if (typeof docx === 'undefined') {
                    const docxPreviewScript = document.createElement('script');
                    docxPreviewScript.src = '/lib/docx-preview/docx-preview.min.js';
                    docxPreviewScript.onload = () => {
                        console.log('docx-preview加载成功');
                    };
                    document.head.appendChild(docxPreviewScript);
                }
            };
            document.head.appendChild(jszipScript);
        } else {
            // JSZip已加载，直接加载docx-preview
            if (typeof docx === 'undefined') {
                const docxPreviewScript = document.createElement('script');
                docxPreviewScript.src = '/lib/docx-preview/docx-preview.min.js';
                docxPreviewScript.onload = () => {
                    console.log('docx-preview加载成功');
                };
                document.head.appendChild(docxPreviewScript);
            }
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

        // 清理之前的video.js播放器
        this.cleanupVideoPlayer();

        // 从路径提取文件名（例如：file_system.fs.video.zkfdv4\mp4 -> zkfdv4.mp4）
        // 支持反斜杠和正斜杠分隔符
        const pathParts = filePath.replace(/\//g, '\\').split('\\');
        
        let fileName;
        if (pathParts.length >= 2) {
            const namePart = pathParts[pathParts.length - 2];
            const extPart = pathParts[pathParts.length - 1];
            // namePart可能是file_system.fs.video.zkfdv4，需要取最后一部分
            const nameParts = namePart.split('.');
            const actualName = nameParts[nameParts.length - 1];
            fileName = actualName + '.' + extPart;
        } else {
            // 如果没有分隔符，尝试从最后一个点分割
            const lastDotIndex = filePath.lastIndexOf('.');
            if (lastDotIndex > 0) {
                const namePart = filePath.substring(0, lastDotIndex);
                const extPart = filePath.substring(lastDotIndex + 1);
                const nameParts = namePart.split('.');
                const actualName = nameParts[nameParts.length - 1];
                fileName = actualName + '.' + extPart;
            } else {
                fileName = filePath;
            }
        }
        
        // 根据文件后缀判断文件类型
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
        const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
        const textExtensions = ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md', 'log', 'css', 'js', 'java', 'py', 'sql'];
        const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
        const cadExtensions = ['dxf'];
        const isImage = imageExtensions.includes(fileExtension);
        const isVideo = videoExtensions.includes(fileExtension);
        const isAudio = audioExtensions.includes(fileExtension);
        const isText = textExtensions.includes(fileExtension);
        const isDocument = documentExtensions.includes(fileExtension);
        const isCad = cadExtensions.includes(fileExtension);
        const isCsv = fileExtension === 'csv';
        const isPreviewable = isImage || isVideo || isAudio || isText || isCad;

        if (isPreviewable) {
            // 创建预览内容
            fileGrid.classList.add('has-preview');
            
            if (isImage) {
                const imageUrl = URL.createObjectURL(blob);
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-header">
                            <span class="file-name">${fileName}</span>
                        </div>
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
                                    视频数据为空，无法播放。
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
                
                // 存储当前视频信息用于下载
                this.currentImageUrl = videoUrl;
                this.currentFileName = fileName;
                
                // 使用video.js播放器
                this.loadVideoJs(() => {
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-header">
                                <span class="file-name">${fileName}</span>
                            </div>
                            <div class="preview-content">
                                <video id="videoPlayer" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto">
                                    <source src="${videoUrl}" type="${mimeTypes[0]}">
                                    您的浏览器不支持视频播放。
                                </video>
                                <div id="videoError" style="color: red; display: none; margin-top: 10px;"></div>
                            </div>
                        </div>
                    `;
                    
                    console.log('视频MIME类型尝试:', mimeTypes);
                    console.log('视频Blob大小:', blob.size, '字节');
                    
                    // 初始化video.js播放器
                    const player = videojs('videoPlayer', {
                        fluid: false,
                        responsive: false,
                        playbackRates: [0.5, 1, 1.5, 2],
                        html5: {
                            vhs: {
                                overrideNative: true
                            },
                            nativeAudioTracks: false,
                            nativeVideoTracks: false
                        },
                        errorDisplay: true
                    });
                    
                    const errorDiv = document.getElementById('videoError');
                    
                    // video.js错误处理
                    player.on('error', () => {
                        const error = player.error();
                        console.error('Video.js错误:', error);
                        errorDiv.style.display = 'block';
                        errorDiv.innerHTML = `
                            <div style="margin-bottom: 10px;">
                                <strong>视频加载失败</strong>
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                错误代码: ${error ? error.code : 'unknown'}<br>
                                错误消息: ${error ? error.message : 'unknown'}<br>
                                可能原因：视频编码格式不被浏览器支持或文件损坏。<br>
                                建议使用工具栏下载按钮下载后，使用本地播放器（如VLC、PotPlayer）播放。
                            </div>
                        `;
                    });
                    
                    player.on('loadedmetadata', () => {
                        console.log('视频元数据加载成功，时长:', player.duration(), '秒');
                        console.log('视频尺寸:', player.videoWidth(), 'x', player.videoHeight());
                        
                        let hasError = false;
                        let errorMessages = [];
                        
                        if (player.duration() === Infinity || isNaN(player.duration())) {
                            hasError = true;
                            errorMessages.push('视频时长无法获取');
                        }
                        
                        if (player.videoWidth() === 0 || player.videoHeight() === 0) {
                            hasError = true;
                            errorMessages.push('视频尺寸为0，可能视频编码格式不被浏览器支持');
                        }
                        
                        if (hasError) {
                            errorDiv.style.display = 'block';
                            errorDiv.innerHTML = `
                                <div style="margin-bottom: 10px;">
                                    <strong>视频播放问题：</strong>${errorMessages.join('，')}
                                </div>
                                <div style="font-size: 12px; color: #666;">
                                    可能原因：视频编码格式（如H.265/HEVC、MPEG-2等）不被浏览器支持。<br>
                                    建议使用工具栏下载按钮下载后，使用本地播放器（如VLC、PotPlayer）播放。
                                </div>
                            `;
                        }
                    });
                    
                    // 保存player实例以便清理
                    this.currentVideoPlayer = player;
                });
            } else if (isAudio) {
                const audioUrl = URL.createObjectURL(blob);
                fileGrid.innerHTML = `
                    <div class="file-preview">
                        <div class="preview-header">
                            <span class="file-name">${fileName}</span>
                        </div>
                        <div class="preview-content">
                            <audio controls style="width: 100%;">
                                <source src="${audioUrl}" type="audio/${fileExtension}">
                                您的浏览器不支持音频播放。
                            </audio>
                        </div>
                    </div>
                `;
            } else if (isCsv) {
                // CSV：表格 / 文本 双 Tab 预览
                const readCsvArray = (blob instanceof Blob) ? blob.arrayBuffer()
                    : Promise.resolve((blob instanceof ArrayBuffer) ? blob : blob.buffer);
                readCsvArray.then(arrayBuffer => {
                    this.renderCsvPreview(new Uint8Array(arrayBuffer), fileName);
                }).catch(error => {
                    console.error('CSV数据读取失败:', error);
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-content">
                                <div style="color: #999; text-align: center; padding: 20px;">
                                    CSV读取失败: ${error.message}
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else if (isText) {
                const textUrl = URL.createObjectURL(blob);
                this.currentImageUrl = textUrl;
                this.currentFileName = fileName;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const textContent = e.target.result;
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-header">
                                <span class="file-name">${fileName}</span>
                            </div>
                            <div class="preview-content">
                                <pre style="white-space: pre-wrap; word-wrap: break-word; max-height: 600px; overflow: auto;">${this.escapeHtml(textContent)}</pre>
                            </div>
                        </div>
                    `;
                };
                reader.readAsText(blob);
            } else if (isCad) {
                // CAD 图纸（DXF）：解析图元渲染为 SVG 预览
                const readAsArray = (blob instanceof Blob) ? blob.arrayBuffer()
                    : Promise.resolve((blob instanceof ArrayBuffer) ? blob : blob.buffer);
                readAsArray.then(arrayBuffer => {
                    this.renderDxfPreview(new Uint8Array(arrayBuffer), fileName);
                }).catch(error => {
                    console.error('CAD图纸数据读取失败:', error);
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-content">
                                <div style="color: #999; text-align: center; padding: 20px;">
                                    CAD图纸读取失败: ${error.message}
                                </div>
                            </div>
                        </div>
                    `;
                });
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
        const cadExtensions = ['dxf'];
        const isImage = imageExtensions.includes(fileExtension);
        const isVideo = videoExtensions.includes(fileExtension);
        const isAudio = audioExtensions.includes(fileExtension);
        const isText = textExtensions.includes(fileExtension);
        const isDocument = documentExtensions.includes(fileExtension);
        const isCad = cadExtensions.includes(fileExtension);
        const isCsv = fileExtension === 'csv';
        const isPreviewable = isImage || isVideo || isAudio || isText || isCad;

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
            } else if (isCsv) {
                this.renderCsvPreview(this.base64ToUint8Array(binaryData), fileName);
            } else if (isCad) {
                this.renderDxfPreview(this.base64ToUint8Array(binaryData), fileName);
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
                        <div id="docxViewer" style="padding: 20px;"></div>
                    </div>
                </div>
            </div>
        `;

        // 使用docx-preview渲染Word文档
        if (typeof docx !== 'undefined') {
            // 设置当前文件信息以便下载
            const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            this.currentImageUrl = URL.createObjectURL(blob);
            this.currentFileName = fileName;
            
            const docxViewer = fileGrid.querySelector('#docxViewer');
            const docxLoader = fileGrid.querySelector('#docxLoader');
            
            docx.renderAsync(uint8Array, docxViewer, null, {
                className: 'docx-preview',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                ignoreFonts: false,
                breakPages: true,
                useBase64URL: true
            }).then(() => {
                console.log('Word文档渲染完成');
                if (docxLoader) {
                    docxLoader.style.display = 'none';
                }
            }).catch((error) => {
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
            console.error('docx-preview库未加载');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>docx-preview库未加载</p>
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

    // ===== CAD 图纸（DXF）预览 =====

    aciColor(index) {
        // AutoCAD 颜色索引（ACI）常用色映射，其余按索引散布到色环
        const map = { 0: '#1A1A1A', 1: '#E53935', 2: '#FDD835', 3: '#43A047', 4: '#00ACC1', 5: '#1E88E5', 6: '#8E24AA', 7: '#1A1A1A', 8: '#757575', 9: '#BDBDBD' };
        const idx = Math.abs(parseInt(index, 10) || 7);
        if (map[idx] !== undefined) return map[idx];
        return `hsl(${(idx * 47) % 360}, 55%, 38%)`;
    }

    escapeXml(text) {
        return String(text).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
    }

    parseDxf(text) {
        // DXF 按组码对组织：奇数行组码、偶数行值。解析 TABLES 的图层颜色与
        // ENTITIES 的常用图元（LINE/CIRCLE/ARC/TEXT/MTEXT/POINT/POLYLINE+VERTEX/LWPOLYLINE/SPLINE）
        const lines = String(text).split(/\r\n|\r|\n/);
        const groups = [];
        for (let i = 0; i + 1 < lines.length; i += 2) {
            groups.push([lines[i].trim(), lines[i + 1]]);
        }
        const num = v => parseFloat(v);
        const layers = {};
        const entities = [];
        const unsupported = {};
        let i = 0;
        let curPolyline = null;
        while (i < groups.length) {
            if (groups[i][0] === '0' && String(groups[i][1]).trim() === 'SECTION') {
                let j = i + 1;
                while (j < groups.length && groups[j][0] !== '2') j++;
                const section = j < groups.length ? String(groups[j][1]).trim().toUpperCase() : '';
                i = j + 1;
                if (section === 'ENTITIES') {
                    while (i < groups.length && !(groups[i][0] === '0' && String(groups[i][1]).trim() === 'ENDSEC')) {
                        if (groups[i][0] !== '0') { i++; continue; }
                        const type = String(groups[i][1]).trim().toUpperCase();
                        const props = {};
                        const xs = [], ys = [];
                        let k = i + 1;
                        while (k < groups.length && groups[k][0] !== '0') {
                            const [c, raw] = groups[k];
                            if (c === '10') xs.push(num(raw));
                            else if (c === '20') ys.push(num(raw));
                            else if (!(c in props)) props[c] = raw;
                            k++;
                        }
                        i = k;
                        if (type === 'VERTEX' && curPolyline) {
                            curPolyline.points.push([xs[0], ys[0]]);
                            continue;
                        }
                        if (type === 'SEQEND') { curPolyline = null; continue; }
                        const layer = String(props['8'] || '0').trim();
                        const color = this.aciColor(props['62'] !== undefined ? props['62'] : (layers[layer] !== undefined ? layers[layer] : 7));
                        if (type === 'LINE') {
                            entities.push({ type, color, x1: xs[0], y1: ys[0], x2: num(props['11']), y2: num(props['21']) });
                        } else if (type === 'CIRCLE') {
                            entities.push({ type, color, x: xs[0], y: ys[0], r: num(props['40']) });
                        } else if (type === 'ARC') {
                            entities.push({ type, color, x: xs[0], y: ys[0], r: num(props['40']), a1: num(props['50']) || 0, a2: num(props['51']) || 0 });
                        } else if (type === 'TEXT' || type === 'MTEXT') {
                            const content = String(props['1'] || '').replace(/\\[A-Za-z]+[^;\\]*;/g, '').replace(/[{}]/g, '');
                            entities.push({ type: 'TEXT', color, x: xs[0], y: ys[0], h: num(props['40']) || 0, rot: num(props['50']) || 0, text: content });
                        } else if (type === 'POINT') {
                            entities.push({ type, color, x: xs[0], y: ys[0] });
                        } else if (type === 'POLYLINE') {
                            const e = { type, color, points: [], closed: (parseInt(props['70'], 10) || 0) & 1 };
                            entities.push(e);
                            curPolyline = e;
                        } else if (type === 'LWPOLYLINE' || type === 'SPLINE') {
                            // LWPOLYLINE 重复组码 10/20；SPLINE 用控制点折线近似
                            if (xs.length >= 2) {
                                const pts = [];
                                for (let p = 0; p < Math.min(xs.length, ys.length); p++) pts.push([xs[p], ys[p]]);
                                entities.push({ type: 'POLYLINE', color, points: pts, closed: type === 'LWPOLYLINE' && ((parseInt(props['70'], 10) || 0) & 1) });
                            }
                        } else {
                            unsupported[type] = (unsupported[type] || 0) + 1;
                        }
                    }
                    i++;
                } else if (section === 'TABLES') {
                    let curLayer = null;
                    while (i < groups.length && !(groups[i][0] === '0' && String(groups[i][1]).trim() === 'ENDSEC')) {
                        const [c, raw] = groups[i];
                        const t = String(raw).trim();
                        if (c === '0') {
                            curLayer = (t === 'LAYER') ? { name: '', color: 7 } : null;
                        } else if (curLayer) {
                            if (c === '2') curLayer.name = t;
                            else if (c === '62') curLayer.color = Math.abs(parseInt(raw, 10) || 7);
                        }
                        if (curLayer && curLayer.name) layers[curLayer.name] = curLayer.color;
                        i++;
                    }
                    i++;
                } else {
                    while (i < groups.length && !(groups[i][0] === '0' && String(groups[i][1]).trim() === 'ENDSEC')) i++;
                    i++;
                }
            } else {
                i++;
            }
        }
        return { entities, unsupported };
    }

    buildDxfSvg(parsed) {
        const xs = [], ys = [];
        for (const e of parsed.entities) {
            if (e.type === 'LINE') { xs.push(e.x1, e.x2); ys.push(e.y1, e.y2); }
            else if (e.type === 'CIRCLE' || e.type === 'ARC') { xs.push(e.x - e.r, e.x + e.r); ys.push(e.y - e.r, e.y + e.r); }
            else if (e.type === 'TEXT') { xs.push(e.x, e.x + e.text.length * (e.h || 1)); ys.push(e.y, e.y + (e.h || 1)); }
            else if (e.type === 'POINT') { xs.push(e.x); ys.push(e.y); }
            else if (e.type === 'POLYLINE') { for (const p of e.points) { xs.push(p[0]); ys.push(p[1]); } }
        }
        const clean = arr => arr.filter(isFinite);
        if (!clean(xs).length || !clean(ys).length) return null;
        const minX = Math.min(...clean(xs)), maxX = Math.max(...clean(xs));
        const minY = Math.min(...clean(ys)), maxY = Math.max(...clean(ys));
        const w = Math.max(maxX - minX, 1e-6), h = Math.max(maxY - minY, 1e-6);
        const vbX = minX - w * 0.05, vbY = minY - h * 0.05, vbW = w * 1.1, vbH = h * 1.1;
        const f = n => Math.round(n * 1000) / 1000;
        const shapes = [], texts = [];
        for (const e of parsed.entities) {
            const st = `stroke="${e.color}"`;
            if (e.type === 'LINE') {
                shapes.push(`<line x1="${f(e.x1)}" y1="${f(e.y1)}" x2="${f(e.x2)}" y2="${f(e.y2)}" ${st}/>`);
            } else if (e.type === 'CIRCLE') {
                shapes.push(`<circle cx="${f(e.x)}" cy="${f(e.y)}" r="${f(e.r)}" ${st}/>`);
            } else if (e.type === 'ARC') {
                let delta = e.a2 - e.a1;
                while (delta <= 0) delta += 360;
                if (delta >= 360) {
                    shapes.push(`<circle cx="${f(e.x)}" cy="${f(e.y)}" r="${f(e.r)}" ${st}/>`);
                } else {
                    const x1 = e.x + e.r * Math.cos(e.a1 * Math.PI / 180), y1 = e.y + e.r * Math.sin(e.a1 * Math.PI / 180);
                    const x2 = e.x + e.r * Math.cos(e.a2 * Math.PI / 180), y2 = e.y + e.r * Math.sin(e.a2 * Math.PI / 180);
                    // DXF 圆弧从 a1 逆时针到 a2（组码坐标内角度递增），对应 SVG sweep-flag=1
                    shapes.push(`<path d="M ${f(x1)} ${f(y1)} A ${f(e.r)} ${f(e.r)} 0 ${delta > 180 ? 1 : 0} 1 ${f(x2)} ${f(y2)}" ${st}/>`);
                }
            } else if (e.type === 'POLYLINE') {
                if (e.points.length >= 2) {
                    const pts = e.points.map(p => `${f(p[0])},${f(p[1])}`).join(' ');
                    shapes.push(e.closed ? `<polygon points="${pts}" ${st}/>` : `<polyline points="${pts}" ${st}/>`);
                }
            } else if (e.type === 'POINT') {
                shapes.push(`<circle cx="${f(e.x)}" cy="${f(e.y)}" r="${f(vbW / 300)}" fill="${e.color}" stroke="none"/>`);
            } else if (e.type === 'TEXT' && e.text) {
                const anchorX = f(e.x), anchorY = f((minY + maxY) - e.y);
                const rot = e.rot ? ` transform="rotate(${f(-e.rot)} ${anchorX} ${anchorY})"` : '';
                texts.push(`<text x="${anchorX}" y="${anchorY}" font-size="${f(e.h || vbH / 50)}" fill="${e.color}" stroke="none"${rot}>${this.escapeXml(e.text)}</text>`);
            }
        }
        // DXF 的 Y 轴向上：整体翻转后与屏幕坐标系一致；文字在翻转组外按换算坐标放置
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vbX)} ${f(vbY)} ${f(vbW)} ${f(vbH)}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">
            <style>line,path,circle,polyline,polygon{vector-effect:non-scaling-stroke;stroke-width:1.4px}</style>
            <rect x="${f(vbX)}" y="${f(vbY)}" width="${f(vbW)}" height="${f(vbH)}" fill="#ffffff"/>
            <g fill="none" transform="scale(1,-1) translate(0,${f(-(minY + maxY))})">${shapes.join('')}</g>
            ${texts.join('')}
        </svg>`;
    }

    renderDxfPreview(uint8Array, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        let text;
        try {
            text = new TextDecoder('utf-8').decode(uint8Array);
            if (text.includes('\uFFFD')) {
                try { text = new TextDecoder('gbk').decode(uint8Array); } catch (e) { /* 保持 utf-8 结果 */ }
            }
        } catch (e) {
            text = '';
            for (let i = 0; i < uint8Array.length; i++) text += String.fromCharCode(uint8Array[i]);
        }

        const blob = new Blob([uint8Array], { type: 'application/dxf' });
        this.currentImageUrl = URL.createObjectURL(blob);
        this.currentFileName = fileName;

        try {
            const parsed = this.parseDxf(text);
            const svg = this.buildDxfSvg(parsed);
            const counter = {};
            parsed.entities.forEach(e => { counter[e.type] = (counter[e.type] || 0) + 1; });
            const stats = Object.keys(counter).sort().map(k => `${k}×${counter[k]}`).join('、');
            const unsupportedInfo = Object.keys(parsed.unsupported).length
                ? `；未渲染实体：${Object.entries(parsed.unsupported).map(([k, n]) => `${k}×${n}`).join('、')}` : '';
            fileGrid.classList.add('has-preview');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div style="width: 100%; border: 1px solid #e0e0e0; background: #fff; border-radius: 4px; overflow: hidden;">
                            <div style="width: 100%; max-height: 600px; overflow: auto;">
                                ${svg || '<div style="padding: 40px; text-align: center; color: #999;">未解析到可显示的图元</div>'}
                            </div>
                        </div>
                        <div style="margin-top: 8px; font-size: 12px; color: #888;">CAD图纸（DXF）预览 — 图元：${stats || '无'}${unsupportedInfo}</div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('CAD图纸渲染失败:', error);
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>CAD图纸渲染失败: ${error.message}</p>
                            <button class="download-btn" id="downloadDxfBtn">下载文件</button>
                        </div>
                    </div>
                </div>
            `;
            const btn = fileGrid.querySelector('#downloadDxfBtn');
            if (btn) btn.addEventListener('click', () => this.downloadSelected());
        }
    }

    // ===== CSV 表格 / 文本 双 Tab 预览 =====

    parseCsvRows(text, maxRows) {
        // RFC 4180：支持引号字段、双引号转义、字段内换行；最多解析 maxRows 行即返回
        const rows = [];
        let row = [], field = '', inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else field += ch;
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(field); field = '';
            } else if (ch === '\n') {
                row.push(field); rows.push(row);
                field = ''; row = [];
                if (rows.length >= maxRows) return rows;
            } else if (ch !== '\r') {
                field += ch;
            }
        }
        if (field !== '' || row.length) { row.push(field); rows.push(row); }
        return rows;
    }

    renderCsvPreview(uint8Array, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        let text;
        try {
            text = new TextDecoder('utf-8').decode(uint8Array);
            if (text.includes('\uFFFD')) {
                try { text = new TextDecoder('gbk').decode(uint8Array); } catch (e) { /* 保持 utf-8 结果 */ }
            }
        } catch (e) {
            text = '';
            for (let i = 0; i < uint8Array.length; i++) text += String.fromCharCode(uint8Array[i]);
        }

        const csvBlob = new Blob([uint8Array], { type: 'text/csv' });
        this.currentImageUrl = URL.createObjectURL(csvBlob);
        this.currentFileName = fileName;

        try {
            const MAX_TABLE_ROWS = 200, MAX_TEXT_LINES = 2000;
            const lines = text.split(/\r\n|\r|\n/);
            const totalLines = lines.filter(l => l !== '').length;
            const shownLines = Math.min(lines.length, MAX_TEXT_LINES);
            const rows = this.parseCsvRows(text, MAX_TABLE_ROWS + 1);
            if (!rows.length) throw new Error('未解析到数据行');

            const tableRows = rows.slice(0, MAX_TABLE_ROWS + 1);
            const header = tableRows[0];
            const bodyRows = tableRows.slice(1);
            const totalRows = rows.length > MAX_TABLE_ROWS ? `${MAX_TABLE_ROWS}+` : String(Math.max(rows.length - 1, 0));
            const tableHtml = `
                <div style="overflow: auto; max-height: 600px; border: 1px solid #e0e0e0;">
                    <table style="border-collapse: collapse; width: 100%;">
                        <thead><tr>${header.map(h => `<th style="border: 1px solid #ddd; padding: 6px 10px; background: #f5f5f5; font-weight: bold; font-size: 13px; text-align: left; white-space: nowrap; position: sticky; top: 0;">${this.escapeHtml(h)}</th>`).join('')}</tr></thead>
                        <tbody>${bodyRows.map(r => `<tr>${header.map((_, i) => `<td style="border: 1px solid #ddd; padding: 5px 10px; font-size: 13px;">${this.escapeHtml(r[i] !== undefined ? r[i] : '')}</td>`).join('')}</tr>`).join('')}</tbody>
                    </table>
                </div>
                <div style="margin-top: 8px; font-size: 12px; color: #888;">表格视图：共 ${totalRows} 行数据${rows.length > MAX_TABLE_ROWS ? '（仅展示前 ' + MAX_TABLE_ROWS + ' 行）' : ''}；完整内容请切换文本视图或下载</div>
            `;
            const textHtml = `
                <pre style="white-space: pre-wrap; word-wrap: break-word; max-height: 600px; overflow: auto; border: 1px solid #e0e0e0; padding: 10px;">${this.escapeHtml(lines.slice(0, shownLines).join('\n'))}</pre>
                <div style="margin-top: 8px; font-size: 12px; color: #888;">文本视图：共 ${totalLines} 行${lines.length > MAX_TEXT_LINES ? `（仅展示前 ${MAX_TEXT_LINES} 行）` : ''}；完整内容请下载</div>
            `;

            const btnStyle = 'padding: 4px 14px; margin-left: 8px; cursor: pointer; border-radius: 4px; font-size: 13px;';
            fileGrid.classList.add('has-preview');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header" style="display: flex; align-items: center; justify-content: space-between;">
                        <span class="file-name">${fileName}</span>
                        <div>
                            <button id="csvTabTable" style="${btnStyle} border: 1px solid #bbb; background: #fff; color: #555;">表格</button>
                            <button id="csvTabText" style="${btnStyle} border: 1px solid #1976D2; background: #1976D2; color: #fff;">文本</button>
                        </div>
                    </div>
                    <div class="preview-content">
                        <div id="csvTablePane" style="display: none; width: 100%;">${tableHtml}</div>
                        <div id="csvTextPane" style="width: 100%;">${textHtml}</div>
                    </div>
                </div>
            `;

            const tabTable = fileGrid.querySelector('#csvTabTable');
            const tabText = fileGrid.querySelector('#csvTabText');
            const paneTable = fileGrid.querySelector('#csvTablePane');
            const paneText = fileGrid.querySelector('#csvTextPane');
            const activate = (showTable) => {
                paneTable.style.display = showTable ? '' : 'none';
                paneText.style.display = showTable ? 'none' : '';
                tabTable.style.background = showTable ? '#1976D2' : '#fff';
                tabTable.style.color = showTable ? '#fff' : '#555';
                tabTable.style.border = showTable ? '1px solid #1976D2' : '1px solid #bbb';
                tabText.style.background = showTable ? '#fff' : '#1976D2';
                tabText.style.color = showTable ? '#555' : '#fff';
                tabText.style.border = showTable ? '1px solid #bbb' : '1px solid #1976D2';
            };
            tabTable.addEventListener('click', () => activate(true));
            tabText.addEventListener('click', () => activate(false));
        } catch (error) {
            console.error('CSV渲染失败:', error);
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${fileName}</span>
                    </div>
                    <div class="preview-content">
                        <div class="document-preview-info">
                            <p>CSV渲染失败: ${error.message}</p>
                            <button class="download-btn" id="downloadCsvBtn">下载文件</button>
                        </div>
                    </div>
                </div>
            `;
            const btn = fileGrid.querySelector('#downloadCsvBtn');
            if (btn) btn.addEventListener('click', () => this.downloadSelected());
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

        breadcrumb.innerHTML = `<span class="breadcrumb-item">${this.currentPath}</span>`;
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
