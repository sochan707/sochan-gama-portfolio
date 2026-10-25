(function () {
  'use strict';

  var W = 960;
  var H = 600;
  var canvas = document.getElementById('demo-canvas');
  var ctx = canvas.getContext('2d');
  var tabs = Array.from(document.querySelectorAll('.project-tab'));
  var runButton = document.getElementById('run-button');
  var stepButton = document.getElementById('step-button');
  var resetButton = document.getElementById('reset-button');
  var speedInput = document.getElementById('speed-input');
  var speedValue = document.getElementById('speed-value');
  var statsNode = document.getElementById('demo-stats');
  var inputsNode = document.getElementById('demo-inputs');
  var stateNode = document.getElementById('demo-state');
  var cycleNode = document.getElementById('demo-cycle');
  var liveDot = document.getElementById('live-dot');
  var themeToggle = document.getElementById('theme-toggle');
  var themeLabel = themeToggle.querySelector('.theme-toggle-label');

  function isDarkTheme() { return document.documentElement.dataset.theme === 'dark'; }
  function applyTheme(theme, persist) {
    document.documentElement.dataset.theme = theme;
    var dark = theme === 'dark';
    var action = dark ? 'Switch to light mode' : 'Switch to dark mode';
    themeLabel.textContent = dark ? 'Light' : 'Dark';
    themeToggle.setAttribute('aria-label', action);
    themeToggle.title = action;
    document.querySelector('meta[name="theme-color"]').content = dark ? '#141d1c' : '#fffdf9';
    if (persist) {
      try { localStorage.setItem('sochan-portfolio-theme', theme); } catch (_) { /* Keep the current choice for this page view. */ }
    }
    if (currentModel) currentModel.draw();
  }
  themeToggle.addEventListener('click', function () {
    applyTheme(isDarkTheme() ? 'light' : 'dark', true);
  });

  var projects = {
    prey: {
      count: '01 / 03', title: 'Prey & Predator',
      summary: 'Prey eat vegetation. Predators hunt prey. Their populations change as the simulation runs.',
      source: 'https://github.com/sochan707/GAMA_Prey_Predator',
      hint: 'Blue: prey · Brown: predators · Green: vegetation',
      controls: [{key:'prey', label:'Prey', min:30, max:250, step:10, value:160},{key:'predators', label:'Predators', min:2, max:45, step:1, value:16}],
      canvasLabel: 'Browser adaptation of a predator and prey ecosystem simulation'
    },
    'three-d': {
      count: '02 / 03', title: '3D Model',
      summary: 'Moving agents fill a 3D cube. Lines show which agents are near each other.',
      source: 'https://github.com/sochan707/GAMA_3D_Model',
      hint: 'Blue: moving agents · Lines: nearby neighbors',
      controls: [{key:'agents', label:'Agents', min:20, max:160, step:10, value:100}],
      canvasLabel: 'Browser adaptation of moving agents and neighbor connections in a 3D cube'
    },
    sheep: {
      count: '03 / 03', title: 'Sheep Movement',
      summary: 'Sheep flock and graze around obstacles. A dog later herds them toward an exit.',
      source: 'https://github.com/sochan707/GAMA_Herds_Movement',
      hint: 'Blue: sheep · Brown: dog · Green: grass · Orange: exit',
      controls: [{key:'sheep', label:'Sheep', min:20, max:100, step:5, value:75},{key:'obstacles', label:'Obstacles', min:0, max:10, step:1, value:5}],
      canvasLabel: 'Browser adaptation of a sheep herd with grass, obstacles, a dog and an exit'
    }
  };

  function rng(seed) {
    var value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      var t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function choice(random, items) { return items[Math.floor(random() * items.length)]; }
  function drawCircle(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  function baseCanvas(fill) {
    if (isDarkTheme()) fill = '#1d3028';
    ctx.fillStyle = fill; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = isDarkTheme() ? 'rgba(196,221,197,.09)' : 'rgba(53,96,69,.055)'; ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function stat(label, value) { return {label:label, value:value}; }

  function PreyModel(options) {
    this.random = rng(29471);
    this.cycle = 0;
    this.done = false;
    this.cols = 48;
    this.rows = 30;
    this.food = Array.from({length:this.cols * this.rows}, () => .2 + this.random() * .8);
    this.prey = [];
    this.predators = [];
    for (var i = 0; i < options.prey; i++) this.prey.push(this.agent());
    for (var j = 0; j < options.predators; j++) this.predators.push(this.agent());
  }
  PreyModel.prototype.agent = function () { return {x:Math.floor(this.random() * this.cols), y:Math.floor(this.random() * this.rows), energy:.25 + this.random() * .75}; };
  PreyModel.prototype.index = function (x, y) { return clamp(y,0,this.rows-1)*this.cols + clamp(x,0,this.cols-1); };
  PreyModel.prototype.step = function () {
    if (this.done) return;
    this.cycle++;
    var r = this.random;
    for (var f = 0; f < this.food.length; f++) this.food[f] = Math.min(1, this.food[f] + .006);
    var newbornPrey = [];
    for (var i = this.prey.length - 1; i >= 0; i--) {
      var p = this.prey[i], bestX = p.x, bestY = p.y, bestFood = -1;
      for (var k = 0; k < 5; k++) {
        var tx = clamp(p.x + Math.floor(r()*5)-2,0,this.cols-1), ty = clamp(p.y + Math.floor(r()*5)-2,0,this.rows-1);
        var available = this.food[this.index(tx,ty)];
        if (available > bestFood) {bestFood = available; bestX=tx; bestY=ty;}
      }
      p.x=bestX; p.y=bestY;
      var fi=this.index(p.x,p.y), eaten=Math.min(.1,this.food[fi]);
      this.food[fi]-=eaten; p.energy=clamp(p.energy+eaten-.05,0,1);
      if(p.energy<=0){this.prey.splice(i,1);continue;}
      if(p.energy>=.5 && r()<.01 && this.prey.length+newbornPrey.length<500){
        var births=1+Math.floor(r()*5), portion=p.energy/(births+1); p.energy=portion;
        for(var b=0;b<births;b++) newbornPrey.push({x:p.x,y:p.y,energy:portion});
      }
    }
    this.prey.push.apply(this.prey,newbornPrey);
    var newbornPredators=[];
    for(var n=this.predators.length-1;n>=0;n--){
      var hunter=this.predators[n], target=null, targetDistance=100;
      for(var q=0;q<this.prey.length;q++){
        var candidate=this.prey[q], d=Math.abs(candidate.x-hunter.x)+Math.abs(candidate.y-hunter.y);
        if(d<targetDistance && d<=3){target=candidate;targetDistance=d;}
      }
      if(target){hunter.x+=Math.sign(target.x-hunter.x);hunter.y+=Math.sign(target.y-hunter.y);}
      else {hunter.x=clamp(hunter.x+Math.floor(r()*3)-1,0,this.cols-1);hunter.y=clamp(hunter.y+Math.floor(r()*3)-1,0,this.rows-1);}
      var caught=this.prey.findIndex(function(v){return v.x===hunter.x&&v.y===hunter.y;});
      if(caught>=0){this.prey.splice(caught,1);hunter.energy=Math.min(1,hunter.energy+.5);}
      hunter.energy=Math.max(0,hunter.energy-.02);
      if(hunter.energy<=0){this.predators.splice(n,1);continue;}
      if(hunter.energy>=.5&&r()<.01&&this.predators.length+newbornPredators.length<100){
        var count=1+Math.floor(r()*3), share=hunter.energy/(count+1);hunter.energy=share;
        for(var m=0;m<count;m++) newbornPredators.push({x:hunter.x,y:hunter.y,energy:share});
      }
    }
    this.predators.push.apply(this.predators,newbornPredators);
    if(this.prey.length===0||this.predators.length===0)this.done=true;
  };
  PreyModel.prototype.draw = function () {
    baseCanvas('#edf4e9');
    var cw=W/this.cols,ch=H/this.rows;
    for(var y=0;y<this.rows;y++)for(var x=0;x<this.cols;x++){
      var value=this.food[this.index(x,y)];
      ctx.fillStyle='rgba(90,151,91,'+(.08+value*.34)+')';
      ctx.fillRect(x*cw+1,y*ch+1,cw-2,ch-2);
    }
    for(var i=0;i<this.prey.length;i++){
      var p=this.prey[i];drawCircle((p.x+.5)*cw,(p.y+.5)*ch,3.4,'#3e729a');
    }
    for(var j=0;j<this.predators.length;j++){
      var h=this.predators[j],px=(h.x+.5)*cw,py=(h.y+.5)*ch;
      ctx.beginPath();ctx.moveTo(px,py-6);ctx.lineTo(px-5.5,py+4.5);ctx.lineTo(px+5.5,py+4.5);ctx.closePath();ctx.fillStyle='#7b5641';ctx.fill();
    }
    if(this.done){ctx.fillStyle=isDarkTheme()?'rgba(22,38,31,.92)':'rgba(247,250,245,.85)';ctx.fillRect(290,245,380,108);ctx.fillStyle=isDarkTheme()?'#e7f0df':'#264b3d';ctx.textAlign='center';ctx.font='600 25px Alegreya, Georgia, serif';ctx.fillText('One population reached zero',480,295);ctx.font='14px DM Sans, Arial, sans-serif';ctx.fillText('Reset to explore another run.',480,322);ctx.textAlign='start';}
  };
  PreyModel.prototype.stats = function () {return [stat('Prey',this.prey.length),stat('Predators',this.predators.length),stat('Vegetation','Regrowing')];};

  function ThreeDModel(options){
    this.random=rng(68922);this.cycle=0;this.done=false;this.agents=[];
    for(var i=0;i<options.agents;i++)this.agents.push({x:this.random(),y:this.random(),z:this.random(),vx:(this.random()-.5)*.012,vy:(this.random()-.5)*.012,vz:(this.random()-.5)*.012});
    this.links=0;
  }
  ThreeDModel.prototype.step=function(){
    this.cycle++;
    for(var i=0;i<this.agents.length;i++){
      var a=this.agents[i];a.x+=a.vx;a.y+=a.vy;a.z+=a.vz;
      if(a.x<0||a.x>1){a.vx*=-1;a.x=clamp(a.x,0,1);}
      if(a.y<0||a.y>1){a.vy*=-1;a.y=clamp(a.y,0,1);}
      if(a.z<0||a.z>1){a.vz*=-1;a.z=clamp(a.z,0,1);}
    }
  };
  ThreeDModel.prototype.project=function(p){
    var angle=.58+this.cycle*.003, ca=Math.cos(angle),sa=Math.sin(angle);
    var x=(p.x-.5)*ca-(p.z-.5)*sa,z=(p.x-.5)*sa+(p.z-.5)*ca,y=p.y-.5;
    var pitch=.35,cy=Math.cos(pitch),sy=Math.sin(pitch),yy=y*cy-z*sy,zz=y*sy+z*cy;
    var perspective=1/(1+zz*.42);
    return {x:W/2+x*465*perspective,y:H/2+yy*465*perspective,z:zz};
  };
  ThreeDModel.prototype.draw=function(){
    baseCanvas('#eef4ed');
    var corners=[];
    for(var a=0;a<=1;a++)for(var b=0;b<=1;b++)for(var c=0;c<=1;c++)corners.push(this.project({x:a,y:b,z:c}));
    ctx.strokeStyle=isDarkTheme()?'rgba(186,213,190,.46)':'rgba(53,93,68,.32)';ctx.lineWidth=2;
    for(var i=0;i<8;i++)for(var j=i+1;j<8;j++){
      var diff=((i^j)===1||(i^j)===2||(i^j)===4);
      if(diff){ctx.beginPath();ctx.moveTo(corners[i].x,corners[i].y);ctx.lineTo(corners[j].x,corners[j].y);ctx.stroke();}
    }
    var projected=this.agents.map(this.project.bind(this));this.links=0;
    ctx.strokeStyle=isDarkTheme()?'rgba(151,203,203,.32)':'rgba(71,113,126,.18)';ctx.lineWidth=1;
    for(var m=0;m<this.agents.length;m++)for(var n=m+1;n<this.agents.length;n++){
      var aa=this.agents[m],bb=this.agents[n],dx=aa.x-bb.x,dy=aa.y-bb.y,dz=aa.z-bb.z;
      if(dx*dx+dy*dy+dz*dz<.012){this.links++;ctx.beginPath();ctx.moveTo(projected[m].x,projected[m].y);ctx.lineTo(projected[n].x,projected[n].y);ctx.stroke();}
    }
    var ordered=projected.map(function(p,index){return {p:p,index:index};}).sort(function(v,u){return v.p.z-u.p.z;});
    for(var k=0;k<ordered.length;k++){var point=ordered[k].p;drawCircle(point.x,point.y,3.2+point.z*1.3,'#3b7790');}
  };
  ThreeDModel.prototype.stats=function(){return [stat('Agents',this.agents.length),stat('Neighbor links',this.links),stat('Space','3D cube')];};

  function SheepModel(options){
    this.random=rng(42910);this.cycle=0;this.done=false;this.exited=0;this.sheep=[];this.obstacles=[];this.grass=[];this.path=new Uint16Array(48*30);this.dog={x:2,y:50,awake:false};
    for(var i=0;i<options.obstacles;i++){
      var ox=16+this.random()*62,oy=10+this.random()*80;
      if(ox>72&&oy>30&&oy<70)oy=12;
      this.obstacles.push({x:ox,y:oy,w:7+this.random()*7,h:3+this.random()*4});
    }
    for(var g=0;g<8;g++)this.grass.push({x:8+this.random()*82,y:8+this.random()*84,amount:1,type:g%3});
    for(var s=0;s<options.sheep;s++)this.sheep.push({x:4+this.random()*78,y:4+this.random()*92,heading:this.random()*Math.PI*2,prefersGrass:this.random()<.35,goingToExit:false,grazing:0});
  }
  SheepModel.prototype.step=function(){
    if(this.done)return;this.cycle++;var r=this.random;
    if(this.cycle>=500)this.dog.awake=true;
    if(this.dog.awake&&this.sheep.length){
      var last=this.sheep.reduce(function(a,b){return a.x<b.x?a:b;});
      var tx=Math.max(1,last.x-4),ty=last.y;
      var da=Math.atan2(ty-this.dog.y,tx-this.dog.x);
      this.dog.x=clamp(this.dog.x+Math.cos(da)*.9,1,95);this.dog.y=clamp(this.dog.y+Math.sin(da)*.9,2,98);
    }
    for(var q=0;q<this.grass.length;q++)this.grass[q].amount=Math.min(1,this.grass[q].amount+.001);
    for(var i=this.sheep.length-1;i>=0;i--){
      var sh=this.sheep[i];
      if(this.dog.awake&&dist(sh,this.dog)<11)sh.goingToExit=true;
      var vx=Math.cos(sh.heading),vy=Math.sin(sh.heading),neighbors=[],close=[];
      for(var j=0;j<this.sheep.length;j++)if(j!==i){var other=this.sheep[j],dd=dist(sh,other);if(dd<8)neighbors.push(other);if(dd<2.7)close.push(other);}
      if(sh.goingToExit){vx+=(98-sh.x)*.035;vy+=(50-sh.y)*.035;}
      else{
        if(neighbors.length){var cx=0,cy=0,ax=0,ay=0;for(var n=0;n<neighbors.length;n++){cx+=neighbors[n].x;cy+=neighbors[n].y;ax+=Math.cos(neighbors[n].heading);ay+=Math.sin(neighbors[n].heading);}vx+=(cx/neighbors.length-sh.x)*.12+ax/neighbors.length*.15;vy+=(cy/neighbors.length-sh.y)*.12+ay/neighbors.length*.15;}
        if(close.length){for(var c=0;c<close.length;c++){vx+=(sh.x-close[c].x)*.3;vy+=(sh.y-close[c].y)*.3;}}
        if(sh.prefersGrass){var nearest=null,nearD=16;for(var h=0;h<this.grass.length;h++){var gd=dist(sh,this.grass[h]);if(gd<nearD&&this.grass[h].amount>.1){nearD=gd;nearest=this.grass[h];}}if(nearest){vx+=(nearest.x-sh.x)*.045;vy+=(nearest.y-sh.y)*.045;if(nearD<3&&sh.grazing<=0){sh.grazing=8;nearest.amount=Math.max(0,nearest.amount-.1);}}}
      }
      for(var o=0;o<this.obstacles.length;o++){
        var ob=this.obstacles[o], nx=clamp(sh.x,ob.x-ob.w/2-3,ob.x+ob.w/2+3),ny=clamp(sh.y,ob.y-ob.h/2-3,ob.y+ob.h/2+3);
        if(Math.abs(sh.x-ob.x)<ob.w/2+4&&Math.abs(sh.y-ob.y)<ob.h/2+4){vx+=(sh.x-ob.x)*.7;vy+=(sh.y-ob.y)*.7;}
      }
      if(this.dog.awake&&dist(sh,this.dog)<3){vx+=(sh.x-this.dog.x)*2;vy+=(sh.y-this.dog.y)*2;sh.grazing=0;}
      vx+=(r()-.5)*.22;vy+=(r()-.5)*.22;sh.heading=Math.atan2(vy,vx);
      if(sh.grazing>0&&!sh.goingToExit){sh.grazing--;continue;}
      sh.x=clamp(sh.x+Math.cos(sh.heading)*.55,1,99);sh.y=clamp(sh.y+Math.sin(sh.heading)*.55,1,99);
      var gx=clamp(Math.floor(sh.x/100*48),0,47),gy=clamp(Math.floor(sh.y/100*30),0,29);this.path[gy*48+gx]++;
      if(sh.x>=96&&sh.y>=42&&sh.y<=58){this.sheep.splice(i,1);this.exited++;}
    }
    if(this.sheep.length===0)this.done=true;
  };
  SheepModel.prototype.draw=function(){
    baseCanvas('#eaf1e8');var sx=W/100,sy=H/100;
    for(var py=0;py<30;py++)for(var px=0;px<48;px++){var count=this.path[py*48+px];if(count>0){ctx.fillStyle='rgba(150,119,87,'+Math.min(.34,count/110)+')';ctx.fillRect(px*20,py*20,20,20);}}
    for(var g=0;g<this.grass.length;g++){var patch=this.grass[g];drawCircle(patch.x*sx,patch.y*sy,8+patch.amount*13,'rgba(89,158,87,.2)');drawCircle(patch.x*sx,patch.y*sy,3+patch.amount*4,'#70a66b');}
    for(var o=0;o<this.obstacles.length;o++){var ob=this.obstacles[o];ctx.fillStyle=isDarkTheme()?'#879b87':'#53685b';ctx.fillRect((ob.x-ob.w/2)*sx,(ob.y-ob.h/2)*sy,ob.w*sx,ob.h*sy);}
    ctx.fillStyle='#c88753';ctx.fillRect(96*sx,42*sy,4*sx,16*sy);
    for(var i=0;i<this.sheep.length;i++){var sh=this.sheep[i];drawCircle(sh.x*sx,sh.y*sy,5.3,sh.goingToExit?'#466e9b':'#6d92ba');}
    drawCircle(this.dog.x*sx,this.dog.y*sy,8,this.dog.awake?'#a25c4f':'#8a7867');
    if(!this.dog.awake){ctx.fillStyle=isDarkTheme()?'#e3ebdd':'#536b5a';ctx.font='600 13px DM Sans, Arial, sans-serif';ctx.fillText('Dog wakes at cycle 500',22,33);}
    if(this.done){ctx.fillStyle=isDarkTheme()?'rgba(22,38,31,.92)':'rgba(247,250,245,.88)';ctx.fillRect(330,245,300,100);ctx.fillStyle=isDarkTheme()?'#e7f0df':'#264b3d';ctx.textAlign='center';ctx.font='600 27px Alegreya, Georgia, serif';ctx.fillText('All sheep exited',480,295);ctx.textAlign='start';}
  };
  SheepModel.prototype.stats=function(){return [stat('Sheep in field',this.sheep.length),stat('Exited',this.exited),stat('Dog',this.dog.awake?'Herding':'Resting')];};

  var currentKey='prey',currentModel=null,running=false,lastTime=0,accumulator=0;
  var settings={prey:{prey:160,predators:16},'three-d':{agents:100},sheep:{sheep:75,obstacles:5}};
  function createModel(){
    var option=settings[currentKey];
    if(currentKey==='prey')return new PreyModel(option);
    if(currentKey==='three-d')return new ThreeDModel(option);
    return new SheepModel(option);
  }
  function setCanvasSize(){
    var rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    if(currentModel)currentModel.draw();
  }
  function updateStatus(){
    runButton.textContent=running?'Pause':currentModel.done?'Run again':currentModel.cycle?'Continue':'Run demo';
    stateNode.textContent=currentModel.done?'Finished':running?'Running':currentModel.cycle?'Paused':'Ready to run';
    cycleNode.textContent='Cycle '+currentModel.cycle;
    liveDot.classList.toggle('running',running);
    statsNode.replaceChildren();
    currentModel.stats().forEach(function(item){var box=document.createElement('div'),number=document.createElement('strong'),label=document.createElement('span');box.className='stat';number.textContent=item.value;label.textContent=item.label;box.append(number,label);statsNode.append(box);});
  }
  function reset(){running=false;accumulator=0;currentModel=createModel();currentModel.draw();updateStatus();}
  function buildControls(){
    inputsNode.replaceChildren();
    projects[currentKey].controls.forEach(function(control){
      var label=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input'),output=document.createElement('output');
      text.textContent=control.label;input.type='range';input.min=control.min;input.max=control.max;input.step=control.step;input.value=settings[currentKey][control.key];input.setAttribute('aria-label','Initial '+control.label.toLowerCase());output.textContent=input.value;
      input.addEventListener('input',function(){output.textContent=input.value;});
      input.addEventListener('change',function(){settings[currentKey][control.key]=Number(input.value);reset();});
      label.append(text,input,output);inputsNode.append(label);
    });
  }
  function selectProject(key,moveFocus){
    currentKey=key;var project=projects[key];
    tabs.forEach(function(tab){var selected=tab.dataset.demo===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&moveFocus)tab.focus();});
    document.getElementById('project-panel').setAttribute('aria-labelledby',tabs.find(function(tab){return tab.dataset.demo===key;}).id);
    document.getElementById('project-count').textContent=project.count;
    document.getElementById('project-title').textContent=project.title;
    document.getElementById('project-summary').textContent=project.summary;
    document.getElementById('project-source').href=project.source;
    document.getElementById('canvas-hint').textContent=project.hint;
    canvas.setAttribute('aria-label',project.canvasLabel);
    buildControls();reset();
  }
  tabs.forEach(function(tab,index){
    tab.addEventListener('click',function(){selectProject(tab.dataset.demo,false);});
    tab.addEventListener('keydown',function(event){
      var target=index;if(event.key==='ArrowRight')target=(index+1)%tabs.length;else if(event.key==='ArrowLeft')target=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')target=0;else if(event.key==='End')target=tabs.length-1;else return;
      event.preventDefault();selectProject(tabs[target].dataset.demo,true);
    });
  });
  runButton.addEventListener('click',function(){if(currentModel.done)reset();running=!running;lastTime=performance.now();updateStatus();});
  stepButton.addEventListener('click',function(){running=false;currentModel.step();currentModel.draw();updateStatus();});
  resetButton.addEventListener('click',reset);
  speedInput.addEventListener('input',function(){speedValue.value=speedInput.value+'×';});
  document.getElementById('year').textContent=new Date().getFullYear();
  window.addEventListener('resize',setCanvasSize);
  function frame(time){
    if(running){
      accumulator+=Math.min(time-lastTime,250)*Number(speedInput.value);
      var steps=0;
      while(accumulator>=100&&steps<12){currentModel.step();accumulator-=100;steps++;if(currentModel.done){running=false;break;}}
      if(steps){currentModel.draw();updateStatus();}
    }
    lastTime=time;requestAnimationFrame(frame);
  }
  function initScrollMotion(){
    if(!window.matchMedia||!('IntersectionObserver' in window))return;
    var motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
    if(motionPreference.matches)return;
    document.querySelectorAll('[data-reveal-stagger]').forEach(function(group){
      Array.from(group.children).filter(function(item){return item.hasAttribute('data-reveal');}).forEach(function(item,index){
        item.style.setProperty('--reveal-index',String(Math.min(index,4)));
      });
    });
    var revealObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },{rootMargin:'0px 0px -10% 0px',threshold:.08});
    document.querySelectorAll('[data-reveal]').forEach(function(item){revealObserver.observe(item);});
    document.documentElement.classList.add('motion-ready');
    if(motionPreference.addEventListener){
      motionPreference.addEventListener('change',function(event){
        if(event.matches){
          document.documentElement.classList.remove('motion-ready');
          revealObserver.disconnect();
        }
      });
    }
  }
  initScrollMotion();
  applyTheme(isDarkTheme() ? 'dark' : 'light', false);
  selectProject('prey',false);setCanvasSize();requestAnimationFrame(frame);
})();
