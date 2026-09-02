/**
 * Shared Google Identity Services loader.
 *
 * The legacy controller (app.js) owns its own copy for the shared /login
 * modal; registration surfaces (React) use this module so both stay on one
 * loaded GSI script per page.
 */

let loaderPromise: Promise<void> | null = null;

/** Minimal structural access to the GSI namespace without redeclaring
 * `window.google` (already declared by other ambient types). */
export function getGoogleId(): {
  initialize(config: Record<string, unknown>): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
} | null {
  if (typeof window === 'undefined') return null;
  const accounts = (
    window as unknown as {
      google?: { accounts?: { id?: { initialize: unknown; renderButton: unknown } } };
    }
  ).google?.accounts?.id;
  if (
    !accounts ||
    typeof accounts.initialize !== 'function' ||
    typeof accounts.renderButton !== 'function'
  ) {
    return null;
  }
  return accounts as unknown as {
    initialize(config: Record<string, unknown>): void;
    renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  };
}

export function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity chỉ khả dụng trên trình duyệt.'));
  }
  if (getGoogleId()) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity-react]');
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentityReact = 'true';
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('Google Identity Services không tải được.'));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    loaderPromise = null;
    throw err;
  });

  return loaderPromise;
}
