import { scrollPlacement, caseMaterial } from './promo-core.js';
// Original procedural devices; no third-party laptop assets or model downloads.
export function createPromoDevices(THREE, parent) {
    const groups = {}, displays = {}, shells = [];
    function rounded(w, h, r) {
        const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
        s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
        s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
        s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
    }
    function shell() { const mat = new THREE.MeshStandardMaterial({ color: '#52545b', metalness: .72, roughness: .28 }); shells.push(mat); return mat; }
    const dark = new THREE.MeshStandardMaterial({ color: '#101114', roughness: .45, metalness: .3 });
    function box(g, w, h, d, x, y, z, mat) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mesh.position.set(x, y, z); g.add(mesh); return mesh; }
    function display(g, w, h, x, y, z, radius, resolution) {
        const canvas = document.createElement('canvas'); [canvas.width, canvas.height] = resolution;
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
        const geometry = new THREE.ShapeGeometry(rounded(w, h, radius));
        const uv = geometry.attributes.uv, position = geometry.attributes.position;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (position.getX(i) + w / 2) / w, (position.getY(i) + h / 2) / h);
        const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); g.add(mesh);
        return { canvas, ctx: canvas.getContext('2d'), texture };
    }
    const android = groups.android = new THREE.Group(); parent.add(android);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(1.43, 3, .14), { depth: .12, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 3, steps: 1 }), shell());
    frame.position.z = -.07; android.add(frame);
    displays.android = display(android, 1.34, 2.89, 0, 0, .09, .1, [720, 1554]);
    const camera = new THREE.Mesh(new THREE.CircleGeometry(.032, 24), dark); camera.position.set(0, 1.36, .095); android.add(camera);
    box(android, .025, .24, .05, .74, .55, -.01, dark);
    const laptop = groups.laptop = new THREE.Group(); parent.add(laptop);
    const aluminium = shell();
    const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(3.06, 1.98, .09), { depth: .07, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2 }), aluminium);
    lid.position.set(0, .34, -.07); laptop.add(lid);
    displays.laptop = display(laptop, 2.86, 1.79, 0, .34, .025, .035, [1440, 900]);
    box(laptop, 3.13, .075, 1.85, 0, -.69, .86, aluminium);
    box(laptop, 3, .016, .05, 0, -.64, .07, dark);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 13; col++) box(laptop, .175, .012, .17, -1.2 + col * .2, -.645, .3 + row * .2, dark);
    box(laptop, .9, .009, .42, 0, -.646, 1.45, new THREE.MeshStandardMaterial({ color: '#777c83', metalness: .6, roughness: .35 }));
    const webcam = new THREE.Mesh(new THREE.CircleGeometry(.017, 16), dark); webcam.position.set(0, 1.285, .027); laptop.add(webcam);
    const screen = groups.screen = new THREE.Group(); parent.add(screen);
    displays.screen = display(screen, 2.8, 1.75, 0, 0, .01, .025, [1440, 900]);
    for (const g of Object.values(groups)) g.visible = false;
    let lastKey = '', lastSource = null;
    return {
        show(device, tint, finish = 'original') {
            for (const [id, group] of Object.entries(groups)) group.visible = id === device;
            for (const mat of shells) {
                mat.color.set(tint);
                Object.assign(mat, device === 'android' ? (caseMaterial(finish) || { metalness:.72, roughness:.28 }) : { metalness:.72, roughness:.28 });
            }
        },
        update(device, source, settings, key) {
            const d = displays[device]; if (!d || !source || (key === lastKey && lastSource === source)) return;
            const sw = source.videoWidth || source.width, sh = source.videoHeight || source.height; if (!sw || !sh) return;
            lastKey = key; lastSource = source;
            const { canvas: c, ctx: g } = d, { image, filters } = settings;
            g.clearRect(0, 0, c.width, c.height); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.save();
            const angle = image.angle * Math.PI / 180;
            const rw = Math.abs(sw * Math.cos(angle)) + Math.abs(sh * Math.sin(angle));
            const rh = Math.abs(sw * Math.sin(angle)) + Math.abs(sh * Math.cos(angle));
            const fit = image.fit === 'contain' ? Math.min : Math.max;
            const scroll = Number.isFinite(image.scroll) ? scrollPlacement(sw, sh, c.width, c.height, image) : null;
            const scale = scroll ? scroll.scale : fit(c.width / rw, c.height / rh) * image.zoom / 100;
            g.translate(scroll ? scroll.x : c.width * (.5 + image.x / 100), scroll ? scroll.y : c.height * (.5 + image.y / 100)); g.rotate(angle);
            g.filter = `brightness(${filters.bri / 100}) contrast(${filters.con / 100}) saturate(${filters.sat / 100})`;
            g.drawImage(source, -sw * scale / 2, -sh * scale / 2, sw * scale, sh * scale); g.restore(); d.texture.needsUpdate = true;
        },
    };
}
