// === LEVEL EDITOR ===
let edBlocks=[], edPigs=[], edBirds=['bird_s','bird_s','bird_m'];
let edTool='select', edSelected=[], edLastSelType='block';
let edDragOff=null, edResizeH=null, edBirdPanel=false;
let edRotDragStart=null, edRotCenter=null, edRotStartAngle=0;
let edSnap=8, edTBW=76, edHover='', edCustomLevel=null;
let edClipboard=null;
let edSelRectStart=null, edSelRectEnd=null, edDraggingRect=false;
let edHoverObj=null, edClickStartTime=0, edIsDragging=false, edDragStartPos=null;
let edDragMouseStart=null;
let edRotSnapAngle=null;
let edBirdScroll=0;

function edCursorFromVector(vx, vy){
  let deg = ((atan2(vy, vx) * 180 / PI) % 180 + 180) % 180;
  if(deg < 22.5 || deg >= 157.5) return 'ew-resize';
  if(deg < 67.5) return 'nesw-resize';
  if(deg < 112.5) return 'ns-resize';
  return 'nwse-resize';
}

function edHandleCursor(handleId, ang){
  let vx=1, vy=0;
  if(handleId==='n' || handleId==='s'){
    // Local Y axis in world space.
    vx = -sin(ang);
    vy = cos(ang);
  } else if(handleId==='e' || handleId==='w'){
    // Local X axis in world space.
    vx = cos(ang);
    vy = sin(ang);
  } else if(handleId==='nw' || handleId==='se'){
    // NW/SE diagonal axis in local space.
    let s = 0.70710678;
    vx = s * cos(ang) - s * sin(ang);
    vy = s * sin(ang) + s * cos(ang);
  } else if(handleId==='ne' || handleId==='sw'){
    // NE/SW diagonal axis in local space.
    let s = 0.70710678;
    vx = s * cos(ang) + s * sin(ang);
    vy = s * sin(ang) - s * cos(ang);
  }
  let cur = edCursorFromVector(vx, vy);
  // Corner handles feel reversed visually; rotate diagonal cursor by 90 deg.
  if(handleId==='nw' || handleId==='se' || handleId==='ne' || handleId==='sw'){
    return cur==='nwse-resize' ? 'nesw-resize' : 'nwse-resize';
  }
  return cur;
}

function edUpdateHover(mx, my){
  edHoverObj = null;
  if(edSelected.length === 1 && edSelected[0].type === 'block'){
    let b = edBlocks[edSelected[0].idx];
    let ang = b ? (b.angle || 0) : 0;
    let handle = edGetHandle(mx, my);
    if(handle){
      cursor(edHandleCursor(handle, ang));
      return;
    }
    if(edGetRotationHandle(mx, my)){
      cursor('crosshair');
      return;
    }
  }
  if(edSelected.length > 0){
    // Check blocks first
    for(let sel of edSelected){
      if(sel.type === 'block'){
        let b = edBlocks[sel.idx];
        let ang = b.angle || 0;
        let dx = mx - b.x;
        let dy = my - b.y;
        let lx = dx * cos(-ang) - dy * sin(-ang);
        let ly = dx * sin(-ang) + dy * cos(-ang);
        if(abs(lx) <= b.w/2 && abs(ly) <= b.h/2){
          edHoverObj = sel;
          cursor('move');
          return;
        }
      } else if(sel.type === 'pig'){
        let p = edPigs[sel.idx];
        if(dist(mx, my, p.x, p.y) < p.r){
          edHoverObj = sel;
          cursor('move');
          return;
        }
      }
    }
  }
  cursor('default');
}

function edGetRotationHandle(mx, my){
  if(edSelected.length !== 1 || edSelected[0].type !== 'block') return false;
  let b = edBlocks[edSelected[0].idx];
  let ang = b.angle || 0;
  let hx = b.w/2 + 20, hy = -b.h/2 - 20;
  let handleX = b.x + hx * cos(ang) - hy * sin(ang);
  let handleY = b.y + hx * sin(ang) + hy * cos(ang);
  return dist(mx, my, handleX, handleY) < 15;
}

function edBirdPanelLayout(){
  let px=640-220, py=120, pw=440, ph=480;
  let headerH=72;
  let footerH=82;
  let listTop=py+headerH;
  let listBottom=py+ph-footerH;
  let listH=listBottom-listTop;
  let rowH=42;
  let listLeft=px+12;
  let listRight=px+pw-24;
  let scrollX=listRight-8;
  let removeX=listRight-30;
  let typeRight=removeX-26;
  let maxScroll=max(0, edBirds.length*rowH-listH);
  return {px,py,pw,ph,headerH,footerH,listTop,listBottom,listH,rowH,maxScroll,listLeft,listRight,scrollX,removeX,typeRight};
}

function enterEditor(){
  gameState='EDITOR'; edBlocks=[]; edPigs=[];
  edBirds=['bird_s','bird_s','bird_m'];
  edTool='select'; edSelected=[]; edLastSelType='block';
  edDragOff=null; edResizeH=null; edBirdPanel=false;
  edSelRectStart=null; edSelRectEnd=null; edDraggingRect=false;
  edHoverObj=null; edClickStartTime=0; edIsDragging=false; edRotDragStart=null; edRotCenter=null; edDragStartPos=null; edDragMouseStart=null;
  edRotSnapAngle=null;
  edBirdScroll=0;
  camX=0;
}

