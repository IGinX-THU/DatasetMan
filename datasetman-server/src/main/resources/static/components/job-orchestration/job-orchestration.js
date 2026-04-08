class JobOrchestration extends HTMLElement {
    constructor() {
        super();
        this.jobs = [];
    }

    connectedCallback() {
        this.style.display = 'none';

        this.innerHTML = `
            <link rel="stylesheet" href="./components/job-orchestration/job-orchestration.css">
        `;

        fetch('./components/job-orchestration/job-orchestration.html')
            .then(response => response.text())
            .then(html => {
                this.innerHTML += html;
                this.initEventListeners();
            });
    }

    initEventListeners() {
        const createBtn = this.querySelector('#createJobBtn');
        const refreshBtn = this.querySelector('#refreshBtn');
        const closeModal = this.querySelector('#closeModal');
        const cancelBtn = this.querySelector('#cancelBtn');
        const jobForm = this.querySelector('#jobForm');
        const outputTarget = this.querySelector('#outputTarget');

        if (createBtn) {
            createBtn.addEventListener('click', () => this.showModal());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadJobs());
        }

        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideModal());
        }

        if (jobForm) {
            jobForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveJob();
            });
        }

        if (outputTarget) {
            outputTarget.addEventListener('change', (e) => {
                const filePathGroup = this.querySelector('#filePathGroup');
                filePathGroup.style.display = e.target.value === 'file' ? 'block' : 'none';
            });
        }

        const modal = this.querySelector('#jobModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }
    }

    showModal() {
        const modal = this.querySelector('#jobModal');
        modal.style.display = 'flex';
        this.clearForm();
    }

    hideModal() {
        const modal = this.querySelector('#jobModal');
        modal.style.display = 'none';
    }

    clearForm() {
        this.querySelector('#jobName').value = '';
        this.querySelector('#taskType').value = '';
        this.querySelector('#dataset').value = '';
        this.querySelector('#transformFunc').value = '';
        this.querySelector('#outputTarget').value = 'None';
        this.querySelector('#exportFile').value = '';
        this.querySelector('#schedule').value = '0 0/1 * 1/1 * ? *';
        this.querySelector('#filePathGroup').style.display = 'none';
    }

    async saveJob() {
        const name = this.querySelector('#jobName').value.trim();
        const taskType = this.querySelector('#taskType').value;
        const dataset = this.querySelector('#dataset').value;
        const transformFunc = this.querySelector('#transformFunc').value;
        const dataFlow = this.querySelector('input[name="dataFlow"]:checked').value;
        const outputTarget = this.querySelector('#outputTarget').value;
        const schedule = this.querySelector('#schedule').value;

        if (!name || !taskType || !dataset || !transformFunc) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        const job = {
            id: Date.now(),
            name,
            taskType,
            dataFlow,
            outputTarget,
            schedule,
            dataset,
            transformFunc,
            createTime: new Date().toLocaleString()
        };

        try {
            this.jobs.push(job);
            this.showMessage('作业编排成功', 'success');
            this.hideModal();
            this.renderTable();
        } catch (error) {
            this.showMessage('保存失败，请重试', 'error');
        }
    }

    async loadJobs() {
        this.jobs = [
            {
                id: 1,
                name: 'transform_job_01',
                taskType: 'python',
                dataFlow: 'stream',
                outputTarget: 'file',
                schedule: '0 0/1 * 1/1 * ? *',
                dataset: 'dataset_01',
                transformFunc: 'row_sum',
                createTime: '2024-01-15 10:30:00'
            },
            {
                id: 2,
                name: 'daily_cleanup_job',
                taskType: 'IGinX',
                dataFlow: 'batch',
                outputTarget: 'IGinX',
                schedule: '0 0 0 * * ? *',
                dataset: 'dataset_02',
                transformFunc: 'data_clean',
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

        if (this.jobs.length === 0) {
            newTbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        暂无作业
                    </td>
                </tr>
            `;
            return;
        }

        newTbody.innerHTML = this.jobs.map(job => `
            <tr data-id="${job.id}">
                <td>${job.id}</td>
                <td>${job.name}</td>
                <td>${job.taskType}</td>
                <td><span class="flow-badge ${job.dataFlow}">${job.dataFlow}</span></td>
                <td>${job.outputTarget}</td>
                <td><code>${job.schedule}</code></td>
                <td>${job.createTime}</td>
                <td>
                    <button class="action-btn run" data-id="${job.id}">运行</button>
                    <button class="action-btn edit" data-id="${job.id}">编辑</button>
                    <button class="action-btn delete" data-id="${job.id}">删除</button>
                </td>
            </tr>
        `).join('');

        newTbody.addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (e.target.classList.contains('run')) {
                this.runJob(id);
            } else if (e.target.classList.contains('edit')) {
                this.editJob(id);
            } else if (e.target.classList.contains('delete')) {
                this.deleteJob(id);
            }
        });
    }

    runJob(id) {
        const job = this.jobs.find(j => j.id === id);
        if (!job) return;

        // 触发作业执行监控显示
        const jobExecution = document.getElementById('jobExecution');
        if (jobExecution) {
            jobExecution.show(job);
            this.hide();
        }
    }

    editJob(id) {
        const job = this.jobs.find(j => j.id === id);
        if (!job) return;

        // 填充表单进行编辑
        this.querySelector('#jobName').value = job.name;
        this.querySelector('#taskType').value = job.taskType;
        this.querySelector('#dataset').value = job.dataset;
        this.querySelector('#transformFunc').value = job.transformFunc;
        this.querySelector(`input[name="dataFlow"][value="${job.dataFlow}"]`).checked = true;
        this.querySelector('#outputTarget').value = job.outputTarget;
        this.querySelector('#schedule').value = job.schedule;

        this.showModal();
    }

    deleteJob(id) {
        const job = this.jobs.find(j => j.id === id);
        if (!job) return;

        if (confirm(`确定要删除作业 "${job.name}" 吗？此操作不可恢复！`)) {
            this.jobs = this.jobs.filter(j => j.id !== id);
            this.renderTable();
            this.showMessage('作业删除成功', 'success');
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
        this.loadJobs();
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('job-orchestration', JobOrchestration);
