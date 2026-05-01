// Helper para Facebook Pixel
// Pixel ID: 1873464756626259
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const FB_PIXEL_ID = "1873464756626259";

export function fbTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (params) {
    window.fbq("track", event, params);
  } else {
    window.fbq("track", event);
  }
}

export function fbTrackCustom(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("trackCustom", event, params ?? {});
}
