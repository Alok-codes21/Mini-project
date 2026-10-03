/* Hero glyph field. A WebGL2 port of the "ASCII field" look from motion.dev's home hero:
   a blueberry ground (motion.dev/examples hero) with small dot / corner / cross / double-line glyphs that follow a flowing shape,
   coloured by a horizontal lemon > green > blue > purple > pink > red gradient, and swished by the cursor.
   (Re-implemented from scratch for this project: no code or assets are copied from motion.dev.)
   Falls back to a plain blue background when WebGL2 or motion is not available. */
const FW = 40, FH = 24, K = 4, MAXV = 0.16, FRAME = 1000 / 60;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---- pointer flow simulation (CPU, 40x24 grid) ----
const makeFlow = () => ({ read: new Float32Array(FW * FH * K), write: new Float32Array(FW * FH * K) });
const smp = (a, x, y, c) => {
  x = clamp(x, 0, FW - 1); y = clamp(y, 0, FH - 1);
  const l = Math.floor(x), n = Math.floor(y), g = Math.min(FW - 1, l + 1), e = Math.min(FH - 1, n + 1), t = x - l, u = y - n;
  const A = a[(n * FW + l) * K + c], B = a[(n * FW + g) * K + c], C = a[(e * FW + l) * K + c], D = a[(e * FW + g) * K + c];
  const top = A + (B - A) * t, bot = C + (D - C) * t; return top + (bot - top) * u;
};
function splat(f, x, y, vx, vy, s) {
  const gx = clamp(x, 0, 1) * (FW - 1), gy = clamp(y, 0, 1) * (FH - 1), r = 1.2 + clamp(s, 0, 1) * 1.25, t = Math.ceil(r * 2), r2 = r * r;
  for (let j = Math.max(0, Math.floor(gy) - t); j <= Math.min(FH - 1, Math.ceil(gy) + t); j++)
    for (let i = Math.max(0, Math.floor(gx) - t); i <= Math.min(FW - 1, Math.ceil(gx) + t); i++) {
      const dx = i - gx, dy = j - gy, w = Math.exp(-(dx * dx + dy * dy) / (r2 * 0.72)); if (w < 0.01) continue;
      const p = (j * FW + i) * K;
      f.read[p] = clamp(f.read[p] + vx * w * 0.48, -MAXV, MAXV); f.read[p + 1] = clamp(f.read[p + 1] + vy * w * 0.48, -MAXV, MAXV); f.read[p + 2] = Math.min(1.2, f.read[p + 2] + w * s * 0.72);
    }
}
function stepFlow(f, dt) {
  const c = clamp(dt / FRAME, 0, 4), damp = Math.pow(0.935, c), fade = Math.pow(0.985, c), diff = Math.min(0.08, c * 0.08), adv = c * 0.62, n = f.read, w = f.write;
  for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
    const p = (j * FW + i) * K, sx = i - n[p] * FW * adv, sy = j - n[p + 1] * FH * adv;
    const a = smp(n, sx, sy, 0), b = smp(n, sx, sy, 1), d = smp(n, sx, sy, 2);
    const na = (smp(n, i - 1, j, 0) + smp(n, i + 1, j, 0) + smp(n, i, j - 1, 0) + smp(n, i, j + 1, 0)) * 0.25;
    const nb = (smp(n, i - 1, j, 1) + smp(n, i + 1, j, 1) + smp(n, i, j - 1, 1) + smp(n, i, j + 1, 1)) * 0.25;
    const nd = (smp(n, i - 1, j, 2) + smp(n, i + 1, j, 2) + smp(n, i, j - 1, 2) + smp(n, i, j + 1, 2)) * 0.25;
    w[p] = clamp((a + (na - a) * diff) * damp, -MAXV, MAXV); w[p + 1] = clamp((b + (nb - b) * diff) * damp, -MAXV, MAXV);
    w[p + 2] = Math.max(0, d + (nd - d) * diff * 0.65) * fade; w[p + 3] = 0;
  }
  f.read = w; f.write = n;
}

