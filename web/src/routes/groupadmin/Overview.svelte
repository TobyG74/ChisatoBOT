<script>
    import { apiJson } from "../../lib/api.js";
    import { popup, toast } from "../../lib/ui.js";
    import Toggle from "../../components/Toggle.svelte";

    let { groupId, group, access } = $props();

    let name = $state(group?.subject || "");
    let desc = $state(group?.desc || "");
    let link = $state("");
    let savingProfile = $state(false);
    let picStatus = $state("");
    let wa = $state({
        announce: !!group?.announce,
        restrict: !!group?.restrict,
        joinApprovalMode: !!group?.joinApprovalMode,
    });
    let fileInput = $state();

    const base = () => "/api/group-admin/groups/" + encodeURIComponent(groupId);

    async function saveProfile() {
        savingProfile = true;
        try {
            const d = await apiJson(base() + "/profile", {
                method: "PUT",
                body: JSON.stringify({ subject: name.trim(), description: desc }),
            });
            const changed = d.changed?.length ? d.changed.join(" & ") : null;
            popup(changed ? "Group Updated" : "No Changes", changed ? "Successfully changed group " + changed + "." : "Nothing was different to save.", "ok");
        } catch (e) {
            popup("Update Failed", e.message, "err");
        } finally {
            savingProfile = false;
        }
    }

    function fileToBase64(file) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
    }
    async function uploadPic(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        picStatus = "Uploading…";
        try {
            const image = await fileToBase64(f);
            await apiJson(base() + "/profile-picture", { method: "POST", body: JSON.stringify({ image }) });
            picStatus = "Updated ✓";
            popup("Picture Updated", "The group profile picture has been changed.", "ok");
        } catch (err) {
            picStatus = "";
            popup("Upload Failed", err.message, "err");
        } finally {
            e.target.value = "";
        }
    }

    async function getLink() {
        try {
            const d = await apiJson(base() + "/invite-link");
            link = d.link;
        } catch (e) {
            toast(e.message, "err");
        }
    }
    async function revokeLink() {
        if (!confirm("Reset the invite link? The old link stops working.")) return;
        try {
            const d = await apiJson(base() + "/revoke-link", { method: "POST" });
            link = d.link || "";
            toast("Link reset", "ok");
        } catch (e) {
            toast(e.message, "err");
        }
    }
    function copyLink() {
        if (link) {
            navigator.clipboard?.writeText(link);
            toast("Copied", "ok");
        }
    }

    async function saveWa(field, value) {
        try {
            await apiJson(base() + "/wa-settings", { method: "PUT", body: JSON.stringify({ [field]: value }) });
            toast("Updated", "ok");
        } catch (e) {
            toast(e.message, "err");
            wa[field] = !value; // revert
        }
    }
</script>

<div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card p-5">
        <div class="font-bold mb-4"><i class="fas fa-pen text-accent"></i> Identity</div>
        <label class="lbl">Group Name</label>
        <input class="field mb-3" maxlength="100" bind:value={name} />
        <label class="lbl">Description</label>
        <textarea class="field mb-3" rows="4" maxlength="2048" bind:value={desc}></textarea>
        <button class="btn btn-primary" disabled={savingProfile} onclick={saveProfile}>
            {#if savingProfile}<i class="fas fa-spinner spin"></i> Saving…{:else}<i class="fas fa-save"></i> Save changes{/if}
        </button>
        <hr class="my-4 border-edge" />
        <label class="lbl">Group Picture</label>
        <div class="flex items-center gap-3">
            <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={uploadPic} />
            <button class="btn" onclick={() => fileInput.click()}><i class="fas fa-camera"></i> Upload new picture</button>
            <span class="text-[.76rem] text-muted">{picStatus}</span>
        </div>
    </div>

    <div class="card p-5">
        <div class="font-bold mb-4"><i class="fas fa-link text-accent"></i> Invite Link</div>
        <div class="flex gap-2 mb-3">
            <input class="field" readonly placeholder="Tap 'Get link'" value={link} />
            <button class="btn btn-sm" onclick={copyLink} title="Copy"><i class="fas fa-copy"></i></button>
        </div>
        <div class="flex gap-2">
            <button class="btn btn-sm" onclick={getLink}><i class="fas fa-rotate"></i> Get link</button>
            <button class="btn btn-sm btn-danger" onclick={revokeLink}><i class="fas fa-link-slash"></i> Reset link</button>
        </div>
        <hr class="my-4 border-edge" />
        <div class="font-bold mb-3"><i class="fas fa-lock text-accent"></i> Group Restrictions</div>
        <div class="flex flex-col gap-2.5">
            <label class="row-item !py-2.5"><span class="text-[.85rem]">Only admins can send messages</span><Toggle bind:checked={wa.announce} onchange={(v) => saveWa("announce", v)} /></label>
            <label class="row-item !py-2.5"><span class="text-[.85rem]">Only admins can edit group info</span><Toggle bind:checked={wa.restrict} onchange={(v) => saveWa("restrict", v)} /></label>
            <label class="row-item !py-2.5"><span class="text-[.85rem]">Approve new members</span><Toggle bind:checked={wa.joinApprovalMode} onchange={(v) => saveWa("joinApprovalMode", v)} /></label>
        </div>
    </div>
</div>
