<script>
    import { onMount, onDestroy } from "svelte";
    import { get } from "svelte/store";
    import { token, profile, setSession, clearSession, apiJson, logoutRequest } from "../lib/api.js";
    import GaOverview from "./groupadmin/Overview.svelte";
    import GaMembers from "./groupadmin/Members.svelte";
    import GaSettings from "./groupadmin/Settings.svelte";
    import GaBuilder from "./groupadmin/Builder.svelte";
    import GaLogs from "./groupadmin/Logs.svelte";
    import WhatsNew from "../components/WhatsNew.svelte";

    let authed = $state(false);
    let view = $state("login"); // login | groups | panel
    let me = $state(null);

    let phone = $state("");
    let loginStep = $state("phone"); // phone | code
    let loginMsg = $state(null);
    let busy = $state(false);
    let otpCode = $state("");
    let waLink = $state("#");
    let shownPhone = $state("");
    let expiry = $state("5:00");
    let requestId = null;
    let pollTimer = null;
    let expiryTimer = null;

    let groups = $state([]);
    let groupsLoading = $state(false);
    let groupsError = $state(null);

    let current = $state(null); // { group, access }
    let tab = $state("overview");

    // Join-group (invite the bot into a group you admin) modal state.
    let joinOpen = $state(false);
    let joinLink = $state("");
    let joinBusy = $state(false);
    let joinMsg = $state(null); // { type: "ok" | "err", text }

    onMount(async () => {
        const t = get(token);
        const p = get(profile);
        if (t && p?.role === "groupadmin") {
            // Validate the session still works before showing the dashboard.
            try {
                await apiJson("/api/group-admin/my-groups");
                me = p;
                authed = true;
                view = "groups";
                loadGroups();
                return;
            } catch {
                clearSession();
            }
        }
    });
    onDestroy(stopOtp);

    function stopOtp() {
        clearInterval(pollTimer);
        clearInterval(expiryTimer);
        pollTimer = expiryTimer = null;
    }
    function showMsg(type, text) {
        loginMsg = { type, text };
    }

    async function requestOtp() {
        const p = phone.trim();
        if (!p) return showMsg("err", "Please enter your WhatsApp number.");
        busy = true;
        loginMsg = null;
        try {
            const r = await fetch("/api/group-auth/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: p }),
            });
            const d = await r.json();
            if (!r.ok) return showMsg("err", d.message || "Failed to generate code.");
            requestId = d.requestId;
            otpCode = d.code;
            waLink = d.waLink || "#";
            shownPhone = p.replace(/^0/, "62");
            loginStep = "code";
            startExpiry(d.expiresInMs || 300000);
            startPolling();
        } catch {
            showMsg("err", "Network error. Try again.");
        } finally {
            busy = false;
        }
    }

    function startExpiry(ms) {
        let s = Math.ceil(ms / 1000);
        clearInterval(expiryTimer);
        const tick = () => {
            if (s <= 0) {
                clearInterval(expiryTimer);
                expiry = "expired";
                stopOtp();
                showMsg("err", "Code expired. Generate a new one.");
                return;
            }
            expiry = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
            s--;
        };
        tick();
        expiryTimer = setInterval(tick, 1000);
    }
    function startPolling() {
        clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
            if (!requestId) return;
            try {
                const r = await fetch("/api/group-auth/otp-status/" + requestId);
                const d = await r.json();
                if (d.status === "verified" && d.token) {
                    stopOtp();
                    setSession(d.token, d.admin);
                    me = d.admin;
                    authed = true;
                    view = "groups";
                    loadGroups();
                } else if (d.status === "expired") {
                    stopOtp();
                    showMsg("err", "Code expired. Generate a new one.");
                }
            } catch {
                /* keep polling */
            }
        }, 2500);
    }
    function backToPhone() {
        stopOtp();
        loginStep = "phone";
        loginMsg = null;
    }
    function copyCode() {
        navigator.clipboard?.writeText(otpCode);
    }

    async function loadGroups() {
        groupsLoading = true;
        groupsError = null;
        try {
            const d = await apiJson("/api/group-admin/my-groups");
            groups = d.groups || [];
        } catch (e) {
            groupsError = e.message;
        } finally {
            groupsLoading = false;
        }
    }

    async function openGroup(groupId) {
        try {
            const d = await apiJson("/api/group-admin/groups/" + encodeURIComponent(groupId));
            current = { group: d.group, access: d.access, groupId };
            tab = "overview";
            view = "panel";
        } catch (e) {
            groupsError = e.message;
        }
    }
    function backToGroups() {
        current = null;
        view = "groups";
        loadGroups();
    }

    function openJoin() {
        joinLink = "";
        joinMsg = null;
        joinOpen = true;
    }
    function closeJoin() {
        if (joinBusy) return;
        joinOpen = false;
    }
    async function submitJoin() {
        const link = joinLink.trim();
        if (!link) {
            joinMsg = { type: "err", text: "Paste a WhatsApp group invite link." };
            return;
        }
        joinBusy = true;
        joinMsg = null;
        try {
            const d = await apiJson("/api/group-admin/join-group", {
                method: "POST",
                body: JSON.stringify({ inviteLink: link }),
            });
            joinMsg = {
                type: "ok",
                text: d.alreadyMember
                    ? `Bot is already in "${d.subject}".`
                    : `Joined "${d.subject}". Opening your groups…`,
            };
            await loadGroups();
            setTimeout(() => {
                joinOpen = false;
            }, 1200);
        } catch (e) {
            joinMsg = { type: "err", text: e.message };
        } finally {
            joinBusy = false;
        }
    }

    async function doLogout() {
        await logoutRequest();
        authed = false;
        view = "login";
        loginStep = "phone";
    }
