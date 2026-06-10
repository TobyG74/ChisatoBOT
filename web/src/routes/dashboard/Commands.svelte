<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { toast, popup } from "../../lib/ui.js";
    import Modal from "../../components/Modal.svelte";
    import Toggle from "../../components/Toggle.svelte";

    let { me } = $props();
    const isOwner = $derived(me?.role === "owner");

    let commands = $state([]);
    let q = $state("");
    let loading = $state(true);

    let open = $state(false);
    let editing = $state(null);
    let ov = $state({});

    const FLAGS = [
        ["isOwner", "Owner only"],
        ["isTeam", "Team only"],
        ["isPremium", "Premium only"],
        ["isPrivate", "Private chat only"],
        ["isGroup", "Group only"],
        ["isGroupAdmin", "Group admin"],
        ["isGroupOwner", "Group owner"],
        ["isBotAdmin", "Bot must be admin"],
    ];

    let filtered = $derived(
        commands.filter((c) => {
            const t = q.toLowerCase();
            return !t || c.name.includes(t) || (c.category || "").includes(t);
        })
    );

    onMount(load);
    async function load() {
        loading = true;
        try {
            const d = await apiJson("/api/config/commands");
            commands = d.commands || [];
        } catch (e) {
            toast(e.message, "err");
        } finally {
            loading = false;
        }
    }

    function eff(c, key) {
        return c.override && key in c.override ? c.override[key] : c[key];
    }
    function openEdit(c) {
        if (!isOwner) return;
        editing = c;
        ov = {};
        for (const [k] of FLAGS) ov[k] = !!eff(c, k);
        ov.cooldown = eff(c, "cooldown") ?? "";
        ov.limit = eff(c, "limit") ?? "";
        open = true;
    }
    async function save() {
        const body = {};
        for (const [k] of FLAGS) body[k] = !!ov[k];
        body.cooldown = ov.cooldown === "" ? null : Number(ov.cooldown);
        body.limit = ov.limit === "" ? null : Number(ov.limit);
        try {
            await apiJson(`/api/config/commands/${encodeURIComponent(editing.name)}`, { method: "PATCH", body: JSON.stringify(body) });
            open = false;
            popup("Override Saved", `Updated ${editing.name}.`, "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function reset() {
        try {
            await apiJson(`/api/config/commands/${encodeURIComponent(editing.name)}/override`, { method: "DELETE" });
            open = false;
            toast("Override cleared", "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
</script>

<div class="card flex items-center gap-2 px-3 mb-4">
    <i class="fas fa-search text-muted"></i>
    <input class="field !border-0 !bg-transparent" placeholder="Search commands…" bind:value={q} />
    <span class="text-[.76rem] text-muted whitespace-nowrap">{filtered.length}</span>
</div>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else}
    <div class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
        {#each filtered as c (c.name)}
            <button class="card p-3 text-left commandcard" onclick={() => openEdit(c)} class:cursor-default={!isOwner}>
                <div class="flex items-center justify-between gap-2">
                    <div class="font-bold text-[.86rem] truncate">{c.name}</div>
                    {#if c.override}<i class="fas fa-pen-to-square text-amber text-[.7rem]" title="Has override"></i>{/if}
                </div>
                <div class="text-[.7rem] text-subtle">{c.category}</div>
                {#if c.description}<div class="text-[.74rem] text-muted mt-1 line-clamp-2">{c.description}</div>{/if}
            </button>
        {/each}
    </div>
{/if}

<Modal bind:open title={editing?.name} icon="fa-terminal">
    {#if !isOwner}
        <div class="text-muted text-sm">Read-only — owner can edit overrides.</div>
    {:else}
        <div class="flex flex-col gap-2">
            {#each FLAGS as [key, label] (key)}
                <label class="row-item !py-2.5"><span class="text-[.84rem]">{label}</span><Toggle bind:checked={ov[key]} /></label>
            {/each}
        </div>
        <div class="grid grid-cols-2 gap-3 mt-3">
            <div><label class="lbl">Cooldown (s)</label><input class="field" type="number" placeholder="default" bind:value={ov.cooldown} /></div>
            <div><label class="lbl">Limit cost</label><input class="field" type="number" placeholder="default" bind:value={ov.limit} /></div>
        </div>
        <div class="flex gap-2 mt-4">
            <button class="btn btn-primary flex-1" onclick={save}><i class="fas fa-save"></i> Save override</button>
            <button class="btn btn-danger" onclick={reset}><i class="fas fa-rotate-left"></i> Reset</button>
        </div>
    {/if}
</Modal>

<style>
    .commandcard {
        cursor: pointer;
        transition: 0.15s;
    }
    .commandcard:hover {
        border-color: var(--color-accent);
    }
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
