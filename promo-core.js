// Deterministic scene data shared by preview, video export and tests.
export const THEMES = {
    peach: { name: 'Peach glow', top: '#fae8db', bottom: '#e7ab8e', ink: '#33241f', accent: '#a85839' },
    midnight: { name: 'Midnight', top: '#181b25', bottom: '#080a10', ink: '#f6f5f2', accent: '#aab6df' },
    lilac: { name: 'Soft lilac', top: '#ece7fc', bottom: '#beb5df', ink: '#302b42', accent: '#746394' },
    mint: { name: 'Fresh mint', top: '#e5f2e9', bottom: '#a9cdbb', ink: '#203c31', accent: '#4d7966' },
    paper: { name: 'Warm paper', top: '#faf9f5', bottom: '#e7e4dc', ink: '#292a2c', accent: '#757369' },
};
export const SHOTS = {
    title: { name: 'Naslov', tag: 'TYPOGRAPHY', hint: 'Velika ideja. Jednostavan početak.', duration: 2.5, title: 'Tvoja sledeća\nvelika ideja.', subtitle: 'PREDSTAVI SVOJU APLIKACIJU', theme: 'midnight' },
    hero: { name: 'Hero reveal', tag: '3D REVEAL', hint: 'Telefon ulazi u kadar i otkriva ekran.', duration: 4, title: 'Dizajnirano\nza svaki dan.', subtitle: 'TVOJA APLIKACIJA. U PRVOM PLANU.', theme: 'peach' },
    closeup: { name: 'Macro detail', tag: 'CLOSE-UP', hint: 'Krupni plan ekrana, filmski pokret.', duration: 3, title: 'Svaki detalj.\nNa svom mestu.', subtitle: 'POGLEDAJ IZBLIZA', theme: 'paper' },
    orbit: { name: 'Smooth orbit', tag: '3D MOTION', hint: 'Glatko pomeranje između dva 3D ugla.', duration: 4, title: 'Nova perspektiva.', subtitle: 'NAPRAVLJENO DA SE IZDVOJI.', theme: 'lilac' },
    slide: { name: 'Slide in', tag: 'DYNAMIC', hint: 'Dijagonalni ulazak sa blagim nagibom.', duration: 3.5, title: 'Sve što ti treba.\nNa jednom mestu.', subtitle: 'JEDNOSTAVNO. BRZO. TVOJE.', theme: 'mint' },
    float: { name: 'Floating phone', tag: 'SLOW MOTION', hint: 'Lagano lebdenje i rotacija telefona.', duration: 4, title: 'Upoznaj nešto\nnovo.', subtitle: 'MALO DRUGAČIJE ISKUSTVO.', theme: 'peach' },
    staticScroll: { name: 'Statičan telefon + skrol', tag: 'STATIC SCROLL', hint: 'Telefon miruje pravo ka gledaocu. Ubaci dugu sliku i skrol je već uključen.', duration: 8, title: '', subtitle: '', theme: 'paper' },
    zoomin: { name: 'Zumiranje', tag: 'ZOOM IN', hint: 'Glatko približavanje uređaja kroz celu scenu.', duration: 4, title: 'Pogledaj izbliza.', subtitle: 'SVAKI DETALJ JE VAŽAN.', theme: 'peach' },
    zoomout: { name: 'Odzumiranje', tag: 'ZOOM OUT', hint: 'Od krupnog plana do celog uređaja.', duration: 4, title: 'Pogledaj širu sliku.', subtitle: 'TVOJA APLIKACIJA U PRVOM PLANU.', theme: 'lilac' },
    cta: { name: 'Poziv na akciju', tag: 'OUTRO', hint: 'Završi jasnom porukom i svojim linkom.', duration: 2.5, title: 'Spreman za\nnešto novo?', subtitle: 'PREUZMI APLIKACIJU', theme: 'midnight' },
};
export const MAX_SCENE_DURATION = 120;
let nextId = 0;
export function makeScene(shot, overrides = {}) {
    if (!Object.hasOwn(SHOTS, shot)) throw new Error('Unknown shot');
    const { duration, title, subtitle, theme } = SHOTS[shot];
    const scene = { id: `scene-${Date.now()}-${++nextId}`, shot, duration, title, subtitle, theme, transition: shot === 'staticScroll' ? 'cut' : 'fade', device: 'iphone', mediaId: null, mediaStart: 0, colors: null, lightPower: 100, overlays: [], textStyle: { scale: 100, y: null, align: 'center', font: 'sans', showTitle: true, showSubtitle: true, subtitleScale: 100, subtitleAsTitle: false }, ...overrides };
    scene.textStyle = { scale:100, y:null, align:'center', font:'sans', showTitle:true, showSubtitle:true, ...scene.textStyle, ...overrides.textStyle };
    scene.textStyle.subtitleScale = Number.isFinite(overrides.textStyle?.subtitleScale) ? Math.min(500, Math.max(25, overrides.textStyle.subtitleScale)) : 100;
    scene.textStyle.subtitleAsTitle = overrides.textStyle?.subtitleAsTitle === true;
    scene.phoneCase = normalizePhoneCase(overrides.phoneCase);
    scene.devicePosition = normalizeDevicePosition(overrides.devicePosition);
    scene.screenAdjust = normalizeScreenSettings(overrides.screenAdjust);
    scene.screenMotion = normalizeScreenMotion(overrides.screenMotion ?? (shot === 'staticScroll' ? { enabled:true, direction:'down', easing:'linear', zoom:100 } : null));
    scene.cameraZoom = normalizeCameraZoom(overrides.cameraZoom ?? (shot === 'zoomin' ? { enabled: true, from: 70, to: 110 } : shot === 'zoomout' ? { enabled: true, from: 110, to: 70 } : null));
    return scene;
}
export function makeTemplate(kind = 'launch') {
    const shots = kind === 'minimal' ? ['title', 'float', 'closeup', 'cta'] : kind === 'showcase' ? ['hero', 'slide', 'orbit', 'closeup', 'cta'] : ['title', 'hero', 'closeup', 'orbit', 'cta'];
    return shots.map(shot => makeScene(shot, kind === 'minimal' ? { theme: 'paper' } : {}));
}
export const totalDuration = scenes => scenes.reduce((sum, s) => sum + s.duration, 0);
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const ease = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
export function sceneAt(scenes, time) {
    if (!scenes.length) return null;
    const t = clamp(time, 0, totalDuration(scenes));
    let start = 0;
    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (t < start + scene.duration || i === scenes.length - 1) {
            const local = clamp(t - start, 0, scene.duration);
            return { scene, index: i, start, local, progress: local / scene.duration };
        }
        start += scene.duration;
    }
}
export function poseFor(shot, t) {
    const e = ease(t), wave = Math.sin(t * Math.PI * 2);
    const pose = { x: 0, y: -0.38, rx: 0, ry: 0, rz: 0, scale: 0.73, visible: true };
    switch (shot) {
        case 'hero': Object.assign(pose, { y: -0.65 + e * 0.3, rx: 12 * (1 - e), ry: -28 + e * 34, scale: 0.61 + e * 0.13 }); break;
        case 'closeup': Object.assign(pose, { y: -1.08 + e * 0.15, rx: 10 - e * 6, ry: -12 + e * 20, rz: -5 + e * 6, scale: 1.5 + e * 0.2 }); break;
        case 'orbit': Object.assign(pose, { ry: -38 + e * 76, rx: 8 - e * 12, rz: -6 + e * 12, scale: 0.74 }); break;
        case 'slide': Object.assign(pose, { x: 1.4 * (1 - ease(Math.min(t * 2, 1))), y: -0.45 + e * 0.1, ry: -20 + e * 30, rz: -18 + e * 12, scale: 0.72 }); break;
        case 'staticScroll': Object.assign(pose, { y: 0, scale: .78 }); break;
        case 'zoomin': case 'zoomout': Object.assign(pose, { rx: 4, ry: -8, scale: .73 }); break;
        case 'float': Object.assign(pose, { y: -0.4 + wave * 0.07, ry: -12 + Math.sin(t * Math.PI) * 22, rz: -6 + wave * 3, rx: 6, scale: 0.74 }); break;
        default: pose.visible = false;
    }
    return pose;
}
export function normalizeCameraZoom(value) {
    const num = (v, fallback) => Number.isFinite(v) ? clamp(v,25,250) : fallback;
    return { enabled: value?.enabled === true, from: num(value?.from,100), to: num(value?.to,130), easing: value?.easing === 'linear' ? 'linear' : 'smooth' };
}
export function normalizeDevicePosition(value) {
    const coordinate = v => Number.isFinite(v) ? clamp(v, -100, 100) : 0;
    return { x: coordinate(value?.x), y: coordinate(value?.y) };
}
export function poseForScene(scene, progress) {
    const pose = poseFor(scene.shot, progress), zoom = normalizeCameraZoom(scene.cameraZoom);
    if (zoom.enabled) {
        const t = zoom.easing === 'linear' ? clamp(progress) : ease(progress);
        pose.scale *= (zoom.from + (zoom.to - zoom.from) * t) / 100;
    }
    const position = normalizeDevicePosition(scene.devicePosition);
    pose.x += position.x * .03;
    pose.y -= position.y * .03;
    return pose;
}
export function sceneOpacity(scene, local) {
    if (scene.transition === 'cut') return 1;
    const fade = Math.min(0.3, scene.duration / 4);
    return ease(Math.min(local / fade, (scene.duration - local) / fade));
}
export const DEVICES = { iphone: 'iPhone · 3D', android: 'Samsung / Android · 3D', laptop: 'Laptop · 3D', screen: 'Samo ekran · 3D' };
export const PHONE_CASES = { original: 'Originalni okvir', matte: 'Mat maskica', glossy: 'Sjajna maskica', metallic: 'Metalni okvir' };
export function normalizePhoneCase(value) {
    return { finish: Object.hasOwn(PHONE_CASES, value?.finish) ? value.finish : 'original' };
}
export function caseMaterial(finish) {
    return finish === 'matte' ? { metalness: 0, roughness: .85 }
        : finish === 'glossy' ? { metalness: .08, roughness: .12 }
        : finish === 'metallic' ? { metalness: .95, roughness: .24 } : null;
}
export function styleFor(scene) { return { ...THEMES[scene.theme], light: '#ffffff', frame: '#62646b', ...scene.colors, caseFinish: normalizePhoneCase(scene.phoneCase).finish }; }

