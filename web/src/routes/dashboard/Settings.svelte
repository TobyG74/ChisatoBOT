<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { toast } from "../../lib/ui.js";
    import Toggle from "../../components/Toggle.svelte";

    let { me } = $props();
    const isOwner = $derived(me?.role === "owner");

    let config = $state(null);
    let loading = $state(true);
    let numbers = $state({ ownerNumber: [], teamNumber: [] });
    let newOwner = $state("");
    let newTeam = $state("");

    const TOGGLES = [
        ["ownerNotifyOnline", "Notify owner when online"],
        ["useLimit", "Enforce command limit"],
        ["useCooldown", "Enforce cooldown"],
        ["selfbot", "Selfbot mode (owner only responds)"],
        ["autoReadMessage", "Auto-read messages"],
        ["autoReadStatus", "Auto-read statuses"],
        ["autoCorrect", "Auto-correct commands"],
    ];

    onMount(load);
    async function load() {
        loading = true;
        try {
            const d = await apiJson("/api/config/");
            config = d.config;
            if (isOwner) {
                const n = await apiJson("/api/config/numbers");
                numbers = { ownerNumber: n.ownerNumber || [], teamNumber: n.teamNumber || [] };
            }
        } catch (e) {
            toast(e.message, "err");
        } finally {
            loading = false;
        }
    }

    async function saveToggle(key, value) {
        try {
            await apiJson("/api/config/settings", { method: "PATCH", body: JSON.stringify({ [key]: value }) });
            toast("Saved", "ok");
        } catch (e) {
            toast(e.message, "err");
            config.settings[key] = !value;
        }
    }
    async function saveGeneral() {
        try {
            await apiJson("/api/config/general", {
                method: "PATCH",
                body: JSON.stringify({
                    prefix: config.prefix,
                    timeZone: config.timeZone,
                    limit: { command: Number(config.limit?.command) || 0 },
                    stickers: config.stickers,
                }),
            });
            toast("General settings saved", "ok");
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function addNumber(kind, val) {
        const number = val.trim();
        if (!number) return;
        try {
            await apiJson(`/api/config/numbers/${kind}`, { method: "POST", body: JSON.stringify({ number }) });
            if (kind === "owner") newOwner = "";
            else newTeam = "";
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function removeNumber(kind, number) {
        try {
            await apiJson(`/api/config/numbers/${kind}/${encodeURIComponent(number)}`, { method: "DELETE" });
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
</script>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else if config}
    {#if !isOwner}
        <div class="card p-3 mb-4 text-[.82rem]" style="border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.06);color:#fcd34d">
            <i class="fas fa-eye"></i> Read-only view — only the owner can change settings.
        </div>
    {/if}

    <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
        <div class="card p-5">
            <div class="font-bold mb-4"><i class="fas fa-toggle-on text-accent"></i> Behavior</div>
            <div class="flex flex-col gap-2.5">
                {#each TOGGLES as [key, label] (key)}
                    <label class="row-item !py-2.5">
                        <span class="text-[.84rem]">{label}</span>
                        <Toggle bind:checked={config.settings[key]} disabled={!isOwner} onchange={(v) => saveToggle(key, v)} />
                    </label>
                {/each}
            </div>
        </div>

        <div class="card p-5">
            <div class="font-bold mb-4"><i class="fas fa-sliders text-accent"></i> General</div>
            <label class="lbl">Prefix</label>
            <input class="field mb-3" bind:value={config.prefix} disabled={!isOwner} />
            <label class="lbl">Time zone</label>
            <input class="field mb-3" bind:value={config.timeZone} disabled={!isOwner} />
            <label class="lbl">Daily limit</label>
            <input class="field mb-3" type="number" bind:value={config.limit.command} disabled={!isOwner} />
            {#if isOwner}<button class="btn btn-primary" onclick={saveGeneral}><i class="fas fa-save"></i> Save general</button>{/if}
        </div>

        {#if isOwner}
            <div class="card p-5">
                <div class="font-bold mb-4"><i class="fas fa-crown text-amber"></i> Owner Numbers</div>
                <div class="flex flex-col gap-2 mb-3">
                    {#each numbers.ownerNumber as n (n)}
                        <div class="row-item !py-2"><span class="text-[.84rem]">+{n}</span><button class="btn btn-sm btn-danger" onclick={() => removeNumber("owner", n)}><i class="fas fa-xmark"></i></button></div>
                    {/each}
                </div>
                <div class="flex gap-2">
                    <input class="field" placeholder="62812…" bind:value={newOwner} onkeydown={(e) => e.key === "Enter" && addNumber("owner", newOwner)} />
                    <button class="btn btn-primary btn-sm" onclick={() => addNumber("owner", newOwner)}><i class="fas fa-plus"></i></button>
                </div>
            </div>

            <div class="card p-5">
                <div class="font-bold mb-4"><i class="fas fa-user-shield text-indigo"></i> Team Numbers</div>
                <div class="flex flex-col gap-2 mb-3">
                    {#each numbers.teamNumber as n (n)}
                        <div class="row-item !py-2"><span class="text-[.84rem]">+{n}</span><button class="btn btn-sm btn-danger" onclick={() => removeNumber("team", n)}><i class="fas fa-xmark"></i></button></div>
                    {/each}
                </div>
                <div class="flex gap-2">
                    <input class="field" placeholder="62812…" bind:value={newTeam} onkeydown={(e) => e.key === "Enter" && addNumber("team", newTeam)} />
                    <button class="btn btn-primary btn-sm" onclick={() => addNumber("team", newTeam)}><i class="fas fa-plus"></i></button>
                </div>
            </div>
        {/if}
    </div>
{/if}
