// API Base URL
const API_BASE = window.location.origin + "/api";

// Current view and page state
let currentView = "overview";
let currentPage = { groups: 1, users: 1, logs: 1 };

// Chart instances
let userChart = null;
let groupSettingsChart = null;
let memorySparklineChart = null;
let _heapHistory = [];
// Real-time system monitor intervals
let _streamAbortController = null; // SSE stream controller
let _uptimeTicker = null;         // 1s local uptime tick
let _overviewStatsInterval = null; // 30s full stats refresh
let _uptimeSeconds = 0;           // last known uptime from server

// Authentication helper
function getAuthToken() {
    return localStorage.getItem("adminToken");
}

function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.replace("/login.html");
        return false;
    }
    // Load admin profile from cache if available
    try {
        const profile = localStorage.getItem("adminProfile");
        if (profile) displayAdminInfo(JSON.parse(profile));
    } catch (_) {}
    return true;
}

function displayAdminInfo(admin) {
    const pageSubtitle = document.getElementById("page-subtitle");
    if (pageSubtitle && admin) {
        const originalText = "Realtime system monitor and control center";
        const roleLabel = (admin.role || "team").toUpperCase();
        pageSubtitle.innerHTML = `${originalText} | +${admin.phoneNumber} <strong>[${roleLabel}]</strong>`;
    }
    // Cache role for use in Settings/Maintenance views
    if (admin) localStorage.setItem('adminProfile', JSON.stringify(admin));
}

