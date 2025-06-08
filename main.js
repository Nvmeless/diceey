import * as THREE from "three";
import * as CANNON from "cannon";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { DiceD20, DiceManager } from "./lib/dice.js";

// MAIN
var container,
  scene,
  camera,
  renderer,
  controls,
  world,
  dice = [],
  sprite;
let cubeCharged = false;
let cameraAnimating = false;
let launchTime = 0;

const portalUniforms = {
  time: { value: 0.0 },
  resolution: {
    value: new THREE.Vector2(window.innerWidth, window.innerHeight),
  },
};
const portalMaterial = new THREE.ShaderMaterial({
  uniforms: portalUniforms,
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    varying vec2 vUv;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv - 0.5;
      float len = length(uv);

      // Glow extérieur doux
      float glow = smoothstep(0.5, 0.2, len) * 0.8;

      // Vortex animé
      float angle = atan(uv.y, uv.x);
      float spiral = sin(10.0 * len - time * 2.0 + angle * 2.0);

      // Distorsion magique (bulle)
      float distortion = sin(len * 20.0 - time * 5.0) * 0.03;
      uv += normalize(uv) * distortion;

      // Couleurs
      vec3 baseColor = mix(vec3(0.4, 0.0, 0.7), vec3(0.9, 0.5, 1.0), spiral * 0.5 + 0.5);
      vec3 glowColor = vec3(0.6, 0.1, 1.0);

      // Alpha circulaire
      float alpha = smoothstep(0.45, 0.25, len);

      // Final
      vec3 finalColor = baseColor + glow * glowColor;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
});
const skyUniforms = {
  time: { value: 0.0 },
};

const skyMaterial = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  vertexShader: `
    varying vec3 vWorldPosition;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
// FRAGMENT SHADER SKYBOX AVEC ÉCLAIRS
uniform float time;
varying vec3 vWorldPosition;

float noise(vec3 p) {
  return fract(sin(dot(p, vec3(23.1, 12.7, 89.2))) * 43758.5453);
}

float fbm(vec3 p) {
  float v = 0.0;
  float amp = 0.5;
  for(int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldPosition);
  float n = fbm(dir * 10.0 + time * 0.5);

  // Éclairs
  float lightning = smoothstep(0.7, 0.9, sin((dir.x + dir.y + dir.z) * 20.0 + time * 15.0));
  lightning *= step(0.98, fract(n * 10.0));

  vec3 baseColor = vec3(0.0); // espace noir
  vec3 lightningColor = vec3(1.0, 0.9, 1.0); // éclairs violets/blancs

  vec3 finalColor = mix(baseColor, lightningColor, lightning);

  gl_FragColor = vec4(finalColor, 1.0);
}
  `,
  side: THREE.BackSide,
});

const skyGeometry = new THREE.SphereGeometry(500, 64, 64);
const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);

const finalContainer = document.getElementById("final");
const finalContent = document.createElement("div");
finalContent.id = "rollButton";
finalContent.textContent = "Succes critique !";
finalContent.style.position = "absolute";
finalContent.style.top = "50%";
finalContent.style.left = "50%";
finalContent.style.transform = "translate(-50%, -50%)";
finalContent.style.padding = "25px 25px";
finalContent.style.zIndex = "10";
finalContent.style.backgroundColor = "blue";
const loadingManager = new THREE.LoadingManager();

loadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
  console.log("Chargement en cours...");
};

loadingManager.onLoad = function () {
  console.log("Tout est chargé !");
  document.getElementById("loader").style.display = "none"; // cache le loader
  init();
  // Démarre ton app seulement après le chargement
};

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
  console.log(`Chargement de ${url} (${itemsLoaded}/${itemsTotal})`);
};

loadingManager.onError = function (url) {
  console.error("Erreur lors du chargement de " + url);
};

const cubeLoader = new THREE.CubeTextureLoader(loadingManager);
const skyboxTexture = cubeLoader.load([
  "assets/skybox/FINALSUPER.png",
  "assets/skybox/FINALSUPER.png",
  "assets/skybox/FINALSUPER.png",
  "assets/skybox/FINALSUPER.png",
  "assets/skybox/FINALSUPER.png",
  "assets/skybox/FINALSUPER.png",
]);

if (cubeCharged === true) {
}

