/**
 * 血缘路径重跑弹窗：展示选中路径的分步重跑计划，
 * SQL 步骤可编辑（表名替换由后端完成），提交后轮询分步进度。
 * 成功后派发 lineage-fork-completed 事件（detail = { run, leafVersion }），由 main.js 刷新树并打开新版本。
 */
class LineageForkDialog extends HTMLElement {
    constructor() {
        super();
        this.steps = [];        // [{versionId, datasetName, versionNo, provenanceType, provenanceLabel, derivationConfig}]
        this.runId = null;
        this.pollTimer = null;
        this.finished = false;
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        await this.loadResources();
        this.bindEvents();
        this.hide();
    }

    async loadResources() {
        try {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = './components/lineage-fork-dialog/lineage-fork-dialog.css';
            this.shadowRoot.appendChild(cssLink);
        } catch (error) {
            console.error('Failed to load CSS:', error);
        }
        try {
            const response = await fetch('./components/lineage-fork-dialog/lineage-fork-dialog.html');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            this.shadowRoot.innerHTML += html;
        } catch (error) {
            console.error('Failed to load HTML template:', error);
        }
    }

    bindEvents() {
        const $ = (id) => this.shadowRoot.getElementById(id);
        $('forkDialogClose')?.addEventListener('click', () => this.hide());
        $('forkCancelBtn')?.addEventListener('click', () => this.hide());
        $('forkSubmitBtn')?.addEventListener('click', () => this.handleSubmit());
    }

    show(context) {
        this.steps = (context && context.steps) || [];
        if (!this.steps.length) return;
        this.runId = null;
        this.finished = false;
        this.stopPolling();
        const mask = this.shadowRoot.getElementById('forkDialogMask');
        this.shadowRoot.getElementById('forkProgress').style.display = 'none';
        this.shadowRoot.getElementById('forkProgressSteps').innerHTML = '';
        this.shadowRoot.getElementById('forkProgressMessage').textContent = '';
        this.shadowRoot.getElementById('forkProgressMessage').classList.remove('ok');
        const submitBtn = this.shadowRoot.getElementById('forkSubmitBtn');
        submitBtn.disabled = false;
        submitBtn.textContent = '开始重跑';
        this.renderSteps();
        if (mask) mask.classList.add('show');
    }

    hide() {
        this.stopPolling();
        const mask = this.shadowRoot.getElementById('forkDialogMask');
        if (mask) mask.classList.remove('show');
    }

    renderSteps() {
        const container = this.shadowRoot.getElementById('forkSteps');
        container.innerHTML = this.steps.map((s, i) => {
            const isStart = i === 0;
            const plan = this.stepPlan(s, isStart);
            let body = '';
            if (s.provenanceType === 'IMPORT') {
                const sqlText = `select * from ${s.storagePath || '原导入路径'};`;
                const initial = this.escape(sqlText);
                body = `
                    <textarea data-step-index="${i}" data-sql="1" data-initial="${initial}" spellcheck="false">${initial}</textarea>
                    <div class="fork-step-hint">导入数据无法重传文件，将以上述 SELECT * 语句从原导入路径读取并物化为新版本（可编辑）；后端会另存为新的 SQL 脚本。</div>`;
            } else if (this.isSqlType(s.provenanceType)) {
                const sqlText = this.extractSqlList(s.derivationConfig).join('\n');
                const initial = this.escape(sqlText);
                body = `
                    <textarea data-step-index="${i}" data-sql="1" data-initial="${initial}" spellcheck="false">${initial}</textarea>
                    <div class="fork-step-hint">可编辑；多条语句以「;」+ 换行分隔。提交后后端会把语句中的旧版本表名替换为新版本存储路径，并另存为新的 SQL 脚本。</div>`;
            } else if (s.provenanceType === 'TRANSFORM' || s.provenanceType === 'TRANSFORM_SQL') {
                body = `
                    <div class="fork-task-list">${this.escape(this.transformSummary(s.derivationConfig))}</div>
                    <div class="fork-step-hint">重跑时任务 SQL 中的表名自动替换为新版本路径，SQL 脚本与编排均另存为新记录；导出文件自动重命名避免覆盖旧输出，调度策略将被清除（一次性执行）。</div>`;
            } else {
                body = `<div class="fork-step-hint">使用原挂载源路径重新登记一个新挂载版本，不复制数据。</div>`;
            }
            return `
                <div class="fork-step">
                    <div class="fork-step-head">
                        <span class="fork-step-no">${i + 1}</span>
                        <span class="badge ${this.escape(s.provenanceType || '')}">${this.escape(s.provenanceLabel || s.provenanceType || '')}</span>
                        <span class="fork-step-name">${this.escape(s.datasetName)}</span>
                        <span class="fork-step-version">/ ${this.escape(s.versionNo || '')}</span>
                        <span class="fork-step-plan">${this.escape(plan)}</span>
                    </div>
                    <div class="fork-step-body">${body}</div>
                </div>`;
        }).join('');
    }

