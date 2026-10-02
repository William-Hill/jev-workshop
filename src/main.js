/* ============================================================
   RenderMaze — Lemon Pepper Run  ·  Phaser build
   Held-to-move maze runner with sprite collectibles + juice.
   Ported 1:1 from the Claude Design RenderMaze-Phaser.html spec
   into the Vite + Phaser module structure: CDN Phaser swapped for
   the npm import, and asset paths routed through import.meta.glob.
   ============================================================ */
import * as Phaser from "phaser";

// Vite asset pipeline: resolve "assets/foo.svg" to its built URL.
const assetModules = import.meta.glob("../assets/**/*", {
  eager: true,
  query: "?url",
  import: "default",
});
const assetUrl = (p) => assetModules["../" + p];

const TILE = 32;
const POWER_MS = 6500;
const ENEMY_RESPAWN_MS = 3000;
const MAZE = [
  "###################",
  "#P....#.....#....o#",
  "#.###.#.###.#.###.#",
  "#.....#...#.#.....#",
  "###.#####.#.#####.#",
  "#...#.....#.....#.#",
  "#.#.#.#######.#.#.#",
  "#.#....A B....#...#",
  "#.#####.#.#####.###",
  "#...E...#.........#",
  "#.###.#####.###.#.#",
  "#o..#.......#...#.#",
  "###.#.#####.#.###.#",
  "#...#...#...#.....#",
  "#.#####.#.#####.###",
  "#.....#.#.#.....#.#",
  "#.###.#.#.#.###.#.#",
  "#o....#C D#.....o.#",
  "###################",
];
const ROWS = MAZE.length, COLS = MAZE[0].length, BOARD = COLS * TILE;

const THEMES = {
  workshop: {
    tag:"Workshop Specs", countLabel:"Specs", powerLabel:"Approved", dot:0xff88df, dotHex:"#ff88df",
    deck:"Collect every spec card, grab the approved spec to flip the blockers, and clear the maze before the build falls apart.",
    regular:{ key:"w-reg", name:"Spec Card", note:"+10 · collect all", src:"assets/spec-card.svg", svg:true, w:18, h:18, lw:30, lh:30 },
    power:{ key:"w-pow", name:"Approved Spec", note:"+50 · go on offense", src:"assets/consume-mode-spec.svg", svg:true, w:26, h:26, lw:30, lh:30 },
    enemies:{
      A:{ key:"w-A", name:"Scope Creep", src:"assets/scope-creep.svg", svg:true, strategy:"chase", color:0xf98070, hex:"#f98070" },
      B:{ key:"w-B", name:"Ambiguous Reqs", src:"assets/ambiguous-requirements.svg", svg:true, strategy:"patrol", color:0xdf9718, hex:"#df9718" },
      C:{ key:"w-C", name:"Stale Context", src:"assets/stale-context.svg", svg:true, strategy:"wander", color:0x015a55, hex:"#015a55" },
      D:{ key:"w-D", name:"Flaky Tests", src:"assets/flaky-tests.svg", svg:true, strategy:"chase", color:0x711b43, hex:"#711b43" },
      E:{ key:"w-E", name:"Unapproved Change", src:"assets/consume-mode-spec.svg", svg:true, strategy:"wander", color:0x711b43, hex:"#711b43" },
    },
  },
  atlanta: {
    tag:"Atlanta Wing Run", countLabel:"Wings", powerLabel:"Turnt Up", dot:0xdf9718, dotHex:"#df9718",
    deck:"Collect every crispy wing, grab the lemon-pepper wet wing to flip the blockers, and clear the route before the spec falls apart.",
    regular:{ key:"a-reg", name:"Crispy Wing", note:"+10 · collect all", src:"assets/pixel-wing-crispy.png", svg:false, w:15, h:21, lw:24, lh:32 },
    power:{ key:"a-pow", name:"Lemon Pepper Wet", note:"+50 · go on offense", src:"assets/pixel-wing-lemon-pepper-wet.png", svg:false, w:22, h:30, lw:24, lh:32 },
    enemies:{
      A:{ key:"a-A", name:"Hookah Smoke", src:"assets/pixel-hookah-smoke-clean.png", svg:false, strategy:"chase", color:0xf98070, hex:"#f98070" },
      B:{ key:"a-B", name:"Pollen Cloud", src:"assets/pixel-pollen-cloud-clean.png", svg:false, strategy:"patrol", color:0xdf9718, hex:"#df9718" },
      C:{ key:"a-C", name:"Parking Boot", src:"assets/pixel-parking-boot.png", svg:false, strategy:"wander", color:0x015a55, hex:"#015a55" },
      D:{ key:"a-D", name:"Peachtree Detour", src:"assets/atl-peachtree-detour.svg", svg:true, strategy:"chase", color:0x711b43, hex:"#711b43" },
      E:{ key:"a-E", name:"Construction Cone", src:"assets/atl-construction-cone.svg", svg:true, strategy:"wander", color:0x711b43, hex:"#711b43" },
    },
  },
};
// Route every theme asset src through Vite's asset pipeline.
Object.values(THEMES).forEach((t) => {
  [t.regular, t.power, ...Object.values(t.enemies)].forEach((a) => { a.src = assetUrl(a.src); });
});
const PLAYER_IDLE_SRC = assetUrl("assets/autosprite/renderman-idle.png");
const PLAYER_RUN_SHEETS = {
  up: assetUrl("assets/autosprite/renderman-run-up.png"),
  down: assetUrl("assets/autosprite/renderman-run-down.png"),
  left: assetUrl("assets/autosprite/renderman-run-left.png"),
  right: assetUrl("assets/autosprite/renderman-run-right.png"),
};
const PLAYER_FRAME = 64;
const PLAYER_ANIM_FRAMES = 8;
const PLAYER_DISPLAY = 44;

