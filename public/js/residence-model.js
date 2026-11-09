/* Modelo aproximado a partir das fotos do anúncio Airbnb 1213833985011094710.
 * Dimensões e divisões internas estimadas; não é levantamento arquitetônico.
 * Coordenadas em metros, eixo Y vertical. Sem texturas ou serviços externos.
 */
(function (root) {
  root.createResidenceModel = function (T) {
    const house = new T.Group(); house.name = 'Casa_Piracaia_reconstrucao_aproximada';
    house.userData = { source: 'https://www.airbnb.com.br/rooms/1213833985011094710', dimensions: 'estimated', units: 'meters' };
    const roofs = new T.Group(); roofs.name = 'Coberturas_removiveis'; house.add(roofs);
    const interiors = new T.Group(); interiors.name = 'Interiores_distribuicao_estimada'; house.add(interiors);
    const material = (color, opts = {}) => new T.MeshStandardMaterial({ color: new T.Color(color).convertSRGBToLinear(), roughness: 0.82, ...opts });
    const m = { yellow: material(0xd5b23e), cream: material(0xe7ddbd), wood: material(0x754626), darkWood: material(0x452c21),
      roof: material(0xa95738), roofEdge: material(0x6e3527), stone: material(0xd3c39b), grass: material(0x6e8747),
      glass: material(0xa9d8dd, { transparent: true, opacity: 0.18, roughness: 0.12, metalness: 0.1, depthWrite: false, side: T.DoubleSide }),
      white: material(0xe8e9df), black: material(0x292d2d), metal: material(0x9ca8a8, {metalness:0.7,roughness:0.3}),
      water: material(0x249cac, { transparent: true, opacity: 0.95, roughness: 0.18, metalness: 0.15, side: T.DoubleSide }),
      pool: material(0x64c8df), soil: material(0x9e7155), terracotta: material(0x8f4b35), leaf: material(0x3e6740),
      linen: material(0xe4d9c3), hammock: material(0x963b4a), redFloor: material(0x9b5142), brick: material(0xb06f45) };
    const boxGeo = new T.BoxGeometry(1, 1, 1);
    function box(name,x,y,z,w,h,d,mat,parent=house) {
      const o=new T.Mesh(boxGeo,mat);o.name=name;o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
    }
    function cylinder(name,x,y,z,r,h,mat,parent=house,segments=20) {
      const o=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
    }
    function beam(name,a,b,r,mat,parent=house) {
      const start=new T.Vector3(...a),end=new T.Vector3(...b),v=end.clone().sub(start);
      const o=cylinder(name,0,0,0,r,v.length(),mat,parent,10);o.position.copy(start.add(end).multiplyScalar(0.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;
    }
    function poly(name,points,y,mat,parent=house,depth=0.06) {
      const s=new T.Shape();s.moveTo(points[0][0],points[0][1]);points.slice(1).forEach(p=>s.lineTo(p[0],p[1]));s.closePath();
      const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false});geo.rotateX(Math.PI/2);
      const mesh=new T.Mesh(geo,mat);mesh.name=name;mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    }
    let seed=71;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const stonePalette = [0xd5c7a7,0xcab995,0xe1d5b9,0xbfb294,0xd0c2a2,0xddd0ae].map(c=>material(c));
    function stoneArea(cx,cz,w,d,y,cutout=null) {
      if(!cutout)box('Base_do_piso_de_pedra',cx,y-0.07,cz,w,0.12,d,m.stone);
      else {
        const s=new T.Shape();s.moveTo(cx-w/2,cz-d/2);s.lineTo(cx+w/2,cz-d/2);s.lineTo(cx+w/2,cz+d/2);s.lineTo(cx-w/2,cz+d/2);s.closePath();
        const hole=new T.Path();const points=cutout.getPoints(48);points.forEach((p,i)=>i?hole.lineTo(p.x+cx,p.y+cz):hole.moveTo(p.x+cx,p.y+cz));hole.closePath();s.holes.push(hole);
        const geometry=new T.ExtrudeGeometry(s,{depth:.22,bevelEnabled:false});geometry.rotateX(Math.PI/2);const deck=new T.Mesh(geometry,m.stone);deck.position.y=y;deck.name='Borda_piscina_com_abertura';deck.receiveShadow=true;deck.castShadow=true;house.add(deck);
      }
      for(let x=cx-w/2+.2;x<cx+w/2-.3;x+=.7)for(let z=cz-d/2+.2;z<cz+d/2-.3;z+=.65){
        if(cutout){const inside=(px,pz)=>{const dx=px-cx,dz=pz-cz;return (dx> -1.91&&dx<1.91&&dz> -2.51&&dz<2.21)||(dz>=2.1&&dx*dx+(dz-2.15)**2<.97**2);};if([[x-.05,z],[x+.64,z],[x+.64,z+.6],[x-.05,z+.6],[x+.3,z+.3]].some(p=>inside(...p)))continue;}
        const mat=stonePalette[Math.floor(rnd()*stonePalette.length)];
        poly('Pedra_irregular',[[x,z],[x+.5+rnd()*.12,z+.03],[x+.64,z+.36],[x+.35,z+.59],[x-.05,z+.4]],y+.006,mat);
      }
    }
    // Implantação observada: pavilhão envidraçado à esquerda, ala amarela ao fundo,
    // piscina à direita e fogueira no gramado em frente. Distâncias aproximadas.
    box('Terreno',0,-.28,1.5,25,.5,21,m.soil);
    box('Gramado',0,-.015,1.5,25,.05,21,m.grass);
    box('Base_ala_container',1.2,.22,-3.7,12.4,.46,3.25,m.redFloor);
    box('Piso_dos_quartos',1.2,.48,-3.7,12.1,.08,3,m.darkWood,interiors);
    box('Parede_posterior_amarela',1.2,1.86,-5.22,12.3,2.7,.12,m.yellow);
    box('Lateral_esquerda',-4.9,1.86,-3.7,.12,2.7,3,m.yellow);
    box('Lateral_direita',7.3,1.86,-3.7,.12,2.7,3,m.yellow);
    box('Faixa_amarela_acima_das_portas',1.2,3,-2.16,12.3,.4,.12,m.yellow);
    // Relevos das paredes do contêiner aparecem sob a pintura amarela.
    for(let x=-4.8;x<7.3;x+=.23)box('Friso_container',x,1.85,-5.3,.045,2.6,.035,m.yellow);
    for(const x of [-4.35,-.8,2.5,6.6])box('Parede_frontal',x,1.75,-2.17,x===-4.35?1.1:1.3,2.45,.12,m.yellow);
    for(const x of [-2.55,.85,4.65]){
      box('Porta_branca',x,1.56,-2.12,.87,2.05,.07,m.white);
      box('Vidro_da_porta',x,1.8,-2.07,.67,1.3,.025,m.glass);
      cylinder('Macaneta',x+.31,1.5,-2.015,.035,.14,m.metal).rotation.x=Math.PI/2;
    }
    function windowFront(x,z,w=1.15){
      box('Moldura_janela',x,1.93,z,w+.12,1.22,.09,m.white);
      box('Janela_vidro',x,1.93,z+.055,w,1.08,.025,m.glass);
      box('Divisoria_janela',x,1.93,z+.08,.035,1.1,.035,m.white);
    }
    windowFront(6.35,-2.07,.95);windowFront(-4.3,-2.07,.6);
    // Varanda com pilares, guarda-corpo, treliça e redes.
    box('Varanda_piso',1.65,.43,-.92,11.3,.16,2.35,m.stone);
    box('Rodape_varanda',1.65,.22,.27,11.3,.4,.14,m.redFloor);
    for(const x of [-3.85,-.3,3.25,7.15]){
      box('Pilar_madeira_varanda',x,1.98,.15,.18,3.1,.18,m.wood);
      box('Pedestal_pilar',x,.7,.15,.3,.38,.3,m.stone);
    }
    box('Viga_frontal_varanda',1.65,3.4,.15,11.45,.2,.18,m.wood);
    for(const pair of [[-3.8,-.4],[3.4,7]]){
      box('Corrimao_varanda',(pair[0]+pair[1])/2,1.28,.23,pair[1]-pair[0],.1,.09,m.wood);
      box('Travessa_varanda',(pair[0]+pair[1])/2,.85,.23,pair[1]-pair[0],.08,.08,m.wood);
      for(let x=pair[0];x<pair[1];x+=.55)box('Balaustre',x,1.02,.23,.07,.65,.07,m.wood);
    }
    function hammock(left,right,z){
      const positions=[],indices=[],steps=22,width=.68;
      for(let i=0;i<=steps;i++){const u=i/steps,x=left+.28+(right-left-.56)*u,y=2.12-1.08*Math.sin(Math.PI*u);for(const side of [-1,1])positions.push(x,y+Math.sin(Math.PI*u)*.12,z+side*width/2*Math.sin(Math.PI*u));}
      for(let i=0;i<steps;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
      const fabric=m.hammock.clone();fabric.side=T.DoubleSide;const o=new T.Mesh(geo,fabric);o.name='Rede_na_varanda';o.castShadow=true;house.add(o);
      beam('Corda_rede',[left,2.22,.15],[left+.28,2.12,z],.018,m.linen);
      beam('Corda_rede',[right-.28,2.12,z],[right,2.22,.15],.018,m.linen);
    }
    hammock(-3.85,-.3,-.55);hammock(3.25,7.15,-.55);
    box('Degrau_varanda_1',1.65,.12,.83,1.8,.24,.5,m.redFloor);
    box('Degrau_varanda_2',1.65,.3,.5,1.8,.24,.5,m.redFloor);
    // Telhado de uma água sobre a ala e a varanda.
    const roofY=z=>3.44+.04*(z+2.38);
    const outline=[[-5.3,-5.65],[7.65,-5.65],[7.65,.9],[-1.92,.9],[-1.92,-1.78],[-5.3,-1.78]];
    const mainRoof=poly('Telhado_ala_e_varanda',outline,0,m.roof,roofs,.12);
    const rp=mainRoof.geometry.attributes.position;for(let i=0;i<rp.count;i++)rp.setY(i,rp.getY(i)+roofY(rp.getZ(i)));mainRoof.geometry.computeVertexNormals();
    for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];beam('Testeira_telhas',[a[0],roofY(a[1])-.055,a[1]],[b[0],roofY(b[1])-.055,b[1]],.065,m.roofEdge,roofs);}
    for(let x=-5.25;x<=7.6;x+=.24){const end=x<-1.92?-1.78:.9;beam('Canal_telhas_ala',[x,roofY(-5.65)+.02,-5.65],[x,roofY(end)+.02,end],.021,m.roofEdge,roofs);}
    box('Fechamento_superior_posterior',1.2,3.25,-5.22,12.3,.2,.13,m.yellow);
    // Pavilhão gourmet: mureta amarela e grandes panos de vidro, telhado quatro águas.
    const gx=-5.05,gz=1.35,gw=5.55,gd=5.55;
    box('Base_gourmet',gx,.22,gz,gw,.45,gd,m.redFloor);
    box('Piso_gourmet',gx,.48,gz,gw-.1,.07,gd-.1,m.stone,interiors);
    for(const z of [gz-gd/2,gz+gd/2]){
      box('Mureta_gourmet',gx,.95,z,gw,.9,.13,m.yellow);
      box('Vidro_gourmet',gx,2.11,z,gw-.1,1.45,.035,m.glass);
      for(let x=gx-gw/2;x<=gx+gw/2+.01;x+=gw/6)box('Montante_branco',x,2.14,z+.03,.045,1.6,.045,m.white);
    }
    for(const x of [gx-gw/2,gx+gw/2]){
      box('Mureta_lateral_gourmet',x,.95,gz,.13,.9,gd,m.yellow);
      box('Vidro_lateral_gourmet',x,2.11,gz,.035,1.45,gd,m.glass);
      for(let z=gz-gd/2;z<=gz+gd/2+.01;z+=gd/6)box('Montante_lateral',x,2.14,z,.045,1.6,.045,m.white);
    }
    for(const x of [gx-gw/2,gx+gw/2])for(const z of [gz-gd/2,gz+gd/2])box('Pilar_amarelo_gourmet',x,1.95,z,.22,3,.22,m.yellow);
    for(const z of [gz-gd/2,gz+gd/2]){box('Viga_apoio_gourmet',gx,3.36,z,gw+.18,.22,.2,m.wood);box('Faixa_entre_vidro_e_telhado',gx,3.04,z,gw-.2,.44,.1,m.cream);}
    for(const x of [gx-gw/2,gx+gw/2]){box('Viga_apoio_lateral_gourmet',x,3.36,gz,.2,.22,gd+.18,m.wood);box('Faixa_lateral_superior',x,3.04,gz,.1,.44,gd-.2,m.cream);}
    // Abertura de acesso ao gourmet (pano móvel de vidro).
    box('Degraus_entrada_gourmet',gx+gw/2+.25,.25,gz-.5,.6,.3,1.2,m.redFloor);
    function hipRoof(cx,cz,w,d,eave,peak){
      const vertices=[cx-w/2,eave,cz-d/2,cx+w/2,eave,cz-d/2,cx+w/2,eave,cz+d/2,cx-w/2,eave,cz+d/2,cx-.55,peak,cz,cx+.55,peak,cz];
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]);geo.computeVertexNormals();
      const roofMat=m.roof.clone();roofMat.side=T.DoubleSide;const roof=new T.Mesh(geo,roofMat);roof.name='Telhado_quatro_aguas_gourmet';roof.castShadow=true;roofs.add(roof);
      for(const [a,b] of [[[cx-w/2,eave,cz-d/2],[cx-.55,peak,cz]],[[cx+w/2,eave,cz-d/2],[cx+.55,peak,cz]],[[cx-w/2,eave,cz+d/2],[cx-.55,peak,cz]],[[cx+w/2,eave,cz+d/2],[cx+.55,peak,cz]],[[cx-.55,peak,cz],[cx+.55,peak,cz]]])beam('Cumeeira',a,b,.075,m.roofEdge,roofs);
      for(let i=0;i<=30;i++){
        const x=cx-w/2+w*i/30,rx=Math.max(cx-.55,Math.min(cx+.55,x));
        beam('Canal_telhas_gourmet',[x,eave+.025,cz+d/2],[rx,peak+.025,cz],.025,m.roofEdge,roofs);
        beam('Canal_telhas_gourmet',[x,eave+.025,cz-d/2],[rx,peak+.025,cz],.025,m.roofEdge,roofs);
      }
      for(let i=0;i<=22;i++){const z=cz-d/2+d*i/22;beam('Canal_telhas_lateral',[cx-w/2,eave+.025,z],[cx-.55,peak+.025,cz],.022,m.roofEdge,roofs);beam('Canal_telhas_lateral',[cx+w/2,eave+.025,z],[cx+.55,peak+.025,cz],.022,m.roofEdge,roofs);}
    }
    hipRoof(gx,gz,6.25,6.25,3.35,4.65);
    // Mesa comprida e cadeiras cruzadas vistas nas fotos.
    function chair(x,z,angle=0,parent=interiors,floor=.52){const g=new T.Group();g.name='Cadeira_madeira';g.userData.floorY=floor;parent.add(g);g.position.set(x,floor,z);g.rotation.y=angle;
      box('Assento',0,.49,0,.56,.08,.56,m.wood,g);for(const a of [-.22,.22])for(const b of [-.22,.22])box('Pe_cadeira',a,.24,b,.055,.48,.055,m.wood,g);
      box('Encosto',0,1.01,-.25,.54,.075,.06,m.wood,g);for(const a of [-.24,.24])box('Haste_encosto',a,.76,-.25,.055,.56,.055,m.wood,g);
      beam('Cruz_encosto',[-.22,.63,-.25],[.22,.96,-.25],.018,m.wood,g);beam('Cruz_encosto',[.22,.63,-.25],[-.22,.96,-.25],.018,m.wood,g);
      for(const x of [-.3,.3]){box('Braco_cadeira',x,.72,.015,.065,.06,.65,m.wood,g);box('Apoio_braco',x,.61,.2,.045,.2,.045,m.wood,g);}return g;}
    box('Mesa_gourmet',gx,1.3,gz+.35,3.2,.14,1.15,m.wood,interiors);
    for(const x of [gx-1.25,gx+1.25])for(const z of [gz,gz+.7])box('Pe_mesa',x,.9,z,.1,.75,.1,m.darkWood,interiors);
    for(const x of [gx-1,gx,gx+1]){chair(x,gz-0.55,0);chair(x,gz+1.25,Math.PI);}
    const brickMat=m.brick;
    box('Churrasqueira_base',gx-1.7,1.25,gz-1.85,1.2,1.5,.85,brickMat,interiors);
    box('Churrasqueira_abertura',gx-1.7,1.6,gz-1.39,.85,.65,.04,m.black,interiors);
    box('Chamine_churrasqueira',gx-1.7,2.55,gz-1.85,.8,1.5,.7,brickMat,interiors);
    box('Fogao_a_lenha',gx-.15,.93,gz-1.9,1.45,.8,.8,brickMat,interiors);
    box('Chapa_fogao',gx-.15,1.36,gz-1.9,1.5,.07,.84,m.black,interiors);
    for(const x of [gx-.55,gx+.15])cylinder('Boca_fogao',x,1.4,gz-1.9,.17,.02,m.metal,interiors);
    box('Forno_ferro',gx-.15,1.04,gz-1.46,.55,.35,.05,m.black,interiors);
    // Cômodos internos representados como estudo, sem alegar uma planta medida.
    for(const x of [-.9,2.45])box('Divisoria_interna_estimada',x,1.78,-3.7,.1,2.5,3,m.cream,interiors);
    for(const x of [-2.6,.75]){
      for(const y of [.9,1.95]){
        box('Cama_beliche_estrutura',x,y-.1,-4,1.48,.18,2,m.darkWood,interiors);
        box('Colchao',x,y+.06,-4,1.4,.18,1.9,m.linen,interiors);
        box('Travesseiro',x,y+.18,-4.62,1,.11,.4,m.white,interiors);
      }
      for(const a of [-.77,.77])for(const z of [-5,-3])box('Montante_beliche',x+a,1.45,z,.09,2.05,.09,m.wood,interiors);
      for(let y=.75;y<1.9;y+=.25)box('Degrau_beliche',x+.74,y,-3.5,.08,.05,.55,m.wood,interiors);
    }
    box('Cozinha_compacta',5.5,.95,-4.75,2.4,.85,.58,m.white,interiors);
    box('Bancada_cozinha',5.5,1.42,-4.75,2.5,.07,.65,m.black,interiors);
    box('Sofa_amarelo',4.85,.87,-3.13,1.65,.7,.7,m.yellow,interiors);
    box('Parede_banheiros_estimada',4.3,1.75,-4,.08,2.5,2.3,m.cream,interiors);
    for(const z of [-4.7,-3.5]){cylinder('Vaso_sanitario_esquematico',3.45,.76,z,.22,.48,m.white,interiors);box('Gabinete_banheiro',3,.74,z,.35,.44,.4,m.wood,interiors);box('Pia_banheiro',3,1,z,.35,.14,.4,m.white,interiors);}
    // Piscina com retângulo principal e prolongamento arredondado na extremidade.
    const px=3.5,pz=4.05;
    const poolShape=new T.Shape();poolShape.moveTo(-1.85,-2.45);poolShape.lineTo(1.85,-2.45);poolShape.lineTo(1.85,2.15);poolShape.lineTo(.9,2.15);poolShape.absarc(0,2.15,.9,0,Math.PI,false);poolShape.lineTo(-1.85,2.15);poolShape.closePath();
    stoneArea(px,pz,6.3,7.5,.27,poolShape);
    stoneArea(7.8,2.1,2.8,3.4,.27);
    const poolBaseGeo=new T.ExtrudeGeometry(poolShape,{depth:.18,bevelEnabled:false});poolBaseGeo.rotateX(Math.PI/2);
    const poolBase=new T.Mesh(poolBaseGeo,m.pool);poolBase.name='Piscina_contorno_baseado_nas_fotos';poolBase.position.set(px,.22,pz);house.add(poolBase);
    const waterGeo=new T.ShapeGeometry(poolShape,32);waterGeo.rotateX(Math.PI/2);
    const water=new T.Mesh(waterGeo,m.water);water.name='Agua_piscina';water.position.set(px,.24,pz);water.receiveShadow=true;house.add(water);
    for(let i=0;i<4;i++){const ring=new T.Mesh(new T.TorusGeometry(.22+i*.12,.006,4,32),material(0xb2edf0,{transparent:true,opacity:.22}));ring.rotation.x=-Math.PI/2;ring.position.set(px-.6,.245,pz-.9);house.add(ring);}
    for(const x of [px-1.2,px-.7]){beam('Escada_piscina',[x,.4,pz-2.4],[x,1.3,pz-2.2],.035,m.metal);beam('Escada_arco',[x,1.3,pz-2.2],[x,1.2,pz-1.85],.035,m.metal);}
    for(let y=.5;y<1.1;y+=.2)beam('Degrau_escada_piscina',[px-1.2,y,pz-2],[px-.7,y,pz-2],.025,m.metal);
    const jet=new T.CatmullRomCurve3([new T.Vector3(px-2.2,.27,pz-1.4),new T.Vector3(px-2.2,1.7,pz-1.2),new T.Vector3(px-1.7,1.8,pz-.9)]);
    const fountain=new T.Mesh(new T.TubeGeometry(jet,16,.045,8,false),m.metal);fountain.name='Cascata_piscina';house.add(fountain);
    beam('Jato_de_agua',[px-1.7,1.77,pz-.9],[px-1.5,.24,pz-.6],.016,m.water);
    // Guarda-sol azul e mesa de jardim.
    cylinder('Haste_guarda_sol',7.3,1.55,2.1,.035,2.6,m.metal);
    const umbrella=new T.Mesh(new T.ConeGeometry(1.5,.55,8),material(0x386aa6));umbrella.name='Guarda_sol_azul';umbrella.position.set(7.3,2.9,2.1);house.add(umbrella);
    cylinder('Mesa_jardim',7.3,1.08,2.1,.62,.06,m.white);cylinder('Pe_mesa_jardim',7.3,.65,2.1,.05,.8,m.metal);
    cylinder('Base_guarda_sol',7.3,.295,2.1,.25,.05,m.stone);
    chair(7.2,3.15,Math.PI,house,.27);chair(8.25,1.85,-Math.PI/2,house,.27);
    // Fogueira e cadeiras de madeira no gramado.
    const fx=-3.2,fz=7.6,fp=[];for(let i=0;i<40;i++){const a=i/40*Math.PI*2,r=2.35+.16*Math.cos(a*5);fp.push([fx+Math.cos(a)*r,fz+Math.sin(a)*r]);}
    poly('Patio_organico_fogueira',fp,.02,m.stone,house,.1);
    cylinder('Fogueira_base',fx,.19,fz,.7,.34,m.stone);
    const pit=new T.Mesh(new T.TorusGeometry(.59,.13,8,28),m.stone);pit.name='Anel_fogueira';pit.rotation.x=Math.PI/2;pit.position.set(fx,.42,fz);house.add(pit);
    cylinder('Interior_fogueira',fx,.37,fz,.48,.03,m.black);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;beam('Lenha',[fx-.35*Math.cos(a),.44,fz-.35*Math.sin(a)],[fx+.35*Math.cos(a),.5,fz+.35*Math.sin(a)],.07,m.darkWood);}
    for(const [dx,dz,rot] of [[-1.65,0,Math.PI/2],[1.65,0,-Math.PI/2],[0,1.65,Math.PI]])chair(fx+dx,fz+dz,rot,house,.02);
    // Balanço, pergolado e paisagismo observados nas fotos.
    for(const x of [-9.7,-6.7])cylinder('Poste_balanco',x,1.55,7,.1,3.1,m.wood);
    beam('Viga_balanco',[-9.95,3.1,7],[-6.45,3.1,7],.1,m.wood);
    for(const x of [-8.6,-7.8])beam('Corda_balanco',[x,3,7],[x,.78,7],.018,m.linen);
    box('Assento_balanco',-8.2,.76,7,1.1,.1,.4,m.wood);
    for(const x of [-10.5,-8.1])for(const z of [-2,.9])cylinder('Pergolado_pilar',x,1.55,z,.08,3.1,m.wood);
    for(let z=-2.2;z<1.2;z+=.42)box('Pergolado_travessa',-9.3,3.13,z,2.9,.12,.11,m.wood);
    box('Pergolado_cobertura',-9.3,3.2,-.55,2.9,.05,3.65,material(0xe0dac0,{transparent:true,opacity:.48}));
    for(let z=7;z>1;z-=.85)box('Dormente_caminho',-.35,.045,z,1.1,.06,.25,m.darkWood);
    function plant(x,z,large=false){
      if(!large)cylinder('Vaso_ceramica',x,.31,z,.3,.6,m.terracotta);
      const base=large?.05:.65;
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const geo=new T.ConeGeometry(large?.24:.12,large?1.8:1.0,5);const leaf=new T.Mesh(geo,m.leaf);leaf.position.set(x+Math.cos(a)*.2,base+.45,z+Math.sin(a)*.2);leaf.rotation.z=Math.cos(a)*.4;leaf.rotation.x=Math.sin(a)*.4;house.add(leaf);}
    }
    plant(.25,1.35);plant(6.9,6.2);plant(-1.4,5.7);
    for(let x=-8;x<8;x+=.6)plant(x,-5.65,true);
    for(let z=0;z<10;z+=.8)plant(9.7,z,true);
    // Vegetação de fundo em volumes simples, sem milhares de folhas individuais.
    const foliage=[0x456542,0x607b49,0x36573c].map(c=>material(c));
    for(const [x,z,h] of [[-10,-5.8,3.3],[-7.9,-6.5,3.8],[9,-5.8,3.5]]){
      cylinder('Tronco_arvore',x,h/2,z,.12,h,m.wood);
      for(let i=0;i<3;i++){const crown=new T.Mesh(new T.DodecahedronGeometry(.85+i*.16,1),foliage[i]);crown.name='Copa_arvore';crown.position.set(x+(i-1)*.5,h-.1+i*.12,z+(i%2)*.4);crown.scale.set(1,1.25,1);crown.castShadow=true;crown.receiveShadow=true;house.add(crown);}
    }
    // Perímetro sem reproduzir vizinhos ou coordenadas exatas do imóvel.
    for(let z=-6;z<=10;z+=2){cylinder('Mourao_cerca',-11.6,.8,z,.055,1.6,m.metal);cylinder('Mourao_cerca',11,.8,z,.055,1.6,m.metal);}
    for(const x of [-11.6,11])for(const y of [.4,.9,1.4])beam('Arame_cerca',[x,y,-6],[x,y,10],.009,m.metal);
    return { group:house, roofs, interiors, water,
      views:{geral:{position:[15,11,18],target:[-.8,1.3,1.7]},deck:{position:[11,7,12],target:[3.5,.5,3.8]},quarto:{position:[3,10,2],target:[0,1,-3.4]},topo:{position:[-.5,29,3],target:[-.5,0,1]},gourmet:{position:[-11,6,10],target:[-5,1.6,1.3]}},
      notes:'Reconstrução geométrica aproximada. Cobertura, materiais e elementos externos baseados nas fotos; medidas e planta interna estimadas.' };
  };
})(globalThis);