    stepPlan(s, isStart) {
        if (s.provenanceType === 'SOURCE') return '重新挂载 → 新挂载版本（独立根）';
        if (s.provenanceType === 'IMPORT') return isStart ? 'SELECT * 转化 → SQL 查询新版本（无父级独立根）' : 'SELECT * 转化 → SQL 查询新版本';
        if (this.isSqlType(s.provenanceType)) {
            return isStart ? '重跑 SQL → 新版本（无父级独立根）' : '重跑 SQL → 新版本（上游指向本次生成的新版本）';
        }
        return isStart ? '重新提交 Transform → 新版本（无父级独立根，按原输入重跑）' : '重新提交 Transform → 新版本（上游指向本次生成的新版本）';
    }

    isSqlType(t) {
        return t === 'SQL_QUERY' || t === 'SELECT' || t === 'SELECT_UDF';
    }

    /** 从 derivationConfig 提取 SQL 语句列表（快照中 sqlList 为 JSON 字符串） */
    extractSqlList(cfg) {
        const snippet = cfg && (cfg.sqlSnippet || cfg.sql);
        if (!snippet) return [];
        let list = [];
        try {
            list = typeof snippet.sqlList === 'string'
                ? JSON.parse(snippet.sqlList)
                : (Array.isArray(snippet.sqlList) ? snippet.sqlList : []);
        } catch (e) {
            list = [];
        }
        // 保留语句原文（含尾部分号，IginX 解析器要求）
        return list.map(sql => String(sql || '').trim());
    }

    transformSummary(cfg) {
        const cmp = cfg && (cfg.transformCompare || cfg.transformJob);
        if (!cmp) return '（缺少 Transform 编排快照）';
        const lines = [];
        if (cmp.name) lines.push(`编排名称: ${cmp.name}`);
        if (cmp.exportFile) lines.push(`原输出文件: ${cmp.exportFile}`);
        let tasks = [];
        try {
            tasks = typeof cmp.taskList === 'string' ? JSON.parse(cmp.taskList) : (Array.isArray(cmp.taskList) ? cmp.taskList : []);
        } catch (e) { tasks = []; }
        tasks.forEach((t, i) => {
            const typeLabel = t.taskType === 0 ? 'IGinX' : (t.taskType === 1 ? 'Python' : '未知');
            let detail = t.sqlSnippetName ? `SQL脚本: ${t.sqlSnippetName}`
                : (t.sqlSnippetId ? `SQL脚本#${t.sqlSnippetId}` : (t.dataset || t.pyTaskName || ''));
            lines.push(`任务${i + 1}: ${typeLabel} / ${detail}`);
        });
        return lines.join('\n');
    }

