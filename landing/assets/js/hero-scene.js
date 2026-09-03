/* ==========================================================================
   AQYL — WebGL-сцена героя (Three.js). Процедурный робот-маскот вместо
   прежней SVG/CSS-анимации: мягкий «пластиковый» материал, мышь/палец
   управляют взглядом и лёгким поворотом корпуса, режимы рисовать/сочинять/
   создавать игру переключают 3D-реквизит через пружинный «bounce».
   Модуль не блокирует первый экран (грузится как type="module") и сам
   уходит в лёгкий CSS-фолбэк, если WebGL недоступен или контекст потерян.
   ========================================================================== */

import * as THREE from "three";

function init() {
  var canvas = document.getElementById("heroCanvas");
  var stage = document.getElementById("stage");
  var fallback = document.getElementById("sceneFallback");
  if (!canvas || !stage) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isSmall = window.innerWidth < 640;

  function showFallback() {
    canvas.style.display = "none";
    if (fallback) fallback.style.display = "grid";
  }

  function supportsWebGL() {
    try {
      var test = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (test.getContext("webgl2") || test.getContext("webgl")));
    } catch (e) {
      return false;
    }
  }

  if (!supportsWebGL()) { showFallback(); return; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    showFallback();
    return;
  }

  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    showFallback();
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 1.38, 5.4);
  camera.lookAt(0, 1.32, 0);

  /* ------------------------------------------------------------- освещение */

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd7dcff, 1.0));
  var keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
  keyLight.position.set(2.4, 3.4, 3.2);
  scene.add(keyLight);
  var rimLight = new THREE.DirectionalLight(0x8fe9cf, 0.55);
  rimLight.position.set(-3, 1.6, -2.4);
  scene.add(rimLight);
  var antennaLight = new THREE.PointLight(0xffc93c, 0.9, 3.4, 2);
  antennaLight.position.set(0, 2.28, 0.25);
  scene.add(antennaLight);

  /* -------------------------------------------------------------- материалы */

  function plastic(color, opts) {
    var base = { color: color, roughness: 0.32, metalness: 0.02, clearcoat: 0.6, clearcoatRoughness: 0.25 };
    for (var k in opts) base[k] = opts[k];
    return new THREE.MeshPhysicalMaterial(base);
  }

  var matShellLight = plastic(0xf3f4ff, { roughness: 0.28 });
  var matShellSoft = plastic(0xe9ecff, { roughness: 0.3 });
  var matVisor = plastic(0x232a55, { roughness: 0.18, clearcoat: 0.8 });
  var matViolet = plastic(0x5b4be8, { roughness: 0.3 });
  var matVioletDk = plastic(0x4436c9, { roughness: 0.3 });
  var matWhiteGloss = plastic(0xffffff, { roughness: 0.15, clearcoat: 0.9 });
  var matSun = plastic(0xffc93c, { roughness: 0.25, emissive: 0xb9860a, emissiveIntensity: 0.35 });
  var matCoral = plastic(0xff6b6b, { roughness: 0.3 });
  var matBlue = plastic(0x2f7bff, { roughness: 0.3 });
  var matMintEmissive = new THREE.MeshStandardMaterial({ color: 0x16c79a, emissive: 0x16c79a, emissiveIntensity: 0.55, roughness: 0.3 });
  var matPupil = new THREE.MeshStandardMaterial({ color: 0x5b4be8, emissive: 0x5b4be8, emissiveIntensity: 0.2, roughness: 0.2 });
  var matLid = plastic(0x232a55, { roughness: 0.4 });

  /* ------------------------------------------------------------- робот */

  var robot = new THREE.Group();
  scene.add(robot);
  var baseY = 0;

  function shadowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(27,33,67,0.22)");
    g.addColorStop(1, "rgba(27,33,67,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  var shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.02;
  robot.add(shadow);

  // корпус
  var body = new THREE.Group();
  body.position.y = 0.66;
  robot.add(body);

  var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 20), matViolet);
  neck.position.y = 0.62;
  body.add(neck);

  var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.4, 6, 20), matShellSoft);
  torso.position.y = 0.28;
  body.add(torso);

  var chestPanel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 24), matShellLight);
  chestPanel.rotation.x = Math.PI / 2;
  chestPanel.position.set(0, 0.3, 0.36);
  body.add(chestPanel);

  var statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), matMintEmissive);
  statusLight.position.set(0, 0.58, 0.24);
  body.add(statusLight);

  var smileBody = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 8, 24, Math.PI * 0.85), matViolet);
  smileBody.position.set(0, 0.24, 0.42);
  smileBody.rotation.z = Math.PI * 1.075;
  body.add(smileBody);

  // руки
  var arms = [];
  [-1, 1].forEach(function (side) {
    var arm = new THREE.Group();
    arm.position.set(side * 0.52, 0.5, 0);
    var upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 12), matVioletDk);
    upper.position.y = -0.2;
    upper.rotation.z = side * 0.12;
    arm.add(upper);
    var hand = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 20), matWhiteGloss);
    hand.position.y = -0.42;
    arm.add(hand);
    body.add(arm);
    arms.push({ group: arm, side: side });
  });

  // голова
  var head = new THREE.Group();
  head.position.y = 1.36;
  robot.add(head);

  var headShell = new THREE.Mesh(new THREE.SphereGeometry(0.58, 40, 32), matShellLight);
  headShell.scale.set(1, 0.94, 0.98);
  head.add(headShell);

  var earL = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.16, 4, 10), matViolet);
  earL.position.set(-0.58, 0.02, 0);
  head.add(earL);
  var earR = earL.clone();
  earR.position.x = 0.58;
  head.add(earR);

  var visor = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), matVisor);
  visor.position.set(0, 0.06, 0.28);
  visor.rotation.x = -0.32;
  head.add(visor);

  var smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 24, Math.PI * 0.8), matMintEmissive);
  smile.position.set(0, -0.14, 0.58);
  smile.rotation.set(0.15, 0, Math.PI * 1.1);
  head.add(smile);

  // глаза
  var eyes = [];
  [-0.19, 0.19].forEach(function (x) {
    var eye = new THREE.Group();
    eye.position.set(x, 0.08, 0.5);
    head.add(eye);

    var sclera = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 20), matWhiteGloss);
    eye.add(sclera);

    var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), matPupil);
    pupil.position.z = 0.06;
    eye.add(pupil);

    var lid = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), matLid);
    lid.rotation.x = Math.PI;
    lid.position.z = 0.02;
    lid.scale.y = 0.001;
    eye.add(lid);

    eyes.push({ pupil: pupil, lid: lid });
  });

  // антенна
  var antenna = new THREE.Group();
  antenna.position.set(0, 0.56, -0.02);
  head.add(antenna);
  var stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.32, 12), matShellSoft);
  stalk.position.y = 0.16;
  antenna.add(stalk);
  var antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 20), matSun);
  antennaTip.position.y = 0.34;
  antenna.add(antennaTip);

  /* --------------------------------------------------- реквизит по режимам */

  function makeSpring() { return { scale: 0, target: 0, velocity: 0 }; }

  var beret = new THREE.Group();
  beret.position.set(0, 0.5, 0.06);
  beret.scale.setScalar(0);
  head.add(beret);
  var beretBase = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), matCoral);
  beretBase.position.y = 0.06;
  beret.add(beretBase);
  var beretPom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 14), matSun);
  beretPom.position.set(0.28, 0.24, -0.1);
  beret.add(beretPom);

  var book = new THREE.Group();
  book.position.set(0, 0.42, 0.5);
  book.rotation.x = -0.35;
  book.scale.setScalar(0);
  body.add(book);
  var pageGeo = new THREE.BoxGeometry(0.26, 0.02, 0.34);
  [-1, 1].forEach(function (side) {
    var page = new THREE.Mesh(pageGeo, matWhiteGloss);
    page.position.x = side * 0.135;
    page.rotation.z = side * -0.16;
    book.add(page);
  });
  var spine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.36), matViolet);
  book.add(spine);

  var joystick = new THREE.Group();
  joystick.position.set(0, 0.4, 0.5);
  joystick.scale.setScalar(0);
  body.add(joystick);
  var jBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.14, 24), matVioletDk);
  joystick.add(jBase);
  var jStick = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.14, 4, 8), matShellLight);
  jStick.position.set(-0.08, 0.13, 0);
  joystick.add(jStick);
  var jBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), matSun);
  jBall.position.set(-0.08, 0.21, 0);
  joystick.add(jBall);
  var jBtn1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), matMintEmissive);
  jBtn1.position.set(0.09, 0.08, 0.05);
  joystick.add(jBtn1);
  var jBtn2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), matBlue);
  jBtn2.position.set(0.16, 0.08, -0.02);
  joystick.add(jBtn2);

  var props = {
    draw: { obj: beret, state: makeSpring() },
    story: { obj: book, state: makeSpring() },
    game: { obj: joystick, state: makeSpring() }
  };

  window.addEventListener("aqyl:mode", function (e) {
    var mode = e.detail && e.detail.mode;
    Object.keys(props).forEach(function (key) {
      props[key].state.target = key === mode ? 1 : 0;
    });
  });

  /* --------------------------------------- фон: шейдер-«туман» + узлы сети */

  var bgUniforms = {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(0x5b4be8) },
    uColorB: { value: new THREE.Color(0x16c79a) },
    uColorC: { value: new THREE.Color(0xffc93c) }
  };
  var bgMaterial = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform float uTime;",
      "uniform vec3 uColorA;",
      "uniform vec3 uColorB;",
      "uniform vec3 uColorC;",
      "varying vec2 vUv;",
      "float blob(vec2 uv, vec2 c, float r) {",
      "  float d = length(uv - c);",
      "  return 1.0 - smoothstep(r * 0.15, r, d);",
      "}",
      "void main() {",
      "  vec2 uv = vUv;",
      "  vec2 c1 = vec2(0.32 + 0.10 * sin(uTime * 0.25), 0.62 + 0.08 * cos(uTime * 0.2));",
      "  vec2 c2 = vec2(0.7 + 0.09 * cos(uTime * 0.18), 0.32 + 0.10 * sin(uTime * 0.23));",
      "  vec2 c3 = vec2(0.55 + 0.08 * sin(uTime * 0.15 + 2.0), 0.78 + 0.06 * cos(uTime * 0.19 + 1.0));",
      "  float b1 = blob(uv, c1, 0.42);",
      "  float b2 = blob(uv, c2, 0.36);",
      "  float b3 = blob(uv, c3, 0.3);",
      "  vec3 color = uColorA * b1 * 0.5 + uColorB * b2 * 0.45 + uColorC * b3 * 0.4;",
      "  float alpha = clamp(b1 * 0.5 + b2 * 0.45 + b3 * 0.4, 0.0, 0.55);",
      "  gl_FragColor = vec4(color, alpha);",
      "}"
    ].join("\n")
  });
  var bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), bgMaterial);
  bgPlane.position.set(0, 1.1, -3.2);
  bgPlane.renderOrder = -1;
  scene.add(bgPlane);

  var NODE_COUNT = reduceMotion ? 0 : (isSmall ? 16 : 34);
  var nodesGroup = new THREE.Group();
  scene.add(nodesGroup);
  if (NODE_COUNT) {
    var nodePositions = [];
    for (var i = 0; i < NODE_COUNT; i++) {
      nodePositions.push(new THREE.Vector3(
        (Math.random() - 0.5) * 4.4,
        0.2 + Math.random() * 2.4,
        -0.6 - Math.random() * 2.2
      ));
    }

    var nodeGeo = new THREE.BufferGeometry().setFromPoints(nodePositions);
    var nodeMat = new THREE.PointsMaterial({
      color: 0x8fe9cf, size: 0.045, transparent: true, opacity: 0.85,
      sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    nodesGroup.add(new THREE.Points(nodeGeo, nodeMat));

    // тонкие линии к ближайшему соседу — эффект нейросети на фоне
    var lineVerts = [];
    for (var a = 0; a < nodePositions.length; a++) {
      var nearest = null, nearestD = 1.15;
      for (var b = 0; b < nodePositions.length; b++) {
        if (a === b) continue;
        var d = nodePositions[a].distanceTo(nodePositions[b]);
        if (d < nearestD) { nearestD = d; nearest = nodePositions[b]; }
      }
      if (nearest) {
        lineVerts.push(nodePositions[a].x, nodePositions[a].y, nodePositions[a].z);
        lineVerts.push(nearest.x, nearest.y, nearest.z);
      }
    }
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(lineVerts, 3));
    var lineMat = new THREE.LineBasicMaterial({ color: 0x8fe9cf, transparent: true, opacity: 0.18 });
    nodesGroup.add(new THREE.LineSegments(lineGeo, lineMat));
  }

  /* -------------------------------------------------------- указатель/взгляд */

  var pointerTarget = new THREE.Vector2(0, 0);
  var pointerActive = false;
  var lookX = 0, lookY = 0;

  function updatePointer(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var x = ((clientX - rect.left) / rect.width) * 2 - 1;
    var y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    pointerTarget.set(THREE.MathUtils.clamp(x, -1.6, 1.6), THREE.MathUtils.clamp(y, -1.6, 1.6));
    pointerActive = true;
  }

  window.addEventListener("pointermove", function (e) { updatePointer(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener("pointerdown", function (e) { updatePointer(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener("pointerleave", function () { pointerActive = false; });

  /* ------------------------------------------------------------- моргание */

  var nextBlink = performance.now() + 2600 + Math.random() * 3200;
  var blinkPhase = 0; // 0 — открыты, 1 — закрываются, 2 — открываются
  var blinkT = 0;

  function updateBlink(now, dt) {
    if (reduceMotion) return;
    if (blinkPhase === 0 && now >= nextBlink) { blinkPhase = 1; blinkT = 0; }
    if (blinkPhase === 1) {
      blinkT += dt;
      var p = Math.min(1, blinkT / 0.06);
      eyes.forEach(function (eye) { eye.lid.scale.y = p; });
      if (p >= 1) { blinkPhase = 2; blinkT = 0; }
    } else if (blinkPhase === 2) {
      blinkT += dt;
      var p2 = Math.min(1, blinkT / 0.1);
      eyes.forEach(function (eye) { eye.lid.scale.y = Math.max(0.001, 1 - p2); });
      if (p2 >= 1) { blinkPhase = 0; nextBlink = now + 2600 + Math.random() * 3600; }
    }
  }

  /* ----------------------------------------------------------------- resize */

  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(stage);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();

  /* -------------------------------------------------------------- рендер-луп */

  var clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var elapsed = clock.elapsedTime;
    var now = performance.now();

    if (!reduceMotion) {
      bgUniforms.uTime.value = elapsed;
      robot.position.y = baseY + Math.sin(elapsed * 1.05) * 0.045;
      nodesGroup.rotation.y = elapsed * 0.02;
    }

    var targetX = pointerActive ? pointerTarget.x : 0;
    var targetY = pointerActive ? pointerTarget.y : 0;
    var ease = reduceMotion ? 1 : Math.min(1, dt * 5);
    lookX += (targetX - lookX) * ease;
    lookY += (targetY - lookY) * ease;

    var idleSway = reduceMotion ? 0 : Math.sin(elapsed * 0.5) * 0.02;
    robot.rotation.y = idleSway + lookX * 0.05;
    head.rotation.y = lookX * 0.22;
    head.rotation.x = -lookY * 0.14;

    eyes.forEach(function (eye) {
      eye.pupil.position.set(lookX * 0.028, -lookY * 0.022, 0.065);
    });

    updateBlink(now, dt);

    Object.keys(props).forEach(function (key) {
      var p = props[key], s = p.state;
      if (reduceMotion) {
        s.scale = s.target;
      } else {
        var force = -170 * (s.scale - s.target) - 15 * s.velocity;
        s.velocity += force * dt;
        s.scale += s.velocity * dt;
      }
      p.obj.scale.setScalar(Math.max(0, s.scale));
    });

    var pulse = reduceMotion ? 0.9 : 0.7 + (0.6 + Math.sin(elapsed * 2.4) * 0.4) * 0.5;
    antennaLight.intensity = pulse;

    renderer.render(scene, camera);
  }

  animate();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
