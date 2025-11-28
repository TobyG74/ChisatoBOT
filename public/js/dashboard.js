// API Base URL
const API_BASE = window.location.origin + "/api";

// Current view and page state
let currentView = "overview";
let currentPage = { groups: 1, users: 1, logs: 1 };

// Chart instances
let userChart = null;
let groupSettingsChart = null;
let memoryChart = null;

// Authentication helper
function getAuthToken() {
    return localStorage.getItem("adminToken");
}

function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = "/login.html";
        return false;
    }

    try {
        const response = await authFetch(`${API_BASE}/auth/verify`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            localStorage.removeItem("adminToken");
            window.location.href = "/login.html";
            return false;
        }

        const data = await response.json();
        displayAdminInfo(data.admin);
        return true;
    } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("adminToken");
        window.location.href = "/login.html";
        return false;
    }
}

function displayAdminInfo(admin) {
    const pageSubtitle = document.getElementById("page-subtitle");
    if (pageSubtitle && admin) {
        const originalText = pageSubtitle.textContent;
        pageSubtitle.innerHTML = `${originalText} | Logged in as: <strong>${admin.username}</strong>`;
    }
}

function logout() {
    localStorage.removeItem("adminToken");
    window.location.href = "/login.html";
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
        window.location.href = "/login.html";
        throw new Error("Unauthorized");
    }

    return response;
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", async () => {
    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        return;
    }

    setupNavigation();
    setupMobileMenu();
    loadOverview();
    setupEventListeners();

    setInterval(() => {
        if (currentView === "overview") {
            loadOverview();
        }
    }, 30000);
});

// Setup mobile menu
function setupMobileMenu() {
    const sidebar = document.getElementById("sidebar");
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const closeSidebarBtn = document.getElementById("close-sidebar-btn");
    const mobileOverlay = document.getElementById("mobile-overlay");

    hamburgerBtn?.addEventListener("click", () => {
        sidebar.classList.add("mobile-open");
        mobileOverlay.classList.add("show");
    });

    const closeSidebar = () => {
        sidebar.classList.remove("mobile-open");
        mobileOverlay.classList.remove("show");
    };

    closeSidebarBtn?.addEventListener("click", closeSidebar);
    mobileOverlay?.addEventListener("click", closeSidebar);

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
}

// Setup navigation
function setupNavigation() {
    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            switchView(view);
        });
    });
}

// Switch between views
function switchView(view) {
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
    };
    document.getElementById("page-title").textContent = titles[view];

    switch (view) {
        case "overview":
            loadOverview();
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
}

// Load overview data
async function loadOverview() {
    try {
        const [stats, growth, system] = await Promise.all([
            authFetch(`${API_BASE}/stats`).then((r) => r.json()),
            authFetch(`${API_BASE}/stats/growth`).then((r) => r.json()),
            authFetch(`${API_BASE}/stats/system`).then((r) => r.json()),
        ]);

        // Update stats cards
        document.getElementById("stat-users").textContent = stats.totalUsers;
        document.getElementById("stat-groups").textContent = stats.totalGroups;
        document.getElementById("stat-premium").textContent =
            stats.premiumUsers;
        document.getElementById("stat-banned").textContent =
            stats.bannedUsers || 0;
        document.getElementById("stat-uptime").textContent = stats.uptime;

        // Update system info
        document.getElementById("memory-usage").textContent =
            system.memory.heapUsed;
        document.getElementById("platform").textContent = system.platform;
        document.getElementById("node-version").textContent =
            system.nodeVersion;
        document.getElementById("pid").textContent = system.pid;

        // Update charts
        updateUserChart(growth.users.byRole);
        updateGroupSettingsChart(growth.groups.settingsEnabled);
    } catch (error) {
        console.error("Failed to load overview:", error);
    }
}

// Update user distribution chart
function updateUserChart(data) {
    const ctx = document.getElementById("userChart").getContext("2d");

    if (userChart) {
        userChart.destroy();
    }

    userChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: Object.keys(data),
            datasets: [
                {
                    data: Object.values(data),
                    backgroundColor: [
                        "#00d9ff",
                        "#b967ff",
                        "#ff006e",
                        "#05ffa1",
                    ],
                    borderColor: ["#00d9ff", "#b967ff", "#ff006e", "#05ffa1"],
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
                        color: "#00d9ff",
                        font: {
                            family: "'Orbitron', sans-serif",
                            size: 12,
                        },
                    },
                },
            },
        },
    });
}