const DIFF = { chill:0.82, normal:1, spicy:1.2 };
const DIRS = { up:{row:-1,col:0}, down:{row:1,col:0}, left:{row:0,col:-1}, right:{row:0,col:1} };
const KEYMAP = { ArrowUp:"up", KeyW:"up", ArrowDown:"down", KeyS:"down", ArrowLeft:"left", KeyA:"left", ArrowRight:"right", KeyD:"right" };

const $ = (id)=> document.getElementById(id);
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

class MazeScene extends Phaser.Scene {
  constructor(){ super("maze"); }

  preload(){
    Object.values(THEMES).forEach((t)=>{
      [t.regular, t.power, ...Object.values(t.enemies)].forEach((a)=>{
        if(a.svg) this.load.svg(a.key, a.src, { width:64, height:64 });
        else this.load.image(a.key, a.src);
      });
    });
    this.load.image("player-idle", PLAYER_IDLE_SRC);
    Object.entries(PLAYER_RUN_SHEETS).forEach(([dir, src]) => {
      this.load.spritesheet(`player-run-${dir}`, src, {
        frameWidth: PLAYER_FRAME,
        frameHeight: PLAYER_FRAME,
      });
    });
  }

  create(){
    this.selTheme = "atlanta";
    this.difficulty = "normal";
    this.lives0 = 3;
    this.best = parseInt(localStorage.getItem("rendermaze-best") || "0", 10) || 0;
    this.heldDir = null;

    this.wallGfx = this.add.graphics().setDepth(1);
    this.tokenGfx = this.add.graphics().setDepth(5);
    this.powerGfx = this.add.graphics().setDepth(15);
    this.readyText = this.add.text(BOARD/2, BOARD/2, "READY", { fontFamily:"'Archivo Black'", fontSize:"38px", color:"#fcf9ee" }).setOrigin(0.5).setDepth(40).setVisible(false);

    this.hudAcc = 0;
    this.buildBoard(this.selTheme);
    this.phase = "title";
    this.bindControls();
    this.ui = new UI(this);
    this.ui.renderLegend(this.selTheme);
    this.ui.showTitle();
    window.__scene = this;
    window.__game = this.game;
    this.createPlayerAnimations();
  }

