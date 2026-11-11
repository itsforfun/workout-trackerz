// ── Turning 3D body on Progress (v1.93) ──
// models/body.glb is built by tools/build-body.py from BodyParts3D (© DBCLS, CC BY 4.0): one mesh per Odyr
// muscle group ('g_ch' …), 'rest' for other muscles and 'bone' for the skeleton. Three.js and the model load
// only when Progress shows the card; the flat body map stays underneath as the fallback (no WebGL, offline
// before the first load, or an error). It turns slowly, can be dragged, pauses off screen, and stands still
// under Reduce Motion. Tapping a muscle opens its exercises.

const THREE_URLS = [
    'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js',
];
const BODY_MODEL_URL = 'models/body.glb';
let threeLoading = null;
let bodyModelLoading = null;
let body3d = null;   // { el, renderer, scene, camera, root, meshes, frame, … } for the card on screen

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Could not load ${src}`));
        document.head.appendChild(s);
    });
}

function loadThree() {
    if (window.THREE && THREE.GLTFLoader) return Promise.resolve();
    if (!threeLoading) {
        threeLoading = loadScriptOnce(THREE_URLS[0]).then(() => loadScriptOnce(THREE_URLS[1]));
        threeLoading.catch(() => { threeLoading = null; });
    }
    return threeLoading;
}

function loadBodyModel() {
    if (!bodyModelLoading) {
        bodyModelLoading = new Promise((resolve, reject) => new THREE.GLTFLoader().load(BODY_MODEL_URL, resolve, undefined, reject));
        bodyModelLoading.catch(() => { bodyModelLoading = null; });
    }
    return bodyModelLoading;
}

function webglAvailable() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
}

// Gold by weight (0 = untrained, 1 = 10+ sets); the abdominal wall carries abs as well as obliques
function body3dColor(weight) {
    const rest = new THREE.Color('#2e2621');
    if (!weight) return rest;
    // 1–2 sets: a dim bronze; 10+ sets: full gold
    return new THREE.Color('#5a4120').lerp(new THREE.Color('#f0c35a'), Math.min(1, weight));
}

function paintBody3d(weights) {
    if (!body3d) return;
    body3d.weights = weights;
    Object.entries(body3d.meshes).forEach(([group, mesh]) => {
        const w = Math.max(weights[group] || 0, group === 'ob' ? weights.ab || 0 : 0);
        mesh.material.color.copy(body3dColor(w));
        mesh.material.emissive.copy(new THREE.Color('#e6b84a')).multiplyScalar(w * w * 0.35);
        mesh.userData.weight = w;
    });
    body3d.dirty = true;
}

async function mountBody3d(el, weights) {
    if (!el || !webglAvailable()) return;
    if (body3d && body3d.el === el) { paintBody3d(weights); return; }
    unmountBody3d();
    try {
        await loadThree();
        const gltf = await loadBodyModel();
        if (!el.isConnected) return;
        buildBody3d(el, gltf.scene.clone(true), weights);
    } catch (e) {
        console.warn('3D body unavailable, keeping the flat map', e);
    }
}

function buildBody3d(el, model, weights) {
    const canvas = document.createElement('canvas');
    canvas.className = 'b3-canvas';
    canvas.setAttribute('aria-label', tr('Your muscles this week, in 3D. Drag to turn, tap a muscle for its exercises.'));
    canvas.setAttribute('role', 'img');
    el.querySelector('.b3-stage').appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    camera.position.set(0, 0.92, 4.1);
    camera.lookAt(0, 0.86, 0);
    scene.add(new THREE.HemisphereLight(0xfff1d6, 0x1a1410, 0.75));
    const key = new THREE.DirectionalLight(0xffe2a8, 0.9);
    key.position.set(-1.5, 2.5, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xe6b84a, 0.55);
    rim.position.set(1.8, 1.2, -2.2);
    scene.add(rim);

    // Gold HUD base: two thin rings under the feet
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe6b84a, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.43, 96), ringMat);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.505, 96, 1, 0, Math.PI * 1.6), ringMat.clone());
    ring2.material.opacity = 0.2;
    ring2.rotation.x = -Math.PI / 2;
    scene.add(ring2);

    const root = new THREE.Group();
    root.add(model);
    scene.add(root);
    const meshes = {};
    model.traverse(obj => {
        if (!obj.isMesh) return;
        obj.geometry.computeVertexNormals();
        const name = obj.name || (obj.parent && obj.parent.name) || '';
        if (name === 'bone') {
            obj.material = new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.9, transparent: true, opacity: 0.16, depthWrite: false });
            obj.renderOrder = 2;
        } else if (name === 'rest') {
            obj.material = new THREE.MeshStandardMaterial({ color: 0x2f2823, roughness: 0.7 });
        } else if (name.startsWith('g_')) {
            obj.material = new THREE.MeshStandardMaterial({ color: 0x2e2621, roughness: 0.62, metalness: 0.12, emissive: 0x000000 });
            obj.userData.group = name.slice(2);
            meshes[name.slice(2)] = obj;
        }
    });

    body3d = { el, renderer, scene, camera, root, meshes, ring2, angle: 0.5, spin: 0, dirty: true, visible: true, last: 0 };
    paintBody3d(weights);
    resizeBody3d();
    el.classList.add('live');

    // Drag to turn; a tap (little movement) picks a muscle
    let down = null;
    canvas.addEventListener('pointerdown', e => {
        down = { x: e.clientX, y: e.clientY, angle: body3d.angle, moved: false };
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - down.x;
        if (Math.abs(dx) > 6) down.moved = true;
        body3d.angle = down.angle + dx * 0.012;
        body3d.spin = 0;
        body3d.dirty = true;
    });
    canvas.addEventListener('pointerup', e => {
        if (down && !down.moved) pickBody3d(e);
        down = null;
        body3d.held = Date.now();
    });
    canvas.addEventListener('pointercancel', () => { down = null; });

    if ('IntersectionObserver' in window) {
        body3d.observer = new IntersectionObserver(entries => {
            if (body3d) body3d.visible = entries[0].isIntersecting;
        });
        body3d.observer.observe(el);
    }
    body3d.onResize = () => resizeBody3d();
    window.addEventListener('resize', body3d.onResize);
    body3d.frame = requestAnimationFrame(tickBody3d);
}

function resizeBody3d() {
    if (!body3d) return;
    const stage = body3d.el.querySelector('.b3-stage');
    const w = stage.clientWidth || 300;
    const h = stage.clientHeight || 360;
    body3d.renderer.setSize(w, h, false);
    body3d.camera.aspect = w / h;
    body3d.camera.updateProjectionMatrix();
    body3d.dirty = true;
}

function tickBody3d(now) {
    if (!body3d) return;
    body3d.frame = requestAnimationFrame(tickBody3d);
    if (!body3d.visible || document.hidden || !body3d.el.isConnected) {
        if (!body3d.el.isConnected) unmountBody3d();
        return;
    }
    const dt = Math.min(0.05, (now - (body3d.last || now)) / 1000);
    body3d.last = now;
    const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resting = body3d.held && Date.now() - body3d.held < 2500;   // a moment's pause after a drag
    if (!still && !resting) {
        body3d.angle += dt * 0.45;   // a full turn every ~14 s
        body3d.ring2.rotation.z -= dt * 0.25;
        body3d.dirty = true;
    }
    if (!body3d.dirty) return;
    body3d.root.rotation.y = body3d.angle;
    body3d.renderer.render(body3d.scene, body3d.camera);
    body3d.dirty = false;
}

function pickBody3d(e) {
    const rect = e.target.getBoundingClientRect();
    const pointer = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, body3d.camera);
    const hit = ray.intersectObjects(Object.values(body3d.meshes), false)[0];
    if (hit && hit.object.userData.group) {
        haptic();
        openExerciseLibrary(hit.object.userData.group);
    }
}

function unmountBody3d() {
    if (!body3d) return;
    cancelAnimationFrame(body3d.frame);
    if (body3d.observer) body3d.observer.disconnect();
    window.removeEventListener('resize', body3d.onResize);
    body3d.scene.traverse(obj => { if (obj.isMesh && obj.material && obj.material.dispose) obj.material.dispose(); });
    body3d.renderer.dispose();
    body3d = null;
}