function edHitBlock(mx,my){
  for(let i=edBlocks.length-1;i>=0;i--){
    let b=edBlocks[i];
    let ang = b.angle || 0;
    // Transform mouse to local space
    let dx = mx - b.x;
    let dy = my - b.y;
    let lx = dx * cos(-ang) - dy * sin(-ang);
    let ly = dx * sin(-ang) + dy * cos(-ang);
    if(abs(lx) <= b.w/2 && abs(ly) <= b.h/2) return {idx:i,type:'block'};
  }
  for(let i=edPigs.length-1;i>=0;i--){
    let p=edPigs[i];
    if(dist(mx,my,p.x,p.y)<p.r) return {idx:i,type:'pig'};
  }
  return null;
}

function edGetHandle(mx,my){
  if(edSelected.length !== 1 || edSelected[0].type !== 'block') return null;
  let b=edBlocks[edSelected[0].idx]; if(!b) return null;
  let ang = b.angle || 0;
  let hs=[
    {id:'nw',lx:-b.w/2,ly:-b.h/2},{id:'ne',lx:b.w/2,ly:-b.h/2},
    {id:'sw',lx:-b.w/2,ly:b.h/2},{id:'se',lx:b.w/2,ly:b.h/2},
    {id:'n',lx:0,ly:-b.h/2},{id:'s',lx:0,ly:b.h/2},
    {id:'w',lx:-b.w/2,ly:0},{id:'e',lx:b.w/2,ly:0}
  ];
  for(let h of hs) {
    let wx = b.x + h.lx * cos(ang) - h.ly * sin(ang);
    let wy = b.y + h.lx * sin(ang) + h.ly * cos(ang);
    if(dist(mx,my,wx,wy)<12) return h.id;
  }
  return null;
}

function edBlockBounds(b){
  let ang=b.angle||0;
  let hx=abs((b.w/2)*cos(ang))+abs((b.h/2)*sin(ang));
  let hy=abs((b.w/2)*sin(ang))+abs((b.h/2)*cos(ang));
  return {l:b.x-hx,r:b.x+hx,t:b.y-hy,b:b.y+hy};
}

function edSnapBlock(idx){
  let b=edBlocks[idx], S=edSnap, gY=680;
  let bb=edBlockBounds(b);
  if(abs(bb.b-gY)<S) b.y+=gY-bb.b;
  for(let i=0;i<edBlocks.length;i++){
    if(i===idx) continue; let o=edBlocks[i];
    bb=edBlockBounds(b);
    let ob=edBlockBounds(o);
    let hO=bb.r>ob.l+2&&bb.l<ob.r-2, vO=bb.b>ob.t+2&&bb.t<ob.b-2;
    if(hO&&abs(bb.b-ob.t)<S) b.y+=ob.t-bb.b;
    if(hO&&abs(bb.t-ob.b)<S) b.y+=ob.b-bb.t;
    if(vO&&abs(bb.r-ob.l)<S) b.x+=ob.l-bb.r;
    if(vO&&abs(bb.l-ob.r)<S) b.x+=ob.r-bb.l;
    bb=edBlockBounds(b);
    if(abs(bb.l-ob.l)<S) b.x+=ob.l-bb.l;
    if(abs(bb.r-ob.r)<S) b.x+=ob.r-bb.r;
    if(abs(bb.t-ob.t)<S) b.y+=ob.t-bb.t;
    if(abs(bb.b-ob.b)<S) b.y+=ob.b-bb.b;
    if(abs(b.x-o.x)<S) b.x=o.x;
    if(abs(b.y-o.y)<S) b.y=o.y;
  }
}

function edResize(hid,mx,my){
  if(edSelected.length !== 1 || edSelected[0].type !== 'block') return;
  let b=edBlocks[edSelected[0].idx]; if(!b) return;
  let mn=15, ang=b.angle||0;
  let ux={x:cos(ang),y:sin(ang)};
  let uy={x:-sin(ang),y:cos(ang)};
  let fixedLx=hid.includes('w')?b.w/2:(hid.includes('e')?-b.w/2:0);
  let fixedLy=hid.includes('n')?b.h/2:(hid.includes('s')?-b.h/2:0);
  let fixedWx=b.x+fixedLx*ux.x+fixedLy*uy.x;
  let fixedWy=b.y+fixedLx*ux.y+fixedLy*uy.y;
  let dx=mx-fixedWx, dy=my-fixedWy;
  let localX=dx*ux.x+dy*ux.y;
  let localY=dx*uy.x+dy*uy.y;
  let nw=b.w, nh=b.h, cxOff=0, cyOff=0;
  if(hid.includes('w')){ nw=max(mn,-localX); cxOff=-nw/2; }
  if(hid.includes('e')){ nw=max(mn, localX); cxOff= nw/2; }
  if(hid.includes('n')){ nh=max(mn,-localY); cyOff=-nh/2; }
  if(hid.includes('s')){ nh=max(mn, localY); cyOff= nh/2; }
  b.w=nw; b.h=nh;
  b.x=fixedWx+cxOff*ux.x+cyOff*uy.x;
  b.y=fixedWy+cxOff*ux.y+cyOff*uy.y;
}

function edPlayLevel(){
  if(edPigs.length===0) return;
  edCustomLevel={
    birds:[...edBirds],
    pigs:edPigs.map(p=>({x:p.x,y:p.y,r:p.r})),
    blocks:edBlocks.map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,type:b.type,angle:b.angle||0}))
  };
  levels.push(edCustomLevel);
  loadLevel(levels.length-1);
}

