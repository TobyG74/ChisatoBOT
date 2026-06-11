<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { toast } from "../../lib/ui.js";

    let lists = $state({ whitelist: [], blacklist: [] });
    let loading = $state(true);
    let add = $state({ whitelist: { ip: "", role: "unknown" }, blacklist: { ip: "", role: "unknown" } });

    const ROLE_BADGE = {
        owner: ["#fbbf24", "Owner"],
        team: ["#a5b4fc", "Team"],
        unknown: ["#94a3b8", "Unknown"],
    };

    onMount(load);
    async function load() {
        loading = true;
        try {
            applyLists(await apiJson("/api/config/ip"));
        } catch (e) {
            toast(e.message, "err");
        } finally {
            loading = false;
        }
    }
    function norm(arr) {
        return (arr || []).map((e) => (typeof e === "string" ? { ip: e, role: "unknown" } : { ip: e.ip, role: e.role || "unknown" }));
    }
    // The API returns ipWhitelist/ipBlacklist (falls back to whitelist/blacklist
    // for safety).
    function applyLists(d) {
        lists = {
            whitelist: norm(d.ipWhitelist ?? d.whitelist),
            blacklist: norm(d.ipBlacklist ?? d.blacklist),
        };
    }
    async function addIp(kind) {
        const { ip, role } = add[kind];
        if (!ip.trim()) return;
        try {
            applyLists(await apiJson(`/api/config/ip/${kind}`, { method: "POST", body: JSON.stringify({ ip: ip.trim(), role }) }));
            add[kind] = { ip: "", role: "unknown" };
            toast("Added", "ok");
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function removeIp(kind, ip) {
        try {
            applyLists(await apiJson(`/api/config/ip/${kind}/${encodeURIComponent(ip)}`, { method: "DELETE" }));
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function cycleRole(kind, entry) {
        const order = ["unknown", "owner", "team"];
        const next = order[(order.indexOf(entry.role) + 1) % order.length];
        try {
            applyLists(await apiJson(`/api/config/ip/${kind}/${encodeURIComponent(entry.ip)}`, { method: "PUT", body: JSON.stringify({ ip: entry.ip, role: next }) }));
        } catch (e) {
            toast(e.message, "err");
        }
    }
</script>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else}
    <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
        {#each [["whitelist", "fa-circle-check", "#34d399", "Whitelist"], ["blacklist", "fa-ban", "#fca5a5", "Blacklist"]] as [kind, icon, color, label] (kind)}
            <div class="card p-5">
                <div class="font-bold mb-4"><i class="fas {icon}" style="color:{color}"></i> IP {label} <span class="text-muted text-[.78rem]">({lists[kind].length})</span></div>
                <div class="flex flex-col gap-2 mb-3 max-h-[340px] overflow-auto">
                    {#each lists[kind] as e (e.ip)}
                        {@const rb = ROLE_BADGE[e.role] || ROLE_BADGE.unknown}
                        <div class="row-item !py-2">
                            <span class="font-mono text-[.82rem]">{e.ip}</span>
                            <div class="flex items-center gap-1.5">
                                <button class="chip" style="background:{rb[0]}1f;color:{rb[0]};border:1px solid {rb[0]}55;cursor:pointer" onclick={() => cycleRole(kind, e)} title="Click to change role">{rb[1]}</button>
                                <button class="btn btn-sm btn-danger" onclick={() => removeIp(kind, e.ip)}><i class="fas fa-xmark"></i></button>
                            </div>
                        </div>
                    {:else}
                        <div class="text-muted text-sm">No entries.</div>
                    {/each}
                </div>
                <div class="flex gap-2">
                    <input class="field" placeholder="IP address" bind:value={add[kind].ip} onkeydown={(ev) => ev.key === "Enter" && addIp(kind)} />
                    <select class="field" style="width:110px" bind:value={add[kind].role}><option value="unknown">Any</option><option value="owner">Owner</option><option value="team">Team</option></select>
                    <button class="btn btn-primary btn-sm" onclick={() => addIp(kind)}><i class="fas fa-plus"></i></button>
                </div>
            </div>
        {/each}
    </div>
{/if}
