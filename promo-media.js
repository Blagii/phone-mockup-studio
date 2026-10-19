const MAX_FILE = 50 * 1024 * 1024;
const MAX_TOTAL = 120 * 1024 * 1024;
export function createMediaLibrary() {
    const assets = new Map();
    let current = null, serial = 0;
    const release = asset => { asset.element.pause?.(); if (asset.type === 'video') { asset.element.removeAttribute('src'); asset.element.load(); } URL.revokeObjectURL(asset.url); };
    async function add(blob, name = 'Medij', id) {
        if (!(blob instanceof Blob) || blob.size > MAX_FILE || !blob.size) throw new Error('Medij mora biti manji od 50 MB.');
        if ([...assets.values()].reduce((n, a) => n + a.blob.size, 0) + blob.size > MAX_TOTAL) throw new Error('Biblioteka može imati do 120 MB medija.');
        const type = blob.type.startsWith('video/') ? 'video' : blob.type.startsWith('image/') ? 'image' : null;
        if (!type) throw new Error('Izaberi sliku ili MP4/WebM snimak ekrana.');
        if (!/^(image\/(png|jpeg|webp|gif|avif)|video\/(mp4|webm|quicktime))$/.test(blob.type)) throw new Error('Podržani su PNG, JPG, WebP, GIF, AVIF i MP4/WebM/MOV.');
        const url = URL.createObjectURL(blob), element = type === 'video' ? document.createElement('video') : new Image();
        if (type === 'video') { element.muted = true; element.playsInline = true; element.preload = 'auto'; element.loop = true; }
        try {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => { cleanup(); reject(new Error('Učitavanje medija je isteklo. Probaj MP4 ili WebM.')); }, 20000);
                const ok = type === 'video' ? 'loadeddata' : 'load';
                const cleanup = () => { clearTimeout(timer); element.removeEventListener(ok, done); element.removeEventListener('error', fail); };
                const done = () => { cleanup(); resolve(); };
                const fail = () => { cleanup(); reject(new Error('Pregledač ne može da otvori ovaj medij. Probaj PNG/JPG ili MP4/WebM.')); };
                element.addEventListener(ok, done); element.addEventListener('error', fail); element.src = url;
            });
            let clipDuration = type === 'video' ? element.duration : 0;
            // Browser-recorded WebM files often omit duration metadata. Ask the local
            // demuxer for the end before rejecting an otherwise valid recording.
            if (type === 'video' && !Number.isFinite(clipDuration)) {
                const seek = time => new Promise((resolve, reject) => {
                    const timer = setTimeout(() => { cleanup(); reject(new Error('Ne mogu da pročitam trajanje videa.')); }, 15000);
                    const cleanup = () => { clearTimeout(timer); element.removeEventListener('seeked', done); };
                    const done = () => { cleanup(); resolve(); }; element.addEventListener('seeked', done); element.currentTime = time;
                });
                await seek(1e10);
                clipDuration = Number.isFinite(element.duration) ? element.duration : element.seekable.length ? element.seekable.end(element.seekable.length - 1) : element.currentTime;
                await seek(0);
            }
            const width = element.videoWidth || element.naturalWidth, height = element.videoHeight || element.naturalHeight;
            if (!width || !height || width * height > 40000000 || (type === 'video' && (!Number.isFinite(clipDuration) || clipDuration <= 0))) throw new Error('Neispravne dimenzije ili trajanje medija (maks. 40 MP).');
            if (type === 'image') { element.width = width; element.height = height; }
            const thumb = document.createElement('canvas'); thumb.width = 160; thumb.height = Math.max(1, Math.round(height / width * 160));
            if (thumb.height > 400) { thumb.height = 400; thumb.width = Math.max(1, Math.round(width / height * 400)); }
            thumb.getContext('2d').drawImage(element, 0, 0, thumb.width, thumb.height);
            const asset = { id: id || `media-${Date.now()}-${++serial}`, name: String(name).slice(0, 100), type, width, height, duration: clipDuration, blob, url, element, poster: thumb.toDataURL('image/png') };
            assets.set(asset.id, asset); return asset;
        } catch (error) { element.pause?.(); URL.revokeObjectURL(url); throw error; }
    }
    return {
        assets, add,
        pause() { for (const asset of assets.values()) if (asset.type === 'video') asset.element.pause(); },
        source(id, local, offset, moving) {
            const asset = assets.get(id);
            if (current !== id) { for (const a of assets.values()) if (a.type === 'video' && a.id !== id) a.element.pause(); current = id; }
            if (!asset) return null;
            if (asset.type === 'video') {
                const video = asset.element, target = (Math.max(0, offset) + local) % asset.duration;
                const tolerance = moving ? .3 : .025;
                if (!video.seeking && Math.abs(video.currentTime - target) > tolerance) video.currentTime = target;
                if (moving && video.paused) video.play().catch(() => {});
                else if (!moving && !video.paused) video.pause();
            }
            return asset.element;
        },
        async prepare(id, offset = 0) {
            const asset = assets.get(id); if (!asset || asset.type !== 'video') return;
            const target = Math.max(0, offset) % asset.duration;
            if (Math.abs(asset.element.currentTime - target) < .025 && !asset.element.seeking) return;
            await new Promise((resolve, reject) => {
                const video = asset.element, timer = setTimeout(() => { cleanup(); reject(new Error('Video nije spreman za snimanje.')); }, 10000);
                const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); };
                const done = () => { cleanup(); resolve(); }; video.addEventListener('seeked', done); video.currentTime = target;
            });
        },
        remove(id) { const asset = assets.get(id); if (asset) { release(asset); assets.delete(id); } if (current === id) current = null; },
        clear() { for (const asset of assets.values()) release(asset); assets.clear(); current = null; },
        async serialize() {
            const result = [];
            for (const asset of assets.values()) {
                const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Medij nije sačuvan.')); reader.readAsDataURL(asset.blob); });
                result.push({ id: asset.id, name: asset.name, type: asset.type, data });
            }
            return result;
        },
    };
}
