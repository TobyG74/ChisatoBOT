import { writable } from "svelte/store";

export const toasts = writable([]);
let toastId = 0;

export function toast(message, type = "ok", ms = 2800) {
    const id = ++toastId;
    toasts.update((a) => [...a, { id, message, type }]);
    setTimeout(() => toasts.update((a) => a.filter((t) => t.id !== id)), ms);
}

export const popupState = writable(null);
let popupTimer = null;

export function popup(title, message = "", type = "ok") {
    popupState.set({ title, message, type });
    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => popupState.set(null), 3400);
}
export function closePopup() {
    clearTimeout(popupTimer);
    popupState.set(null);
}
