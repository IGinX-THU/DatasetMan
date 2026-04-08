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
        const modal = this.querySelector('#transformModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }
    }

    showModal() {
        const modal = this.querySelector('#transformModal');
        modal.style.display = 'flex';
        this.clearForm();
    }

    hideModal() {
        const modal = this.querySelector('#transformModal');
        modal.style.display = 'none';
        this.clearFile();
    }

    clearForm() {
        this.querySelector('#transformName').value = '';
        this.querySelector('#className').value = '';
        this.clearFile();
    }

    handleFile(file) {
        if (!file.name.endsWith('.py')) {
            this.showMessage('仅支持 Python 脚本文件 (.py)', 'error');
            return;
        }

        this.selectedFile = file;

        const fileInfo = this.querySelector('#fileInfo');
        const fileName = this.querySelector('#fileName');
        const fileSize = this.querySelector('#fileSize');
        const uploadArea = this.querySelector('#uploadArea');
        const uploadPlaceholder = this.querySelector('.upload-placeholder');

        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        fileInfo.style.display = 'flex';
        uploadPlaceholder.style.display = 'none';
        uploadArea.classList.add('has-file');
    }

    clearFile() {
        this.selectedFile = null;

        const fileInfo = this.querySelector('#fileInfo');
        const fileInput = this.querySelector('#transformFile');
        const uploadArea = this.querySelector('#uploadArea');
        const uploadPlaceholder = this.querySelector('.upload-placeholder');

        fileInfo.style.display = 'none';
        uploadPlaceholder.style.display = 'block';
        uploadArea.classList.remove('has-file');

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

    async registerTransform() {
        const name = this.querySelector('#transformName').value.trim();
        const className = this.querySelector('#className').value.trim();

        if (!name || !className) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        if (!this.selectedFile) {
            this.showMessage('请上传Python脚本文件', 'error');
            return;
        }

        const transform = {
            id: Date.now(),
            name,
            className,
            filePath: `data/script/${this.selectedFile.name}`,
            createTime: new Date().toLocaleString()
        };

        try {
            // 模拟注册
            this.transforms.push(transform);
            this.showMessage('Transform注册成功', 'success');
            this.hideModal();
            this.renderTable();
        } catch (error) {
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

        if (confirm(`确定要永久删除Transform "${transform.name}" 吗？此操作不可恢复！`)) {
            this.transforms = this.transforms.filter(t => t.id !== id);
            this.renderTable();
            this.showMessage('Transform删除成功', 'success');
        }
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
