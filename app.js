// ========== Global State ==========
let currentReportData = null;
let currentFilter = 'all';
let severityChart = null;
let scannerChart = null;

// ========== Authentication ==========
if (window.location.pathname !== '/login.html' && window.location.pathname !== '/register.html') {
    document.addEventListener('DOMContentLoaded', () => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
        } else {
            updateUserProfile(token);
            showHomeView();
        }
    });
}

function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

function updateUserProfile(token) {
    const user = parseJwt(token);
    if (user && user.username) {
        const usernameEl = document.getElementById('user-menu-username');
        const avatarEl = document.getElementById('user-avatar-initial');
        if (usernameEl) usernameEl.textContent = user.username;
        if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
    }
}

function toggleProfileMenu() {
    const menu = document.getElementById('user-menu-dropdown');
    if (menu) menu.classList.toggle('hidden');
}

function toggleHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.classList.toggle('hidden');
}

window.addEventListener('click', function(e) {
    const menu = document.getElementById('user-menu-dropdown');
    const button = document.getElementById('user-menu-button');
    if (menu && button && !menu.classList.contains('hidden')) {
        if (!menu.contains(e.target) && !button.contains(e.target)) {
            menu.classList.add('hidden');
        }
    }
});

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// ========== File Upload Handler ==========
async function handleFileUpload(input) {
    const file = input.files[0];
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    errorDiv.classList.add('hidden');
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // Auto sanitize unicode escape sequences
            let raw = e.target.result
                .replace(/\\u003c/g, '<')
                .replace(/\\u003e/g, '>')
                .replace(/\\u0026/g, '&');

            const jsonContent = JSON.parse(raw);

            // Validate DursGo JSON structure
            if (!jsonContent.scan_summary && !jsonContent.vulnerabilities) {
                throw new Error("Invalid JSON structure. Missing 'scan_summary' or 'vulnerabilities'. Make sure this is a DursGo report file.");
            }

            const token = localStorage.getItem('token');
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    uploadDate: new Date().toISOString(),
                    data: jsonContent
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to upload report.');
            }

            currentReportData = jsonContent;
            renderReport(jsonContent);
            showDashboard();
            updateHistoryUI();

        } catch (error) {
            console.error('Upload error:', error);
            errorText.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    };

    reader.onerror = function() {
        errorText.textContent = 'Failed to read file. Please try again.';
        errorDiv.classList.remove('hidden');
    };

    reader.readAsText(file);
}

// ========== History Management ==========
async function updateHistoryUI() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/reports', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error('Failed to fetch history.');
        }

        const reports = await response.json();
        updateHistorySidebar(reports.data);
    } catch (error) {
        console.error('Error fetching history:', error);
    }
}