  createPlayerAnimations(){
    Object.keys(PLAYER_RUN_SHEETS).forEach((dir) => {
      const key = `player-run-${dir}`;
      if(this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(key, { start:0, end:PLAYER_ANIM_FRAMES - 1 }),
        frameRate: 10,
        repeat: -1,
      });
    });
  }

  // ---------- board ----------
  buildBoard(theme){
    // clear dynamic objects
    if(this.collectibles) this.collectibles.forEach((c)=> c.sprite.destroy());
    if(this.enemySprites) this.enemySprites.forEach((e)=> e.sprite.destroy());
    if(this.playerSprite) this.playerSprite.destroy();
    if(this.playerHalo) this.playerHalo.destroy();
    if(this.fxLayer) this.fxLayer.forEach((o)=> o.destroy && o.destroy());
    this.fxLayer = [];

    const prof = THEMES[theme];
    this.theme = theme;
    this.tiles = MAZE.map((r)=> r.split(""));
    this.collectibles = new Map();
    this.enemySprites = [];
    this.enemies = [];
    this.left = 0;
    let player = { row:1, col:1 };

    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const ch = this.tiles[r][c];
        if(ch === "P"){ player = {row:r,col:c}; this.tiles[r][c] = " "; }
        else if(prof.enemies[ch]){
          const e = prof.enemies[ch];
          this.enemies.push({ row:r,col:c,spawnRow:r,spawnCol:c,dir:{row:0,col: ch==="C"?-1:1},p:0,eatenUntil:0,
            strategy:e.strategy, color:e.color, key:e.key, seed:this.enemies.length*97+13 });
          this.tiles[r][c] = " ";
        }
      }
    }
    // collectibles (sprites)
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const ch = this.tiles[r][c];
        if(ch === "."){
          this.left++;
          const a = prof.regular;
          const s = this.add.image(this.cx(c), this.cy(r), a.key).setDisplaySize(a.w, a.h).setDepth(4);
          this.collectibles.set(r+","+c, { sprite:s, type:"reg", tex:a.key, w:a.w, h:a.h });
        } else if(ch === "o"){
          const a = prof.power;
          const halo = this.add.circle(this.cx(c), this.cy(r), 13, prof.dot, 0.18).setDepth(3);
          const s = this.add.image(this.cx(c), this.cy(r), a.key).setDisplaySize(a.w, a.h).setDepth(4);
          this.collectibles.set(r+","+c, { sprite:s, halo, type:"pow", tex:a.key, w:a.w, h:a.h });
        }
      }
    }
    // enemies
    this.enemies.forEach((e)=>{
      const s = this.add.image(this.cx(e.col), this.cy(e.row), e.key).setDisplaySize(24,24).setDepth(6);
      this.enemySprites.push({ ref:e, sprite:s });
    });
    // player
    this.playerHalo = this.add.circle(this.cx(player.col), this.cy(player.row), 16, prof.dot, 0).setDepth(7);
    this.playerSprite = this.add.sprite(this.cx(player.col), this.cy(player.row), "player-idle").setDisplaySize(PLAYER_DISPLAY, PLAYER_DISPLAY).setDepth(8);
    this.player = { ...player, dir:null, p:0, start:{...player} };

    this.score = 0; this.displayScore = 0; this.lives = this.lives0;
    this.powerUntil = 0; this.eatChain = 0;
    this.drawWalls();
    this.drawTokens(0);
    this.powerGfx.clear();
    this.readyText.setVisible(false);
  }

  drawWalls(){
    const g = this.wallGfx; g.clear();
    g.fillStyle(0x2b292d, 1);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(this.tiles[r][c]==="#") g.fillRect(c*TILE, r*TILE, TILE, TILE);
    g.lineStyle(2, 0xff88df, 0.85);
    g.beginPath();
    const isPath = (r,c)=>{ const t=this.tiles[r]&&this.tiles[r][c]; return t!==undefined && t!=="#"; };
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      if(this.tiles[r][c]!=="#") continue;
      const x=c*TILE, y=r*TILE;
      if(isPath(r-1,c)){ g.moveTo(x,y); g.lineTo(x+TILE,y); }
      if(isPath(r+1,c)){ g.moveTo(x,y+TILE); g.lineTo(x+TILE,y+TILE); }
      if(isPath(r,c-1)){ g.moveTo(x,y); g.lineTo(x,y+TILE); }
      if(isPath(r,c+1)){ g.moveTo(x+TILE,y); g.lineTo(x+TILE,y+TILE); }
    }
    g.strokePath();
  }

  // ---------- lifecycle ----------
  startGame(){
    this.buildBoard(this.selTheme);
    this.phase = "ready";
    this.readyUntil = this.time.now + 1500;
    this.ui.hideOverlays();
    this.ui.updateHud(this);
  }
  restart(){ this.startGame(); }
  quitToTitle(){ this.buildBoard(this.selTheme); this.phase="title"; this.ui.showTitle(); }
  pickTheme(t){ if(t===this.selTheme) return; this.selTheme=t; this.buildBoard(t); this.phase="title"; this.ui.renderLegend(t); this.ui.showTitle(); }
  setDifficulty(d){ this.difficulty = d; }
  pauseToggle(){
    if(this.phase==="playing"){ this.phase="paused"; this.ui.showPause(); }
    else if(this.phase==="paused"){ this.phase="playing"; this.ui.hideOverlays(); }
    else if(this.phase==="title"){ this.startGame(); }
    else if(this.phase==="won"||this.phase==="lost"){ this.restart(); }
  }
  resume(){ if(this.phase==="paused"){ this.phase="playing"; this.ui.hideOverlays(); } }

  // ---------- input ----------
  bindControls(){
    this.onKeyDown = (ev)=>{
      if(ev.code==="Space"){ ev.preventDefault(); this.pauseToggle(); return; }
      if(ev.code==="Enter"){ if(this.phase==="title") this.startGame(); else if(this.phase==="won"||this.phase==="lost") this.restart(); return; }
      const name = KEYMAP[ev.code]; if(!name) return; ev.preventDefault();
      this.press(name);
    };
    this.onKeyUp = (ev)=>{
      const name = KEYMAP[ev.code]; if(!name) return;
      const d = DIRS[name];
      if(this.heldDir && d.row===this.heldDir.row && d.col===this.heldDir.col) this.heldDir = null;
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }
  press(name){
    if(this.phase!=="playing") return;
    const d = DIRS[name]; const pl = this.player;
    if(pl.dir && d.row===-pl.dir.row && d.col===-pl.dir.col){
      // instant reverse
      pl.row += pl.dir.row; pl.col += pl.dir.col; pl.dir = d; pl.p = 1 - pl.p;
    }
    this.heldDir = d;
    if(!pl.dir && this.canMove(pl.row,pl.col,d)) pl.dir = d;
  }
  // touch hold: keep moving while pressed
  holdDir(name){ this.press(name); }
  releaseDir(name){ const d=DIRS[name]; if(this.heldDir && d.row===this.heldDir.row && d.col===this.heldDir.col) this.heldDir=null; }

  // ---------- update ----------
  update(time, delta){
    const dt = Math.min(delta/1000, 0.05);
    // score tween
    if(this.displayScore < this.score) this.displayScore = Math.min(this.score, this.displayScore + Math.max(1,(this.score-this.displayScore))*dt*6);

    if(this.phase==="ready" && time > this.readyUntil) this.phase = "playing";

    if(this.phase==="playing"){
      this.movePlayer(dt);
      const powered = this.powerUntil > time;
      const eSpeed = (powered?1.95:3.15) * (DIFF[this.difficulty]||1);
      this.enemies.forEach((e)=>{ if(e.eatenUntil>time) return; this.moveEnemy(e, eSpeed, dt); });
      this.enemies.forEach((e)=>{ if(e.eatenUntil>0 && e.eatenUntil<=time){ e.row=e.spawnRow; e.col=e.spawnCol; e.p=0; e.dir={row:0,col:1}; e.eatenUntil=0; } });
      this.checkCollisions(time);
      if(this.left<=0) this.endGame(true);
    }

    this.syncSprites(time);
    this.hudAcc += dt;
    if(this.hudAcc>0.06){ this.hudAcc=0; this.ui.updateHud(this); }
  }

  movePlayer(dt){
    const pl = this.player; const speed = 6.7;
    if(!pl.dir){
      if(this.heldDir && this.canMove(pl.row,pl.col,this.heldDir)) pl.dir = this.heldDir;
      else { pl.p = 0; return; }
    }
    pl.p += speed*dt; let guard=0;
    while(pl.p>=1 && guard++<4){
      pl.p -= 1; pl.row += pl.dir.row; pl.col += pl.dir.col;
      this.collect(pl.row, pl.col);
      if(this.heldDir && this.canMove(pl.row,pl.col,this.heldDir)) pl.dir = this.heldDir; // keep moving only while held
      else { pl.dir = null; pl.p = 0; break; }
    }
  }

  moveEnemy(e, speed, dt){
    if(!e.dir){ e.dir = this.chooseDir(e); if(!e.dir) return; }
    e.p += speed*dt; let guard=0;
    while(e.p>=1 && guard++<4){
      e.p -= 1; e.row += e.dir.row; e.col += e.dir.col;
      const nd = this.chooseDir(e);
      if(!nd){ e.dir=null; e.p=0; break; }
      e.dir = nd;
    }
  }

  chooseDir(e){
    const opts = [DIRS.up,DIRS.down,DIRS.left,DIRS.right].filter((d)=> this.canMove(e.row,e.col,d));
    if(!opts.length) return null;
    const nonRev = opts.filter((o)=> !(e.dir && o.row===-e.dir.row && o.col===-e.dir.col));
    const cand = nonRev.length? nonRev : opts;
    const powered = this.powerUntil > this.time.now;
    const dist = (d)=> Math.abs(e.row+d.row-this.player.row) + Math.abs(e.col+d.col-this.player.col);
    if(powered) return cand.slice().sort((a,b)=> dist(b)-dist(a))[0];
    if(e.strategy==="patrol"){ const st = cand.find((o)=> e.dir && o.row===e.dir.row && o.col===e.dir.col); return st || cand[0]; }
    if(e.strategy==="wander"){ e.seed = (e.seed*1103515245 + 12345) & 0x7fffffff; return cand[e.seed % cand.length]; }
    return cand.slice().sort((a,b)=> dist(a)-dist(b))[0];
  }

  canMove(row,col,d){ const t = this.tiles[row+d.row] && this.tiles[row+d.row][col+d.col]; return t!==undefined && t!=="#"; }

  collect(row,col){
    const tile = this.tiles[row][col];
    const entry = this.collectibles.get(row+","+col);
    const prof = THEMES[this.theme];
    if(tile === "."){
      this.score += 10; this.left -= 1; this.tiles[row][col] = " ";
      if(entry){ this.popCollect(this.cx(col), this.cy(row), entry.tex, entry.w, entry.h, prof.dot); entry.sprite.destroy(); this.collectibles.delete(row+","+col); }
    } else if(tile === "o"){
      this.score += 50; this.tiles[row][col] = " ";
      if(entry){ this.popCollect(this.cx(col), this.cy(row), entry.tex, entry.w, entry.h, prof.dot, true); entry.sprite.destroy(); entry.halo && entry.halo.destroy(); this.collectibles.delete(row+","+col); }
      this.powerUntil = this.time.now + POWER_MS; this.eatChain = 0;
      this.floatText(this.cx(col), this.cy(row), "+50", "#df9718");
      if(!reduced) this.cameras.main.flash(150, 223, 151, 24);
    }
  }

  // ---------- the "eat" pop ----------
  popCollect(x,y,tex,w,h,colorNum,big){
    if(reduced) return;
    const ghost = this.add.image(x,y,tex).setDisplaySize(w,h).setDepth(20);
    this.tweens.add({ targets:ghost, scaleX:ghost.scaleX*(big?2.1:1.8), scaleY:ghost.scaleY*(big?2.1:1.8), alpha:0, duration:big?280:200, ease:"Quad.easeOut", onComplete:()=> ghost.destroy() });
    const ring = this.add.circle(x,y, big?6:4, colorNum, 0).setStrokeStyle(2, colorNum, 0.9).setDepth(19);
    this.tweens.add({ targets:ring, radius:big?22:13, alpha:0, duration:big?340:240, ease:"Cubic.easeOut", onUpdate:()=> ring.setStrokeStyle(2, colorNum, ring.alpha), onComplete:()=> ring.destroy() });
    const n = big?8:4;
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2, dist = (big?16:10)+Math.random()*8;
      const sp = this.add.rectangle(x,y, 3,3, colorNum).setDepth(21);
      this.tweens.add({ targets:sp, x:x+Math.cos(a)*dist, y:y+Math.sin(a)*dist, alpha:0, duration:big?420:300, ease:"Quad.easeOut", onComplete:()=> sp.destroy() });
    }
  }

  floatText(x,y,text,color){
    const t = this.add.text(x,y,text,{ fontFamily:"'Archivo Black'", fontSize:"16px", color }).setOrigin(0.5).setDepth(30);
    t.setStroke("#2b292d", 4);
    this.tweens.add({ targets:t, y:y-26, alpha:0, duration:850, ease:"Quad.easeOut", onComplete:()=> t.destroy() });
  }

  checkCollisions(time){
    const pl = this.player; const px = this.ex(pl), py = this.ey(pl);
    const powered = this.powerUntil > time; const hit2 = (TILE*0.52)*(TILE*0.52);
    for(const e of this.enemies){
      if(e.eatenUntil>time) continue;
      const dx = this.ex(e)-px, dy = this.ey(e)-py;
      if(dx*dx+dy*dy > hit2) continue;
      if(powered){
        this.eatChain = Math.min(this.eatChain+1, 4);
        const val = 100 * Math.pow(2, this.eatChain-1);
        this.score += val;
        e.eatenUntil = time + ENEMY_RESPAWN_MS; e.row=e.spawnRow; e.col=e.spawnCol; e.p=0; e.dir={row:0,col:1};
        this.floatText(this.ex(e), py, "+"+val, "#ff88df");
        if(!reduced){ this.cameras.main.shake(160, 0.006); this.popCollect(px,py,"player-idle",26,26,0xff88df,true); }
      } else {
        this.lives -= 1;
        if(!reduced){ this.cameras.main.flash(220, 113, 27, 67); this.cameras.main.shake(260, 0.012); }
        if(this.lives<=0){ this.endGame(false); return; }
        this.respawn(); return;
      }
    }
  }

  respawn(){
    this.player = { ...this.player, ...this.player.start, dir:null, p:0, start:this.player.start };
    this.heldDir = null; this.powerUntil = 0;
    this.enemies.forEach((e)=>{ e.row=e.spawnRow; e.col=e.spawnCol; e.p=0; e.dir={row:0,col:1}; e.eatenUntil=0; });
    this.phase = "ready"; this.readyUntil = this.time.now + 1100;
  }

  endGame(won){
    this.phase = won? "won":"lost";
    this.best = Math.max(this.best, this.score);
    localStorage.setItem("rendermaze-best", String(this.best));
    if(won && !reduced){
      for(let i=0;i<48;i++){
        const star = this.add.text(Math.random()*BOARD, -10, "★", { fontFamily:"'Archivo Black'", fontSize:(14+Math.random()*12)+"px", color: i%2?"#ff88df":"#df9718" }).setDepth(25).setOrigin(0.5);
        this.tweens.add({ targets:star, y:BOARD+20, angle:(Math.random()*360-180), duration:1400+Math.random()*1200, ease:"Quad.easeIn", onComplete:()=> star.destroy() });
      }
    }
    this.ui.showResult(this, won);
  }

  // ---------- sprite sync ----------
  syncSprites(time){
    const powered = this.powerUntil > time;
    const remain = (this.powerUntil - time) / POWER_MS;
    // collectible power-pellet pulse
    const pulse = (Math.sin(time/260)+1)/2;
    this.collectibles.forEach((c)=>{ if(c.type==="pow"){ const s=1+pulse*0.14; c.sprite.setScale((c.sprite.scaleX/Math.abs(c.sprite.scaleX||1))); c.sprite.setDisplaySize(c.w*(1+pulse*0.12), c.h*(1+pulse*0.12)); if(c.halo){ c.halo.setScale(1+pulse*0.3); c.halo.setFillStyle(THEMES[this.theme].dot, 0.14+pulse*0.12);} } });

    // enemy tokens + sprites
    this.tokenGfx.clear();
    this.enemySprites.forEach(({ref:e, sprite})=>{
      const eaten = e.eatenUntil>time;
      sprite.setVisible(!eaten);
      if(eaten) return;
      const x = this.ex(e), y = this.ey(e);
      const blinkOut = powered && remain<0.28 && (Math.floor(time/140)%2===0);
      const fill = powered ? (blinkOut?0xfcf9ee:0x015a55) : 0xfcf9ee;
      const border = powered ? (blinkOut?0xff88df:0x9fe3df) : e.color;
      // solid ink backing for a crisp edge on the dark maze, then the cream chip
      this.tokenGfx.fillStyle(0x211c22, 1);
      this.tokenGfx.fillRoundedRect(x-15, y-15, 30, 30, 8);
      this.tokenGfx.fillStyle(fill, 1);
      this.tokenGfx.fillRoundedRect(x-14, y-14, 28, 28, 7);
      this.tokenGfx.lineStyle(2.5, border, 1);
      this.tokenGfx.strokeRoundedRect(x-14, y-14, 28, 28, 7);
      sprite.setPosition(x,y);
      sprite.setAlpha(powered?0.78:1);
      if(powered) sprite.setTint(0x7fc6c1); else sprite.clearTint();
    });

    // player
    const pl = this.player; const bob = (reduced||this.phase!=="playing")?0:Math.sin(time/110)*1.2;
    const x = this.ex(pl), y = this.ey(pl)+bob;
    this.playerSprite.setPosition(x,y);
    if(this.playerHalo){ const pp=(Math.sin(time/90)+1)/2; this.playerHalo.setPosition(x,y).setRadius(16+pp*4).setFillStyle(THEMES[this.theme].dot, powered?(0.45+pp*0.2):0); }
    this.updatePlayerAnimation(pl);
    const blink = this.phase==="ready" && (Math.floor(time/160)%2===0);
    this.playerSprite.setAlpha(blink?0.35:1);

    // power border
    this.powerGfx.clear();
    if(powered){
      const p = (Math.sin(time/90)+1)/2;
      this.powerGfx.lineStyle(3+p*2, 0xdf9718, 0.5+p*0.3);
      this.powerGfx.strokeRect(4,4,BOARD-8,BOARD-8);
      if(remain<0.28){ const b=(Math.sin(time/70)+1)/2; this.powerGfx.lineStyle(3,0xff88df,0.3+b*0.6); this.powerGfx.strokeRect(9,9,BOARD-18,BOARD-18); }
    }

    // ready text
    if(this.phase==="ready"){ this.readyText.setVisible(true); this.readyText.setAlpha(0.55 + ((Math.sin(time/140)+1)/2)*0.45); }
    else this.readyText.setVisible(false);
  }

  drawTokens(time){ this.syncSprites(time||0); }

  updatePlayerAnimation(pl){
    this.playerSprite.setRotation(0);
    if(reduced || this.phase!=="playing" || !pl.dir){
      this.playerSprite.stop();
      this.playerSprite.setTexture("player-idle");
      this.playerSprite.setDisplaySize(PLAYER_DISPLAY, PLAYER_DISPLAY);
      return;
    }
    let dir = "down";
    if(pl.dir.col===1) dir = "right";
    else if(pl.dir.col===-1) dir = "left";
    else if(pl.dir.row===-1) dir = "up";
    const key = `player-run-${dir}`;
    if(this.playerSprite.anims.currentAnim?.key !== key) this.playerSprite.play(key);
    this.playerSprite.setDisplaySize(PLAYER_DISPLAY, PLAYER_DISPLAY);
  }

  // helpers
  cx(c){ return c*TILE + TILE/2; }
  cy(r){ return r*TILE + TILE/2; }
  ex(e){ const t=this.cx(e.col); if(!e.dir) return t; return t + e.dir.col*TILE*e.p; }
  ey(e){ const t=this.cy(e.row); if(!e.dir) return t; return t + e.dir.row*TILE*e.p; }
}

