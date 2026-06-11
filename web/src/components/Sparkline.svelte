<script>
    let { data = [], max = 100, color = "#34d399", height = 40 } = $props();

    const W = 100;
    const H = 40;

    // Fixed-width mapping: x is spaced over the full series length so points
    // scroll in from the right at a constant pace (no rescaling jitter).
    let line = $derived(buildLine(data, max));
    let area = $derived(line ? `M0,${H} ${line} L${W},${H} Z` : "");

    function buildLine(series, m) {
        if (!series || series.length < 2) return "";
        const top = m || Math.max(...series, 1);
        const n = series.length;
        return series
            .map((v, i) => {
                const x = (i / (n - 1)) * W;
                const y = H - Math.max(0, Math.min(H, (v / top) * H));
                return `${i === 0 ? "" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ")
            .replace(/^L/, "M");
    }
</script>

<svg class="spark" viewBox="0 0 {W} {H}" preserveAspectRatio="none" style="height:{height}px">
    {#if area}<path d={area} fill={color} fill-opacity="0.12" />{/if}
    {#if line}<path d={line} fill="none" stroke={color} stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />{/if}
</svg>

<style>
    .spark {
        width: 100%;
        display: block;
    }
</style>
