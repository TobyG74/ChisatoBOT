<script>
    import { onMount, onDestroy } from "svelte";
    import { apiJson, apiBlob } from "../../lib/api.js";
    import { popup, toast } from "../../lib/ui.js";
    import Toggle from "../../components/Toggle.svelte";

    let { groupId } = $props();
    const base = () => "/api/group-admin/groups/" + encodeURIComponent(groupId);

    const ELEMENTS = [
        { key: "avatar", label: "Avatar", size: [60, 300], hasSize: true },
        { key: "title", label: "Title", size: [20, 90], hasText: true, hasColor: true, hasSize: true },
        { key: "groupName", label: "Group Name", size: [20, 90], hasColor: true, hasSize: true },
        { key: "username", label: "Member Name", size: [16, 70], hasColor: true, hasSize: true },
        { key: "badge", label: "Member Badge", hasColor: true },
    ];

    let variant = $state("welcome");
    let config = $state(null);
    let previewUrl = $state("");
    let previewLoading = $state(false);
    let saving = $state(false);
    let bgFile = $state();
    let stageEl = $state();
    let previewTimer = null;
    let drag = null;

    onMount(() => loadLayout());
    onDestroy(() => {
        clearTimeout(previewTimer);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    });

    async function loadLayout() {
        try {
            const d = await apiJson(base() + "/layout/" + variant);
            config = d.config;
            refreshPreview();
        } catch (e) {
            toast(e.message, "err");
        }
    }
    function setVariant(v) {
        if (v === variant) return;
        variant = v;
        loadLayout();
    }

    function schedule() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(refreshPreview, 350);
    }
    async function refreshPreview() {
        if (!config) return;
        previewLoading = true;
        try {
            const blob = await apiBlob(base() + "/layout/" + variant + "/preview", {
                method: "POST",
                body: JSON.stringify({ config }),
            });
            const url = URL.createObjectURL(blob);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = url;
        } catch {
            /* transient */
        } finally {
            previewLoading = false;
        }
    }

    function startDrag(key, e) {
        drag = key;
        e.target.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    }
    function moveDrag(e) {
        if (!drag || !stageEl) return;
        const r = stageEl.getBoundingClientRect();
        let x = ((e.clientX - r.left) / r.width) * 1024;
        let y = ((e.clientY - r.top) / r.height) * 576;
        config[drag].x = Math.round(Math.max(0, Math.min(1024, x)));
        config[drag].y = Math.round(Math.max(0, Math.min(576, y)));
        schedule();
    }
    function endDrag() {
        drag = null;
    }

    function fileToBase64(file) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
    }
    async function uploadBg(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
            const image = await fileToBase64(f);
            const d = await apiJson(base() + "/layout/" + variant + "/background", { method: "POST", body: JSON.stringify({ image }) });
            config.background = d.url;
            refreshPreview();
            toast("Background uploaded", "ok");
        } catch (err) {
            toast(err.message, "err");
        } finally {
            e.target.value = "";
        }
    }
    function clearBg() {
        config.background = null;
        refreshPreview();
    }

    async function save() {
        saving = true;
        try {
            await apiJson(base() + "/layout/" + variant, { method: "PUT", body: JSON.stringify({ config }) });
            popup("Layout Saved", "Your " + variant + " image layout has been saved.", "ok");
        } catch (e) {
            popup("Save Failed", e.message, "err");
        } finally {
            saving = false;
        }
    }
</script>