async function logout() {
    try {
        const token = getAuthToken();
        if (token) {
            await fetch(`${API_BASE}/auth/logout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
        }
    } catch (error) {
        console.error("Logout error:", error);
    } finally {
        localStorage.removeItem("adminToken");
        window.location.href = "/login.html";
    }
}

// Authenticated fetch wrapper
async function authFetch(url, options = {}) {
    const headers = {
        ...getAuthHeaders(),
        ...(options.headers || {}),
    };

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        localStorage.removeItem("adminToken");
        window.location.replace("/login.html");
        throw new Error("Unauthorized");
    }

    return response;
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", () => {
    try {
        const profile = localStorage.getItem("adminProfile");
        if (profile) displayAdminInfo(JSON.parse(profile));
    } catch (_) {}

    setupNavigation();
    setupMobileMenu();
    initParticles();
    setupEventListeners();
    loadOverview();
    startSystemRT();
});
// Background Particles (matches login page) 
function initParticles() {
    const canvas = document.getElementById('bg-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];
    const colors = ['rgba(99,102,241,', 'rgba(139,92,246,', 'rgba(6,182,212,'];

    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
        particles.push({
            x: Math.random() * (W || 1200), y: Math.random() * (H || 800),
            r: Math.random() * 1.2 + 0.3,
            vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
            color: colors[Math.floor(Math.random() * colors.length)],
            a: Math.random() * 0.4 + 0.08, life: Math.random() * Math.PI * 2,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => {
            p.life += 0.008;
            const alpha = p.a * (0.5 + 0.5 * Math.sin(p.life));
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color + alpha + ')'; ctx.fill();
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        });
        particles.forEach((p, i) => {
            for (let j = i + 1; j < particles.length; j++) {
                const q = particles[j];
                const dx = p.x - q.x, dy = p.y - q.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 90) {
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
                    ctx.strokeStyle = `rgba(99,102,241,${0.06 * (1 - dist / 90)})`;
                    ctx.lineWidth = 0.5; ctx.stroke();
                }
            }
        });
        requestAnimationFrame(draw);
    }
    draw();
}


function setupMobileMenu() {
    const sidebar = document.getElementById("sidebar");
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const closeSidebarBtn = document.getElementById("close-sidebar-btn");
    const mobileOverlay = document.getElementById("mobile-overlay");

    hamburgerBtn?.addEventListener("click", () => {
        sidebar.classList.add("mobile-open");
        mobileOverlay.classList.add("show");
        if (hamburgerBtn) hamburgerBtn.classList.add("hamburger-hidden");
    });

    const closeSidebar = () => {
        sidebar.classList.remove("mobile-open");
        mobileOverlay.classList.remove("show");
        if (hamburgerBtn) hamburgerBtn.classList.remove("hamburger-hidden");
    };

    closeSidebarBtn?.addEventListener("click", closeSidebar);
    mobileOverlay?.addEventListener("click", closeSidebar);

    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
}

// Setup navigation
function setupNavigation() {
    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            if (!view) return;
            switchView(view);
        });
    });
}

// Switch between views
function switchView(view) {
    // Stop RT monitors when leaving overview
    if (currentView === 'overview' && view !== 'overview') stopSystemRT();
    currentView = view;

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.classList.remove("sidebar-active");
        if (link.dataset.view === view) {
            link.classList.add("sidebar-active");
        }
    });

    document.querySelectorAll(".view-content").forEach((el) => {
        el.classList.add("hidden");
    });

    document.getElementById(`view-${view}`).classList.remove("hidden");

    const titles = {
        overview: "Overview",
        groups: "Groups",
        users: "Users",
        logs: "Logs",
        system: "System Information",
        settings: "Settings & Config",
        commands: "Command Manager",
        security: "IP Security",
    };
    document.getElementById("page-title").textContent = titles[view] || view;

    switch (view) {
        case "overview":
            loadOverview();
            startSystemRT();
            break;
        case "groups":
            loadGroups();
            break;
        case "users":
            loadUsers();
            break;
        case "logs":
            loadLogs();
            break;
        case "system":
            loadSystem();
            break;
        case "settings":
            loadSettings();
            break;
        case "commands":
            loadCommands();
            break;
        case "security":
            loadIPSecurity();
            break;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Groups
    document
        .getElementById("refresh-groups")
        ?.addEventListener("click", () => loadGroups());
    document.getElementById("search-groups")?.addEventListener(
        "input",
        debounce(() => loadGroups(), 500)
    );
    document.getElementById("filter-community")?.addEventListener("change", () => loadGroups());
    document.getElementById("join-group-btn")?.addEventListener("click", () => {
        document.getElementById("join-group-url").value = "";
        document.getElementById("join-group-error").style.display = "none";
        document.getElementById("join-group-modal").classList.add("show");
        setTimeout(() => document.getElementById("join-group-url").focus(), 80);
    });
    document.getElementById("join-group-url")?.addEventListener("keydown", e => {
        if (e.key === "Enter") joinGroup();
    });

    // Users
    document
        .getElementById("refresh-users")
        ?.addEventListener("click", () => loadUsers());
    document.getElementById("search-users")?.addEventListener(
        "input",
        debounce(() => loadUsers(), 500)
    );
    document
        .getElementById("filter-role")
        ?.addEventListener("change", () => loadUsers());
    document
        .getElementById("filter-banned")
        ?.addEventListener("change", () => loadUsers());

    // Logs
    document
        .getElementById("refresh-logs")
        ?.addEventListener("click", () => loadLogs());
    document
        .getElementById("filter-log-level")
        ?.addEventListener("change", () => loadLogs());
    document.getElementById("clear-logs")?.addEventListener("click", clearLogs);

    // Commands
    document
        .getElementById("refresh-commands")
        ?.addEventListener("click", () => loadCommands());
}

// Load overview data
async function loadOverview() {
    try {
        const [statsRes, growthRes, systemRes] = await Promise.all([
            authFetch(`${API_BASE}/stats`),
            authFetch(`${API_BASE}/stats/growth`),
            authFetch(`${API_BASE}/stats/system`),
        ]);

        const stats = statsRes.ok ? await statsRes.json() : {};
        const growth = growthRes.ok ? await growthRes.json() : { users: { byRole: {} }, groups: { settingsEnabled: {} } };
        const system = systemRes.ok ? await systemRes.json() : { memory: {}, platform: "—", nodeVersion: "—", pid: "—" };

        // Update stats cards
        document.getElementById("stat-users").textContent = stats.totalUsers ?? "—";
        document.getElementById("stat-groups").textContent = stats.totalGroups ?? "—";
        document.getElementById("stat-premium").textContent = stats.premiumUsers ?? "—";
        document.getElementById("stat-banned").textContent = stats.bannedUsers ?? 0;
        document.getElementById("stat-uptime").textContent = stats.uptime ?? "—";

        // Update legacy sysinfo rows
        document.getElementById("memory-usage").textContent = system.memory?.heapUsed ?? "—";
        document.getElementById("platform").textContent = system.platform ?? "—";
        document.getElementById("node-version").textContent = system.nodeVersion ?? "—";
        document.getElementById("pid").textContent = system.pid ?? "—";

        // Task Manager cards
        updateTaskManager(system, stats);

        // Update charts
        updateUserChart(growth.users?.byRole ?? {});
        updateGroupSettingsChart(growth.groups?.settingsEnabled ?? {});

        // Changelog (fire-and-forget, only loads once)
        if (!document.getElementById('changelog-modal-btn').dataset.loaded) {
            loadChangelog();
        }
    } catch (error) {
        if (error.message === "Unauthorized") return;
        console.error("loadOverview failed:", error);
    }
}

const CHANGELOG_BADGE = { feat:'cl-feat', fix:'cl-fix', refactor:'cl-refactor', perf:'cl-perf', docs:'cl-docs', note:'cl-note' };

async function loadChangelog() {
    try {
        const res = await fetch(`${API_BASE}/changelog`);
        const data = await res.json();
        if (!data.success || !data.changelog?.length) return;
        const btn = document.getElementById('changelog-modal-btn');
        const container = document.getElementById('changelog-modal-body');
        container.innerHTML = data.changelog.map(s => `
            <div class="cl-section">
                <div class="cl-date-label">${s.date}</div>
                <div class="cl-entries-grid">
                    ${s.entries.map(e => `
                        <div class="cl-entry">
                            <span class="cl-badge ${CHANGELOG_BADGE[e.type] || 'cl-default'}">${e.type}</span>
                            <span>${e.message}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        btn.dataset.loaded = '1';
        btn.style.display = '';
    } catch { /* silent */ }
}

function updateTaskManager(system, stats) {
    // Prefer raw byte fields for precision; fall back to parsing formatted string
    const heapUsed   = system.memory.heapUsedBytes  ?? parseMemory(system.memory.heapUsed);
    const heapTotal  = system.memory.heapTotalBytes  ?? parseMemory(system.memory.heapTotal);
    const rss        = system.memory.rssBytes        ?? parseMemory(system.memory.rss);
    const external   = system.memory.externalBytes   ?? parseMemory(system.memory.external);
    const heapPct    = heapTotal > 0 ? Math.min(100, (heapUsed  / heapTotal) * 100) : 0;
    const rssPct     = Math.min(100, (rss      / (heapTotal * 2 || 1)) * 100);
    const extPct     = Math.min(100, (external / (heapTotal      || 1)) * 100);

    const el = (id) => document.getElementById(id);
    if (el('tm-heap-used')) flashUpdate(el('tm-heap-used'), system.memory.heapUsed);
    if (el('tm-heap-bar')) el('tm-heap-bar').style.width = heapPct.toFixed(1) + '%';
    if (el('tm-heap-sub')) el('tm-heap-sub').textContent = `of ${system.memory.heapTotal} total (${heapPct.toFixed(0)}%)`;
    if (el('tm-rss')) flashUpdate(el('tm-rss'), system.memory.rss);
    if (el('tm-rss-bar')) el('tm-rss-bar').style.width = rssPct.toFixed(1) + '%';
    if (el('tm-external')) flashUpdate(el('tm-external'), system.memory.external);
    if (el('tm-ext-bar')) el('tm-ext-bar').style.width = extPct.toFixed(1) + '%';
    // OS Memory
    if (system.os) {
        const osPct = system.os.memPct;
        if (el('tm-os-mem')) flashUpdate(el('tm-os-mem'), `${osPct}%`);
        if (el('tm-os-mem-bar')) el('tm-os-mem-bar').style.width = osPct + '%';
        if (el('tm-os-mem-sub')) el('tm-os-mem-sub').textContent = `${system.os.usedMem} of ${system.os.totalMem}`;
    }

    // Sparkline history (last 60 data points = 2 min at 2s interval)
    _heapHistory.push(heapUsed / (1024 * 1024)); // MB
    if (_heapHistory.length > 60) _heapHistory.shift();
    updateSparkline();
}

// Flash a value change on a DOM element
function flashUpdate(el, newVal) {
    if (el.textContent === newVal) return; // no change, skip
    el.textContent = newVal;
    el.classList.remove('tm-val-flash');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('tm-val-flash');
}

// Real-Time System Monitor
function startSystemRT() {
    stopSystemRT();
    startSystemStream();
    // Uptime ticker — ticks every second locally for smooth display
    _uptimeTicker = setInterval(() => {
        if (_uptimeSeconds <= 0) return;
        _uptimeSeconds++;
        const el = document.getElementById('stat-uptime');
        if (el) el.textContent = formatUptimeLocal(_uptimeSeconds);
    }, 1000);
    // Refresh full stats+growth every 30s
    _overviewStatsInterval = setInterval(() => {
        if (currentView === 'overview') loadOverview();
    }, 30000);
}

function stopSystemRT() {
    if (_streamAbortController) { _streamAbortController.abort(); _streamAbortController = null; }
    clearInterval(_uptimeTicker);        _uptimeTicker = null;
    clearInterval(_overviewStatsInterval); _overviewStatsInterval = null;
}

async function startSystemStream() {
    const controller = new AbortController();
    _streamAbortController = controller;
    try {
        const response = await authFetch(`${API_BASE}/stats/stream`, { signal: controller.signal });
        if (!response.ok) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.uptimeSeconds) {
                        _uptimeSeconds = data.uptimeSeconds;
                    }
                    updateTaskManager(data, null);
                    if (data.platform) {
                        const p = document.getElementById('platform');
                        const nv = document.getElementById('node-version');
                        const pid = document.getElementById('pid');
                        const mu = document.getElementById('memory-usage');
                        if (p) p.textContent = data.platform;
                        if (nv) nv.textContent = data.nodeVersion ?? '—';
                        if (pid) pid.textContent = data.pid ?? '—';
                        if (mu) mu.textContent = data.memory?.heapUsed ?? '—';
                    }
                } catch { /* malformed chunk */ }
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') return;
        // Auto-reconnect after 3s on unexpected disconnect
        if (_streamAbortController === controller) {
            setTimeout(startSystemStream, 3000);
        }
    }
}

function formatUptimeLocal(s) {
    const d   = Math.floor(s / 86400);
    const h   = Math.floor((s % 86400) / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'm');
    parts.push(sec + 's');
    return parts.join(' ');
}


function updateSparkline() {
    const canvas = document.getElementById('memorySparkline');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (memorySparklineChart) memorySparklineChart.destroy();
    const labels = _heapHistory.map((_, i) => i === _heapHistory.length - 1 ? 'now' : '');
    memorySparklineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: _heapHistory,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.08)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.4,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.y.toFixed(1) + ' MB' } } },
            scales: {
                x: { display: false },
                y: { display: true, ticks: { color: '#4a5678', font: { size: 10 }, callback: v => v.toFixed(0) + ' MB' }, grid: { color: 'rgba(99,102,241,0.06)' } },
            },
        },
    });
}

// Update user distribution — CSS horizontal bars
function updateUserChart(data) {
    const total = Object.values(data).reduce((s, v) => s + v, 0);
    const badge = document.getElementById('ud-total-badge');
    if (badge) badge.textContent = `${total} total`;

    const container = document.getElementById('user-distribution-list');
    if (!container) return;
    container.innerHTML = '';

    const ROLE_CONFIG = {
        free:    { color: '#818cf8', bar: 'linear-gradient(90deg,#6366f1,#818cf8)' },
        premium: { color: '#fbbf24', bar: 'linear-gradient(90deg,#f59e0b,#fbbf24)' },
        owner:   { color: '#34d399', bar: 'linear-gradient(90deg,#10b981,#34d399)' },
        banned:  { color: '#fb7185', bar: 'linear-gradient(90deg,#f43f5e,#fb7185)' },
    };

    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([role, count]) => {
        const cfg = ROLE_CONFIG[role] || { color: '#94a3b8', bar: 'linear-gradient(90deg,#64748b,#94a3b8)' };
        const pct = total > 0 ? ((count / total) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'dist-row';
        row.innerHTML = `
            <span class="dist-dot" style="background:${cfg.color}"></span>
            <span class="dist-label">${role}</span>
            <div class="dist-bar-track">
                <div class="dist-bar-fill" style="width:0%;background:${cfg.bar}" data-target="${pct.toFixed(1)}"></div>
            </div>
            <span class="dist-count">${count}</span>
            <span class="dist-pct">${pct.toFixed(0)}%</span>`;
        container.appendChild(row);
    });

    // Animate bars after paint
    requestAnimationFrame(() => {
        container.querySelectorAll('.dist-bar-fill').forEach(el => {
            el.style.width = el.dataset.target + '%';
        });
    });
}

// Update group settings — icon mini-card grid
function updateGroupSettingsChart(data) {
    const totalGroups = Object.values(data).reduce((s, v) => s + v, 0);
    const badge = document.getElementById('gs-active-badge');
    if (badge) badge.textContent = `${totalGroups} active`;

    const container = document.getElementById('group-settings-grid');
    if (!container) return;
    container.innerHTML = '';

    const GS_CONFIG = {
        antilink: { icon: 'fa-link-slash',    color: '#818cf8', bg: 'rgba(99,102,241,0.15)',  label: 'Anti-Link' },
        antibot:  { icon: 'fa-robot',          color: '#f87171', bg: 'rgba(239,68,68,0.15)',   label: 'Anti-Bot'  },
        welcome:  { icon: 'fa-door-open',      color: '#34d399', bg: 'rgba(16,185,129,0.15)',  label: 'Welcome'   },
        notify:   { icon: 'fa-bell',           color: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  label: 'Notify'    },
        mute:     { icon: 'fa-microphone-slash',color: '#fb7185', bg: 'rgba(244,63,94,0.15)',  label: 'Mute'      },
    };

    Object.entries(data).forEach(([key, count]) => {
        const cfg = GS_CONFIG[key] || { icon: 'fa-gear', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: key };
        const isOn = count > 0;
        const item = document.createElement('div');
        item.className = `gs-item${isOn ? ' gs-on' : ''}`;
        item.innerHTML = `
            <div class="gs-icon" style="background:${isOn ? cfg.bg : 'rgba(148,163,184,0.06)'};color:${isOn ? cfg.color : '#4a5568'}">
                <i class="fas ${cfg.icon}"></i>
            </div>
            <div class="gs-count" style="color:${isOn ? cfg.color : 'var(--text-subtle)'}">${count}</div>
            <div class="gs-name">${cfg.label}</div>`;
        container.appendChild(item);
    });
}



// Load groups
async function loadGroups(page = 1) {
    const search = document.getElementById("search-groups").value;
    const communityType = document.getElementById("filter-community")?.value || "";
    const params = new URLSearchParams({ page, limit: 10, search });
    if (communityType) params.set("communityType", communityType);

    const refreshBtn = document.getElementById("refresh-groups");
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.innerHTML = '<span class="spinner"></span>'; }

    try {
        const data = await authFetch(`${API_BASE}/groups?${params}`).then((r) =>
            r.json()
        );

        const tbody = document.getElementById("groups-table");
        tbody.innerHTML = "";

        if (data.groups.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="7" class="table-empty">No groups found</td></tr>';
            return;
        }

        const GS_ICONS = [
            { key: 'antilink', check: s => s.antilink?.status, icon: 'fa-link-slash',      color: '#818cf8', label: 'Anti-Link' },
            { key: 'antibot',  check: s => s.antibot,          icon: 'fa-robot',            color: '#f87171', label: 'Anti-Bot'  },
            { key: 'welcome',  check: s => s.welcome,          icon: 'fa-door-open',        color: '#34d399', label: 'Welcome'   },
            { key: 'notify',   check: s => s.notify,           icon: 'fa-bell',             color: '#fbbf24', label: 'Notify'    },
            { key: 'mute',     check: s => s.mute,             icon: 'fa-microphone-slash', color: '#fb7185', label: 'Mute'      },
        ];

        data.groups.forEach((group) => {
            const row = document.createElement("tr");
            row.className = "";

            const settingIcons = GS_ICONS.map(({ check, icon, color, label }) => {
                const on = check(group.settings || {});
                return `<span title="${label}" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;font-size:0.7rem;
                    background:${on ? `${color}22` : 'rgba(148,163,184,0.06)'};
                    color:${on ? color : '#2d3a50'};
                    border:1px solid ${on ? `${color}44` : 'transparent'};
                    transition:all .2s">
                    <i class="fas ${icon}"></i>
                </span>`;
            }).join('');

            const botAdminBadge = group.botIsAdmin
                ? `<span style="font-size:0.7rem;padding:2px 8px;border-radius:5px;background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3);font-weight:600"><i class="fas fa-shield-halved" style="margin-right:3px"></i>Admin</span>`
                : `<span style="font-size:0.7rem;padding:2px 8px;border-radius:5px;background:rgba(148,163,184,0.08);color:#4a5678;border:1px solid rgba(148,163,184,0.15)">Member</span>`;

            const typeBadge = group.isCommunity
                ? `<span style="font-size:0.7rem;padding:2px 8px;border-radius:5px;background:rgba(139,92,246,0.15);color:#c084fc;border:1px solid rgba(139,92,246,0.3);font-weight:600"><i class="fas fa-people-group" style="margin-right:3px"></i>Community</span>`
                : group.isCommunityAnnounce
                ? `<span style="font-size:0.7rem;padding:2px 8px;border-radius:5px;background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);font-weight:600"><i class="fas fa-bullhorn" style="margin-right:3px"></i>Announce</span>`
                : `<span style="font-size:0.7rem;padding:2px 8px;border-radius:5px;background:rgba(148,163,184,0.08);color:#64748b;border:1px solid rgba(148,163,184,0.15);font-weight:600"><i class="fas fa-users" style="margin-right:3px"></i>Group</span>`;

            row.innerHTML = `
                <td>${escapeHtml(group.subject)}</td>
                <td>${typeBadge}</td>
                <td>${group.participantsCount}</td>
                <td><div style="display:flex;gap:3px;align-items:center">${settingIcons}</div></td>
                <td>${botAdminBadge}</td>
                <td>${new Date(group.createdAt).toLocaleDateString()}</td>
                <td style="display:flex;gap:4px">
                    <button class="btn-settings-group" title="Edit Settings" style="padding:4px 10px;border-radius:6px;font-size:0.8125rem;background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.25);cursor:pointer">
                        <i class="fas fa-sliders"></i>
                    </button>
                    <button class="btn-delete-group" title="Delete" style="padding:4px 10px;border-radius:6px;font-size:0.8125rem;background:rgba(220,38,38,0.12);color:#f87171;border:1px solid rgba(220,38,38,0.25);cursor:pointer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            const settingsBtn = row.querySelector(".btn-settings-group");
            settingsBtn.addEventListener("click", () => {
                openGroupModal(group);
            });

            const deleteBtn = row.querySelector(".btn-delete-group");
            deleteBtn.addEventListener("click", () => {
                deleteGroup(group.groupId, group.subject);
            });

            tbody.appendChild(row);
        });

        updatePagination("groups", data.pagination);
    } catch (error) {
        console.error("Failed to load groups:", error);
        showToast("Failed to load groups", "error");
    } finally {
        const refreshBtn = document.getElementById("refresh-groups");
        if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> <span class="hidden sm:inline">Refresh</span>'; }
    }
}

// Load users
async function loadUsers(page = 1) {
    const search = document.getElementById("search-users").value;
    const role = document.getElementById("filter-role").value;
    const banned = document.getElementById("filter-banned").value;
    const params = new URLSearchParams({
        page,
        limit: 10,
        search,
        role,
        banned,
    });

    const refreshBtn = document.getElementById("refresh-users");
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.innerHTML = '<span class="spinner"></span>'; }

    try {
        const data = await authFetch(`${API_BASE}/users?${params}`).then((r) =>
            r.json()
        );

        const tbody = document.getElementById("users-table");
        tbody.innerHTML = "";

        if (data.users.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="table-empty">No users found</td></tr>';
            return;
        }

        data.users.forEach((user) => {
            const row = document.createElement("tr");
            row.className = "";

            row.innerHTML = `
                <td style="font-family:monospace;font-size:0.8125rem">${escapeHtml(user.userId).substring(0, 20)}...</td>
                <td>${escapeHtml(user.name || "Unknown")}</td>
                <td>
                    <span style="font-size:0.75rem;padding:2px 8px;border-radius:5px;${
                        user.role === "premium"
                            ? "background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3)"
                            : "background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3)"
                    }">${user.role}</span>
                </td>
                <td>${user.limit}</td>
                <td style="display:flex;gap:4px;flex-wrap:wrap;padding:0.6875rem 0.875rem">
                    ${
                        user.isBanned
                            ? '<span style="font-size:0.75rem;padding:2px 8px;border-radius:5px;background:rgba(220,38,38,0.15);color:#f87171;border:1px solid rgba(220,38,38,0.3)">Banned</span>'
                            : ""
                    }
                    ${
                        user.afk?.status
                            ? '<span style="font-size:0.75rem;padding:2px 8px;border-radius:5px;background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3)">AFK</span>'
                            : ""
                    }
                    ${
                        user.isExpired
                            ? '<span style="font-size:0.75rem;padding:2px 8px;border-radius:5px;background:rgba(244,63,94,0.15);color:#fb7185;border:1px solid rgba(244,63,94,0.3)">Expired</span>'
                            : ""
                    }
                </td>
                <td>
                    <button class="btn-edit-user" style="padding:4px 10px;border-radius:6px;font-size:0.8125rem;background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.25);cursor:pointer;margin-right:4px">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-user" style="padding:4px 10px;border-radius:6px;font-size:0.8125rem;background:rgba(220,38,38,0.12);color:#f87171;border:1px solid rgba(220,38,38,0.25);cursor:pointer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            const editBtn = row.querySelector(".btn-edit-user");
            const deleteBtn = row.querySelector(".btn-delete-user");

            editBtn.addEventListener("click", () => {
                openUserModal("edit", user);
            });

            deleteBtn.addEventListener("click", () => {
                deleteUser(user.userId, user.name || "Unknown");
            });

            tbody.appendChild(row);
        });

        updatePagination("users", data.pagination);
    } catch (error) {
        console.error("Failed to load users:", error);
        showToast("Failed to load users", "error");
    } finally {
        const refreshBtn = document.getElementById("refresh-users");
        if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> <span class="hidden sm:inline">Refresh</span>'; }
    }
}

// Load logs
async function loadLogs(page = 1) {
    const level = document.getElementById("filter-log-level").value;
    const params = new URLSearchParams({ page, limit: 100, level });

    const refreshBtn = document.getElementById("refresh-logs");
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.innerHTML = '<span class="spinner"></span>'; }

    try {
        const data = await authFetch(`${API_BASE}/logs?${params}`).then((r) =>
            r.json()
        );

        const container = document.getElementById("logs-container");
        container.innerHTML = "";

        if (!data.logs || data.logs.length === 0) {
            container.innerHTML = '<p class="table-empty">No logs available</p>';
            return;
        }

        const lines = data.logs.map((log) => {
            const { pill, textColor, bg, border } = getLogMeta(log.level);
            const ts = formatLogTime(log.timestamp);
            const msg = escapeHtml(log.message);
            return `<div class="log-line" style="display:flex;align-items:flex-start;gap:0.625rem;padding:0.4375rem 0.875rem;border-bottom:1px solid rgba(99,102,241,0.05);transition:background 0.12s;" onmouseenter="this.style.background='rgba(99,102,241,0.04)'" onmouseleave="this.style.background=''">
                <span style="flex-shrink:0;font-size:0.6875rem;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--text-subtle);padding-top:1px;min-width:100px;white-space:nowrap;">${ts}</span>
                <span style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;min-width:48px;padding:2px 6px;border-radius:5px;border:1px solid ${border};background:${bg};color:${textColor};">${pill}</span>
                <span style="flex:1;font-family:'JetBrains Mono','Fira Code',monospace;font-size:0.8125rem;color:${textColor};line-height:1.55;word-break:break-all;white-space:pre-wrap;">${msg}</span>
            </div>`;
        }).join('');

        container.innerHTML = `<div style="font-family:'JetBrains Mono',monospace;">${lines}</div>`;
    } catch (error) {
        console.error("Failed to load logs:", error);
        showToast("Failed to load logs", "error");
    } finally {
        const refreshBtn = document.getElementById("refresh-logs");
        if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> <span class="hidden sm:inline">Refresh</span>'; }
    }
}

function formatLogTime(timestamp) {
    try {
        const d = new Date(timestamp);
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        const hr = String(d.getHours()).padStart(2, '0');
        const mn = String(d.getMinutes()).padStart(2, '0');
        const sc = String(d.getSeconds()).padStart(2, '0');
        return `${mo}/${dy} ${hr}:${mn}:${sc}`;
    } catch { return '—'; }
}

function getLogMeta(level) {
    switch ((level || '').toLowerCase()) {
        case 'error':
            return { pill: 'ERROR', textColor: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' };
        case 'warn':
            return { pill: 'WARN',  textColor: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
        case 'info':
            return { pill: 'INFO',  textColor: '#94a3b8', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.20)' };
        case 'debug':
            return { pill: 'DEBUG', textColor: '#67e8f9', bg: 'rgba(6,182,212,0.10)',  border: 'rgba(6,182,212,0.20)' };
        case 'connect':
            return { pill: 'CONN',  textColor: '#34d399', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.22)' };
        default:
            return { pill: (level || 'LOG').slice(0, 5).toUpperCase(), textColor: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' };
    }
}

// Clear logs
async function clearLogs() {
    if (!confirm("Are you sure you want to clear all logs?")) return;

    try {
        await authFetch(`${API_BASE}/logs`, { method: "DELETE" });
        loadLogs();
    } catch (error) {
        console.error("Failed to clear logs:", error);
        alert("Failed to clear logs");
    }
}

// Load system information
async function loadSystem() {
    try {
        const system = await authFetch(`${API_BASE}/stats/system`).then((r) =>
            r.json()
        );

        const details = document.getElementById("system-details");
        details.innerHTML = `
            <div class="sysinfo-list">
                <div class="sysinfo-row"><span class="sysinfo-key">Platform</span><span class="sysinfo-val">${system.platform}</span></div>
                <div class="sysinfo-row"><span class="sysinfo-key">Node Version</span><span class="sysinfo-val">${system.nodeVersion}</span></div>
                <div class="sysinfo-row"><span class="sysinfo-key">Process ID</span><span class="sysinfo-val">${system.pid}</span></div>
                <div class="sysinfo-row"><span class="sysinfo-key">Memory RSS</span><span class="sysinfo-val">${system.memory.rss}</span></div>
                <div class="sysinfo-row"><span class="sysinfo-key">Heap Total</span><span class="sysinfo-val">${system.memory.heapTotal}</span></div>
                <div class="sysinfo-row"><span class="sysinfo-key">Heap Used</span><span class="sysinfo-val">${system.memory.heapUsed}</span></div>
                <div class="sysinfo-row"><span class="sysinfo-key">External</span><span class="sysinfo-val">${system.memory.external}</span></div>
            </div>
        `;

        updateMemoryChart(system.memory);
    } catch (error) {
        console.error("Failed to load system info:", error);
    }
}

// Update memory chart
function updateMemoryChart(memory) {
    const ctx = document.getElementById("memoryChart").getContext("2d");

    if (memoryChart) {
        memoryChart.destroy();
    }

    memoryChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Heap Used", "Heap Free", "External"],
            datasets: [
                {
                    data: [
                        parseMemory(memory.heapUsed),
                        parseMemory(memory.heapTotal) -
                            parseMemory(memory.heapUsed),
                        parseMemory(memory.external),
                    ],
                    backgroundColor: [
                        "rgba(244,63,94,0.8)",
                        "rgba(16,185,129,0.8)",
                        "rgba(245,158,11,0.8)",
                    ],
                    borderColor: ["#f43f5e", "#10b981", "#f59e0b"],
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#94a3b8",
                        font: {
                            family: "'Inter', system-ui, sans-serif",
                            size: 12,
                        },
                    },
                },
            },
        },
    });
}

// Update pagination
function updatePagination(type, pagination) {
    const container = document.getElementById(`${type}-pagination`);
    container.innerHTML = "";

    const { page: current, totalPages } = pagination;
    if (totalPages <= 1) return;

    function makeBtn(label, page, isActive, isDisabled) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.className = "glow-button";
        if (isActive) {
            btn.style.cssText = "background:#6366f1;color:#fff;font-weight:600";
        } else if (isDisabled) {
            btn.style.cssText = "background:rgba(148,163,184,0.05);color:#475569;border:1px solid rgba(148,163,184,0.1);cursor:default;pointer-events:none";
        } else {
            btn.style.cssText = "background:rgba(148,163,184,0.08);color:#94a3b8;border:1px solid rgba(148,163,184,0.2)";
        }
        if (!isDisabled) {
            btn.addEventListener("click", () => {
                currentPage[type] = page;
                if (type === "groups") loadGroups(page);
                else if (type === "users") loadUsers(page);
                else if (type === "logs") loadLogs(page);
            });
        }
        return btn;
    }

    function makeEllipsis() {
        const span = document.createElement("span");
        span.textContent = "…";
        span.style.cssText = "color:#475569;padding:0 4px;align-self:center";
        return span;
    }

    // Prev button
    container.appendChild(makeBtn("‹", current - 1, false, current === 1));

    // Build page range: always show first, last, current±2
    const delta = 2;
    const pages = new Set();
    pages.add(1);
    pages.add(totalPages);
    for (let i = Math.max(2, current - delta); i <= Math.min(totalPages - 1, current + delta); i++) {
        pages.add(i);
    }
    const sorted = [...pages].sort((a, b) => a - b);

    let prev = 0;
    for (const p of sorted) {
        if (p - prev > 1) container.appendChild(makeEllipsis());
        container.appendChild(makeBtn(p, p, p === current, false));
        prev = p;
    }

    // Next button
    container.appendChild(makeBtn("›", current + 1, false, current === totalPages));
}

// Helper functions
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function parseMemory(memStr) {
    const match = memStr.match(/([\d.]+)\s*([A-Z]+)/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2];
    const multipliers = {
        Bytes: 1,
        KB: 1024,
        MB: 1024 * 1024,
        GB: 1024 * 1024 * 1024,
    };
    return value * (multipliers[unit] || 1);
}

// ===== CRUD Functions =====

// User Modal Functions
function openUserModal(mode = "create", userData = null) {
    const modal = document.getElementById("user-modal");
    const form = document.getElementById("user-form");
    const title = document.getElementById("user-modal-title");
    const modeInput = document.getElementById("user-form-mode");

    form.reset();
    modeInput.value = mode;

    if (mode === "create") {
        title.textContent = "Add User";
        document.getElementById("user-userId").disabled = false;
    } else {
        title.textContent = "Edit User";
        document.getElementById("user-userId").value = userData.userId;
        document.getElementById("user-userId").disabled = true;
        document.getElementById("user-name").value = userData.name || "";
        document.getElementById("user-role").value = userData.role;
        document.getElementById("user-limit").value = userData.limit;
        document.getElementById("user-expired").value = userData.expired || 0;
    }

    modal.classList.add("show");
}

function closeUserModal() {
    const modal = document.getElementById("user-modal");
    modal.classList.remove("show");
}

// Group Modal Functions
function openGroupModal(groupData) {
    const modal = document.getElementById("group-modal");
    document.getElementById("group-groupId").value = groupData.groupId;
    document.getElementById("group-name").value = groupData.subject;
    document.getElementById("group-antilink").checked =
        groupData.settings.antilink?.status || false;
    document.getElementById("group-antibot").checked =
        groupData.settings.antibot || false;
    document.getElementById("group-welcome").checked =
        groupData.settings.welcome || false;
    document.getElementById("group-notify").checked =
        groupData.settings.notify || false;
    document.getElementById("group-mute").checked =
        groupData.settings.mute || false;

    modal.classList.add("show");
}

function closeGroupModal() {
    const modal = document.getElementById("group-modal");
    modal.classList.remove("show");
}

// User CRUD Operations
async function createUser(userData) {
    try {
        const response = await authFetch(`${API_BASE}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData),
        });

        const data = await response.json();

        if (response.ok) {
            alert("User created successfully!");
            closeUserModal();
            loadUsers();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert("Failed to create user");
        console.error(error);
    }
}

async function updateUser(userId, userData) {
    try {
        const response = await authFetch(`${API_BASE}/users/${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData),
        });

        const data = await response.json();

        if (response.ok) {
            alert("User updated successfully!");
            closeUserModal();
            loadUsers();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert("Failed to update user");
        console.error(error);
    }
}

async function deleteUser(userId, userName) {
    if (!confirm(`Are you sure you want to delete user "${userName}"?`)) {
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/users/${userId}`, {
            method: "DELETE",
        });

        const data = await response.json();

        if (response.ok) {
            alert("User deleted successfully!");
            loadUsers();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert("Failed to delete user");
        console.error(error);
    }
}

// Group CRUD Operations
async function updateGroupSettings(groupId, settings) {
    try {
        const response = await authFetch(`${API_BASE}/groups/${groupId}/settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings),
        });

        const data = await response.json();

        if (response.ok) {
            showToast("Group settings updated!", "success");
            closeGroupModal();
            loadGroups();
        } else {
            showToast(data.error || "Failed to update settings", "error");
        }
    } catch (error) {
        showToast("Failed to update group settings", "error");
        console.error(error);
    }
}

async function deleteGroup(groupId, groupName) {
    if (
        !confirm(
            `Are you sure you want to delete group "${groupName}"? This will remove all group data from the database.`
        )
    ) {
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/groups/${groupId}`, {
            method: "DELETE",
        });

        const data = await response.json();

        if (response.ok) {
            alert("Group deleted successfully!");
            loadGroups();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert("Failed to delete group");
        console.error(error);
    }
}

function closeJoinGroupModal() {
    document.getElementById("join-group-modal").classList.remove("show");
}

async function joinGroup() {
    const input = document.getElementById("join-group-url");
    const errorEl = document.getElementById("join-group-error");
    const submitBtn = document.getElementById("join-group-submit");
    const url = input.value.trim();

    errorEl.style.display = "none";

    if (!url) {
        errorEl.textContent = "Please enter an invite link.";
        errorEl.style.display = "block";
        return;
    }

    if (!/chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i.test(url)) {
        errorEl.textContent = "Invalid WhatsApp invite link format.";
        errorEl.style.display = "block";
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Joining...';

    try {
        const res = await authFetch(`${API_BASE}/groups/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inviteLink: url }),
        }).then(r => r.json());

        if (res.success) {
            closeJoinGroupModal();
            showToast(`Joined "${res.group?.subject || 'group'}" successfully!`, "success");
            setTimeout(() => loadGroups(), 3000);
        } else {
            errorEl.textContent = res.error || "Failed to join group.";
            errorEl.style.display = "block";
        }
    } catch {
        errorEl.textContent = "Connection error. Please try again.";
        errorEl.style.display = "block";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Join';
    }
}

// Form Event Listeners
document.getElementById("user-form")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const mode = document.getElementById("user-form-mode").value;
    const userId = document.getElementById("user-userId").value;
    const name = document.getElementById("user-name").value;
    const role = document.getElementById("user-role").value;
    const limit = parseInt(document.getElementById("user-limit").value);
    const expired = parseInt(document.getElementById("user-expired").value);

    const userData = { name, role, limit, expired };

    if (mode === "create") {
        createUser({ userId, ...userData });
    } else {
        updateUser(userId, userData);
    }
});

document.getElementById("group-form")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const groupId = document.getElementById("group-groupId").value;
    const settings = {
        antilinkStatus: document.getElementById("group-antilink").checked,
        antibot: document.getElementById("group-antibot").checked,
        welcome: document.getElementById("group-welcome").checked,
        notify: document.getElementById("group-notify").checked,
        mute: document.getElementById("group-mute").checked,
    };

    updateGroupSettings(groupId, settings);
});

document.getElementById("add-user-btn")?.addEventListener("click", () => {
    openUserModal("create");
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
        e.target.classList.remove("show");
    }
});

// ===== Toast Helper =====
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${String(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Settings =====
let _cachedConfig = null;
const SETTING_META = [
    { key: 'ownerNotifyOnline', name: 'Owner Notify Online', desc: 'Notifikasi ke owner saat bot online' },
    { key: 'useLimit',          name: 'Use Limit',           desc: 'Aktifkan limit penggunaan command per user' },
    { key: 'useCooldown',       name: 'Use Cooldown',        desc: 'Aktifkan cooldown antar penggunaan command' },
    { key: 'selfbot',           name: 'Selfbot Mode',        desc: 'Bot hanya merespons owner saja' },
    { key: 'autoReadMessage',   name: 'Auto Read Message',   desc: 'Otomatis centang biru pesan masuk' },
    { key: 'autoReadStatus',    name: 'Auto Read Status',    desc: 'Otomatis lihat story kontak' },
    { key: 'autoCorrect',       name: 'Auto Correct',        desc: 'Koreksi otomatis typo command' },
];

async function loadSettings() {
    const profile = JSON.parse(localStorage.getItem('adminProfile') || '{}');
    const isOwner = profile.role === 'owner';
    const hasAccess = isOwner || profile.role === 'team';
    document.getElementById('settings-owner-only')?.classList.toggle('hidden', hasAccess);
    document.getElementById('settings-content')?.classList.toggle('hidden', !hasAccess);
    // Phone numbers and save/reset buttons: owner only
    document.getElementById('phone-numbers-section')?.classList.toggle('hidden', !isOwner);
    document.getElementById('settings-save')?.classList.toggle('hidden', !isOwner);
    document.getElementById('settings-reset')?.classList.toggle('hidden', !isOwner);
    if (!hasAccess) return;
    try {
        const data = await authFetch(`${API_BASE}/config`).then(r => r.json());
        if (!data.success) return showToast('Failed to load config', 'error');
        _cachedConfig = data.config;
        renderSettingsToggles(data.config.settings, isOwner);
        document.getElementById('cfg-prefix').value = data.config.prefix || '.';
        document.getElementById('cfg-timezone').value = data.config.timeZone || '';
        document.getElementById('cfg-limit').value = data.config.limit?.command || 30;
        document.getElementById('cfg-call').value = data.config.call?.status || 'reject';
        document.getElementById('cfg-sticker-pack').value = data.config.stickers?.packname || '';
        document.getElementById('cfg-sticker-author').value = data.config.stickers?.author || '';
        // Load phone numbers (owner only)
        if (isOwner) {
            const numRes = await authFetch(`${API_BASE}/config/numbers`).then(r => r.json());
            if (numRes.success) {
                renderNumberList('owner', numRes.ownerNumber || []);
                renderNumberList('team', numRes.teamNumber || []);
            }
        }
    } catch { showToast('Failed to load settings', 'error'); }
}

function renderSettingsToggles(settings, isOwner = true) {
    const wrap = document.getElementById('settings-toggles');
    if (!wrap) return;
    wrap.innerHTML = '';
    SETTING_META.forEach(({ key, name, desc }) => {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.innerHTML = `
            <div class="setting-info">
                <div class="setting-name">${name}</div>
                <div class="setting-desc">${desc}</div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" data-key="${key}" ${settings[key] ? 'checked' : ''} ${!isOwner ? 'disabled' : ''} />
                <span class="toggle-slider"></span>
            </label>`;
        wrap.appendChild(row);
    });
    if (!isOwner) return; // team: read-only, no change listeners
    wrap.querySelectorAll('input[type=checkbox]').forEach(chk => {
        chk.addEventListener('change', async () => {
            try {
                const res = await authFetch(`${API_BASE}/config/settings`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [chk.dataset.key]: chk.checked }),
                }).then(r => r.json());
                showToast(res.success ? 'Setting updated' : (res.message || 'Failed'), res.success ? 'success' : 'error');
                if (!res.success) chk.checked = !chk.checked;
            } catch { chk.checked = !chk.checked; showToast('Connection error', 'error'); }
        });
    });
}

document.getElementById('settings-save')?.addEventListener('click', async () => {
    try {
        const res = await authFetch(`${API_BASE}/config/general`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prefix: document.getElementById('cfg-prefix').value,
                timeZone: document.getElementById('cfg-timezone').value,
                limit: { command: Number(document.getElementById('cfg-limit').value) },
                call: { status: document.getElementById('cfg-call').value },
                stickers: {
                    packname: document.getElementById('cfg-sticker-pack').value,
                    author: document.getElementById('cfg-sticker-author').value,
                },
            }),
        }).then(r => r.json());
        showToast(res.success ? 'Config saved!' : (res.message || 'Failed'), res.success ? 'success' : 'error');
    } catch { showToast('Failed to save config', 'error'); }
});

document.getElementById('settings-reset')?.addEventListener('click', () => {
    if (_cachedConfig) {
        renderSettingsToggles(_cachedConfig.settings);
        document.getElementById('cfg-prefix').value = _cachedConfig.prefix || '.';
        document.getElementById('cfg-timezone').value = _cachedConfig.timeZone || '';
        document.getElementById('cfg-limit').value = _cachedConfig.limit?.command || 30;
        document.getElementById('cfg-call').value = _cachedConfig.call?.status || 'reject';
        document.getElementById('cfg-sticker-pack').value = _cachedConfig.stickers?.packname || '';
        document.getElementById('cfg-sticker-author').value = _cachedConfig.stickers?.author || '';
        showToast('Form reset to saved values');
    }
});

let _maintenanceCommands = [];
let _maintenance = [];

async function toggleMaintenance(name) {
    const inMaint = _maintenance.includes(name);
    try {
        let res;
        if (inMaint) {
            res = await authFetch(`${API_BASE}/config/maintenance/${encodeURIComponent(name)}`, { method: 'DELETE' }).then(r => r.json());
        } else {
            res = await authFetch(`${API_BASE}/config/maintenance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: name }),
            }).then(r => r.json());
        }
        if (res.success) {
            _maintenance = res.maintenance;
            renderCommandsTable();
            showToast(inMaint ? `${name} removed from maintenance` : `${name} added to maintenance`);
        } else {
            showToast(res.message || 'Failed', 'error');
        }
    } catch { showToast('Connection error', 'error'); }
}