</script>

{#if !authed}
    <!-- ════════ LOGIN (reverse OTP) ════════ -->
    <div class="shell">
        <div class="bgglow"></div>
        <div class="card w-full max-w-[440px] p-9 relative z-10">
            <div class="flex flex-col items-center mb-6">
                <div class="logo"><i class="fas fa-users-gear"></i></div>
                <h1 class="title">Group Admin Login</h1>
                <p class="text-[.86rem] text-muted mt-1">Manage groups where you're an admin</p>
            </div>
            <div class="divider"></div>

            {#if loginStep === "phone"}
                <label class="lbl" for="gaph"><i class="fas fa-mobile-screen-button text-accent"></i> WhatsApp Number</label>
                <input id="gaph" class="field" type="tel" placeholder="e.g. 62812xxxxxxx" bind:value={phone} onkeydown={(e) => e.key === "Enter" && requestOtp()} />
                <button class="btn btn-primary w-full mt-4" disabled={busy} onclick={requestOtp}>
                    {#if busy}<i class="fas fa-spinner spin"></i> Generating…{:else}<i class="fas fa-key"></i> Generate OTP Code{/if}
                </button>
                <ul class="hints">
                    <li><i class="fas fa-shield-halved"></i><span>Only admins of a group the bot is in can sign in.</span></li>
                    <li><i class="fas fa-paper-plane"></i><span>You prove it's you by sending the code to the bot.</span></li>
                </ul>
            {:else}
                <div class="text-[.84rem] text-muted mb-2.5">Send this code <b class="text-ink">from your own WhatsApp</b> (+{shownPhone}) to the bot:</div>
                <div class="codebox">
                    <span class="codenum">{otpCode}</span>
                    <button class="btn btn-sm" onclick={copyCode}><i class="fas fa-copy"></i></button>
                </div>
                <a class="btn btn-primary w-full" href={waLink} target="_blank" rel="noreferrer"><i class="fab fa-whatsapp"></i> Open WhatsApp &amp; send code</a>
                <div class="flex items-center justify-center gap-2 mt-4 text-[.84rem] text-muted"><i class="fas fa-spinner spin"></i> Waiting for your message to the bot…</div>
                <div class="text-[.72rem] text-subtle text-center mt-2">Validates sender &amp; code. Expires in {expiry}.</div>
                <div class="flex items-center justify-between mt-4">
                    <button class="btn btn-sm" onclick={backToPhone}><i class="fas fa-arrow-left"></i> Change number</button>
                    <button class="btn btn-sm" onclick={requestOtp}>New code</button>
                </div>
            {/if}

            {#if loginMsg}
                <div class="alert {loginMsg.type}"><i class="fas {loginMsg.type === 'err' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i><span>{loginMsg.text}</span></div>
            {/if}

            <div class="foot">
                <span><span class="dot"></span> Server Online</span>
                <a href="/login" class="link"><i class="fas fa-crown"></i> Owner / Team</a>
            </div>
        </div>
    </div>
{:else}
    <!-- ════════ DASHBOARD ════════ -->
    <div class="max-w-[1180px] mx-auto p-4 sm:p-6">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div class="flex items-center gap-3">
                <div class="hd-ic"><i class="fas fa-users-gear"></i></div>
                <div>
                    <div class="font-extrabold leading-tight">Group Admin</div>
                    <div class="text-[.76rem] text-muted">+{me?.phoneNumber} · {me?.groupCount ?? groups.length} group(s)</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <WhatsNew />
                <button class="btn btn-danger btn-sm" onclick={doLogout}><i class="fas fa-right-from-bracket"></i> Logout</button>
            </div>
        </div>

        {#if view === "groups"}
            <div class="flex items-center justify-between gap-3 mb-3">
                <div class="text-[.78rem] uppercase tracking-wider text-muted font-bold">Your Groups</div>
                <button class="btn btn-primary btn-sm" onclick={openJoin}><i class="fab fa-whatsapp"></i> Join Group</button>
            </div>
            {#if groupsLoading}
                <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
            {:else if groupsError}
                <div class="card p-5 text-[#fca5a5]">{groupsError}</div>
            {:else if !groups.length}
                <div class="card p-6 text-center text-muted"><i class="fas fa-users-slash text-2xl mb-2"></i><div>You are not an admin of any group the bot is in.</div></div>
            {:else}
                <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">
                    {#each groups as g (g.groupId)}
                        <button class="card gcard p-4 text-left" onclick={() => openGroup(g.groupId)}>
                            <div class="flex items-start justify-between gap-2">
                                <div class="font-bold truncate flex-1">{g.subject}</div>
                                <span class="chip" class:owner={g.isSuperAdmin} class:admin={!g.isSuperAdmin}>{g.isSuperAdmin ? "Owner" : "Admin"}</span>
                            </div>
                            <div class="text-[.76rem] text-muted mt-2"><i class="fas fa-user-group"></i> {g.size} members</div>
                            <div class="text-[.72rem] mt-1" class:ok={g.botIsAdmin} class:warn={!g.botIsAdmin}>
                                <i class="fas {g.botIsAdmin ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> Bot {g.botIsAdmin ? "is admin" : "not admin"}
                            </div>
                        </button>
                    {/each}
                </div>
            {/if}
        {:else if view === "panel" && current}
            <button class="btn btn-sm mb-4" onclick={backToGroups}><i class="fas fa-arrow-left"></i> All groups</button>

            <div class="card p-4 mb-4 flex items-center gap-3 flex-wrap">
                <div class="hd-ic"><i class="fas fa-users"></i></div>
                <div class="min-w-0 flex-1">
                    <div class="font-bold truncate">{current.group?.subject || "—"}</div>
                    <div class="text-[.76rem] text-muted">{current.group?.size || 0} members</div>
                </div>
                <div class="flex gap-2">
                    <span class="chip" class:owner={current.access?.isSuperAdmin} class:admin={!current.access?.isSuperAdmin}>{current.access?.isSuperAdmin ? "Group Owner" : "Admin"}</span>
                    {#if current.access?.botIsAdmin}<span class="chip botok">Bot Admin</span>{:else}<span class="chip warnchip">Bot not admin</span>{/if}
                </div>
            </div>

            {#if !current.access?.botIsAdmin}
                <div class="card mb-4 p-3 text-[.82rem]" style="border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.06);color:#fcd34d">
                    <i class="fas fa-triangle-exclamation"></i> The bot is not an admin here. Some actions (rename, kick…) will fail until it's promoted.
                </div>
            {/if}

            <div class="flex gap-2 overflow-x-auto pb-2 mb-4">
                {#each [["overview", "fa-sliders", "Overview"], ["members", "fa-user-group", "Members"], ["settings", "fa-gear", "Settings"], ["builder", "fa-image", "Welcome / Leave"], ["logs", "fa-scroll", "Logs"]] as [key, icon, label]}
                    <button class="tab" class:active={tab === key} onclick={() => (tab = key)}><i class="fas {icon}"></i> {label}</button>
                {/each}
            </div>

            {#if tab === "overview"}
                <GaOverview groupId={current.groupId} group={current.group} access={current.access} />
            {:else if tab === "members"}
                <GaMembers groupId={current.groupId} />
            {:else if tab === "settings"}
                <GaSettings groupId={current.groupId} settings={current.group?.settings} />
            {:else if tab === "builder"}
                <GaBuilder groupId={current.groupId} />
            {:else if tab === "logs"}
                <GaLogs groupId={current.groupId} />
            {/if}
        {/if}
    </div>

    {#if joinOpen}
        <!-- ════════ JOIN GROUP MODAL ════════ -->
        <div class="modal-backdrop" onclick={closeJoin} onkeydown={(e) => e.key === "Escape" && closeJoin()} role="presentation">
            <div
                class="modal-panel card p-6"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                tabindex="-1"
            >
                <div class="flex items-center gap-3 mb-3">
                    <div class="hd-ic"><i class="fab fa-whatsapp"></i></div>
                    <div>
                        <div class="font-extrabold leading-tight">Invite the bot to a group</div>
                        <div class="text-[.76rem] text-muted">Paste a WhatsApp invite link of a group you admin</div>
                    </div>
                </div>
                <div class="divider"></div>

                <label class="lbl" for="joinlink"><i class="fas fa-link text-accent"></i> Invite link</label>
                <input
                    id="joinlink"
                    class="field"
                    type="text"
                    placeholder="https://chat.whatsapp.com/xxxxxxxxxxxxxxxxxxxx"
                    bind:value={joinLink}
                    disabled={joinBusy}
                    onkeydown={(e) => e.key === "Enter" && submitJoin()}
                />

                <ul class="hints">
                    <li><i class="fas fa-shield-halved"></i><span>You must be an admin of that group — we verify it before the bot joins.</span></li>
                    <li><i class="fas fa-user-plus"></i><span>The bot accepts the invite and appears in the group right away.</span></li>
                </ul>

                {#if joinMsg}
                    <div class="alert {joinMsg.type}"><i class="fas {joinMsg.type === 'err' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i><span>{joinMsg.text}</span></div>
                {/if}

                <div class="flex items-center justify-end gap-2 mt-5">
                    <button class="btn btn-sm" onclick={closeJoin} disabled={joinBusy}>Cancel</button>
                    <button class="btn btn-primary btn-sm" onclick={submitJoin} disabled={joinBusy}>
                        {#if joinBusy}<i class="fas fa-spinner spin"></i> Joining…{:else}<i class="fab fa-whatsapp"></i> Join Group{/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}
{/if}

<style>
    .shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        position: relative;
    }
    .bgglow {
        position: fixed;
        inset: 0;
        z-index: 0;
        background:
            radial-gradient(ellipse 80% 60% at 20% -5%, rgba(16, 185, 129, 0.12), transparent 60%),
            radial-gradient(ellipse 60% 50% at 85% 110%, rgba(99, 102, 241, 0.1), transparent 60%);
    }
    .logo {
        width: 64px;
        height: 64px;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--color-accent2), var(--color-accent));
        color: #04130c;
        font-size: 1.6rem;
        margin-bottom: 0.9rem;
    }
    .title {
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
    }
    .divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.3), transparent);
        margin: 1.4rem 0;
    }
    .hints {
        list-style: none;
        padding: 0;
        margin: 1.2rem 0 0;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }
    .hints li {
        display: flex;
        gap: 0.6rem;
        font-size: 0.8rem;
        color: #64748b;
        padding: 0.6rem 0.75rem;
        background: rgba(16, 185, 129, 0.05);
        border: 1px solid rgba(16, 185, 129, 0.1);
        border-radius: 10px;
    }
    .hints li i {
        color: var(--color-accent);
        margin-top: 2px;
    }
    .codebox {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: #0a1326;
        border: 1px dashed var(--color-accent);
        border-radius: 14px;
        padding: 18px;
        margin-bottom: 14px;
    }
    .codenum {
        font-size: 2.1rem;
        font-weight: 800;
        letter-spacing: 0.3em;
        color: var(--color-accent);
    }
    .alert {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        border-radius: 12px;
        padding: 0.8rem 1rem;
        font-size: 0.85rem;
        margin-top: 1.1rem;
    }
    .alert.err {
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.25);
        color: #fca5a5;
    }
    .alert.ok {
        background: rgba(34, 197, 94, 0.08);
        border: 1px solid rgba(34, 197, 94, 0.25);
        color: #86efac;
    }
    .foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 1.4rem;
        font-size: 0.75rem;
        color: #4a5678;
    }
    .foot .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
        display: inline-block;
        margin-right: 5px;
    }
    .link {
        color: var(--color-muted);
        text-decoration: none;
        display: inline-flex;
        gap: 5px;
        align-items: center;
    }
    .link:hover {
        color: #fff;
    }
    .hd-ic {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--color-accent2), var(--color-accent));
        color: #04130c;
    }
    .gcard {
        cursor: pointer;
        transition: 0.18s;
        width: 100%;
    }
    .gcard:hover {
        border-color: var(--color-accent);
        transform: translateY(-2px);
    }
    .tab {
        padding: 9px 15px;
        border-radius: 11px;
        font-weight: 600;
        font-size: 0.82rem;
        color: var(--color-muted);
        cursor: pointer;
        border: 1px solid transparent;
        white-space: nowrap;
        background: none;
    }
    .tab.active {
        background: #0e1830;
        border-color: var(--color-edge);
        color: #fff;
    }
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
    .chip.warnchip {
        background: rgba(251, 191, 36, 0.12);
        border: 1px solid rgba(251, 191, 36, 0.3);
        color: #fcd34d;
    }
    .ok {
        color: var(--color-accent);
    }
    .warn {
        color: #fcd34d;
    }
    .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 60;
        background: rgba(2, 6, 18, 0.72);
        backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
    }
    .modal-panel {
        width: 100%;
        max-width: 460px;
        outline: none;
    }
    .modal-panel .lbl {
        display: block;
        margin-bottom: 0.4rem;
    }
</style>