function edMousePressed(mx,my){
  let sm=getScaledMouse(), smx=sm.x, smy=sm.y;
  // Bird panel interactions
  if(edBirdPanel) return edBirdPanelClick(smx,smy);
  // Toolbar click
  if(smx<edTBW){
    let tools=['select','wood','stone','glass','pig','eraser'];
    for(let i=0;i<tools.length;i++){
      let ty=24+i*66;
      if(smy>=ty&&smy<=ty+56){ edTool=tools[i]; edSelected=[]; return true; }
    }
    if(smy>=420&&smy<=476){ edBirdPanel=true; return true; }
    if(smy>=490&&smy<=546){ edPlayLevel(); return true; }
    if(smy>=560&&smy<=600){ edSaveJSON(); return true; }
    if(smy>=610&&smy<=650){ edLoadJSON(); return true; }
    if(smy>=660&&smy<=716){ gameState='START'; if(edCustomLevel){levels.pop();edCustomLevel=null;} return true; }
    return true;
  }
  // Canvas area
  let wx=smx, wy=smy;
  if(edTool==='select'){
    // Check rotation handle first
    if(edGetRotationHandle(wx, wy)){
      let b = edBlocks[edSelected[0].idx];
      edRotDragStart = {x: wx, y: wy};
      edRotCenter = {x: b.x, y: b.y};
      edRotStartAngle = b.angle || 0;
      return true;
    }

    let h=edGetHandle(wx,wy);
    if(h){ edResizeH=h; return true; }
    let hit=edHitBlock(wx,wy);
    if(hit){
      let isCtrl = keyIsDown(CONTROL);
      edClickStartTime = millis();
      edIsDragging = false;

      if(isCtrl){
        // Toggle selection - don't set drag offset for Ctrl+click
        let existingIdx = edSelected.findIndex(s => s.idx === hit.idx && s.type === hit.type);
        if(existingIdx >= 0){
          edSelected.splice(existingIdx, 1);
        } else {
          edSelected.push(hit);
          edLastSelType = hit.type;
          // Set drag offset for newly selected objects
          let obj=hit.type==='block'?edBlocks[hit.idx]:edPigs[hit.idx];
          edDragOff={x:wx-obj.x,y:wy-obj.y};
          // Store initial positions of all selected objects
          edDragStartPos = edSelected.map(sel => {
            let obj = sel.type === 'block' ? edBlocks[sel.idx] : edPigs[sel.idx];
            return {x: obj.x, y: obj.y};
          });
        }
        return true;
      } else {
        // Check if clicking on already selected object
        let isAlreadySelected = edSelected.some(s => s.idx === hit.idx && s.type === hit.type);
        if(isAlreadySelected && edSelected.length > 1){
          // Will handle single selection on mouse release if not dragged
          edHoverObj = hit;
        } else {
          // Single selection
          edSelected = [hit];
          edLastSelType = hit.type;
        }
        // Set drag offset and initial positions for potential dragging
        let obj=hit.type==='block'?edBlocks[hit.idx]:edPigs[hit.idx];
        edDragOff={x:wx-obj.x,y:wy-obj.y};
        edDragMouseStart = {x: wx, y: wy};
        // Store initial positions of all selected objects
        edDragStartPos = edSelected.map(sel => {
          let obj = sel.type === 'block' ? edBlocks[sel.idx] : edPigs[sel.idx];
          return {x: obj.x, y: obj.y};
        });
        return true;
      }
    } else {
      // Start selection rectangle
      let isCtrl = keyIsDown(CONTROL);
      if(!isCtrl) edSelected = [];
      edSelRectStart = {x: wx, y: wy};
      edDraggingRect = true;
    }
  } else if(edTool==='wood'||edTool==='stone'||edTool==='glass'){
    edBlocks.push({x:wx,y:wy,w:80,h:20,type:edTool,angle:0});
    edSelected = [{idx: edBlocks.length-1, type: 'block'}];
    edLastSelType = 'block';
    edSnapBlock(edSelected[0].idx);
  } else if(edTool==='pig'){
    edPigs.push({x:wx,y:wy,r:25});
    edSelected = [{idx: edPigs.length-1, type: 'pig'}];
    edLastSelType = 'pig';
  } else if(edTool==='eraser'){
    let hit=edHitBlock(wx,wy);
    if(hit){
      if(hit.type==='block') edBlocks.splice(hit.idx,1);
      else edPigs.splice(hit.idx,1);
      // Remove from selection if selected
      edSelected = edSelected.filter(s => !(s.idx === hit.idx && s.type === hit.type));
    }
  }
  return true;
}

function edMouseDragged(mx,my){
  let sm=getScaledMouse(), wx=sm.x, wy=sm.y;
  
  if(edRotDragStart && edSelected.length === 1 && edSelected[0].type === 'block'){
    let b = edBlocks[edSelected[0].idx];
    let originalAngle = atan2(edRotDragStart.y - edRotCenter.y, edRotDragStart.x - edRotCenter.x);
    let currentAngle = atan2(wy - edRotCenter.y, wx - edRotCenter.x);
    let diff = currentAngle - originalAngle;
    
    let newAngle = edRotStartAngle + diff;
    edRotSnapAngle = round(newAngle / (HALF_PI)) * HALF_PI;
    b.angle = newAngle;
    return;
  }

  if(edResizeH && edSelected.length === 1 && edSelected[0].type === 'block'){
    edResize(edResizeH,wx,wy); return;
  }
  
  if(edDraggingRect){
    edSelRectEnd = {x: wx, y: wy};
  } else if(edDragOff!==null && edSelected.length > 0 && edDragStartPos && edDragMouseStart){
    edIsDragging = true; // Mark that we've started dragging
    // Move as a stable group from the original mouse-down point.
    let dx = wx - edDragMouseStart.x;
    let dy = wy - edDragMouseStart.y;

    // Move all selected objects by the same amount
    for(let i = 0; i < edSelected.length; i++){
      let sel = edSelected[i];
      let obj = sel.type === 'block' ? edBlocks[sel.idx] : edPigs[sel.idx];
      if(obj){
        obj.x = edDragStartPos[i].x + dx;
        obj.y = edDragStartPos[i].y + dy;
        if(sel.type === 'block') edSnapBlock(sel.idx);
      }
    }
  }
}