let _allCommands = [];
let _commandsPage = 1;
let _commandsIsOwner = false;
const CMDS_PER_PAGE = 20;

async function loadCommands() {
    const profile = JSON.parse(localStorage.getItem('adminProfile') || '{}');
    const isOwner = profile.role === 'owner';
    const hasAccess = isOwner || profile.role === 'team';
    _commandsIsOwner = isOwner;
    document.getElementById('commands-owner-only')?.classList.toggle('hidden', hasAccess);
    document.getElementById('commands-content')?.classList.toggle('hidden', !hasAccess);
    if (!hasAccess) return;

    document.getElementById('commands-table').innerHTML = `<tr><td colspan="12" class="table-empty">Loading...</td></tr>`;
    try {
        const [cmdRes, maintRes] = await Promise.all([
            authFetch(`${API_BASE}/config/commands`).then(r => r.json()),
            authFetch(`${API_BASE}/config/maintenance`).then(r => r.json()),
        ]);
        if (!cmdRes.success) return showToast(cmdRes.message || 'Failed to load commands', 'error');
        _allCommands = cmdRes.commands;
        _maintenance = maintRes.maintenance || [];

        // Populate category filter
        const catSel = document.getElementById('filter-cmd-category');
        const cats = [...new Set(_allCommands.map(c => c.category))].sort();
        catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');

        _commandsPage = 1;
        renderCommandsTable();
    } catch { showToast('Failed to load commands', 'error'); }
}

