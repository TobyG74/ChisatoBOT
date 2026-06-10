<script>
    import { toasts, popupState, closePopup } from "../lib/ui.js";
</script>

<div class="tw">
    {#each $toasts as t (t.id)}
        <div class="toast {t.type}">
            <i class="fas {t.type === 'err' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
            <span>{t.message}</span>
        </div>
    {/each}
</div>

{#if $popupState}
    <div class="pov" onclick={(e) => e.target === e.currentTarget && closePopup()}>
        <div class="pcard card">
            <div class="pic {$popupState.type}">
                <i class="fas {$popupState.type === 'err' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
            </div>
            <div class="pt">{$popupState.title}</div>
            {#if $popupState.message}<div class="pm">{$popupState.message}</div>{/if}
            <button class="btn btn-primary" style="margin:0 auto" onclick={closePopup}>OK</button>
        </div>
    </div>
{/if}

<style>
    .tw {
        position: fixed;
        bottom: 22px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 130;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
    }
    .toast {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #0e1830;
        border: 1px solid var(--color-edge);
        padding: 11px 16px;
        border-radius: 13px;
        font-size: 0.84rem;
        font-weight: 600;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
        animation: up 0.2s ease both;
        max-width: 90vw;
    }
    .toast.ok {
        border-color: rgba(16, 185, 129, 0.45);
        color: #6ee7b7;
    }
    .toast.err {
        border-color: rgba(239, 68, 68, 0.5);
        color: #fca5a5;
    }
    @keyframes up {
        from {
            opacity: 0;
            transform: translateY(16px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .pov {
        position: fixed;
        inset: 0;
        z-index: 140;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(4px);
    }
    .pcard {
        max-width: 360px;
        width: 100%;
        text-align: center;
        padding: 26px 24px;
        animation: pop 0.2s ease both;
    }
    @keyframes pop {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    .pic {
        width: 58px;
        height: 58px;
        border-radius: 50%;
        margin: 0 auto 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6rem;
    }
    .pic.ok {
        background: rgba(16, 185, 129, 0.12);
        color: var(--color-accent);
    }
    .pic.err {
        background: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
    }
    .pt {
        font-weight: 800;
        font-size: 1.05rem;
        margin-bottom: 6px;
    }
    .pm {
        font-size: 0.85rem;
        color: var(--color-muted);
        margin-bottom: 18px;
        line-height: 1.5;
    }
</style>