const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.0-1.0,0.0,1.0); }`;

const FS = `#version 300 es
precision highp float; precision highp int;
uniform vec2 uRes; uniform float uTime, uCell, uReveal; uniform vec4 uPointer; uniform sampler2D uFlow;
out vec4 outColor;
const vec3 LEMON=vec3(0.98458,0.83692,0.03552), RIND=vec3(0.32176,0.80218,0.5257), BLUE=vec3(0.24427,0.59749,1.0), PURPLE=vec3(0.63334,0.42194,0.89941), PINK=vec3(0.96929,0.40484,0.75601), RED=vec3(1.0,0.2864,0.27058);
vec4 flowCell(int x,int y){ return texelFetch(uFlow, ivec2(clamp(x,0,${FW - 1}),clamp(y,0,${FH - 1})),0); }
vec4 flowAt(vec2 uv){ vec2 c=clamp(uv,0.0,1.0)*vec2(${FW - 1}.0,${FH - 1}.0); ivec2 lo=ivec2(floor(c)); ivec2 hi=min(lo+1,ivec2(${FW - 1},${FH - 1})); vec2 b=fract(c);
  return mix(mix(flowCell(lo.x,lo.y),flowCell(hi.x,lo.y),b.x), mix(flowCell(lo.x,hi.y),flowCell(hi.x,hi.y),b.x), b.y); }
float field(vec2 uv,float t){
  float aspect=uRes.x/max(uRes.y,1.0); vec2 p=vec2((uv.x-0.56)*aspect, uv.y-0.52);
  vec2 warp=vec2(sin(p.y*5.2+t*0.34)*0.13, sin(p.x*4.1-t*0.27)*0.1)*0.8; p+=warp;
  float fa=sin(p.x*7.0+p.y*3.1+t*0.42), fb=cos(p.y*8.2-p.x*2.7-t*0.31);
  float ribbon=abs(p.y+fa*0.16+fb*0.07);
  float body=1.0-smoothstep(0.18,0.72,length(p*vec2(0.84,1.12)));
  float wave=1.0-smoothstep(0.06,0.42,ribbon);
  float lobe=1.0-smoothstep(0.16,0.68,length(p-vec2(0.3+sin(t*0.21)*0.07,-0.08)));
  float cover=0.12+0.34*sin(p.y*9.0+sin(p.x*3.2+t*0.35)*1.6-t*0.3)+0.12*cos(p.x*4.0-t*0.25);
  return clamp(max(max(body*0.5+wave*0.3, lobe*0.5), cover),0.0,1.0); }
vec3 palette(float t){
  const vec3 CYAN=vec3(0.22,0.72,1.0);
  if(t<0.5) return mix(RIND,CYAN,smoothstep(0.0,0.5,t)); return mix(CYAN,PURPLE,smoothstep(0.5,1.0,t)); }
float lineMask(vec2 p,float hl,float w){ return (1.0-smoothstep(w,w+0.08,abs(p.y)))*(1.0-smoothstep(hl,hl+0.08,abs(p.x))); }
float glyph(vec2 l,vec2 tg,float v,float edge){
  vec2 n=vec2(-tg.y,tg.x); vec2 p=vec2(dot(l,tg),dot(l,n));
  float dotM=1.0-smoothstep(0.12,0.22,length(l)); float contour=lineMask(p,0.72,0.08);
  float cross=max(lineMask(l,0.56,0.075),lineMask(vec2(l.y,l.x),0.48,0.075));
  float dbl=max(lineMask(p+vec2(0.0,0.22),0.64,0.065),lineMask(p-vec2(0.0,0.22),0.64,0.065));
  float corner=max(lineMask(vec2(l.x+0.18,l.y-0.28),0.45,0.07),lineMask(vec2(l.y+0.25,l.x+0.25),0.34,0.07));
  if(edge>0.06) return contour; if(v<0.12) return dotM; if(v<0.26) return corner; if(v<0.4) return cross; return dbl; }