function edMouseReleased(){
  // Handle single-click selection for multi-selection
  if(edHoverObj && !edIsDragging && edSelected.length > 1){
    let isCtrl = keyIsDown(CONTROL);
    if (!isCtrl) {
      let clickDuration = millis() - edClickStartTime;
      if(clickDuration < 300){ // Short click = single selection
        edSelected = [edHoverObj];
        edLastSelType = edHoverObj.type;
      }
    }
  }

  if(edDraggingRect && edSelRectStart && edSelRectEnd){
    // Select objects inside the rectangle
    let minX = min(edSelRectStart.x, edSelRectEnd.x);
    let maxX = max(edSelRectStart.x, edSelRectEnd.x);
    let minY = min(edSelRectStart.y, edSelRectEnd.y);
    let maxY = max(edSelRectStart.y, edSelRectEnd.y);

    // Check blocks
    for(let i = 0; i < edBlocks.length; i++){
      let b = edBlocks[i];
      if(b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY){
        if(!edSelected.some(s => s.idx === i && s.type === 'block')){
          edSelected.push({idx: i, type: 'block'});
          edLastSelType = 'block';
        }
      }
    }
    // Check pigs
    for(let i = 0; i < edPigs.length; i++){
      let p = edPigs[i];
      if(p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY){
        if(!edSelected.some(s => s.idx === i && s.type === 'pig')){
          edSelected.push({idx: i, type: 'pig'});
          edLastSelType = 'pig';
        }
      }
    }
  }
  if(edRotDragStart && edSelected.length === 1 && edSelected[0].type === 'block'){
    let b = edBlocks[edSelected[0].idx];
    b.angle = edRotSnapAngle!==null ? edRotSnapAngle : (b.angle || 0);
  }

  edDragOff=null; edResizeH=null; edDraggingRect=false; edSelRectStart=null; edSelRectEnd=null; edHoverObj=null; edRotDragStart=null; edRotCenter=null; edDragStartPos=null; edDragMouseStart=null; edRotSnapAngle=null;
  // Snap all selected blocks
  for(let sel of edSelected){
    if(sel.type === 'block') edSnapBlock(sel.idx);
  }
}

function edBirdPanelClick(mx,my){
  let ui=edBirdPanelLayout();
  let px=ui.px, py=ui.py, pw=ui.pw, ph=ui.ph;
  edBirdScroll=constrain(edBirdScroll,0,ui.maxScroll);
  // Close button
  if(mx>=px+pw-35&&mx<=px+pw-5&&my>=py+5&&my<=py+35){ edBirdPanel=false; return true; }
  // Add bird buttons
  let addTypes=['bird_s','bird_m','bird_l'];
  let aby=py+ph-36;
  for(let j=0;j<addTypes.length;j++){
    let bx=px+85+j*135;
    if(edBirds.length<12){
      if(mx>=bx-50&&mx<=bx+50&&my>=aby-15&&my<=aby+15){
        edBirds.push(addTypes[j]); return true;
      }
    }
  }
  // Per-bird controls
  for(let i=0;i<edBirds.length;i++){
    let by=ui.listTop+20+i*ui.rowH-edBirdScroll;
    if(by<ui.listTop-22||by>ui.listBottom+22) continue;
    // Type cycle
    if(mx>=ui.listLeft+18&&mx<=ui.typeRight&&my>=by-15&&my<=by+15){
      let types=['bird_s','bird_m','bird_l'];
      let ci=types.indexOf(edBirds[i]);
      edBirds[i]=types[(ci+1)%3]; return true;
    }
    // Remove
    if(mx>=ui.removeX-16&&mx<=ui.removeX+16&&my>=by-12&&my<=by+12&&edBirds.length>1){
      edBirds.splice(i,1); return true;
    }
  }
  return true;
}

function edMouseWheel(deltaY){
  if(!edBirdPanel) return false;
  let ui=edBirdPanelLayout();
  let sm=getScaledMouse();
  if(sm.x<ui.px || sm.x>ui.px+ui.pw || sm.y<ui.listTop || sm.y>ui.listBottom) return true;
  edBirdScroll = constrain(edBirdScroll + deltaY * 0.5, 0, ui.maxScroll);
  return true;
}