function init() {
  scene = new THREE.Scene();

  // Skybox setup

  // const loader = new THREE.CubeTextureLoader();
  // const skyboxTexture = loader.load([
  //   // "assets/skybox/FINALSUPER.png",
  //   // "assets/skybox/FINALSUPER.png",
  //   // "assets/skybox/FINALSUPER.png",
  //   // "assets/skybox/FINALSUPER.png",
  //   // "assets/skybox/FINALSUPER.png",
  //   // "assets/skybox/FINALSUPER.png",
  // ]);
  scene.background = skyboxTexture;
  scene.add(skyMesh);

  var SCREEN_WIDTH = window.innerWidth,
    SCREEN_HEIGHT = window.innerHeight;
  var VIEW_ANGLE = 25,
    ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT,
    NEAR = 0.01,
    FAR = 20000;
  camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
  scene.add(camera);
  camera.position.set(0, 30, 30);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container = document.getElementById("ThreeJS");
  container.appendChild(renderer.domElement);
  const btn = document.createElement("button");
  btn.style.cssText += `
  font-size: 20px;
  color: yellow;
  background: linear-gradient(135deg, #8e2de2, #4a00e0);
  border: 2px solid transparent;
  border-radius: 16px;
  box-shadow: 0 0 12px rgba(255,255,255,0.6), 0 0 24px rgba(138,43,226,0.4), inset 0 0 10px rgba(255,255,255,0.2);
  text-shadow: 0 0 5px #ffffff, 0 0 10px #ff00ff;
  animation: pulseGlow 2.5s infinite ease-in-out;
  transition: transform 0.2s ease;
`;

  btn.addEventListener("mouseover", () => {
    btn.style.transform = "translate(-50%, -50%) scale(1.1)";
  });

  btn.addEventListener("mouseout", () => {
    btn.style.transform = "translate(-50%, -50%)";
  });

  // Et ajoute l'animation à la page :
  const style = document.createElement("style");
  style.innerHTML = `
@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.5),
                0 0 20px rgba(138, 43, 226, 0.3);
  }
  50% {
    box-shadow: 0 0 24px rgba(255, 255, 255, 0.7),
                0 0 40px rgba(138, 43, 226, 0.5);
  }
}`;
  document.head.appendChild(style);
  btn.id = "rollButton";
  btn.textContent = "Lancer le dé";
  btn.style.position = "absolute";
  btn.style.top = "50%";
  btn.style.left = "50%";
  btn.style.transform = "translate(-50%, -50%)";
  btn.style.padding = "12px 24px";
  btn.style.zIndex = "10";
  document.body.appendChild(btn);

  controls = new OrbitControls(camera, renderer.domElement);

  scene.add(new THREE.AmbientLight("#ffffff", 0.3));

  let directionalLight = new THREE.DirectionalLight("#ffffff", 0.5);
  directionalLight.position.set(-1000, 1000, 1000);
  scene.add(directionalLight);

  let light = new THREE.SpotLight(0xefdfd5, 1.3);
  light.position.y = 100;
  light.target.position.set(0, 0, 0);
  light.castShadow = true;
  light.shadow.camera.near = 50;
  light.shadow.camera.far = 110;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(light);

  var floorMaterial = new THREE.MeshPhongMaterial({
    color: "#00aa00",
    side: THREE.DoubleSide,
  });
  // var floorGeometry = new THREE.PlaneGeometry(30, 30, 10, 10);
  // var floor = new THREE.Mesh(floorGeometry, floorMaterial);
  // floor.receiveShadow = true;
  // floor.rotation.x = Math.PI / 2;
  // scene.add(floor);
  const floorGeometry = new THREE.PlaneGeometry(30, 30, 1, 1);
  const floor = new THREE.Mesh(floorGeometry, portalMaterial);
  floor.rotation.x = Math.PI / 2;
  floor.receiveShadow = false;
  scene.add(floor);

  scene.fog = new THREE.FogExp2(0x9999ff, 0.00025);

  world = new CANNON.World();
  world.gravity.set(0, -9.82 * 20, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 16;

  DiceManager.setWorld(world);

  let floorBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: DiceManager.floorBodyMaterial,
  });
  floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(floorBody);

  const wallHeight = 15;
  const wallThickness = 1;
  const floorSize = 30;

  function createWall(posX, posZ, rotY) {
    const wallGeometry = new THREE.BoxGeometry(
      floorSize,
      wallHeight,
      wallThickness
    );
    const wallMaterial = new THREE.MeshPhongMaterial();
    wallMaterial.transparent = true;
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    wallMesh.position.set(posX, wallHeight / 2, posZ);
    wallMesh.rotation.y = rotY;
    wallMesh.visible = false;
    scene.add(wallMesh);

    const wallShape = new CANNON.Box(
      new CANNON.Vec3(floorSize / 2, wallHeight / 2, wallThickness / 2)
    );
    const wallBody = new CANNON.Body({ mass: 0, shape: wallShape });
    wallBody.position.set(posX, wallHeight / 2, posZ);
    wallBody.quaternion.setFromEuler(0, rotY, 0);
    world.addBody(wallBody);
  }

  createWall(0, floorSize / 2, 0);
  createWall(0, -floorSize / 2, 0);
  createWall(floorSize / 2, 0, Math.PI / 2);
  createWall(-floorSize / 2, 0, Math.PI / 2);

  const die = new DiceD20({ size: 1.5, backColor: "white" });
  die.getObject().visible = false;
  scene.add(die.getObject());
  dice.push(die);

  // Sprite setup
  const spriteMap = new THREE.TextureLoader().load("assets/skybox/nx.png");
  const spriteMaterial = new THREE.SpriteMaterial({
    map: spriteMap,
  });
  sprite = new THREE.Sprite(spriteMaterial);
  scene.add(sprite);

  function randomDiceThrow() {
    let yRand = Math.random() * 20;
    dice[0].resetBody();
    // let randTen = Math.random() * 10;
    let randTen = 1;
    let obj = dice[0].getObject();
    obj.position.set(-10 + randTen, 2 + randTen, -10 + randTen);
    obj.quaternion.set(
      ((Math.random() * 90 - 45) * Math.PI) / 180,
      0,
      ((Math.random() * 90 - 45) * Math.PI) / 180,
      1
    );
    dice[0].updateBodyFromMesh();
    obj.body.velocity.set(25 + randTen, 40 + yRand, 15 + randTen);
    obj.body.angularVelocity.set(
      20 * Math.random() - 10,
      20 * Math.random() - 10,
      20 * Math.random() - 10
    );
    DiceManager.prepareValues([{ dice: dice[0], value: 20 }]);
  }

  btn.addEventListener("click", () => {
    btn.style = "opacity:0%; pointer-events:none;";
    launchTime = performance.now();
    cameraAnimating = "launch";
    setTimeout(() => {
      randomDiceThrow();
      dice[0].getObject().visible = true;
    }, 1000);
  });

  requestAnimationFrame(animate);
}

