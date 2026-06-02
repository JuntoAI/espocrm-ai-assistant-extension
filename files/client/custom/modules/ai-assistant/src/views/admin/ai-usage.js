define('ai-assistant:views/admin/ai-usage', ['view', 'chart-dashlet-chart-js'], (View, Chart) => {

    return class extends View {

        templateContent = `
            <div class="page-header">
                <h3><span class="fas fa-chart-line"></span> AI Usage Statistics</h3>
            </div>

            <div class="ai-usage-loading" style="text-align:center; padding:40px;">
                <span class="fas fa-spinner fa-spin"></span> Loading usage data...
            </div>

            <div class="ai-usage-content" style="display:none;">
                <div class="ai-usage-summary row" style="margin-bottom:30px;">
                    <div class="col-md-4">
                        <div class="panel panel-default">
                            <div class="panel-heading"><h4 class="panel-title">Today</h4></div>
                            <div class="panel-body ai-summary-today"></div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="panel panel-default">
                            <div class="panel-heading"><h4 class="panel-title">Last 7 Days</h4></div>
                            <div class="panel-body ai-summary-7d"></div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="panel panel-default">
                            <div class="panel-heading"><h4 class="panel-title">Last 30 Days</h4></div>
                            <div class="panel-body ai-summary-30d"></div>
                        </div>
                    </div>
                </div>

                <div class="row" style="margin-bottom:30px;">
                    <div class="col-md-8">
                        <div class="panel panel-default">
                            <div class="panel-heading"><h4 class="panel-title">Tokens & Tool Calls (Last 30 Days)</h4></div>
                            <div class="panel-body">
                                <canvas class="ai-chart-daily" height="250"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="panel panel-default">
                            <div class="panel-heading"><h4 class="panel-title">Tokens by Model</h4></div>
                            <div class="panel-body">
                                <canvas class="ai-chart-model" height="250"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <div class="panel panel-default">
                            <div class="panel-heading">
                                <div style="display:flex; align-items:center; justify-content:space-between;">
                                    <h4 class="panel-title" style="margin:0;">Top Tools (MCP Calls)</h4>
                                    <select class="form-control ai-tools-period-select" style="width:auto; height:28px; padding:2px 8px; font-size:12px;">
                                        <option value="30days">Last 30 Days</option>
                                        <option value="7days">Last 7 Days</option>
                                        <option value="today">Today</option>
                                    </select>
                                </div>
                            </div>
                            <div class="panel-body ai-table-tools"></div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="panel panel-default">
                            <div class="panel-heading"><h4 class="panel-title">Per User (Last 30 Days)</h4></div>
                            <div class="panel-body ai-table-users"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ai-usage-error" style="display:none;">
                <div class="alert alert-danger">
                    Failed to load usage statistics. Make sure you are logged in as an administrator.
                </div>
            </div>
        `

        setup() {
            this.statsData = null;
            this.toolsPeriod = '30days';
        }

        afterRender() {
            super.afterRender();

            this.$el.find('.ai-tools-period-select').on('change', (e) => {
                this.toolsPeriod = e.target.value;
                this.renderToolsTable();
            });

            this.loadStats();
        }

        loadStats() {
            Espo.Ajax.getRequest('AiAssistant/usageStats')
                .then((data) => {
                    this.statsData = data;
                    this.$el.find('.ai-usage-loading').hide();
                    this.$el.find('.ai-usage-content').show();
                    this.renderSummary();
                    this.renderDailyChart();
                    this.renderModelChart();
                    this.renderToolsTable();
                    this.renderUsersTable();
                })
                .catch(() => {
                    this.$el.find('.ai-usage-loading').hide();
                    this.$el.find('.ai-usage-error').show();
                });
        }

        renderSummary() {
            const periods = [
                { key: 'today', prevKey: 'previousToday', selector: '.ai-summary-today', label: 'vs yesterday' },
                { key: 'last7Days', prevKey: 'previous7Days', selector: '.ai-summary-7d', label: 'vs prev 7d' },
                { key: 'last30Days', prevKey: 'previous30Days', selector: '.ai-summary-30d', label: 'vs prev 30d' },
            ];

            periods.forEach(({ key, prevKey, selector }) => {
                const s = this.statsData[key];
                const prev = this.statsData[prevKey];
                if (!s) return;

                const rows = [
                    { label: 'Total Tokens', value: s.totalTokens, prevValue: prev ? prev.totalTokens : null, bold: true },
                    { label: 'Prompt', value: s.promptTokens, prevValue: prev ? prev.promptTokens : null },
                    { label: 'Cached', value: s.cachedTokens || 0, prevValue: prev ? (prev.cachedTokens || 0) : null, suffix: this.cacheHitSuffix(s) },
                    { label: 'Completion', value: s.completionTokens, prevValue: prev ? prev.completionTokens : null },
                    { label: 'Tool Calls', value: s.toolCalls, prevValue: prev ? prev.toolCalls : null, bold: true },
                    { label: 'Tool Errors', value: s.toolErrors, prevValue: prev ? prev.toolErrors : null, invertColor: true },
                    { label: 'Requests', value: s.requestCount, prevValue: prev ? prev.requestCount : null },
                    { label: 'Errors', value: s.errorCount, prevValue: prev ? prev.errorCount : null, invertColor: true },
                    { label: 'Avg Latency', value: s.avgDurationMs, prevValue: prev ? prev.avgDurationMs : null, suffix: ' ms', invertColor: true },
                    { label: 'Users', value: s.uniqueUsers, prevValue: prev ? prev.uniqueUsers : null },
                    { label: 'Sessions', value: s.uniqueSessions, prevValue: prev ? prev.uniqueSessions : null },
                ];

                let html = '<table class="table table-condensed" style="margin:0;">';

                rows.forEach(row => {
                    const labelHtml = row.bold ? `<strong>${row.label}</strong>` : row.label;
                    const valueStr = this.formatNumber(row.value) + (row.suffix || '');
                    const changeHtml = this.renderChange(row.value, row.prevValue, row.invertColor);

                    html += `<tr>
                        <td>${labelHtml}</td>
                        <td class="text-right" style="white-space:nowrap;">${valueStr} ${changeHtml}</td>
                    </tr>`;
                });

                html += '</table>';
                this.$el.find(selector).html(html);
            });
        }

        /**
         * Render a change indicator (arrow + percentage) comparing current to previous value.
         * @param {number} current - Current period value
         * @param {number|null} previous - Previous period value
         * @param {boolean} invertColor - If true, increase is bad (red) and decrease is good (green). Used for errors/latency.
         * @returns {string} HTML string with colored arrow + percentage
         */
        renderChange(current, previous, invertColor) {
            if (previous === null || previous === undefined) return '';

            // If both are zero, no change to show
            if (previous === 0 && current === 0) return '';

            let pct;
            let direction; // 'up', 'down', 'flat'

            if (previous === 0) {
                // From zero to something = new (show as +100% up)
                pct = 100;
                direction = 'up';
            } else {
                pct = Math.round(((current - previous) / previous) * 100);

                if (pct > 0) {
                    direction = 'up';
                } else if (pct < 0) {
                    direction = 'down';
                    pct = Math.abs(pct);
                } else {
                    direction = 'flat';
                }
            }

            if (direction === 'flat') {
                return '<span style="color:#999; font-size:11px;">→ 0%</span>';
            }

            const arrow = direction === 'up' ? '↑' : '↓';
            let color;

            if (invertColor) {
                // For errors/latency: up is bad (red), down is good (green)
                color = direction === 'up' ? '#e53935' : '#43a047';
            } else {
                // For tokens/requests: up is good (green), down is neutral/red
                color = direction === 'up' ? '#43a047' : '#e53935';
            }

            return `<span style="color:${color}; font-size:11px; margin-left:4px;" title="vs previous period">${arrow}${pct}%</span>`;
        }

        renderDailyChart() {
            const canvas = this.$el.find('.ai-chart-daily').get(0);
            if (!canvas || !Chart) {
                this.$el.find('.ai-chart-daily').closest('.panel-body').html(
                    '<p class="text-muted">Chart.js not available. Install the Chart Dashlet extension for charts.</p>'
                );
                return;
            }

            const days = this.statsData.tokensByDay || [];
            const labels = days.map(d => d.day);
            const tokens = days.map(d => d.totalTokens);
            const tools = days.map(d => d.toolCalls);

            new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Total Tokens',
                            data: tokens,
                            borderColor: '#2196F3',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            fill: true,
                            tension: 0.3,
                            yAxisID: 'y',
                        },
                        {
                            label: 'Tool Calls',
                            data: tools,
                            borderColor: '#FF9800',
                            backgroundColor: 'rgba(255, 152, 0, 0.1)',
                            fill: false,
                            tension: 0.3,
                            yAxisID: 'y1',
                        },
                    ],
                },
                options: {
                    responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: {
                            ticks: {
                                maxTicksLimit: 10,
                                callback: function(val, idx) {
                                    const label = this.getLabelForValue(val);
                                    return label ? label.slice(5) : '';
                                },
                            },
                        },
                        y: {
                            type: 'linear',
                            position: 'left',
                            title: { display: true, text: 'Tokens' },
                            beginAtZero: true,
                        },
                        y1: {
                            type: 'linear',
                            position: 'right',
                            title: { display: true, text: 'Tool Calls' },
                            beginAtZero: true,
                            grid: { drawOnChartArea: false },
                        },
                    },
                    plugins: {
                        legend: { position: 'top' },
                    },
                },
            });
        }

        renderModelChart() {
            const canvas = this.$el.find('.ai-chart-model').get(0);
            if (!canvas || !Chart) {
                this.$el.find('.ai-chart-model').closest('.panel-body').html(
                    '<p class="text-muted">Chart.js not available. Install the Chart Dashlet extension for charts.</p>'
                );
                return;
            }

            const models = this.statsData.tokensByModel || [];
            if (models.length === 0) return;

            const labels = models.map(m => m.model);
            const data = models.map(m => m.totalTokens);
            const colors = ['#2196F3', '#FF9800', '#4CAF50', '#9C27B0', '#F44336', '#00BCD4'];

            new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Tokens',
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom' },
                    },
                },
            });
        }

        renderToolsTable() {
            const periodMap = {
                'today': 'topToolsToday',
                '7days': 'topTools7Days',
                '30days': 'topTools30Days',
            };

            const dataKey = periodMap[this.toolsPeriod] || 'topTools30Days';
            const tools = this.statsData[dataKey] || [];

            if (tools.length === 0) {
                this.$el.find('.ai-table-tools').html('<p class="text-muted">No tool usage recorded for this period.</p>');
                return;
            }

            let html = '<table class="table table-striped table-condensed"><thead><tr><th>Tool</th><th class="text-right">Calls</th></tr></thead><tbody>';

            tools.forEach(t => {
                html += `<tr><td><code>${this.escapeHtml(t.tool)}</code></td><td class="text-right">${t.count}</td></tr>`;
            });

            html += '</tbody></table>';
            this.$el.find('.ai-table-tools').html(html);
        }

        renderUsersTable() {
            const users = this.statsData.perUser || [];
            if (users.length === 0) {
                this.$el.find('.ai-table-users').html('<p class="text-muted">No usage recorded yet.</p>');
                return;
            }

            let html = '<table class="table table-striped table-condensed"><thead><tr><th>User</th><th class="text-right">Tokens</th><th class="text-right">Tool Calls</th><th class="text-right">Requests</th></tr></thead><tbody>';

            users.forEach(u => {
                html += `<tr><td>${this.escapeHtml(u.userName || u.userId)}</td><td class="text-right">${this.formatNumber(u.totalTokens)}</td><td class="text-right">${u.toolCalls}</td><td class="text-right">${u.requestCount}</td></tr>`;
            });

            html += '</tbody></table>';
            this.$el.find('.ai-table-users').html(html);
        }

        formatNumber(n) {
            if (n === null || n === undefined) return '0';
            return Number(n).toLocaleString();
        }

        /**
         * Build a suffix showing cached tokens as a percentage of prompt tokens
         * (the implicit-cache hit rate). Higher is better — those tokens are
         * billed at ~10% of the standard input rate.
         */
        cacheHitSuffix(s) {
            const prompt = s.promptTokens || 0;
            const cached = s.cachedTokens || 0;
            if (prompt <= 0 || cached <= 0) return '';
            const pct = Math.round((cached / prompt) * 100);
            return ` (${pct}% hit)`;
        }

        escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
    };
});
