const loading = new Map<string, Promise<void>>();

/**
 * Adds a third-party player script once per page. A failed load is forgotten so a
 * later attempt can retry. Only exact URLs listed in the Content Security Policy work.
 */
export function loadScript(src: string): Promise<void> {
  const existing = loading.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading.delete(src);
      script.remove();
      reject(new Error(`Could not load ${new URL(src).host}`));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}