void main(){
  vec2 pos=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y);
  vec2 cellSize=vec2(uCell*0.6667,uCell); vec2 cell=floor(pos/cellSize); vec2 uv=((cell+0.5)*cellSize)/uRes; vec2 loc=fract(pos/cellSize)*2.0-1.0;
  vec4 fl=flowAt(uv); float fs=clamp(fl.z,0.0,1.0);
  float head=0.0; float mv=length(uPointer.zw);
  if(uPointer.x>=0.0&&uPointer.x<=1.0&&uPointer.y>=0.0&&uPointer.y<=1.0){
    float asp=uRes.x/max(uRes.y,1.0); vec2 rel=(uv-uPointer.xy)*vec2(asp,1.0); float hr=(0.035+clamp(mv*10.0,0.0,1.0)*0.035)*0.75;
    head=(1.0-smoothstep(hr,hr*1.7,length(rel)))*smoothstep(0.002,0.006,mv); }
  float swish=clamp(max(fs*1.05,head*0.9),0.0,1.0); float fsp=length(fl.xy);
  vec2 pd=normalize(uPointer.zw+vec2(0.00001,0.0)); vec2 fd=normalize(fl.xy+vec2(0.00001,0.0));
  vec2 sd=normalize(mix(pd,fd,smoothstep(0.002,0.025,fsp))+vec2(0.00001,0.0));
  vec2 suv=uv-fl.xy*fs*0.26-pd*head*0.015;
  float value=field(suv,uTime)*mix(0.12,1.0,smoothstep(0.1,0.34,uv.y)); vec2 st=cellSize/uRes;
  float dx=field(suv+vec2(st.x,0.0),uTime)-field(suv-vec2(st.x,0.0),uTime); float dy=field(suv+vec2(0.0,st.y),uTime)-field(suv-vec2(0.0,st.y),uTime);
  float edge=length(vec2(dx,dy)); vec2 inN=normalize(vec2(dx,dy)+vec2(0.0001,0.0)); vec2 tan_=vec2(-inN.y,inN.x);
  vec2 gt=normalize(mix(tan_,sd,smoothstep(0.04,0.52,swish)*0.42)+vec2(0.0001,0.0));
  float drift=sin(uv.y*5.0+uTime*0.12)*0.08; vec3 col=palette(clamp(0.5+0.5*sin(uv.x*3.4+uv.y*1.3+drift*2.0-uTime*0.32),0.0,1.0));
  float srcA=smoothstep(0.04,0.42,value)*0.9; vec3 solid=BLUE; vec3 mapped=mix(solid,col,srcA);
  float cn=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
  float rt=smoothstep(0.0,1.0,uReveal); float wf=rt*1.78-0.34; float thr=uv.x+(cn-0.5)*0.14; float reveal=smoothstep(-0.03,0.42,wf-thr); float gr=smoothstep(0.08,0.9,reveal);
  vec3 res=mix(solid,mapped,reveal); float cut=clamp(fs*0.28+head*0.18,0.0,0.34); res=mix(res,solid,cut);
  float rx=uv.x+(cn-0.5)*0.16+sin(uv.y*6.0+uTime*0.2)*0.05; float gm;
  if(edge>0.06) gm=glyph(loc,gt,value,edge);
  else if(rx<0.26) gm=max(lineMask(loc,0.52,0.075),lineMask(vec2(loc.y,loc.x),0.52,0.075));
  else if(rx<0.6) gm=lineMask(vec2(loc.y,loc.x),0.78,0.1);
  else { vec2 r=vec2(loc.x*0.82-loc.y*0.57,loc.x*0.57+loc.y*0.82); gm=lineMask(r,0.78,0.085); } float vis=smoothstep(0.035,0.18,value+edge*1.8);
  float bb=smoothstep(0.035,0.16,edge)*(1.0-smoothstep(0.68,0.94,value)); float side=smoothstep(-0.42,0.58,dot(loc,inN)); float lift=bb*side*0.35;
  float ink=gm*vis*(0.5+edge*2.4)*(1.0+lift*0.45)*mix(0.015,1.0,gr);
  vec3 gc=mix(mapped,vec3(1.0),gr*(0.94+lift*0.06)); res=mix(res,gc,clamp(ink,0.0,0.96));
  outColor=vec4(res,1.0); }`;

export function mountAsciiField(host, { cell = 15 } = {}) {
  host.style.background = "#3e98ff";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true"); cv.className = "ascii-canvas";
  const gl = cv.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return () => {};
  host.prepend(cv);
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try { gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); }
  catch (e) { console.warn("ascii field disabled:", e.message); cv.remove(); return () => {}; }
  gl.useProgram(prog);
  const U = (n) => gl.getUniformLocation(prog, n);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, FW, FH, 0, gl.RGBA, gl.FLOAT, null);
  gl.uniform1i(U("uFlow"), 0);
  const flow = makeFlow(), ptr = { x: -2, y: -2, vx: 0, vy: 0, lx: 0, ly: 0, at: 0 };
  const fit = () => { const r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1.5), w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return d; };
  const onMove = (e) => {
    if (reduce || e.pointerType === "touch") return;
    const r = host.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width, 0, 1), y = clamp((e.clientY - r.top) / r.height, 0, 1), now = performance.now();
    if (ptr.at > 0) { const dt = clamp(now - ptr.at, 8, 50), k = FRAME / dt, B = 0.68; ptr.vx += ((x - ptr.lx) * k - ptr.vx) * B; ptr.vy += ((y - ptr.ly) * k - ptr.vy) * B; ptr.vx = clamp(ptr.vx, -0.14, 0.14); ptr.vy = clamp(ptr.vy, -0.14, 0.14); }
    const s = Math.min(1, Math.hypot(ptr.vx, ptr.vy) * 48);
    if (ptr.at > 0 && s > 0.01) { const d = Math.hypot((x - ptr.lx) * FW, (y - ptr.ly) * FH), n = Math.max(1, Math.ceil(d * 0.75)); for (let t = 1; t <= n; t++) { const q = t / n; splat(flow, ptr.lx + (x - ptr.lx) * q, ptr.ly + (y - ptr.ly) * q, ptr.vx, ptr.vy, s); } }
    ptr.x = x; ptr.y = y; ptr.lx = x; ptr.ly = y; ptr.at = now;
  };
  const onLeave = () => { ptr.x = ptr.y = -2; ptr.vx = ptr.vy = 0; ptr.at = 0; };
  host.addEventListener("pointermove", onMove); host.addEventListener("pointerleave", onLeave);
  let raf = 0, last = 0, t0 = 0, visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }); io.observe(host);
  const frame = (now) => {
    raf = 0; if (!visible || document.hidden) return;
    fit(); gl.viewport(0, 0, cv.width, cv.height);
    const dt = last ? clamp(now - last, 0, 64) : FRAME; last = now; if (!t0) t0 = now;
    const damp = Math.pow(0.975, dt / FRAME); ptr.vx *= damp; ptr.vy *= damp;
    if (!reduce) stepFlow(flow, dt);
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FW, FH, gl.RGBA, gl.FLOAT, flow.read);
    const d = Math.min(devicePixelRatio || 1, 1.5);
    gl.uniform2f(U("uRes"), cv.width, cv.height); gl.uniform1f(U("uTime"), reduce ? 3 : now / 1000); gl.uniform1f(U("uCell"), cell * d);
    gl.uniform1f(U("uReveal"), reduce ? 1 : clamp((now - t0) / 2600, 0, 1)); gl.uniform4f(U("uPointer"), ptr.x, ptr.y, reduce ? 0 : ptr.vx, reduce ? 0 : ptr.vy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); io.disconnect(); host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerleave", onLeave); cv.remove(); };
}
