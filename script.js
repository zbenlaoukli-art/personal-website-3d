(function () {

const host = document.getElementById("space");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (err) {
  document.documentElement.classList.add("no-webgl");
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.z = 7;

/* ---------- Planet ---------- */
const planetMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec3 vN; varying vec3 vP;
    void main() {
      vN = normalize(normalMatrix * normal);
      vP = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform float uTime; varying vec3 vN; varying vec3 vP;
    float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float noise(vec3 p) {
      vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y),
        f.z);
    }
    float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }
    void main() {
      vec3 p = normalize(vP);
      float n = fbm(p * 4.0 + vec3(0.0, uTime * 0.02, 0.0));
      float bands = sin(p.y * 9.0 + fbm(p * 3.0) * 4.0) * 0.5 + 0.5;
      vec3 deep = vec3(0.12, 0.03, 0.32), mid = vec3(0.48, 0.20, 0.86), hi = vec3(0.85, 0.70, 1.0);
      vec3 col = mix(deep, mid, mix(bands, n, 0.55));
      col = mix(col, hi, smoothstep(0.62, 0.9, n) * 0.5);
      vec3 N = normalize(vN);
      float light = max(dot(N, normalize(vec3(-0.6, 0.4, 0.7))), 0.0);
      float rim = pow(1.0 - max(dot(N, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
      col = col * (0.12 + light * 1.1) + vec3(0.6, 0.3, 1.0) * rim * 0.6;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const planet = new THREE.Mesh(new THREE.SphereGeometry(1.4, 96, 96), planetMat);

/* Glow around the planet */
const glow = new THREE.Mesh(
  new THREE.SphereGeometry(1.7, 64, 64),
  new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
      varying vec3 vN;
      void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vN;
      void main() {
        float i = pow(0.65 - dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(0.55, 0.3, 1.0, 1.0) * i * 1.4;
      }`,
  })
);

/* Ring */
const ring = new THREE.Mesh(
  new THREE.RingGeometry(2.0, 3.2, 128),
  new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vP;
      void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vP;
      void main() {
        float t = (length(vP.xy) - 2.0) / 1.2;
        float bands = 0.5 + 0.5 * sin(t * 42.0);
        float a = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.85, t) * (0.2 + 0.4 * bands);
        gl_FragColor = vec4(0.77, 0.71, 0.99, a);
      }`,
  })
);
ring.rotation.x = -1.25;

const system = new THREE.Group();
system.add(planet, glow, ring);
system.rotation.z = 0.25;
scene.add(system);

/* ---------- Stars ---------- */
const COUNT = 2000;
const pos = new Float32Array(COUNT * 3);
for (let i = 0; i < COUNT; i++) {
  const r = 15 + Math.random() * 35;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  pos[i * 3 + 2] = r * Math.cos(phi);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xd8ccff, size: 0.07, transparent: true, opacity: 0.85, sizeAttenuation: true })
);
scene.add(stars);

/* ---------- Layout, mouse and scroll ---------- */
let baseX = 3, baseY = 0, mouseX = 0, mouseY = 0;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const mobile = w < 800;
  baseX = mobile ? 0 : 3;
  baseY = mobile ? 1.6 : 0;
  system.scale.setScalar(mobile ? 0.65 : 1);
}
window.addEventListener("resize", resize);
window.addEventListener("pointermove", (e) => {
  mouseX = e.clientX / window.innerWidth - 0.5;
  mouseY = e.clientY / window.innerHeight - 0.5;
});
resize();

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();
  const scroll = window.scrollY / window.innerHeight;

  if (!reduceMotion) {
    planet.rotation.y = t * 0.06;
    ring.rotation.z = t * 0.02;
    planetMat.uniforms.uTime.value = t;
  }

  // Scrolling also spins the planet and turns the starfield
  planet.rotation.x = scroll * 0.6;
  planet.rotation.y += scroll * 0.02;
  stars.rotation.y = t * 0.004 * (reduceMotion ? 0 : 1) + scroll * 0.35;
  stars.rotation.x = scroll * 0.15;

  // The planet drifts upward and sideways as you scroll
  system.position.x += (baseX - Math.min(scroll, 3) * 0.5 - system.position.x) * 0.05;
  system.position.y += (baseY + scroll * 1.2 - system.position.y) * 0.05;
  camera.position.x += (mouseX * 0.8 - camera.position.x) * 0.04;
  camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

})();