export function videoMimeFor(format, supports) {
    const webm = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
    const mp4 = ['video/mp4;codecs=avc1', 'video/mp4'];
    const candidates = format === 'mp4' ? mp4 : format === 'webm' ? webm : [];
    return candidates.find(type => supports(type)) || null;
}
export function outputSize(format, quality) {
    const size = Number(quality), ratios = { vertical: [9,16], square: [1,1], wide: [16,9] };
    const [w,h] = ratios[format] || ratios.vertical;
    const edge = w === h ? size : size * 16 / 9;
    return [Math.round(w / Math.max(w,h) * edge / 2) * 2, Math.round(h / Math.max(w,h) * edge / 2) * 2];
}
export function makeOverlay(type, overrides = {}) {
    return { id: `layer-${Date.now()}-${++nextId}`, type, text: 'Tvoj tekst', assetId: null, x: 50, y: 82, size: type === 'text' ? 5 : 18, opacity: 1, rotation: 0, color: '#ffffff', start: 0, end: null, ...overrides };
}
export function normalizeScreenMotion(value) {
    return { enabled: value?.enabled === true, direction: value?.direction === 'up' ? 'up' : 'down', easing: value?.easing === 'smooth' ? 'smooth' : 'linear', zoom: Number.isFinite(value?.zoom) ? clamp(value.zoom,100,200) : 115 };
}
// Pure timeline sampling: identical at a given scene time in preview, seeking and export.
export function screenSettingsAt(scene, progress) {
    const settings = normalizeScreenSettings(scene.screenAdjust);
    const motion = normalizeScreenMotion(scene.screenMotion);
    if (!motion.enabled) return settings;
    let t = clamp(progress);
    if (motion.easing === 'smooth') t = ease(t);
    settings.image.scroll = motion.direction === 'up' ? 1 - t : t;
    settings.image.scrollDirection = motion.direction;
    settings.image.zoom *= motion.zoom / 100;
    settings.image.fit = 'cover';
    return settings;
}
// Fit and constrain in image-local coordinates, not its rotated bounding box.
// Every viewport corner remains inside the source, including the first/last frame.
export function scrollPlacement(sw, sh, width, height, image) {
    const angle = image.angle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const halfW = (Math.abs(c) * width + Math.abs(s) * height) / 2;
    const halfH = (Math.abs(s) * width + Math.abs(c) * height) / 2;
    const cover = Math.max(2 * halfW / sw, 2 * halfH / sh);
    const scale = Math.max(cover, cover * image.zoom / 100);
    const marginX = Math.max(0, sw * scale / 2 - halfW);
    const marginY = Math.max(0, sh * scale / 2 - halfH);
    const dx = width * image.x / 100;
    const localX = clamp(c * dx, -marginX, marginX);
    // Automatic scrolling always covers the entire image, independent of the
    // manual paused crop. Down starts at the exact top; up starts at the bottom.
    const localY = (1 - 2 * clamp(image.scroll)) * marginY;
    return { scale, x: width / 2 + c * localX - s * localY, y: height / 2 + s * localX + c * localY };
}
export function normalizeScreenSettings(value) {
    const num = (v, fallback, min, max) => Number.isFinite(v) ? clamp(v,min,max) : fallback;
    const image = value?.image || {}, filters = value?.filters || {};
    return {
        image: { zoom: num(image.zoom,100,25,300), x: num(image.x,0,-100,100), y: num(image.y,0,-100,100), angle: num(image.angle,0,-180,180), fit: image.fit === 'contain' ? 'contain' : 'cover' },
        filters: { bri: num(filters.bri,100,0,200), con: num(filters.con,100,0,200), sat: num(filters.sat,100,0,200) },
    };
}
export function validateProject(data) {
    if (!data || ![1,2].includes(data.version) || !Array.isArray(data.scenes) || !data.scenes.length || data.scenes.length > 36) throw new Error('Neispravan promo projekat (1–36 scena).');
    const assets = data.assets || [];
    if (!Array.isArray(assets) || assets.length > 32) throw new Error('Najviše 32 medija u projektu.');
    let bytes = 0; const ids = new Set();
    const cleanAssets = assets.map(a => {
        if (!a || typeof a.id !== 'string' || a.id.length > 100 || ids.has(a.id) || typeof a.data !== 'string' || a.data.length > 70000000) throw new Error('Neispravan medij projekta.');
        const match = /^data:(image\/(png|jpeg|webp|gif|avif)|video\/(mp4|webm|quicktime));base64,/.exec(a.data);
        if (!match || (a.type !== 'image' && a.type !== 'video') || !match[1].startsWith(a.type + '/')) throw new Error('Nepodržan format medija.');
        bytes += a.data.length; if (bytes > 170000000) throw new Error('Mediji projekta su preveliki.');
        ids.add(a.id); return { id: a.id, name: String(a.name || 'Medij').slice(0,100), type: a.type, data: a.data };
    });
    const num = (v, fallback, min, max) => Number.isFinite(v) ? clamp(v,min,max) : fallback;
    const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    const scenes = data.scenes.map(s => {
        if (!s || !Object.hasOwn(SHOTS, s.shot) || !Object.hasOwn(THEMES, s.theme) || !Number.isFinite(s.duration) || s.duration < 1 || s.duration > MAX_SCENE_DURATION || typeof s.title !== 'string' || typeof s.subtitle !== 'string') throw new Error('Neispravna podešavanja scene.');
        if (s.mediaId && !ids.has(s.mediaId)) throw new Error('Nedostaje medij scene.');
        if (s.overlays && (!Array.isArray(s.overlays) || s.overlays.length > 8)) throw new Error('Najviše 8 slojeva po sceni.');
        const overlays = (s.overlays || []).map(o => {
            if (!o || !['text','image'].includes(o.type) || (o.type === 'image' && !cleanAssets.some(a => a.id === o.assetId && a.type === 'image'))) throw new Error('Neispravan overlay sloj.');
            const start = num(o.start,0,0,s.duration);
            return makeOverlay(o.type, { text: String(o.text || '').slice(0,200), assetId: o.type === 'image' ? o.assetId : null, x: num(o.x,50,0,100), y: num(o.y,82,0,100), size: num(o.size,5,1,80), opacity: num(o.opacity,1,0,1), rotation: num(o.rotation,0,-180,180), color: hex(o.color) ? o.color : '#ffffff', start, end: o.end == null ? null : num(o.end,s.duration,start,s.duration) });
        });
        const colors = s.colors ? Object.fromEntries(Object.entries(s.colors).filter(([key,v]) => ['top','bottom','ink','accent','light','frame'].includes(key) && hex(v))) : null;
        const ts = s.textStyle || {};
        const textStyle = { scale: num(ts.scale,100,60,160), y: ts.y == null ? null : num(ts.y,null,5,90), align: ['left','center','right'].includes(ts.align) ? ts.align : 'center', font: ['sans','serif','mono'].includes(ts.font) ? ts.font : 'sans', showTitle: ts.showTitle !== false, showSubtitle: ts.showSubtitle !== false, subtitleScale: num(ts.subtitleScale,100,25,500), subtitleAsTitle: ts.subtitleAsTitle === true };
        return makeScene(s.shot, { phoneCase: s.phoneCase, devicePosition: s.devicePosition, cameraZoom: s.cameraZoom, screenMotion: normalizeScreenMotion(s.screenMotion), screenAdjust: normalizeScreenSettings(s.screenAdjust ?? data.screen), textStyle, duration: s.duration, title: s.title.slice(0,120), subtitle: s.subtitle.slice(0,100), theme: s.theme, transition: s.transition === 'cut' ? 'cut' : 'fade', device: Object.hasOwn(DEVICES,s.device) ? s.device : 'iphone', mediaId: s.mediaId || null, mediaStart: num(s.mediaStart,0,0,36000), lightPower: num(s.lightPower,100,30,200), colors, overlays });
    });
    if (data.image && (typeof data.image !== 'string' || data.image.length > 24000000 || !/^data:image\/(png|jpeg|webp);base64,/.test(data.image))) throw new Error('Neispravna slika u projektu.');
    const format = ['vertical','square','wide'].includes(data.format) ? data.format : 'vertical';
    const quality = ['720','1080','2160'].includes(String(data.quality)) ? String(data.quality) : '720';
    const videoFormat = ['mp4','webm'].includes(data.videoFormat) ? data.videoFormat : 'webm';
    return { scenes, assets: cleanAssets, image: data.image || null, format, quality, videoFormat, screen: data.screen || null };
}
