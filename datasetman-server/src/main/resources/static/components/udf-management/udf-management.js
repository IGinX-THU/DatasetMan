class UdfManagement extends HTMLElement {
    constructor() {
        super();
        this.udfs = [];
        this.selectedFile = null;
    }

    connectedCallback() {
        this.style.display = 'none';

        this.innerHTML = `
            <link rel="stylesheet" href="./components/udf-management/udf-management.css">
        `;

        fetch('./components/udf-management/udf-management.html')
            .then(response => response.text())
            .then(html => {
                this.innerHTML += html;
                this.initEventListeners();
            });
    }

    initEventListeners() {
        const registerBtn = this.querySelector('#registerUdfBtn');
        const refreshBtn = this.querySelector('#refreshBtn');
        const closeModal = this.querySelector('#closeModal');
        const cancelBtn = this.querySelector('#cancelBtn');
        const udfForm = this.querySelector('#udfForm');
        const uploadArea = this.querySelector('#uploadArea');
        const fileInput = this.querySelector('#udfFile');
        const removeFile = this.querySelector('#removeFile');

        if (registerBtn) {
            registerBtn.addEventListener('click', () => this.showModal());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadUdfs());
        }

        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideModal());
        }

        if (udfForm) {
            udfForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.registerUdf();
            });
        }

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFile(files[0]);
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFile(e.target.files[0]);
                }
            });
        }

        if (removeFile) {
            removeFile.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearFile();
            });
        }

        const modal = this.querySelector('#udfModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }
    }

    showModal() {
        const dialogHtml = `
            <div class="dialog-mask" style="
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            ">
                <div class="dialog-content" style="
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 600px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    max-height: 90vh;
                    overflow-y: auto;
                    position: relative;
                ">
                    <button class="dialog-close-btn" style="
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        width: 24px;
                        height: 24px;
                        border: none;
                        background: transparent;
                        font-size: 20px;
                        cursor: pointer;
                        color: #8c8c8c;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 4px;
                    ">&times;</button>
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">注册UDF</h3>
                    <form id="udfForm" style="margin-bottom: 24px;">
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #1f2329; font-size: 14px;">UDF类型</label>
                            <select id="udfType" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #c9cdd4;
                                border-radius: 4px;
                                font-size: 14px;
                                color: #1f2329;
                                background: white;
                            " required>
                                <option value="">请选择UDF类型</option>
                                <option value="UDSF">UDSF</option>
                                <option value="UDAF">UDAF</option>
                                <option value="UDTF">UDTF</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #1f2329; font-size: 14px;">UDF名称</label>
                            <input type="text" id="udfName" placeholder="请输入UDF名称" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #c9cdd4;
                                border-radius: 4px;
                                font-size: 14px;
                                color: #1f2329;
                                background: white;
                            " required>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #1f2329; font-size: 14px;">类名</label>
                            <input type="text" id="className" placeholder="请输入类名" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #c9cdd4;
                                border-radius: 4px;
                                font-size: 14px;
                                color: #1f2329;
                                background: white;
                            " required>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #1f2329; font-size: 14px;">Python脚本</label>
                            <div id="uploadArea" style="
                                border: 2px dashed #c9cdd4;
                                border-radius: 6px;
                                padding: 32px;
                                text-align: center;
                                cursor: pointer;
                                transition: border-color 0.2s;
                                background: #f8f9fa;
                            ">
                                <div class="upload-placeholder" style="display: block;">
                                    <div style="font-size: 32px; color: #646a73; margin-bottom: 8px;">📄</div>
                                    <p style="margin: 0; color: #646a73; font-size: 14px;">点击或拖拽上传Python脚本</p>
                                    <p style="margin: 4px 0 0 0; color: #999; font-size: 12px;">仅支持 .py 文件</p>
                                </div>
                                <div id="fileInfo" style="display: none; align-items: center; gap: 12px;">
                                    <div style="flex: 1;">
                                        <div id="fileName" style="color: #1f2329; font-size: 14px; font-weight: 500;"></div>
                                        <div id="fileSize" style="color: #646a73; font-size: 12px;"></div>
                                    </div>
                                    <button type="button" id="removeFile" style="
                                        padding: 4px 8px;
                                        border: 1px solid #c9cdd4;
                                        border-radius: 4px;
                                        background: white;
                                        color: #1f2329;
                                        cursor: pointer;
                                        font-size: 12px;
                                    ">×</button>
                                </div>
                                <input type="file" id="udfFile" accept=".py" style="display: none;">
                            </div>
                        </div>
                    </form>
                    <div class="dialog-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="cancel-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #c9cdd4;
                            border-radius: 4px;
                            background: white;
                            color: #1f2329;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button class="confirm-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #4c89ff;
                            border-radius: 4px;
                            background: #4c89ff;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                        ">确定</button>
                    </div>
                </div>
            </div>
        `;

        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);

        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const closeBtn = dialog.querySelector('.dialog-close-btn');
        const form = dialog.querySelector('#udfForm');
        const uploadArea = dialog.querySelector('#uploadArea');
        const fileInput = dialog.querySelector('#udfFile');
        const removeFile = dialog.querySelector('#removeFile');

        this.selectedFile = null;

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#4c89ff';
                uploadArea.style.background = '#f8faff';
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.style.borderColor = '#c9cdd4';
                uploadArea.style.background = '#f8f9fa';
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#c9cdd4';
                uploadArea.style.background = '#f8f9fa';
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileInDialog(files[0], dialog);
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileInDialog(e.target.files[0], dialog);
                }
            });
        }

        if (removeFile) {
            removeFile.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearFileInDialog(dialog);
            });
        }

        const closeDialog = () => {
            document.body.removeChild(dialog);
            this.selectedFile = null;
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeDialog);
        }

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', () => {
            const type = form.querySelector('#udfType')?.value;
            const name = form.querySelector('#udfName')?.value.trim();
            const className = form.querySelector('#className')?.value.trim();

            if (!type || !name || !className) {
                this.showMessage('请填写完整信息', 'error');
                return;
            }

            if (!this.selectedFile) {
                this.showMessage('请上传Python脚本文件', 'error');
                return;
            }

            const fileToUpload = this.selectedFile;
            closeDialog();
            this.registerUdf(type, name, className, fileToUpload);
        });
    }

    hideModal() {
        const modal = this.querySelector('#udfModal');
        modal.style.display = 'none';
        this.clearFile();
    }

    handleFileInDialog(file, dialog) {
        if (!file.name.endsWith('.py')) {
            this.showMessage('仅支持 Python 脚本文件 (.py)', 'error');
            return;
        }

        this.selectedFile = file;

        const fileInfo = dialog.querySelector('#fileInfo');
        const fileName = dialog.querySelector('#fileName');
        const fileSize = dialog.querySelector('#fileSize');
        const uploadArea = dialog.querySelector('#uploadArea');
        const uploadPlaceholder = dialog.querySelector('.upload-placeholder');

        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        fileInfo.style.display = 'flex';
        uploadPlaceholder.style.display = 'none';
        uploadArea.style.borderColor = '#4c89ff';
        uploadArea.style.background = '#f8faff';
    }

    clearFileInDialog(dialog) {
        this.selectedFile = null;

        const fileInfo = dialog.querySelector('#fileInfo');
        const fileInput = dialog.querySelector('#udfFile');
        const uploadArea = dialog.querySelector('#uploadArea');
        const uploadPlaceholder = dialog.querySelector('.upload-placeholder');

        fileInfo.style.display = 'none';
        uploadPlaceholder.style.display = 'block';
        uploadArea.style.borderColor = '#c9cdd4';
        uploadArea.style.background = '#f8f9fa';

        if (fileInput) {
            fileInput.value = '';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async registerUdf(type, name, className, file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', name);
            formData.append('className', className);
            formData.append('udfType', type);

            const result = await window.AppConfig.upload('udf', 'register', formData);

            if (result.code === 200) {
                this.showMessage('UDF注册成功', 'success');
                this.loadUdfs();
            } else {
                this.showMessage(result.message || '注册失败，请重试', 'error');
            }
        } catch (error) {
            console.error('注册UDF失败:', error);
            this.showMessage('注册失败，请重试', 'error');
        }
    }

    async loadUdfs() {
        try {
            const url = window.AppConfig.getApiUrl('udf', 'query').replace('{type}', 'udf');
            const headers = window.AppConfig.getAuthHeaders();

            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            const result = await response.json();

            if (result.code === 200 && result.data) {
                this.udfs = result.data.map((udf, index) => ({
                    id: index,
                    name: udf.name,
                    type: udf.type,
                    className: udf.className,
                    fileName: udf.fileName,
                    ipPortPair: udf.ipPortPair
                }));
                this.renderTable();
            } else {
                this.showMessage(result.message || '加载UDF列表失败', 'error');
                this.udfs = [];
                this.renderTable();
            }
        } catch (error) {
            console.error('加载UDF列表失败:', error);
            this.showMessage('加载UDF列表失败', 'error');
            this.udfs = [];
            this.renderTable();
        }
    }

    renderTable() {
        const tbody = this.querySelector('#tableBody');
        if (!tbody) return;

        const newTbody = tbody.cloneNode(true);
        tbody.parentNode.replaceChild(newTbody, tbody);

        if (this.udfs.length === 0) {
            newTbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        暂无UDF
                    </td>
                </tr>
            `;
            return;
        }

        newTbody.innerHTML = this.udfs.map(udf => `
            <tr data-id="${udf.id}">
                <td>${udf.name}</td>
                <td><code>${udf.className}</code></td>
                <td>${udf.fileName}</td>
                <td>${udf.ipPortPair}</td>
                <td>${udf.type}</td>
                <td>
                    <button class="action-btn delete" data-id="${udf.id}">删除</button>
                </td>
            </tr>
        `).join('');

        newTbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete')) {
                const id = parseInt(e.target.getAttribute('data-id'));
                this.deleteUdf(id);
            }
        });
    }

    deleteUdf(id) {
        const udf = this.udfs.find(u => u.id === id);
        if (!udf) return;

        const dialogHtml = `
            <div class="dialog-mask" style="
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            ">
                <div class="dialog-content" style="
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                ">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">确认删除</h3>
                    <p style="margin: 0 0 24px 0; color: #646a73; line-height: 1.5;">
                        确定要删除UDF "${udf.name}" 吗？<br><br>
                        <span style="color: #f5222d;">此操作不可恢复！</span>
                    </p>
                    <div class="dialog-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="cancel-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #c9cdd4;
                            border-radius: 4px;
                            background: white;
                            color: #1f2329;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button class="confirm-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #f5222d;
                            border-radius: 4px;
                            background: #f5222d;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                        ">确认删除</button>
                    </div>
                </div>
            </div>
        `;

        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);

        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');

        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', async () => {
            try {
                const udf = this.udfs.find(u => u.id === id);
                if (!udf) {
                    this.showMessage('未找到UDF', 'error');
                    return;
                }

                const url = window.AppConfig.getApiUrl('udf', 'delete').replace('{name}', encodeURIComponent(udf.name));
                const headers = window.AppConfig.getAuthHeaders();

                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: headers
                });

                const result = await response.json();

                if (result.code === 200) {
                    closeDialog();
                    this.udfs = this.udfs.filter(u => u.id !== id);
                    this.renderTable();
                    this.showMessage('UDF删除成功', 'success');
                } else {
                    this.showMessage(result.message || '删除失败，请重试', 'error');
                }
            } catch (error) {
                console.error('删除UDF失败:', error);
                this.showMessage('删除失败，请重试', 'error');
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

    show() {
        this.style.display = 'block';
        this.loadUdfs();
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('udf-management', UdfManagement);