function edKeyPressed(){
  if(gameState!=='EDITOR') return false;

  // Ctrl+C / Ctrl+V
  if(keyIsDown(CONTROL)){
    if(keyCode===67 && edSelected.length > 0){ // C
      edClipboard = edSelected.map(sel => ({
        type: sel.type,
        data: {...(sel.type === 'block' ? edBlocks[sel.idx] : edPigs[sel.idx])}
      }));
      return false;
    }
    if(keyCode===86 && edClipboard && edClipboard.length > 0){ // V
      let offset = 20;
      let newSelected = [];
      for(let item of edClipboard){
        if(item.type === 'block'){
          let b = {...item.data, x: item.data.x + offset, y: item.data.y + offset};
          edBlocks.push(b);
          newSelected.push({idx: edBlocks.length-1, type: 'block'});
        } else {
          let p = {...item.data, x: item.data.x + offset, y: item.data.y + offset};
          edPigs.push(p);
          newSelected.push({idx: edPigs.length-1, type: 'pig'});
        }
        offset += 20;
      }
      edSelected = newSelected;
      edLastSelType = edSelected[0].type;
      return false;
    }
  }

  if(keyCode===46||keyCode===8){ // Delete/Backspace
    if(edSelected.length > 0){
      // Sort in descending order to avoid index shifting issues
      edSelected.sort((a,b) => b.idx - a.idx);
      for(let sel of edSelected){
        if(sel.type === 'block') edBlocks.splice(sel.idx, 1);
        else edPigs.splice(sel.idx, 1);
      }
      edSelected = [];
    }
    return true;
  }
  if(keyCode===27){ // Escape
    if(edBirdPanel) edBirdPanel=false;
    else if(edSelected.length > 0) edSelected = [];
    else { gameState='START'; if(edCustomLevel){levels.pop();edCustomLevel=null;} }
    return true;
  }
  // Material change - only for blocks
  let selectedBlocks = edSelected.filter(s => s.type === 'block');
  if(selectedBlocks.length > 0){
    for(let sel of selectedBlocks){
      let b = edBlocks[sel.idx];
      if(key==='1') b.type='wood';
      if(key==='2') b.type='stone';
      if(key==='3') b.type='glass';
    }
  }
  // Arrow key movement
  let moveAmount = keyIsDown(SHIFT) ? 10 : 1;
  if(keyCode===UP_ARROW || keyCode===87){ // Up or W
    for(let sel of edSelected){
      if(sel.type === 'block'){
        edBlocks[sel.idx].y -= moveAmount;
        edSnapBlock(sel.idx);
      } else {
        edPigs[sel.idx].y -= moveAmount;
      }
    }
    return true;
  }
  if(keyCode===DOWN_ARROW || keyCode===83){ // Down or S
    for(let sel of edSelected){
      if(sel.type === 'block'){
        edBlocks[sel.idx].y += moveAmount;
        edSnapBlock(sel.idx);
      } else {
        edPigs[sel.idx].y += moveAmount;
      }
    }
    return true;
  }
  if(keyCode===LEFT_ARROW || keyCode===65){ // Left or A
    for(let sel of edSelected){
      if(sel.type === 'block'){
        edBlocks[sel.idx].x -= moveAmount;
        edSnapBlock(sel.idx);
      } else {
        edPigs[sel.idx].x -= moveAmount;
      }
    }
    return true;
  }
  if(keyCode===RIGHT_ARROW || keyCode===68){ // Right or D
    for(let sel of edSelected){
      if(sel.type === 'block'){
        edBlocks[sel.idx].x += moveAmount;
        edSnapBlock(sel.idx);
      } else {
        edPigs[sel.idx].x += moveAmount;
      }
    }
    return true;
  }
  return false;
}

function edSaveJSON(){
  let data = {
    birds: [...edBirds],
    pigs: edPigs.map(p=>({x:p.x,y:p.y,r:p.r})),
    blocks: edBlocks.map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,type:b.type,angle:b.angle||0}))
  };
  let blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = "level.json";
  a.click();
}

function edLoadJSON(){
  let input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    let file = e.target.files[0];
    let reader = new FileReader();
    reader.onload = event => {
      let data = JSON.parse(event.target.result);
      if(data.birds) edBirds = data.birds;
      if(data.pigs) edPigs = data.pigs;
      if(data.blocks) edBlocks = data.blocks;
      edSelected = [];
    };
    reader.readAsText(file);
  };
  input.click();
}

