<script>
    import { onMount, onDestroy } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { fmtNumber } from "../../lib/format.js";

    let stats = $state(null);
    let loading = $state(true);

    // realtime system info
    let sys = $state(null);
    let pollTimer = null;

    const CARDS = [
        { key: "totalUsers", label: "Users", icon: "fa-user", color: "#34d399" },
        { key: "totalGroups", label: "Groups", icon: "fa-users-rectangle", color: "#a5b4fc" },
        { key: "totalParticipants", label: "Participants", icon: "fa-people-group", color: "#38bdf8" },
        { key: "premiumUsers", label: "Premium", icon: "fa-crown", color: "#fbbf24" },
        { key: "bannedUsers", label: "Banned", icon: "fa-ban", color: "#fca5a5" },
    ];

    onMount(async () => {
        try {
            stats = await apiJson("/api/stats/");
        } catch {
            /* ignore */
        } finally {
            loading = false;
        }
        await pollSystem();
        pollTimer = setInterval(pollSystem, 1000);
    });
    onDestroy(() => clearInterval(pollTimer));

    async function pollSystem() {
        try {
            sys = await apiJson("/api/stats/system");
        } catch {
            /* transient */
        }
    }
</script>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else}
    <!-- stat cards -->
    <div class="grid gap-3 mb-5" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
        {#each CARDS as c (c.key)}
            <div class="card p-4">
                <div class="flex items-center justify-between">
                    <div class="text-[.74rem] uppercase tracking-wide text-muted font-bold">{c.label}</div>
                    <i class="fas {c.icon}" style="color:{c.color}"></i>
                </div>
                <div class="text-[1.7rem] font-extrabold mt-1">{fmtNumber(stats?.[c.key] ?? 0)}</div>
            </div>
        {/each}
    </div>

    <!-- system info -->
    <div class="card p-5 mb-5">
        <div class="flex items-center justify-between mb-4">
            <div class="font-bold"><i class="fas fa-gauge-high text-accent"></i> System <span class="live">● live</span></div>
        </div>

        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">
            <!-- RAM Usage -->
            <div class="metric">
                <div class="m-top">
                    <span class="m-label"><i class="fas fa-memory" style="color:#34d399"></i> RAM Usage</span>
                    <b>{sys?.os?.memPct ?? 0}%</b>
                </div>
                <div class="m-value">{sys?.os?.usedMem ?? "—"}</div>
                <div class="bar"><div class="fill" style="width:{sys?.os?.memPct ?? 0}%;background:#34d399"></div></div>
                <div class="m-foot">of {sys?.os?.totalMem ?? "—"}</div>
            </div>

            <!-- Total Memory -->
            <div class="metric">
                <div class="m-top"><span class="m-label"><i class="fas fa-server" style="color:#a5b4fc"></i> Total Memory</span></div>
                <div class="m-value">{sys?.os?.totalMem ?? "—"}</div>
                <div class="m-foot">{sys?.os?.freeMem ?? "—"} free</div>
            </div>

            <!-- Total Storage -->
            <div class="metric">
                <div class="m-top">
                    <span class="m-label"><i class="fas fa-hard-drive" style="color:#fbbf24"></i> Total Storage</span>
                    {#if sys?.disk}<b>{sys.disk.pct}%</b>{/if}
                </div>
                <div class="m-value">{sys?.disk?.total ?? "—"}</div>
                {#if sys?.disk}<div class="bar"><div class="fill" style="width:{sys.disk.pct}%;background:#fbbf24"></div></div>{/if}
                <div class="m-foot">{sys?.disk ? `${sys.disk.used} used` : "unavailable"}</div>
            </div>

            <!-- Runtime -->
            <div class="metric">
                <div class="m-top"><span class="m-label"><i class="fas fa-clock" style="color:#38bdf8"></i> Runtime</span></div>
                <div class="m-value">{sys?.uptime ?? "—"}</div>
                <div class="m-foot">{sys?.platform ?? "—"} · Node {sys?.nodeVersion ?? "—"}</div>
            </div>
        </div>
    </div>
{/if}

<style>
    .live {
        font-size: 0.66rem;
        color: var(--color-accent);
        font-weight: 700;
        margin-left: 6px;
        animation: pulse 1.5s ease infinite;
    }
    @keyframes pulse {
        50% {
            opacity: 0.35;
        }
    }
    .metric {
        background: #0a1326;
        border: 1px solid var(--color-edge);
        border-radius: 13px;
        padding: 16px;
    }
    .m-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.82rem;
        margin-bottom: 8px;
        min-height: 20px;
    }
    .m-label {
        color: var(--color-muted);
        display: inline-flex;
        gap: 6px;
        align-items: center;
        font-weight: 600;
    }
    .m-top b {
        font-size: 0.95rem;
        font-weight: 800;
    }
    .m-value {
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.01em;
    }
    .bar {
        height: 7px;
        border-radius: 999px;
        background: #060c18;
        overflow: hidden;
        border: 1px solid var(--color-edge);
        margin: 9px 0 6px;
    }
    .bar .fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.5s ease;
    }
    .m-foot {
        font-size: 0.73rem;
        color: var(--color-subtle);
    }
</style>
