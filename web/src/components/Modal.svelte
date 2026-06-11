<script>
    let { open = $bindable(false), title = "", icon = "fa-pen", onClose, children } = $props();
    function close() {
        open = false;
        onClose?.();
    }
    // Render the overlay on <body> so an ancestor with backdrop-filter/transform
    // (e.g. the dashboard topbar) can't become its containing block and shove
    // the fixed overlay out of place.
    function portal(node) {
        document.body.appendChild(node);
        return { destroy: () => node.remove() };
    }
</script>

{#if open}
    <div class="ov" use:portal onclick={(e) => e.target === e.currentTarget && close()}>
        <div class="modal card">
            <div class="head">
                <div class="t"><i class="fas {icon} text-accent"></i> {title}</div>
                <button class="x" onclick={close} aria-label="Close"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="body">{@render children?.()}</div>
        </div>
    </div>
{/if}

<style>
    .ov {
        position: fixed;
        inset: 0;
        z-index: 120;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(5px);
        animation: fade 0.18s ease both;
    }
    @keyframes fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    .modal {
        width: 100%;
        max-width: 480px;
        max-height: 88vh;
        overflow: auto;
        animation: rise 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes rise {
        from {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 18px;
        border-bottom: 1px solid var(--color-edge);
    }
    .t {
        font-weight: 800;
        font-size: 0.98rem;
    }
    .x {
        background: none;
        border: none;
        color: var(--color-muted);
        cursor: pointer;
        font-size: 1rem;
    }
    .x:hover {
        color: #fff;
    }
    .body {
        padding: 18px;
    }
</style>