function renderCommandsTable() {
    const search = (document.getElementById('search-commands')?.value || '').toLowerCase();
    const cat = document.getElementById('filter-cmd-category')?.value || '';
    const overrideFilter = document.getElementById('filter-cmd-override')?.value || '';

    let filtered = _allCommands.filter(c => {
        if (search && !c.name.includes(search) && !c.description?.toLowerCase().includes(search)) return false;
        if (cat && c.category !== cat) return false;
        if (overrideFilter === 'overridden' && !c.override) return false;
        return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / CMDS_PER_PAGE));
    _commandsPage = Math.min(_commandsPage, totalPages);
    const start = (_commandsPage - 1) * CMDS_PER_PAGE;
    const page = filtered.slice(start, start + CMDS_PER_PAGE);

    const tbody = document.getElementById('commands-table');

    function badge(val, def) {
        const effective = val ?? def;
        const hasOverride = val !== null && val !== undefined;
        const color = effective ? '#22c55e' : 'var(--text-subtle)';
        const icon = effective ? 'check' : 'times';
        return `<i class="fas fa-${icon}" style="color:${color};${hasOverride ? 'font-weight:700;' : ''}"></i>`;
    }
    function numBadge(val, def) {
        const hasOverride = val !== null && val !== undefined;
        const display = hasOverride ? val : (def ?? '—');
        return `<span style="color:${hasOverride ? '#a5b4fc' : 'var(--text-subtle)'}">${display}</span>`;
    }

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="12" class="table-empty">No commands found</td></tr>`;
    } else {
        tbody.innerHTML = page.map(cmd => {
            const ov = cmd.override || {};
            const hasOverride = !!cmd.override && Object.keys(cmd.override).length > 0;
            const inMaint = _maintenance.includes(cmd.name);
            const maintBtn = _commandsIsOwner
                ? `<label class="toggle-switch toggle-green" title="${inMaint ? 'Disable maintenance' : 'Enable maintenance'}" onclick="event.preventDefault();toggleMaintenance('${cmd.name}')">
                <input type="checkbox" ${inMaint ? 'checked' : ''} readonly />
                <span class="toggle-slider"></span>
            </label>`
                : `<label class="toggle-switch toggle-green" style="opacity:0.5;pointer-events:none">
                <input type="checkbox" ${inMaint ? 'checked' : ''} disabled />
                <span class="toggle-slider"></span>
            </label>`;
            const actionsBtn = _commandsIsOwner
                ? `<button onclick="openCommandModal('${cmd.name}')" class="btn btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.8rem;"><i class="fas fa-pen"></i></button>`
                : `<span style="color:var(--text-subtle);font-size:0.75rem;">—</span>`;
            return `<tr>
                <td class="cmd-name"><strong style="color:var(--text)">${cmd.name}</strong>
                    ${cmd.alias?.length ? `<br><span style="font-size:0.7rem;color:var(--text-subtle)">${cmd.alias.join(', ')}</span>` : ''}
                </td>
                <td class="cmd-cat"><span style="font-size:0.75rem;background:rgba(99,102,241,0.1);padding:2px 8px;border-radius:6px;color:#a5b4fc">${cmd.category}</span></td>
                <td class="hide-sm" style="text-align:center">${badge(ov.isOwner !== undefined ? ov.isOwner : null, cmd.isOwner)}</td>
                <td class="hide-sm" style="text-align:center">${badge(ov.isTeam !== undefined ? ov.isTeam : null, cmd.isTeam)}</td>
                <td class="hide-sm" style="text-align:center">${badge(ov.isPremium !== undefined ? ov.isPremium : null, cmd.isPremium)}</td>
                <td class="hide-sm" style="text-align:center">${badge(ov.isPrivate !== undefined ? ov.isPrivate : null, cmd.isPrivate)}</td>
                <td class="hide-sm" style="text-align:center">${badge(ov.isGroup !== undefined ? ov.isGroup : null, cmd.isGroup)}</td>
                <td class="hide-sm">${numBadge(ov.cooldown !== undefined ? ov.cooldown : null, cmd.cooldown)}s</td>
                <td class="hide-sm">${numBadge(ov.limit !== undefined ? ov.limit : null, cmd.limit)}</td>
                <td class="cmd-override">${hasOverride ? '<span style="font-size:0.75rem;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);color:#fbbf24;padding:2px 8px;border-radius:6px;">Modified</span>' : '<span style="color:var(--text-subtle);font-size:0.75rem;">Default</span>'}</td>
                <td class="cmd-maint" style="text-align:center">${maintBtn}</td>
                <td class="cmd-actions">${actionsBtn}</td>
            </tr>`;
        }).join('');
    }

    // Pagination
    const pag = document.getElementById('commands-pagination');
    if (pag) {
        pag.innerHTML = '';
        if (totalPages > 1) {
            const delta = 2;
            const pages = new Set([1, totalPages]);
            for (let i = Math.max(2, _commandsPage - delta); i <= Math.min(totalPages - 1, _commandsPage + delta); i++) pages.add(i);
            const sorted = [...pages].sort((a, b) => a - b);

            const prevDisabled = _commandsPage === 1;
            pag.insertAdjacentHTML('beforeend', `<button class="glow-button" style="${prevDisabled ? 'background:rgba(148,163,184,0.05);color:#475569;border:1px solid rgba(148,163,184,0.1);cursor:default;pointer-events:none' : 'background:rgba(148,163,184,0.08);color:#94a3b8;border:1px solid rgba(148,163,184,0.2)'}" ${prevDisabled ? '' : `onclick="goCommandsPage(${_commandsPage - 1})"`}>&#8249;</button>`);

            let prev = 0;
            for (const p of sorted) {
                if (p - prev > 1) pag.insertAdjacentHTML('beforeend', '<span style="color:#475569;padding:0 4px;align-self:center">…</span>');
                pag.insertAdjacentHTML('beforeend', `<button class="glow-button" style="${p === _commandsPage ? 'background:#6366f1;color:#fff;font-weight:600' : 'background:rgba(148,163,184,0.08);color:#94a3b8;border:1px solid rgba(148,163,184,0.2)'}" onclick="goCommandsPage(${p})">${p}</button>`);
                prev = p;
            }

            const nextDisabled = _commandsPage === totalPages;
            pag.insertAdjacentHTML('beforeend', `<button class="glow-button" style="${nextDisabled ? 'background:rgba(148,163,184,0.05);color:#475569;border:1px solid rgba(148,163,184,0.1);cursor:default;pointer-events:none' : 'background:rgba(148,163,184,0.08);color:#94a3b8;border:1px solid rgba(148,163,184,0.2)'}" ${nextDisabled ? '' : `onclick="goCommandsPage(${_commandsPage + 1})"`}>&#8250;</button>`);
        }
    }
}