/* ---------- DOM UI controller ---------- */
class UI {
  constructor(scene){
    this.scene = scene;
    this.el = {
      themeTag:$("themeTag"), score:$("score"), left:$("left"), leftLabel:$("leftLabel"), lives:$("lives"),
      mode:$("mode"), powerWrap:$("powerWrap"), powerBar:$("powerBar"),
      title:$("titleScreen"), pause:$("pauseScreen"), result:$("resultScreen"),
      deck:$("deck"), resultKicker:$("resultKicker"), resultTitle:$("resultTitle"), resultScore:$("resultScore"),
      bestScore:$("bestScore"), pauseBtn:$("pauseBtn"),
      collectibleLegend:$("collectibleLegend"), enemyLegend:$("enemyLegend"),
    };
    this.bind();
    this.last = {};
  }
  bind(){
    const s = this.scene;
    $("startBtn").onclick = ()=> s.startGame();
    $("resumeBtn").onclick = ()=> s.resume();
    $("quitBtn1").onclick = ()=> s.quitToTitle();
    $("againBtn").onclick = ()=> s.restart();
    $("quitBtn2").onclick = ()=> s.quitToTitle();
    $("pauseBtn").onclick = ()=> s.pauseToggle();
    $("restartBtn").onclick = ()=> s.restart();
    $("pickWorkshop").onclick = ()=> { this.setTheme("workshop"); s.pickTheme("workshop"); };
    $("pickAtlanta").onclick = ()=> { this.setTheme("atlanta"); s.pickTheme("atlanta"); };
    document.querySelectorAll("[data-diff]").forEach((b)=>{
      b.onclick = ()=>{ document.querySelectorAll("[data-diff]").forEach((x)=> x.setAttribute("aria-pressed", String(x===b))); s.setDifficulty(b.dataset.diff); };
    });
    // touch dpad: hold to move
    document.querySelectorAll(".dpad button").forEach((b)=>{
      const dir = b.dataset.dir;
      const down = (ev)=>{ ev.preventDefault(); s.holdDir(dir); };
      const up = (ev)=>{ ev.preventDefault(); s.releaseDir(dir); };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointerleave", up);
      b.addEventListener("pointercancel", up);
    });
  }
  setTheme(t){
    $("pickWorkshop").setAttribute("aria-pressed", String(t==="workshop"));
    $("pickAtlanta").setAttribute("aria-pressed", String(t==="atlanta"));
  }
  showTitle(){ this.el.title.hidden=false; this.el.pause.hidden=true; this.el.result.hidden=true; this.el.deck.textContent = THEMES[this.scene.selTheme].deck; this.el.themeTag.textContent = THEMES[this.scene.selTheme].tag; this.el.leftLabel.textContent = THEMES[this.scene.selTheme].countLabel; this.updateHud(this.scene); }
  showPause(){ this.el.pause.hidden=false; }
  hideOverlays(){ this.el.title.hidden=true; this.el.pause.hidden=true; this.el.result.hidden=true; }
  showResult(s, won){
    this.el.result.hidden=false; this.el.title.hidden=true; this.el.pause.hidden=true;
    this.el.result.style.background = won ? "rgba(1,90,85,0.92)" : "rgba(113,27,67,0.93)";
    this.el.resultKicker.style.color = won ? "#9fe3df" : "#ff88df";
    this.el.resultKicker.textContent = won ? "Spec Accepted" : "Regression Detected";
    this.el.resultTitle.textContent = won ? "You Shipped It" : "Build Broke";
    this.el.resultScore.textContent = String(s.score);
    this.el.bestScore.textContent = String(s.best);
  }
  updateHud(s){
    const now = s.time ? s.time.now : 0; const powered = s.powerUntil > now;
    const prof = THEMES[s.theme || s.selTheme];
    this.el.themeTag.textContent = prof.tag;
    this.el.leftLabel.textContent = prof.countLabel;
    const score = Math.round(s.displayScore||0);
    if(this.last.score!==score){ this.el.score.textContent = String(score); this.last.score=score; }
    if(this.last.left!==s.left){ this.el.left.textContent = String(s.left); this.last.left=s.left; }
    if(this.last.lives!==s.lives){ this.renderLives(s.lives, s.lives0); this.last.lives=s.lives; }
    let mode = "Normal", color = "#2b292d";
    if(s.phase==="ready"){ mode="Ready"; color="#015a55"; }
    else if(s.phase==="paused"){ mode="Paused"; color="#711b43"; }
    else if(powered){ mode = prof.powerLabel + " " + Math.ceil((s.powerUntil-now)/1000); color="#df9718"; }
    if(this.last.mode!==mode){ this.el.mode.textContent = mode; this.el.mode.style.color = color; this.last.mode=mode; }
    const pct = powered ? Math.max(0, Math.min(100, (s.powerUntil-now)/POWER_MS*100)) : 0;
    const pr = Math.round(pct);
    if(this.last.pct!==pr){ this.el.powerWrap.hidden = !powered; this.el.powerBar.style.width = pr+"%"; this.last.pct=pr; }
  }
  renderLives(lives, max){
    this.el.lives.innerHTML = "";
    for(let i=0;i<max;i++){
      const img = document.createElement("img");
      img.src = PLAYER_IDLE_SRC; img.alt = "";
      img.style.opacity = i<lives ? "1" : "0.18";
      img.style.filter = i<lives ? "none" : "grayscale(1)";
      this.el.lives.appendChild(img);
    }
  }
  renderLegend(theme){
    const prof = THEMES[theme];
    const item = (a, name, note, noteColor)=>{
      const li = document.createElement("li");
      li.innerHTML = `<span class="chip"><img src="${a.src}" alt="" style="width:${a.lw||30}px;height:${a.lh||30}px"></span>`+
        `<span><span class="nm">${name}</span><span class="nt" style="${noteColor?`color:${noteColor}`:""}">${note}</span></span>`;
      return li;
    };
    this.el.collectibleLegend.innerHTML = "";
    this.el.collectibleLegend.appendChild(item(prof.regular, prof.regular.name, prof.regular.note));
    this.el.collectibleLegend.appendChild(item(prof.power, prof.power.name, prof.power.note));
    this.el.enemyLegend.innerHTML = "";
    const seen = new Set();
    Object.values(prof.enemies).forEach((e)=>{ if(seen.has(e.name)) return; seen.add(e.name); this.el.enemyLegend.appendChild(item(e, e.name, e.strategy, e.hex)); });
    this.el.themeTag.textContent = prof.tag;
    this.el.leftLabel.textContent = prof.countLabel;
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#211c22",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, parent:"game", width: BOARD, height: BOARD },
  scene: [MazeScene],
});
