import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MOOD_TRANSITION_SECONDS } from './presets.js';
import { sampleWaterSurface, waterSurfaceGLSL, hullUniformsGLSL, hullSurfaceGLSL, boatContactGLSL } from '../boat-water-interaction/index.js';
import { WAKE_CAPACITY } from '../boat-water-interaction/trail.js';

/** Open water: one planar reflection of the sky and boat, with surface contact.
 * Owns one reflection target and its mesh; no seabed or refraction pass is needed.
 */
export function createCoveWater(scene, { quality = 'balanced', size = 1400, beforeReflection, afterReflection } = {}) {
  const uniforms = {
    tDiffuse: { value: null }, color: { value: new THREE.Color() }, textureMatrix: { value: new THREE.Matrix4() },
    uTime: { value: 0 },
    uBoat: { value: new THREE.Vector4() },
    uDeep: { value: new THREE.Color('#167e89') },
    uShallow: { value: new THREE.Color('#53c2ad') },
    uFog: { value: new THREE.Color('#b8d9dd') },
    uSun: { value: new THREE.Vector3(-0.5, 0.5, -0.8).normalize() },
    uSunColor: { value: new THREE.Color('#fff0c9') },
    uLight: { value: 1 },
    uWaves: { value: 0.48 }, uClarity: { value: 0.8 },
    uContactHull: { value: new Float32Array(4) },
    uContactSize: { value: new Float32Array([2.4, .738, .11]) },
    uContactShape: { value: new Float32Array([.79, .58, 1]) },
    uContactEnabled: { value: 0 },
    uWakePoints: { value: new Float32Array(WAKE_CAPACITY * 4) },
    uWakeBounds: { value: new Float32Array([1, 1, -1, -1]) },
    uWakeCount: { value: 0 },
  };
  const mesh = new Reflector(waterGrid(size, quality), {
    textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: 0.002,
    shader: {
      name: 'SunnyCoveClearWater', uniforms,
      vertexShader: `
        uniform mat4 textureMatrix;
        uniform float uTime,uWaves;
        ${hullUniformsGLSL}
        ${waterSurfaceGLSL}
        ${hullSurfaceGLSL}
        varying vec4 vRef, vClip; varying vec3 vWorld; varying float vDepth;
        void main(){
          vec3 displaced=position;
          vec2 worldPoint=(modelMatrix*vec4(position,1.)).xz;
          displaced.z+=ambientWater(worldPoint,uTime).x*(uWaves/.48)+hullDisplacement(worldPoint);
          vec4 mv=modelViewMatrix*vec4(displaced,1.);
          vWorld=(modelMatrix*vec4(displaced,1.)).xyz;
          vDepth=-mv.z;vRef=textureMatrix*vec4(displaced,1.);
          vClip=projectionMatrix*mv;gl_Position=vClip;
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime,uLight,uWaves,uClarity;
        uniform vec4 uBoat;
        uniform vec3 uDeep,uShallow,uFog,uSun,uSunColor;
        ${hullUniformsGLSL}
        ${waterSurfaceGLSL}
        ${hullSurfaceGLSL}
        ${boatContactGLSL}
        varying vec4 vRef,vClip;varying vec3 vWorld;varying float vDepth;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
        vec2 noiseSlope(vec2 p){
          vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
          float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+1.);
          return vec2(mix(b-a,d-c,u.y),mix(c-a,d-b,u.x))*du;
        }
        vec2 waveSlope(vec2 p,float footprint){
          // Long swells carry small crossing ripples. Filtering each octave in
          // world space prevents distant sparkle from turning into pixel noise.
          vec2 slope=vec2(0.);
          vec2 direction=normalize(vec2(.33,1.));
          float frequency=5.1,amplitude=.012,speed=1.3;
          for(int i=0;i<7;i++){
            float phase=dot(p,direction)*frequency+uTime*speed;
            phase+=sin(dot(p,vec2(.77,-.43))+uTime*.19)*1.6;
            phase+=noise(p*.85+float(i)*13.)*3.;
            float attenuation=1.-smoothstep(.35,1.8,frequency*footprint);
            slope+=direction*cos(phase)*frequency*amplitude*attenuation;
            direction=mat2(.55,.835,-.835,.55)*direction;
            frequency*=1.65;amplitude*=.60;speed*=-1.23;
          }
          slope*=.22;
          mat2 rotation=mat2(.8,.6,-.6,.8);
          vec2 drift=vec2(uTime*.12,-uTime*.095);
          slope+=noiseSlope(p*4.2+drift)*.10*(1.-smoothstep(.35,1.8,4.2*footprint));
          slope+=noiseSlope(rotation*p*9.3-drift*1.2)*rotation*.055*(1.-smoothstep(.35,1.8,9.3*footprint));
          return slope;
        }
        void main(){
          vec2 p=vWorld.xz;vec3 view=normalize(cameraPosition-vWorld);
          float dist=length(cameraPosition-vWorld);
          float footprint=max(length(dFdx(p)),length(dFdy(p)));
          vec2 grad=(waveSlope(p,footprint)+ambientWater(p,uTime).yz)*(uWaves/.48);
          vec4 contact=boatContact(p,uTime,footprint);
          grad*=1.-contact.w*3.;
          grad+=contact.xy;
          // The raised bow pressure wave contributes the same height derivative
          // as the displaced surface, including where it meets the hull.
          float epsilon=.025;
          grad+=vec2(hullDisplacement(p+vec2(epsilon,0.))-hullDisplacement(p-vec2(epsilon,0.)),
            hullDisplacement(p+vec2(0.,epsilon))-hullDisplacement(p-vec2(0.,epsilon)))/(2.*epsilon);
          vec2 delta=p-uBoat.xy;
          vec2 fw=vec2(-sin(uBoat.z),-cos(uBoat.z));
          vec2 local=vec2(dot(delta,vec2(-fw.y,fw.x)),dot(delta,fw));
          float hull=length(local/vec2(.43,1.24));
          vec3 normal=normalize(vec3(-grad.x,1.,-grad.y));
          float fresnel=.0204+.9796*pow(1.-max(dot(view,normal),0.),5.);
          // The deep open sea has no visible floor. Use its absorption colour
          // directly, instead of drawing the whole scene again through the water.
          vec3 transmitted=uDeep*(.42+.08*uClarity);
          vec2 refUV=clamp(vRef.xy/vRef.w+normal.xz*clamp(.65/max(dist,1.),.001,.06),.002,.998);
          vec3 reflected=texture2D(tDiffuse,refUV).rgb;
          vec3 reflectionTint=mix(vec3(.91,.98,1.),vec3(.52,.72,.94),smoothstep(18.,150.,dist));
          vec3 col=mix(transmitted,reflected*reflectionTint,clamp(fresnel,.02,.97));
          vec3 halfDir=normalize(uSun+view);
          float glint=pow(max(dot(normal,halfDir),0.),1800.);
          float broad=pow(max(dot(normal,halfDir),0.),128.);
          col+=uSunColor*(glint*2.4+broad*.025)*uLight*(1.-contact.w*2.);
          col=mix(col,mix(uShallow,vec3(.46,.65,.60),.35)*(.42+.58*uLight),contact.w);
          col=mix(col,vec3(.69,.79,.73)*(.38+.62*uLight),contact.z);
          col*=1.-.12*exp(-hull*hull*1.4);
          float horizon=1.-exp(-dist*dist*.000007);
          col=mix(col,uFog,horizon*.14);
          gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  mesh.name = 'Open water with sky, hull reflection and a continuous wake';
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);
  const u = mesh.material.uniforms;
  const hidden = [];
  const reflection = mesh.onBeforeRender;
  const viewport = new THREE.Vector4();
  let disposed = false, rendering = false, lastTime, from, to, transition = 1;
  mesh.onBeforeRender = function (renderer, world, camera, ...rest) {
    if (disposed || rendering) return;
    rendering = true;
    const target = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace(), mipLevel = renderer.getActiveMipmapLevel();
    const xr = renderer.xr.enabled, shadow = renderer.shadowMap.autoUpdate;
    const objects = [mesh, ...hidden];
    const visibility = objects.map(object => object.visible);
    renderer.getCurrentViewport(viewport);
    const restoreTarget = () => {
      // setRenderTarget restores that target's pixel viewport and scissor;
      // public setViewport would instead apply the canvas DPR a second time.
      renderer.setRenderTarget(target, cubeFace, mipLevel);
      renderer.state.viewport(viewport);
    };
    try {
      objects.forEach(object => { object.visible = false; });
      renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
      mesh.visible = visibility[0];
      // The composition can omit the sharp solar image from this planar pass;
      // the surface normals below already generate its wave-broken highlights.
      beforeReflection?.();
      reflection.call(this, renderer, world, camera, ...rest);
    } finally {
      try { afterReflection?.(); }
      finally {
        objects.forEach((object, i) => { object.visible = visibility[i]; });
        renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadow;
        restoreTarget();
        rendering = false;
      }
    }
  };
  function palette(preset) {
    return {
      deep: new THREE.Color(preset.deepColor ?? preset.waterColor ?? '#167e89'),
      shallow: new THREE.Color(preset.shallowColor ?? '#53c2ad'),
      fog: new THREE.Color(preset.fogColor ?? '#b8d9dd'),
      sun: new THREE.Vector3().fromArray(preset.sunDirection ?? preset.moonDirection ?? [-.5,.5,-.8]).normalize(),
      sunColor: new THREE.Color(preset.lightColor ?? '#fff0c9'),
      light: preset.waterLight ?? (preset.name === 'bluehour' ? .32 : 1),
      waves: THREE.MathUtils.clamp(preset.waveStrength ?? .48, 0, 1.5),
      clarity: THREE.MathUtils.clamp(preset.waterClarity ?? .8, .1, 1),
    };
  }
  function apply(alpha) {
    for (const [key, uniform] of [['deep','uDeep'],['shallow','uShallow'],['fog','uFog'],['sunColor','uSunColor']]) {
      u[uniform].value.lerpColors(from[key], to[key], alpha);
    }
    u.uSun.value.lerpVectors(from.sun, to.sun, alpha).normalize();
    u.uLight.value = THREE.MathUtils.lerp(from.light, to.light, alpha);
    u.uWaves.value = THREE.MathUtils.lerp(from.waves, to.waves, alpha);
    u.uClarity.value = THREE.MathUtils.lerp(from.clarity, to.clarity, alpha);
  }
  return {
    mesh,
    sampleSurface(x, z, time) { return sampleWaterSurface(x, z, time, u.uWaves.value); },
    setInteraction(interaction) {
      const keys = ['uContactHull', 'uContactSize', 'uContactShape', 'uContactEnabled', 'uWakePoints', 'uWakeBounds', 'uWakeCount'];
      if (interaction && keys.some(key => !interaction.uniforms?.[key])) throw new TypeError('A boat-water interaction instance is required');
      for (const key of keys) u[key] = interaction ? interaction.uniforms[key] : uniforms[key];
    },
    exclude(...objects) { for (const object of objects) if (object && !hidden.includes(object)) hidden.push(object); },
    update(time, boat) {
      if (disposed) return;
      const dt = lastTime === undefined ? 0 : Math.max(0, time - lastTime);
      lastTime = time;
      if (to && transition < 1) { transition = Math.min(1, transition + dt / MOOD_TRANSITION_SECONDS); apply(transition * transition * (3 - 2 * transition)); }
      u.uTime.value = time;
      if (boat) u.uBoat.value.set(boat.x, boat.z, boat.heading, boat.speed);
    },
    setMood(preset, { immediate = false } = {}) {
      from = { deep: u.uDeep.value.clone(), shallow: u.uShallow.value.clone(), fog: u.uFog.value.clone(),
        sun: u.uSun.value.clone(), sunColor: u.uSunColor.value.clone(), light: u.uLight.value,
        waves: u.uWaves.value, clarity: u.uClarity.value };
      const first = !to; to = palette(preset);
      transition = immediate || first ? 1 : 0; if (transition === 1) apply(1);
    },
    resize(width, height) {
      if (disposed || width <= 0 || height <= 0) return;
      const scale = Math.min(quality === 'low' ? .4 : .6, (quality === 'low' ? 576 : 960) / Math.max(width, height));
      const w = Math.max(128, Math.round(width * scale)), h = Math.max(128, Math.round(height * scale));
      mesh.getRenderTarget().setSize(Math.max(128, Math.round(w * .75)), Math.max(128, Math.round(h * .75)));
    },
    dispose() {
      if (disposed) return; disposed = true;
      mesh.removeFromParent(); mesh.geometry.dispose(); mesh.dispose(); hidden.length = 0;
    },
  };
}

// Fine cells cover the navigation and near-water camera area. A few outer rings
// reach the horizon without subdividing an entire 1.4 km sea at hull resolution.
function waterGrid(size, quality) {
  const half = size / 2, inner = Math.min(24, half), step = quality === 'low' ? .65 : .4;
  const divisions = Math.ceil(inner * 2 / step), axis = [];
  for (const distance of [half, 140, 60, 32]) if (distance > inner && distance <= half && !axis.includes(-distance)) axis.push(-distance);
  axis.sort((a, b) => a - b);
  const outside = [...axis];
  for (let i = 0; i <= divisions; i++) axis.push(-inner + inner * 2 * i / divisions);
  axis.push(...outside.reverse().map(value => -value));
  const positions = [], indices = [], count = axis.length;
  for (const y of axis) for (const x of axis) positions.push(x, y, 0);
  for (let y = 0; y < count - 1; y++) for (let x = 0; x < count - 1; x++) {
    const a = y * count + x, b = a + 1, c = a + count, d = c + 1;
    indices.push(a, b, d, a, d, c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