// Update group settings chart
function updateGroupSettingsChart(data) {
    const ctx = document.getElementById("groupSettingsChart").getContext("2d");

    if (groupSettingsChart) {
        groupSettingsChart.destroy();
    }

    groupSettingsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(data),
            datasets: [
                {
                    label: "Groups",
                    data: Object.values(data),
                    backgroundColor: [
                        "rgba(0, 217, 255, 0.8)",
                        "rgba(185, 103, 255, 0.8)",
                        "rgba(255, 0, 110, 0.8)",
                        "rgba(5, 255, 161, 0.8)",
                        "rgba(255, 251, 0, 0.8)",
                        "rgba(255, 69, 0, 0.8)",
                    ],
                    borderColor: [
                        "#00d9ff",
                        "#b967ff",
                        "#ff006e",
                        "#05ffa1",
                        "#fffb00",
                        "#ff4500",
                    ],
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#00d9ff",
                        font: {
                            family: "'Orbitron', sans-serif",
                        },
                    },
                    grid: {
                        color: "rgba(185, 103, 255, 0.1)",
                    },
                },
                x: {
                    ticks: {
                        color: "#00d9ff",
                        font: {
                            family: "'Orbitron', sans-serif",
                        },
                    },
                    grid: {
                        color: "rgba(185, 103, 255, 0.1)",
                    },
                },
            },
        },
    });
}