// === DRAWING ===
function drawEdToolIcon(type,cx,cy,sz,active,hov){
  push(); translate(cx,cy); rectMode(CENTER);
  let ctx=drawingContext;
  // Button bg
  if(active){
    let g=ctx.createRadialGradient(0,0,8,0,0,28);
    g.addColorStop(0,'rgba(255,180,50,0.95)'); g.addColorStop(1,'rgba(255,100,0,0.75)');
    ctx.fillStyle=g; noStroke(); rect(0,0,52,52,14);
  } else if(hov){
    fill(255,255,255,25); noStroke(); rect(0,0,52,52,14);
  }
  let c=active?'#FFF':'#CCC';
  if(type==='select'){
    fill(active?'#FFD54F':'#DDD'); stroke(active?'#FF8F00':'#888'); strokeWeight(1.5);
    beginShape(); vertex(-7,-13); vertex(-7,9); vertex(-2,4); vertex(4,13);
    vertex(7,11); vertex(1,2); vertex(7,2); endShape(CLOSE);
  } else if(type==='wood'){
    let g=ctx.createLinearGradient(-15,-7,15,7);
    g.addColorStop(0,'#D4893F'); g.addColorStop(1,'#A0612A');
    ctx.fillStyle=g; stroke('#7A4418'); strokeWeight(2); rect(0,0,34,18,3);
    stroke('#8B5E2B'); strokeWeight(1); line(-12,-3,12,-3); line(-10,3,14,3);
    noStroke(); fill('#7A4418'); ellipse(5,0,4,6);
  } else if(type==='stone'){
    let g=ctx.createLinearGradient(-14,-14,14,14);
    g.addColorStop(0,'#B0B0A8'); g.addColorStop(1,'#6A6A64');
    ctx.fillStyle=g; stroke('#505048'); strokeWeight(2); rect(0,0,28,28,2);
    stroke('#707068'); strokeWeight(1.5); line(-7,-7,2,-1); line(2,-1,9,-5);
    noStroke(); fill(255,255,255,50); rect(-5,-9,14,5,1);
  } else if(type==='glass'){
    fill(180,230,255,140); stroke(220,240,255,220); strokeWeight(2); rect(0,0,26,26,2);
    noStroke(); fill(255,255,255,170);
    beginShape(); vertex(-11,-11); vertex(3,-11); vertex(-11,3); endShape(CLOSE);
    fill(255,255,255,200); circle(-3,-5,4);
  } else if(type==='pig'){
    stroke(255,255,255,200); strokeWeight(2.5); fill(200,230,255,80);
    arc(0,-3,22,26,0,PI,OPEN); line(-11,-3,11,-3);
    line(0,10,0,17); line(-7,17,7,17);
    noStroke(); fill(255,255,255,90); ellipse(-3,1,5,9);
  } else if(type==='eraser'){
    fill('#CC5050'); stroke('#991111'); strokeWeight(2); rect(0,3,20,22,2);
    noFill(); stroke('#991111'); strokeWeight(2.5); line(-13,-7,13,-7);
    fill('#CC5050'); stroke('#991111'); strokeWeight(1.5); rect(0,-9,10,5,2);
    stroke('#991111'); strokeWeight(1.5); line(-3,-1,-3,12); line(0,-1,0,12); line(3,-1,3,12);
  } else if(type==='birds'){
    noStroke();
    fill('#FF3B3B'); circle(-6,-4,16); fill('#FFE100'); circle(8,2,12); fill('#A30000'); circle(-2,8,10);
    stroke(0); strokeWeight(1);
    fill('#FFCC00'); triangle(0,-6,6,-3,0,-1); triangle(12,0,18,1,12,4);
    fill(255); circle(-8,-5,5); circle(6,1,4);
    fill(0); circle(-7,-5,2); circle(7,1,1.5);
  } else if(type==='play'){
    let g=ctx.createRadialGradient(0,0,5,0,0,24);
    g.addColorStop(0,'#66FF66'); g.addColorStop(1,'#22AA22');
    ctx.fillStyle=g; stroke('#116611'); strokeWeight(2);
    beginShape(); vertex(-10,-14); vertex(-10,14); vertex(14,0); endShape(CLOSE);
  } else if(type==='save'){
    fill('#4CAF50'); stroke('#1B5E20'); strokeWeight(1.5); rect(0,0,30,30,4);
    fill(255); noStroke(); rect(0,-10,18,10,1); rect(0,8,22,12,1);
  } else if(type==='load'){
    fill('#2196F3'); stroke('#0D47A1'); strokeWeight(1.5); rect(0,2,34,24,2);
    fill(255); noStroke(); beginShape(); vertex(-6,-10); vertex(6,-10); vertex(6,-2); vertex(12,-2); vertex(0,10); vertex(-12,-2); vertex(-6,-2); endShape(CLOSE);
  } else if(type==='back'){
    stroke(active?'#FFD54F':'#CCC'); strokeWeight(3); noFill();
    line(6,-10,-6,0); line(-6,0,6,10);
    line(-6,0,10,0);
  }
  pop();
}

function drawEdToolbar(){
  let ctx=drawingContext;
  // Panel background
  let g=ctx.createLinearGradient(0,0,edTBW,0);
  g.addColorStop(0,'rgba(20,20,35,0.92)'); g.addColorStop(1,'rgba(30,30,50,0.85)');
  noStroke(); ctx.fillStyle=g; rect(0,0,edTBW,720);
  // Separator line
  stroke(255,255,255,30); strokeWeight(1); line(edTBW,0,edTBW,720);

  let sm=getScaledMouse();
  let tools=['select','wood','stone','glass','pig','eraser'];
  for(let i=0;i<tools.length;i++){
    let ty=24+i*66+28;
    let hov=sm.x<edTBW&&sm.y>=ty-28&&sm.y<=ty+28;
    drawEdToolIcon(tools[i],edTBW/2,ty,56,edTool===tools[i],hov);
    // Label
    textAlign(CENTER,TOP); textSize(8); noStroke();
    fill(edTool===tools[i]?'#FFD54F':'rgba(255,255,255,0.5)');
    let labels=['Select','Wood','Stone','Glass','Target','Erase'];
    text(labels[i],edTBW/2,ty+29);
  }
  // Separator
  stroke(255,255,255,20); line(10,415,edTBW-10,415);
  // Birds button
  let bHov=sm.x<edTBW&&sm.y>=420&&sm.y<=476;
  drawEdToolIcon('birds',edTBW/2,448,56,false,bHov);
  textAlign(CENTER,TOP); textSize(8); noStroke();
  fill('rgba(255,255,255,0.5)'); text('Birds ('+edBirds.length+')',edTBW/2,477);
  // Play button
  let pHov=sm.x<edTBW&&sm.y>=490&&sm.y<=546;
  drawEdToolIcon('play',edTBW/2,518,56,false,pHov);
  fill(edPigs.length>0?'#66FF66':'rgba(255,255,255,0.3)');
  textSize(8); text('Play',edTBW/2,547);
  // Save/Load
  let sHov=sm.x<edTBW&&sm.y>=560&&sm.y<=600;
  drawEdToolIcon('save',edTBW/2,580,40,false,sHov);
  fill(200); textSize(8); text('Save',edTBW/2,605);
  let lHov=sm.x<edTBW&&sm.y>=610&&sm.y<=650;
  drawEdToolIcon('load',edTBW/2,630,40,false,lHov);
  fill(200); textSize(8); text('Load',edTBW/2,655);
  // Back button
  let backHov=sm.x<edTBW&&sm.y>=660&&sm.y<=716;
  drawEdToolIcon('back',edTBW/2,688,56,false,backHov);
  fill('rgba(255,255,255,0.5)'); textSize(8); text('Back',edTBW/2,717);
}

