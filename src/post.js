// Post stack: bloom for the window light, then a film grade whose chromatic
// fringe and vignette grow with fall speed.
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
    uniform sampler2D tDiffuse; uniform float uTime, uSpeed, uFade, uAspect; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - .5; float r = length(c * vec2(uAspect, 1.));
      vec2 off = c * (.0025 + uSpeed * .012) * r;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= smoothstep(1.25, .25, r * (1. + uSpeed * .35));
      col += (h(vUv * 913. + fract(uTime * 7.)) - .5) * .035;
      col = mix(col, vec3(0.), uFade);
      gl_FragColor = vec4(col, 1.);
    }`
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  const render = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), .42, .5, 1.05);
  const grade = new ShaderPass(Grade);
  composer.addPass(render); composer.addPass(bloom); composer.addPass(grade); composer.addPass(new OutputPass()); composer.addPass(new SMAAPass());
  return {
    composer, bloom, grade,
    setScene(s, c) { render.scene = s; render.camera = c; },
    setSize(w, h) { composer.setSize(w, h); grade.uniforms.uAspect.value = w / h; },
    render(dt) { grade.uniforms.uTime.value += dt; composer.render(dt); }
  };
}
