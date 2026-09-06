// ============================================================
// 00. IMPORTS
// ============================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";


// ============================================================
// 01. CONFIGURATION
// ============================================================

const CONFIG = {
  modelUrl: new URL("./model.glb", import.meta.url).href,

  // Optional. If you later add environment.hdr beside these files,
  // change this to:
  // hdriUrl: new URL("./environment.hdr", import.meta.url).href,
  hdriUrl: null,

  backgroundColor: 0x111318,
  exposure: 1.05,
  freezeStaticShadows: true
};


// ============================================================
// 02. DOM
// ============================================================

const viewer = document.querySelector("#viewer");
const loadingPanel = document.querySelector("#loadingPanel");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const loadingDetail = document.querySelector("#loadingDetail");
const errorPanel = document.querySelector("#errorPanel");
const errorMessage = document.querySelector("#errorMessage");
const controlHint = document.querySelector("#controlHint");


// ============================================================
// 03. DEVICE / PERFORMANCE SETTINGS
// ============================================================

const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 800;
const mobileLike = coarsePointer || smallScreen;

const maximumPixelRatio = mobileLike ? 1.5 : 2;
const shadowResolution = mobileLike ? 1024 : 2048;


// ============================================================
// 04. SCENE
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.backgroundColor);


// ============================================================
// 05. CAMERA
// ============================================================

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);


// ============================================================
// 06. RENDERER
// ============================================================

let renderer;

try {
  renderer = new THREE.WebGLRenderer({
    antialias: !mobileLike,
    powerPreference: "high-performance"
  });
} catch (error) {
  showFatalError(
    "Your browser or graphics hardware could not create a WebGL renderer.",
    error
  );
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maximumPixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

viewer.appendChild(renderer.domElement);


// ============================================================
// 07. ORBIT CONTROLS
// ============================================================

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enableZoom = true;
controls.enablePan = false;

// Avoid exact pole positions, which can feel like the camera flips.
controls.minPolarAngle = THREE.MathUtils.degToRad(3);
controls.maxPolarAngle = THREE.MathUtils.degToRad(177);


// ============================================================
// 08. LIGHTING
// ============================================================

const hemisphereLight = new THREE.HemisphereLight(
  0xf5f7ff,
  0x353238,
  1.0
);
scene.add(hemisphereLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(shadowResolution, shadowResolution);
keyLight.shadow.bias = -0.0002;
scene.add(keyLight);
scene.add(keyLight.target);


// ============================================================
// 09. OPTIONAL HDRI ENVIRONMENT
// ============================================================

function loadHDRI() {
  if (!CONFIG.hdriUrl) return;

  const loader = new RGBELoader();

  loader.load(
    CONFIG.hdriUrl,
    texture => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
    },
    undefined,
    error => {
      console.warn("HDRI could not be loaded. Continuing without it.", error);
    }
  );
}

loadHDRI();


// ============================================================
// 10. GLB LOADER
// ============================================================

const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();

dracoLoader.setDecoderPath(
  "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/draco/"
);

gltfLoader.setDRACOLoader(dracoLoader);


// ============================================================
// 11. MODEL STATE
// ============================================================

let model = null;
let shadowFramesRemaining = 0;


// ============================================================
// 12. LOAD MODEL
// ============================================================

gltfLoader.load(
  CONFIG.modelUrl,

  // 12A. SUCCESS
  gltf => {
    model = gltf.scene;

    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    scene.add(model);

    try {
      fitCameraToModel(model);
      configureLightingForModel(model);
    } catch (error) {
      loadingPanel.hidden = true;
      showFatalError(
        "The GLB loaded, but its geometry could not be framed correctly.",
        error
      );
      return;
    }

    renderer.shadowMap.autoUpdate = true;
    shadowFramesRemaining = CONFIG.freezeStaticShadows ? 3 : Infinity;

    loadingPanel.hidden = true;
    controlHint.hidden = false;
  },

  // 12B. DOWNLOAD PROGRESS
  event => {
    const loadedMB = event.loaded / 1024 / 1024;

    if (event.lengthComputable && event.total > 0) {
      const percentage = Math.min(
        100,
        Math.round((event.loaded / event.total) * 100)
      );

      progressText.textContent = `${percentage}%`;
      progressBar.style.width = `${percentage}%`;
      progressBar.classList.remove("indeterminate");

      const totalMB = event.total / 1024 / 1024;
      loadingDetail.textContent = `${loadedMB.toFixed(1)} MB of ${totalMB.toFixed(1)} MB`;
    } else {
      progressText.textContent = `${loadedMB.toFixed(1)} MB`;
      progressBar.classList.add("indeterminate");
      loadingDetail.textContent = "Downloading model…";
    }
  },

  // 12C. ERROR
  error => {
    loadingPanel.hidden = true;

    showFatalError(
      [
        "model.glb could not be loaded.",
        "",
        "Check that:",
        "• the file is named exactly model.glb",
        "• it is in the repository root beside index.html",
        "• the filename uses the correct upper/lower case",
        "• the GLB file is valid"
      ].join("\n"),
      error
    );
  }
);


// ============================================================
// 13. AUTOMATIC CAMERA FIT
// ============================================================

function fitCameraToModel(object) {
  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    throw new Error("The loaded GLB contains no visible geometry.");
  }

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center.clone();
  const radius = Math.max(sphere.radius, 0.001);

  controls.target.copy(center);

  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);

  const fitDistance = radius / Math.sin(limitingFov / 2) * 1.15;

  const cameraDirection = new THREE.Vector3(1.3, 0.65, 1.5).normalize();

  camera.position
    .copy(center)
    .addScaledVector(cameraDirection, fitDistance);

  camera.near = Math.max(radius / 5000, 0.001);
  camera.far = Math.max(radius * 50, fitDistance * 20);
  camera.updateProjectionMatrix();

  // Conservative zoom limits. These prevent the camera from collapsing
  // into the model centre, though they are not per-wall collision detection.
  controls.minDistance = radius * 1.03;
  controls.maxDistance = fitDistance * 6;
  controls.update();
}


