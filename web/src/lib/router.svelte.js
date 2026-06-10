function currentPath() {
    return window.location.pathname || "/";
}

export const route = $state({ path: currentPath() });

export function navigate(to, { replace = false } = {}) {
    if (to === route.path) return;
    if (replace) history.replaceState({}, "", to);
    else history.pushState({}, "", to);
    route.path = to;
    window.scrollTo(0, 0);
}

if (typeof window !== "undefined") {
    window.addEventListener("popstate", () => {
        route.path = currentPath();
    });

    document.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target?.closest?.("a");
        if (!a) return;
        const href = a.getAttribute("href");
        if (!href || !href.startsWith("/") || a.target === "_blank" || a.hasAttribute("data-native")) return;
        if (/^\/(api|assets|images|uploads)\b/.test(href)) return;
        e.preventDefault();
        navigate(href);
    });
}
