<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { timeAgo } from "../../lib/format.js";

    let { groupId } = $props();
    let logs = $state([]);
    let page = $state(1);
    let totalPages = $state(1);
    let loading = $state(true);
    let error = $state(null);

    const META = {
        login: ["fa-right-to-bracket", "#a5b4fc"],
        rename: ["fa-pen", "#34d399"],
        desc: ["fa-align-left", "#34d399"],
        kick: ["fa-user-minus", "#fca5a5"],
        promote: ["fa-arrow-up", "#fcd34d"],
        demote: ["fa-arrow-down", "#fcd34d"],
        setting: ["fa-gear", "#94a3b8"],
        "wa-setting": ["fa-lock", "#94a3b8"],
        "profile-picture": ["fa-camera", "#34d399"],
        "revoke-link": ["fa-link-slash", "#fca5a5"],
        "welcome-config": ["fa-image", "#34d399"],
        "leave-config": ["fa-image", "#fcd34d"],
    };

    onMount(() => load(1));
    async function load(p) {
        loading = p === 1;
        error = null;
        try {
            const d = await apiJson("/api/group-admin/groups/" + encodeURIComponent(groupId) + "/logs?page=" + p + "&limit=30");
            logs = p === 1 ? d.logs : [...logs, ...d.logs];
            page = d.pagination.page;
            totalPages = d.pagination.totalPages;
        } catch (e) {
            error = e.message;
        } finally {
            loading = false;
        }
    }
</script>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else if error}
    <div class="text-[#fca5a5] text-sm">{error}</div>
{:else if !logs.length}
    <div class="card p-6 text-center text-muted"><i class="fas fa-scroll text-2xl mb-2"></i><div>No activity yet.</div></div>
{:else}
    <div class="flex flex-col gap-2">
        {#each logs as l, i (i)}
            {@const m = META[l.action] || ["fa-circle-info", "#94a3b8"]}
            {@const detail = l.target ? "+" + l.target : l.detail || ""}
            <div class="row-item">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="ic" style="color:{m[1]}"><i class="fas {m[0]}"></i></div>
                    <div class="min-w-0">
                        <div class="text-[.85rem]"><b class="capitalize">{l.action.replace(/-/g, " ")}</b> {detail ? "· " + detail : ""}</div>
                        <div class="text-[.72rem] text-muted">by +{l.actorPn}</div>
                    </div>
                </div>
                <div class="text-[.72rem] text-subtle whitespace-nowrap">{timeAgo(l.createdAt)}</div>
            </div>
        {/each}
    </div>
    {#if page < totalPages}
        <div class="text-center mt-4"><button class="btn btn-sm" onclick={() => load(page + 1)}>Load more</button></div>
    {/if}
{/if}

<style>
    .ic {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: #0a1326;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
    }
</style>
