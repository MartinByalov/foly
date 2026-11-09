// Share successful loads between discovery validation and grid painting.
const loaded = new Map();

export function loadImage(url, { timeout = 8000, ImageClass = globalThis.Image } = {}) {
  if (loaded.has(url)) return loaded.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new ImageClass();
    image.crossOrigin = 'anonymous';
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) { image.removeAttribute('src'); reject(error); }
      else resolve(url);
    };
    const timer = setTimeout(() => finish(new Error('Image timed out')), timeout);
    image.onload = async () => {
      try {
        if (!(image.naturalWidth > 0) || !(image.naturalHeight > 0)) throw new Error('Empty image');
        if (typeof image.decode === 'function') await image.decode();
        finish();
      } catch (error) { finish(error); }
    };
    image.onerror = () => finish(new Error('Image failed to load'));
    image.src = url;
  });
  loaded.set(url, promise);
  promise.catch(() => { if (loaded.get(url) === promise) loaded.delete(url); });
  return promise;
}