function goCommandsPage(page) {
    _commandsPage = page;
    renderCommandsTable();
}

function openCommandModal(name) {
    const cmd = _allCommands.find(c => c.name === name);
    if (!cmd) return;
    const ov = cmd.override || {};

    document.getElementById('cmd-modal-name').textContent = name;
    document.getElementById('cmd-modal-cmdname').value = name;

    // Set effective values (override takes precedence, else file default)
    const fields = ['isOwner','isTeam','isPremium','isPrivate','isGroup','isGroupAdmin','isGroupOwner','isBotAdmin'];
    fields.forEach(f => {
        const el = document.getElementById(`cmd-${f}`);
        if (el) el.checked = ov[f] !== undefined ? ov[f] : cmd[f] || false;
    });

    const cdEl = document.getElementById('cmd-cooldown');
    const limEl = document.getElementById('cmd-limit');
    if (cdEl) cdEl.value = ov.cooldown !== undefined ? ov.cooldown : (cmd.cooldown ?? '');
    if (limEl) limEl.value = ov.limit !== undefined ? ov.limit : (cmd.limit ?? '');

    document.getElementById('command-modal').classList.add('show');
}

function closeCommandModal() {
    document.getElementById('command-modal').classList.remove('show');
}

document.getElementById('command-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cmd-modal-cmdname').value;
    const payload = {
        isOwner: document.getElementById('cmd-isOwner').checked,
        isTeam: document.getElementById('cmd-isTeam').checked,
        isPremium: document.getElementById('cmd-isPremium').checked,
        isPrivate: document.getElementById('cmd-isPrivate').checked,
        isGroup: document.getElementById('cmd-isGroup').checked,
        isGroupAdmin: document.getElementById('cmd-isGroupAdmin').checked,
        isGroupOwner: document.getElementById('cmd-isGroupOwner').checked,
        isBotAdmin: document.getElementById('cmd-isBotAdmin').checked,
        cooldown: document.getElementById('cmd-cooldown').value !== '' ? Number(document.getElementById('cmd-cooldown').value) : null,
        limit: document.getElementById('cmd-limit').value !== '' ? Number(document.getElementById('cmd-limit').value) : null,
    };
    // Remove null values
    Object.keys(payload).forEach(k => payload[k] === null && delete payload[k]);

    try {
        const res = await authFetch(`${API_BASE}/config/commands/${encodeURIComponent(name)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(r => r.json());

        if (res.success) {
            showToast(`Override saved for ${name}`);
            closeCommandModal();
            loadCommands();
        } else {
            showToast(res.message || 'Failed to save override', 'error');
        }
    } catch { showToast('Connection error', 'error'); }
});

document.getElementById('cmd-reset-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('cmd-modal-cmdname').value;
    if (!name) return;
    if (!confirm(`Reset all overrides for command "${name}"?`)) return;
    try {
        const res = await authFetch(`${API_BASE}/config/commands/${encodeURIComponent(name)}/override`, { method: 'DELETE' }).then(r => r.json());
        if (res.success) {
            showToast(`Override reset for ${name}`);
            closeCommandModal();
            loadCommands();
        } else {
            showToast(res.message || 'Failed to reset', 'error');
        }
    } catch { showToast('Connection error', 'error'); }
});

document.getElementById('refresh-commands')?.addEventListener('click', () => loadCommands());
document.getElementById('search-commands')?.addEventListener('input', debounce(() => renderCommandsTable(), 300));
document.getElementById('filter-cmd-category')?.addEventListener('change', () => renderCommandsTable());
document.getElementById('filter-cmd-override')?.addEventListener('change', () => renderCommandsTable());

async function loadIPSecurity() {
    const profile = JSON.parse(localStorage.getItem('adminProfile') || '{}');
    const isOwner = profile.role === 'owner';
    document.getElementById('security-owner-only')?.classList.toggle('hidden', isOwner);
    document.getElementById('security-content')?.classList.toggle('hidden', !isOwner);
    if (!isOwner) return;

    try {
        const res = await authFetch(`${API_BASE}/config/ip`).then(r => r.json());
        if (!res.success) return showToast(res.message || 'Failed to load IP list', 'error');
        renderIPTable('whitelist', res.ipWhitelist || []);
        renderIPTable('blacklist', res.ipBlacklist || []);
    } catch {
        showToast('Failed to load IP Security data', 'error');
    }
}

function ipRoleBadge(role) {
    const safe = role === 'owner' || role === 'team' ? role : 'unknown';
    const palette = {
        owner:   { classes: 'bg-amber-500/10 border-amber-500/30 text-amber-400',  icon: 'fa-crown' },
        team:    { classes: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400', icon: 'fa-user-shield' },
        unknown: { classes: 'bg-slate-500/10 border-slate-500/30 text-slate-400',  icon: 'fa-circle-question' },
    }[safe];
    const label = safe.charAt(0).toUpperCase() + safe.slice(1);
    return `<span class="inline-flex items-center gap-1 ${palette.classes} border px-2 py-px rounded-full text-[0.7rem] font-bold uppercase tracking-wider">
        <i class="fas ${palette.icon} text-[0.6rem]"></i>${label}
    </span>`;
}

function renderIPTable(list, entries) {
    const tbody = document.getElementById(`${list}-tbody`);
    const countEl = document.getElementById(`${list}-count`);

    // Normalize entries (string[] for legacy responses or {ip, role}[]).
    const normalized = (entries || [])
        .map(e => {
            if (typeof e === 'string') return { ip: e, role: 'unknown' };
            if (e && typeof e === 'object') {
                const ip = typeof e.ip === 'string' ? e.ip : (e.ip != null ? String(e.ip) : '');
                const role = typeof e.role === 'string' ? e.role : 'unknown';
                return { ip, role };
            }
            return { ip: String(e ?? ''), role: 'unknown' };
        })
        .filter(e => e.ip);

    if (countEl) countEl.textContent = normalized.length;

    if (!normalized.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No IPs in ${list}</td></tr>`;
        return;
    }

    // Group by role
    const order = ['owner', 'team', 'unknown'];
    const grouped = {};
    for (const e of normalized) (grouped[e.role] = grouped[e.role] || []).push(e);

    const dotClasses = list === 'whitelist' ? 'text-emerald-400' : 'text-rose-400';
    const iconClass = list === 'whitelist' ? 'fa-circle-check' : 'fa-ban';

    let html = '';
    let counter = 0;
    for (const role of order) {
        const items = grouped[role];
        if (!items?.length) continue;
        html += `<tr><td colspan="4" class="bg-indigo-500/[0.04] px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">
            ${ipRoleBadge(role)} <span class="ml-2 text-[color:var(--text-subtle)] normal-case tracking-normal font-medium">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span>
        </td></tr>`;
        for (const e of items) {
            counter++;
            html += `
                <tr>
                    <td class="text-[color:var(--text-subtle)] w-10">${counter}</td>
                    <td>
                        <span class="font-mono text-sm text-[color:var(--text)] inline-flex items-center gap-1.5">
                            <i class="fas ${iconClass} ${dotClasses} text-[0.7rem]"></i>${e.ip}
                        </span>
                    </td>
                    <td>${ipRoleBadge(e.role)}</td>
                    <td class="text-right whitespace-nowrap">
                        <button class="btn btn-ghost px-2.5 py-1 text-xs mr-1" title="Edit" onclick="openIpEditModal('${list}','${e.ip}','${e.role}')">
                            <i class="fas fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-danger px-2.5 py-1 text-xs" title="Remove" onclick="removeIpFromList('${list}','${e.ip}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
    }
    tbody.innerHTML = html;
}

async function addIpToList(list) {
    const input = document.getElementById(`${list}-input`);
    const roleSel = document.getElementById(`${list}-role`);
    const ip = input?.value?.trim();
    const role = (roleSel?.value || 'unknown').toLowerCase();
    if (!ip) { showToast('Please enter an IP address first', 'error'); return; }

    // Basic IP validation (IPv4 and IPv6)
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-fA-F:]+$/;
    if (!ipv4.test(ip) && !ipv6.test(ip)) {
        showToast('Invalid IP address format', 'error');
        return;
    }

    try {
        const res = await authFetch(`${API_BASE}/config/ip/${list}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, role }),
        }).then(r => r.json());

        if (res.success) {
            showToast(`IP ${ip} added to ${list} (${role})`);
            input.value = '';
            renderIPTable('whitelist', res.ipWhitelist || []);
            renderIPTable('blacklist', res.ipBlacklist || []);
        } else {
            showToast(res.message || 'Failed to add IP', 'error');
        }
    } catch {
        showToast('Connection error', 'error');
    }
}

