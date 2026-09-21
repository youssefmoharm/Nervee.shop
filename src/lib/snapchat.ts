/**
 * Snapchat lens helpers — only officially supported URL formats.
 *
 * - Lens unlock/share page: https://www.snapchat.com/unlock/?type=SNAPCODE&uuid=<lensId>
 *   (this is the format Snap's Lens Studio / share sheets produce; on mobile it
 *   opens the Snapchat app and unlocks the lens; on desktop it shows a snapcode page.)
 * - Snap Store lens page: https://www.snapchat.com/lens/<lensId> (public share URL).
 *
 * We deliberately do NOT invent custom native schemes (e.g. snapchat://lenses/…)
 * — those are undocumented and unreliable.
 */

export function lensUnlockUrl(lensId: string): string {
  return `https://www.snapchat.com/unlock/?type=SNAPCODE&uuid=${encodeURIComponent(lensId)}`;
}

export function lensShareUrl(lensId: string): string {
  return `https://www.snapchat.com/lens/${encodeURIComponent(lensId)}`;
}

export interface DeviceCapabilities {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  /** Rough heuristic: touch + small viewport + mobile UA. */
  hasTouch: boolean;
  cameraCount: number | null; // null = unknown
}

export function detectDevice(): DeviceCapabilities {
  if (typeof navigator === 'undefined') {
    return { isMobile: false, isIOS: false, isAndroid: false, hasTouch: false, cameraCount: null };
  }
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ masquerades as desktop Safari
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Opera Mini|IEMobile/i.test(ua);
  const hasTouch =
    isMobile ||
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches);

  return { isMobile, isIOS, isAndroid, hasTouch, cameraCount: null };
}

/** Count available cameras (best effort; used to offer front/back switching). */
export async function enumerateCameras(): Promise<number | null> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput').length || null;
  } catch {
    return null;
  }
}