<div class="flex gap-2 mb-4 flex-wrap items-center">
    <button class="btn btn-sm" class:btn-primary={variant === "welcome"} onclick={() => setVariant("welcome")}>👋 Welcome</button>
    <button class="btn btn-sm" class:btn-primary={variant === "leave"} onclick={() => setVariant("leave")}>🚪 Leave</button>
    <span class="flex-1"></span>
    <button class="btn btn-sm" onclick={loadLayout}><i class="fas fa-rotate-left"></i> Reset</button>
    <button class="btn btn-primary btn-sm" disabled={saving} onclick={save}>
        {#if saving}<i class="fas fa-spinner spin"></i> Saving…{:else}<i class="fas fa-save"></i> Save layout{/if}
    </button>
</div>

{#if config}
    <div class="grid gap-4" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)">
        <div>
            <div class="text-[.74rem] text-muted mb-2"><i class="fas fa-up-down-left-right"></i> Drag elements to reposition. Preview updates automatically.</div>
            <div class="stage" bind:this={stageEl} onpointermove={moveDrag} onpointerup={endDrag} onpointercancel={endDrag}>
                {#if previewUrl}<img src={previewUrl} alt="preview" />{/if}
                {#each ELEMENTS as el (el.key)}
                    {#if config[el.key]?.show}
                        <div
                            class="handle"
                            class:avatar={el.key === "avatar"}
                            style="left:{(config[el.key].x / 1024) * 100}%;top:{(config[el.key].y / 576) * 100}%"
                            onpointerdown={(e) => startDrag(el.key, e)}
                        >
                            {el.key === "avatar" ? "" : el.label}
                        </div>
                    {/if}
                {/each}
                {#if previewLoading}<div class="ld"><i class="fas fa-spinner spin"></i></div>{/if}
            </div>
        </div>

        <div class="card p-4 controls">
            <label class="lbl">Overlay darkness <span class="text-accent float-right">{config.overlayOpacity}</span></label>
            <input type="range" min="0" max="1" step="0.05" bind:value={config.overlayOpacity} oninput={schedule} class="w-full mb-3" />

            <label class="lbl">Accent color</label>
            <input type="color" bind:value={config.accentColor} oninput={schedule} class="cinput mb-3" />

            <label class="row-item !py-2.5 mb-3"><span class="text-[.84rem]">Decorative marks</span><Toggle bind:checked={config.decorations} onchange={schedule} /></label>

            {#each ELEMENTS as el (el.key)}
                <div class="elbox">
                    <label class="flex items-center justify-between mb-2">
                        <span class="font-bold text-[.82rem]">{el.label}</span>
                        <Toggle bind:checked={config[el.key].show} onchange={schedule} />
                    </label>
                    {#if el.hasText}
                        <input class="field !py-2 mb-2" placeholder="Text" bind:value={config[el.key].text} oninput={schedule} />
                    {/if}
                    {#if el.hasColor}
                        <label class="lbl">Color</label>
                        <input type="color" bind:value={config[el.key].color} oninput={schedule} class="cinput mb-2" />
                    {/if}
                    {#if el.hasSize}
                        <label class="lbl">Size <span class="text-accent float-right">{config[el.key].size}</span></label>
                        <input type="range" min={el.size[0]} max={el.size[1]} step="1" bind:value={config[el.key].size} oninput={schedule} class="w-full" />
                    {/if}
                </div>
            {/each}

            <label class="lbl">Caption / message</label>
            <textarea class="field mb-1" rows="3" placeholder="Use @user, @group, @ownergroup" bind:value={config.caption} oninput={schedule}></textarea>
            <div class="text-[.7rem] text-subtle mb-3">Sent as the message text with the image.</div>

            <label class="lbl">Background image</label>
            <div class="flex gap-2 items-center">
                <input type="file" accept="image/*" class="hidden" bind:this={bgFile} onchange={uploadBg} />
                <button class="btn btn-sm" onclick={() => bgFile.click()}><i class="fas fa-image"></i> Upload</button>
                <button class="btn btn-sm" onclick={clearBg}>Default</button>
                <span class="text-[.72rem] text-muted">{config.background ? "custom" : "default"}</span>
            </div>
        </div>
    </div>
{:else}
    <div class="text-muted text-sm"><i class="fas fa-spinner spin"></i> Loading…</div>
{/if}

<style>
    .stage {
        position: relative;
        width: 100%;
        aspect-ratio: 1024 / 576;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid var(--color-edge);
        background: #000;
        touch-action: none;
    }
    .stage img {
        width: 100%;
        height: 100%;
        display: block;
        user-select: none;
        -webkit-user-drag: none;
    }
    .handle {
        position: absolute;
        transform: translate(-50%, -50%);
        border: 2px dashed rgba(52, 211, 153, 0.9);
        border-radius: 8px;
        background: rgba(16, 185, 129, 0.1);
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.6rem;
        font-weight: 700;
        color: #bbf7d0;
        text-shadow: 0 1px 2px #000;
        padding: 2px 6px;
        min-width: 30px;
        min-height: 22px;
    }
    .handle:active {
        cursor: grabbing;
        border-style: solid;
    }
    .handle.avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
    }
    .ld {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.4);
        color: #fff;
    }
    .controls {
        max-height: 560px;
        overflow: auto;
    }
    .cinput {
        width: 100%;
        height: 34px;
        border: 1px solid var(--color-edge);
        border-radius: 9px;
        background: #0a1326;
        cursor: pointer;
    }
    .elbox {
        border: 1px solid var(--color-edge);
        border-radius: 12px;
        padding: 11px;
        margin-bottom: 10px;
    }
</style>
