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
  dice = [];

let cameraAnimating = false;
let launchTime = 0;

init();

function init() {
  scene = new THREE.Scene();
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
  var floorGeometry = new THREE.PlaneGeometry(30, 30, 10, 10);
  var floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.receiveShadow = true;
  floor.rotation.x = Math.PI / 2;
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

  const die = new DiceD20({ size: 1.5, backColor: "#ff0000" });
  die.getObject().visible = false;
  scene.add(die.getObject());
  dice.push(die);

  function randomDiceThrow() {
    let yRand = Math.random() * 20;
    dice[0].resetBody();
    let randTen = Math.random() * 10;
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
    }
  }
}

function render() {
  renderer.render(scene, camera);
}
