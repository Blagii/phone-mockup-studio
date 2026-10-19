import { SHOTS, THEMES, makeScene, makeTemplate, totalDuration, sceneAt, sceneOpacity, validateProject, clamp, ease, DEVICES, styleFor, outputSize, makeOverlay, normalizeScreenSettings, screenSettingsAt, MAX_SCENE_DURATION, poseForScene, normalizeCameraZoom, PHONE_CASES } from './promo-core.js';

import { createMediaLibrary } from './promo-media.js';

export function initPromoStudio(api) {
    const $ = id => document.getElementById(id);
    const panel = $('panel');
    const advanced = document.createElement('details');
    advanced.id = 'promo-advanced';
    advanced.innerHTML = '<summary>Položaj slike i filteri ove scene</summary><div id="mockup-settings"></div>';
    const settings = advanced.lastElementChild;
    while (panel.firstChild) settings.append(panel.firstChild);
    panel.append(advanced);
    const header = document.createElement('header');
    header.id = 'studio-header';
    header.innerHTML = `
        <div class="studio-brand"><span class="brand-mark">p</span>promo<span style="font-weight:400;color:#93a198">studio</span><small>LOCAL EDITOR</small></div>
        <nav class="mode-tabs" aria-label="Editor mode"><button id="mode-quick">Quick mockup</button><button id="mode-promo" class="active">Promo editor</button></nav>
        <div class="header-actions"><button id="promo-open" title="Otvori sačuvani JSON projekat">Otvori</button><button id="promo-save">↓ Sačuvaj projekat</button><button id="promo-export">↗ Export promo</button><button id="promo-cancel" hidden>Otkaži</button></div>`;
    document.body.prepend(header);
    const library = document.createElement('aside');
    library.id = 'promo-library';
    library.innerHTML = `
        <div class="library-heading">Studio scena <span>${Object.keys(SHOTS).length} PRESETA</span></div>
        <p class="promo-intro">Tvoja aplikacija. Filmski kadar.<br>Bez komplikovanih podešavanja.</p>
        <div class="media-bin"><div class="library-heading">Mediji <button id="promo-media-add" title="Dodaj slike ili snimke ekrana">+</button></div><p class="inspector-hint">Prevuci sliku ili video ovde / na pregled.</p><div id="promo-media-list"></div></div>
        <div class="promo-eyebrow">Počni od gotovog promo-a</div>
        <div class="template-picker"><button data-template="launch">✦ Product launch <span>16 s ↗</span></button><button data-template="minimal">◌ Minimal story <span>12 s ↗</span></button><button data-template="showcase">▧ App showcase <span>17 s ↗</span></button></div>
        <div class="promo-eyebrow">Dodaj scenu u svoj promo</div>
        <div class="shot-library" id="shot-library"></div>
        <div class="library-footer">100% u tvom pregledaču.<br>Bez naloga. Bez watermark-a.<br>Video bez zvuka · WebM / MP4</div>`;
    document.body.append(library);
    const player = document.createElement('div');
    player.id = 'promo-player';
    player.innerHTML = `<div class="player-overline"><span>LIVE PREVIEW</span><span id="promo-format-label">9:16 · VERTICAL</span></div><div id="promo-preview-frame"><canvas id="promo-canvas" width="720" height="1280" aria-label="Pregled promo videa"></canvas></div><div class="player-controls"><button id="promo-play" title="Pusti / pauziraj promo" aria-label="Pusti promo">▶</button><input id="promo-seek" aria-label="Pozicija u promo videu" type="range" min="0" max="16" step="0.01" value="0"><span id="promo-clock">00:00 / 00:16</span></div><div id="promo-notice" role="status">Izaberi scenu. Dodaj svoju sliku. Napravi promo.</div>`;
    $('stage').append(player);
    const inspector = document.createElement('section');
    inspector.id = 'promo-inspector';
    inspector.innerHTML = `<div class="inspector-title">Podešavanje scene <b id="promo-scene-index">01 / 05</b></div>
        <p class="scene-edit-hint">Menjaš samo izabranu scenu. Klikni drugu scenu na vremenskoj liniji za njena podešavanja.</p>
        <label>Izabrana scena<select id="promo-scene-picker" aria-label="Izaberi scenu za uređivanje"></select></label>
        <label>Tip scene<select id="promo-shot"></select></label>
        <details id="scene-camera-options"><summary>Zum i položaj uređaja ove scene</summary><label>Pokret<select id="scene-zoom-mode"><option value="off">Bez dodatnog zuma</option><option value="in">Zumiranje · približi</option><option value="out">Odzumiranje · udalji</option><option value="custom">Prilagođeno / statičan zum</option></select></label><div class="promo-row"><label>Početak (%)<input id="scene-zoom-from" type="number" min="25" max="250" step="1" value="100"></label><label>Kraj (%)<input id="scene-zoom-to" type="number" min="25" max="250" step="1" value="130"></label></div><label>Kretanje<select id="scene-zoom-easing"><option value="smooth">Blago ubrzanje</option><option value="linear">Ravnomerno</option></select></label><label>Telefon levo / desno <output id="scene-device-x-value">0</output><input id="scene-device-x" type="range" min="-100" max="100" step="1" value="0"></label><label>Telefon gore / dole <output id="scene-device-y-value">0</output><input id="scene-device-y" type="range" min="-100" max="100" step="1" value="0"></label><button type="button" id="scene-device-reset">Vrati položaj telefona</button><p class="inspector-hint">Pomeranje celog uređaja u kadru radi i sa uvećanim telefonom. Ne pomera sliku unutar ekrana, naslov ili logo. Svaka scena ima svoj položaj.</p><p class="inspector-hint" id="scene-zoom-duration"></p><p class="inspector-hint">Menja veličinu celog uređaja u odnosu na preset, ne slike unutar ekrana. Naslov i logo ostaju na mestu. Ista početna i završna vrednost daju statičan zum.</p></details>
        <div id="title-media-options" hidden><button id="title-media-upload">↑ Dodaj sliku u naslovnu scenu</button><button id="title-media-remove">Ukloni sliku iz naslovne scene</button><p class="inspector-hint">Slika je iza teksta, bez telefona. Položaj, zum, rotaciju i filtere podesi postojećim kontrolama za sliku. Za logo preko teksta koristi Overlay slojeve.</p></div>
        <label>Naslov<textarea id="promo-title" maxlength="120" rows="2"></textarea></label>
        <label>Podnaslov / link<input id="promo-subtitle" maxlength="100"></label>
        <details id="scene-text-options"><summary>Izgled teksta ove scene</summary><div class="promo-row"><label>Font<select id="scene-text-font"><option value="sans">Modern</option><option value="serif">Elegant</option><option value="mono">Mono</option></select></label><label>Poravnanje<select id="scene-text-align"><option value="left">Levo</option><option value="center">Centar</option><option value="right">Desno</option></select></label></div><label>Veličina <span id="scene-text-scale-value">100%</span><input id="scene-text-scale" type="range" min="60" max="160" value="100"></label><label>Položaj po visini (%)<input id="scene-text-y" type="number" min="5" max="90" step="0.5" placeholder="Automatski"></label><label>Veličina podnaslova <span id="scene-text-subtitleScale-value">100%</span><input id="scene-text-subtitleScale" type="range" min="25" max="500" step="5" value="100"></label><label class="scene-toggle"><input id="scene-text-subtitleAsTitle" type="checkbox">Podnaslov kao naslov · velika, podebljana slova</label><label class="scene-toggle"><input id="scene-text-showTitle" type="checkbox" checked>Prikaži naslov</label><label class="scene-toggle"><input id="scene-text-showSubtitle" type="checkbox" checked>Prikaži podnaslov</label><button id="scene-text-reset">Resetuj izgled teksta ove scene</button></details>
        <div class="promo-row"><label>Trajanje (s)<input id="promo-duration" type="number" min="1" max="${MAX_SCENE_DURATION}" step="0.5" value="4"></label><label>Prelaz<select id="promo-transition"><option value="fade">Soft fade</option><option value="cut">Cut</option></select></label></div>
        <label>Paleta pozadine<select id="promo-theme"></select></label>
        <label>Uređaj ove scene<select id="promo-device"></select></label>
        <details id="phone-case-options"><summary>Maskica / okvir telefona</summary><label>Izgled maskice<select id="phone-case-finish"></select></label><label>Gotova boja<select id="phone-case-palette"><option value="custom">Prilagođena boja</option><option value="#202127">Crna</option><option value="#f3eee7">Bela</option><option value="#4266a9">Plava</option><option value="#e89fad">Roze</option><option value="#a8ccb5">Mint</option><option value="#9b86bf">Ljubičasta</option><option value="#ccb078">Zlatna</option></select></label><label>Boja maskice<input id="phone-case-color" type="color" value="#62646b"></label><button id="phone-case-reset" type="button">Vrati originalni okvir</button><p class="inspector-hint">Boja i završna obrada 3D okvira za iPhone i Samsung/Android prikaz. Menja samo ovu scenu, ne sliku ili položaj telefona.</p></details>
        <label>Medij ove scene<select id="promo-media"><option value="">Osnovna slika</option></select></label>
        <button id="promo-upload">↑ Slika / video za ovu scenu</button>
        <button id="promo-media-all">Primeni ovaj medij na sve scene</button>
        <label id="promo-video-trim" hidden>Početak snimka (s)<input id="promo-media-start" type="number" min="0" step="0.1" value="0"></label>
        <p class="inspector-hint" id="promo-media-info">Slike i video do 50 MB. Snimci se ponavljaju bez zvuka. Zum i crop u naprednim podešavanjima važe samo za ovu scenu.</p>
        <details id="scene-scroll-options"><summary>Automatski skrol slike</summary><label class="scene-toggle"><input id="scene-scroll-enabled" type="checkbox">Uključi skrol u ovoj sceni</label><label class="scene-toggle"><input id="scene-scroll-preview" type="checkbox">Prikaži skrol i dok je video pauziran</label><p class="inspector-hint">Isključeno: ručno podešavanje slike. Uključeno: kadar iz animacije. Play i izvoz uvek koriste skrol ako je uključen za scenu.</p><div class="promo-row"><label>Smer<select id="scene-scroll-direction"><option value="down">Nadole · vrh → dno</option><option value="up">Nagore · dno → vrh</option></select></label><label>Kretanje<select id="scene-scroll-easing"><option value="linear">Ravnomerno</option><option value="smooth">Blago ubrzanje</option></select></label></div><label>Dodatni zum za skrol (%)<input id="scene-scroll-zoom" type="number" min="100" max="200" step="5" value="115"></label><p class="inspector-hint" id="scene-scroll-duration"></p><p class="inspector-hint">Skrol uvek kreće od vrha slike (ili od dna za smer nagore), nezavisno od ručnog vertikalnog položaja. Cela putanja traje tačno koliko i scena. Radi na ekranu uređaja, ne pomera naslov ili logo. Koristi Cover; dodatni zum daje prostor za pomeranje kraće slike. Za dugu sliku možeš postaviti 100%. U svim presetima pomeranje, zum i rotacija slike koriste iste kontrole. Dok podešavaš sliku prikazuje se ručni kadar bez skrola, a zum i položaj telefona ostaju nepromenjeni. Play ili vremenska linija ponovo prikazuju animaciju; pri izvozu je skrol uključen. Pomeranje je ograničeno na ivice slike da nema crnih praznina. Za više prostora za horizontalno pomeranje povećaj zum.</p></details>
        <details id="promo-brand"><summary>Boje i osvetljenje</summary><div class="color-grid"><label>Pozadina 1<input type="color" id="brand-top"></label><label>Pozadina 2<input type="color" id="brand-bottom"></label><label>Tekst<input type="color" id="brand-ink"></label><label>Akcenat<input type="color" id="brand-accent"></label><label>Svetlo<input type="color" id="brand-light"></label><label>Okvir uređaja<input type="color" id="brand-frame"></label></div><label>Jačina svetla<input id="promo-light-power" type="range" min="30" max="200" value="100"></label></details>
        <details id="promo-layers"><summary>Overlay slojevi · logo i tekst</summary><div class="promo-row"><button id="layer-add-text">+ Tekst</button><button id="layer-add-image">+ Logo / slika</button></div><select id="layer-select" aria-label="Izabrani overlay sloj"></select><div id="layer-fields" hidden><label id="layer-text-field">Tekst sloja<input id="layer-text" maxlength="200"></label><div class="promo-row"><label>X %<input id="layer-x" type="number" min="0" max="100"></label><label>Y %<input id="layer-y" type="number" min="0" max="100"></label></div><label>Veličina (%)<input id="layer-size" type="range" min="1" max="80" step="0.5"></label><div class="promo-row"><label>Boja<input id="layer-color" type="color"></label><label>Rotacija °<input id="layer-rotation" type="number" min="-180" max="180"></label></div><label>Providnost<input id="layer-opacity" type="range" min="0" max="1" step="0.05"></label><div class="promo-row"><label>Od (s)<input id="layer-start" type="number" min="0" max="${MAX_SCENE_DURATION}" step="0.1"></label><label>Do (s)<input id="layer-end" type="number" min="0" max="${MAX_SCENE_DURATION}" step="0.1" placeholder="Cela scena"></label></div><button id="layer-delete" class="danger">Ukloni sloj</button><p class="inspector-hint">Prevuci sloj direktno na pregledu. Najviše 8 slojeva po sceni.</p></div></details>
        <div class="promo-row"><button id="promo-duplicate">Dupliraj</button><button id="promo-remove" class="danger">Ukloni</button></div>
        <div class="promo-row"><button id="promo-move-left" title="Pomeri scenu ulevo">← Levo</button><button id="promo-move-right" title="Pomeri scenu udesno">Desno →</button></div>
        <hr class="promo-section-line"><div class="promo-eyebrow">Video izlaz</div>
        <div class="promo-row"><label>Format<select id="promo-ratio"><option value="vertical">9:16 · Reels / Story</option><option value="square">1:1 · Feed</option><option value="wide">16:9 · Landscape</option></select></label><label>Kvalitet<select id="promo-quality"><option value="720">720p · Brže</option><option value="1080">1080p · Full HD</option><option value="2160">4K · 2160p</option></select></label></div>
        <p class="inspector-hint" id="promo-export-size"></p><p class="inspector-hint">Cilj: 30 FPS · bez zvuka. 4K zahteva jači računar. Izvoz traje koliko i promo. Drži ovu karticu otvorenom tokom snimanja.</p>`;
    panel.prepend(inspector);
    const timeline = document.createElement('section');
    timeline.id = 'promo-timeline';
    timeline.innerHTML = `<div class="timeline-heading"><div>Vremenska linija <small id="promo-total">5 scena · 16 s</small></div><button id="promo-restart">↺ Od početka</button></div><div id="promo-scenes" aria-label="Scene promo videa"></div><div class="timeline-help">Klikni scenu za izmenu · Prevuci za promenu redosleda · Ili koristi ← Levo / Desno →</div>`;
    document.body.append(timeline);
    const projectInput = document.createElement('input');
    projectInput.type = 'file'; projectInput.accept = '.json,application/json'; projectInput.hidden = true;
    document.body.append(projectInput);
    let scenes = makeTemplate(), selected = scenes[0].id, currentTime = 0, playing = false, active = false;
    let editingScreen = true;
    let lastNow = 0, frameState = null, recording = null, defaultImage = 'default-screenshot.jpg';
    let media = createMediaLibrary(), mediaBusy = false, layerId = null, layerBounds = [], dragLayer = null;
    const mediaInput = document.createElement('input'); mediaInput.type = 'file'; mediaInput.accept = 'image/*,video/mp4,video/webm,video/quicktime'; mediaInput.multiple = true; mediaInput.hidden = true; document.body.append(mediaInput);
    const logoInput = document.createElement('input'); logoInput.type = 'file'; logoInput.accept = 'image/*'; logoInput.hidden = true; document.body.append(logoInput);
    const canvas = $('promo-canvas'), ctx = canvas.getContext('2d', { alpha: false });
    const notice = text => { $('promo-notice').textContent = text; };
    const duration = () => totalDuration(scenes);
    const chosen = () => scenes.find(s => s.id === selected) || scenes[0];
    const previewOffset = scene => scene.transition === 'cut' ? 0 : Math.min(.5, scene.duration / 2);
    const sceneStart = id => { let t = 0; for (const s of scenes) { if (s.id === id) return t; t += s.duration; } return 0; };
    const timeLabel = time => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
    const announce = () => { $('promo-total').textContent = `${scenes.length} scena · ${Number(duration().toFixed(1))} s`; $('promo-seek').max = duration(); };
    function setScreenEditing(value) { editingScreen = value; $('scene-scroll-preview').checked = !value; }
    const setPlaying = value => { if (value) setScreenEditing(false); if (!value) media.pause(); playing = value; lastNow = 0; $('promo-play').textContent = value ? 'Ⅱ' : '▶'; $('promo-play').setAttribute('aria-label', value ? 'Pauziraj promo' : 'Pusti promo'); };
    function art(scene) {
        const el = document.createElement('div');
        el.className = 'shot-art shot-' + scene.shot;
        const theme = styleFor(scene);
        el.style.background = `linear-gradient(140deg,${theme.top},${theme.bottom})`;
        el.style.color = theme.ink;
        if (scene.shot === 'title' || scene.shot === 'cta') {
            const text = document.createElement('span'); text.className = 'mini-title'; text.textContent = scene.title; el.append(text);
        } else {
            const phone = document.createElement('div'); phone.className = 'mini-phone device-' + scene.device;
            const image = document.createElement('img'); image.src = media.assets.get(scene.mediaId)?.poster || defaultImage; image.alt = ''; phone.append(image); el.append(phone);
        }
        return el;
    }
    function renderLibrary() {
        const root = $('shot-library'); root.replaceChildren();
        for (const [shot, info] of Object.entries(SHOTS)) {
            const button = document.createElement('button'); button.className = 'shot-card'; button.title = info.hint + ' Klikni za dodavanje.'; button.setAttribute('aria-label', 'Dodaj scenu: ' + info.name);
            const artwork = art(makeScene(shot));
            const tag = document.createElement('span'); tag.className = 'shot-tag'; tag.textContent = info.tag; artwork.append(tag);
            const label = document.createElement('span'); label.className = 'shot-label'; label.textContent = info.name;
            button.append(artwork, label); button.onclick = () => addScene(shot); root.append(button);
        }
    }
    function renderTimeline() {
        const root = $('promo-scenes'); root.replaceChildren();
        scenes.forEach((scene, index) => {
            const button = document.createElement('button'); button.className = 'timeline-scene' + (scene.id === selected ? ' active' : ''); button.dataset.id = scene.id; button.draggable = true;
            button.setAttribute('aria-label', `Scena ${index + 1}: ${SHOTS[scene.shot].name}`); button.setAttribute('aria-pressed', String(scene.id === selected));
            const number = document.createElement('span'); number.className = 'scene-number'; number.textContent = String(index + 1).padStart(2, '0');
            const edit = document.createElement('span'); edit.className = 'scene-edit-badge'; edit.textContent = 'Uredi';
            const caption = document.createElement('div'); caption.className = 'scene-caption';
            const name = document.createElement('span'); name.textContent = scene.title.replace(/\n/g, ' ') || SHOTS[scene.shot].name; name.title = 'Uredi tekst i podešavanja ove scene';
            const seconds = document.createElement('b'); seconds.textContent = scene.duration + ' s'; caption.append(name, seconds);
            button.append(number, edit, art(scene), caption); button.onclick = () => selectScene(scene.id);
            button.ondragstart = e => { e.dataTransfer.setData('text/plain', scene.id); e.dataTransfer.effectAllowed = 'move'; };
            button.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
            button.ondrop = e => {
                e.preventDefault(); const from = scenes.findIndex(s => s.id === e.dataTransfer.getData('text/plain'));
                if (from < 0 || recording) return;
                const [moved] = scenes.splice(from, 1); scenes.splice(index, 0, moved); selected = moved.id; changed(); selectScene(selected);
            };
            root.append(button);
        });
        const plus = document.createElement('button'); plus.id = 'promo-add'; plus.textContent = '+'; plus.title = 'Dodaj Hero scenu'; plus.onclick = () => addScene('hero'); root.append(plus);
        const picker = $('promo-scene-picker'); picker.replaceChildren();
        scenes.forEach((s,i) => picker.append(new Option(`${i + 1}. ${s.title.replace(/\n/g,' ') || SHOTS[s.shot].name}`,s.id)));
        picker.value = selected;
        $('scene-scroll-duration').textContent = `Sinhronizovano sa scenom: ${chosen().duration} s · početak → kraj`;
        $('scene-zoom-duration').textContent = `Zum prati celu scenu: ${chosen().duration} s`;
        announce();
    }
    function syncInspector() {
        const scene = chosen();
        $('promo-scene-index').textContent = `${String(scenes.indexOf(scene) + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
        for (const key of ['shot', 'title', 'subtitle', 'duration', 'transition', 'theme']) $('promo-' + key).value = scene[key];
        syncMediaControls(); syncLayers(); syncTextStyle(); syncScreenMotion(); syncCameraZoom();
        api.syncScreenControls(scene.screenAdjust);
        for (const key of ['top','bottom','ink','accent','light','frame']) $('brand-' + key).value = styleFor(scene)[key];
        $('promo-light-power').value = scene.lightPower; $('promo-device').value = scene.device; syncPhoneCase();
        $('promo-remove').disabled = scenes.length === 1;
        $('promo-move-left').disabled = scenes.indexOf(scene) === 0;
        $('promo-move-right').disabled = scenes.indexOf(scene) === scenes.length - 1;
    }
    function selectScene(id) {
        if (recording) return;
        setScreenEditing(true); selected = id; layerId = null; media.pause(); setPlaying(false);
        // Cut scenes show the actual first frame; fade scenes start just past the fade.
        currentTime = sceneStart(id) + previewOffset(chosen());
        syncInspector(); renderTimeline();
        panel.scrollTop = 0;
    }
    function changed() { currentTime = clamp(currentTime, 0, duration()); renderTimeline(); syncInspector(); }
    function addScene(shot) {
        if (recording) return;
        if (scenes.length >= 36) { notice('Najviše 36 scena u jednom promo-u.'); return; }
        const scene = makeScene(shot); const at = scenes.findIndex(s => s.id === selected);
        scenes.splice(at + 1, 0, scene); selectScene(scene.id); notice('Scena je dodata. Izmeni tekst ili dodaj sledeću.');
    }
    for (const [id, items] of [['promo-shot', SHOTS], ['promo-theme', THEMES]]) {
        for (const [value, item] of Object.entries(items)) { const option = document.createElement('option'); option.value = value; option.textContent = item.name; $(id).append(option); }
    }
    for (const key of ['shot', 'title', 'subtitle', 'duration', 'transition', 'theme']) {
        $('promo-' + key).addEventListener('input', e => {
            if (recording) return;
            if (key === 'duration') {
                const value = Number(e.target.value);
                if (!e.target.checkValidity() || value < 1 || value > MAX_SCENE_DURATION) return;
                chosen()[key] = value;
                $('layer-start').max = value; $('layer-end').max = value;
            } else chosen()[key] = e.target.value;
            if (key === 'shot' && ['zoomin','zoomout'].includes(chosen().shot)) {
                chosen().cameraZoom = normalizeCameraZoom(chosen().shot === 'zoomin' ? { enabled:true, from:70, to:110 } : { enabled:true, from:110, to:70 });
                syncCameraZoom(); $('scene-camera-options').open = true;
            }
            if (key === 'shot' && chosen().shot === 'staticScroll') {
                const preset = makeScene('staticScroll');
                chosen().cameraZoom = preset.cameraZoom; chosen().screenMotion = preset.screenMotion; chosen().transition = 'cut';
                syncCameraZoom(); syncScreenMotion(); $('promo-transition').value = 'cut'; $('scene-scroll-options').open = true;
            }
            if (key === 'theme') { chosen().colors = null; for (const k of ['top','bottom','ink','accent','light','frame']) $('brand-' + k).value = styleFor(chosen())[k]; }
            setPlaying(false); currentTime = sceneStart(selected) + previewOffset(chosen());
            if (key === 'shot') { syncMediaControls(); syncPhoneCase(); }
            if (key === 'theme') syncPhoneCase();
            renderTimeline();
        });
    }
    function syncCameraZoom() {
        const zoom = chosen().cameraZoom;
        for (const axis of ['x','y']) {
            $('scene-device-' + axis).value = chosen().devicePosition[axis];
            $('scene-device-' + axis + '-value').textContent = chosen().devicePosition[axis];
        }
        $('scene-zoom-mode').value = !zoom.enabled ? 'off' : zoom.from < zoom.to ? 'in' : zoom.from > zoom.to ? 'out' : 'custom';
        for (const key of ['from','to','easing']) $('scene-zoom-' + key).value = zoom[key];
        for (const key of ['from','to','easing']) $('scene-zoom-' + key).disabled = !zoom.enabled;
        $('scene-zoom-duration').textContent = `Zum prati celu scenu: ${chosen().duration} s`;
    }
    function previewCameraChange() { setPlaying(false); currentTime = sceneStart(selected) + previewOffset(chosen()); }
    $('scene-zoom-mode').onchange = e => {
        if (recording) return;
        const mode = e.target.value, zoom = chosen().cameraZoom;
        zoom.enabled = mode !== 'off';
        if (mode === 'in') { zoom.from = 70; zoom.to = 110; }
        if (mode === 'out') { zoom.from = 110; zoom.to = 70; }
        if (mode === 'custom') zoom.to = zoom.from;
        syncCameraZoom(); previewCameraChange();
    };
    for (const key of ['from','to','easing']) $('scene-zoom-' + key).oninput = e => {
        if (recording || !e.target.checkValidity() || e.target.value === '') return;
        chosen().cameraZoom[key] = key === 'easing' ? e.target.value : Number(e.target.value);
        previewCameraChange();
    };
    for (const axis of ['x','y']) $('scene-device-' + axis).oninput = e => {
        if (recording || !e.target.checkValidity()) return;
        chosen().devicePosition[axis] = Number(e.target.value);
        $('scene-device-' + axis + '-value').textContent = e.target.value;
        // Keep the current zoom/time so positioning does not jump to another frame.
        setPlaying(false);
    };
    $('scene-device-reset').onclick = () => {
        if (recording) return;
        chosen().devicePosition = { x: 0, y: 0 };
        syncCameraZoom(); setPlaying(false);
    };
    $('scene-scroll-preview').onchange = e => {
        if (recording) return;
        setPlaying(false); setScreenEditing(!e.target.checked);
    };
    function syncScreenMotion() {
        const motion = chosen().screenMotion;
        $('scene-scroll-enabled').checked = motion.enabled;
        for (const key of ['direction','easing','zoom']) $('scene-scroll-' + key).value = motion[key];
        $('scene-scroll-duration').textContent = `Sinhronizovano sa scenom: ${chosen().duration} s · početak → kraj`;
    }
    for (const key of ['enabled','direction','easing','zoom']) $('scene-scroll-' + key).oninput = e => {
        if (recording || !e.target.checkValidity()) return;
        chosen().screenMotion[key] = key === 'enabled' ? e.target.checked : key === 'zoom' ? Number(e.target.value) : e.target.value;
        setPlaying(false);
        currentTime = sceneStart(selected) + previewOffset(chosen());
    };
    $('promo-scene-picker').onchange = e => selectScene(e.target.value);
    function syncTextStyle() {
        const style = chosen().textStyle;
        for (const key of ['scale','y','align','font','subtitleScale']) $('scene-text-' + key).value = style[key] ?? '';
        for (const key of ['showTitle','showSubtitle','subtitleAsTitle']) $('scene-text-' + key).checked = style[key];
        $('scene-text-scale-value').textContent = style.scale + '%';
        $('scene-text-subtitleScale-value').textContent = style.subtitleScale + '%';
    }
    for (const key of ['scale','y','align','font','showTitle','showSubtitle','subtitleScale','subtitleAsTitle']) $('scene-text-' + key).oninput = e => {
        if (recording || !e.target.checkValidity()) return;
        const style = chosen().textStyle;
        style[key] = (key.startsWith('show') || key === 'subtitleAsTitle') ? e.target.checked : key === 'y' ? e.target.value === '' ? null : Number(e.target.value) : (key === 'scale' || key === 'subtitleScale') ? Number(e.target.value) : e.target.value;
        $('scene-text-scale-value').textContent = style.scale + '%';
        $('scene-text-subtitleScale-value').textContent = style.subtitleScale + '%';
        setPlaying(false); currentTime = sceneStart(selected) + previewOffset(chosen());
    };
    $('scene-text-reset').onclick = () => {
        chosen().textStyle = { scale: 100, y: null, align: 'center', font: 'sans', showTitle: true, showSubtitle: true, subtitleScale: 100, subtitleAsTitle: false };
        syncTextStyle();
    };
    $('promo-duplicate').onclick = () => {
        if (scenes.length >= 36) return notice('Najviše 36 scena.');
        const original = chosen(); const { id, ...data } = original; const copy = makeScene(original.shot, { ...data, textStyle: { ...data.textStyle }, colors: data.colors ? { ...data.colors } : null, overlays: data.overlays.map(o => { const { id, ...values } = o; return makeOverlay(o.type, values); }) });
        scenes.splice(scenes.indexOf(original) + 1, 0, copy); selectScene(copy.id);
    };
    $('promo-remove').onclick = () => { if (scenes.length === 1) return; const i = scenes.indexOf(chosen()); scenes.splice(i, 1); selectScene(scenes[Math.min(i, scenes.length - 1)].id); };
    function move(delta) { const i = scenes.indexOf(chosen()), next = i + delta; if (next < 0 || next >= scenes.length) return; [scenes[i], scenes[next]] = [scenes[next], scenes[i]]; selectScene(selected); }
    $('promo-move-left').onclick = () => move(-1); $('promo-move-right').onclick = () => move(1);
    document.querySelectorAll('[data-template]').forEach(button => { button.onclick = () => {
        if (recording || !confirm('Zameni trenutne scene gotovim promo šablonom? Slika ostaje sačuvana.')) return;
        scenes = makeTemplate(button.dataset.template); selected = scenes[0].id; currentTime = .5; setPlaying(false); changed(); notice('Promo je spreman. Ubaci sliku i prilagodi tekst.');
    }; });
    $('promo-upload').onclick = () => mediaInput.click();
    $('promo-media-add').onclick = () => mediaInput.click();
    $('promo-play').onclick = () => {
        if (!playing && editingScreen && chosen().screenMotion.enabled) currentTime = sceneStart(selected);
        else if (currentTime >= duration()) currentTime = 0;
        setPlaying(!playing);
    };
    $('promo-restart').onclick = () => { if (recording) return; currentTime = 0; setPlaying(true); };
    $('promo-seek').oninput = e => { if (recording) return; setPlaying(false); setScreenEditing(false); currentTime = +e.target.value; };
    const ratios = { vertical: [9, 16], square: [1, 1], wide: [16, 9] };
    function layoutPreview() {
        const [w,h] = ratios[$('promo-ratio').value];
        const width = Math.max(1, Math.min(player.clientWidth - 32, Math.max(100, player.clientHeight - 115) * w / h));
        const frame = $('promo-preview-frame'); frame.style.width = width + 'px'; frame.style.height = width * h / w + 'px';
    }
    function resizeOutput() {
        const [w, h] = ratios[$('promo-ratio').value];
        // Preview stays lightweight. Export alone allocates the selected native resolution.
        [canvas.width, canvas.height] = outputSize($('promo-ratio').value, '720');
        const [ow, oh] = outputSize($('promo-ratio').value, $('promo-quality').value);
        $('promo-export-size').textContent = `Izvoz: ${ow} × ${oh} px`;
        $('promo-preview-frame').style.aspectRatio = `${w} / ${h}`;
        $('promo-format-label').textContent = `${w}:${h} · ${w < h ? 'VERTICAL' : w === h ? 'SQUARE' : 'LANDSCAPE'}`;
        layoutPreview();
        if (active) api.setAspect(w / h);
    }
    $('promo-ratio').onchange = resizeOutput; $('promo-quality').onchange = resizeOutput;
    // Keep completed files reachable even if async/embedded automatic downloads
    // are blocked. Replacing a slot releases only that slot's old Blob URL.
    const downloads = new Map();
    const downloadPanel = document.createElement('section');
    downloadPanel.id = 'promo-downloads'; downloadPanel.hidden = true;
    downloadPanel.setAttribute('aria-label', 'Fajlovi spremni za preuzimanje');
    downloadPanel.innerHTML = '<div class="download-heading"><strong>Spremno za preuzimanje</strong><button type="button" aria-label="Zatvori preuzimanja">×</button></div><p>Ako preuzimanje nije počelo, klikni na fajl ispod.</p><div id="promo-download-links"></div>';
    downloadPanel.querySelector('button').onclick = () => { downloadPanel.hidden = true; };
    document.body.append(downloadPanel);
    if (window.self !== window.top) {
        const standalone = document.createElement('a');
        standalone.href = window.location.href; standalone.target = '_blank'; standalone.rel = 'noopener';
        standalone.textContent = 'Ako pregled blokira preuzimanja, otvori aplikaciju u novoj kartici.';
        standalone.className = 'download-standalone'; downloadPanel.append(standalone);
    }
    function download(blob, name) {
        const slot = blob.type === 'application/json' ? 'project' : 'video';
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = name; a.className = 'promo-file-download';
        a.dataset.file = slot;
        a.textContent = `↓ ${slot === 'project' ? 'Preuzmi projekat' : 'Preuzmi promo video'} · ${(blob.size / 1024 / 1024).toFixed(2)} MB`;
        const previous = downloads.get(slot);
        if (previous) { previous.link.remove(); URL.revokeObjectURL(previous.url); }
        downloads.set(slot, { url, link:a });
        $('promo-download-links').append(a); downloadPanel.hidden = false;
        // A real, persistent link remains available regardless of this attempt.
        try { a.click(); } catch (error) { console.warn('Automatsko preuzimanje je blokirano; koristi link za fajl.', error); }
    }
    $('promo-save').onclick = async () => {
        if (recording || mediaBusy) return notice('Sačekaj da se mediji učitaju.');
        const button = $('promo-save'); button.disabled = true; notice('Priprema projekta i medija za čuvanje…');
        try {
            const project = { version: 2, scenes: structuredClone(scenes), image: api.getImageData(), format: $('promo-ratio').value, quality: $('promo-quality').value, screen: api.getScreenSettings() };
            project.assets = await media.serialize();
            download(new Blob([JSON.stringify(project)], { type: 'application/json' }), 'promo-studio.json');
            notice('Projekat je spreman. Ako preuzimanje nije počelo, klikni „Preuzmi projekat“.');
        } catch (error) { console.error('Čuvanje projekta:', error); notice(`Čuvanje projekta nije uspelo: ${error.message || 'pokušaj sa manjim medijima'}`); }
        finally { button.disabled = !!recording; }
    };
    $('promo-open').onclick = () => projectInput.click();
    projectInput.onchange = async () => {
        const file = projectInput.files[0]; projectInput.value = ''; if (!file || recording || mediaBusy) return;
        if (file.size > 185000000) return notice('Projekat je prevelik (maks. 185 MB).');
        const incoming = createMediaLibrary(); mediaBusy = true; setPlaying(false); notice('Otvaranje projekta i medija…');
        try {
            const project = validateProject(JSON.parse(await file.text()));
            for (const asset of project.assets) await incoming.add(await (await fetch(asset.data)).blob(), asset.name, asset.id);
            for (const s of project.scenes) { const asset = incoming.assets.get(s.mediaId); if (asset?.type === 'video') s.mediaStart = Math.min(s.mediaStart, Math.max(0, asset.duration - .01)); }
            api.loadScreenSettings(project.screen);
            if (project.image) await api.loadImageData(project.image);
            media.clear(); media = incoming;
            $('promo-ratio').value = project.format; $('promo-quality').value = project.quality; resizeOutput();
            setScreenEditing(true); scenes = project.scenes; selected = scenes[0].id; layerId = null; currentTime = previewOffset(chosen()); setPlaying(false); renderMedia(); changed(); notice('Projekat je otvoren sa svim medijima i slojevima.');
        } catch (error) { incoming.clear(); notice(error.message || 'Ne mogu da otvorim projekat.'); }
        finally { mediaBusy = false; }
    };
    function syncMediaControls() {
        const select = $('promo-media'); select.replaceChildren();
        const base = new Option('Osnovna slika', ''); select.append(base);
        for (const asset of media.assets.values()) select.append(new Option(`${asset.type === 'video' ? '▶ ' : '▧ '}${asset.name}`, asset.id));
        const scene = chosen(), asset = media.assets.get(scene.mediaId);
        const titleScene = scene.shot === 'title' || scene.shot === 'cta';
        $('title-media-options').hidden = !titleScene;
        $('title-media-remove').disabled = !asset;
        base.textContent = titleScene ? 'Bez slike · samo tekst' : 'Osnovna slika';
        select.value = scene.mediaId || '';
        $('promo-video-trim').hidden = asset?.type !== 'video';
        $('promo-media-start').value = scene.mediaStart;
        $('promo-media-start').max = asset?.type === 'video' ? Math.max(0, asset.duration - .01) : 0;
        $('promo-media-info').textContent = asset ? `${asset.name} · ${asset.width} × ${asset.height}${asset.type === 'video' ? ` · ${asset.duration.toFixed(1)} s · ponavljanje, bez zvuka` : ''}` : 'Slika ili snimak ekrana do 50 MB. Svaka scena može imati svoj medij.';
    }
    function renderMedia() {
        const root = $('promo-media-list'); root.replaceChildren();
        for (const asset of media.assets.values()) {
            const row = document.createElement('div'); row.className = 'media-card';
            const button = document.createElement('button'); button.title = 'Primeni na izabranu scenu: ' + asset.name;
            const image = document.createElement('img'); image.src = asset.poster; image.alt = '';
            const label = document.createElement('span'); label.textContent = (asset.type === 'video' ? '▶ ' : '') + asset.name;
            button.append(image, label); button.onclick = () => { if (recording) return; chosen().mediaId = asset.id; chosen().mediaStart = 0; selectScene(selected); notice('Medij je primenjen samo na izabranu scenu.'); };
            const remove = document.createElement('button'); remove.className = 'media-remove'; remove.textContent = '×'; remove.title = 'Ukloni medij';
            remove.onclick = () => {
                if (recording || !confirm('Ukloni ovaj medij iz projekta? Scene će koristiti osnovnu sliku, a povezani logo slojevi će biti uklonjeni.')) return;
                for (const s of scenes) { if (s.mediaId === asset.id) { s.mediaId = null; s.mediaStart = 0; } s.overlays = s.overlays.filter(o => o.assetId !== asset.id); }
                media.remove(asset.id); renderMedia(); changed();
            };
            row.append(button, remove); root.append(row);
        }
        syncMediaControls();
    }
    async function importFiles(files, asLogo = false) {
        if (recording || mediaBusy || !files.length) return;
        if (asLogo && chosen().overlays.length >= 8) return notice('Najviše 8 slojeva po sceni.');
        mediaBusy = true; setPlaying(false); const target = chosen(); notice('Učitavanje medija…');
        try {
            let first = true;
            for (const file of [...files].slice(0, asLogo ? 1 : 32)) {
                if (media.assets.size >= 32) throw new Error('Najviše 32 medija u projektu.');
                if (asLogo && !file.type.startsWith('image/')) throw new Error('Za logo izaberi sliku.');
                const asset = await media.add(file, file.name);
                if (first) {
                    if (asLogo) { const layer = makeOverlay('image', { assetId: asset.id }); target.overlays.push(layer); layerId = layer.id; }
                    else { target.mediaId = asset.id; target.mediaStart = 0; }
                }
                first = false;
            }
            renderMedia(); renderLibrary(); changed();
            if (asLogo) $('promo-layers').open = true;
            notice(asLogo ? 'Logo je dodat. Prevuci ga na pregledu ili podesi X/Y.' : 'Medij je dodat izabranoj sceni. Klikni medij u biblioteci za korišćenje u drugoj sceni.');
        } catch (error) { renderMedia(); changed(); notice(error.message); }
        finally { mediaBusy = false; }
    }
    $('title-media-upload').onclick = () => mediaInput.click();
    $('title-media-remove').onclick = () => {
        if (recording) return;
        chosen().mediaId = null; chosen().mediaStart = 0;
        selectScene(selected); notice('Slika je uklonjena samo iz ove scene.');
    };
    mediaInput.onchange = () => { const files = [...mediaInput.files]; mediaInput.value = ''; importFiles(files); };
    logoInput.onchange = () => { const files = [...logoInput.files]; logoInput.value = ''; importFiles(files, true); };
    $('promo-media').onchange = e => { chosen().mediaId = e.target.value || null; chosen().mediaStart = 0; selectScene(selected); };
    $('promo-media-start').oninput = e => { if (!e.target.checkValidity()) return; chosen().mediaStart = +e.target.value; setPlaying(false); };
    $('promo-media-all').onclick = () => { if (recording) return; for (const s of scenes) { s.mediaId = chosen().mediaId; s.mediaStart = chosen().mediaStart; } renderTimeline(); notice('Izabrani medij je primenjen na sve scene.'); };
    for (const [value, label] of Object.entries(DEVICES)) $('promo-device').append(new Option(label, value));
    $('promo-device').onchange = e => { chosen().device = e.target.value; setPlaying(false); syncPhoneCase(); renderTimeline(); };
    for (const key of ['top','bottom','ink','accent','light','frame']) $('brand-' + key).oninput = e => {
        chosen().colors = { ...(chosen().colors || {}), [key]: e.target.value }; if (key === 'frame') syncPhoneCase(); renderTimeline();
    };
    for (const [value,label] of Object.entries(PHONE_CASES)) $('phone-case-finish').append(new Option(label,value));
    function syncPhoneCase() {
        const scene = chosen(), color = styleFor(scene).frame;
        $('phone-case-options').hidden = !['iphone','android'].includes(scene.device) || ['title','cta'].includes(scene.shot);
        $('phone-case-finish').value = scene.phoneCase.finish;
        $('phone-case-color').value = color;
        $('phone-case-palette').value = [...$('phone-case-palette').options].some(o=>o.value===color) ? color : 'custom';
    }
    function changeCaseColor(color) {
        if (recording) return;
        chosen().colors = { ...(chosen().colors || {}), frame:color };
        $('brand-frame').value = color; syncPhoneCase(); setPlaying(false); renderTimeline();
    }
    $('phone-case-finish').onchange = e => { if (recording) return; chosen().phoneCase.finish = e.target.value; setPlaying(false); };
    $('phone-case-color').oninput = e => changeCaseColor(e.target.value);
    $('phone-case-palette').onchange = e => { if (e.target.value !== 'custom') changeCaseColor(e.target.value); };
    $('phone-case-reset').onclick = () => { if (recording) return; chosen().phoneCase = { finish:'original' }; changeCaseColor('#62646b'); };
    $('promo-light-power').oninput = e => { chosen().lightPower = +e.target.value; };
    document.body.addEventListener('dragover', e => {
        if (!active || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault(); e.stopImmediatePropagation(); player.classList.add('media-drag-over');
    }, true);
    document.body.addEventListener('dragleave', e => { if (!e.relatedTarget) player.classList.remove('media-drag-over'); }, true);
    document.body.addEventListener('drop', e => {
        if (!active || !e.dataTransfer.files.length) return;
        if ([...e.dataTransfer.files].every(f => f.name.toLowerCase().endsWith('.glb'))) return;
        e.preventDefault(); e.stopImmediatePropagation(); player.classList.remove('media-drag-over');
        importFiles([...e.dataTransfer.files]);
    }, true);
    function selectedLayer() { return chosen().overlays.find(o => o.id === layerId); }
    function syncLayers() {
        $('layer-start').max = chosen().duration; $('layer-end').max = chosen().duration;
        const layers = chosen().overlays, select = $('layer-select'); select.replaceChildren();
        if (!layers.some(o => o.id === layerId)) layerId = layers[0]?.id || null;
        if (!layers.length) select.append(new Option('Nema slojeva', ''));
        for (const [i, layer] of layers.entries()) select.append(new Option(`${i + 1}. ${layer.type === 'text' ? layer.text.slice(0,24) || 'Tekst' : media.assets.get(layer.assetId)?.name || 'Logo'}`, layer.id));
        select.value = layerId || ''; const layer = selectedLayer(); $('layer-fields').hidden = !layer;
        if (!layer) return;
        $('layer-text-field').hidden = layer.type !== 'text';
        for (const key of ['text','x','y','size','opacity','color','rotation','start','end']) $('layer-' + key).value = layer[key] == null ? '' : layer[key];
    }
    $('layer-select').onchange = e => { layerId = e.target.value; syncLayers(); };
    $('layer-add-text').onclick = () => {
        if (chosen().overlays.length >= 8) return notice('Najviše 8 slojeva po sceni.');
        const layer = makeOverlay('text', { color: styleFor(chosen()).ink }); chosen().overlays.push(layer); layerId = layer.id; syncLayers();
    };
    $('layer-add-image').onclick = () => logoInput.click();
    $('layer-delete').onclick = () => { chosen().overlays = chosen().overlays.filter(o => o.id !== layerId); layerId = null; syncLayers(); };
    for (const key of ['text','x','y','size','opacity','color','rotation','start','end']) $('layer-' + key).oninput = e => {
        const layer = selectedLayer(); if (!layer || !e.target.checkValidity()) return;
        layer[key] = ['text','color'].includes(key) ? e.target.value : key === 'end' && e.target.value === '' ? null : Number(e.target.value);
        setPlaying(false);
        if (key === 'text') $('layer-select').selectedOptions[0].textContent = 'Tekst: ' + layer.text.slice(0,24);
    };
    function drawOverlays(scene, local, W, H) {
        layerBounds = [];
        for (const layer of scene.overlays) {
            const end = layer.end == null ? scene.duration : Math.min(scene.duration, layer.end);
            if (local < layer.start || local >= end || end <= layer.start) continue;
            const asset = media.assets.get(layer.assetId), unit = Math.min(W,H);
            const width = W * layer.size / 100;
            let height, actualWidth;
            ctx.save(); ctx.globalAlpha *= layer.opacity * ease(Math.min((local - layer.start) / .15, (end - local) / .15));
            ctx.translate(W * layer.x / 100, H * layer.y / 100); ctx.rotate(layer.rotation * Math.PI / 180);
            if (layer.type === 'image' && asset?.type === 'image') {
                height = Math.min(H * .8, width * asset.height / asset.width); actualWidth = height * asset.width / asset.height;
                ctx.drawImage(asset.element, -actualWidth / 2, -height / 2, actualWidth, height);
            } else if (layer.type === 'text') {
                const font = unit * layer.size / 100; ctx.font = `700 ${font}px system-ui, sans-serif`; ctx.fillStyle = layer.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                actualWidth = Math.min(W * .92, ctx.measureText(layer.text).width); height = font * 1.25;
                ctx.fillText(layer.text, 0, 0, W * .92);
            } else { ctx.restore(); continue; }
            if (!recording && !playing && scene.id === selected && layer.id === layerId) { ctx.strokeStyle = '#77b94b'; ctx.lineWidth = Math.max(1, W / 720); ctx.setLineDash([W / 160, W / 160]); ctx.strokeRect(-actualWidth / 2 - 4, -height / 2 - 4, actualWidth + 8, height + 8); }
            layerBounds.push({ layer, width: actualWidth, height }); ctx.restore();
        }
    }
    canvas.addEventListener('pointerdown', e => {
        if (recording || !frameState || e.button !== 0) return;
        const rect = canvas.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * canvas.width, y = (e.clientY - rect.top) / rect.height * canvas.height;
        for (const bound of [...layerBounds].reverse()) {
            const layer = bound.layer, dx = x - canvas.width * layer.x / 100, dy = y - canvas.height * layer.y / 100, angle = -layer.rotation * Math.PI / 180;
            const lx = dx * Math.cos(angle) - dy * Math.sin(angle), ly = dx * Math.sin(angle) + dy * Math.cos(angle);
            if (Math.abs(lx) > bound.width / 2 + 10 || Math.abs(ly) > bound.height / 2 + 10) continue;
            selected = frameState.scene.id; layerId = layer.id; setPlaying(false); syncInspector(); renderTimeline(); $('promo-layers').open = true;
            dragLayer = { layer, dx, dy }; canvas.setPointerCapture(e.pointerId); e.preventDefault(); break;
        }
    });
    canvas.addEventListener('pointermove', e => {
        if (!dragLayer || recording) return;
        const rect = canvas.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * canvas.width, y = (e.clientY - rect.top) / rect.height * canvas.height;
        dragLayer.layer.x = Math.round(clamp((x - dragLayer.dx) / canvas.width * 100,0,100)); dragLayer.layer.y = Math.round(clamp((y - dragLayer.dy) / canvas.height * 100,0,100)); syncLayers();
    });
    canvas.addEventListener('pointerup', () => { dragLayer = null; }); canvas.addEventListener('pointercancel', () => { dragLayer = null; });

    function textLines(text, maxWidth, fontSize, maxLines, family = "system-ui, sans-serif", weight = 750) {
        ctx.font = `${weight} ${fontSize}px ${family}`;
        const lines = [];
        for (const paragraph of text.split('\n')) {
            let line = '';
            for (const word of paragraph.split(/\s+/)) {
                // Long URLs and unbroken words are wrapped by character too.
                for (const char of (line ? ' ' : '') + word) {
                    if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line.trim()); line = ''; }
                    line += char;
                }
            }
            lines.push(line.trim());
        }
        return lines.slice(0, maxLines);
    }
    function drawTitleMedia(scene, local, W, H) {
        if (!scene.mediaId) return;
        const asset = media.assets.get(scene.mediaId);
        const source = asset?.element;
        if (!source || source.seeking || (asset.type === 'video' && source.readyState < 2)) return;
        const { image, filters } = normalizeScreenSettings(scene.screenAdjust);
        const radians = image.angle * Math.PI / 180;
        const rw = Math.abs(asset.width * Math.cos(radians)) + Math.abs(asset.height * Math.sin(radians));
        const rh = Math.abs(asset.width * Math.sin(radians)) + Math.abs(asset.height * Math.cos(radians));
        const fit = image.fit === 'contain' ? Math.min : Math.max;
        const scale = fit(W / rw, H / rh) * image.zoom / 100;
        ctx.save();
        ctx.filter = `brightness(${filters.bri / 100}) contrast(${filters.con / 100}) saturate(${filters.sat / 100})`;
        ctx.translate(W * (.5 + image.x / 100), H * (.5 + image.y / 100));
        ctx.rotate(radians);
        ctx.drawImage(source, -asset.width * scale / 2, -asset.height * scale / 2, asset.width * scale, asset.height * scale);
        ctx.restore();
    }
    function drawComposition(state) {
        if (!state) return;
        const { scene, progress, local } = state, theme = styleFor(scene);
        const W = canvas.width, H = canvas.height, unit = Math.min(W, H);
        const gradient = ctx.createLinearGradient(0, 0, W, H); gradient.addColorStop(0, theme.top); gradient.addColorStop(1, theme.bottom);
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W * .3, H * .3, 0, W * .3, H * .3, H * .7);
        glow.addColorStop(0, '#ffffff24'); glow.addColorStop(1, '#ffffff00'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalAlpha = sceneOpacity(scene, local);
        const isTitle = scene.shot === 'title' || scene.shot === 'cta';
        if (isTitle) drawTitleMedia(scene, local, W, H);
        if (!isTitle) {
            // Three.js render is transparent, so the same background/text are used in preview and export.
            ctx.drawImage(api.canvas, 0, 0, W, H);
        }
        const textStyle = scene.textStyle;
        const family = { sans: 'system-ui, sans-serif', serif: 'Georgia, serif', mono: 'monospace' }[textStyle.font];
        const fontSize = unit * (isTitle ? .089 : .065) * textStyle.scale / 100;
        const lines = textStyle.showTitle ? textLines(scene.title, W * .82, fontSize, 4, family) : [];
        const lineHeight = fontSize * 1.1;
        let y = H * ((textStyle.y ?? (isTitle ? 45 : 11.5)) / 100);
        if (isTitle && lines.length) y -= (lines.length - 1) * lineHeight / 2;
        y += (1 - ease(Math.min(progress * 4, 1))) * unit * .025;
        const x = textStyle.align === 'left' ? W * .09 : textStyle.align === 'right' ? W * .91 : W / 2;
        ctx.fillStyle = theme.ink; ctx.textAlign = textStyle.align; ctx.textBaseline = 'middle';
        ctx.font = `750 ${fontSize}px ${family}`;
        for (const line of lines) { ctx.fillText(line, x, y, W * .82); y += lineHeight; }
        if (scene.subtitle && textStyle.showSubtitle) {
            const asTitle = textStyle.subtitleAsTitle;
            const small = (asTitle ? fontSize : unit * .022 * textStyle.scale / 100) * textStyle.subtitleScale / 100;
            const weight = asTitle ? 750 : 500;
            const subLines = textLines(scene.subtitle, W * .8, small, asTitle ? 4 : 2, family, weight);
            ctx.font = `${weight} ${small}px ${family}`; ctx.fillStyle = asTitle ? theme.ink : theme.accent;
            if (lines.length) y += fontSize * .4;
            for (const line of subLines) { ctx.fillText(line, x, y, W * .8); y += small * 1.5; }
        }
        drawOverlays(scene, local, W, H);
        ctx.restore();
    }
    function setMode(value) {
        if (recording || api.isRecording()) return;
        if (value === active) return;
        setPlaying(false); media.pause(); active = value;
        document.body.classList.toggle('promo-mode', active);
        $('mode-promo').classList.toggle('active', active); $('mode-quick').classList.toggle('active', !active);
        for (const id of ['promo-export', 'promo-save', 'promo-open']) $(id).hidden = !active;
        advanced.open = !active;
        if (active) { api.enter(); syncInspector(); resizeOutput(); }
        else api.leave();
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    $('mode-promo').onclick = () => setMode(true); $('mode-quick').onclick = () => setMode(false);
    function recordingUI(on) {
        document.body.classList.toggle('promo-recording', on);
        for (const id of ['promo-export', 'promo-save', 'promo-open', 'mode-promo', 'mode-quick', 'promo-play', 'promo-seek', 'promo-restart']) $(id).disabled = on;
        $('promo-cancel').hidden = !on;
    }
    async function exportPromo() {
        if (recording) return;
        if (mediaBusy) return notice('Sačekaj da se mediji učitaju.');
        if (scenes.some(s => s.overlays.some(o => o.start >= s.duration || (o.end != null && o.end <= o.start)))) return notice('Proveri vremena slojeva: početak mora biti pre kraja scene, a kraj posle početka.');
        if (!$('promo-duration').reportValidity()) return notice('Proveri trajanje izabrane scene: 1–120 s, korak 0,5 s.');
        if (chosen().cameraZoom.enabled && (!$('scene-zoom-from').checkValidity() || !$('scene-zoom-to').checkValidity())) {
            $('scene-camera-options').open = true;
            return notice('Proveri zum uređaja: početak i kraj moraju biti celi brojevi od 25 do 250%.');
        }
        if (!api.ready()) return notice('Sačekaj da se 3D model učita.');
        const types = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
        const mime = typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && types.find(type => MediaRecorder.isTypeSupported(type));
        if (!mime || !canvas.captureStream) return notice('Ovaj pregledač ne podržava video izvoz. Probaj Chrome ili Edge.');
        const savedTime = currentTime;
        const [exportWidth, exportHeight] = outputSize($('promo-ratio').value, $('promo-quality').value);
        if (!api.canExport(exportWidth, exportHeight)) return notice('GPU ne podržava ovu rezoluciju. Izaberi 1080p ili 720p.');
        let stream, recorder, start = null, cancel = false, failed = false, done = false, timer;
        const chunks = [];
        const disabled = [...document.querySelectorAll('#panel button, #panel input, #panel select, #panel textarea, #promo-library button')].map(el => [el, el.disabled]);
        function restore() {
            if (done) return; done = true; clearTimeout(timer); stream?.getTracks().forEach(track => track.stop());
            document.removeEventListener('visibilitychange', visibility); recording = null; setPlaying(false); currentTime = savedTime;
            media.pause(); resizeOutput(); api.endExport(); recordingUI(false); disabled.forEach(([el, value]) => { el.disabled = value; });
        }
        function stop(wasCancelled = false) {
            cancel ||= wasCancelled;
            if (recorder && recorder.state !== 'inactive') recorder.stop(); else restore();
        }
        function visibility() { if (document.hidden) { stop(true); notice('Snimanje je otkazano: drži ovu karticu vidljivom.'); } }
        try {
            setPlaying(false); currentTime = 0; recordingUI(true); disabled.forEach(([el]) => { el.disabled = true; });
            document.addEventListener('visibilitychange', visibility);
            recording = { time: () => 0, frame() {}, cancel() { stop(true); notice('Priprema snimanja je otkazana.'); } };
            notice('Priprema video medija…');
            for (const scene of scenes) { if (done) return; await media.prepare(scene.mediaId, scene.mediaStart); }
            if (done) return;
            [canvas.width, canvas.height] = [exportWidth, exportHeight];
            api.beginExport(exportWidth, exportHeight);
            stream = canvas.captureStream(30); recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: $('promo-quality').value === '2160' ? 40000000 : 10000000 });
            recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            recorder.onerror = () => { failed = true; stop(true); notice('Video izvoz nije uspeo. Probaj 720p ili drugi pregledač.'); };
            recorder.onstop = () => {
                restore(); if (cancel || failed) return;
                const blob = new Blob(chunks, { type: recorder.mimeType || mime });
                if (!blob.size) return notice('Pregledač nije snimio video. Probaj 720p ili drugi pregledač.');
                const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'; download(blob, 'moj-promo.' + ext);
                notice(`Video je spreman · ${duration()} s · ${exportWidth} × ${exportHeight} · ${ext.toUpperCase()}. Ako nije preuzet, klikni „Preuzmi promo video“.`);
            };
            recording = {
                get started() { return start !== null; },
                time(now) { return start === null ? 0 : Math.min((now - start) / 1000, duration()); },
                frame() {
                    if (start === null) return;
                    stream.getVideoTracks()[0]?.requestFrame?.();
                    notice(`Snimanje promo-a… ${Math.round(currentTime / duration() * 100)}% · ${timeLabel(currentTime)} / ${timeLabel(duration())}`);
                    if (currentTime >= duration()) stop();
                }, cancel() { stop(true); notice('Snimanje otkazano. Tvoj promo je sačuvan u editoru.'); },
            };
            recorder.onstart = () => {
                if (cancel || failed || done) return;
                start = performance.now(); currentTime = 0;
                stream.getVideoTracks()[0]?.requestFrame?.();
                // Safety timeout: the render loop normally stops just after the final composed frame.
                timer = setTimeout(() => stop(), (duration() + 3) * 1000);
            };
            document.addEventListener('visibilitychange', visibility);
            recorder.start(250); notice('Priprema promo videa…');
        } catch (error) { if (done && cancel) return; failed = true; stop(true); notice('Ne mogu da pokrenem snimanje. Probaj 720p ili drugi pregledač.'); console.error(error); }
    }
    $('promo-export').onclick = exportPromo; $('promo-cancel').onclick = () => recording?.cancel();
    document.addEventListener('visibilitychange', () => { if (document.hidden && !recording) setPlaying(false); });
    renderLibrary(); renderTimeline(); setMode(true); selectScene(scenes[1]?.id || scenes[0].id);
    return {
        get active() { return active; }, get recording() { return !!recording; },
        resize() { if (active) layoutPreview(); if (active && !recording) api.resize(); },
        beforeFrame(now) {
            if (!active) return;
            if (recording) currentTime = recording.time(now);
            else if (playing) { if (lastNow) currentTime += (now - lastNow) / 1000; if (currentTime >= duration()) { currentTime = duration(); setPlaying(false); } }
            lastNow = now; frameState = sceneAt(scenes, currentTime);
            const scene = frameState.scene;
            const source = media.source(scene.mediaId, frameState.local, scene.mediaStart, playing || !!recording?.started);
            const pose = poseForScene(scene, frameState.progress);
            if (source?.seeking) pose.visible = false;
            // Reuse the normal screenshot renderer while adjusting any scene.
            // Manual crop must not pass through the automatic scroll constraints.
            const screenSettings = editingScreen && !playing && !recording
                ? normalizeScreenSettings(scene.screenAdjust) : screenSettingsAt(scene, frameState.progress);
            api.screenFrame(source, scene.device, styleFor(scene), scene.lightPower, screenSettings);
            if (scene.device === 'laptop' || scene.device === 'screen') {
                pose.scale *= Math.min(1.1, (canvas.width / canvas.height) * 1.15);
                pose.y *= .65;
                if (scene.shot === 'closeup') pose.scale *= .75;
            }
            api.pose(pose);
        },
        afterFrame() {
            if (!active) return;
            drawComposition(frameState);
            $('promo-seek').value = currentTime;
            $('promo-clock').textContent = `${timeLabel(currentTime)} / ${timeLabel(duration())}`;
            for (const card of $('promo-scenes').querySelectorAll('.timeline-scene')) card.classList.toggle('current', card.dataset.id === frameState.scene.id);
            recording?.frame();
        },
        onScreenSettingsChanged(value) {
            if (!active || recording) return;
            chosen().screenAdjust = normalizeScreenSettings(value);
            setScreenEditing(true);
            setPlaying(false);
            // Keep the exact device zoom/pose while adjusting its screen image.
            if (sceneAt(scenes, currentTime)?.scene.id !== selected) {
                currentTime = sceneStart(selected) + previewOffset(chosen());
            }
        },
        onImageImported(image) {
            if (active) api.syncScreenControls(chosen().screenAdjust);
            try { const c = document.createElement('canvas'); const scale = Math.min(1, 240 / image.width); c.width = Math.round(image.width * scale); c.height = Math.round(image.height * scale); c.getContext('2d').drawImage(image, 0, 0, c.width, c.height); defaultImage = c.toDataURL('image/jpeg', .7); renderLibrary(); renderTimeline(); notice('Osnovna slika je ažurirana. Scene sa svojim medijem ostaju nepromenjene.'); } catch { notice('Slika je učitana.'); }
        },
    };
}
