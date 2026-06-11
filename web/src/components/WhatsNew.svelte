<script>
    import Modal from "./Modal.svelte";

    let open = $state(false);
    let changelog = $state([]);
    let loading = $state(false);
    let loaded = false;

    const typeColor = (t) => ({ feat: "#34d399", fix: "#fca5a5", refactor: "#a5b4fc", chore: "#38bdf8", docs: "#a5b4fc", note: "#94a3b8" })[t] || "#94a3b8";

    async function show() {
        open = true;
        if (loaded) return;
        loading = true;
        try {
            const d = await fetch("/api/changelog").then((r) => r.json());
            changelog = d.changelog || [];
            loaded = true;
        } catch {
            /* ignore */
        } finally {
            loading = false;
        }
    }
</script>

<button class="btn btn-sm" onclick={show} title="What's New">
    <i class="fas fa-scroll"></i> <span class="hidden sm:inline">What's New</span>
</button>

<Modal bind:open title="What's New" icon="fa-scroll">
    {#if loading}
        <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
    {:else if !changelog.length}
        <div class="text-muted text-sm">No changelog available.</div>
    {:else}
        <div class="flex flex-col gap-4 max-h-[60vh] overflow-auto pr-1">
            {#each changelog as sec (sec.date)}
                <div>
                    <div class="text-[.76rem] font-bold text-subtle mb-2 sticky top-0">{sec.date}</div>
                    <ul class="flex flex-col gap-1.5">
                        {#each sec.entries as e (e.message)}
                            <li class="text-[.82rem] flex gap-2 items-start">
                                <span class="chip" style="background:{typeColor(e.type)}1f;color:{typeColor(e.type)};border:1px solid {typeColor(e.type)}55">{e.type}</span>
                                <span class="text-muted leading-snug">{e.message}</span>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>
    {/if}
</Modal>
