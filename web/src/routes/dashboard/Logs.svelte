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

    const LEVEL = {
        info: ["#38bdf8", "fa-circle-info"],
        error: ["#fca5a5", "fa-circle-exclamation"],
        warn: ["#fbbf24", "fa-triangle-exclamation"],
        status: ["#a5b4fc", "fa-signal"],
        chat: ["#94a3b8", "fa-comment"],
        connect: ["#34d399", "fa-plug"],
    };

    onMount(() => load());
    async function load() {
        loading = true;
        try {
            const d = await apiJson(`/api/logs/?page=${page}&limit=50${level ? "&level=" + level : ""}`);
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
    <select class="field" style="width:140px" bind:value={level} onchange={() => { page = 1; load(); }}>
        <option value="">All levels</option>
        {#each Object.keys(LEVEL) as lv}<option value={lv}>{lv}</option>{/each}
    </select>
    <span class="flex-1"></span>
    <button class="btn btn-danger btn-sm" onclick={clearLogs}><i class="fas fa-trash"></i> Clear</button>
</div>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else if !logs.length}
    <div class="card p-6 text-center text-muted">No logs.</div>
{:else}
    <div class="card divide-y" style="--tw-divide-opacity:1">
        {#each logs as l (l.id)}
            {@const m = LEVEL[l.level] || ["#94a3b8", "fa-circle"]}
            <div class="flex items-start gap-3 px-4 py-2.5" style="border-bottom:1px solid var(--color-edge)">
                <i class="fas {m[1]} mt-0.5" style="color:{m[0]}"></i>
                <div class="min-w-0 flex-1">
                    <div class="text-[.83rem] break-words">{l.message}</div>
                    <div class="text-[.68rem] text-subtle">{fmtDateTime(l.timestamp)}</div>
                </div>
            </div>
        {/each}
    </div>
    {#if totalPages > 1}
        <div class="flex items-center justify-center gap-2 mt-5">
            <button class="btn btn-sm" disabled={page <= 1} onclick={() => changePage(page - 1)}><i class="fas fa-chevron-left"></i></button>
            <span class="text-[.8rem] text-muted">Page {page} / {totalPages}</span>
            <button class="btn btn-sm" disabled={page >= totalPages} onclick={() => changePage(page + 1)}><i class="fas fa-chevron-right"></i></button>
        </div>
    {/if}
{/if}
