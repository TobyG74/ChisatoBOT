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
    let total = $state(0);
    let search = $state("");
    let communityType = $state("");
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
            const d = await apiJson(
                `/api/groups/?page=${page}&limit=12&search=${encodeURIComponent(search)}${communityType ? "&communityType=" + communityType : ""}`
            );
            groups = d.groups || [];
            totalPages = d.pagination?.totalPages || 1;
            total = d.pagination?.total ?? groups.length;
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
    function applyFilter() {
        page = 1;
        load();
    }
    function changePage(p) {
        if (p < 1 || p > totalPages) return;
        page = p;
        load();
    }

    function groupType(g) {
        if (g.isCommunity) return { label: "Community", cls: "t-community" };
        if (g.isCommunityAnnounce) return { label: "Announcement", cls: "t-announce" };
        return { label: "Group", cls: "t-group" };
    }
    const FEATURES = [
        ["antilink", "fa-link", "Anti-Link"],
        ["antibot", "fa-robot", "Anti-Bot"],
        ["antidelete", "fa-trash-can-arrow-up", "Anti-Delete"],
        ["welcome", "fa-hand-wave", "Welcome"],
        ["leave", "fa-door-open", "Leave"],
        ["mute", "fa-volume-xmark", "Mute"],
    ];
    function featureOn(g, key) {
        const s = g.settings || {};
        return key === "antilink" ? !!s.antilink?.status : !!s[key];
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
            await apiJson(`/api/groups/${encodeURIComponent(editing.groupId)}/settings`, { method: "PUT", body: JSON.stringify(editSettings) });
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
    <select class="field" style="width:160px" bind:value={communityType} onchange={applyFilter}>
        <option value="">All types</option>
        <option value="regular">Group</option>
        <option value="communityAnnounce">Announcement</option>
        <option value="community">Community</option>
    </select>
    {#if isOwner}
        <button class="btn btn-sm" disabled={syncing} onclick={sync}>{#if syncing}<i class="fas fa-spinner spin"></i>{:else}<i class="fas fa-rotate"></i>{/if} Sync</button>
        <button class="btn btn-primary btn-sm" onclick={() => (joinOpen = true)}><i class="fas fa-plus"></i> Join</button>
    {/if}
</div>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else if !groups.length}
    <div class="card p-6 text-center text-muted">No groups found.</div>
{:else}
    <div class="card overflow-hidden">
        <div class="tbl-scroll">
            <table class="tbl">
                <thead>
                    <tr>
                        <th>Group</th>
                        <th class="num">Members</th>
                        <th>Type</th>
                        <th>Bot</th>
                        <th>Features</th>
                        <th class="right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each groups as g (g.groupId)}
                        {@const t = groupType(g)}
                        <tr>
                            <td><div class="font-semibold truncate max-w-[260px]">{g.subject}</div></td>
                            <td class="num">{g.participantsCount ?? g.size}</td>
                            <td><span class="chip {t.cls}">{t.label}</span></td>
                            <td>
                                {#if g.botIsAdmin}<span class="chip t-bot">Admin</span>{:else}<span class="text-subtle text-[.74rem]">member</span>{/if}
                            </td>
                            <td>
                                <div class="flex gap-1.5 flex-wrap">
                                    {#each FEATURES as [key, icon, label] (key)}
                                        {#if featureOn(g, key)}<i class="fas {icon} feat" title={label}></i>{/if}
                                    {/each}
                                </div>
                            </td>
                            <td class="right">
                                <button class="btn btn-sm" onclick={() => openEdit(g)} title="Settings"><i class="fas fa-sliders"></i></button>
                                {#if isOwner}<button class="btn btn-sm btn-danger" onclick={() => del(g)} title="Delete"><i class="fas fa-trash"></i></button>{/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <div class="flex items-center justify-between mt-4 text-[.8rem] text-muted">
        <span>{total} groups</span>
        {#if totalPages > 1}
            <div class="flex items-center gap-2">
                <button class="btn btn-sm" disabled={page <= 1} onclick={() => changePage(page - 1)} aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
                <span>Page {page} / {totalPages}</span>
                <button class="btn btn-sm" disabled={page >= totalPages} onclick={() => changePage(page + 1)} aria-label="Next"><i class="fas fa-chevron-right"></i></button>
            </div>
        {/if}
    </div>
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

<style>
    .feat {
        color: var(--color-accent);
        font-size: 0.82rem;
    }
    .t-community {
        background: rgba(139, 92, 246, 0.12);
        color: #c4b5fd;
        border: 1px solid rgba(139, 92, 246, 0.32);
    }
    .t-announce {
        background: rgba(56, 189, 248, 0.12);
        color: #7dd3fc;
        border: 1px solid rgba(56, 189, 248, 0.32);
    }
    .t-group {
        background: rgba(148, 163, 184, 0.12);
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.28);
    }
    .t-bot {
        background: rgba(16, 185, 129, 0.12);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.32);
    }
</style>
