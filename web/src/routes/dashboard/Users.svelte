<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { toast, popup } from "../../lib/ui.js";
    import { readableNumber } from "../../lib/format.js";
    import Modal from "../../components/Modal.svelte";

    let { me } = $props();
    const isOwner = $derived(me?.role === "owner");

    let users = $state([]);
    let page = $state(1);
    let totalPages = $state(1);
    let total = $state(0);
    let search = $state("");
    let role = $state("");
    let banned = $state("");
    let loading = $state(true);
    let searchTimer = null;

    let open = $state(false);
    let creating = $state(false);
    let form = $state({ userId: "", name: "", role: "free", limit: 20, expired: "" });

    onMount(() => load());
    async function load() {
        loading = true;
        try {
            const qs = `page=${page}&limit=12&search=${encodeURIComponent(search)}${role ? "&role=" + role : ""}${banned ? "&banned=" + banned : ""}`;
            const d = await apiJson("/api/users/?" + qs);
            users = d.users || [];
            totalPages = d.pagination?.totalPages || 1;
            total = d.pagination?.total ?? users.length;
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

    function openCreate() {
        creating = true;
        form = { userId: "", name: "", role: "free", limit: 20, expired: "" };
        open = true;
    }
    function openEdit(u) {
        creating = false;
        form = {
            userId: u.userId,
            name: u.name || "",
            role: u.role,
            limit: u.limit,
            expired: u.expired ? new Date(u.expired).toISOString().slice(0, 10) : "",
        };
        open = true;
    }
    async function save() {
        const body = {
            name: form.name,
            role: form.role,
            limit: Number(form.limit) || 0,
            expired: form.expired ? new Date(form.expired).getTime() : 0,
        };
        try {
            if (creating) {
                if (!form.userId.trim()) return toast("User ID (number) is required", "err");
                await apiJson("/api/users/", { method: "POST", body: JSON.stringify({ userId: form.userId.trim(), ...body }) });
            } else {
                await apiJson(`/api/users/${encodeURIComponent(form.userId)}`, { method: "PUT", body: JSON.stringify(body) });
            }
            open = false;
            popup("Saved", `User ${creating ? "created" : "updated"}.`, "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function del(u) {
        if (!confirm(`Delete user ${readableNumber(u.userId)}?`)) return;
        try {
            await apiJson(`/api/users/${encodeURIComponent(u.userId)}`, { method: "DELETE" });
            toast("User deleted", "ok");
            load();
        } catch (e) {
            toast(e.message, "err");
        }
    }
</script>

<div class="flex items-center gap-2 mb-4 flex-wrap">
    <div class="card flex items-center gap-2 px-3 flex-1 min-w-[200px]">
        <i class="fas fa-search text-muted"></i>
        <input class="field !border-0 !bg-transparent" placeholder="Search users…" bind:value={search} oninput={onSearch} />
    </div>
    <select class="field" style="width:130px" bind:value={role} onchange={applyFilter}>
        <option value="">All roles</option>
        <option value="free">Free</option>
        <option value="premium">Premium</option>
    </select>
    <select class="field" style="width:130px" bind:value={banned} onchange={applyFilter}>
        <option value="">All status</option>
        <option value="active">Active</option>
        <option value="banned">Banned</option>
    </select>
    {#if isOwner}<button class="btn btn-primary btn-sm" onclick={openCreate}><i class="fas fa-user-plus"></i> Add</button>{/if}
</div>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else if !users.length}
    <div class="card p-6 text-center text-muted">No users found.</div>
{:else}
    <div class="card overflow-hidden">
        <div class="tbl-scroll">
            <table class="tbl">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Number</th>
                        <th>Role</th>
                        <th class="num">Limit</th>
                        <th>Status</th>
                        <th class="right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each users as u (u.userId)}
                        <tr>
                            <td><div class="font-semibold truncate max-w-[200px]">{u.name || "—"}</div></td>
                            <td class="text-muted">+{readableNumber(u.userId)}</td>
                            <td>
                                {#if u.role === "premium"}<span class="chip s-prem">Premium</span>{:else}<span class="chip s-free">Free</span>{/if}
                            </td>
                            <td class="num">{u.limit}</td>
                            <td>
                                {#if u.isBanned}<span class="chip s-ban">Banned</span>{:else}<span class="text-subtle text-[.74rem]">active</span>{/if}
                            </td>
                            <td class="right">
                                <button class="btn btn-sm" onclick={() => openEdit(u)} title="Edit"><i class="fas fa-pen"></i></button>
                                {#if isOwner}<button class="btn btn-sm btn-danger" onclick={() => del(u)} title="Delete"><i class="fas fa-trash"></i></button>{/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <div class="flex items-center justify-between mt-4 text-[.8rem] text-muted">
        <span>{total} users</span>
        {#if totalPages > 1}
            <div class="flex items-center gap-2">
                <button class="btn btn-sm" disabled={page <= 1} onclick={() => changePage(page - 1)} aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
                <span>Page {page} / {totalPages}</span>
                <button class="btn btn-sm" disabled={page >= totalPages} onclick={() => changePage(page + 1)} aria-label="Next"><i class="fas fa-chevron-right"></i></button>
            </div>
        {/if}
    </div>
{/if}

<Modal bind:open title={creating ? "Add user" : "Edit user"} icon="fa-user">
    {#if creating}
        <label class="lbl">User number (e.g. 62812…)</label>
        <input class="field mb-3" bind:value={form.userId} placeholder="62812xxxxxxx" />
    {/if}
    <label class="lbl">Name</label>
    <input class="field mb-3" bind:value={form.name} />
    <div class="grid grid-cols-2 gap-3">
        <div>
            <label class="lbl">Role</label>
            <select class="field" bind:value={form.role}><option value="free">Free</option><option value="premium">Premium</option></select>
        </div>
        <div>
            <label class="lbl">Limit</label>
            <input class="field" type="number" bind:value={form.limit} />
        </div>
    </div>
    {#if form.role === "premium"}
        <label class="lbl mt-3">Premium expires (blank = never)</label>
        <input class="field" type="date" bind:value={form.expired} />
    {/if}
    <button class="btn btn-primary w-full mt-4" onclick={save}><i class="fas fa-save"></i> {creating ? "Create" : "Save"}</button>
</Modal>

<style>
    .s-prem {
        background: rgba(251, 191, 36, 0.12);
        color: #fbbf24;
        border: 1px solid rgba(251, 191, 36, 0.3);
    }
    .s-free {
        background: rgba(148, 163, 184, 0.12);
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.28);
    }
    .s-ban {
        background: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.3);
    }
</style>
