import {
  ArcRotateCamera,
  Color3,
  Color4,
  CubeTexture,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

const BASE = import.meta.env.BASE_URL;

export function createEngine(canvas) {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
  window.addEventListener("resize", () => engine.resize());
  return engine;
}

export function createScene(engine, canvas) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.07, 0.086, 0.11, 1);

  // Metallic CAD materials render black without an environment map.
  scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(`${BASE}env/environmentSpecular.env`, scene);
  scene.environmentIntensity = 0.9;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;
  hemi.groundColor = new Color3(0.25, 0.25, 0.28);

  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.4), scene);
  sun.intensity = 1.2;

  const camera = new ArcRotateCamera("camera", -Math.PI / 3, Math.PI / 2.6, 4, Vector3.Zero(), scene);
  camera.minZ = 0.01;
  camera.wheelDeltaPercentage = 0.01;
  camera.pinchDeltaPercentage = 0.01;
  camera.panningSensibility = 1500;
  camera.lowerBetaLimit = 0.05;
  camera.upperBetaLimit = Math.PI / 2 - 0.02;
  camera.attachControl(canvas, true);

  return { scene, camera };
}

/** Floor at y = 0 (also serves as teleport floor in VR). */
export function createGround(scene, size) {
  const ground = MeshBuilder.CreateGround("ground", { width: size, height: size }, scene);
  const mat = new StandardMaterial("groundMat", scene);
  mat.diffuseColor = new Color3(0.2, 0.22, 0.25);
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  ground.material = mat;
  ground.isPickable = true;
  return ground;
}

/** Points the camera at the model bounds with a comfortable margin. */
export function frameCamera(camera, bounds) {
  const size = bounds.max.subtract(bounds.min);
  // Use the narrower of vertical/horizontal FOV so portrait (mobile) screens fit the model too.
  const aspect = camera.getEngine().getAspectRatio(camera);
  const halfFov = Math.min(camera.fov / 2, Math.atan(Math.tan(camera.fov / 2) * aspect));
  const radius = ((size.length() / 2) / Math.tan(halfFov)) * 0.75;
  camera.setTarget(new Vector3(0, size.y / 2, 0));
  camera.alpha = (2 * Math.PI) / 3;
  camera.beta = Math.PI / 2.6;
  camera.radius = radius;
  camera.lowerRadiusLimit = radius * 0.08;
  camera.upperRadiusLimit = radius * 4;
}