    async handleSubmit() {
        if (this.finished && this.runId) {
            this.hide();
            return;
        }
        const submitBtn = this.shadowRoot.getElementById('forkSubmitBtn');
        // 收集 SQL 步骤的编辑内容（仅收集确实被修改过的步骤；按「;+换行」拆回语句列表）
        const stepEdits = {};
        this.shadowRoot.querySelectorAll('textarea[data-sql]').forEach(ta => {
            if (ta.value === (ta.dataset.initial || '')) return;
            const idx = Number(ta.dataset.stepIndex);
            const statements = ta.value.split(/;\s*\n/).map(s => s.trim()).filter(s => s);
            if (statements.length) {
                stepEdits[String(this.steps[idx].versionId)] = statements;
            }
        });

        const payload = {
            forkVersionId: this.steps[0].versionId,
            pathVersionIds: this.steps.map(s => s.versionId),
            stepEdits: stepEdits
        };

        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';
        try {
            const result = await window.AppConfig.post('dataset', 'lineageFork', payload);
            if (!(result.success || result.code === 200) || !result.data) {
                throw new Error(result.message || '提交失败');
            }
            this.runId = result.data.runId;
            this.shadowRoot.getElementById('forkProgress').style.display = 'block';
            submitBtn.textContent = '重跑中...';
            this.startPolling();
        } catch (error) {
            this.toast(error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '开始重跑';
        }
    }

    startPolling() {
        this.stopPolling();
        this.pollTimer = setInterval(() => this.pollStatus(), 2000);
        this.pollStatus();
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    async pollStatus() {
        if (!this.runId) return;
        try {
            const result = await window.AppConfig.get('dataset', 'lineageForkStatus', { runId: this.runId });
            if (!(result.success || result.code === 200) || !result.data) {
                throw new Error(result.message || '查询重跑进度失败');
            }
            this.renderProgress(result.data);
            if (result.data.status === 'SUCCESS' || result.data.status === 'FAILED') {
                this.finished = true;
                this.stopPolling();
                const msg = this.shadowRoot.getElementById('forkProgressMessage');
                const submitBtn = this.shadowRoot.getElementById('forkSubmitBtn');
                if (result.data.status === 'SUCCESS') {
                    msg.classList.add('ok');
                    msg.textContent = result.data.message || '路径重跑完成';
                    submitBtn.textContent = '完成并关闭';
                    const last = (result.data.steps || []).filter(s => s.newVersionId).pop();
                    this.dispatchEvent(new CustomEvent('lineage-fork-completed', {
                        bubbles: true,
                        composed: true,
                        detail: {
                            run: result.data,
                            leafVersion: last ? {
                                id: last.newVersionId,
                                createTime: last.newVersionId,
                                datasetName: last.datasetName,
                                versionNo: last.newVersionNo
                            } : null
                        }
                    }));
                } else {
                    msg.classList.remove('ok');
                    msg.textContent = result.data.message || '路径重跑失败';
                    submitBtn.textContent = '关闭';
                    submitBtn.disabled = false;
                }
            }
        } catch (error) {
            // 单次轮询失败不中断，下一轮重试
            console.warn('轮询重跑进度失败:', error.message);
        }
    }

    renderProgress(run) {
        const runSteps = run.steps || [];
        const iconMap = { PENDING: '○', RUNNING: '◐', SUCCESS: '✓', FAILED: '✗' };
        const labelMap = { PENDING: '等待', RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败' };
        const newNo = new Map(runSteps.filter(s => s.newVersionNo).map(s => [s.originVersionId, s.newVersionNo]));
        this.shadowRoot.getElementById('forkProgressSteps').innerHTML = runSteps.map(s => `
            <div class="fork-progress-step ${this.escape(s.status || 'PENDING')}">
                <span class="status-icon">${iconMap[s.status] || '○'}</span>
                <span>${this.escape(s.datasetName)}${s.newVersionNo ? ` / ${this.escape(s.newVersionNo)}（新）` : ''}</span>
                <span class="fork-progress-status">${labelMap[s.status] || s.status || '等待'}${s.message ? '：' + this.escape(s.message) : ''}</span>
            </div>`).join('');
        const msg = this.shadowRoot.getElementById('forkProgressMessage');
        if (run.status === 'RUNNING') {
            msg.classList.remove('ok');
            const done = runSteps.filter(s => s.status === 'SUCCESS').length;
            msg.textContent = `正在执行第 ${Math.min((run.currentStepIndex != null ? run.currentStepIndex : 0) + 1, run.totalSteps)} / ${run.totalSteps} 步（已完成 ${done} 步），Transform 作业可能需要等待...`;
        }
    }

    toast(msg, type) {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            window.CommonUtils.showToast(msg, type || 'success');
        } else {
            alert(msg);
        }
    }

    escape(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}

customElements.define('lineage-fork-dialog', LineageForkDialog);
