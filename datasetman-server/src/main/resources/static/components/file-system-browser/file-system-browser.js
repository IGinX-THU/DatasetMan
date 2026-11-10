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
                this.renderBinaryPreview(blob, this.currentPath).catch(error => {
                    console.error('文件预览失败:', error);
                    const fileGrid = this.querySelector('#fileGrid');
                    if (fileGrid) {
                        fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">文件预览失败: ' + error.message + '</div>';
                    }
                });
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

    async renderBinaryPreview(blob, filePath) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        // 清理之前的video.js播放器与three.js场景
        this.cleanupVideoPlayer();
        this.cleanupThreeViewer();

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
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff', 'webp', 'svg', 'ico'];
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
        const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
        const textExtensions = ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md', 'log', 'css', 'js', 'java', 'py', 'sql'];
        const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
        const cadExtensions = ['dxf'];
        const meshExtensions = ['stl', 'msh'];
        const cadBinaryExtensions = ['pmdb', 'prt'];
        const cadTextExtensions = ['step', 'stp', 'iges', 'igs'];
        const isImage = imageExtensions.includes(fileExtension);
        const isVideo = videoExtensions.includes(fileExtension);
        const isAudio = audioExtensions.includes(fileExtension);
        const isText = textExtensions.includes(fileExtension);
        const isDocument = documentExtensions.includes(fileExtension);
        const isCad = cadExtensions.includes(fileExtension);
        const isMesh = meshExtensions.includes(fileExtension);
        const isCadBinary = cadBinaryExtensions.includes(fileExtension);
        const isCadText = cadTextExtensions.includes(fileExtension);
        const isCsv = fileExtension === 'csv';
        const isPreviewable = isImage || isVideo || isAudio || isText || isCad || isMesh || isCadBinary || isCadText;

        if (isPreviewable) {
            // 创建预览内容
            fileGrid.classList.add('has-preview');

            if (isImage) {
                let imageUrl;
                if (fileExtension === 'tif' || fileExtension === 'tiff') {
                    // 浏览器原生不支持TIFF，使用UTIF解码后转为PNG显示
                    const arrayBuffer = await blob.arrayBuffer();
                    imageUrl = await this.tiffToPngUrl(arrayBuffer);
                } else {
                    imageUrl = URL.createObjectURL(blob);
                }
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
            } else if (isMesh || isCadBinary || isCadText) {
                // CAD/CAE 文件（STL/MSH/PMDB/PRT/STEP/IGES）：格式识别与元数据预览
                const readAsArray = (blob instanceof Blob) ? blob.arrayBuffer()
                    : Promise.resolve((blob instanceof ArrayBuffer) ? blob : blob.buffer);
                readAsArray.then(arrayBuffer => {
                    this.handleCadCaPreview(new Uint8Array(arrayBuffer), fileName, this.currentPath);
                }).catch(error => {
                    console.error('CAD/CAE文件数据读取失败:', error);
                    fileGrid.innerHTML = `
                        <div class="file-preview">
                            <div class="preview-content">
                                <div style="color: #999; text-align: center; padding: 20px;">
                                    文件数据读取失败: ${error.message}
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
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff', 'webp', 'svg', 'ico'];
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
        const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
        const textExtensions = ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md', 'log', 'css', 'js', 'java', 'py', 'sql'];
        const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
        const cadExtensions = ['dxf'];
        const meshExtensions = ['stl', 'msh'];
        const cadBinaryExtensions = ['pmdb', 'prt'];
        const cadTextExtensions = ['step', 'stp', 'iges', 'igs'];
        const isImage = imageExtensions.includes(fileExtension);
        const isVideo = videoExtensions.includes(fileExtension);
        const isAudio = audioExtensions.includes(fileExtension);
        const isText = textExtensions.includes(fileExtension);
        const isDocument = documentExtensions.includes(fileExtension);
        const isCad = cadExtensions.includes(fileExtension);
        const isMesh = meshExtensions.includes(fileExtension);
        const isCadBinary = cadBinaryExtensions.includes(fileExtension);
        const isCadText = cadTextExtensions.includes(fileExtension);
        const isCsv = fileExtension === 'csv';
        const isPreviewable = isImage || isVideo || isAudio || isText || isCad || isMesh || isCadBinary || isCadText;

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
            } else if (isMesh || isCadBinary || isCadText) {
                this.handleCadCaPreview(this.base64ToUint8Array(binaryData), fileName, fileColumn);
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

            // 根据文件扩展名确定MIME类型
            const fileExtension = fileName.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'tif': 'image/tiff',
                'tiff': 'image/tiff',
                'webp': 'image/webp'
            };
            const mimeType = mimeTypes[fileExtension] || 'image/jpeg';
            console.log('使用的MIME类型:', mimeType);

            // 创建Blob
            const blob = new Blob([uint8Array], { type: mimeType });
            console.log('Blob创建成功，大小:', blob.size, 'bytes');

            // 校验文件头（魔法数字）
            this.validateImageHeader(uint8Array, fileExtension);

            // 创建图片URL（TIFF需要解码转PNG）
            const imageUrlPromise = this.getImageUrlFromBlob(blob, fileExtension);

            // 异步渲染（TIFF解码为异步操作，常规图片同步返回URL）
            return imageUrlPromise.then(imageUrl => {
                this.renderImagePreviewWithUrl(imageUrl, fileName, fileGrid);
            }).catch(error => {
                console.error('图片渲染失败:', error);
                fileGrid.classList.add('has-preview');
                fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">图片无法显示: ' + error.message + '</div>';
            });
        } catch (error) {
            console.error('图片数据格式错误:', error);
            fileGrid.classList.add('has-preview');
            fileGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">图片数据格式错误: ' + error.message + '</div>';
        }
    }

    /**
     * 根据文件类型生成可用于<img>的图片URL。
     * 浏览器原生支持PNG/JPG/JPEG/BMP等格式，直接ObjectURL；
     * TIFF不被浏览器支持，使用UTIF解码后转PNG。
     */
    async getImageUrlFromBlob(blob, fileExtension) {
        if (fileExtension === 'tif' || fileExtension === 'tiff') {
            const arrayBuffer = await blob.arrayBuffer();
            return this.tiffToPngUrl(arrayBuffer);
        }
        return URL.createObjectURL(blob);
    }

    /**
     * 使用UTIF将TIFF数据解码为PNG的ObjectURL
     */
    async tiffToPngUrl(arrayBuffer) {
        if (typeof UTIF === 'undefined') {
            throw new Error('TIFF解码器(UTIF)未加载');
        }
        const ifds = UTIF.decode(arrayBuffer);
        if (!ifds || ifds.length === 0) {
            throw new Error('无法解析TIFF数据');
        }
        // 解码第一页
        UTIF.decodeImage(arrayBuffer, ifds[0], ifds);
        const rgba = UTIF.toRGBA8(ifds[0]);
        const canvas = document.createElement('canvas');
        canvas.width = ifds[0].width;
        canvas.height = ifds[0].height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(URL.createObjectURL(blob));
                } else {
                    reject(new Error('TIFF转PNG失败'));
                }
            }, 'image/png');
        });
    }

    /**
     * 校验常见图片格式的文件头（魔法数字），用于尽早发现数据错误
     */
    validateImageHeader(uint8Array, fileExtension) {
        if (uint8Array.length < 4) return;
        const b = uint8Array;
        const sig = (bytes) => bytes.every((byte, i) => b[i] === byte);
        let valid = false;
        switch (fileExtension) {
            case 'jpg':
            case 'jpeg':
                valid = b[0] === 0xFF && b[1] === 0xD8;
                break;
            case 'png':
                valid = sig([0x89, 0x50, 0x4E, 0x47]);
                break;
            case 'gif':
                valid = sig([0x47, 0x49, 0x46]);
                break;
            case 'bmp':
                valid = sig([0x42, 0x4D]);
                break;
            case 'tif':
            case 'tiff':
                valid = (sig([0x49, 0x49, 0x2A, 0x00]) || sig([0x4D, 0x4D, 0x00, 0x2A]));
                break;
            default:
                valid = true; // 未知格式不做校验
        }
        if (!valid) {
            console.warn('警告：文件头与扩展名 ' + fileExtension + ' 不匹配，前几个字节:',
                Array.from(b.slice(0, 4)).map(x => x.toString(16)).join(' '));
        }
    }

    renderImagePreviewWithUrl(imageUrl, fileName, fileGrid) {
        try {
            console.log('图片URL创建成功:', imageUrl);

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

    // ===== CAD/CAE 文件识别与预览（PMDB/PRT/STL/MSH/STEP/IGES） =====

    /**
     * CAD/CAE 文件预览总入口：按扩展名路由到对应渲染器
     * @param sourcePath IGinX 测点路径（用于调用后端 /fs/meta 识别接口）
     */
    handleCadCaPreview(uint8Array, fileName, sourcePath) {
        const fileExtension = fileName.split('.').pop().toLowerCase();
        if (fileExtension === 'stl' || fileExtension === 'msh') {
            if (fileExtension === 'stl') {
                this.renderStlPreview(uint8Array, fileName);
            } else {
                this.renderMshPreview(uint8Array, fileName);
            }
        } else if (fileExtension === 'pmdb') {
            this.renderPmdbPreview(uint8Array, fileName, sourcePath);
        } else if (fileExtension === 'prt') {
            this.renderCadBinaryPreview(uint8Array, fileName, fileExtension);
        } else if (['step', 'stp', 'iges', 'igs'].includes(fileExtension)) {
            this.renderCadTextPreview(uint8Array, fileName, fileExtension);
        } else {
            this.renderCadBinaryPreview(uint8Array, fileName, fileExtension);
        }
    }

    /**
     * PMDB（ANSYS Fluent Meshing 几何/网格数据库，本质为 HDF5 容器）预览：
     * 调用后端 /api/data/fs/meta 用 jhdf 解析 HDF5 结构树，失败降级为通用二进制卡片
     */
    renderPmdbPreview(uint8Array, fileName, sourcePath) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        this.prepareBinaryDownload(uint8Array, fileName);

        window.AppConfig.post('data', 'fs/meta', { paths: [sourcePath] }).then(result => {
            const meta = result && result.data && result.data[0];
            if (!meta || meta.error) {
                console.warn('PMDB元数据识别失败，降级为通用二进制卡片:', meta && meta.error);
                this.renderCadBinaryPreview(uint8Array, fileName, 'pmdb');
                return;
            }

            const strings = this.extractAsciiStrings(uint8Array, 6, 50);
            const hexDump = this.formatHexDump(uint8Array, 256);
            const hdf5 = meta.hdf5;
            const treeHtml = hdf5 ? this.renderHdf5TreeNode({ name: '/', children: hdf5.children }, 0) : '';
            const markerHtml = (meta.markers || []).map(m => `<span class="cad-badge">${this.escapeHtml(m)}</span>`).join(' ');

            fileGrid.classList.add('has-preview');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header">
                        <span class="file-name">${this.escapeHtml(fileName)}</span>
                    </div>
                    <div class="preview-content" style="overflow: auto; padding: 12px 16px;">
                        <div style="margin-bottom: 10px;">
                            <span class="cad-badge cad-badge-primary">${this.escapeHtml(meta.formatName || meta.format || 'PMDB')}</span>
                            ${markerHtml}
                            <span style="margin-left: 8px; color: #666; font-size: 13px;">大小: ${this.formatFileSize(meta.sizeBytes || uint8Array.length)}</span>
                        </div>
                        ${hdf5 ? `
                        <div style="margin-bottom: 12px;">
                            <div style="font-weight: 600; margin-bottom: 6px;">HDF5 结构树${hdf5.truncated ? '（已截断）' : ''}</div>
                            <div class="cad-tree">${treeHtml || '<div style="color:#999;">空文件</div>'}</div>
                        </div>` : ''}
                        ${hdf5 && hdf5.attributes && Object.keys(hdf5.attributes).length ? `
                        <div style="margin-bottom: 12px;">
                            <div style="font-weight: 600; margin-bottom: 6px;">根属性</div>
                            ${this.renderAttributesTable(hdf5.attributes)}
                        </div>` : ''}
                        ${meta.hdf5Error ? `<div style="color:#c60; margin-bottom: 12px;">HDF5结构解析失败: ${this.escapeHtml(meta.hdf5Error)}</div>` : ''}
                        ${strings.length ? `
                        <div style="margin-bottom: 12px;">
                            <div style="font-weight: 600; margin-bottom: 6px;">内嵌字符串（前 ${strings.length} 条）</div>
                            <div style="max-height: 140px; overflow: auto; background: #fafafa; border: 1px solid #eee; padding: 8px;">
                                ${strings.map(s => `<span class="cad-string">${this.escapeHtml(s)}</span>`).join(' ')}
                            </div>
                        </div>` : ''}
                        <div>
                            <div style="font-weight: 600; margin-bottom: 6px;">文件头 hex（前 ${Math.min(256, uint8Array.length)} 字节）</div>
                            <pre class="cad-hex">${hexDump}</pre>
                        </div>
                    </div>
                </div>
            `;
        }).catch(error => {
            console.warn('PMDB元数据接口调用失败，降级为通用二进制卡片:', error);
            this.renderCadBinaryPreview(uint8Array, fileName, 'pmdb');
        });
    }

    /**
     * 递归渲染 HDF5 结构树（groups 用 details/summary 折叠）
     */
    renderHdf5TreeNode(node, depth) {
        if (!node || !node.children || !node.children.length) {
            return '<div style="color:#999; padding-left: 18px;">（无子节点）</div>';
        }
        return node.children.map(child => {
            const label = this.escapeHtml(child.name || '(unnamed)');
            if (child.children && child.children.length) {
                return `
                    <details ${depth === 0 ? 'open' : ''}>
                        <summary style="cursor: pointer;">
                            <span class="cad-type cad-type-group">GROUP</span>
                            ${label}
                        </summary>
                        <div style="padding-left: 16px; border-left: 1px dashed #ddd; margin-left: 8px;">
                            ${this.renderHdf5TreeNode(child, depth + 1)}
                        </div>
                    </details>`;
            }
            let info = '';
            if (child.type === 'DATASET') {
                const dims = Array.isArray(child.dims) ? child.dims.join('×') : '';
                info = `${dims ? dims : ''}${child.javaType ? ' : ' + child.javaType : ''}`;
            } else if (child.type === 'COMMITTED_DATATYPE') {
                info = 'committed datatype';
            }
            const attrs = child.attributes && Object.keys(child.attributes).length
                ? Object.entries(child.attributes).map(([k, v]) => `${this.escapeHtml(k)}=${this.escapeHtml(String(v))}`).join('; ')
                : '';
            return `
                <div style="padding: 1px 0;">
                    <span class="cad-type cad-type-${child.type === 'DATASET' ? 'dataset' : 'other'}">${this.escapeHtml(child.type || 'NODE')}</span>
                    ${label}
                    ${info ? `<span style="color:#888; font-size: 12px;"> ${this.escapeHtml(info)}</span>` : ''}
                    ${attrs ? `<div style="color:#999; font-size: 12px; padding-left: 12px;">attrs: ${attrs}</div>` : ''}
                </div>`;
        }).join('');
    }

    renderAttributesTable(attributes) {
        const rows = Object.entries(attributes).map(([k, v]) =>
            `<tr><td style="border: 1px solid #eee; padding: 4px 8px; font-size: 12px;">${this.escapeHtml(k)}</td>
                 <td style="border: 1px solid #eee; padding: 4px 8px; font-size: 12px;">${this.escapeHtml(String(v))}</td></tr>`).join('');
        return `<table style="border-collapse: collapse;"><tbody>${rows}</tbody></table>`;
    }

    /**
     * 通用二进制 CAD 文件卡片（NX .prt 等）：签名 + 字符串 + hex + 下载
     */
    renderCadBinaryPreview(uint8Array, fileName, fileExtension) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        this.prepareBinaryDownload(uint8Array, fileName);

        // 签名判定
        let signature = '未知二进制';
        const latinHead = new TextDecoder('latin1').decode(uint8Array.subarray(0, 8192));
        if (latinHead.includes('UGII')) {
            signature = 'Siemens NX / Unigraphics (UGII 标记)';
        } else if (uint8Array[0] === 0x89 && uint8Array[1] === 0x48) {
            signature = 'HDF5 容器';
        } else if (uint8Array[0] === 0x50 && uint8Array[1] === 0x4B) {
            signature = 'ZIP 容器';
        } else if (latinHead.includes('ANSYS') || latinHead.includes('Fluent')) {
            signature = 'ANSYS 相关数据';
        }

        const strings = this.extractAsciiStrings(uint8Array, 6, 80);
        const hexDump = this.formatHexDump(uint8Array, 256);

        fileGrid.classList.add('has-preview');
        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-header">
                    <span class="file-name">${this.escapeHtml(fileName)}</span>
                </div>
                <div class="preview-content" style="overflow: auto; padding: 12px 16px;">
                    <div style="margin-bottom: 10px;">
                        <span class="cad-badge cad-badge-primary">.${this.escapeHtml(fileExtension)} 二进制文件</span>
                        <span class="cad-badge">${this.escapeHtml(signature)}</span>
                        <span style="margin-left: 8px; color: #666; font-size: 13px;">大小: ${this.formatFileSize(uint8Array.length)}</span>
                        <span style="color: #999; font-size: 12px; margin-left: 8px;">专有格式，无法解析几何内容，仅提供识别信息与下载</span>
                    </div>
                    ${strings.length ? `
                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; margin-bottom: 6px;">内嵌字符串（前 ${strings.length} 条）</div>
                        <div style="max-height: 140px; overflow: auto; background: #fafafa; border: 1px solid #eee; padding: 8px;">
                            ${strings.map(s => `<span class="cad-string">${this.escapeHtml(s)}</span>`).join(' ')}
                        </div>
                    </div>` : ''}
                    <div>
                        <div style="font-weight: 600; margin-bottom: 6px;">文件头 hex（前 ${Math.min(256, uint8Array.length)} 字节）</div>
                        <pre class="cad-hex">${hexDump}</pre>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * STL 预览：解析三角形/包围盒统计，three.js 3D 渲染（可旋转缩放）
     */
    renderStlPreview(uint8Array, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        this.prepareBinaryDownload(uint8Array, fileName);

        let parsed;
        try {
            parsed = this.parseStl(uint8Array);
        } catch (error) {
            fileGrid.classList.add('has-preview');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header"><span class="file-name">${this.escapeHtml(fileName)}</span></div>
                    <div class="preview-content">
                        <div style="color: #999; text-align: center; padding: 20px;">
                            STL解析失败: ${this.escapeHtml(error.message)}
                            <div><button class="btn" id="downloadStlBtn" style="margin-top: 10px;">下载文件</button></div>
                        </div>
                    </div>
                </div>
            `;
            const btn = fileGrid.querySelector('#downloadStlBtn');
            if (btn) btn.addEventListener('click', () => this.downloadSelected());
            return;
        }

        const { format, triangleCount, bounds, positions } = parsed;
        const size = [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]]
            .map(v => v.toFixed(2)).join(' × ');

        fileGrid.classList.add('has-preview');
        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-header"><span class="file-name">${this.escapeHtml(fileName)}</span></div>
                <div class="preview-content">
                    <div class="stl-stats">
                        <span class="cad-badge cad-badge-primary">STL (${format === 'binary' ? '二进制' : 'ASCII'})</span>
                        <span style="margin-left: 8px; color: #666; font-size: 13px;">三角形: ${triangleCount.toLocaleString()}</span>
                        <span style="color: #666; font-size: 13px; margin-left: 12px;">包围盒: ${size}</span>
                    </div>
                    <div id="stlCanvasContainer" style="width: 100%; height: 480px; position: relative; background: #f7f7f9; border-radius: 4px; overflow: hidden;">
                        <div style="position: absolute; top: 8px; left: 10px; color: #999; font-size: 12px;">左键旋转 / 滚轮缩放 / 右键平移</div>
                    </div>
                </div>
            </div>
        `;

        const container = fileGrid.querySelector('#stlCanvasContainer');
        if (positions && container) {
            this.ensureThreeJs().then(() => {
                this.renderThreeStl(container, positions);
            }).catch(error => {
                console.warn('three.js加载失败，仅显示统计:', error);
                container.innerHTML = `<div style="padding: 20px; color: #999; text-align: center;">3D渲染库加载失败: ${this.escapeHtml(error.message)}<br>已显示解析统计信息。</div>`;
            });
        } else {
            container.innerHTML = '<div style="padding: 20px; color: #999; text-align: center;">三角面数据为空，无法渲染。</div>';
        }
    }

    /**
     * 解析 STL（二进制/ASCII），返回三角形数量、包围盒与顶点数据
     */
    parseStl(uint8Array) {
        const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
        let isBinary = false;
        let triangleCount = 0;
        if (uint8Array.length >= 84) {
            const count = view.getUint32(80, true);
            if (84 + count * 50 === uint8Array.length) {
                isBinary = true;
                triangleCount = count;
            }
        }

        if (isBinary) {
            const positions = new Float32Array(triangleCount * 9);
            let offset = 84;
            const min = [Infinity, Infinity, Infinity];
            const max = [-Infinity, -Infinity, -Infinity];
            for (let i = 0; i < triangleCount; i++) {
                offset += 12; // 跳过法向量
                for (let v = 0; v < 3; v++) {
                    const x = view.getFloat32(offset, true); offset += 4;
                    const y = view.getFloat32(offset, true); offset += 4;
                    const z = view.getFloat32(offset, true); offset += 4;
                    const base = i * 9 + v * 3;
                    positions[base] = x; positions[base + 1] = y; positions[base + 2] = z;
                    if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
                    if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
                    if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
                }
                offset += 2; // attribute byte count
            }
            if (!isFinite(min[0])) throw new Error('无有效顶点');
            return { format: 'binary', triangleCount, bounds: { min, max }, positions };
        }

        // ASCII STL
        let text;
        try {
            text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array.subarray(0, Math.min(uint8Array.length, 64 * 1024 * 1024)));
        } catch (e) {
            throw new Error('无法解码文件内容');
        }
        if (!/^\s*solid/i.test(text)) {
            throw new Error('既不是合法的二进制STL也不是ASCII STL');
        }
        const facets = text.split(/facet\s+normal/i).length - 1;
        triangleCount = facets;
        const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
        const positions = new Float32Array(Math.max(facets, 1) * 9);
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        let idx = 0;
        let m;
        while ((m = vertexRe.exec(text)) !== null) {
            if (idx + 2 >= positions.length) break;
            const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]);
            positions[idx++] = x; positions[idx++] = y; positions[idx++] = z;
            if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
            if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
            if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
        }
        if (idx === 0) throw new Error('ASCII STL中未找到顶点');
        if (!isFinite(min[0])) throw new Error('无有效顶点');
        return { format: 'ascii', triangleCount: Math.floor(idx / 9), bounds: { min, max }, positions: positions.subarray(0, idx) };
    }

    /**
     * three.js 渲染 STL 网格（懒加载库，OrbitControls 交互）
     */
    ensureThreeJs() {
        if (this._threeJsPromise) return this._threeJsPromise;
        this._threeJsPromise = new Promise((resolve, reject) => {
            if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
                resolve();
                return;
            }
            const three = document.createElement('script');
            three.src = '/lib/three/three.min.js';
            three.onload = () => {
                const controls = document.createElement('script');
                controls.src = '/lib/three/OrbitControls.js';
                controls.onload = () => resolve();
                controls.onerror = () => reject(new Error('OrbitControls加载失败'));
                document.head.appendChild(controls);
            };
            three.onerror = () => reject(new Error('three.js加载失败'));
            document.head.appendChild(three);
        });
        return this._threeJsPromise;
    }

    cleanupThreeViewer() {
        if (this._threeViewer) {
            const { renderer, animationId } = this._threeViewer;
            if (animationId) cancelAnimationFrame(animationId);
            if (renderer) renderer.dispose();
            this._threeViewer = null;
        }
    }

    renderThreeStl(container, positions) {
        this.cleanupThreeViewer();
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 480;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf7f7f9);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        geometry.center();
        geometry.computeBoundingSphere();
        const radius = Math.max(geometry.boundingSphere.radius, 1e-6);

        const material = new THREE.MeshPhongMaterial({
            color: 0x7fa8c9,
            side: THREE.DoubleSide,
            flatShading: true,
            specular: 0x222222,
            shininess: 30
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const grid = new THREE.GridHelper(radius * 4, 20, 0xcccccc, 0xe5e5e5);
        scene.add(grid);

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
        keyLight.position.set(radius * 2, radius * 3, radius * 2.5);
        scene.add(keyLight);

        const camera = new THREE.PerspectiveCamera(55, width / height, radius / 100, radius * 50);
        camera.position.set(radius * 1.6, radius * 1.3, radius * 1.8);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.12;
        controls.update();

        const animate = () => {
            this._threeViewer.animationId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        this._threeViewer = { renderer, animationId: null };
        animate();
    }

    /**
     * Fluent .msh 网格文件预览：解析段头统计（维度/节点/cell/face/zone）
     */
    renderMshPreview(uint8Array, fileName) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        this.prepareBinaryDownload(uint8Array, fileName);

        const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array.subarray(0, Math.min(uint8Array.length, 32 * 1024 * 1024)));
        const stats = this.parseMshSections(text);

        const textPreview = this.escapeHtml(text.split(/\r?\n/).slice(0, 40).join('\n'));

        fileGrid.classList.add('has-preview');
        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-header"><span class="file-name">${this.escapeHtml(fileName)}</span></div>
                <div class="preview-content" style="overflow: auto; padding: 12px 16px;">
                    <div style="margin-bottom: 10px;">
                        <span class="cad-badge cad-badge-primary">Fluent Mesh (.msh)</span>
                        <span style="margin-left: 8px; color: #666; font-size: 13px;">大小: ${this.formatFileSize(uint8Array.length)}</span>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; margin-bottom: 6px;">网格统计</div>
                        <table style="border-collapse: collapse;">
                            <tbody>
                                <tr><td style="border: 1px solid #eee; padding: 4px 10px;">维度</td><td style="border: 1px solid #eee; padding: 4px 10px;">${stats.dimension || '未知'}</td></tr>
                                <tr><td style="border: 1px solid #eee; padding: 4px 10px;">节点数</td><td style="border: 1px solid #eee; padding: 4px 10px;">${stats.nodeCount.toLocaleString()}</td></tr>
                                <tr><td style="border: 1px solid #eee; padding: 4px 10px;">面区(zones)</td><td style="border: 1px solid #eee; padding: 4px 10px;">${stats.faceZoneCount}</td></tr>
                                <tr><td style="border: 1px solid #eee; padding: 4px 10px;">面数</td><td style="border: 1px solid #eee; padding: 4px 10px;">${stats.faceCount.toLocaleString()}</td></tr>
                                <tr><td style="border: 1px solid #eee; padding: 4px 10px;">体区(zones)</td><td style="border: 1px solid #eee; padding: 4px 10px;">${stats.cellZoneCount}</td></tr>
                                <tr><td style="border: 1px solid #eee; padding: 4px 10px;">体单元数</td><td style="border: 1px solid #eee; padding: 4px 10px;">${stats.cellCount.toLocaleString()}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    ${stats.zoneNames.length ? `
                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; margin-bottom: 6px;">Zone 名称（前 ${stats.zoneNames.length} 个）</div>
                        <div style="max-height: 120px; overflow: auto;">
                            ${stats.zoneNames.map(n => `<span class="cad-string">${this.escapeHtml(n)}</span>`).join(' ')}
                        </div>
                    </div>` : ''}
                    <div>
                        <div style="font-weight: 600; margin-bottom: 6px;">文件头预览（前 40 行）</div>
                        <pre class="cad-hex">${textPreview}</pre>
                    </div>
                </div>
            </div>
        `;
    }

    parseMshSections(text) {
        const stats = { dimension: '', nodeCount: 0, faceZoneCount: 0, cellZoneCount: 0, faceCount: 0, cellCount: 0, zoneNames: [] };
        const dimRe = /\(2\s*(2|3)D?\s*\)/;
        const dimMatch = text.match(dimRe);
        if (dimMatch) {
            stats.dimension = dimMatch[1] + 'D';
        }
        // (10 zone-id first-index last-index type) — 节点数 = last - first + 1
        const nodeRe = /\(10\s+(\d+)\s+(\d+)\s+(\d+)[^)]*\)/g;
        let m;
        while ((m = nodeRe.exec(text)) !== null) {
            if (m[1] !== '0') {
                stats.nodeCount = Math.max(stats.nodeCount, parseInt(m[3], 10) - parseInt(m[2], 10) + 1);
            }
        }
        const faceRe = /\(13\s+(\d+)\s+(\d+)\s+(\d+)[^)]*\)/g;
        while ((m = faceRe.exec(text)) !== null) {
            if (m[1] !== '0') {
                stats.faceZoneCount++;
                stats.faceCount += parseInt(m[3], 10) - parseInt(m[2], 10) + 1;
            }
        }
        const cellRe = /\(12\s+(\d+)\s+(\d+)\s+(\d+)[^)]*\)/g;
        while ((m = cellRe.exec(text)) !== null) {
            if (m[1] !== '0') {
                stats.cellZoneCount++;
                stats.cellCount += parseInt(m[3], 10) - parseInt(m[2], 10) + 1;
            }
        }
        // (39 (zone-id zone-name ...)())
        const zoneNameRe = /\(39\s*\(\s*(\d+)\s+([A-Za-z0-9_\-.: ]+?)\s*\)/g;
        while ((m = zoneNameRe.exec(text)) !== null) {
            stats.zoneNames.push(m[2].trim());
            if (stats.zoneNames.length >= 100) break;
        }
        return stats;
    }

    /**
     * STEP / IGES 文本格式预览：解析文件头元数据
     */
    renderCadTextPreview(uint8Array, fileName, fileExtension) {
        const fileGrid = this.querySelector('#fileGrid');
        if (!fileGrid) return;

        this.prepareBinaryDownload(uint8Array, fileName);

        const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array.subarray(0, Math.min(uint8Array.length, 32 * 1024 * 1024)));
        const isStep = fileExtension === 'step' || fileExtension === 'stp';

        let formatBadge;
        let infoRows = [];
        let extraHtml = '';

        if (isStep) {
            formatBadge = 'STEP (ISO 10303-21)';
            const headerMatch = text.match(/ISO-10303-21;([\s\S]*?)DATA\s*\(/i);
            const header = headerMatch ? headerMatch[1] : '';
            const fileNameMatch = header.match(/FILE_NAME\s*\(\s*'([^']*)'/i);
            const schemaMatch = header.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i);
            const authorMatch = header.match(/FILE_AUTHOR\s*\(\s*\(\s*'([^']*)'/i);
            const productRe = /PRODUCT\s*\(\s*'([^']*)'/gi;
            const products = [];
            let pm;
            while ((pm = productRe.exec(text)) !== null) {
                if (!products.includes(pm[1])) products.push(pm[1]);
                if (products.length >= 50) break;
            }
            const entityCount = (text.match(/^\s*#\d+\s*=/gm) || []).length;
            if (fileNameMatch) infoRows.push(['FILE_NAME', fileNameMatch[1]]);
            if (authorMatch) infoRows.push(['FILE_AUTHOR', authorMatch[1]]);
            if (schemaMatch) infoRows.push(['FILE_SCHEMA', schemaMatch[1]]);
            infoRows.push(['实体数', entityCount.toLocaleString()]);
            if (products.length) {
                extraHtml = `
                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; margin-bottom: 6px;">PRODUCT 名称（前 ${products.length} 个）</div>
                        <div style="max-height: 120px; overflow: auto;">
                            ${products.map(p => `<span class="cad-string">${this.escapeHtml(p)}</span>`).join(' ')}
                        </div>
                    </div>`;
            }
        } else {
            formatBadge = 'IGES';
            const countsMatch = text.match(/S\s*(\d+)\s*G\s*(\d+)\s*D\s*(\d+)\s*P\s*(\d+)/);
            if (countsMatch) {
                infoRows.push(['起始段(S)', countsMatch[1]]);
                infoRows.push(['全局段(G)', countsMatch[2]]);
                infoRows.push(['目录段(D)', countsMatch[3]]);
                infoRows.push(['参数段(P)', countsMatch[4]]);
            }
            const unitsMatch = text.match(/(\d)H\s*(MM|INCH|IN|FT|MI|K|M|CM|UM)\b/i);
            if (unitsMatch) infoRows.push(['单位', unitsMatch[2].toUpperCase()]);
        }

        const textPreview = this.escapeHtml(text.split(/\r?\n/).slice(0, 40).join('\n'));

        fileGrid.classList.add('has-preview');
        fileGrid.innerHTML = `
            <div class="file-preview">
                <div class="preview-header"><span class="file-name">${this.escapeHtml(fileName)}</span></div>
                <div class="preview-content" style="overflow: auto; padding: 12px 16px;">
                    <div style="margin-bottom: 10px;">
                        <span class="cad-badge cad-badge-primary">${formatBadge}</span>
                        <span style="margin-left: 8px; color: #666; font-size: 13px;">大小: ${this.formatFileSize(uint8Array.length)}</span>
                    </div>
                    ${infoRows.length ? `
                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; margin-bottom: 6px;">文件头信息</div>
                        <table style="border-collapse: collapse;">
                            <tbody>
                                ${infoRows.map(([k, v]) => `<tr><td style="border: 1px solid #eee; padding: 4px 10px;">${this.escapeHtml(String(k))}</td><td style="border: 1px solid #eee; padding: 4px 10px;">${this.escapeHtml(String(v))}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>` : ''}
                    ${extraHtml}
                    <div>
                        <div style="font-weight: 600; margin-bottom: 6px;">文件头预览（前 40 行）</div>
                        <pre class="cad-hex">${textPreview}</pre>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 设置二进制下载信息（工具栏下载按钮复用）
     */
    prepareBinaryDownload(uint8Array, fileName) {
        this.currentImageUrl = URL.createObjectURL(new Blob([uint8Array], { type: 'application/octet-stream' }));
        this.currentFileName = fileName;
    }

    /**
     * 从二进制数据提取可打印ASCII字符串（去重保序，限量限量长）
     */
    extractAsciiStrings(uint8Array, minLength = 6, maxCount = 50) {
        const strings = [];
        const seen = new Set();
        const scanLength = Math.min(uint8Array.length, 4 * 1024 * 1024);
        let start = -1;
        for (let i = 0; i <= scanLength; i++) {
            const b = i < scanLength ? uint8Array[i] : 0;
            const printable = b >= 0x20 && b <= 0x7E;
            if (printable && start < 0) {
                start = i;
            } else if (!printable && start >= 0) {
                if (i - start >= minLength) {
                    let s = '';
                    for (let j = start; j < i; j++) s += String.fromCharCode(uint8Array[j]);
                    if (!seen.has(s)) {
                        seen.add(s);
                        strings.push(s);
                        if (strings.length >= maxCount) return strings;
                    }
                }
                start = -1;
            }
        }
        return strings;
    }

    /**
     * hex转储（每行16字节：偏移 + hex + ASCII）
     */
    formatHexDump(uint8Array, numBytes = 256) {
        const bytes = uint8Array.subarray(0, Math.min(numBytes, uint8Array.length));
        const lines = [];
        for (let row = 0; row < bytes.length; row += 16) {
            const chunk = bytes.subarray(row, Math.min(row + 16, bytes.length));
            const offset = row.toString(16).padStart(8, '0');
            const hexParts = [];
            let ascii = '';
            for (let i = 0; i < 16; i++) {
                if (i < chunk.length) {
                    hexParts.push(chunk[i].toString(16).padStart(2, '0'));
                    ascii += (chunk[i] >= 0x20 && chunk[i] <= 0x7E) ? String.fromCharCode(chunk[i]) : '.';
                } else {
                    hexParts.push('  ');
                    ascii += ' ';
                }
                if (i === 7) hexParts.push(' ');
            }
            lines.push(`${offset}  ${hexParts.join(' ')}  |${ascii}|`);
        }
        return this.escapeHtml(lines.join('\n'));
    }

    formatFileSize(bytes) {
        if (bytes === null || bytes === undefined || isNaN(bytes)) return 'N/A';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
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
            // 表格视图为主：解析到 MAX_TABLE_ROWS+1 行即停止扫描，超大文件只读文件开头
            const rows = this.parseCsvRows(text, MAX_TABLE_ROWS + 1);
            if (!rows.length) throw new Error('未解析到数据行');

            const header = rows[0];
            const bodyRows = rows.slice(1, MAX_TABLE_ROWS + 1);
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

            const btnStyle = 'padding: 4px 14px; margin-left: 8px; cursor: pointer; border-radius: 4px; font-size: 13px;';
            fileGrid.classList.add('has-preview');
            fileGrid.innerHTML = `
                <div class="file-preview">
                    <div class="preview-header" style="display: flex; align-items: center; justify-content: space-between;">
                        <span class="file-name">${fileName}</span>
                        <div>
                            <button id="csvTabTable" style="${btnStyle} border: 1px solid #1976D2; background: #1976D2; color: #fff;">表格</button>
                            <button id="csvTabText" style="${btnStyle} border: 1px solid #bbb; background: #fff; color: #555;">文本</button>
                        </div>
                    </div>
                    <div class="preview-content">
                        <div id="csvTablePane" style="width: 100%;">${tableHtml}</div>
                        <div id="csvTextPane" style="display: none; width: 100%;"></div>
                    </div>
                </div>
            `;

            const tabTable = fileGrid.querySelector('#csvTabTable');
            const tabText = fileGrid.querySelector('#csvTabText');
            const paneTable = fileGrid.querySelector('#csvTablePane');
            const paneText = fileGrid.querySelector('#csvTextPane');

            // 文本视图懒构建：首次切换到"文本"时才做全量分行与内容填充
            let textPaneBuilt = false;
            const buildTextHtml = () => {
                const lines = text.split(/\r\n|\r|\n/);
                let totalLines = 0;
                for (let i = 0; i < lines.length; i++) if (lines[i] !== '') totalLines++;
                const shown = lines.slice(0, Math.min(lines.length, MAX_TEXT_LINES)).join('\n');
                return `
                    <pre style="white-space: pre-wrap; word-wrap: break-word; max-height: 600px; overflow: auto; border: 1px solid #e0e0e0; padding: 10px;">${this.escapeHtml(shown)}</pre>
                    <div style="margin-top: 8px; font-size: 12px; color: #888;">文本视图：共 ${totalLines} 行${lines.length > MAX_TEXT_LINES ? `（仅展示前 ${MAX_TEXT_LINES} 行）` : ''}；完整内容请下载</div>
                `;
            };
            const activate = (showTable) => {
                paneTable.style.display = showTable ? '' : 'none';
                paneText.style.display = showTable ? 'none' : '';
                tabTable.style.background = showTable ? '#1976D2' : '#fff';
                tabTable.style.color = showTable ? '#fff' : '#555';
                tabTable.style.border = showTable ? '1px solid #1976D2' : '1px solid #bbb';
                tabText.style.background = showTable ? '#fff' : '#1976D2';
                tabText.style.color = showTable ? '#555' : '#fff';
                tabText.style.border = showTable ? '1px solid #bbb' : '1px solid #1976D2';
                if (!showTable && !textPaneBuilt) {
                    textPaneBuilt = true;
                    paneText.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">正在生成文本视图...</div>';
                    setTimeout(() => { paneText.innerHTML = buildTextHtml(); }, 30);
                }
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