function animate() {
  updatePhysics();
  render();
  update();
  skyUniforms.time.value = performance.now() / 5000;
  requestAnimationFrame(animate);
}

function updatePhysics() {
  world.step(1.0 / 60.0);
  for (var i in dice) {
    dice[i].updateMeshFromBody();
  }
}

function update() {
  controls.update();
  if (portalUniforms) {
    portalUniforms.time.value = performance.now() / 1000;
  }
  // Update sprite position
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  const spriteDistance = 10;
  const spritePosition = camera.position
    .clone()
    .sub(cameraDirection.multiplyScalar(spriteDistance));
  sprite.position.copy(spritePosition);

  if (cameraAnimating === "launch") {
    const t = (performance.now() - launchTime) / 2000;
    if (t < 1) {
      const radius = 90 - t * 10;
      const angle = Math.PI / 4 + (t * Math.PI) / 4;
      camera.position.x = radius * Math.sin(angle);
      camera.position.z = radius * Math.cos(angle);
      camera.position.y = 20 + 10 * Math.sin(t * Math.PI);
      camera.lookAt(new THREE.Vector3(0, 0, 0));
    } else {
      cameraAnimating = "follow";
    }
  } else if (cameraAnimating === "follow") {
    const x = (performance.now() - launchTime) / 2000;
    const dieObj = dice[0].getObject();
    const diePos = dieObj.position;
    const dieVel = dieObj.body.velocity.length();

    if (dieVel < 0.1) {
      const target = new THREE.Vector3().copy(diePos);
      camera.position.lerpVectors(
        camera.position,
        target.clone().add(new THREE.Vector3(10, 10, 1)),
        0.05
      );
      camera.lookAt(target);
      if (x > 4) {
        cameraAnimating = "unzoom";
      }
    }
  } else if (cameraAnimating === "unzoom") {
    const y = (performance.now() - launchTime) / 2000;

    const dieObj = dice[0].getObject();
    const diePos = dieObj.position;
    const target = new THREE.Vector3().copy(diePos);
    camera.position.lerpVectors(
      camera.position,
      target.clone().add(new THREE.Vector3(100, 10, 1)),
      0.05
    );
    camera.lookAt(target);
    if (y > 5) {
      finalContainer.appendChild(finalContent);

      // cameraAnimating = "final";
    }
  } else if (cameraAnimating === "final") {
    // container.remove();
    finalContainer.appendChild(finalContent);
    cameraAnimating = "none";
  }
}

function render() {
  renderer.render(scene, camera);
}