async function removeIpFromList(list, ip) {
    if (!confirm(`Remove ${ip} from ${list}?`)) return;

    try {
        const res = await authFetch(`${API_BASE}/config/ip/${list}/${encodeURIComponent(ip)}`, {
            method: 'DELETE',
        }).then(r => r.json());

        if (res.success) {
            showToast(`IP ${ip} removed from ${list}`);
            renderIPTable('whitelist', res.ipWhitelist || []);
            renderIPTable('blacklist', res.ipBlacklist || []);
        } else {
            showToast(res.message || 'Failed to remove IP', 'error');
        }
    } catch {
        showToast('Connection error', 'error');
    }
}

function openIpEditModal(list, ip, role) {
    const modal = document.getElementById('ip-edit-modal');
    if (!modal) return;
    const title = document.getElementById('ip-edit-title');
    const errorEl = document.getElementById('ip-edit-error');
    document.getElementById('ip-edit-list').value = list;
    document.getElementById('ip-edit-original').value = ip;
    document.getElementById('ip-edit-input').value = ip;
    document.getElementById('ip-edit-role').value =
        role === 'owner' || role === 'team' ? role : 'unknown';
    if (title) {
        const label = list === 'whitelist' ? 'Whitelist' : 'Blacklist';
        title.textContent = `Edit ${label} Entry`;
    }
    if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
    }
    modal.classList.add('show');
}

