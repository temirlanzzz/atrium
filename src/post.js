// Post stack: a gentle bloom on the shop lights, a soft lens vignette that
// deepens with fall speed, and a white fade for page transitions.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

const Grade = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSpeed: { value: 0 }, uFade: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSpeed, uFade, uAspect; varying vec2 vUv;
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float r = length((vUv - .5) * vec2(uAspect, 1.));
      col *= mix(1., smoothstep(1.35, .35, r), .55 + uSpeed * .3);
      gl_FragColor = vec4(mix(col, vec3(1.), uFade), 1.);
    }`
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  const render = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), .22, .4, 1.4);
  const grade = new ShaderPass(Grade);
  composer.addPass(render); composer.addPass(bloom); composer.addPass(grade); composer.addPass(new OutputPass()); composer.addPass(new SMAAPass());
  return {
    composer, bloom, grade,
    setScene(s, c) { render.scene = s; render.camera = c; },
    setSize(w, h) { composer.setSize(w, h); grade.uniforms.uAspect.value = w / h; },
    render(dt) { grade.uniforms.uTime.value += dt; composer.render(dt); }
  };
}
