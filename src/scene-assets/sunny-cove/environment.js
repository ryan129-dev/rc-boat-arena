import * as THREE from 'three';
import { disposeObjects } from '../../shared/rendering/resources.js';
import { MOODS, MOOD_TRANSITION_SECONDS } from './presets.js';
export { MOODS } from './presets.js';

function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTime: { value: 0 }, uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() }, uSunDirection: { value: new THREE.Vector3() },
      uCloud: { value: 0.18 }, uGlow: { value: 0.3 }, uSize: { value: 0.008 }, uNight: { value: 0 },
    },
    vertexShader: `varying vec3 vDirection;
      void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vDirection;
      uniform vec3 uZenith,uHorizon,uSunColor,uSunDirection;
      uniform float uTime,uCloud,uGlow,uSize,uNight;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=mat2(1.65,1.12,-1.12,1.65)*p;a*=.5;}return v;}
      void main(){
        vec3 d=normalize(vDirection),sun=normalize(uSunDirection);
        float elevation=pow(max(d.y,0.),.34);
        vec3 color=mix(uHorizon,uZenith,elevation);
        float facing=max(0.,dot(d,sun));
        color+=uSunColor*pow(facing,26.)*uGlow;
        color+=uSunColor*pow(facing,180.)*uGlow*.45;
        float disk=1.-smoothstep(uSize*.8,uSize,length(d-sun));
        color+=uSunColor*disk*mix(12.,1.7,uNight);
        vec2 cloudUV=d.xz/max(.16,d.y+.12)*1.4+vec2(uTime*.0013,0.);
        float n=fbm(cloudUV*vec2(.8,2.0));
        float cloud=smoothstep(.46,.69,n)*uCloud*smoothstep(.025,.23,d.y);
        vec3 cloudColor=mix(vec3(1.,.965,.9),uHorizon,.22+uNight*.4);
        color=mix(color,cloudColor,cloud);
        color=mix(uHorizon*.76,color,smoothstep(-.1,.04,d.y));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(700, 40, 24), material);
  mesh.name = 'Clear coastal sky and warm low sun'; mesh.frustumCulled = false;
  return { mesh, material };
}

function skyPreset(sky, preset) {
  const u = sky.material.uniforms;
  u.uZenith.value.set(preset.zenith); u.uHorizon.value.set(preset.horizon);
  u.uSunColor.value.set(preset.lightColor); u.uSunDirection.value.fromArray(preset.moonDirection).normalize();
  u.uCloud.value = preset.cloud; u.uGlow.value = preset.sunGlow; u.uSize.value = preset.sunSize; u.uNight.value = preset.moon;
}

function fallbackEnvironmentMap(preset) {
  const faces = Array.from({ length: 6 }, (_, index) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d'), gradient = context.createLinearGradient(0, 0, 0, 32);
    gradient.addColorStop(0, index === 3 ? preset.ground : preset.zenith);
    gradient.addColorStop(0.58, preset.horizon); gradient.addColorStop(1, preset.ground);
    context.fillStyle = gradient; context.fillRect(0, 0, 32, 32); return canvas;
  });
  const texture = new THREE.CubeTexture(faces); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

/** Procedural sky and boat lighting. No landscape models or background downloads. */
export async function createCoveEnvironment(scene, {
  renderer, quality = 'balanced', mood: initialMood = 'afternoon', signal,
} = {}) {
  if (!Object.hasOwn(MOODS, initialMood)) throw new Error(`Unknown cove mood: ${initialMood}`);
  signal?.throwIfAborted();
  const group = new THREE.Group(); group.name = 'Sunny Cove / open sky';
  const warnings = [], maps = {}, mapTargets = [], looseTextures = [];
  let disposed = false, previous, lastExposure, lastIntensity, sun;
  const fog = new THREE.FogExp2();
  const dispose = () => {
    if (disposed) return;
    disposed = true; signal?.removeEventListener('abort', dispose); group.removeFromParent();
    if (previous) {
      if (scene.fog === fog) scene.fog = previous.fog;
      if (Object.values(maps).includes(scene.environment)) {
        scene.environment = previous.environment;
        if (scene.environmentIntensity === lastIntensity) scene.environmentIntensity = previous.intensity;
      }
      if (renderer) {
        if (renderer.toneMappingExposure === lastExposure) renderer.toneMappingExposure = previous.exposure;
        if (renderer.shadowMap.type === THREE.PCFSoftShadowMap) renderer.shadowMap.type = previous.shadowType;
        if (renderer.shadowMap.enabled) renderer.shadowMap.enabled = previous.shadows;
      }
    }
    disposeObjects([group], { extraTextures: looseTextures });
    mapTargets.forEach(target => target.dispose()); sun?.shadow.dispose();
    group.clear(); mapTargets.length = 0; looseTextures.length = 0;
  };
  try {
    const sky = createSky(); group.add(sky.mesh);
    sun = new THREE.DirectionalLight(); sun.castShadow = true;
    sun.shadow.mapSize.setScalar(quality === 'low' ? 512 : 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -2.5;
    sun.shadow.camera.right = sun.shadow.camera.top = 2.5;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.00012; sun.shadow.normalBias = 0.003; sun.shadow.radius = 1.6;
    const hemisphere = new THREE.HemisphereLight(), ambient = new THREE.AmbientLight();
    const frontFill = new THREE.DirectionalLight('#ffe8c5', 0.9);
    frontFill.position.set(25, 20, 60); frontFill.target.position.set(-3, 0, -5);
    group.add(sun, sun.target, hemisphere, ambient, frontFill, frontFill.target);
    // Generate only the selected lighting at startup. Other moods are created
    // on first use, with a separate material so the visible sky never flashes.
    const ensureEnvironmentMap = name => {
      if (maps[name]) return;
      if (!renderer?.isWebGLRenderer) {
        maps[name] = fallbackEnvironmentMap(MOODS[name]); looseTextures.push(maps[name]);
        return;
      }
      const generator = new THREE.PMREMGenerator(renderer), lightingScene = new THREE.Scene();
      const material = sky.material.clone();
      const lightingSky = new THREE.Mesh(sky.mesh.geometry, material); lightingScene.add(lightingSky);
      try {
        skyPreset({ material }, MOODS[name]);
        material.uniforms.uTime.value = 0; // Match the original fixed-time lighting maps.
        const target = generator.fromScene(lightingScene, 0.03, 0.1, 1000);
        mapTargets.push(target); maps[name] = target.texture;
      } finally { generator.dispose(); lightingScene.remove(lightingSky); material.dispose(); }
    };
    ensureEnvironmentMap(initialMood);
    previous = { fog: scene.fog, environment: scene.environment, intensity: scene.environmentIntensity,
      exposure: renderer?.toneMappingExposure, shadows: renderer?.shadowMap.enabled, shadowType: renderer?.shadowMap.type };
    scene.add(group); scene.fog = fog;
    if (renderer) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    const colors = ['fogColor', 'zenith', 'horizon', 'lightColor', 'hemisphere', 'ground', 'frontFillColor'];
    const scalars = ['fogDensity', 'exposure', 'lightIntensity', 'fillIntensity', 'ambientIntensity', 'environmentIntensity', 'cloud', 'moon', 'sunSize', 'sunGlow', 'frontFillIntensity'];
    const current = { ...MOODS[initialMood], direction: new THREE.Vector3().fromArray(MOODS[initialMood].moonDirection).normalize() };
    for (const field of colors) current[field] = new THREE.Color(current[field]);
    let mood = initialMood, elapsed = MOOD_TRANSITION_SECONDS, from, to;
    const apply = progress => {
      for (const field of colors) current[field].lerpColors(from[field], to[field], progress);
      for (const field of scalars) current[field] = THREE.MathUtils.lerp(from[field], to[field], progress);
      current.direction.lerpVectors(from.direction, to.direction, progress).normalize();
      fog.color.copy(current.fogColor); fog.density = current.fogDensity;
      const u = sky.material.uniforms;
      u.uZenith.value.copy(current.zenith); u.uHorizon.value.copy(current.horizon);
      u.uSunColor.value.copy(current.lightColor); u.uSunDirection.value.copy(current.direction);
      u.uCloud.value = current.cloud; u.uNight.value = current.moon; u.uSize.value = current.sunSize; u.uGlow.value = current.sunGlow;
      sun.color.copy(current.lightColor); sun.intensity = current.lightIntensity;
      hemisphere.color.copy(current.hemisphere); hemisphere.groundColor.copy(current.ground); hemisphere.intensity = current.fillIntensity;
      ambient.color.copy(current.hemisphere); ambient.intensity = current.ambientIntensity;
      // Soft sky-side fill reveals the hull and varnish without tinting both
      // sides the sun's orange, and keeps the boat legible at blue hour.
      frontFill.color.copy(current.frontFillColor); frontFill.intensity = current.frontFillIntensity;
      if (progress >= 0.5) scene.environment = maps[mood];
      scene.environmentIntensity = lastIntensity = current.environmentIntensity;
      if (renderer) renderer.toneMappingExposure = lastExposure = current.exposure;
      sun.position.copy(sun.target.position).addScaledVector(current.direction, 90);
      sun.target.updateMatrixWorld();
    };
    const setMood = (name, { immediate = false } = {}) => {
      if (!Object.hasOwn(MOODS, name)) throw new Error(`Unknown cove mood: ${name}`);
      const preset = MOODS[name]; if (disposed) return preset;
      ensureEnvironmentMap(name);
      mood = name; from = { ...current, direction: current.direction.clone() };
      to = { ...preset, direction: new THREE.Vector3().fromArray(preset.moonDirection).normalize() };
      for (const field of colors) { from[field] = current[field].clone(); to[field] = new THREE.Color(preset[field]); }
      elapsed = immediate ? MOOD_TRANSITION_SECONDS : 0;
      if (immediate) apply(1);
      return preset;
    };
    const update = (dt, time, boat) => {
      if (disposed) return;
      sky.material.uniforms.uTime.value = time;
      if (boat) {
        sun.target.position.set(boat.x, 0, boat.z);
        sun.position.copy(sun.target.position).addScaledVector(current.direction, 90);
        sun.target.updateMatrixWorld();
      }
      if (elapsed < MOOD_TRANSITION_SECONDS) {
        elapsed = Math.min(MOOD_TRANSITION_SECONDS, elapsed + Math.max(0, dt));
        const progress = elapsed / MOOD_TRANSITION_SECONDS; apply(progress * progress * (3 - 2 * progress));
      }
    };
    setMood(initialMood, { immediate: true });
    signal?.addEventListener('abort', dispose, { once: true });
    return { group, sky, lights: { sun, hemisphere, ambient, frontFill }, warnings, update, setMood, dispose,

      get mood() { return mood; }, get preset() { return MOODS[mood]; } };
  } catch (error) { dispose(); throw error; }
}