function closeIpEditModal() {
    document.getElementById('ip-edit-modal')?.classList.remove('show');
}

async function saveIpEdit() {
    const list = document.getElementById('ip-edit-list').value;
    const originalIp = document.getElementById('ip-edit-original').value;
    const newIp = document.getElementById('ip-edit-input').value.trim();
    const role = (document.getElementById('ip-edit-role').value || 'unknown').toLowerCase();
    const errorEl = document.getElementById('ip-edit-error');
    const showError = (msg) => {
        if (!errorEl) return showToast(msg, 'error');
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    };
    if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
    }

    if (!newIp) {
        showError('IP address is required');
        return;
    }
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-fA-F:]+$/;
    if (!ipv4.test(newIp) && !ipv6.test(newIp)) {
        showError('Invalid IP address format');
        return;
    }

    try {
        const res = await authFetch(
            `${API_BASE}/config/ip/${list}/${encodeURIComponent(originalIp)}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: newIp, role }),
            }
        ).then(r => r.json());

        if (res.success) {
            showToast(`IP entry updated (${list})`);
            closeIpEditModal();
            renderIPTable('whitelist', res.ipWhitelist || []);
            renderIPTable('blacklist', res.ipBlacklist || []);
        } else {
            showError(res.message || 'Failed to update IP');
        }
    } catch {
        showError('Connection error');
    }
}

// Allow Enter key to submit IP inputs
document.getElementById('whitelist-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addIpToList('whitelist'); });
document.getElementById('blacklist-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addIpToList('blacklist'); });

// Phone number management
function renderNumberList(type, numbers) {
    const listEl = document.getElementById(`${type}-number-list`);
    const countEl = document.getElementById(`${type}-number-count`);
    if (countEl) countEl.textContent = numbers.length;
    if (!listEl) return;
    if (!numbers.length) {
        listEl.innerHTML = `<span style="color:var(--text-subtle);font-size:0.8125rem;">No numbers added</span>`;
        return;
    }
    const color = type === 'owner' ? '#fbbf24' : '#818cf8';
    const bg = type === 'owner' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)';
    const border = type === 'owner' ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.25)';
    listEl.innerHTML = numbers.map(num => `
        <span style="display:inline-flex;align-items:center;gap:0.375rem;background:${bg};border:1px solid ${border};color:${color};padding:3px 10px;border-radius:20px;font-size:0.8125rem;font-family:'JetBrains Mono',monospace;">
            +${num}
            <button onclick="removePhoneNumber('${type}','${num}')" style="background:none;border:none;cursor:pointer;color:${color};opacity:0.6;padding:0;font-size:0.7rem;line-height:1;transition:opacity .15s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">
                <i class="fas fa-times"></i>
            </button>
        </span>
    `).join('');
}

async function addPhoneNumber(type) {
    const input = document.getElementById(`${type}-number-input`);
    const number = input?.value?.trim().replace(/\D/g, '');
    if (!number || number.length < 8) { showToast('Enter a valid phone number (min 8 digits)', 'error'); return; }
    try {
        const res = await authFetch(`${API_BASE}/config/numbers/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number }),
        }).then(r => r.json());
        if (res.success) {
            input.value = '';
            renderNumberList('owner', res.ownerNumber || []);
            renderNumberList('team', res.teamNumber || []);
            showToast(`Number added to ${type}`, 'success');
        } else {
            showToast(res.message || 'Failed to add number', 'error');
        }
    } catch { showToast('Connection error', 'error'); }
}

async function removePhoneNumber(type, number) {
    try {
        const res = await authFetch(`${API_BASE}/config/numbers/${type}/${encodeURIComponent(number)}`, {
            method: 'DELETE',
        }).then(r => r.json());
        if (res.success) {
            renderNumberList('owner', res.ownerNumber || []);
            renderNumberList('team', res.teamNumber || []);
            showToast(`Number removed from ${type}`, 'success');
        } else {
            showToast(res.message || 'Failed to remove number', 'error');
        }
    } catch { showToast('Connection error', 'error'); }
}

document.getElementById('owner-number-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addPhoneNumber('owner'); });
document.getElementById('team-number-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addPhoneNumber('team'); });

