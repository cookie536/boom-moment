const TOAST_KEY = "boom-moment-toast";
const TOAST_EVENT = "boom-toast";

export function showToast(message: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

export function queueToast(message: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(TOAST_KEY, message);
  } catch {
    showToast(message);
  }
}

export function consumeToast() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const message = window.sessionStorage.getItem(TOAST_KEY);
    if (message) {
      window.sessionStorage.removeItem(TOAST_KEY);
    }
    return message;
  } catch {
    return null;
  }
}

export function toastEventName() {
  return TOAST_EVENT;
}