function drawEdCanvas(){
  push();
  // Update hover state for cursor
  let sm = getScaledMouse();
  edUpdateHover(sm.x, sm.y);
  // Ground
  let ctx=drawingContext;
  noStroke(); fill('#5A8F3E'); rect(0,680,1280,40);
  fill('#6DA34D'); rect(0,680,1280,4);
  // Grid (subtle)
  stroke(255,255,255,15); strokeWeight(0.5);
  for(let x=edTBW;x<1280;x+=40) line(x,0,x,680);
  for(let y=0;y<680;y+=40) line(edTBW,y,1280,y);
  // Slingshot position indicator
  stroke(100,50,20,60); strokeWeight(2); noFill();
  circle(250,570,30);
  fill(100,50,20,40); noStroke(); textAlign(CENTER,CENTER); textSize(10);
  text('Sling',250,595);

  // Draw blocks
  for(let i=0;i<edBlocks.length;i++){
    let b=edBlocks[i];
    push(); translate(b.x,b.y); rotate(b.angle||0); rectMode(CENTER);
    // Use game drawBlock style
    let w=b.w, h=b.h;
    if(b.type==='wood'){
      fill(190,130,70); stroke(100,50,20); strokeWeight(2); rect(0,0,w,h);
      stroke(130,70,30); strokeWeight(1); noFill();
      for(let ix=-w/2+6;ix<w/2;ix+=8){
        beginShape();
        for(let iy=-h/2+2;iy<=h/2-2;iy+=10) vertex(ix+sin(iy*0.1+ix)*2,iy);
        endShape();
      }
    } else if(b.type==='stone'){
      fill(150); stroke(80); strokeWeight(2); rect(0,0,w,h);
      noStroke(); fill(200); rect(0,-h/2+3,w-2,6);
      fill(100); rect(0,h/2-3,w-2,6);
    } else {
      fill(180,230,255,140); stroke(255,255,255,220); strokeWeight(2); rect(0,0,w,h);
      noStroke(); fill(255,255,255,170);
      beginShape(); vertex(-w/2+2,-h/2+2); vertex(w/2-12,-h/2+2); vertex(-w/2+2,h/2-12); endShape(CLOSE);
    }
    // Selection highlight
    let isSelected = edSelected.some(s => s.idx === i && s.type === 'block');
    if(isSelected){
      noFill(); stroke(0,180,255); strokeWeight(2);
      rect(0,0,w+6,h+6,2);
      // Resize handles only for single selection
      if(edSelected.length === 1){
        fill(255); stroke(0,150,255); strokeWeight(1.5);
        let hs=[[-w/2,-h/2],[w/2,-h/2],[-w/2,h/2],[w/2,h/2],
                [0,-h/2],[0,h/2],[-w/2,0],[w/2,0]];
        for(let hp of hs) circle(hp[0],hp[1],8);
      }
    }
    pop();
    // Material label for first selected block
    if(isSelected && edSelected.findIndex(s => s.idx === i && s.type === 'block') === 0){
      fill(255); noStroke(); textAlign(CENTER,BOTTOM); textSize(11);
      let lbl=b.type.charAt(0).toUpperCase()+b.type.slice(1)+' ('+round(b.w)+'x'+round(b.h)+')';
      text(lbl,b.x,b.y-b.h/2-8);
      textSize(9); fill(200);
      if(edSelected.length === 1){
        text('Press 1=Wood 2=Stone 3=Glass',b.x,b.y-b.h/2-20);
        text('Drag ↻ to rotate, snaps to 90 deg on release.',b.x,b.y-b.h/2-32);
      } else {
        text(edSelected.length + ' objects selected',b.x,b.y-b.h/2-20);
        text('Press Delete to remove all',b.x,b.y-b.h/2-32);
      }
    }

    // Draw rotation handle for single block selection
    if(edSelected.length === 1 && edSelected[0].type === 'block' && edSelected[0].idx === i){
      let b = edBlocks[i];
      let ang = b.angle || 0;
      let hx = b.w/2 + 20, hy = -b.h/2 - 20;
      let handleX = b.x + hx * cos(ang) - hy * sin(ang);
      let handleY = b.y + hx * sin(ang) + hy * cos(ang);
      let isHovering = edGetRotationHandle(getScaledMouse().x + camX, getScaledMouse().y) || edRotDragStart !== null;
      fill(isHovering ? '#FFD54F' : '#FFFFFF');
      stroke('#0D47A1'); strokeWeight(2);
      circle(handleX, handleY, 25);
      fill('#0D47A1'); noStroke(); textAlign(CENTER,CENTER); textSize(16);
      text('↻', handleX, handleY);

      if(edRotDragStart && edRotSnapAngle!==null){
        push();
        translate(b.x,b.y);
        rotate(edRotSnapAngle);
        rectMode(CENTER);
        noFill();
        stroke(255, 213, 79, 230);
        strokeWeight(2);
        rect(0,0,b.w+10,b.h+10,2);
        pop();
      }
    }
  }
  // Draw pigs
  for(let i=0;i<edPigs.length;i++){
    let p=edPigs[i];
    push(); translate(p.x,p.y);
    stroke(255,255,255,180); strokeWeight(2); fill(200,230,255,100);
    arc(0,-5,p.r*1.5,p.r*1.8,0,PI,OPEN); line(-p.r*0.75,-5,p.r*0.75,-5);
    line(0,p.r*0.4,0,p.r*1.2); line(-p.r*0.5,p.r*1.2,p.r*0.5,p.r*1.2);
    noStroke(); fill(255,255,255,80); ellipse(-p.r*0.3,-p.r*0.2,p.r*0.4,p.r*0.6);
    let isSelected = edSelected.some(s => s.idx === i && s.type === 'pig');
    if(isSelected){
      noFill(); stroke(0,180,255); strokeWeight(2); circle(0,0,p.r*2+8);
    }
    pop();
  }

  // Draw selection rectangle
  if(edDraggingRect && edSelRectStart && edSelRectEnd){
    noFill(); stroke(0,180,255); strokeWeight(2);
    let minX = min(edSelRectStart.x, edSelRectEnd.x);
    let maxX = max(edSelRectStart.x, edSelRectEnd.x);
    let minY = min(edSelRectStart.y, edSelRectEnd.y);
    let maxY = max(edSelRectStart.y, edSelRectEnd.y);
    rect(minX, minY, maxX - minX, maxY - minY);
  }

  // Instructions
  fill(255,255,255,60); noStroke(); textAlign(CENTER,TOP); textSize(13);
  if(edBlocks.length===0&&edPigs.length===0)
    text('Click a tool on the left, then click here to place blocks and targets',640,30);
  pop();
}