// ============================================================
// 14. MODEL-SCALE-AWARE LIGHTING
// ============================================================

function configureLightingForModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const sphere = box.getBoundingSphere(new THREE.Sphere());

  const center = sphere.center;
  const radius = Math.max(sphere.radius, 0.001);

  keyLight.position
    .copy(center)
    .add(new THREE.Vector3(radius * 2.2, radius * 3.4, radius * 2.3));

  keyLight.target.position.copy(center);

  const shadowExtent = radius * 1.45;
  const shadowCamera = keyLight.shadow.camera;

  shadowCamera.left = -shadowExtent;
  shadowCamera.right = shadowExtent;
  shadowCamera.top = shadowExtent;
  shadowCamera.bottom = -shadowExtent;
  shadowCamera.near = Math.max(radius * 0.05, 0.01);
  shadowCamera.far = radius * 8;
  shadowCamera.updateProjectionMatrix();

  keyLight.shadow.normalBias = radius * 0.001;
}


// ============================================================
// 15. RESPONSIVE RESIZE
// ============================================================

function resizeRenderer() {
  const width = Math.max(viewer.clientWidth, 1);
  const height = Math.max(viewer.clientHeight, 1);

  renderer.setSize(width, height, false);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, maximumPixelRatio)
  );

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resizeRenderer, { passive: true });
resizeRenderer();


// ============================================================
// 16. ERROR DISPLAY
// ============================================================

function showFatalError(message, error = null) {
  console.error(message, error);
  errorMessage.textContent = message;
  errorPanel.hidden = false;
}


// ============================================================
// 17. RENDER LOOP
// ============================================================

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);

  // For a static model/light setup, the same directional-light shadow
  // map does not need rebuilding every time only the viewer camera moves.
  if (
    CONFIG.freezeStaticShadows &&
    Number.isFinite(shadowFramesRemaining) &&
    shadowFramesRemaining > 0
  ) {
    shadowFramesRemaining--;

    if (shadowFramesRemaining === 0) {
      renderer.shadowMap.autoUpdate = false;
    }
  }
}

animate();
