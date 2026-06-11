<script>
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { navigate } from "../lib/router.svelte.js";
    import { token, profile, setSession, clearSession, logoutRequest } from "../lib/api.js";

    import Overview from "./dashboard/Overview.svelte";
    import Groups from "./dashboard/Groups.svelte";
    import Users from "./dashboard/Users.svelte";
    import Logs from "./dashboard/Logs.svelte";
    import Commands from "./dashboard/Commands.svelte";
    import SettingsView from "./dashboard/Settings.svelte";
    import Security from "./dashboard/Security.svelte";
    import WhatsNew from "../components/WhatsNew.svelte";

    let ready = $state(false);
    let me = $state(null);
    let view = $state("overview");
    let sidebarOpen = $state(false);

    const NAV = [
        { key: "overview", icon: "fa-gauge-high", label: "Overview" },
        { key: "groups", icon: "fa-users-rectangle", label: "Groups" },
        { key: "users", icon: "fa-user", label: "Users" },
        { key: "logs", icon: "fa-list", label: "Logs" },
        { key: "commands", icon: "fa-terminal", label: "Commands" },
        { key: "settings", icon: "fa-gear", label: "Settings" },
        { key: "security", icon: "fa-shield-halved", label: "Security", owner: true },
    ];
    let nav = $derived(NAV.filter((n) => !n.owner || me?.role === "owner"));

    onMount(async () => {
        const t = get(token);
        if (!t) {
            navigate("/login");
            return;
        }
        try {
            const r = await fetch("/api/auth/verify", { headers: { Authorization: "Bearer " + t } });
            const d = await r.json();
            if (!r.ok || !d.admin) throw new Error("invalid");
            if (d.admin.role === "groupadmin") {
                navigate("/group-admin");
                return;
            }
            setSession(t, d.admin);
            me = d.admin;
            ready = true;
        } catch {
            clearSession();
            navigate("/login");
        }
    });

    function go(v) {
        view = v;
        sidebarOpen = false;
    }
    async function doLogout() {
        await logoutRequest();
        navigate("/login");
    }
</script>

{#if ready}
    <div class="layout">
        <!-- sidebar -->
        <aside class="sidebar" class:open={sidebarOpen}>
            <div class="brand">
                <div class="brand-ic"><i class="fas fa-robot"></i></div>
                <div>
                    <div class="font-extrabold leading-tight">ChisatoBOT</div>
                    <div class="text-[.7rem] text-muted">Control Panel</div>
                </div>
            </div>
            <nav class="flex flex-col gap-1 px-3">
                {#each nav as n (n.key)}
                    <button class="navitem" class:active={view === n.key} onclick={() => go(n.key)}>
                        <i class="fas {n.icon} w-5 text-center"></i> {n.label}
                    </button>
                {/each}
            </nav>
            <div class="mt-auto p-3">
                <div class="card p-3 text-[.74rem] text-muted">
                    <div class="flex items-center gap-2">
                        <span class="dot"></span> +{me?.phoneNumber}
                    </div>
                    <div class="mt-1 uppercase tracking-wide font-bold text-[.66rem]" style="color:var(--color-accent)">{me?.role}</div>
                </div>
            </div>
        </aside>
        {#if sidebarOpen}<div class="backdrop" onclick={() => (sidebarOpen = false)}></div>{/if}

        <!-- main -->
        <div class="main">
            <header class="topbar">
                <button class="btn btn-sm sm:hidden" onclick={() => (sidebarOpen = !sidebarOpen)} aria-label="Menu"><i class="fas fa-bars"></i></button>
                <div class="font-bold text-[1.05rem] capitalize">{nav.find((n) => n.key === view)?.label || view}</div>
                <span class="flex-1"></span>
                <WhatsNew />
                <button class="btn btn-danger btn-sm" onclick={doLogout}><i class="fas fa-right-from-bracket"></i> <span class="hidden sm:inline">Logout</span></button>
            </header>

            <div class="content">
                {#if view === "overview"}<Overview {me} />
                {:else if view === "groups"}<Groups {me} />
                {:else if view === "users"}<Users {me} />
                {:else if view === "logs"}<Logs />
                {:else if view === "commands"}<Commands {me} />
                {:else if view === "settings"}<SettingsView {me} />
                {:else if view === "security"}<Security {me} />
                {/if}
            </div>
        </div>
    </div>
{:else}
    <div class="h-screen flex items-center justify-center text-muted"><i class="fas fa-spinner spin text-2xl"></i></div>
{/if}

<style>
    .layout {
        display: flex;
        min-height: 100vh;
    }
    .sidebar {
        width: 248px;
        flex: none;
        border-right: 1px solid var(--color-edge);
        background: linear-gradient(180deg, var(--color-panel), var(--color-bg));
        display: flex;
        flex-direction: column;
        padding-top: 18px;
        position: sticky;
        top: 0;
        height: 100vh;
    }
    .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 18px 18px;
    }
    .brand-ic {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--color-accent2), var(--color-accent));
        color: #04130c;
        font-size: 1.1rem;
    }
    .navitem {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 13px;
        border-radius: 11px;
        font-weight: 600;
        font-size: 0.86rem;
        color: var(--color-muted);
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: 0.15s;
    }
    .navitem:hover {
        background: #0e1830;
        color: #fff;
    }
    .navitem.active {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(16, 185, 129, 0.05));
        color: var(--color-accent);
    }
    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #22c55e;
        display: inline-block;
    }
    .main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }
    .topbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 22px;
        border-bottom: 1px solid var(--color-edge);
        position: sticky;
        top: 0;
        background: rgba(7, 11, 22, 0.8);
        backdrop-filter: blur(10px);
        z-index: 20;
    }
    .content {
        padding: 22px;
        max-width: 1200px;
        width: 100%;
    }
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 25;
    }
    @media (max-width: 640px) {
        .sidebar {
            position: fixed;
            z-index: 30;
            transform: translateX(-100%);
            transition: 0.2s;
        }
        .sidebar.open {
            transform: translateX(0);
        }
    }
</style>
