class JobExecution extends HTMLElement {
    constructor() {
        super();
        this.job = null;
        this.tasks = [];
        this.logs = [];
    }

    connectedCallback() {
        this.style.display = 'none';

        this.innerHTML = `
            <link rel="stylesheet" href="./components/job-execution/job-execution.css">
        `;

        fetch('./components/job-execution/job-execution.html')
            .then(response => response.text())
            .then(html => {
                this.innerHTML += html;
                this.initEventListeners();
            });
    }

    initEventListeners() {
        const backBtn = this.querySelector('#backBtn');
        const refreshBtn = this.querySelector('#refreshBtn');
        const clearLogsBtn = this.querySelector('#clearLogsBtn');
        const downloadLogsBtn = this.querySelector('#downloadLogsBtn');
        const tabs = this.querySelectorAll('.tab-item');

        if (backBtn) {
            backBtn.addEventListener('click', () => this.goBack());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshStatus());
        }

        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }

        if (downloadLogsBtn) {
            downloadLogsBtn.addEventListener('click', () => this.downloadLogs());
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
    }

    show(job) {
        this.job = job;
        this.style.display = 'block';

        // 生成模拟任务数据
        this.tasks = [
            {
                id: `task_${job.id}_001`,
                type: job.taskType || 'IGinX',
                dataset: job.dataset || 'dataset_01',
                transform: job.transformFunc || 'row_sum',
                status: 'RUNNING',
                progress: 45
            },
            {
                id: `task_${job.id}_002`,
                type: 'python',
                dataset: job.dataset || 'dataset_01',
                transform: 'data_clean',
                status: 'IDLE',
                progress: 0
            }
        ];

        this.logs = [
            { time: new Date().toLocaleString(), level: 'info', message: `作业 ${job.name} 开始执行` },
            { time: new Date().toLocaleString(), level: 'info', message: `任务 1: 加载数据集 ${job.dataset || 'dataset_01'}` },
            { time: new Date().toLocaleString(), level: 'success', message: '数据集加载完成，共 10000 条记录' },
            { time: new Date().toLocaleString(), level: 'info', message: `执行任务: ${job.transformFunc || 'row_sum'}` },
            { time: new Date().toLocaleString(), level: 'warning', message: '数据降采样处理中...' }
        ];

        this.renderJobInfo();
        this.renderTasks();
        this.renderLogs();
        this.renderResults();
    }

    hide() {
        this.style.display = 'none';
        this.job = null;
    }

    goBack() {
        this.hide();
        const jobOrchestration = document.getElementById('jobOrchestration');
        if (jobOrchestration) {
            jobOrchestration.show();
        }
    }

    switchTab(tabName) {
        this.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        this.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        this.querySelector(`#${tabName}Tab`).classList.add('active');
    }

    renderJobInfo() {
        if (!this.job) return;

        const jobId = this.querySelector('#jobId');
        const jobName = this.querySelector('#jobName');
        const jobStatus = this.querySelector('#jobStatus');
        const jobTitle = this.querySelector('#jobTitle');
        const startTime = this.querySelector('#startTime');
        const endTime = this.querySelector('#endTime');
        const duration = this.querySelector('#duration');

        if (jobId) jobId.textContent = `job_${this.job.id}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}`;
        if (jobName) jobName.textContent = this.job.name;
        if (jobTitle) jobTitle.textContent = `作业执行监控：${this.job.name}`;

        // 模拟状态
        const status = 'RUNNING';
        if (jobStatus) {
            jobStatus.textContent = status;
            jobStatus.className = 'status-badge running';
        }

        const now = new Date().toLocaleString();
        if (startTime) startTime.textContent = now;
        if (endTime) endTime.textContent = '-';
        if (duration) duration.textContent = '00:02:35';
    }

    renderTasks() {
        const tbody = this.querySelector('#tasksTableBody');
        if (!tbody) return;

        if (this.tasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        暂无任务
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.tasks.map(task => `
            <tr>
                <td>${task.id}</td>
                <td>${task.type}</td>
                <td>${task.dataset}</td>
                <td>${task.transform}</td>
                <td><span class="status-badge ${task.status.toLowerCase()}">${task.status}</span></td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${task.progress}%"></div>
                    </div>
                    <small>${task.progress}%</small>
                </td>
            </tr>
        `).join('');
    }

    renderLogs() {
        const logOutput = this.querySelector('#logOutput');
        if (!logOutput) return;

        if (this.logs.length === 0) {
            logOutput.innerHTML = '<div class="log-line">等待任务执行...</div>';
            return;
        }

        logOutput.innerHTML = this.logs.map(log => `
            <div class="log-line ${log.level}">[${log.time}] [${log.level.toUpperCase()}] ${log.message}</div>
        `).join('');

        // 滚动到底部
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    renderResults() {
        const processedCount = this.querySelector('#processedCount');
        const outputCount = this.querySelector('#outputCount');
        const errorCount = this.querySelector('#errorCount');
        const resultOutput = this.querySelector('#resultOutput');

        // 模拟结果数据
        if (processedCount) processedCount.textContent = '10,000';
        if (outputCount) outputCount.textContent = '8,500';
        if (errorCount) errorCount.textContent = '0';

        if (resultOutput) {
            resultOutput.textContent = `Transform执行结果预览：
========================================
输入记录数: 10000
输出记录数: 8500
处理时间: 2分35秒
状态: 执行中

输出样本：
row_1: [1.23, 4.56, 7.89]
row_2: [2.34, 5.67, 8.90]
row_3: [3.45, 6.78, 9.01]
...`;
        }
    }

    refreshStatus() {
        // 模拟刷新状态
        this.tasks.forEach(task => {
            if (task.status === 'RUNNING') {
                task.progress = Math.min(task.progress + 10, 100);
                if (task.progress >= 100) {
                    task.status = 'FINISHED';
                }
            } else if (task.status === 'IDLE') {
                task.status = 'RUNNING';
            }
        });

        // 添加新日志
        this.logs.push({
            time: new Date().toLocaleString(),
            level: 'info',
            message: `状态刷新: 任务进度更新`
        });

        this.renderJobInfo();
        this.renderTasks();
        this.renderLogs();
    }

    clearLogs() {
        this.logs = [];
        this.renderLogs();
    }

    downloadLogs() {
        const logContent = this.logs.map(log => `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`).join('\n');
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `job_${this.job?.id || 'unknown'}_logs.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

customElements.define('job-execution', JobExecution);