function drawEdBirdPanel(){
  if(!edBirdPanel) return;
  push();
  fill(0,0,0,150); noStroke(); rectMode(CORNER); rect(0,0,1280,720);
  let ui=edBirdPanelLayout();
  let px=ui.px, py=ui.py, pw=ui.pw, ph=ui.ph;
  edBirdScroll=constrain(edBirdScroll,0,ui.maxScroll);
  // Panel
  rectMode(CORNER);
  let ctx=drawingContext;
  ctx.shadowBlur=30; ctx.shadowColor='rgba(0,0,0,0.6)';
  fill(30,30,50,240); stroke(255,255,255,40); strokeWeight(1);
  rect(px,py,pw,ph,16);
  ctx.shadowBlur=0;
  // Title
  fill('#FFD54F'); noStroke(); textAlign(CENTER,TOP); textSize(20);
  text('Bird Configuration',640,py+15);
  // Close X
  fill('#FF6B6B'); noStroke(); textAlign(CENTER,CENTER); textSize(22);
  text('✕',px+pw-20,py+18);
  // Bird list
  let typeNames={bird_s:'Small (Red)',bird_m:'Medium (Yellow)',bird_l:'Large (Big Red)'};
  let typeColors={bird_s:'#FF3B3B',bird_m:'#FFE100',bird_l:'#A30000'};
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(ui.listLeft, ui.listTop, ui.listRight-ui.listLeft, ui.listH);
  drawingContext.clip();
  for(let i=0;i<edBirds.length;i++){
    let by=ui.listTop+20+i*ui.rowH-edBirdScroll;
    if(by<ui.listTop-25||by>ui.listBottom+25) continue;
    // Bird preview circle
    fill(typeColors[edBirds[i]]); stroke(255,255,255,60); strokeWeight(1);
    circle(ui.listLeft+13,by,20);
    // Type name (click to cycle)
    fill(255); noStroke(); textAlign(LEFT,CENTER); textSize(14);
    text(typeNames[edBirds[i]],ui.listLeft+30,by);
    textSize(9); fill(150);
    text('click to change',ui.listLeft+30,by+14);
    // Remove button
    if(edBirds.length>1){
      fill('#FF4444'); noStroke(); textAlign(CENTER,CENTER); textSize(12);
      rectMode(CENTER); stroke('#991111'); strokeWeight(1);
      fill('#CC3333'); rect(ui.removeX,by,32,22,6);
      fill(255); noStroke(); textSize(11); text('✕',ui.removeX,by);
    }
  }
  drawingContext.restore();

  // Scrollbar
  if(ui.maxScroll>0){
    rectMode(CORNER);
    let trackX=ui.scrollX, trackY=ui.listTop, trackH=ui.listH;
    noStroke(); fill(255,255,255,35); rect(trackX,trackY,6,trackH,3);
    let thumbH=max(30,(ui.listH/(edBirds.length*ui.rowH))*trackH);
    let t=(edBirdScroll/ui.maxScroll);
    let thumbY=trackY+(trackH-thumbH)*t;
    fill(255,220,140,220); rect(trackX,thumbY,6,thumbH,3);
  }
  // Add buttons
  let aby=py+ph-36;
  let addTypes=['bird_s','bird_m','bird_l'];
  let addLabels=['Small','Medium','Large'];
  let canAdd=edBirds.length<12;
  rectMode(CENTER);
  for(let j=0;j<addTypes.length;j++){
    let bx=px+85+j*135;
    if(canAdd){
      fill(typeColors[addTypes[j]]); stroke(255,255,255,70); strokeWeight(1.5);
    } else {
      fill(95,95,110,220); stroke(160,160,170,80); strokeWeight(1.2);
    }
    rect(bx,aby,100,30,8);
    let txtCol = canAdd ? (addTypes[j]==='bird_m'?30:255) : 190;
    fill(txtCol); noStroke(); textAlign(CENTER,CENTER); textSize(12);
    text('+ '+addLabels[j],bx,aby);
  }
  pop();
}

function drawEditorUI(){
  push();
  // Top bar info
  let ctx=drawingContext;
  ctx.shadowBlur=0;
  fill(0,0,0,40); noStroke(); rect(edTBW,0,1280-edTBW,44);
  fill(255); textAlign(LEFT,CENTER); textSize(15); noStroke();
  text('Level Designer',edTBW+15,22);
  fill(200); textSize(12); textAlign(RIGHT,CENTER);
  text('Blocks: '+edBlocks.length+'  Targets: '+edPigs.length+'  Birds: '+edBirds.length,1260,22);
  pop();
}
