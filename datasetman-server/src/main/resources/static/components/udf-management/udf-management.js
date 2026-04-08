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
        const modal = this.querySelector('#udfModal');
        modal.style.display = 'flex';
        this.clearForm();
    }

    hideModal() {
        const modal = this.querySelector('#udfModal');
        modal.style.display = 'none';
        this.clearFile();
    }

    clearForm() {
        this.querySelector('#udfType').value = '';
        this.querySelector('#udfName').value = '';
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
        const fileInput = this.querySelector('#udfFile');
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

    async registerUdf() {
        const type = this.querySelector('#udfType').value;
        const name = this.querySelector('#udfName').value.trim();
        const className = this.querySelector('#className').value.trim();

        if (!type || !name || !className) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        if (!this.selectedFile) {
            this.showMessage('请上传Python脚本文件', 'error');
            return;
        }

        const udf = {
            id: Date.now(),
            type,
            name,
            className,
            filePath: `aa/bb/${this.selectedFile.name}`,
            createTime: new Date().toLocaleString()
        };

        try {
            this.udfs.push(udf);
            this.showMessage('UDF注册成功', 'success');
            this.hideModal();
            this.renderTable();
        } catch (error) {
            this.showMessage('注册失败，请重试', 'error');
        }
    }

    async loadUdfs() {
        this.udfs = [
            {
                id: 1,
                type: 'UDSF',
                name: 'sin',
                className: 'UDFSin',
                filePath: 'aa/bb/udtf_sin.py',
                createTime: '2024-01-15 10:30:00'
            },
            {
                id: 2,
                type: 'UDAF',
                name: 'avg_custom',
                className: 'UDFAvgCustom',
                filePath: 'aa/bb/avg_custom.py',
                createTime: '2024-01-10 09:15:00'
            },
            {
                id: 3,
                type: 'UDTF',
                name: 'split_string',
                className: 'UDTSplitString',
                filePath: 'aa/bb/split_string.py',
                createTime: '2024-01-08 11:20:00'
            }
        ];

        this.renderTable();
    }

    renderTable() {
        const tbody = this.querySelector('#tableBody');
        if (!tbody) return;

        const newTbody = tbody.cloneNode(true);
        tbody.parentNode.replaceChild(newTbody, tbody);

        if (this.udfs.length === 0) {
            newTbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        暂无UDF
                    </td>
                </tr>
            `;
            return;
        }

        newTbody.innerHTML = this.udfs.map(udf => `
            <tr data-id="${udf.id}">
                <td>${udf.id}</td>
                <td>${udf.name}</td>
                <td><span class="udf-type-badge ${udf.type}">${udf.type}</span></td>
                <td><code>${udf.className}</code></td>
                <td>${udf.filePath}</td>
                <td>${udf.createTime}</td>
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

        if (confirm(`确定要永久删除UDF "${udf.name}" 吗？此操作不可恢复！`)) {
            this.udfs = this.udfs.filter(u => u.id !== id);
            this.renderTable();
            this.showMessage('UDF删除成功', 'success');
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
        this.loadUdfs();
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('udf-management', UdfManagement);
