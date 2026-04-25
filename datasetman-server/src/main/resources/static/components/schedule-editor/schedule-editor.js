class ScheduleEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.scheduleValue = '';
    }

    connectedCallback() {
        this.render();
        this.bindEvents();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                .schedule-editor {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .schedule-tabs {
                    display: flex;
                    border-bottom: 1px solid #dcdfe6;
                    margin-bottom: 16px;
                }
                .schedule-tab {
                    padding: 8px 16px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    color: #606266;
                    font-size: 14px;
                }
                .schedule-tab.active {
                    color: #409eff;
                    border-bottom-color: #409eff;
                }
                .schedule-tab-content {
                    display: none;
                }
                .schedule-tab-content.active {
                    display: block;
                }
                .schedule-field {
                    margin-bottom: 16px;
                }
                .schedule-field-label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #303133;
                }
                .schedule-input {
                    padding: 8px 12px;
                    border: 1px solid #dcdfe6;
                    border-radius: 4px;
                    width: 100%;
                    box-sizing: border-box;
                    font-size: 14px;
                }
                .schedule-input:focus {
                    outline: none;
                    border-color: #409eff;
                }
                .schedule-select {
                    padding: 8px 12px;
                    border: 1px solid #dcdfe6;
                    border-radius: 4px;
                    font-size: 14px;
                }
                .schedule-input-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .schedule-input-group input {
                    padding: 6px 12px;
                    border: 1px solid #dcdfe6;
                    border-radius: 4px;
                    width: 80px;
                }
                .schedule-input-group input[type="datetime-local"] {
                    width: auto;
                }
                .schedule-preview {
                    margin-top: 16px;
                    padding: 12px;
                    background: #f5f7fa;
                    border-radius: 4px;
                    font-size: 13px;
                    color: #606266;
                }
                .schedule-preview code {
                    background: #fff;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: monospace;
                    color: #409eff;
                }
                .cron-expression-row {
                    margin-bottom: 20px;
                }
                .cron-expression-input-row {
                    display: flex;
                    gap: 8px;
                }
                .cron-expression-input-row input {
                    flex: 1;
                }
                .cron-fields-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                }
                .cron-field-card {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .cron-field-select {
                    margin-bottom: 8px;
                }
                .cron-field-input {
                    width: 100%;
                }
                .cron-presets {
                    margin-top: 20px;
                }
                .cron-presets-title {
                    font-weight: 600;
                    margin-bottom: 12px;
                    font-size: 14px;
                }
                .cron-presets-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: 8px;
                }
                .cron-preset-btn {
                    padding: 6px 12px;
                    border: 1px solid #dcdfe6;
                    background: #fff;
                    border-radius: 16px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.3s;
                }
                .cron-preset-btn:hover {
                    border-color: #409eff;
                    color: #409eff;
                }
                .cron-preview {
                    margin-top: 20px;
                }
                .cron-preview-title {
                    font-weight: 600;
                    margin-bottom: 12px;
                    font-size: 14px;
                }
                .cron-desc-card {
                    background: #e6f7ff;
                    border: 1px solid #91d5ff;
                    border-radius: 4px;
                    padding: 12px;
                    margin-bottom: 12px;
                }
                .cron-desc-label {
                    font-size: 12px;
                    color: #606266;
                    margin-bottom: 4px;
                }
                .cron-desc-text {
                    font-size: 14px;
                    color: #303133;
                }
                .cron-next-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .cron-next-item {
                    padding: 8px 12px;
                    background: #f5f7fa;
                    border-radius: 4px;
                    font-size: 13px;
                    color: #606266;
                }
            </style>
            <div class="schedule-editor">
                <div class="schedule-tabs">
                    <div class="schedule-tab active" data-tab="every">重复执行</div>
                    <div class="schedule-tab" data-tab="after">延后执行</div>
                    <div class="schedule-tab" data-tab="at">定时执行</div>
                    <div class="schedule-tab" data-tab="cron">Cron格式</div>
                </div>
                
                <div class="schedule-tab-content active" id="every">
                    <div class="schedule-field">
                        <label class="schedule-field-label">重复模式</label>
                        <select class="schedule-select" id="every-mode">
                            <option value="interval">按间隔重复</option>
                            <option value="weekday">按星期重复</option>
                        </select>
                    </div>
                    <div class="schedule-field" id="every-interval">
                        <label class="schedule-field-label">间隔设置</label>
                        <div class="schedule-input-group">
                            <span>每</span>
                            <input type="number" id="every-interval-value" value="1" min="1">
                            <select class="schedule-select" id="every-interval-unit">
                                <option value="second">秒</option>
                                <option value="minute">分钟</option>
                                <option value="hour">小时</option>
                                <option value="day">天</option>
                                <option value="month">月</option>
                                <option value="year">年</option>
                            </select>
                            <span>执行一次</span>
                        </div>
                    </div>
                    <div class="schedule-field" id="every-weekday" style="display: none;">
                        <label class="schedule-field-label">选择星期</label>
                        <div class="weekday-checkboxes">
                            <label class="weekday-checkbox"><input type="checkbox" value="mon"> 周一</label>
                            <label class="weekday-checkbox"><input type="checkbox" value="wed"> 周三</label>
                            <label class="weekday-checkbox"><input type="checkbox" value="fri"> 周五</label>
                        </div>
                    </div>
                    <div class="schedule-field">
                        <label class="schedule-field-label">开始时间（可选）</label>
                        <div class="schedule-input-group">
                            <input type="datetime-local" id="every-starts" step="1" style="width: 250px;">
                        </div>
                    </div>
                    <div class="schedule-field">
                        <label class="schedule-field-label">结束时间（可选）</label>
                        <div class="schedule-input-group">
                            <input type="datetime-local" id="every-ends" step="1" style="width: 250px;">
                        </div>
                    </div>
                </div>
                
                <div class="schedule-tab-content" id="after">
                    <div class="schedule-field">
                        <label class="schedule-field-label">延后时间</label>
                        <div class="schedule-input-group">
                            <span>延后</span>
                            <input type="number" id="after-value" value="3" min="1">
                            <select class="schedule-select" id="after-unit">
                                <option value="second">秒</option>
                                <option value="minute">分钟</option>
                                <option value="hour">小时</option>
                                <option value="day">天</option>
                                <option value="month">月</option>
                                <option value="year">年</option>
                            </select>
                            <span>后执行一次</span>
                        </div>
                    </div>
                </div>
                
                <div class="schedule-tab-content" id="at">
                    <div class="schedule-field">
                        <label class="schedule-field-label">选择日期（默认今天）</label>
                        <div class="schedule-input-group">
                            <input type="date" id="at-date" style="width: 150px;">
                        </div>
                    </div>
                    <div class="schedule-field">
                        <label class="schedule-field-label">选择时间</label>
                        <div class="schedule-input-group">
                            <input type="time" id="at-time" step="1" style="width: 150px;">
                        </div>
                    </div>
                </div>
                
                <div class="schedule-tab-content" id="cron">
                    <div class="cron-expression-row">
                        <label class="schedule-label">Cron表达式</label>
                        <div class="cron-expression-input-row">
                            <input type="text" id="cron-expression-input" placeholder="通过下方控件构建 Cron 表达式，或直接在此编辑" class="schedule-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                            <button type="button" id="cron-copy-btn" class="schedule-btn schedule-btn--primary">复制</button>
                        </div>
                    </div>
                    <div class="cron-fields-grid">
                        <article class="cron-field-card">
                            <label class="schedule-label">秒</label>
                            <select class="schedule-select cron-field-select" data-field="second">
                                <option value="*">每个值 (*)</option>
                                <option value="specific">指定值</option>
                                <option value="range">范围</option>
                                <option value="step">步长</option>
                            </select>
                            <input type="text" class="schedule-input cron-field-input" data-field="second" placeholder="例如：0,15,30,45 或 */10" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                        </article>
                        <article class="cron-field-card">
                            <label class="schedule-label">分</label>
                            <select class="schedule-select cron-field-select" data-field="minute">
                                <option value="*">每个值 (*)</option>
                                <option value="specific">指定值</option>
                                <option value="range">范围</option>
                                <option value="step">步长</option>
                            </select>
                            <input type="text" class="schedule-input cron-field-input" data-field="minute" placeholder="例如：0,15,30,45 或 */5" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                        </article>
                        <article class="cron-field-card">
                            <label class="schedule-label">时</label>
                            <select class="schedule-select cron-field-select" data-field="hour">
                                <option value="*">每个值 (*)</option>
                                <option value="specific">指定值</option>
                                <option value="range">范围</option>
                                <option value="step">步长</option>
                            </select>
                            <input type="text" class="schedule-input cron-field-input" data-field="hour" placeholder="例如：0,12 或 9-18" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                        </article>
                        <article class="cron-field-card">
                            <label class="schedule-label">日</label>
                            <select class="schedule-select cron-field-select" data-field="day">
                                <option value="*">每个值 (*)</option>
                                <option value="?">不指定 (?)</option>
                                <option value="specific">指定值</option>
                                <option value="range">范围</option>
                                <option value="step">步长</option>
                            </select>
                            <input type="text" class="schedule-input cron-field-input" data-field="day" placeholder="例如：1,15 或 1-31" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                        </article>
                        <article class="cron-field-card">
                            <label class="schedule-label">月</label>
                            <select class="schedule-select cron-field-select" data-field="month">
                                <option value="*">每个值 (*)</option>
                                <option value="specific">指定值</option>
                                <option value="range">范围</option>
                            </select>
                            <input type="text" class="schedule-input cron-field-input" data-field="month" placeholder="例如：1,6 或 1-12" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                        </article>
                        <article class="cron-field-card">
                            <label class="schedule-label">周</label>
                            <select class="schedule-select cron-field-select" data-field="week">
                                <option value="*">每个值 (*)</option>
                                <option value="?">不指定 (?)</option>
                                <option value="specific">指定值</option>
                                <option value="range">范围</option>
                            </select>
                            <input type="text" class="schedule-input cron-field-input" data-field="week" placeholder="例如：1,5 或 1-7" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                        </article>
                    </div>
                    <div class="cron-presets">
                        <div class="cron-presets-title">常用时间预设</div>
                        <div class="cron-presets-grid">
                            <button type="button" class="cron-preset-btn" data-cron="* * * * * ?" title="每分钟执行一次">每分钟</button>
                            <button type="button" class="cron-preset-btn" data-cron="0 * * * * ?" title="每小时的第0分钟执行">每小时</button>
                            <button type="button" class="cron-preset-btn" data-cron="0 0 * * * ?" title="每天午夜执行">每天</button>
                            <button type="button" class="cron-preset-btn" data-cron="0 0 ? * 1 ?" title="每周日午夜执行">每周</button>
                            <button type="button" class="cron-preset-btn" data-cron="0 0 1 * ?" title="每月1日午夜执行">每月</button>
                            <button type="button" class="cron-preset-btn" data-cron="0 0 1 1 ?" title="每年1月1日午夜执行">每年</button>
                            <button type="button" class="cron-preset-btn" data-cron="*/5 * * * * ?" title="每5分钟执行一次">每5分钟</button>
                            <button type="button" class="cron-preset-btn" data-cron="*/15 * * * * ?" title="每15分钟执行一次">每15分钟</button>
                            <button type="button" class="cron-preset-btn" data-cron="*/30 * * * * ?" title="每30分钟执行一次">每30分钟</button>
                            <button type="button" class="cron-preset-btn" data-cron="0 */2 * * * ?" title="每2小时执行一次">每2小时</button>
                            <button type="button" class="cron-preset-btn" data-cron="0 0 9-17 ? * 2-6" title="工作日9-17点每小时执行">工作时间</button>
                            <button type="button" class="cron-preset-btn" data-cron="0 0 ? * 2-6" title="工作日午夜执行">工作日</button>
                        </div>
                    </div>
                    <div class="cron-preview">
                        <div class="cron-preview-title">下次运行时间预览</div>
                        <div class="cron-desc-card">
                            <div class="cron-desc-label">自然语言描述</div>
                            <div class="cron-desc-text" id="cron-desc-text">每秒执行</div>
                        </div>
                        <div class="cron-next-list" id="cron-next-list">
                            <div class="cron-next-item">-</div>
                        </div>
                    </div>
                </div>
                
                <div class="schedule-preview">
                    生成的调度策略: <code id="schedule-output">-</code>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // 设置日期选择器默认值为今天
        const today = new Date().toISOString().split('T')[0];
        this.shadowRoot.getElementById('at-date').value = today;

        // 初始化Cron表达式
        this.shadowRoot.getElementById('cron-expression-input').value = '* * * * * ?';

        // Tab切换
        this.shadowRoot.querySelectorAll('.schedule-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.shadowRoot.querySelectorAll('.schedule-tab').forEach(t => t.classList.remove('active'));
                this.shadowRoot.querySelectorAll('.schedule-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const tabId = tab.getAttribute('data-tab');
                this.shadowRoot.getElementById(tabId).classList.add('active');
                this.updateSchedule();
            });
        });

        // Cron field select and input changes
        this.shadowRoot.querySelectorAll('.cron-field-select').forEach(select => {
            select.addEventListener('change', () => this.updateCronFromFields());
        });
        this.shadowRoot.querySelectorAll('.cron-field-input').forEach(input => {
            input.addEventListener('input', () => this.updateCronFromFields());
        });

        // Cron expression input changes
        this.shadowRoot.getElementById('cron-expression-input').addEventListener('input', () => {
            this.updateFieldsFromCron();
            this.updateCronPreview();
        });

        // Copy button
        this.shadowRoot.getElementById('cron-copy-btn').addEventListener('click', () => {
            const input = this.shadowRoot.getElementById('cron-expression-input');
            input.select();
            document.execCommand('copy');
        });

        // Preset buttons
        this.shadowRoot.querySelectorAll('.cron-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cron = btn.getAttribute('data-cron');
                this.shadowRoot.getElementById('cron-expression-input').value = cron;
                this.updateFieldsFromCron();
                this.updateCronPreview();
            });
        });

        // Every模式切换
        this.shadowRoot.getElementById('every-mode').addEventListener('change', (e) => {
            const mode = e.target.value;
            this.shadowRoot.getElementById('every-interval').style.display = mode === 'interval' ? 'block' : 'none';
            this.shadowRoot.getElementById('every-weekday').style.display = mode === 'weekday' ? 'block' : 'none';
            this.updateSchedule();
        });

        // 所有输入变化时更新
        this.shadowRoot.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', () => this.updateSchedule());
            input.addEventListener('input', () => this.updateSchedule());
        });
    }

    updateCronFromFields() {
        const fields = ['second', 'minute', 'hour', 'day', 'month', 'week'];
        const cronParts = [];

        fields.forEach(field => {
            const select = this.shadowRoot.querySelector('.cron-field-select[data-field="' + field + '"]');
            const input = this.shadowRoot.querySelector('.cron-field-input[data-field="' + field + '"]');
            
            if (!select) return;
            
            const type = select.value;
            
            if (type === '*') {
                cronParts.push('*');
            } else if (type === '?') {
                cronParts.push('?');
            } else if (type === 'specific' || type === 'range' || type === 'step') {
                const value = input ? input.value.trim() : '*';
                cronParts.push(value || '*');
            } else {
                cronParts.push('*');
            }
        });

        const cronExpression = cronParts.join(' ');
        this.shadowRoot.getElementById('cron-expression-input').value = cronExpression;
        this.updateCronPreview();
    }

    updateFieldsFromCron() {
        const cronInput = this.shadowRoot.getElementById('cron-expression-input');
        const cron = cronInput.value.trim();
        const parts = cron.split(' ');
        
        const fields = ['second', 'minute', 'hour', 'day', 'month', 'week'];
        
        fields.forEach((field, index) => {
            const part = parts[index] || (field === 'week' ? '?' : '*');
            const select = this.shadowRoot.querySelector('.cron-field-select[data-field="' + field + '"]');
            const input = this.shadowRoot.querySelector('.cron-field-input[data-field="' + field + '"]');
            
            if (!select) return;
            
            if (part === '*') {
                select.value = '*';
                if (input) input.value = '';
            } else if (part === '?') {
                select.value = '?';
                if (input) input.value = '';
            } else if (part.includes(',')) {
                select.value = 'specific';
                if (input) input.value = part;
            } else if (part.includes('-') && !part.includes('/')) {
                select.value = 'range';
                if (input) input.value = part;
            } else if (part.includes('/')) {
                select.value = 'step';
                if (input) input.value = part;
            } else {
                select.value = 'specific';
                if (input) input.value = part;
            }
        });
    }

    updateCronPreview() {
        const cron = this.shadowRoot.getElementById('cron-expression-input').value.trim();
        const parts = cron.split(' ');
        
        // Generate natural language description
        const desc = this.generateCronDescription(parts);
        this.shadowRoot.getElementById('cron-desc-text').textContent = desc;
        
        // Generate next run times
        const nextRuns = this.generateNextRunTimes(cron);
        const nextList = this.shadowRoot.getElementById('cron-next-list');
        nextList.innerHTML = nextRuns.map(run => '<div class="cron-next-item">' + run + '</div>').join('');
    }

    generateCronDescription(parts) {
        if (parts.length < 6) return '无效的Cron表达式';
        
        const [second, minute, hour, day, month, week] = parts;
        let desc = '';
        
        if (second === '*') desc += '每秒';
        else if (second.includes('/')) desc += '每' + second.split('/')[1] + '秒';
        else desc += '第' + second + '秒';
        
        if (minute === '*') desc += '每分';
        else if (minute.includes('/')) desc += '每' + minute.split('/')[1] + '分';
        else desc += '第' + minute + '分';
        
        if (hour === '*') desc += '每小时';
        else if (hour.includes('/')) desc += '每' + hour.split('/')[1] + '小时';
        else desc += hour + '点';
        
        if (day === '*') desc += '每天';
        else if (day === '?') desc += '';
        else if (day.includes('/')) desc += '每' + day.split('/')[1] + '天';
        else desc += '每月' + day + '号';
        
        if (month === '*') desc += '每月';
        else desc += month + '月';
        
        if (week === '*') desc += '每周';
        else if (week === '?') desc += '';
        else desc += '周' + week;
        
        return desc || '每秒执行';
    }

    generateNextRunTimes(cron) {
        const nextRuns = [];
        const now = new Date();
        
        // Simple implementation - just show next 5 minutes as examples
        // In a real implementation, you would use a cron parser library
        for (let i = 0; i < 5; i++) {
            const nextTime = new Date(now.getTime() + i * 60000);
            const year = nextTime.getFullYear();
            const month = String(nextTime.getMonth() + 1).padStart(2, '0');
            const day = String(nextTime.getDate()).padStart(2, '0');
            const hours = String(nextTime.getHours()).padStart(2, '0');
            const minutes = String(nextTime.getMinutes()).padStart(2, '0');
            const seconds = String(nextTime.getSeconds()).padStart(2, '0');
            nextRuns.push(year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds);
        }
        
        return nextRuns;
    }

    updateSchedule() {
        const activeTab = this.shadowRoot.querySelector('.schedule-tab.active').getAttribute('data-tab');
        let schedule = '';

        switch (activeTab) {
            case 'every':
                schedule = this.buildEverySchedule();
                break;
            case 'after':
                schedule = this.buildAfterSchedule();
                break;
            case 'at':
                schedule = this.buildAtSchedule();
                break;
            case 'cron':
                schedule = this.shadowRoot.getElementById('cron-expression-input').value;
                break;
        }

        this.scheduleValue = schedule;
        this.shadowRoot.getElementById('schedule-output').textContent = schedule || '-';
        
        this.dispatchEvent(new CustomEvent('schedule-change', {
            detail: { schedule },
            bubbles: true,
            composed: true
        }));
    }

    buildEverySchedule() {
        const mode = this.shadowRoot.getElementById('every-mode').value;
        
        if (mode === 'interval') {
            const value = this.shadowRoot.getElementById('every-interval-value').value;
            const unit = this.shadowRoot.getElementById('every-interval-unit').value;
            const starts = this.shadowRoot.getElementById('every-starts').value;
            const ends = this.shadowRoot.getElementById('every-ends').value;
            
            let schedule = 'every ' + value + ' ' + unit;
            if (starts) {
                schedule += ' starts \'' + this.formatDateTime(starts) + '\'';
            }
            if (ends) {
                schedule += ' ends \'' + this.formatDateTime(ends) + '\'';
            }
            return schedule;
        } else {
            const checkedDays = Array.from(this.shadowRoot.querySelectorAll('#every-weekday input:checked'))
                .map(cb => cb.value);
            if (checkedDays.length === 0) return '';
            return 'every ' + checkedDays.join(',');
        }
    }

    buildAfterSchedule() {
        const value = this.shadowRoot.getElementById('after-value').value;
        const unit = this.shadowRoot.getElementById('after-unit').value;
        return 'after ' + value + ' ' + unit;
    }

    buildAtSchedule() {
        const date = this.shadowRoot.getElementById('at-date').value;
        const time = this.shadowRoot.getElementById('at-time').value;
        
        if (!time) return '';
        
        if (date) {
            // 检查是否是今天
            const today = new Date().toISOString().split('T')[0];
            if (date === today) {
                // 是今天，只输出时间
                return 'at \'' + time + '\'';
            } else {
                // 不是今天，输出完整格式
                return 'at \'' + date + ' ' + time + '\'';
            }
        } else {
            // 没有选择日期，只输出时间
            return 'at \'' + time + '\'';
        }
    }

    formatDateTime(datetimeLocal) {
        // datetime-local format: YYYY-MM-DDTHH:mm:ss
        // Convert to: YYYY-MM-DD HH:mm:ss
        if (!datetimeLocal) return '';
        return datetimeLocal.replace('T', ' ');
    }

    getValue() {
        return this.scheduleValue;
    }

    setValue(schedule) {
        this.scheduleValue = schedule;
        this.shadowRoot.getElementById('schedule-output').textContent = schedule || '-';
        
        // 尝试解析并设置对应的tab和值
        if (schedule.startsWith('every ')) {
            this.shadowRoot.querySelector('[data-tab="every"]').click();
            // 简单解析，实际需要更复杂的逻辑
        } else if (schedule.startsWith('after ')) {
            this.shadowRoot.querySelector('[data-tab="after"]').click();
            const match = schedule.match(/after (\d+) (\w+)/);
            if (match) {
                this.shadowRoot.getElementById('after-value').value = match[1];
                this.shadowRoot.getElementById('after-unit').value = match[2];
            }
        } else if (schedule.startsWith('at ')) {
            this.shadowRoot.querySelector('[data-tab="at"]').click();
            const match = schedule.match(/at '([^']+)'/);
            if (match) {
                const datetime = match[1];
                // 检查是否包含日期（YYYY-MM-DD HH:mm:ss 或 HH:mm:ss）
                if (datetime.includes(' ') && datetime.split(' ')[0].includes('-')) {
                    // 包含日期
                    const parts = datetime.split(' ');
                    this.shadowRoot.getElementById('at-date').value = parts[0];
                    this.shadowRoot.getElementById('at-time').value = parts[1];
                } else {
                    // 只有时间
                    this.shadowRoot.getElementById('at-date').value = '';
                    this.shadowRoot.getElementById('at-time').value = datetime;
                }
            }
        } else {
            // Cron格式
            this.shadowRoot.querySelector('[data-tab="cron"]').click();
            this.parseCronExpression(schedule);
        }
    }

    parseCronExpression(cron) {
        this.shadowRoot.getElementById('cron-expression-input').value = cron;
        this.updateFieldsFromCron();
    }
}

customElements.define('schedule-editor', ScheduleEditor);
