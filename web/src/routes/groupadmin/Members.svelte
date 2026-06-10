<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { toast } from "../../lib/ui.js";

    let { groupId } = $props();
    let all = $state([]);
    let q = $state("");
    let loading = $state(true);
    let error = $state(null);

    const base = () => "/api/group-admin/groups/" + encodeURIComponent(groupId);

    let filtered = $derived(
        all.filter((p) => {
            const t = q.toLowerCase();
            return !t || (p.phoneNumber || "").includes(t) || (p.jid || "").toLowerCase().includes(t);
        })
    );

    onMount(load);
    async function load() {
        loading = true;
        error = null;
        try {
            const d = await apiJson(base() + "/participants");
            all = d.participants || [];
        } catch (e) {
            error = e.message;
        } finally {
            loading = false;
        }
    }

    async function act(action, target) {
        if (action === "kick" && !confirm("Kick +" + target + " from the group?")) return;
        try {
            await apiJson(base() + "/members/" + action, { method: "POST", body: JSON.stringify({ target }) });
            toast("Member " + (action === "kick" ? "kicked" : action + "d"), "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
</script>

<div class="card p-4 mb-3 flex items-center gap-3">
    <i class="fas fa-search text-muted"></i>
    <input class="field !py-2 !border-0 !bg-transparent" placeholder="Search members…" bind:value={q} />
    <span class="text-[.76rem] text-muted whitespace-nowrap">{filtered.length} / {all.length}</span>
</div>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else if error}
    <div class="text-[#fca5a5] text-sm">{error}</div>
{:else if !filtered.length}
    <div class="text-muted text-sm p-3">No members match.</div>
{:else}
    <div class="flex flex-col gap-2">
        {#each filtered as p (p.jid)}
            {@const num = p.phoneNumber || p.jid.split("@")[0]}
            {@const isSuper = p.admin === "superadmin"}
            {@const isAdmin = p.admin === "admin" || isSuper}
            <div class="row-item">
                <div class="min-w-0">
                    <div class="font-semibold text-[.88rem]">+{num}</div>
                    <div class="text-[.7rem] text-subtle truncate">{p.jid}</div>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap justify-end">
                    {#if isSuper}<span class="chip owner">Owner</span>{:else if isAdmin}<span class="chip admin">Admin</span>{/if}
                    {#if p.isBot}
                        <span class="chip botok">Bot</span>
                        <span class="text-[.72rem] text-subtle">protected</span>
                    {:else if isSuper}
                        <span class="text-[.72rem] text-subtle">protected</span>
                    {:else}
                        {#if isAdmin}
                            <button class="btn btn-sm" onclick={() => act("demote", num)}><i class="fas fa-arrow-down"></i> Demote</button>
                        {:else}
                            <button class="btn btn-sm" onclick={() => act("promote", num)}><i class="fas fa-arrow-up"></i> Promote</button>
                        {/if}
                        <button class="btn btn-sm btn-danger" onclick={() => act("kick", num)}><i class="fas fa-user-minus"></i> Kick</button>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .chip.admin {
        background: rgba(251, 191, 36, 0.12);
        border: 1px solid rgba(251, 191, 36, 0.3);
        color: var(--color-amber);
    }
    .chip.owner {
        background: rgba(99, 102, 241, 0.12);
        border: 1px solid rgba(99, 102, 241, 0.35);
        color: #a5b4fc;
    }
    .chip.botok {
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.32);
        color: var(--color-accent);
    }
</style>
