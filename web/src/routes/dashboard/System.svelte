<script>
    import { onMount, onDestroy } from "svelte";
    import { apiJson } from "../../lib/api.js";

    let sys = $state(null);
    let error = $state(null);
    let timer = null;

    async function poll() {
        try {
            sys = await apiJson("/api/stats/system");
            error = null;
        } catch (e) {
            error = e.message;
        }
    }
    onMount(() => {
        poll();
        timer = setInterval(poll, 2000);
    });
    onDestroy(() => clearInterval(timer));
</script>

{#if error}
    <div class="card p-5 text-[#fca5a5]">{error}</div>
{:else if !sys}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else}
    <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
        <div class="card p-5">
            <div class="font-bold mb-3"><i class="fas fa-memory text-accent"></i> System Memory</div>
            <div class="bar"><div class="fill" style="width:{sys.os.memPct}%"></div></div>
            <div class="flex justify-between text-[.78rem] text-muted mt-2"><span>{sys.os.usedMem} used</span><span>{sys.os.memPct}%</span></div>
            <div class="text-[.72rem] text-subtle mt-1">of {sys.os.totalMem}</div>
        </div>
        <div class="card p-5">
            <div class="font-bold mb-3"><i class="fas fa-microchip text-accent"></i> Process</div>
            <div class="flex flex-col gap-1.5 text-[.82rem]">
                <div class="flex justify-between"><span class="text-muted">Heap used</span><b>{sys.memory.heapUsed}</b></div>
                <div class="flex justify-between"><span class="text-muted">RSS</span><b>{sys.memory.rss}</b></div>
                <div class="flex justify-between"><span class="text-muted">PID</span><b>{sys.pid}</b></div>
            </div>
        </div>
        <div class="card p-5">
            <div class="font-bold mb-3"><i class="fas fa-server text-accent"></i> Runtime</div>
            <div class="flex flex-col gap-1.5 text-[.82rem]">
                <div class="flex justify-between"><span class="text-muted">Uptime</span><b>{sys.uptime}</b></div>
                <div class="flex justify-between"><span class="text-muted">Platform</span><b>{sys.platform}</b></div>
                <div class="flex justify-between"><span class="text-muted">Node</span><b>{sys.nodeVersion}</b></div>
            </div>
        </div>
    </div>
{/if}

<style>
    .bar {
        height: 12px;
        border-radius: 999px;
        background: #0a1326;
        overflow: hidden;
        border: 1px solid var(--color-edge);
    }
    .fill {
        height: 100%;
        background: linear-gradient(90deg, var(--color-accent2), var(--color-accent));
        transition: width 0.4s;
    }
</style>
