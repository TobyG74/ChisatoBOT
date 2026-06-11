<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { toast } from "../../lib/ui.js";
    import { fmtDateTime } from "../../lib/format.js";

    let logs = $state([]);
    let page = $state(1);
    let totalPages = $state(1);
    let level = $state("");
    let loading = $state(true);

    // Each level: [color, icon, label]
    const LEVEL = {
        connect: ["#34d399", "fa-plug", "CONNECT"],
        info: ["#38bdf8", "fa-circle-info", "INFO"],
        status: ["#a5b4fc", "fa-signal", "STATUS"],
        warn: ["#fbbf24", "fa-triangle-exclamation", "WARN"],
        error: ["#fca5a5", "fa-circle-exclamation", "ERROR"],
        chat: ["#94a3b8", "fa-comment", "CHAT"],
    };
    function meta(lv) {
        return LEVEL[lv] || ["#94a3b8", "fa-circle", (lv || "log").toUpperCase()];
    }

    onMount(() => load());
    async function load() {
        loading = true;
        try {
            const d = await apiJson(`/api/logs/?page=${page}&limit=60${level ? "&level=" + level : ""}`);
            logs = d.logs || [];
            totalPages = d.pagination?.totalPages || 1;
        } catch (e) {
            toast(e.message, "err");
        } finally {
            loading = false;
        }
    }
    function changePage(p) {
        if (p < 1 || p > totalPages) return;
        page = p;
        load();
    }
    async function clearLogs() {
        if (!confirm("Clear all logs?")) return;
        try {
            await apiJson("/api/logs/", { method: "DELETE" });
            toast("Logs cleared", "ok");
            page = 1;
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
</script>

<div class="flex items-center gap-2 mb-4 flex-wrap">
    <div class="flex gap-1.5 flex-wrap">
        <button class="lvbtn" class:on={level === ""} onclick={() => { level = ""; page = 1; load(); }}>All</button>
        {#each Object.entries(LEVEL) as [lv, m] (lv)}
            <button class="lvbtn" class:on={level === lv} style="--c:{m[0]}" onclick={() => { level = lv; page = 1; load(); }}>
                <i class="fas {m[1]}"></i> {m[2]}
            </button>
        {/each}
    </div>
    <span class="flex-1"></span>
    <button class="btn btn-danger btn-sm" onclick={clearLogs}><i class="fas fa-trash"></i> Clear</button>
</div>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else if !logs.length}
    <div class="card p-6 text-center text-muted">No logs.</div>
{:else}
    <div class="flex flex-col gap-1.5">
        {#each logs as l (l.id)}
            {@const m = meta(l.level)}
            <div class="logrow" style="--c:{m[0]}">
                <span class="badge"><i class="fas {m[1]}"></i> {m[2]}</span>
                <div class="min-w-0 flex-1">
                    <div class="msg">{l.message}</div>
                    <div class="ts">{fmtDateTime(l.timestamp)}</div>
                </div>
            </div>
        {/each}
    </div>
    {#if totalPages > 1}
        <div class="flex items-center justify-center gap-2 mt-5">
            <button class="btn btn-sm" disabled={page <= 1} onclick={() => changePage(page - 1)} aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
            <span class="text-[.8rem] text-muted">Page {page} / {totalPages}</span>
            <button class="btn btn-sm" disabled={page >= totalPages} onclick={() => changePage(page + 1)} aria-label="Next"><i class="fas fa-chevron-right"></i></button>
        </div>
    {/if}
{/if}

<style>
    .lvbtn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid var(--color-edge);
        background: #0e1830;
        color: var(--color-muted);
        cursor: pointer;
        transition: 0.15s;
    }
    .lvbtn.on {
        border-color: var(--c, var(--color-accent));
        color: var(--c, #fff);
        background: color-mix(in srgb, var(--c, #34d399) 12%, transparent);
    }
    .lvbtn:hover {
        color: #fff;
    }
    .logrow {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 11px;
        background: color-mix(in srgb, var(--c) 7%, #0b1424);
        border: 1px solid var(--color-edge);
        border-left: 3px solid var(--c);
    }
    .badge {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        padding: 3px 8px;
        border-radius: 7px;
        color: var(--c);
        background: color-mix(in srgb, var(--c) 16%, transparent);
        border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
        min-width: 84px;
        justify-content: center;
        margin-top: 1px;
    }
    .msg {
        font-size: 0.83rem;
        word-break: break-word;
        line-height: 1.45;
    }
    .ts {
        font-size: 0.68rem;
        color: var(--color-subtle);
        margin-top: 2px;
    }
</style>
