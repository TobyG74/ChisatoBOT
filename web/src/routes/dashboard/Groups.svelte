<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { toast, popup } from "../../lib/ui.js";
    import Modal from "../../components/Modal.svelte";
    import Toggle from "../../components/Toggle.svelte";

    let { me } = $props();
    const isOwner = $derived(me?.role === "owner");

    let groups = $state([]);
    let page = $state(1);
    let totalPages = $state(1);
    let search = $state("");
    let loading = $state(true);
    let syncing = $state(false);

    let editOpen = $state(false);
    let editing = $state(null);
    let editSettings = $state({});

    let joinOpen = $state(false);
    let joinLink = $state("");

    let searchTimer = null;

    onMount(() => load());

    async function load() {
        loading = true;
        try {
            const d = await apiJson(`/api/groups/?page=${page}&limit=10&search=${encodeURIComponent(search)}`);
            groups = d.groups || [];
            totalPages = d.pagination?.totalPages || 1;
        } catch (e) {
            toast(e.message, "err");
        } finally {
            loading = false;
        }
    }
    function onSearch() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            page = 1;
            load();
        }, 350);
    }
    function changePage(p) {
        if (p < 1 || p > totalPages) return;
        page = p;
        load();
    }

    function openEdit(g) {
        editing = g;
        const s = g.settings || {};
        editSettings = {
            antilinkStatus: !!s.antilink?.status,
            antibot: !!s.antibot,
            antidelete: !!s.antidelete,
            welcome: !!s.welcome,
            leave: !!s.leave,
            notify: !!s.notify,
            mute: !!s.mute,
        };
        editOpen = true;
    }
    async function saveSettings() {
        try {
            await apiJson(`/api/groups/${encodeURIComponent(editing.groupId)}/settings`, {
                method: "PUT",
                body: JSON.stringify(editSettings),
            });
            editOpen = false;
            popup("Saved", "Group settings updated.", "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function del(g) {
        if (!confirm(`Delete "${g.subject}"? The bot will leave the group.`)) return;
        try {
            await apiJson(`/api/groups/${encodeURIComponent(g.groupId)}`, { method: "DELETE" });
            toast("Group removed", "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function sync() {
        syncing = true;
        try {
            const d = await apiJson("/api/groups/sync", { method: "POST" });
            popup("Sync Complete", `Updated ${d.stats?.updated ?? 0}, removed ${d.stats?.removed ?? 0}.`, "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        } finally {
            syncing = false;
        }
    }
    async function join() {
        try {
            const d = await apiJson("/api/groups/join", { method: "POST", body: JSON.stringify({ inviteLink: joinLink }) });
            joinOpen = false;
            joinLink = "";
            popup("Joined", `Joined ${d.group?.subject || "group"}.`, "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }

    const SETTING_FIELDS = [
        ["antilinkStatus", "Anti-Link"],
        ["antibot", "Anti-Bot"],
        ["antidelete", "Anti-Delete"],
        ["welcome", "Welcome"],
        ["leave", "Leave"],
        ["notify", "Notify"],
        ["mute", "Mute"],
    ];
</script>

<div class="flex items-center gap-2 mb-4 flex-wrap">
    <div class="card flex items-center gap-2 px-3 flex-1 min-w-[200px]">
        <i class="fas fa-search text-muted"></i>
        <input class="field !border-0 !bg-transparent" placeholder="Search groups…" bind:value={search} oninput={onSearch} />
    </div>
    {#if isOwner}
        <button class="btn btn-sm" disabled={syncing} onclick={sync}>{#if syncing}<i class="fas fa-spinner spin"></i>{:else}<i class="fas fa-rotate"></i>{/if} Sync</button>
        <button class="btn btn-primary btn-sm" onclick={() => (joinOpen = true)}><i class="fas fa-plus"></i> Join group</button>
    {/if}
</div>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else if !groups.length}
    <div class="card p-6 text-center text-muted">No groups found.</div>
{:else}
    <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
        {#each groups as g (g.groupId)}
            <div class="card p-4">
                <div class="flex items-start justify-between gap-2">
                    <div class="font-bold truncate flex-1">{g.subject}</div>
                    {#if g.botIsAdmin}<span class="chip" style="background:rgba(16,185,129,.12);color:#34d399;border:1px solid rgba(16,185,129,.32)">Admin</span>{/if}
                </div>
                <div class="text-[.76rem] text-muted mt-2"><i class="fas fa-user-group"></i> {g.participantsCount ?? g.size} members</div>
                <div class="flex gap-2 mt-3">
                    <button class="btn btn-sm flex-1" onclick={() => openEdit(g)}><i class="fas fa-sliders"></i> Settings</button>
                    {#if isOwner}<button class="btn btn-sm btn-danger" onclick={() => del(g)}><i class="fas fa-trash"></i></button>{/if}
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

<Modal bind:open={editOpen} title={editing?.subject || "Group settings"} icon="fa-sliders">
    <div class="flex flex-col gap-2.5">
        {#each SETTING_FIELDS as [key, label] (key)}
            <label class="row-item"><span class="text-[.86rem]">{label}</span><Toggle bind:checked={editSettings[key]} /></label>
        {/each}
    </div>
    <button class="btn btn-primary w-full mt-4" onclick={saveSettings}><i class="fas fa-save"></i> Save</button>
</Modal>

<Modal bind:open={joinOpen} title="Join a group" icon="fa-plus">
    <label class="lbl">WhatsApp invite link</label>
    <input class="field mb-3" placeholder="https://chat.whatsapp.com/…" bind:value={joinLink} />
    <button class="btn btn-primary w-full" onclick={join}><i class="fab fa-whatsapp"></i> Join</button>
</Modal>
