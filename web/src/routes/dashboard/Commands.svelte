<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { toast, popup } from "../../lib/ui.js";
    import Modal from "../../components/Modal.svelte";
    import Toggle from "../../components/Toggle.svelte";

    let { me } = $props();
    const isOwner = $derived(me?.role === "owner");

    let commands = $state([]);
    let maintenance = $state([]); // command names currently under maintenance
    let q = $state("");
    let category = $state("");
    let loading = $state(true);

    let open = $state(false);
    let editing = $state(null);
    let ov = $state({});

    const FLAGS = [
        ["isOwner", "Owner", "f-owner"],
        ["isTeam", "Team", "f-team"],
        ["isPremium", "Premium", "f-prem"],
        ["isPrivate", "Private", "f-dim"],
        ["isGroup", "Group", "f-dim"],
        ["isGroupAdmin", "Admin", "f-dim"],
        ["isGroupOwner", "G.Owner", "f-dim"],
        ["isBotAdmin", "BotAdmin", "f-dim"],
    ];

    let categories = $derived([...new Set(commands.map((c) => c.category).filter(Boolean))].sort());
    let filtered = $derived(
        commands.filter((c) => {
            const t = q.toLowerCase();
            const matchesQ = !t || c.name.includes(t) || (c.description || "").toLowerCase().includes(t);
            const matchesCat = !category || c.category === category;
            return matchesQ && matchesCat;
        })
    );

    onMount(load);
    async function load() {
        loading = true;
        try {
            const [c, m] = await Promise.all([
                apiJson("/api/config/commands"),
                apiJson("/api/config/maintenance").catch(() => ({ maintenance: [] })),
            ]);
            commands = c.commands || [];
            maintenance = m.maintenance || [];
        } catch (e) {
            toast(e.message, "err");
        } finally {
            loading = false;
        }
    }

    function inMaintenance(name) {
        return maintenance.includes(name);
    }
    async function toggleMaintenance(c, on) {
        try {
            if (on) {
                const d = await apiJson("/api/config/maintenance", { method: "POST", body: JSON.stringify({ command: c.name }) });
                maintenance = d.maintenance || [...maintenance, c.name];
                toast(`${c.name} set to maintenance`, "ok");
            } else {
                const d = await apiJson(`/api/config/maintenance/${encodeURIComponent(c.name)}`, { method: "DELETE" });
                maintenance = d.maintenance || maintenance.filter((x) => x !== c.name);
                toast(`${c.name} back online`, "ok");
            }
        } catch (e) {
            toast(e.message, "err");
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

<div class="flex items-center gap-2 mb-4 flex-wrap">
    <div class="card flex items-center gap-2 px-3 flex-1 min-w-[200px]">
        <i class="fas fa-search text-muted"></i>
        <input class="field !border-0 !bg-transparent" placeholder="Search commands…" bind:value={q} />
    </div>
    <select class="field" style="width:170px" bind:value={category}>
        <option value="">All categories</option>
        {#each categories as c (c)}<option value={c}>{c}</option>{/each}
    </select>
    <span class="text-[.76rem] text-muted whitespace-nowrap">{filtered.length} cmds</span>
</div>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else}
    <div class="card overflow-hidden">
        <div class="tbl-scroll">
            <table class="tbl">
                <thead>
                    <tr>
                        <th>Command</th>
                        <th>Category</th>
                        <th>Access</th>
                        <th class="num">Cooldown</th>
                        <th class="num">Limit</th>
                        <th>Status</th>
                        {#if isOwner}<th class="right">Override</th>{/if}
                    </tr>
                </thead>
                <tbody>
                    {#each filtered as c (c.name)}
                        <tr>
                            <td>
                                <div class="font-semibold">{c.name}</div>
                                {#if c.description}<div class="text-[.72rem] text-subtle truncate max-w-[280px]">{c.description}</div>{/if}
                            </td>
                            <td class="text-muted">{c.category || "—"}</td>
                            <td>
                                <div class="flex gap-1 flex-wrap">
                                    {#each FLAGS as [key, label, cls] (key)}
                                        {#if eff(c, key)}<span class="fchip {cls}">{label}</span>{/if}
                                    {/each}
                                    {#if !FLAGS.some(([k]) => eff(c, k))}<span class="text-subtle text-[.74rem]">everyone</span>{/if}
                                </div>
                            </td>
                            <td class="num">{eff(c, "cooldown") ?? "—"}</td>
                            <td class="num">{eff(c, "limit") ?? "—"}</td>
                            <td>
                                {#if isOwner}
                                    <div class="flex items-center gap-2">
                                        <Toggle checked={inMaintenance(c.name)} onchange={(v) => toggleMaintenance(c, v)} />
                                        {#if inMaintenance(c.name)}<span class="chip m-on">Maint</span>{/if}
                                    </div>
                                {:else if inMaintenance(c.name)}
                                    <span class="chip m-on">Maintenance</span>
                                {:else}
                                    <span class="text-subtle text-[.74rem]">online</span>
                                {/if}
                            </td>
                            {#if isOwner}
                                <td class="right">
                                    <button class="btn btn-sm" onclick={() => openEdit(c)} title="Edit override">
                                        <i class="fas {c.override ? 'fa-pen-to-square text-amber' : 'fa-pen'}"></i>
                                    </button>
                                </td>
                            {/if}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
{/if}

<Modal bind:open title={editing?.name} icon="fa-terminal">
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
</Modal>

<style>
    .fchip {
        font-size: 0.62rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }
    .f-owner {
        background: rgba(251, 191, 36, 0.12);
        color: #fbbf24;
        border: 1px solid rgba(251, 191, 36, 0.3);
    }
    .f-team {
        background: rgba(99, 102, 241, 0.12);
        color: #a5b4fc;
        border: 1px solid rgba(99, 102, 241, 0.32);
    }
    .f-prem {
        background: rgba(245, 158, 11, 0.12);
        color: #fcd34d;
        border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .f-dim {
        background: rgba(148, 163, 184, 0.1);
        color: #94a3b8;
        border: 1px solid rgba(148, 163, 184, 0.25);
    }
    .m-on {
        background: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.3);
    }
</style>
