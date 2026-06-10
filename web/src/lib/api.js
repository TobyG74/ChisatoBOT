import { writable, get } from "svelte/store";

// Single unified session for both owner/team and group-admin. Role inside the
// profile decides which dashboard the router shows.
export const token = writable(localStorage.getItem("chisato.token") || null);
export const profile = writable(
    JSON.parse(localStorage.getItem("chisato.profile") || "null")
);

token.subscribe((v) => {
    if (v) localStorage.setItem("chisato.token", v);
    else localStorage.removeItem("chisato.token");
});
profile.subscribe((v) => {
    if (v) localStorage.setItem("chisato.profile", JSON.stringify(v));
    else localStorage.removeItem("chisato.profile");
});

export function setSession(t, p) {
    token.set(t);
    profile.set(p || null);
}
export function clearSession() {
    token.set(null);
    profile.set(null);
}
export function isGroupAdmin() {
    return get(profile)?.role === "groupadmin";
}

export async function api(path, opts = {}) {
    const t = get(token);
    const headers = { ...(opts.headers || {}) };
    if (t) headers.Authorization = "Bearer " + t;
    if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const res = await fetch(path, { ...opts, headers });
    // Only a 401 (bad/expired token) ends the session. A 403 is a per-resource
    // authorization failure (e.g. group-admin scope) and must NOT log out.
    if (res.status === 401) clearSession();
    return res;
}

export async function apiJson(path, opts) {
    const r = await api(path, opts);
    let d = {};
    try {
        d = await r.json();
    } catch {
        /* non-json */
    }
    if (!r.ok) throw new Error(d.message || d.error || `HTTP ${r.status}`);
    return d;
}

export async function apiBlob(path, opts) {
    const r = await api(path, opts);
    if (!r.ok) throw new Error("Request failed");
    return await r.blob();
}

export async function logoutRequest() {
    const t = get(token);
    try {
        if (t) await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + t } });
    } catch {
        /* ignore */
    }
    clearSession();
}