// Load groups
async function loadGroups(page = 1) {
    const search = document.getElementById("search-groups").value;
    const params = new URLSearchParams({ page, limit: 10, search });

    try {
        const data = await authFetch(`${API_BASE}/groups?${params}`).then((r) =>
            r.json()
        );

        const tbody = document.getElementById("groups-table");
        tbody.innerHTML = "";

        if (data.groups.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="text-center py-4" style="color: #b967ff;">No groups found</td></tr>';
            return;
        }

        data.groups.forEach((group) => {
            const row = document.createElement("tr");
            row.className = "border-b";
            row.style.borderColor = "rgba(185, 103, 255, 0.2)";

            row.innerHTML = `
                <td class="px-2 md:px-4 py-2 text-xs md:text-sm">${escapeHtml(
                    group.subject
                )}</td>
                <td class="px-2 md:px-4 py-2 text-xs md:text-sm">${
                    group.participantsCount
                }</td>
                <td class="px-2 md:px-4 py-2">
                    ${
                        group.settings.antilink?.status
                            ? '<span class="text-xs px-2 py-1 rounded" style="background: rgba(5, 255, 161, 0.2); color: #05ffa1; border: 1px solid #05ffa1;">Antilink</span>'
                            : ""
                    }
                    ${
                        group.settings.antibot
                            ? '<span class="text-xs px-2 py-1 rounded" style="background: rgba(0, 217, 255, 0.2); color: #00d9ff; border: 1px solid #00d9ff;">Antibot</span>'
                            : ""
                    }
                    ${
                        group.settings.mute
                            ? '<span class="text-xs px-2 py-1 rounded" style="background: rgba(255, 0, 110, 0.2); color: #ff006e; border: 1px solid #ff006e;">Muted</span>'
                            : ""
                    }
                </td>
                <td class="px-2 md:px-4 py-2 text-xs md:text-sm">${new Date(
                    group.createdAt
                ).toLocaleDateString()}</td>
                <td class="px-2 md:px-4 py-2">
                    <button class="btn-delete-group px-2 py-1 rounded text-xs hover:opacity-80"
                        style="background: rgba(255, 0, 110, 0.2); color: #ff006e; border: 1px solid #ff006e;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            const deleteBtn = row.querySelector(".btn-delete-group");
            deleteBtn.addEventListener("click", () => {
                deleteGroup(group.groupId, group.subject);
            });

            tbody.appendChild(row);
        });

        updatePagination("groups", data.pagination);
    } catch (error) {
        console.error("Failed to load groups:", error);
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

    try {
        const data = await authFetch(`${API_BASE}/users?${params}`).then((r) =>
            r.json()
        );

        const tbody = document.getElementById("users-table");
        tbody.innerHTML = "";

        if (data.users.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="text-center py-4" style="color: #b967ff;">No users found</td></tr>';
            return;
        }

        data.users.forEach((user) => {
            const row = document.createElement("tr");
            row.className = "border-b";
            row.style.borderColor = "rgba(185, 103, 255, 0.2)";

            row.innerHTML = `
                <td class="px-2 md:px-4 py-2 font-mono text-xs">${escapeHtml(
                    user.userId
                ).substring(0, 20)}...</td>
                <td class="px-2 md:px-4 py-2 text-xs md:text-sm">${escapeHtml(
                    user.name || "Unknown"
                )}</td>
                <td class="px-2 md:px-4 py-2">
                    <span class="text-xs px-2 py-1 rounded" style="${
                        user.role === "premium"
                            ? "background: rgba(185, 103, 255, 0.2); color: #b967ff; border: 1px solid #b967ff;"
                            : "background: rgba(0, 217, 255, 0.2); color: #00d9ff; border: 1px solid #00d9ff;"
                    }">
                        ${user.role}
                    </span>
                </td>
                <td class="px-2 md:px-4 py-2 text-xs md:text-sm">${
                    user.limit
                }</td>
                <td class="px-2 md:px-4 py-2">
                    ${
                        user.isBanned
                            ? '<span class="text-xs px-2 py-1 rounded" style="background: rgba(255, 69, 0, 0.2); color: #ff4500; border: 1px solid #ff4500;">Banned</span>'
                            : ""
                    }
                    ${
                        user.afk.status
                            ? '<span class="text-xs px-2 py-1 rounded" style="background: rgba(255, 251, 0, 0.2); color: #fffb00; border: 1px solid #fffb00;">AFK</span>'
                            : ""
                    }
                    ${
                        user.isExpired
                            ? '<span class="text-xs px-2 py-1 rounded" style="background: rgba(255, 0, 110, 0.2); color: #ff006e; border: 1px solid #ff006e;">Expired</span>'
                            : ""
                    }
                </td>
                <td class="px-2 md:px-4 py-2">
                    <button class="btn-edit-user px-2 py-1 rounded text-xs mr-1 hover:opacity-80"
                        style="background: rgba(0, 217, 255, 0.2); color: #00d9ff; border: 1px solid #00d9ff;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-user px-2 py-1 rounded text-xs hover:opacity-80"
                        style="background: rgba(255, 0, 110, 0.2); color: #ff006e; border: 1px solid #ff006e;">
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
    }
}

// Load logs
async function loadLogs(page = 1) {
    const level = document.getElementById("filter-log-level").value;
    const params = new URLSearchParams({ page, limit: 50, level });

    try {
        const data = await authFetch(`${API_BASE}/logs?${params}`).then((r) =>
            r.json()
        );

        const container = document.getElementById("logs-container");
        container.innerHTML = "";

        if (data.logs.length === 0) {
            container.innerHTML =
                '<p class="text-center" style="color: #b967ff;">No logs available</p>';
            return;
        }

        data.logs.forEach((log) => {
            const logEl = document.createElement("div");
            logEl.className = `p-3 rounded ${getLogLevelClass(log.level)}`;
            logEl.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <span class="font-semibold">[${log.level.toUpperCase()}]</span>
                        <span class="text-sm">${escapeHtml(log.message)}</span>
                    </div>
                    <span class="text-xs opacity-75">${new Date(
                        log.timestamp
                    ).toLocaleString()}</span>
                </div>
            `;
            container.appendChild(logEl);
        });
    } catch (error) {
        console.error("Failed to load logs:", error);
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
            <div class="space-y-2">
                <p><strong style="color: #ff006e;">Platform:</strong> <span style="color: #00d9ff;">${system.platform}</span></p>
                <p><strong style="color: #ff006e;">Node Version:</strong> <span style="color: #00d9ff;">${system.nodeVersion}</span></p>
                <p><strong style="color: #ff006e;">Process ID:</strong> <span style="color: #00d9ff;">${system.pid}</span></p>
                <p><strong style="color: #ff006e;">Memory RSS:</strong> <span style="color: #00d9ff;">${system.memory.rss}</span></p>
                <p><strong style="color: #ff006e;">Memory Heap Total:</strong> <span style="color: #00d9ff;">${system.memory.heapTotal}</span></p>
                <p><strong style="color: #ff006e;">Memory Heap Used:</strong> <span style="color: #00d9ff;">${system.memory.heapUsed}</span></p>
                <p><strong style="color: #ff006e;">Memory External:</strong> <span style="color: #00d9ff;">${system.memory.external}</span></p>
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
                        "rgba(255, 0, 110, 0.8)",
                        "rgba(5, 255, 161, 0.8)",
                        "rgba(255, 251, 0, 0.8)",
                    ],
                    borderColor: ["#ff006e", "#05ffa1", "#fffb00"],
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
                        color: "#00d9ff",
                        font: {
                            family: "'Orbitron', sans-serif",
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

    if (pagination.totalPages <= 1) return;

    for (let i = 1; i <= pagination.totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = `px-3 py-1 rounded glow-button`;
        if (i === pagination.page) {
            btn.style.cssText =
                "background: linear-gradient(45deg, #ff006e, #b967ff); color: white;";
        } else {
            btn.style.cssText =
                "background: rgba(21, 25, 50, 0.8); color: #00d9ff; border: 1px solid rgba(185, 103, 255, 0.3);";
        }
        btn.addEventListener("click", () => {
            currentPage[type] = i;
            if (type === "groups") loadGroups(i);
            else if (type === "users") loadUsers(i);
            else if (type === "logs") loadLogs(i);
        });
        container.appendChild(btn);
    }
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

function getLogLevelClass(level) {
    switch (level.toLowerCase()) {
        case "error":
            return (
                "border-l-4" +
                ' style="background: rgba(255, 0, 110, 0.1); border-color: #ff006e; color: #ff006e;"'
            );
        case "warn":
            return (
                "border-l-4" +
                ' style="background: rgba(255, 251, 0, 0.1); border-color: #fffb00; color: #fffb00;"'
            );
        case "info":
            return (
                "border-l-4" +
                ' style="background: rgba(0, 217, 255, 0.1); border-color: #00d9ff; color: #00d9ff;"'
            );
        default:
            return (
                "border-l-4" +
                ' style="background: rgba(185, 103, 255, 0.1); border-color: #b967ff; color: #b967ff;"'
            );
    }
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
            alert("Group settings updated successfully!");
            closeGroupModal();
            loadGroups();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert("Failed to update group settings");
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
