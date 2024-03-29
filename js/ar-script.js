import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREEx } from 'arjs';

window.addEventListener("DOMContentLoaded", init);

function init() {
  //レンダラーの設定
  const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
  });
  renderer.setClearColor(new THREE.Color(), 0);
  renderer.setSize(640, 480);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0px';
  renderer.domElement.style.left = '0px';
  document.body.appendChild(renderer.domElement);

  //画面設定
  const scene = new THREE.Scene();
  scene.visible = false;
  const camera = new THREE.Camera();
  scene.add(camera);
  const light = new THREE.AmbientLight(0xFFFFFF, 1.0);
  scene.add(light);

  //画面リサイズの設定
  window.addEventListener('resize', () => {
    onResize();
  });
  function onResize() {
    arToolkitSource.onResizeElement();
    arToolkitSource.copyElementSizeTo(renderer.domElement);
    if (arToolkitContext.arController !== null) {
      arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
    }
  };
      
  //AR周りの設定
  const arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam'
  });
  arToolkitSource.init(() => {
    setTimeout(() => {
      onResize();
    }, 2000);
  });

  const arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl:
      THREEx.ArToolkitContext.baseURL + "../data/data/camera_para.dat",
    detectionMode: "mono",
    // ※1 作ったマーカーのPattern Ratioを入れる
    patternRatio: 0.5,
  });

  arToolkitContext.init(() => {
      camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
  });
    
  //マーカー設定  
  const marker1 = new THREE.Group();
  scene.add(marker1);
  const arMarkerControls = new THREEx.ArMarkerControls(arToolkitContext, marker1, {
    type: 'pattern',
    patternUrl: 'marker/pattern-chart.patt',
    changeMatrixMode: 'cameraTransformMatrix'
  });
  arMarkerControls.addEventListener("markerFound", () => {
    // マーカーが見つかっている時は毎秒呼ばれる
    console.log("marker found");
  });
  
  const gltfloader = new GLTFLoader();
  gltfloader.load('model/mar.gltf',function(gltf){
      model = gltf.scene;
      model.name = "model";
      model.scale.set(0.5,0.5,0.5);
      marker1.add(gltf.scene);
  });
  

  //レンダリング
  requestAnimationFrame(function animate(){
    requestAnimationFrame(animate);
    if (arToolkitSource.ready) {
      arToolkitContext.update(arToolkitSource.domElement);
      scene.visible = camera.visible;
    }
    renderer.render(scene, camera);
  });
}