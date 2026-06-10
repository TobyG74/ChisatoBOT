<script>
    import { apiJson } from "../../lib/api.js";
    import { toast } from "../../lib/ui.js";
    import Toggle from "../../components/Toggle.svelte";

    let { groupId, settings } = $props();
    const base = () => "/api/group-admin/groups/" + encodeURIComponent(groupId);

    const DEFS = [
        { key: "antilinkStatus", name: "Anti-Link", desc: "Detect & act on links from members", get: (s) => !!s?.antilink?.status },
        { key: "antibot", name: "Anti-Bot", desc: "Block other bots in the group", get: (s) => !!s?.antibot },
        { key: "antidelete", name: "Anti-Delete", desc: "Recover deleted messages", get: (s) => !!s?.antidelete },
        { key: "welcome", name: "Welcome Message", desc: "Greet new members", get: (s) => !!s?.welcome },
        { key: "leave", name: "Leave Message", desc: "Notify when members leave", get: (s) => !!s?.leave },
        { key: "notify", name: "Admin Notify", desc: "Notify admins of group events", get: (s) => !!s?.notify },
        { key: "mute", name: "Mute Bot", desc: "Bot ignores commands here", get: (s) => !!s?.mute },
    ];

    let state = $state(Object.fromEntries(DEFS.map((d) => [d.key, d.get(settings)])));
    let mode = $state(settings?.antilink?.mode || "kick");

    async function save(key, value) {
        try {
            const d = await apiJson(base() + "/settings", { method: "PUT", body: JSON.stringify({ [key]: value }) });
            settings = d.settings;
            toast("Saved", "ok");
        } catch (e) {
            toast(e.message, "err");
            if (typeof value === "boolean") state[key] = !value;
        }
    }
</script>

<div class="card p-5">
    <div class="font-bold mb-4"><i class="fas fa-shield-halved text-accent"></i> Bot Features</div>
    <div class="flex flex-col gap-2.5">
        {#each DEFS as d (d.key)}
            <label class="row-item">
                <div>
                    <div class="font-semibold text-[.88rem]">{d.name}</div>
                    <div class="text-[.74rem] text-muted">{d.desc}</div>
                </div>
                <Toggle bind:checked={state[d.key]} onchange={(v) => save(d.key, v)} />
            </label>
        {/each}
        <div class="row-item">
            <div>
                <div class="font-semibold text-[.88rem]">Anti-Link Action</div>
                <div class="text-[.74rem] text-muted">What happens when a link is detected</div>
            </div>
            <select class="field" style="width:140px" bind:value={mode} onchange={() => save("antilinkMode", mode)}>
                <option value="kick">Kick</option>
                <option value="delete">Delete</option>
            </select>
        </div>
    </div>
</div>