function updateHistorySidebar(history) {
    const list = document.getElementById('history-sidebar-list');
    const empty = document.getElementById('history-empty');
    if (!list || !empty) return;

    if (history.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    list.innerHTML = history.map(entry => createHistoryItem(entry, false)).join('');
}

function createHistoryItem(entry, isPreview) {
    const date = new Date(entry.uploadDate);
    const timeAgo = getTimeAgo(date);

    return `
        <div class="history-item" onclick="loadHistoryEntry(${entry.id})">
            <div class="history-item-header">
                <div class="history-item-title truncate">${escapeHtml(entry.fileName)}</div>
                ${!isPreview ? `
                    <button onclick="event.stopPropagation(); deleteHistoryEntry(${entry.id})"
                            class="text-red-400 hover:text-red-300 transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                ` : ''}
            </div>
            <div class="history-item-meta">
                <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    ${timeAgo}
                </span>
            </div>
        </div>
    `;
}

async function loadHistoryEntry(id) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/reports/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load report.');

        const report = await response.json();
        currentReportData = JSON.parse(report.data.data);
        renderReport(currentReportData);
        showDashboard();
        if (document.getElementById('history-sidebar')) toggleHistory();

    } catch (error) {
        console.error('Error loading report:', error);
    }
}

async function deleteHistoryEntry(id) {
    if (!confirm('Are you sure you want to delete this report?')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/reports/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete report.');
        updateHistoryUI();
    } catch (error) {
        console.error('Error deleting report:', error);
    }
}

function clearAllHistory() {
    alert("Please delete reports one by one from the Reports Overview page.");
}

// ========== UI State Management ==========
function hideAllViews() {
    const views = ['upload-section', 'report-dashboard', 'profile-view', 'settings-view', 'dashboard-home-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById('btn-reset')?.classList.add('hidden');
    document.getElementById('btn-history')?.classList.add('hidden');
}

function showDashboard() {
    hideAllViews();
    if (currentReportData) {
        document.getElementById('report-dashboard').classList.remove('hidden');
        document.getElementById('btn-reset').classList.remove('hidden');
        document.getElementById('btn-history').classList.remove('hidden');
    } else {
        showHomeView();
    }
}

function showHomeView() {
    hideAllViews();
    document.getElementById('dashboard-home-view').classList.remove('hidden');
    document.getElementById('btn-history').classList.remove('hidden');

    updateHomeData();

    const menu = document.getElementById('user-menu-dropdown');
    if (menu) menu.classList.add('hidden');

    const token = localStorage.getItem('token');
    const user = parseJwt(token);
    if (user && document.getElementById('home-username')) {
        document.getElementById('home-username').textContent = user.username;
    }
}

async function updateHomeData() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/reports', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const result = await response.json();
            const reports = result.data;
            renderHomeStats(reports);
            renderProjectsTable(reports);
            updateHistorySidebar(reports);
        }
    } catch (error) {
        console.error("Error updating home data", error);
    }
}

// ========== Home Stats (DursGo format) ==========
function renderHomeStats(reports) {
    let totalVulns = 0;
    let highVulns = 0;

    reports.forEach(report => {
        try {
            const data = JSON.parse(report.data);
            const vulns = data.vulnerabilities || [];
            totalVulns += vulns.length;
            highVulns += vulns.filter(v => (v.severity || '').toLowerCase() === 'high').length;
        } catch (e) {
            console.error("Error parsing report stats", e);
        }
    });

    if (document.getElementById('stat-total-projects')) document.getElementById('stat-total-projects').textContent = reports.length;
    if (document.getElementById('stat-total-vulns')) document.getElementById('stat-total-vulns').textContent = totalVulns;
    if (document.getElementById('stat-critical-vulns')) document.getElementById('stat-critical-vulns').textContent = highVulns;
}

function renderProjectsTable(reports) {
    const tbody = document.getElementById('projects-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No reports found. Upload a new scan!</td></tr>';
        return;
    }

    reports.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    reports.forEach(report => {
        let vulnCount = 0;
        let highCount = 0;
        let targetUrl = '—';
        try {
            const data = JSON.parse(report.data);
            const vulns = data.vulnerabilities || [];
            vulnCount = vulns.length;
            highCount = vulns.filter(v => (v.severity || '').toLowerCase() === 'high').length;
            targetUrl = data.scan_summary?.target_url || '—';
        } catch (e) {}

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-dark-700/30 transition-colors border-b border-dark-700/30 last:border-0';
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-white">${escapeHtml(report.fileName)}</td>
            <td class="px-6 py-4 text-slate-400 text-xs font-mono max-w-xs truncate" title="${escapeHtml(targetUrl)}">${escapeHtml(targetUrl)}</td>
            <td class="px-6 py-4 text-slate-400">${new Date(report.uploadDate).toLocaleDateString()}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <span class="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/20">${vulnCount} Vulns</span>
                    ${highCount > 0 ? `<span class="px-2 py-1 rounded text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/20">${highCount} High</span>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 text-right">
                <button onclick="loadHistoryEntry(${report.id})" class="text-brand-primary hover:text-brand-secondary text-sm font-medium mr-3 transition-colors">View</button>
                <button onclick="deleteHistoryEntry(${report.id})" class="text-red-400 hover:text-red-300 text-sm font-medium transition-colors">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showProfileView() {
    hideAllViews();
    const view = document.getElementById('profile-view');
    if (view) view.classList.remove('hidden');

    const menu = document.getElementById('user-menu-dropdown');
    if (menu) menu.classList.add('hidden');

    const token = localStorage.getItem('token');
    const user = parseJwt(token);
    if (user) {
        const usernameEl = document.getElementById('profile-username');
        const avatarEl = document.getElementById('profile-avatar-initial');
        if (usernameEl) usernameEl.textContent = user.username;
        if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
    }
}

function showSettingsView() {
    hideAllViews();
    const view = document.getElementById('settings-view');
    if (view) view.classList.remove('hidden');

    const menu = document.getElementById('user-menu-dropdown');
    if (menu) menu.classList.add('hidden');
}

function resetViewer() {
    document.getElementById('file-upload').value = '';
    hideAllViews();
    document.getElementById('upload-section').classList.remove('hidden');
    document.getElementById('btn-history').classList.remove('hidden');

    currentReportData = null;
    if (severityChart) { severityChart.destroy(); severityChart = null; }
    if (scannerChart) { scannerChart.destroy(); scannerChart = null; }

    switchTab('overview');
}

function toggleHistory() {
    const sidebar = document.getElementById('history-sidebar');
    if (sidebar) sidebar.classList.toggle('hidden');
}

// ========== Report Rendering (DursGo format) ==========
function renderReport(data) {
    renderStats(data);
    renderSummary(data);
    renderFindings(data);
    renderOverview(data);
}

function renderStats(data) {
    const vulns = data.vulnerabilities || [];
    const summary = data.scan_summary || {};

    const highCount = vulns.filter(v => (v.severity || '').toLowerCase() === 'high').length;
    const medCount = vulns.filter(v => (v.severity || '').toLowerCase() === 'medium').length;
    const lowCount = vulns.filter(v => (v.severity || '').toLowerCase() === 'low').length;

    const statsSection = document.getElementById('stats-section');
    statsSection.innerHTML = `
        <div class="stat-card fade-in" style="animation-delay: 0.1s">
            <div class="stat-icon bg-gradient-to-br from-blue-500 to-blue-600">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"></path></svg>
            </div>
            <div class="stat-value">${summary.total_urls_discovered || 0}</div>
            <div class="stat-label">URLs Discovered</div>
        </div>
        <div class="stat-card fade-in" style="animation-delay: 0.2s">
            <div class="stat-icon bg-gradient-to-br from-red-500 to-red-600">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div class="stat-value">${vulns.length}</div>
            <div class="stat-label">Total Vulnerabilities</div>
        </div>
        <div class="stat-card fade-in" style="animation-delay: 0.3s">
            <div class="stat-icon bg-gradient-to-br from-orange-500 to-red-500">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <div class="stat-value">${highCount}</div>
            <div class="stat-label">High Severity</div>
        </div>
        <div class="stat-card fade-in" style="animation-delay: 0.4s">
            <div class="stat-icon bg-gradient-to-br from-yellow-500 to-orange-500">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div class="stat-value">${medCount + lowCount}</div>
            <div class="stat-label">Med & Low</div>
        </div>
    `;
}

// ========== Scan Summary Tab ==========
function renderSummary(data) {
    const s = data.scan_summary || {};
    const techs = Object.entries(s.technologies_detected || {})
        .map(([k, v]) => `<span class="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 font-mono"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`)
        .join('') || '<span class="text-slate-500 text-sm">None detected</span>';

    const scanners = (s.scanners_run || [])
        .map(sc => `<span class="px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-300">${escapeHtml(sc)}</span>`)
        .join('') || '<span class="text-slate-500 text-sm">—</span>';

    const summaryEl = document.getElementById('content-summary');
    summaryEl.innerHTML = `
        <div class="grid sm:grid-cols-2 gap-4">
            <div class="bg-dark-900/50 rounded-xl p-4 border border-dark-600/50">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target URL</p>
                <a href="${escapeHtml(s.target_url || '#')}" target="_blank" class="text-brand-primary hover:underline break-all text-sm font-mono">${escapeHtml(s.target_url || '—')}</a>
            </div>
            <div class="bg-dark-900/50 rounded-xl p-4 border border-dark-600/50">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Duration</p>
                <p class="text-white font-semibold">${escapeHtml(s.total_duration || '—')}</p>
            </div>
            <div class="bg-dark-900/50 rounded-xl p-4 border border-dark-600/50">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Scan Start</p>
                <p class="text-slate-300 text-sm font-mono">${escapeHtml(s.scan_start_time || '—')}</p>
            </div>
            <div class="bg-dark-900/50 rounded-xl p-4 border border-dark-600/50">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Scan End</p>
                <p class="text-slate-300 text-sm font-mono">${escapeHtml(s.scan_end_time || '—')}</p>
            </div>
            <div class="bg-dark-900/50 rounded-xl p-4 border border-dark-600/50">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">URLs Discovered</p>
                <p class="text-2xl font-bold text-white">${s.total_urls_discovered ?? '—'}</p>
            </div>
            <div class="bg-dark-900/50 rounded-xl p-4 border border-dark-600/50">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Parameterized Requests</p>
                <p class="text-2xl font-bold text-white">${s.total_parameterized_requests ?? '—'}</p>
            </div>
            <div class="bg-dark-900/50 rounded-xl p-4 border border-dark-600/50 sm:col-span-2">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Technologies Detected</p>
                <div class="flex flex-wrap gap-2">${techs}</div>
            </div>
            <div class="bg-dark-900/50 rounded-xl p-4 border border-dark-600/50 sm:col-span-2">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Scanners Run</p>
                <div class="flex flex-wrap gap-2">${scanners}</div>
            </div>
        </div>
    `;
}

// ========== Findings Tab (DursGo format) ==========
function renderFindings(data) {
    const vulns = data.vulnerabilities || [];
    const findingsList = document.getElementById('findings-list');
    const findingsCount = document.getElementById('findings-count');

    findingsCount.textContent = vulns.length;

    if (vulns.length === 0) {
        findingsList.innerHTML = `
            <div class="text-center py-16 bg-dark-800/50 backdrop-blur-sm border border-dark-600/50 rounded-xl">
                <svg class="w-16 h-16 text-green-500/50 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p class="text-slate-400 text-lg">No vulnerabilities found</p>
            </div>
        `;
        return;
    }

    findingsList.innerHTML = '';
    vulns.forEach((vuln, index) => {
        const card = createFindingCard(vuln, index);
        findingsList.appendChild(card);
    });
}

function createFindingCard(vuln, index) {
    const severity = (vuln.severity || 'low').toLowerCase();
    const severityClass = `severity-${severity}`;

    const card = document.createElement('div');
    card.className = `finding-card ${severityClass} fade-in`;
    card.style.animationDelay = `${index * 0.05}s`;
    card.setAttribute('data-severity', severity);

    card.innerHTML = `
        <div class="card-header flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div class="flex-grow">
                <div class="flex items-center gap-3 mb-2 flex-wrap">
                    <span class="severity-badge ${severityClass}">${escapeHtml(vuln.severity || 'Low')}</span>
                    <span class="text-xs text-slate-400 font-mono">${escapeHtml(vuln.scanner_name || '')}</span>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">${escapeHtml(vuln.VulnerabilityType || 'Unknown Vulnerability')}</h3>
                <a href="${escapeHtml(vuln.URL || '#')}" target="_blank" class="text-sm text-brand-primary hover:underline font-mono break-all">${escapeHtml(vuln.URL || '—')}</a>
            </div>
        </div>
        <div class="card-body space-y-4">
            <div class="grid sm:grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Parameter</h4>
                    <code class="text-cyan-300 text-sm bg-dark-900/50 px-2 py-1 rounded">${escapeHtml(vuln.Parameter || '—')}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Location</h4>
                    <span class="text-slate-300 text-sm">${escapeHtml(vuln.Location || '—')}</span>
                </div>
            </div>

            <div>
                <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payload</h4>
                <pre class="bg-dark-900/80 border border-dark-700 rounded-lg p-3 overflow-x-auto custom-scrollbar"><code class="text-xs text-orange-300">${escapeHtml(vuln.Payload || '—')}</code></pre>
            </div>

            ${vuln.evidence ? `
                <div>
                    <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Evidence</h4>
                    <pre class="bg-dark-900/80 border border-dark-700 rounded-lg p-3 overflow-x-auto custom-scrollbar"><code class="text-xs text-cyan-300">${escapeHtml(vuln.evidence)}</code></pre>
                </div>
            ` : ''}

            ${vuln.Details ? `
                <div>
                    <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Details</h4>
                    <p class="text-slate-300 text-sm leading-relaxed">${escapeHtml(vuln.Details)}</p>
                </div>
            ` : ''}

            ${vuln.remediation ? `
                <div class="bg-dark-900/50 border border-green-900/30 rounded-lg p-4">
                    <h4 class="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Remediation
                    </h4>
                    <p class="text-green-300/90 text-sm">${escapeHtml(vuln.remediation)}</p>
                </div>
            ` : ''}

            ${vuln.ai_analysis ? `
                <div class="bg-gradient-to-br from-brand-primary/5 to-brand-accent/5 border border-brand-primary/20 rounded-lg p-4">
                    <h4 class="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                        AI Analysis
                    </h4>
                    <div class="markdown-body prose prose-invert max-w-none text-sm">${marked.parse(vuln.ai_analysis)}</div>
                </div>
            ` : ''}
        </div>
    `;

    return card;
}

// ========== Overview Charts ==========
function renderOverview(data) {
    const vulns = data.vulnerabilities || [];

    const highCount = vulns.filter(v => (v.severity || '').toLowerCase() === 'high').length;
    const medCount = vulns.filter(v => (v.severity || '').toLowerCase() === 'medium').length;
    const lowCount = vulns.filter(v => (v.severity || '').toLowerCase() === 'low').length;

    if (severityChart) severityChart.destroy();
    if (scannerChart) scannerChart.destroy();

    // Severity doughnut chart
    const severityCtx = document.getElementById('severity-chart');
    if (severityCtx && vulns.length > 0) {
        severityChart = new Chart(severityCtx, {
            type: 'doughnut',
            data: {
                labels: ['High', 'Medium', 'Low'],
                datasets: [{
                    data: [highCount, medCount, lowCount],
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(249, 115, 22, 0.8)',
                        'rgba(59, 130, 246, 0.8)'
                    ],
                    borderColor: [
                        'rgba(239, 68, 68, 1)',
                        'rgba(249, 115, 22, 1)',
                        'rgba(59, 130, 246, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#cbd5e1', padding: 15, font: { size: 12, family: 'Inter' } }
                    },
                    title: {
                        display: true,
                        text: 'Severity Distribution',
                        color: '#f8fafc',
                        font: { size: 16, weight: 'bold', family: 'Inter' },
                        padding: 20
                    }
                }
            }
        });
    }

    // Scanner bar chart — count by VulnerabilityType
    const typeCounts = {};
    vulns.forEach(v => {
        const t = v.VulnerabilityType || 'Unknown';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const typeLabels = Object.keys(typeCounts);
    const typeValues = Object.values(typeCounts);

    const scannerCtx = document.getElementById('scanner-chart');
    if (scannerCtx && typeLabels.length > 0) {
        scannerChart = new Chart(scannerCtx, {
            type: 'bar',
            data: {
                labels: typeLabels,
                datasets: [{
                    label: 'Count',
                    data: typeValues,
                    backgroundColor: 'rgba(249, 115, 22, 0.7)',
                    borderColor: 'rgba(249, 115, 22, 1)',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Vulnerabilities by Type',
                        color: '#f8fafc',
                        font: { size: 16, weight: 'bold', family: 'Inter' },
                        padding: 20
                    }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(51,65,85,0.3)' } },
                    y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(51,65,85,0.3)' } }
                }
            }
        });
    }

    // Critical/High findings list
    const criticalList = document.getElementById('critical-findings-list');
    const highFindings = vulns.filter(v => (v.severity || '').toLowerCase() === 'high').slice(0, 5);

    if (highFindings.length === 0) {
        criticalList.innerHTML = `
            <div class="text-center py-8 text-slate-500">
                <svg class="w-12 h-12 text-green-500/50 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p class="text-sm">No high severity vulnerabilities found</p>
            </div>
        `;
    } else {
        criticalList.innerHTML = highFindings.map(v => `
            <div class="flex items-start gap-3 p-3 bg-dark-900/50 border border-dark-700 rounded-lg hover:border-red-500/30 transition-colors cursor-pointer" onclick="switchTab('findings')">
                <div class="flex-shrink-0">
                    <span class="severity-badge severity-high">${escapeHtml(v.severity || 'High')}</span>
                </div>
                <div class="flex-grow min-w-0">
                    <h4 class="text-sm font-semibold text-white mb-1 truncate">${escapeHtml(v.VulnerabilityType || 'Vulnerability')}</h4>
                    <p class="text-xs text-brand-primary font-mono truncate">${escapeHtml(v.URL || '—')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">Param: <code class="text-cyan-400">${escapeHtml(v.Parameter || '—')}</code></p>
                </div>
            </div>
        `).join('');
    }
}

// ========== Tab Navigation ==========
function switchTab(tabName) {
    ['overview', 'summary', 'findings'].forEach(tab => {
        const tabEl = document.getElementById(`tab-${tab}`);
        const btnEl = document.getElementById(`btn-${tab}`);
        if (tabEl) tabEl.classList.add('hidden');
        if (btnEl) btnEl.classList.remove('active');
    });

    const activeTab = document.getElementById(`tab-${tabName}`);
    const activeBtn = document.getElementById(`btn-${tabName}`);
    if (activeTab) activeTab.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== Findings Filter ==========
function filterFindings(filterType) {
    currentFilter = filterType;

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-filter="${filterType}"]`)?.classList.add('active');

    const cards = document.querySelectorAll('.finding-card');
    cards.forEach(card => {
        const severity = card.getAttribute('data-severity');
        const show = filterType === 'all' || severity === filterType;
        card.classList.toggle('hidden', !show);
    });
}

// ========== Utility Functions ==========
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
