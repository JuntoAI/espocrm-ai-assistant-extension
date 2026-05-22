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
                            <div class="panel-heading"><h4 class="panel-title">Top Tools (MCP Calls)</h4></div>
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
        }

        afterRender() {
            super.afterRender();
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
                { key: 'today', selector: '.ai-summary-today' },
                { key: 'last7Days', selector: '.ai-summary-7d' },
                { key: 'last30Days', selector: '.ai-summary-30d' },
            ];

            periods.forEach(({ key, selector }) => {
                const s = this.statsData[key];
                if (!s) return;

                const html = `
                    <table class="table table-condensed" style="margin:0;">
                        <tr><td><strong>Total Tokens</strong></td><td class="text-right">${this.formatNumber(s.totalTokens)}</td></tr>
                        <tr><td>Prompt</td><td class="text-right">${this.formatNumber(s.promptTokens)}</td></tr>
                        <tr><td>Completion</td><td class="text-right">${this.formatNumber(s.completionTokens)}</td></tr>
                        <tr><td><strong>Tool Calls</strong></td><td class="text-right">${this.formatNumber(s.toolCalls)}</td></tr>
                        <tr><td>Requests</td><td class="text-right">${s.requestCount}</td></tr>
                        <tr><td>Errors</td><td class="text-right">${s.errorCount}</td></tr>
                        <tr><td>Avg Latency</td><td class="text-right">${this.formatNumber(s.avgDurationMs)} ms</td></tr>
                        <tr><td>Users</td><td class="text-right">${s.uniqueUsers}</td></tr>
                        <tr><td>Sessions</td><td class="text-right">${s.uniqueSessions}</td></tr>
                    </table>
                `;

                this.$el.find(selector).html(html);
            });
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
            const tools = this.statsData.topTools || [];
            if (tools.length === 0) {
                this.$el.find('.ai-table-tools').html('<p class="text-muted">No tool usage recorded yet.</p>');
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

        escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
    };
});
