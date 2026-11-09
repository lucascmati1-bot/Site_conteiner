(function () {
  const host=document.getElementById('threejs-canvas');
  if(!host)return;
  function init(){
    if(!window.THREE||!window.createResidenceModel){host.textContent='Não foi possível carregar o modelo 3D. Consulte a galeria de fotos.';return;}
    const T=window.THREE;let renderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}
    catch{host.textContent='Seu navegador não disponibilizou WebGL. Use a galeria de fotos para conhecer a residência.';return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.25));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
    host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Modelo aproximado da residência baseado nas fotografias do Airbnb');
    const scene=new T.Scene();scene.background=new T.Color(0xdce6e5);
    const camera=new T.PerspectiveCamera(42,1,.1,150);camera.position.set(15,11,18);
    const controls=new T.OrbitControls(camera,renderer.domElement);controls.target.set(-.8,1.3,1.7);controls.enableDamping=false;controls.minDistance=3;controls.maxDistance=48;controls.maxPolarAngle=Math.PI/2-.03;
    const model=createResidenceModel(T);scene.add(model.group);
    // Unir objetos estáticos com o mesmo material reduz chamadas à GPU. Manter
    // cobertura, interiores e transparências separados preserva os controles.
    function compactScope(scope,excluded=[]){
      model.group.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(scope.matrixWorld).invert(),buckets=new Map();
      function collect(node){if(excluded.includes(node))return;if(node.isMesh&&!Array.isArray(node.material)&&!node.material.transparent){const key=node.material.uuid+':'+node.castShadow+':'+node.receiveShadow;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(node);}node.children.slice().forEach(collect);}
      scope.children.slice().forEach(collect);
      for(const meshes of buckets.values()){
        if(meshes.length<3)continue;
        const positions=[],normals=[],uvs=[];
        for(const mesh of meshes){const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
          positions.push(geometry.attributes.position.array);normals.push(geometry.attributes.normal.array);uvs.push(geometry.attributes.uv?.array||new Float32Array(geometry.attributes.position.count*2));geometry.dispose();}
        const flatten=arrays=>{const result=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const array of arrays){result.set(array,offset);offset+=array.length;}return result;};
        const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(flatten(positions),3));geometry.setAttribute('normal',new T.BufferAttribute(flatten(normals),3));geometry.setAttribute('uv',new T.BufferAttribute(flatten(uvs),2));geometry.computeBoundingSphere();
        const merged=new T.Mesh(geometry,meshes[0].material);merged.name='Conjunto_estatico_otimizado';merged.castShadow=meshes[0].castShadow;merged.receiveShadow=meshes[0].receiveShadow;meshes.forEach(mesh=>mesh.parent.remove(mesh));scope.add(merged);
      }
    }
    compactScope(model.roofs);compactScope(model.interiors);compactScope(model.group,[model.roofs,model.interiors]);
    const sky=new T.HemisphereLight(0xe5f3ff,0x6c6950,.65);scene.add(sky);
    const sun=new T.DirectionalLight(0xffeccb,.95);sun.position.set(-9,21,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-16,right:16,top:15,bottom:-15,near:1,far:60});sun.shadow.bias=-.001;sun.shadow.normalBias=.035;scene.add(sun);
    const warm=new T.PointLight(0xffc077,0,18,2);warm.position.set(-5,2.7,1.3);scene.add(warm);
    const porchLight=new T.PointLight(0xffb263,0,16,2);porchLight.position.set(2,2.6,-.8);scene.add(porchLight);
    const poolLight=new T.PointLight(0x2d9cff,0,12,2);poolLight.position.set(3.5,1,4);scene.add(poolLight);
    let night=false,roofVisible=true,raf=null,target=null,visible=true;
    function requestDraw(){if(visible&&raf===null)raf=requestAnimationFrame(draw);}
    function draw(){raf=null;if(!visible)return;
      if(target){camera.position.lerp(target.position,.12);controls.target.lerp(target.target,.12);if(camera.position.distanceTo(target.position)<.02){camera.position.copy(target.position);controls.target.copy(target.target);target=null;}else requestDraw();}
      controls.update();renderer.render(scene,camera);host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);
    }
    function resize(){const w=host.clientWidth,h=host.clientHeight;if(w<2||h<2)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);requestDraw();}
    new ResizeObserver(resize).observe(host);
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting&&!document.hidden;if(visible)requestDraw();},{rootMargin:'100px'}).observe(host);
    document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible)requestDraw();});
    controls.addEventListener('change',requestDraw);controls.addEventListener('start',()=>{target=null;requestDraw();});
    function setRoof(show){roofVisible=show;model.roofs.visible=show;renderer.shadowMap.needsUpdate=true;const btn=document.getElementById('toggle-roof-btn');if(btn){btn.textContent=show?'Ver sem telhado':'Mostrar telhado';btn.setAttribute('aria-pressed',String(!show));}requestDraw();}
    document.getElementById('toggle-roof-btn')?.addEventListener('click',()=>setRoof(!roofVisible));
    function view(key){const preset=model.views[key]||model.views.geral;setRoof(key!=='topo'&&key!=='quarto');target=null;camera.position.set(...preset.position);controls.target.set(...preset.target);controls.update();requestDraw();}
    document.querySelectorAll('.cam-preset-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.cam-preset-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');view(btn.dataset.preset);}));
    document.getElementById('reset-cam-btn')?.addEventListener('click',()=>{setRoof(true);view('geral');});
    document.getElementById('toggle-light-btn')?.addEventListener('click',()=>{night=!night;renderer.shadowMap.needsUpdate=true;scene.background.setHex(night?0x111d33:0xdce6e5);sky.intensity=night?.24:.65;sun.intensity=night?.14:.95;warm.intensity=night?5:0;porchLight.intensity=night?4:0;poolLight.intensity=night?3:0;renderer.toneMappingExposure=night?1.1:.92;document.getElementById('light-mode-text').textContent=night?'Ver durante o dia':'Ver à noite';requestDraw();});
    const canvas=document.getElementById('canvas-container'),gallery=document.getElementById('photo-gallery-container');
    const btn3d=document.getElementById('view-mode-3d-btn'),btnPhotos=document.getElementById('view-mode-photos-btn');
    function mode(is3d){canvas?.classList.toggle('hidden',!is3d);gallery?.classList.toggle('hidden',is3d);btn3d?.classList.toggle('bg-forest-600',is3d);btnPhotos?.classList.toggle('bg-forest-600',!is3d);if(is3d){visible=true;resize();}}
    btn3d?.addEventListener('click',()=>mode(true));btnPhotos?.addEventListener('click',()=>mode(false));
    host.dataset.modelReady='true';host.dataset.modelSource='airbnb-1213833985011094710';resize();requestDraw();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
