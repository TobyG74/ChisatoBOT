<script>
    import { onMount } from "svelte";
    import { apiJson } from "../../lib/api.js";
    import { fmtNumber } from "../../lib/format.js";

    let stats = $state(null);
    let changelog = $state([]);
    let loading = $state(true);

    const CARDS = [
        { key: "totalUsers", label: "Users", icon: "fa-user", color: "#34d399" },
        { key: "totalGroups", label: "Groups", icon: "fa-users-rectangle", color: "#a5b4fc" },
        { key: "totalParticipants", label: "Participants", icon: "fa-people-group", color: "#38bdf8" },
        { key: "premiumUsers", label: "Premium", icon: "fa-crown", color: "#fbbf24" },
        { key: "bannedUsers", label: "Banned", icon: "fa-ban", color: "#fca5a5" },
        { key: "activeGroups", label: "Active Groups", icon: "fa-bolt", color: "#34d399" },
    ];

    onMount(async () => {
        try {
            const [s, c] = await Promise.all([
                apiJson("/api/stats/"),
                fetch("/api/changelog").then((r) => r.json()).catch(() => ({ changelog: [] })),
            ]);
            stats = s;
            changelog = c.changelog || [];
        } catch {
            /* ignore */
        } finally {
            loading = false;
        }
    });

    const typeColor = (t) =>
        ({ feat: "#34d399", fix: "#fca5a5", refactor: "#a5b4fc", note: "#94a3b8" })[t] || "#94a3b8";
</script>

{#if loading}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{:else}
    <div class="grid gap-3 mb-5" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">
        {#each CARDS as c (c.key)}
            <div class="card p-4">
                <div class="flex items-center justify-between">
                    <div class="text-[.74rem] uppercase tracking-wide text-muted font-bold">{c.label}</div>
                    <i class="fas {c.icon}" style="color:{c.color}"></i>
                </div>
                <div class="text-[1.7rem] font-extrabold mt-1">{fmtNumber(stats?.[c.key] ?? 0)}</div>
            </div>
        {/each}
    </div>

    <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
        <div class="card p-5">
            <div class="font-bold mb-3"><i class="fas fa-clock text-accent"></i> Uptime</div>
            <div class="text-[1.4rem] font-extrabold">{stats?.uptime || "—"}</div>
            <div class="text-[.74rem] text-muted mt-1">Since last (re)connect</div>
        </div>
        <div class="card p-5">
            <div class="font-bold mb-3"><i class="fas fa-scroll text-accent"></i> What's New</div>
            {#if !changelog.length}
                <div class="text-muted text-sm">No changelog.</div>
            {:else}
                <div class="flex flex-col gap-3 max-h-[320px] overflow-auto pr-1">
                    {#each changelog.slice(0, 4) as sec (sec.date)}
                        <div>
                            <div class="text-[.74rem] font-bold text-subtle mb-1">{sec.date}</div>
                            <ul class="flex flex-col gap-1">
                                {#each sec.entries as e (e.message)}
                                    <li class="text-[.8rem] flex gap-2">
                                        <span class="chip" style="background:{typeColor(e.type)}1f;color:{typeColor(e.type)};border:1px solid {typeColor(e.type)}55">{e.type}</span>
                                        <span class="text-muted">{e.message}</span>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}
