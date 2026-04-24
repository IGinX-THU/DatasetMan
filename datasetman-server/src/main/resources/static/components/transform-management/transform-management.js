class TransformManagement extends HTMLElement {
    constructor() {
        super();
        this.transforms = [];
        this.selectedFile = null;
    }

    connectedCallback() {
        this.style.display = 'none';

        this.innerHTML = `
            <link rel="stylesheet" href="./components/transform-management/transform-management.css">
        `;

        fetch('./components/transform-management/transform-management.html')
            .then(response => response.text())
            .then(html => {
                this.innerHTML += html;
                this.initEventListeners();
            });
    }

    initEventListeners() {
        const registerBtn = this.querySelector('#registerTransformBtn');
        const refreshBtn = this.querySelector('#refreshBtn');
        const closeModal = this.querySelector('#closeModal');
        const cancelBtn = this.querySelector('#cancelBtn');
        const transformForm = this.querySelector('#transformForm');
        const uploadArea = this.querySelector('#uploadArea');
        const fileInput = this.querySelector('#transformFile');
        const removeFile = this.querySelector('#removeFile');

        if (registerBtn) {
            registerBtn.addEventListener('click', () => this.showModal());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadTransforms());
        }

        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideModal());
        }

        if (transformForm) {
            transformForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.registerTransform();
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

        // 点击遮罩关闭
        const modalMask = this.querySelector('#modalMask');
        if (modalMask) {
            modalMask.addEventListener('click', (e) => {
                if (e.target === modalMask) {
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
                ">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">注册Transform</h3>
                    <form id="transformForm" style="margin-bottom: 24px;">
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #1f2329; font-size: 14px;">Transform名称</label>
                            <input type="text" id="transformName" placeholder="请输入Transform名称" style="
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
                                <input type="file" id="transformFile" accept=".py" style="display: none;">
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
        const form = dialog.querySelector('#transformForm');
        const uploadArea = dialog.querySelector('#uploadArea');
        const fileInput = dialog.querySelector('#transformFile');
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

        cancelBtn.addEventListener('click', closeDialog);

        confirmBtn.addEventListener('click', () => {
            const name = form.querySelector('#transformName')?.value.trim();
            const className = form.querySelector('#className')?.value.trim();

            if (!name || !className) {
                this.showMessage('请填写完整信息', 'error');
                return;
            }

            if (!this.selectedFile) {
                this.showMessage('请上传Python脚本文件', 'error');
                return;
            }

            const fileToUpload = this.selectedFile;
            closeDialog();
            this.registerTransform(name, className, fileToUpload);
        });
    }

    hideModal() {
        const modalMask = this.querySelector('#modalMask');
        if (modalMask) {
            modalMask.hidden = true;
            modalMask.style.display = 'none';
        }
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
        const fileInput = dialog.querySelector('#transformFile');
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

    async registerTransform(name, className, file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', name);
            formData.append('className', className);

            const result = await window.AppConfig.upload('transform', 'register', formData);

            if (result.code === 200) {
                this.showMessage('Transform注册成功', 'success');
                this.loadTransforms();
            } else {
                this.showMessage(result.message || '注册失败，请重试', 'error');
            }
        } catch (error) {
            console.error('注册Transform失败:', error);
            this.showMessage('注册失败，请重试', 'error');
        }
    }

    async loadTransforms() {
        // 模拟数据
        this.transforms = [
            {
                id: 1,
                name: 'row_sum',
                className: 'RowSumTransformer',
                filePath: 'data/script/row_sum.py',
                createTime: '2024-01-15 10:30:00'
            },
            {
                id: 2,
                name: 'data_clean',
                className: 'DataCleanTransformer',
                filePath: 'data/script/data_clean.py',
                createTime: '2024-01-10 09:15:00'
            }
        ];

        this.renderTable();
    }

    renderTable() {
        const tbody = this.querySelector('#tableBody');
        if (!tbody) return;

        const newTbody = tbody.cloneNode(true);
        tbody.parentNode.replaceChild(newTbody, tbody);

        if (this.transforms.length === 0) {
            newTbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        暂无Transform
                    </td>
                </tr>
            `;
            return;
        }

        newTbody.innerHTML = this.transforms.map(transform => `
            <tr data-id="${transform.id}">
                <td>${transform.id}</td>
                <td>${transform.name}</td>
                <td><code>${transform.className}</code></td>
                <td>${transform.filePath}</td>
                <td>${transform.createTime}</td>
                <td>
                    <button class="action-btn delete" data-id="${transform.id}">删除</button>
                </td>
            </tr>
        `).join('');

        newTbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete')) {
                const id = parseInt(e.target.getAttribute('data-id'));
                this.deleteTransform(id);
            }
        });
    }

    deleteTransform(id) {
        const transform = this.transforms.find(t => t.id === id);
        if (!transform) return;

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
                        确定要删除Transform "${transform.name}" 吗？<br><br>
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
                const transform = this.transforms.find(t => t.id === id);
                if (!transform) {
                    this.showMessage('未找到Transform', 'error');
                    return;
                }

                const url = window.AppConfig.getApiUrl('transform', 'delete').replace('{name}', encodeURIComponent(transform.name));
                const headers = window.AppConfig.getAuthHeaders();

                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: headers
                });

                const result = await response.json();

                if (result.code === 200) {
                    closeDialog();
                    this.transforms = this.transforms.filter(t => t.id !== id);
                    this.renderTable();
                    this.showMessage('Transform删除成功', 'success');
                } else {
                    this.showMessage(result.message || '删除失败，请重试', 'error');
                }
            } catch (error) {
                console.error('删除Transform失败:', error);
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
        this.loadTransforms();
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('transform-management', TransformManagement);
