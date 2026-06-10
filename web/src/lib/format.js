export function timeAgo(ms) {
    if (!ms) return "";
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return new Date(ms).toLocaleString();
}

export function fmtDateTime(input) {
    if (!input) return "—";
    const d = typeof input === "number" ? new Date(input) : new Date(input);
    return d.toLocaleString();
}

export function fmtNumber(n) {
    return new Intl.NumberFormat().format(Number(n) || 0);
}

export function fmtBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return b + " B";
    if (b < 1024 ** 2) return (b / 1024).toFixed(1) + " KB";
    if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + " MB";
    return (b / 1024 ** 3).toFixed(2) + " GB";
}

export function fmtUptime(seconds) {
    const s = Math.floor(Number(seconds) || 0);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const parts = [];
    if (d) parts.push(d + "d");
    if (h) parts.push(h + "h");
    if (m || (!d && !h)) parts.push(m + "m");
    return parts.join(" ");
}

export function readableNumber(jid) {
    return String(jid || "").split("@")[0].split(":")[0];
}
