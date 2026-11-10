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
    function stoneArea(cx,cz,w,d,y,cutout=null,leftInset=0) {
      if(!cutout)box('Base_do_piso_de_pedra',cx,y-0.07,cz,w,0.12,d,m.stone);
      else {
        const s=new T.Shape();s.moveTo(cx-w/2+leftInset,cz-d/2);s.lineTo(cx+w/2,cz-d/2);s.lineTo(cx+w/2,cz+d/2);s.lineTo(cx-w/2+leftInset,cz+d/2);s.closePath();
        const hole=new T.Path();const points=cutout.getPoints(48);points.forEach((p,i)=>i?hole.lineTo(p.x+cx,p.y+cz):hole.moveTo(p.x+cx,p.y+cz));hole.closePath();s.holes.push(hole);
        const geometry=new T.ExtrudeGeometry(s,{depth:.22,bevelEnabled:false});geometry.rotateX(Math.PI/2);const deck=new T.Mesh(geometry,m.stone);deck.position.y=y;deck.name='Borda_piscina_com_abertura';deck.receiveShadow=true;deck.castShadow=true;house.add(deck);
      }
      for(let x=cx-w/2+leftInset+.2;x<cx+w/2-.3;x+=.7)for(let z=cz-d/2+.2;z<cz+d/2-.3;z+=.65){
        if(cutout){const inside=(px,pz)=>{const dx=px-cx,dz=pz-cz;return (dx> -1.91&&dx<1.91&&dz> -2.51&&dz<2.21)||((dx-1.85)**2+(dz+2.45)**2<1.12**2);};if([[x-.05,z],[x+.64,z],[x+.64,z+.6],[x-.05,z+.6],[x+.3,z+.3]].some(p=>inside(...p)))continue;}
        const mat=stonePalette[Math.floor(rnd()*stonePalette.length)];
        poly('Pedra_irregular',[[x,z],[x+.5+rnd()*.12,z+.03],[x+.64,z+.36],[x+.35,z+.59],[x-.05,z+.4]],y+.006,mat);
      }
    }
    // Implantação observada: pavilhão envidraçado à esquerda, ala amarela ao fundo,
    // piscina à direita e fogueira no gramado em frente. Distâncias aproximadas.
    box('Terreno',2.35,-.28,4.5,20.3,.5,28,m.soil);
    box('Gramado',2.35,-.015,4.5,20.3,.05,28,m.grass);
    // Área cimentada em frente ao gourmet, conforme a região marcada pelo proprietário.
    const concrete=material(0xa9aaa4,{roughness:.96});
    poly('Patio_cimentado_frontal',[[-7.45,8.8],[-6.2,8.45],[-1.3,8.9],[.9,9.45],[1.25,10.5],[1.25,18.3],[-7.45,18.3]],.045,concrete,house,.08);
    box('Base_ala_container',1.2,.22,-3.7,12.4,.46,3.25,m.redFloor);
    box('Piso_dos_quartos',1.2,.48,-3.7,12.1,.08,3,m.darkWood,interiors);
    box('Parede_posterior_amarela',1.2,1.86,-5.22,12.3,2.7,.12,m.yellow);
    box('Lateral_esquerda',-4.9,1.86,-3.7,.12,2.7,3,m.yellow);
    box('Lateral_direita',7.3,1.86,-3.7,.12,2.7,3,m.yellow);
    box('Faixa_amarela_acima_das_portas',1.2,3,-2.16,12.3,.4,.12,m.yellow);
    // Relevos das paredes do contêiner aparecem sob a pintura amarela.
    for(let x=-4.8;x<7.3;x+=.23)box('Friso_container',x,1.85,-5.3,.045,2.6,.035,m.yellow);
    // Fachada contínua com vãos exatos: sem restos dos antigos vãos de portas.
    const frontWindows=[[-4.3,.6],[-2.55,.9],[4.65,.9],[6.35,.95]];
    const frontShape=new T.Shape();
    frontShape.moveTo(-4.96,.5);frontShape.lineTo(.415,.5);
    frontShape.lineTo(.415,2.585);frontShape.lineTo(1.285,2.585);frontShape.lineTo(1.285,.5);
    frontShape.lineTo(7.36,.5);frontShape.lineTo(7.36,3.2);frontShape.lineTo(-4.96,3.2);frontShape.closePath();
    for(const [x,w] of frontWindows){
      const hole=new T.Path();hole.moveTo(x-w/2,1.38);hole.lineTo(x-w/2,2.48);
      hole.lineTo(x+w/2,2.48);hole.lineTo(x+w/2,1.38);hole.closePath();frontShape.holes.push(hole);
    }
    const frontWall=new T.Mesh(new T.ExtrudeGeometry(frontShape,{depth:.12,bevelEnabled:false}),m.yellow);
    frontWall.name='Parede_frontal_continua';frontWall.position.z=-2.23;frontWall.castShadow=true;frontWall.receiveShadow=true;house.add(frontWall);
    for(const x of [.85]){
      box('Porta_branca',x,1.56,-2.12,.87,2.05,.07,m.white);
      box('Vidro_da_porta',x,1.8,-2.07,.67,1.3,.025,m.glass);
      cylinder('Macaneta',x+.31,1.5,-2.015,.035,.14,m.metal).rotation.x=Math.PI/2;
    }
    function windowFront(x,z,w=1.15){
      for(const side of [-1,1])box('Caixilho_vertical_janela',x+side*(w/2+.03),1.93,z,.06,1.22,.07,m.white);
      for(const y of [1.35,2.51])box('Caixilho_horizontal_janela',x,y,z,w+.12,.06,.07,m.white);
      box('Janela_vidro',x,1.93,z+.01,w,1.1,.025,m.glass);
      box('Divisoria_janela',x,1.93,z+.035,.035,1.1,.035,m.white);
      box('Peitoril_janela',x,1.3,z+.025,w+.18,.07,.17,m.white);
    }
    for(const [x,w] of frontWindows)windowFront(x,-2.075,w);
    // Varanda com pilares, guarda-corpo, treliça e redes.
    box('Varanda_piso',1.2,.43,-.92,12.4,.16,2.35,m.stone);
    box('Rodape_varanda',1.2,.22,.27,12.4,.4,.14,m.redFloor);
    // Base fechada nas duas pontas, sem vãos sob o piso da varanda.
    for(const x of [-4.93,7.33])box('Fechamento_lateral_base_varanda',x,.22,-.92,.14,.4,2.35,m.redFloor);
    for(const x of [-4.85,-.3,3.25,7.15]){
      box('Pilar_madeira_varanda',x,1.98,.15,.18,3.1,.18,m.wood);
      box('Pedestal_pilar',x,.7,.15,.3,.38,.3,m.stone);
    }
    box('Viga_frontal_varanda',1.15,3.4,.15,12.18,.2,.18,m.wood);
    for(const pair of [[-4.8,-.4],[3.4,7]]){
      box('Corrimao_varanda',(pair[0]+pair[1])/2,1.28,.23,pair[1]-pair[0],.1,.09,m.wood);
      box('Travessa_varanda',(pair[0]+pair[1])/2,.85,.23,pair[1]-pair[0],.08,.08,m.wood);
      for(let x=pair[0];x<pair[1];x+=.55)box('Balaustre',x,1.02,.23,.07,.65,.07,m.wood);
    }
    // Guarda-corpos laterais unem cada pilar de canto à parede do contêiner.
    for(const x of [-4.85,7.15]){
      box('Corrimao_lateral_varanda',x,1.28,-.985,.09,.1,2.27,m.wood);
      box('Travessa_lateral_varanda',x,.85,-.985,.08,.08,2.27,m.wood);
      for(let z=-2.08;z<.15;z+=.44)box('Balaustre_lateral_varanda',x,1.02,z,.07,.65,.07,m.wood);
    }
    function hammock(left,right,z){
      const positions=[],indices=[],steps=22;
      const fabricStart=left+.72,fabricEnd=right-.72;
      const leftKnot=[left+.35,2.02,z],rightKnot=[right-.35,2.02,z];
      // O tecido mantém bordas nas pontas para receber os tirantes em leque.
      for(let i=0;i<=steps;i++){const u=i/steps,x=fabricStart+(fabricEnd-fabricStart)*u,sag=Math.sin(Math.PI*u),y=1.75-.7*sag,halfWidth=.18+.22*sag;for(const side of [-1,1])positions.push(x,y,z+side*halfWidth);}
      for(let i=0;i<steps;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
      const fabric=m.hammock.clone();fabric.side=T.DoubleSide;const o=new T.Mesh(geo,fabric);o.name='Rede_na_varanda';o.castShadow=true;house.add(o);
      beam('Corda_rede_pilar_esquerdo',[left,2.48,.06],leftKnot,.018,m.linen);
      beam('Corda_rede_pilar_direito',rightKnot,[right,2.48,.06],.018,m.linen);
      for(let i=0;i<7;i++){
        const edgeZ=z-.18+.36*i/6;
        beam('Tirante_rede_esquerdo',leftKnot,[fabricStart,1.75,edgeZ],.009,m.linen);
        beam('Tirante_rede_direito',rightKnot,[fabricEnd,1.75,edgeZ],.009,m.linen);
      }
    }
    hammock(-4.85,-.3,-.55);hammock(3.25,7.15,-.55);
    const entryX=.85; // Mesmo eixo da porta central da casa.
    box('Degrau_varanda_1',entryX,.12,.83,1.8,.24,.5,m.redFloor);
    box('Degrau_varanda_2',entryX,.3,.5,1.8,.24,.5,m.redFloor);
    // Telhado de uma água sobre a ala e a varanda.
    const roofY=z=>3.44+.04*(z+2.38);
    const outline=[[-5.3,-5.65],[7.65,-5.65],[7.65,.9],[-5.3,.9]];
    const mainRoof=poly('Telhado_ala_e_varanda',outline,0,m.roof,roofs,.12);
    const rp=mainRoof.geometry.attributes.position;for(let i=0;i<rp.count;i++)rp.setY(i,rp.getY(i)+roofY(rp.getZ(i)));mainRoof.geometry.computeVertexNormals();
    for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];beam('Testeira_telhas',[a[0],roofY(a[1])-.055,a[1]],[b[0],roofY(b[1])-.055,b[1]],.065,m.roofEdge,roofs);}
    for(let x=-5.25;x<=7.6;x+=.24){const end=.9;beam('Canal_telhas_ala',[x,roofY(-5.65)+.02,-5.65],[x,roofY(end)+.02,end],.021,m.roofEdge,roofs);}
    box('Fechamento_superior_posterior',1.2,3.25,-5.22,12.3,.2,.13,m.yellow);
    // Pavilhão independente: corredor aberto entre ele e a varanda do contêiner.
    const gx=-3.4,gz=5.25,gw=5.55,gd=5.55;
    const corridorStart=.255,corridorEnd=gz-gd/2;
    const corridorLeft=gx-gw/2,corridorRight=entryX+.85;
    stoneArea((corridorLeft+corridorRight)/2,(corridorStart+corridorEnd)/2,corridorRight-corridorLeft,corridorEnd-corridorStart,.09);
    box('Base_gourmet',gx,.22,gz,gw,.45,gd,m.redFloor);
    box('Piso_gourmet',gx,.48,gz,gw-.1,.07,gd-.1,m.stone,interiors);
    for(const z of [gz-gd/2,gz+gd/2]){
      box('Mureta_gourmet',gx,.95,z,gw,.9,.13,m.yellow);
      box('Vidro_gourmet',gx,2.11,z,gw-.1,1.45,.035,m.glass);
      for(let x=gx-gw/2;x<=gx+gw/2+.01;x+=gw/6)box('Montante_branco',x,2.14,z+.03,.045,1.6,.045,m.white);
    }
    const doorZ=gz-.5,doorWidth=1.1,doorStart=doorZ-doorWidth/2,doorEnd=doorZ+doorWidth/2;
    for(const x of [gx-gw/2,gx+gw/2]){
      const entranceSide=x===gx+gw/2;
      const spans=entranceSide?[[gz-gd/2,doorStart],[doorEnd,gz+gd/2]]:[[gz-gd/2,gz+gd/2]];
      for(const [start,end] of spans){
        box('Mureta_lateral_gourmet',x,.95,(start+end)/2,.13,.9,end-start,m.yellow);
        box('Vidro_lateral_gourmet',x,2.11,(start+end)/2,.035,1.45,end-start,m.glass);
      }
      for(let z=gz-gd/2;z<=gz+gd/2+.01;z+=gd/6){
        if(entranceSide&&z>doorStart-.05&&z<doorEnd+.05)continue;
        box('Montante_lateral',x,2.14,z,.045,1.6,.045,m.white);
      }
    }
    for(const x of [gx-gw/2,gx+gw/2])for(const z of [gz-gd/2,gz+gd/2])box('Pilar_amarelo_gourmet',x,1.95,z,.22,3,.22,m.yellow);
    for(const z of [gz-gd/2,gz+gd/2]){box('Viga_apoio_gourmet',gx,3.36,z,gw+.18,.22,.2,m.wood);box('Faixa_entre_vidro_e_telhado',gx,3.04,z,gw-.2,.44,.1,m.cream);}
    for(const x of [gx-gw/2,gx+gw/2]){box('Viga_apoio_lateral_gourmet',x,3.36,gz,.2,.22,gd+.18,m.wood);box('Faixa_lateral_superior',x,3.04,gz,.1,.44,gd-.2,m.cream);}
    // Vão real na mureta, com porta de vidro entre a área gourmet e o caminho.
    const doorX=gx+gw/2+.07;
    for(const z of [doorStart,doorEnd])box('Batente_porta_gourmet',doorX,1.66,z,.09,2.3,.06,m.white);
    box('Verga_porta_gourmet',doorX,2.81,doorZ,.09,.07,doorWidth+.06,m.white);
    const door=new T.Group();door.name='Porta_vidro_gourmet';door.position.set(doorX,0,doorStart);door.rotation.y=Math.PI/6;house.add(door);
    box('Folha_vidro_porta_gourmet',0,1.66,doorWidth/2,.025,2.15,doorWidth-.1,m.glass,door);
    for(const z of [.035,doorWidth-.035])box('Perfil_vertical_porta_gourmet',0,1.66,z,.055,2.22,.055,m.white,door);
    for(const y of [.55,2.77])box('Perfil_horizontal_porta_gourmet',0,y,doorWidth/2,.055,.055,doorWidth,m.white,door);
    beam('Puxador_porta_gourmet',[.075,1.35,doorWidth-.14],[.075,1.7,doorWidth-.14],.018,m.metal,door);
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
    const diningStart=interiors.children.length;
    box('Mesa_gourmet',gx,1.3,gz+.35,3.2,.14,1.15,m.wood,interiors);
    for(const x of [gx-1.25,gx+1.25])for(const z of [gz,gz+.7])box('Pe_mesa',x,.9,z,.1,.75,.1,m.darkWood,interiors);
    for(const x of [gx-1,gx,gx+1]){chair(x,gz-0.55,0);chair(x,gz+1.25,Math.PI);}
    const dining=new T.Group();dining.name='Mesa_e_cadeiras_alinhadas';
    dining.position.set(gx+.8,0,gz);dining.rotation.y=Math.PI/2;
    for(const item of interiors.children.slice(diningStart)){
      item.position.x-=gx;item.position.z-=gz+.35;dining.add(item);
    }
    interiors.add(dining);
    const cookingStart=interiors.children.length;
    const brickMat=m.brick;
    box('Churrasqueira_base',gx-1.7,1.25,gz-1.85,1.2,1.5,.85,brickMat,interiors);
    box('Churrasqueira_abertura',gx-1.7,1.6,gz-1.39,.85,.65,.04,m.black,interiors);
    box('Chamine_churrasqueira',gx-1.7,2.55,gz-1.85,.8,1.5,.7,brickMat,interiors);
    box('Fogao_a_lenha',gx-.15,.93,gz-1.9,1.45,.8,.8,brickMat,interiors);
    box('Chapa_fogao',gx-.15,1.36,gz-1.9,1.5,.07,.84,m.black,interiors);
    for(const x of [gx-.55,gx+.15])cylinder('Boca_fogao',x,1.4,gz-1.9,.17,.02,m.metal,interiors);
    box('Forno_ferro',gx-.15,1.04,gz-1.46,.55,.35,.05,m.black,interiors);
    // Conjunto na linha vermelha da referência, mesa longitudinal na linha azul.
    const cooking=new T.Group();cooking.name='Churrasqueira_e_fogao_lateral_esquerda';
    cooking.position.set(gx-.435,0,gz-2.1);cooking.rotation.y=Math.PI/2;
    for(const item of interiors.children.slice(cookingStart)){
      item.position.x-=gx;item.position.z-=gz;cooking.add(item);
    }
    interiors.add(cooking);
    // Pia na marcação azul e balcão longitudinal na marcação preta.
    box('Gabinete_pia_gourmet',gx-2.2,.99,gz+1.8,.7,.92,1.5,m.wood,interiors);
    box('Tampo_pia_gourmet',gx-2.2,1.49,gz+1.8,.76,.08,1.56,m.black,interiors);
    box('Borda_cuba_pia_gourmet',gx-2.2,1.54,gz+1.65,.53,.025,.65,m.metal,interiors);
    box('Interior_cuba_pia_gourmet',gx-2.2,1.555,gz+1.65,.43,.012,.55,m.black,interiors);
    beam('Torneira_pia_gourmet',[gx-2.45,1.54,gz+1.65],[gx-2.45,1.88,gz+1.65],.025,m.metal,interiors);
    beam('Bica_pia_gourmet',[gx-2.45,1.88,gz+1.65],[gx-2.2,1.88,gz+1.65],.025,m.metal,interiors);
    box('Base_balcao_gourmet',gx-.9,.99,gz+1.8,.62,.92,1.8,m.wood,interiors);
    box('Tampo_balcao_gourmet',gx-.9,1.49,gz+1.8,.76,.08,1.88,m.black,interiors);
    // Distribuição baseada na planta fornecida: dormitórios de 3 m nas pontas,
    // sala/cozinha central e um único BWC ao lado do dormitório 01.
    for(const x of [-1.9,4.3])box('Divisoria_dormitorio_planta',x,1.78,-4,.1,2.5,2.3,m.cream,interiors);
    for(const x of [-3.4,5.8]){
      box('Cama_dormitorio',x,.77,-4,1.48,.3,2,m.darkWood,interiors);
      box('Colchao_dormitorio',x,.99,-4,1.4,.2,1.9,m.linen,interiors);
      box('Cabeceira_dormitorio',x,1.12,-5,1.55,1.1,.1,m.wood,interiors);
      for(const dx of [-.36,.36])box('Travesseiro_dormitorio',x+dx,1.14,-4.62,.6,.13,.4,m.white,interiors);
    }
    // Banheiro de aproximadamente 2,1 x 1,3 m, junto à parede posterior.
    box('Piso_banheiro_unico',-.8,.535,-4.5,2.1,.035,1.3,m.white,interiors);
    box('Parede_lateral_banheiro',.25,1.78,-4.5,.08,2.5,1.3,m.cream,interiors);
    box('Parede_frontal_banheiro_esquerda',-1.3,1.78,-3.85,1.1,2.5,.08,m.cream,interiors);
    box('Parede_frontal_banheiro_direita',.1,1.78,-3.85,.3,2.5,.08,m.cream,interiors);
    box('Verga_porta_banheiro',-.4,2.87,-3.85,.7,.32,.08,m.cream,interiors);
    box('Gabinete_banheiro',-1.45,.78,-4.86,.45,.5,.42,m.wood,interiors);
    box('Pia_banheiro',-1.45,1.06,-4.86,.48,.1,.45,m.white,interiors);
    cylinder('Vaso_sanitario_unico',-.8,.78,-4.75,.19,.48,m.white,interiors);
    box('Caixa_descarga_banheiro',-.8,.99,-5,.36,.5,.16,m.white,interiors);
    box('Base_box_banheiro',-.1,.57,-4.65,.6,.06,.95,m.white,interiors);
    box('Vidro_box_banheiro',-.42,1.56,-4.65,.025,1.9,.95,m.glass,interiors);
    beam('Chuveiro_banheiro',[.15,2.5,-4.8],[-.1,2.5,-4.8],.025,m.metal,interiors);
    // Cozinha no fundo da área central, como na planta.
    box('Cozinha_compacta',2.55,.95,-4.75,2.15,.85,.58,m.white,interiors);
    box('Bancada_cozinha',2.55,1.42,-4.75,2.25,.07,.65,m.black,interiors);
    box('Cuba_pia_cozinha',2.95,1.465,-4.75,.55,.035,.4,m.metal,interiors);
    beam('Torneira_cozinha',[2.95,1.47,-4.98],[2.95,1.72,-4.98],.02,m.metal,interiors);
    box('Cooktop_cozinha',1.95,1.465,-4.75,.5,.025,.45,m.black,interiors);
    for(const x of [1.82,2.08])for(const z of [-4.87,-4.63])cylinder('Boca_cooktop',x,1.485,z,.065,.015,m.metal,interiors);
    box('Geladeira_cozinha',3.92,1.43,-4.75,.58,1.8,.65,m.white,interiors);
    box('Puxador_geladeira',4.1,1.55,-4.39,.035,.45,.04,m.metal,interiors);
    box('Sofa_sala_integrada',.9,.86,-4.7,.75,.65,.8,m.linen,interiors);
    box('Encosto_sofa_sala',.9,1.18,-5,.75,.65,.15,m.linen,interiors);
    // Vista de frente para a casa: parte arredondada na diagonal do canto superior direito.
    const px=7.3-6.3/2,pz=5.8; // Faixa livre entre a varanda e a piscina para o conjunto azul.
    const poolShape=new T.Shape();poolShape.moveTo(-1.85,-2.45);poolShape.lineTo(.8,-2.45);poolShape.absarc(1.85,-2.45,1.05,Math.PI,Math.PI*2.5,false);poolShape.lineTo(1.85,2.15);poolShape.lineTo(-1.85,2.15);poolShape.closePath();
    stoneArea(px,pz,6.3,7.5,.27,poolShape,1.05);
    const gardenX=4.2,gardenZ=1.3;
    // O piso da tenda termina antes da borda: não cobre a parte circular da água.
    stoneArea(px+.525,1.025,5.25,1.95,.27);
    const poolBaseGeo=new T.ExtrudeGeometry(poolShape,{depth:.18,bevelEnabled:false});poolBaseGeo.rotateX(Math.PI/2);
    const poolBase=new T.Mesh(poolBaseGeo,m.pool);poolBase.name='Piscina_contorno_baseado_nas_fotos';poolBase.position.set(px,.22,pz);house.add(poolBase);
    const waterGeo=new T.ShapeGeometry(poolShape,32);waterGeo.rotateX(Math.PI/2);
    const water=new T.Mesh(waterGeo,m.water);water.name='Agua_piscina';water.position.set(px,.24,pz);water.receiveShadow=true;house.add(water);
    for(let i=0;i<4;i++){const ring=new T.Mesh(new T.TorusGeometry(.12+i*.08,.006,4,32),material(0xb2edf0,{transparent:true,opacity:.22}));ring.rotation.x=-Math.PI/2;ring.name='Ondas_impacto_cascata';ring.position.set(px+1.4,.245,pz+1.4);house.add(ring);}
    // Cascata no canto inferior direito, com a saída voltada para a água.
    const jet=new T.CatmullRomCurve3([new T.Vector3(px+2.2,.27,pz+1.4),new T.Vector3(px+2.2,1.7,pz+1.4),new T.Vector3(px+1.7,1.8,pz+1.4)]);
    const fountain=new T.Mesh(new T.TubeGeometry(jet,16,.045,8,false),m.metal);fountain.name='Cascata_piscina';house.add(fountain);
    beam('Jato_de_agua',[px+1.7,1.77,pz+1.4],[px+1.4,.24,pz+1.4],.016,m.water);
    // Guarda-sol azul e mesa de jardim.
    cylinder('Haste_guarda_sol',gardenX,1.55,gardenZ,.035,2.6,m.metal);
    const umbrella=new T.Mesh(new T.ConeGeometry(1.5,.55,8),material(0x386aa6));umbrella.name='Guarda_sol_azul';umbrella.position.set(gardenX,2.9,gardenZ);house.add(umbrella);
    cylinder('Mesa_jardim',gardenX,1.08,gardenZ,.62,.06,m.white);cylinder('Pe_mesa_jardim',gardenX,.65,gardenZ,.05,.8,m.metal);
    cylinder('Base_guarda_sol',gardenX,.295,gardenZ,.25,.05,m.stone);
    chair(gardenX-1.05,gardenZ,Math.PI/2,house,.27);chair(gardenX+1.05,gardenZ,-Math.PI/2,house,.27);
    // Fogueira e cadeiras de madeira no gramado.
    const fx=4.7,fz=12.1,fp=[];for(let i=0;i<40;i++){const a=i/40*Math.PI*2,r=2.05+.12*Math.cos(a*5);fp.push([fx+Math.cos(a)*r,fz+Math.sin(a)*r]);}
    poly('Patio_organico_fogueira',fp,.02,m.stone,house,.1);
    cylinder('Fogueira_base',fx,.19,fz,.7,.34,m.stone);
    const pit=new T.Mesh(new T.TorusGeometry(.59,.13,8,28),m.stone);pit.name='Anel_fogueira';pit.rotation.x=Math.PI/2;pit.position.set(fx,.42,fz);house.add(pit);
    cylinder('Interior_fogueira',fx,.37,fz,.48,.03,m.black);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;beam('Lenha',[fx-.35*Math.cos(a),.44,fz-.35*Math.sin(a)],[fx+.35*Math.cos(a),.5,fz+.35*Math.sin(a)],.07,m.darkWood);}
    for(const [dx,dz,rot] of [[-1.65,0,Math.PI/2],[1.65,0,-Math.PI/2],[0,1.65,Math.PI],[0,-1.65,0]])chair(fx+dx,fz+dz,rot,house,.02);
    // Balanço e paisagismo. Sem pergolado, conforme orientação do proprietário.
    const sx=fx,sz=fz+4;
    const swing=new T.Group();swing.name='Balanco';swing.position.set(sx,0,sz);swing.rotation.y=Math.PI/2;house.add(swing);
    for(const x of [-1.5,1.5])cylinder('Poste_balanco',x,1.55,0,.1,3.1,m.wood,swing);
    beam('Viga_balanco',[-1.75,3.1,0],[1.75,3.1,0],.1,m.wood,swing);
    for(const x of [-.4,.4])beam('Corda_balanco',[x,3,0],[x,.78,0],.018,m.linen,swing);
    box('Assento_balanco',0,.76,0,1.1,.1,.4,m.wood,swing);
    // Faixa de entrada marcada pelo proprietário, entre o gourmet e a piscina.
    stoneArea(entryX,5,1.6,8,.09);
    for(let z=8.5;z>1;z-=.85)box('Dormente_caminho',entryX,.12,z,1.1,.06,.25,m.darkWood);
    function plant(x,z,large=false){
      if(!large)cylinder('Vaso_ceramica',x,.31,z,.3,.6,m.terracotta);
      const base=large?.05:.65;
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const geo=new T.ConeGeometry(large?.24:.12,large?1.8:1.0,5);const leaf=new T.Mesh(geo,m.leaf);leaf.position.set(x+Math.cos(a)*.2,base+.45,z+Math.sin(a)*.2);leaf.rotation.z=Math.cos(a)*.4;leaf.rotation.x=Math.sin(a)*.4;house.add(leaf);}
    }
    plant(-1.9,.65);plant(6.9,6.2);
    for(let x=-7.2;x<8;x+=.6)plant(x,-5.65,true);
    for(let z=0;z<10;z+=.8)plant(9.7,z,true);
    // Vegetação de fundo em volumes simples, sem milhares de folhas individuais.
    const foliage=[0x456542,0x607b49,0x36573c].map(c=>material(c));
    for(const [x,z,h] of [[-6.5,-7.3,3.3],[-4.3,-7.4,3.8],[9,-5.8,3.5]]){
      cylinder('Tronco_arvore',x,h/2,z,.12,h,m.wood);
      for(let i=0;i<3;i++){const crown=new T.Mesh(new T.DodecahedronGeometry(.85+i*.16,1),foliage[i]);crown.name='Copa_arvore';crown.position.set(x+(i-1)*.5,h-.1+i*.12,z+(i%2)*.4);crown.scale.set(1,1.25,1);crown.castShadow=true;crown.receiveShadow=true;house.add(crown);}
    }
    // Perímetro sem reproduzir vizinhos ou coordenadas exatas do imóvel.
    for(let z=-6;z<=18;z+=2){cylinder('Mourao_cerca',-7.6,.8,z,.055,1.6,m.metal);cylinder('Mourao_cerca',11,.8,z,.055,1.6,m.metal);}
    for(const x of [-7.6,11])for(const y of [.4,.9,1.4])beam('Arame_cerca',[x,y,-6],[x,y,18],.009,m.metal);
    return { group:house, roofs, interiors, water,
      views:{geral:{position:[15,11,18],target:[-.8,1.3,1.7]},deck:{position:[11,7,12],target:[3.5,.5,3.8]},quarto:{position:[3,10,2],target:[0,1,-3.4]},topo:{position:[-.5,29,3],target:[-.5,0,1]},gourmet:{position:[-11,6,13],target:[gx,1.6,gz]}},
      notes:'Reconstrução geométrica aproximada. Cobertura, materiais e elementos externos baseados nas fotos; medidas e planta interna estimadas.' };
  };
})(globalThis);
