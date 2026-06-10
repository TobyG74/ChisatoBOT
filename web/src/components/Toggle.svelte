<script>
    let { checked = $bindable(false), onchange, disabled = false } = $props();
</script>

<label class="sw" class:op={disabled}>
    <input type="checkbox" bind:checked {disabled} onchange={() => onchange?.(checked)} />
    <span></span>
</label>

<style>
    .sw {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 25px;
        flex: none;
    }
    .sw input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .sw span {
        position: absolute;
        inset: 0;
        background: #1e2a44;
        border-radius: 999px;
        transition: 0.2s;
        cursor: pointer;
    }
    .sw span::before {
        content: "";
        position: absolute;
        height: 19px;
        width: 19px;
        left: 3px;
        top: 3px;
        background: #64748b;
        border-radius: 50%;
        transition: 0.2s;
    }
    .sw input:checked + span {
        background: linear-gradient(135deg, #10b981, #34d399);
    }
    .sw input:checked + span::before {
        transform: translateX(19px);
        background: #04130c;
    }
    .op {
        opacity: 0.5;
        pointer-events: none;
    }
</style>
