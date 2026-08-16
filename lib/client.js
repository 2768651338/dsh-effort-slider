window.__ModuleLoader__.load({
	id: "dsh-effort-slider",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_dom_client = require("react-dom/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/effort/shaders.ts
		/** WebGL2 fire shaders (ported from the reference effort-card demo). */
		const VERT = `#version 300 es
  layout(location=0) in vec2 a_pos;
  out vec2 v_uv;
  void main(){ v_uv=a_pos*0.5+0.5; gl_Position=vec4(a_pos,0.0,1.0); }
`;
		const FRAG_SIM = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform float u_time, u_slider, u_elapsed;
  uniform sampler2D u_back;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){
    vec2 uv=v_uv;
    vec2 g=uv*vec2(72.0,6.0);
    vec2 id=floor(g);
    vec2 cf=fract(g);
    float h=hash(id);
    vec2 ap=abs(cf-0.5);
    float cell=smoothstep(0.34,0.22,max(ap.x*0.9,ap.y));
    vec3 prev=texture(u_back,uv).rgb;
    float fade_mask = smoothstep(0.0, 0.4, uv.x);
    vec3 decay = prev * 0.90 * fade_mask;
    float intensity = smoothstep(0.0, 0.2, u_slider) * mix(0.08, 1.0, pow(u_slider, 0.55));
    float t=u_time;
    float cellDelay = h * 1.2;
    float cellAge   = max(u_elapsed - cellDelay, 0.0);
    float ignited   = step(0.001, cellAge);
    float cellSpd   = 0.85 + h * 0.30;
    float eased = 1.0 - pow(1.0 - clamp(cellAge / 2.5, 0.0, 1.0), 3.0);
    float dist  = eased * u_slider * cellSpd * ignited;
    float cellOff = (h - 0.5) * 0.05;
    float front   = max(u_slider - dist - cellOff, 0.02);
    float tail    = max(u_slider - front, 0.001);
    float inZ   = step(front - 0.003, uv.x) * step(uv.x, u_slider + 0.003);
    float dn    = clamp(max(u_slider - uv.x, 0.0) / tail, 0.0, 1.0);
    float bright = pow(1.0 - dn, 0.65);
    bright = max(bright, 0.04 * ignited) * inZ;
    bright *= 1.0 - smoothstep(0.94, 1.05, dn);
    float es = mix(0.15, 0.5, min(u_elapsed / 1.0, 1.0));
    float vy = abs(uv.y - 0.5) * 2.0;
    float vf = pow(max(1.0 - vy * vy * 0.45, 0.0), 0.75);
    float ts = mix(0.85, 1.0, min(u_elapsed / 1.5, 1.0));
    float f1 = sin(uv.x * 30.0 + t * 15.0 * ts + h * 6.28);
    float f2 = sin(uv.x * 17.0 + t * 8.0 * ts + h * 3.14);
    float f3 = sin(uv.x * 52.0 + t * 25.0 * ts + h * 10.0);
    float flame = smoothstep(0.08, 0.92, (f1 + f2 * 0.5 + f3 * 0.25) * 0.35 + 0.5);
    float r1 = sin(dn * 16.0 - t * 5.0 * ts + h * 3.0);
    float r2 = sin(dn * 8.0 - t * 2.5 * ts + h * 5.0);
    float rhythm = smoothstep(-0.15, 0.55, r1) * (r2 * 0.5 + 0.5);
    rhythm = pow(max(rhythm, 0.0), 1.2);
    float avgSpd = dist / max(cellAge, 0.001);
    float age    = max(cellAge - max(u_slider - uv.x, 0.0) / max(avgSpd, 0.001), 0.0);
    float flash  = step(0.0, age) * exp(-age * 3.2);
    float sp  = fract(t * (0.38 + h * 0.15) + h * 7.0);
    float sX  = u_slider - sp * tail;
    float sY  = 0.5 + sin(sp * 11.0 + h * 6.28) * 0.28;
    float spark = smoothstep(0.014, 0.0, abs(uv.x - sX))
                * smoothstep(0.18, 0.0, abs(uv.y - sY))
                * (1.0 - sp) * (1.0 - sp) * es;
    float energy = bright * vf * (flame * 0.42 + rhythm * 0.38)
                 + flash * bright * vf * 0.55
                 + spark * 0.7 * inZ;
    energy *= es * intensity;
    float edgeBase = exp(-pow((uv.x - front) * 18.0, 2.0));
    float ef1 = sin(uv.x * 45.0 + t * 20.0 * ts + h * 6.28) * 0.5 + 0.5;
    float ef2 = sin(uv.x * 28.0 + t * 11.0 * ts + h * 3.14) * 0.5 + 0.5;
    float edge = edgeBase * (0.25 + ef1 * ef2 * 1.5) * 1.6 * intensity * es;
    float leadD    = front - uv.x;
    float leadZone = smoothstep(0.07, 0.0, leadD) * step(0.0, leadD) * vf;
    float h2       = hash(id + vec2(99.0, 33.0));
    float leadF    = sin(leadD * 100.0 + t * 20.0 * ts + h2 * 6.28) * 0.5 + 0.5;
    float leadSpark = leadZone * step(0.6, h2) * leadF * intensity * es * 0.5;
    float total = energy + edge + leadSpark;
    vec3 ember = vec3(0.28, 0.10, 0.58);
    vec3 wpur  = vec3(0.62, 0.32, 1.0);
    vec3 wht   = vec3(1.0, 0.94, 0.98);
    float temp = 1.0 - dn;
    vec3 col   = mix(ember, wpur, temp);
    col        = mix(col, wht, pow(temp, 4.5));
    col       *= total;
    float pulse = sin(t * 2.8) * 0.15 + 1.0;
    float core  = exp(-pow((uv.x - u_slider) * 16.0, 2.0));
    col += wht * core * 2.2 * pulse * intensity * es;
    col += wpur * exp(-pow((uv.x - u_slider) * 3.5, 2.0)) * 0.12 * intensity * es;
    col *= cell;
    col *= fade_mask;
    fc = vec4(min(decay + col, vec3(1.5)), 1.0);
  }
`;
		const FRAG_BLUR = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform sampler2D u_tex;
  uniform vec2 u_dir, u_res;
  uniform float u_ext;
  vec3 s(vec2 uv){
    vec3 c=texture(u_tex,uv).rgb;
    return u_ext>0.5 && dot(c,vec3(0.2126,0.7152,0.0722))<0.3 ? vec3(0.0) : c;
  }
  void main(){
    vec2 o=u_dir*1.8/u_res;
    vec3 r=s(v_uv)*0.227027;
    r+=s(v_uv+o)*0.194595;    r+=s(v_uv-o)*0.194595;
    r+=s(v_uv+o*2.0)*0.121622;r+=s(v_uv-o*2.0)*0.121622;
    r+=s(v_uv+o*3.0)*0.054054;r+=s(v_uv-o*3.0)*0.054054;
    fc=vec4(r,1.0);
  }
`;
		const FRAG_COMP = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform sampler2D u_scene, u_glow;
  void main(){
    vec3 s=texture(u_scene,v_uv).rgb;
    vec3 g=texture(u_glow,v_uv).rgb;
    fc=vec4(1.0-exp(-(s+g*1.2+s*g*0.35)*1.15),1.0);
  }
`;
		//#endregion
		//#region src/client/effort/useWebglFire.ts
		/**
		* WebGL2 fire effect for the effort slider track (ported from the reference
		* effort-card demo): a three-pass simulation (ignition -> blur -> composite)
		* whose front edge follows the slider value. React adaptation: the slider and
		* active flags are read through refs that render keeps fresh, so the effect
		* runs a single mount-time loop without re-initialising on value changes.
		*/
		/**
		* Start the fire loop on the given canvas.
		* @param canvasRef - the track canvas.
		* @param getSlider - returns the current slider position in 0..1.
		* @param getActive - whether the fire should burn (panel open).
		*/
		function useWebglFire(canvasRef, getSlider, getActive) {
			const sliderRef = (0, react.useRef)(0);
			const activeRef = (0, react.useRef)(false);
			sliderRef.current = getSlider();
			activeRef.current = getActive();
			const ensureLoopRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const canvas = canvasRef.current;
				if (canvas === null) {
					console.warn("[effort-slider] fire: canvas not found");
					return;
				}
				const gl = canvas.getContext("webgl2", {
					preserveDrawingBuffer: false,
					antialias: false
				});
				if (gl === null) {
					console.warn("[effort-slider] fire: webgl2 context unavailable (browser GPU/hardware acceleration off?)");
					return;
				}
				let rafId = null;
				let resizeObserver = null;
				let resizeDebounce;
				let loopRunning = false;
				let idleFrames = 0;
				let startTime = null;
				let springValue = .7;
				let springVelocity = 0;
				let lastSpringTime = 0;
				const MAX_IDLE = 180;
				const SPRING_STIFFNESS = 7;
				const SPRING_DAMP = .55;
				let simProg = null;
				let blurProg = null;
				let compProg = null;
				let vao = null;
				let vbo = null;
				let programsReady = false;
				let simA = null;
				let simB = null;
				let blurH = null;
				let blurV = null;
				const U = {};
				const onContextLost = (e) => e.preventDefault();
				const onContextRestored = () => {
					programsReady = false;
					compilePrograms();
					if (programsReady) {
						resize();
						if (sliderRef.current > 0) ensureLoop();
					}
				};
				function compileShader(type, src) {
					const sh = gl.createShader(type);
					if (sh === null) return null;
					gl.shaderSource(sh, src);
					gl.compileShader(sh);
					if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
						gl.deleteShader(sh);
						return null;
					}
					return sh;
				}
				function linkProgram(vsSrc, fsSrc) {
					const v = compileShader(gl.VERTEX_SHADER, vsSrc);
					const f = compileShader(gl.FRAGMENT_SHADER, fsSrc);
					if (v === null || f === null) return null;
					const p = gl.createProgram();
					if (p === null) return null;
					gl.attachShader(p, v);
					gl.attachShader(p, f);
					gl.bindAttribLocation(p, 0, "a_pos");
					gl.linkProgram(p);
					gl.deleteShader(v);
					gl.deleteShader(f);
					if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
					return p;
				}
				function compilePrograms() {
					simProg = linkProgram(VERT, FRAG_SIM);
					blurProg = linkProgram(VERT, FRAG_BLUR);
					compProg = linkProgram(VERT, FRAG_COMP);
					if (simProg === null || blurProg === null || compProg === null) return;
					vao = gl.createVertexArray();
					gl.bindVertexArray(vao);
					vbo = gl.createBuffer();
					gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
					gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
						-1,
						-1,
						1,
						-1,
						-1,
						1,
						-1,
						1,
						1,
						-1,
						1,
						1
					]), gl.STATIC_DRAW);
					gl.enableVertexAttribArray(0);
					gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
					U.simTime = gl.getUniformLocation(simProg, "u_time");
					U.simSlider = gl.getUniformLocation(simProg, "u_slider");
					U.simElapsed = gl.getUniformLocation(simProg, "u_elapsed");
					U.simBack = gl.getUniformLocation(simProg, "u_back");
					U.blurDir = gl.getUniformLocation(blurProg, "u_dir");
					U.blurExt = gl.getUniformLocation(blurProg, "u_ext");
					U.blurTex = gl.getUniformLocation(blurProg, "u_tex");
					U.blurRes = gl.getUniformLocation(blurProg, "u_res");
					U.compScene = gl.getUniformLocation(compProg, "u_scene");
					U.compGlow = gl.getUniformLocation(compProg, "u_glow");
					programsReady = true;
				}
				function makeFBO() {
					const fbo = gl.createFramebuffer();
					const tex = gl.createTexture();
					if (fbo === null || tex === null) return null;
					gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
					gl.bindTexture(gl.TEXTURE_2D, tex);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
					gl.clearColor(0, 0, 0, 1);
					gl.clear(gl.COLOR_BUFFER_BIT);
					return {
						fbo,
						tex
					};
				}
				function createFBOs() {
					simA = makeFBO();
					simB = makeFBO();
					blurH = makeFBO();
					blurV = makeFBO();
				}
				function destroyFBO(entry) {
					if (entry === null) return;
					gl.deleteFramebuffer(entry.fbo);
					gl.deleteTexture(entry.tex);
				}
				function destroyFBOs() {
					destroyFBO(simA);
					simA = null;
					destroyFBO(simB);
					simB = null;
					destroyFBO(blurH);
					blurH = null;
					destroyFBO(blurV);
					blurV = null;
				}
				function destroyPrograms() {
					if (simProg !== null) gl.deleteProgram(simProg);
					if (blurProg !== null) gl.deleteProgram(blurProg);
					if (compProg !== null) gl.deleteProgram(compProg);
					if (vao !== null) gl.deleteVertexArray(vao);
					if (vbo !== null) gl.deleteBuffer(vbo);
					simProg = blurProg = compProg = null;
					vao = null;
					vbo = null;
					programsReady = false;
				}
				function resize() {
					const rect = canvas.getBoundingClientRect();
					const w = rect.width || canvas.clientWidth || 132;
					const h = rect.height || canvas.clientHeight || 30;
					if (!w || !h) return;
					const dpr = window.devicePixelRatio || 1;
					canvas.width = Math.round(w * dpr);
					canvas.height = Math.round(h * dpr);
					destroyFBOs();
					createFBOs();
				}
				function ensureLoop() {
					if (simA === null || simB === null) {
						resize();
						if (simA === null || simB === null) return;
					}
					if (loopRunning) {
						idleFrames = 0;
						return;
					}
					loopRunning = true;
					idleFrames = 0;
					startTime = performance.now();
					lastSpringTime = performance.now();
					springValue = sliderRef.current;
					springVelocity = 0;
					gl.bindFramebuffer(gl.FRAMEBUFFER, simA.fbo);
					gl.clear(gl.COLOR_BUFFER_BIT);
					gl.bindFramebuffer(gl.FRAMEBUFFER, simB.fbo);
					gl.clear(gl.COLOR_BUFFER_BIT);
					rafId = requestAnimationFrame(render);
				}
				ensureLoopRef.current = ensureLoop;
				function renderFrame(t) {
					const now = performance.now();
					const dt = Math.min((now - lastSpringTime) / 1e3, .05);
					lastSpringTime = now;
					const target = sliderRef.current;
					if (springValue < target) {
						const force = (target - springValue) * SPRING_STIFFNESS;
						springVelocity += force * dt;
						springVelocity *= 1 - SPRING_DAMP * dt * 6;
						springValue += springVelocity * dt;
						if (springValue > target) {
							springValue = target;
							springVelocity = 0;
						}
					} else {
						springValue = target;
						springVelocity = 0;
					}
					if (sliderRef.current <= 0 && !activeRef.current) {
						if (++idleFrames > MAX_IDLE) {
							loopRunning = false;
							rafId = null;
							return;
						}
						return;
					}
					idleFrames = 0;
					const elapsed = startTime !== null ? (now - startTime) / 1e3 : 0;
					gl.viewport(0, 0, canvas.width, canvas.height);
					if (simB !== null && simProg !== null && blurProg !== null && compProg !== null && blurH !== null && blurV !== null && simA !== null) {
						gl.bindFramebuffer(gl.FRAMEBUFFER, simB.fbo);
						gl.useProgram(simProg);
						gl.uniform1f(U.simTime, t * .001);
						gl.uniform1f(U.simSlider, springValue);
						gl.uniform1f(U.simElapsed, elapsed);
						gl.activeTexture(gl.TEXTURE0);
						gl.bindTexture(gl.TEXTURE_2D, simA.tex);
						gl.uniform1i(U.simBack, 0);
						gl.drawArrays(gl.TRIANGLES, 0, 6);
						gl.useProgram(blurProg);
						gl.uniform2f(U.blurRes, canvas.width, canvas.height);
						gl.bindFramebuffer(gl.FRAMEBUFFER, blurH.fbo);
						gl.uniform2f(U.blurDir, 1, 0);
						gl.uniform1f(U.blurExt, 1);
						gl.bindTexture(gl.TEXTURE_2D, simB.tex);
						gl.uniform1i(U.blurTex, 0);
						gl.drawArrays(gl.TRIANGLES, 0, 6);
						gl.bindFramebuffer(gl.FRAMEBUFFER, blurV.fbo);
						gl.uniform2f(U.blurDir, 0, 1);
						gl.uniform1f(U.blurExt, 0);
						gl.bindTexture(gl.TEXTURE_2D, blurH.tex);
						gl.drawArrays(gl.TRIANGLES, 0, 6);
						gl.bindFramebuffer(gl.FRAMEBUFFER, null);
						gl.useProgram(compProg);
						gl.activeTexture(gl.TEXTURE0);
						gl.bindTexture(gl.TEXTURE_2D, simB.tex);
						gl.uniform1i(U.compScene, 0);
						gl.activeTexture(gl.TEXTURE1);
						gl.bindTexture(gl.TEXTURE_2D, blurV.tex);
						gl.uniform1i(U.compGlow, 1);
						gl.drawArrays(gl.TRIANGLES, 0, 6);
						const tmp = simA;
						simA = simB;
						simB = tmp;
					}
				}
				function render(t) {
					renderFrame(t);
					if (loopRunning) rafId = requestAnimationFrame(render);
				}
				canvas.addEventListener("webglcontextlost", onContextLost);
				canvas.addEventListener("webglcontextrestored", onContextRestored);
				compilePrograms();
				if (programsReady) {
					console.log(`[effort-slider] fire: gl ready (canvas ${canvas.clientWidth}x${canvas.clientHeight})`);
					resizeObserver = new ResizeObserver(() => {
						window.clearTimeout(resizeDebounce);
						resizeDebounce = window.setTimeout(resize, 80);
					});
					resizeObserver.observe(canvas);
					resize();
					console.log(`[effort-slider] fire: buffer ${canvas.width}x${canvas.height}`);
					if (sliderRef.current > 0) ensureLoop();
					else console.warn("[effort-slider] fire: skipped start, slider=0");
				} else console.warn("[effort-slider] fire: shader/program compile failed");
				return () => {
					if (rafId !== null) cancelAnimationFrame(rafId);
					resizeObserver?.disconnect();
					window.clearTimeout(resizeDebounce);
					loopRunning = false;
					destroyFBOs();
					destroyPrograms();
					canvas.removeEventListener("webglcontextlost", onContextLost);
					canvas.removeEventListener("webglcontextrestored", onContextRestored);
					ensureLoopRef.current = null;
				};
			}, [canvasRef]);
			(0, react.useEffect)(() => {
				if (sliderRef.current > 0) ensureLoopRef.current?.();
			});
		}
		//#endregion
		//#region \0dsh-effort-css:D:\PersonalFile\TXC\Project\default\dsh-effort-slider\src\client\effort\effort.module.css.mjs
		const css = ".uJrKga_panel{user-select:none;z-index:10;pointer-events:auto;width:280px;position:absolute;top:0;left:0}.uJrKga_glow{opacity:.6;filter:blur(8px);z-index:0;pointer-events:none;background:linear-gradient(135deg,#a855f74d,#3b82f626,#a855f733);border-radius:18px;position:absolute;inset:-3px}.uJrKga_inner{z-index:1;background:linear-gradient(160deg,#0e0a16 0%,#140e20 50%,#0c0818 100%);border:1px solid #a855f71f;border-radius:13px;padding:14px 16px 12px;position:relative;box-shadow:0 8px 32px #00000080,inset 0 1px #ffffff0a}.uJrKga_head{justify-content:space-between;align-items:center;margin-bottom:2px;display:flex}.uJrKga_headLeft{align-items:center;gap:7px;font-size:14px;font-weight:500;display:inline-flex;overflow:hidden}.uJrKga_labelText{color:#8880a0;letter-spacing:.03em;font-weight:600}.uJrKga_status{color:#aaa0c0;text-transform:uppercase;will-change:transform, opacity, filter;vertical-align:middle;font-family:Georgia,Palatino Linotype,serif;font-style:italic;font-weight:700;transition:color .4s cubic-bezier(.25,.46,.45,.94),text-shadow .4s cubic-bezier(.25,.46,.45,.94);display:inline-block}.uJrKga_statusGlow{color:#c084fc;text-shadow:0 0 14px #a855f7b3}.uJrKga_level0{color:#c882a0bf}.uJrKga_level1{color:#c8aa82bf}.uJrKga_level2{color:#82aac8bf}.uJrKga_level3{color:#c084fcf2;text-shadow:0 0 10px #a855f7b3}.uJrKga_level4{color:#d8b4fe;text-shadow:0 0 12px #a855f7}.uJrKga_close{color:#8880a0;cursor:pointer;background:#a855f714;border:1px solid #a855f72e;border-radius:7px;justify-content:center;align-items:center;width:24px;height:24px;font-size:13px;line-height:1;display:inline-flex}.uJrKga_close:hover{color:#e8e0f0;background:#a855f729;border-color:#a855f766}.uJrKga_levelLabels{height:15px;margin-bottom:4px;position:relative}.uJrKga_levelLabel{color:#6a6080;letter-spacing:.04em;text-transform:uppercase;font-size:10px;font-weight:700;transition:color .15s;position:absolute;top:0;transform:translate(-50%)}.uJrKga_levelLabelActive{color:#c084fc}.uJrKga_trackWrapper{isolation:isolate;background:#08050e;border:1px solid #a855f714;border-radius:8px;height:32px;position:relative;overflow:hidden}.uJrKga_trackBg{z-index:0;background:linear-gradient(135deg,#0c0518,#06030c);position:absolute;inset:0}.uJrKga_dotsLayer{pointer-events:none;z-index:1;position:absolute;inset:0}.uJrKga_dot{background:#a855f740;border-radius:50%;width:4px;height:4px;transition:background .15s,box-shadow .15s;position:absolute;top:50%;transform:translateY(-50%)}.uJrKga_dotActive{background:#c084fc;box-shadow:0 0 8px #a855f7e6}.uJrKga_fire{pointer-events:none;mix-blend-mode:screen;z-index:2;width:100%;height:100%;position:absolute;inset:0}.uJrKga_range{-webkit-appearance:none;appearance:none;cursor:pointer;z-index:5;background:0 0;outline:none;width:100%;height:100%;margin:0;padding:0;position:absolute;inset:0}.uJrKga_range::-webkit-slider-thumb{-webkit-appearance:none;cursor:grab;background:linear-gradient(145deg,#e8e0f0 0%,#c8b8e0 50%,#b8a8d8 100%);border:none;border-radius:8px;width:28px;height:28px;transition:box-shadow .5s cubic-bezier(.25,.46,.45,.94),transform .35s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px #0006,0 0 0 1px #a855f726,inset 0 1px #ffffff80}.uJrKga_range::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(.92);box-shadow:0 1px 4px #00000080,0 0 0 1px #a855f740}.uJrKga_rangeGlow::-webkit-slider-thumb{box-shadow:0 2px 8px #0006,0 0 0 1px #a855f74d,0 0 20px #a855f759,0 0 40px #a855f726,inset 0 1px #ffffff80}.uJrKga_rangeGlow::-webkit-slider-thumb:active{box-shadow:0 1px 4px #00000080,0 0 0 1px #a855f766,0 0 24px #a855f766,0 0 48px #a855f733}.uJrKga_range::-moz-range-thumb{cursor:grab;background:linear-gradient(145deg,#e8e0f0 0%,#c8b8e0 50%,#b8a8d8 100%);border:none;border-radius:7px;width:26px;height:26px;box-shadow:0 2px 8px #0006,0 0 0 1px #a855f726}.uJrKga_range::-moz-range-thumb:active{cursor:grabbing;transform:scale(.95)}.uJrKga_range::-moz-range-track{background:0 0;border:none;height:32px}.uJrKga_pointLight{pointer-events:none;z-index:3;opacity:0;background:radial-gradient(circle,#a855f733 0%,#a855f70f 30%,#a855f704 55%,#0000 70%);border-radius:50%;width:150px;height:150px;transition:opacity .25s cubic-bezier(.25,.46,.45,.94);position:absolute;transform:translate(-50%,-50%)}.uJrKga_pointLightOn{opacity:1}.uJrKga_emptyOverlay{color:#6a6080;letter-spacing:.02em;text-align:center;padding:10px 0 2px;font-size:13px;font-weight:600}.uJrKga_statusEnterActive{transition:all .4s cubic-bezier(.25,.46,.45,.94)}.uJrKga_statusEnterFrom{opacity:0;filter:blur(10px);transform:translateY(8px)}";
		const tagId = "dsh-effort-slider/effort.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-effort-slider";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var effort_module_css_default = {
			"head": "uJrKga_head",
			"statusEnterFrom": "uJrKga_statusEnterFrom",
			"level4": "uJrKga_level4",
			"rangeGlow": "uJrKga_rangeGlow",
			"dotActive": "uJrKga_dotActive",
			"pointLight": "uJrKga_pointLight",
			"range": "uJrKga_range",
			"statusEnterActive": "uJrKga_statusEnterActive",
			"dot": "uJrKga_dot",
			"trackBg": "uJrKga_trackBg",
			"level3": "uJrKga_level3",
			"fire": "uJrKga_fire",
			"levelLabelActive": "uJrKga_levelLabelActive",
			"trackWrapper": "uJrKga_trackWrapper",
			"statusGlow": "uJrKga_statusGlow",
			"headLeft": "uJrKga_headLeft",
			"emptyOverlay": "uJrKga_emptyOverlay",
			"inner": "uJrKga_inner",
			"status": "uJrKga_status",
			"level2": "uJrKga_level2",
			"levelLabels": "uJrKga_levelLabels",
			"glow": "uJrKga_glow",
			"level0": "uJrKga_level0",
			"labelText": "uJrKga_labelText",
			"dotsLayer": "uJrKga_dotsLayer",
			"level1": "uJrKga_level1",
			"pointLightOn": "uJrKga_pointLightOn",
			"levelLabel": "uJrKga_levelLabel",
			"close": "uJrKga_close",
			"panel": "uJrKga_panel"
		};
		//#endregion
		//#region src/client/effort/EffortPanel.tsx
		/**
		* 仿 Claude Code 推理等级 Effort 面板 —— 参考 EffortCard 的 1:1 移植（辉光边框、
		* 渐变卡片、Easy/Intense 刻度标签、WebGL 火焰轨道、发光滑块、拖拽点光源）。
		* 点击官方模型菜单的「推理等级」行时弹出本面板（替代官方档位列表）；
		* 拖动过程连续无级，松手时吸附到最近的档位。
		*/
		/** 通用兜底刻度（与宿主侧 effort-core 的 universalReasoning 保持一致）。 */
		const UNIVERSAL_EFFORTS = [
			{
				id: "off",
				name: "OFF"
			},
			{
				id: "low",
				name: "Low"
			},
			{
				id: "medium",
				name: "Medium"
			},
			{
				id: "high",
				name: "High"
			},
			{
				id: "max",
				name: "Ultracode"
			}
		];
		/** 档位显示名：off → OFF、max → Ultracode，其余用目录名。 */
		const displayName = (level) => level.id === "off" ? "OFF" : level.id === "max" ? "Ultracode" : level.name;
		/** Load the per-session model directory once per panel open. */
		function useDirectory(connection, sessionId) {
			const [directory, setDirectory] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				setDirectory(null);
				connection.api.sessions.models({ sessionId }).then((response) => {
					const value = response.result.ok ? response.result.value : null;
					console.log("[effort-slider] models:", response.result.ok ? `ok groups=${value?.groups?.length} current=${JSON.stringify(value?.current)}` : `fail ${response.result.error?.code}: ${response.result.error?.message}`);
					if (alive && response.result.ok) setDirectory(response.result.value);
				}).catch((error) => {
					console.warn("[effort-slider] models threw:", error);
				});
				return () => {
					alive = false;
				};
			}, [connection, sessionId]);
			return directory;
		}
		/**
		* The floating effort card.
		* @param props - session + wire face + close verb.
		*/
		function EffortPanel(props) {
			const { sessionId, connection, onClose, onEffortChange } = props;
			const directory = useDirectory(connection, sessionId);
			const [dragging, setDragging] = (0, react.useState)(false);
			const [rawValue, setRawValue] = (0, react.useState)(0);
			const disabled = directory === null;
			const rawCurrent = directory?.current ?? null;
			const fallback = directory !== null && directory.groups.length > 0 && directory.groups[0].models.length > 0 ? {
				provider: directory.groups[0].id,
				model: directory.groups[0].models[0].id
			} : null;
			const current = rawCurrent ?? fallback;
			const model = (current === null ? void 0 : directory?.groups.find((entry) => entry.id === current.provider))?.models.find((entry) => entry.id === current?.model);
			const declaredEfforts = model?.reasoning?.efforts;
			const efforts = declaredEfforts !== void 0 ? declaredEfforts : UNIVERSAL_EFFORTS;
			const usable = !disabled && current !== null && efforts.length >= 2;
			const currentEffortId = current?.reasoningEffort ?? model?.reasoning?.defaultEffort;
			const rawIndex = currentEffortId === void 0 ? -1 : efforts.findIndex((level) => level.id === currentEffortId);
			const step100 = efforts.length > 1 ? 100 / (efforts.length - 1) : 100;
			const initialRaw = usable && rawIndex >= 0 ? rawIndex * step100 : 0;
			(0, react.useEffect)(() => {
				setRawValue(initialRaw);
				setDragging(false);
				if (usable && currentEffortId !== void 0) onEffortChange?.(currentEffortId);
			}, [directory]);
			const displayIndex = usable ? Math.round(rawValue / step100) : 0;
			const level = efforts[displayIndex];
			const slider100 = usable ? rawValue : 0;
			const slider01 = usable ? .15 + rawValue / 100 * .85 : 0;
			const fireRef = (0, react.useRef)(null);
			useWebglFire(fireRef, () => slider01, () => true);
			const maskP = Math.max(slider100 - 1.5, 0);
			const maskFade = Math.min(slider100 + 1.5, 100);
			const fireStyle = usable ? {
				maskImage: `linear-gradient(to right, black 0%, black ${maskP}%, transparent ${maskFade}%)`,
				WebkitMaskImage: `linear-gradient(to right, black 0%, black ${maskP}%, transparent ${maskFade}%)`,
				opacity: 1
			} : { opacity: 0 };
			const pointLightStyle = {
				left: `${22 + slider100 / 100 * 236}px`,
				top: "76px"
			};
			/** 写入当前档位到会话（供拖动中节流调用）。 */
			const writeEffort = (v) => {
				if (!usable || current === null) return;
				const idx = Math.round(v / step100);
				const effort = efforts[idx];
				if (effort === void 0) return;
				onEffortChange?.(effort.id);
				connection.api.sessions.selectModel({
					sessionId,
					provider: current.provider,
					model: current.model,
					reasoningEffort: effort.id
				}).catch(() => {});
			};
			const lastWriteRef = (0, react.useRef)(0);
			const onInput = (event) => {
				if (!usable) return;
				const v = Number(event.target.value);
				setRawValue(v);
				const now = performance.now();
				if (now - lastWriteRef.current >= 16) {
					lastWriteRef.current = now;
					writeEffort(v);
				}
			};
			/** 松手/失焦/键盘结束时吸附到最近档位并补发一次确认。 */
			const commit = (event) => {
				if (!usable) return;
				const v = Number(event.target.value);
				const idx = Math.round(v / step100);
				setRawValue(idx * step100);
				setDragging(false);
				writeEffort(v);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: effort_module_css_default.panel,
				"data-effort-panel": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: effort_module_css_default.glow }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: effort_module_css_default.inner,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: effort_module_css_default.head,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: effort_module_css_default.headLeft,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: effort_module_css_default.labelText,
									children: "Effort"
								}), usable && level !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${effort_module_css_default.status} ${effort_module_css_default[`level${displayIndex}`] ?? ""} ${displayIndex === efforts.length - 1 ? effort_module_css_default.statusGlow : ""}`,
									children: displayName(level)
								}, level.name) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: effort_module_css_default.status,
									children: "—"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: effort_module_css_default.close,
								onClick: onClose,
								"aria-label": "关闭",
								children: "×"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: effort_module_css_default.levelLabels,
							children: efforts.map((entry, labelIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${effort_module_css_default.levelLabel}${labelIndex === displayIndex ? ` ${effort_module_css_default.levelLabelActive}` : ""}`,
								style: { left: `${10 + labelIndex / Math.max(efforts.length - 1, 1) * 80}%` },
								children: labelIndex === 0 ? "OFF" : labelIndex === efforts.length - 1 ? "MAX" : displayName(entry)
							}, entry.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: effort_module_css_default.trackWrapper,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: effort_module_css_default.trackBg }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: effort_module_css_default.dotsLayer,
									children: efforts.map((_, dotIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `${effort_module_css_default.dot}${dotIndex === displayIndex ? ` ${effort_module_css_default.dotActive}` : ""}`,
										style: { left: `${10 + dotIndex / Math.max(efforts.length - 1, 1) * 80}%` }
									}, dotIndex))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("canvas", {
									ref: fireRef,
									className: effort_module_css_default.fire,
									style: fireStyle
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: `${effort_module_css_default.pointLight}${dragging ? ` ${effort_module_css_default.pointLightOn}` : ""}`,
									style: pointLightStyle
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "range",
									min: 0,
									max: 100,
									step: 1,
									value: usable ? rawValue : 0,
									disabled: !usable,
									className: `${effort_module_css_default.range}${dragging ? ` ${effort_module_css_default.rangeGlow}` : ""}`,
									onInput,
									onPointerDown: () => setDragging(true),
									onPointerUp: commit,
									onPointerLeave: () => setDragging(false),
									onBlur: commit
								})
							]
						}),
						!usable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: effort_module_css_default.emptyOverlay,
							children: disabled ? "模型目录加载中…" : "当前模型不支持思考强度调节"
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/effort/effortColors.ts
		const EFFORT_COLORS = {
			off: { color: "#c882a0" },
			low: { color: "#c8aa82" },
			medium: { color: "#82aac8" },
			high: {
				color: "#c084fc",
				glow: "0 0 10px #a855f7b3"
			},
			max: {
				color: "#d8b4fe",
				glow: "0 0 12px #a855f7"
			}
		};
		/** 常见第三方档位别名 → 高阶色。 */
		const ALIASES = {
			ultra: "max",
			xhigh: "max",
			maximum: "max"
		};
		/** 未知档位：高亮紫（表示档位由本插件控制）。 */
		const UNKNOWN = { color: "#c084fc" };
		/** 解析档位颜色：id（或别名）→ 色值；未知档位返回高亮紫。 */
		const effortColorFor = (effortId) => EFFORT_COLORS[ALIASES[effortId] ?? effortId] ?? UNKNOWN;
		/** 档位显示名 → 颜色推断（面板尚未上报档位 id 时，从官方菜单行的档位文本反查）。 */
		const LABEL_ALIASES = {
			off: "off",
			low: "low",
			medium: "medium",
			med: "medium",
			high: "high",
			max: "max",
			ultra: "max",
			xhigh: "max",
			ultracode: "max",
			maximum: "max"
		};
		/** 由显示名推断档位颜色；无法识别时返回 null（保持官方原色）。 */
		const effortColorFromLabel = (label) => {
			const key = label.trim().toLowerCase();
			const id = LABEL_ALIASES[key];
			if (id === void 0) return null;
			return EFFORT_COLORS[id];
		};
		//#endregion
		//#region src/client/index.ts
		/** 需要的客户端服务：connection（模型目录读写）、sessions（当前会话）。 */
		const inject = ["connection", "sessions"];
		/** 面板尺寸（与 effort.module.css 的 .panel 宽度一致）。 */
		const PANEL_W = 280;
		const PANEL_H = 150;
		/**
		* 最近一次面板设置的档位（面板关闭后仍用于给菜单行着色）。
		* 用对象属性而非模块级 let：某些 bundler 会把「let x = null」+「if (x !== null)」
		* 误判为恒假分支并整体删除；对象属性写入无法静态折叠，不会被误删。
		*/
		const uiState = { lastEffortId: null };
		/** 官方菜单行的 label 文本（中/英两套语言包）。 */
		const EFFORT_LABEL_TEXTS = /* @__PURE__ */ new Set(["推理等级", "Effort"]);
		/**
		* 官方菜单行的档位值 span：行内除了 label 与 chevron svg 外，
		* 剩下的文本 span 就是当前档位值（label 的相邻 span 优先）。
		*/
		function effortValueSpan(row) {
			const spans = Array.from(row.querySelectorAll("span"));
			const labelIndex = spans.findIndex((span) => EFFORT_LABEL_TEXTS.has((span.textContent ?? "").trim()));
			if (labelIndex >= 0) {
				const next = spans[labelIndex + 1];
				if (next !== void 0 && !EFFORT_LABEL_TEXTS.has((next.textContent ?? "").trim())) return next;
			}
			for (const span of spans) {
				const text = (span.textContent ?? "").trim();
				if (text.length > 0 && !EFFORT_LABEL_TEXTS.has(text)) return span;
			}
			return null;
		}
		/** 给菜单行档位值着色（inline style，官方样式不会覆盖）。 */
		function paintEffortRow(row, effortId) {
			const value = effortValueSpan(row);
			if (value === null) return;
			const tone = effortColorFor(effortId);
			value.style.color = tone.color;
			value.style.textShadow = tone.glow ?? "none";
			console.log("[effort-slider] paint:", JSON.stringify((value.textContent ?? "").trim()), "→", tone.color, row.isConnected ? "" : "(detached)");
		}
		/**
		* 全量扫描文档里的「推理等级」菜单行并涂色。
		* 不依赖任何单节点引用或 mutation 粒度：官方重开菜单（整树原子挂载）、
		* 复用节点改文本、字符数据原地更新，都会在下一次扫描时被覆盖。
		*/
		function paintAllEffortRows() {
			for (const row of Array.from(document.querySelectorAll("button[role=\"menuitem\"]"))) {
				const text = (row.textContent ?? "").trim();
				if (!(text.startsWith("推理等级") || text.startsWith("Effort"))) continue;
				const value = effortValueSpan(row);
				if (uiState.lastEffortId !== null) paintEffortRow(row, uiState.lastEffortId);
				else if (value !== null) {
					const inferred = effortColorFromLabel((value.textContent ?? "").trim());
					if (inferred !== null) {
						value.style.color = inferred.color;
						value.style.textShadow = inferred.glow ?? "none";
					}
				}
			}
			paintTriggerEffort();
		}
		/**
		* 模型菜单的入口触发按钮（输入框上方的模型座位，aria-haspopup="menu"）：
		* 官方在第一个 span 显示模型名、第二个 span 显示当前档位名。
		* 这里给档位名涂上与菜单行一致的颜色（菜单关闭后触发按钮常驻可见）。
		*/
		function paintTriggerEffort() {
			for (const trigger of Array.from(document.querySelectorAll("button[aria-haspopup=\"menu\"]"))) {
				const aria = trigger.getAttribute("aria-label") ?? "";
				if (!(aria.includes("推理等级") || aria.includes("reasoning effort"))) continue;
				const value = Array.from(trigger.querySelectorAll("span"))[1];
				if (value === void 0) continue;
				if (uiState.lastEffortId !== null) {
					const tone = effortColorFor(uiState.lastEffortId);
					value.style.color = tone.color;
					value.style.textShadow = tone.glow ?? "none";
					continue;
				}
				const inferred = effortColorFromLabel((value.textContent ?? "").trim());
				if (inferred !== null) {
					value.style.color = inferred.color;
					value.style.textShadow = inferred.glow ?? "none";
				}
			}
		}
		/** rAF 节流：observer 高频触发时合并为一次扫描。 */
		let paintQueued = false;
		const schedulePaintAll = () => {
			if (paintQueued) return;
			paintQueued = true;
			const run = () => {
				paintQueued = false;
				paintAllEffortRows();
			};
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
			else setTimeout(run, 16);
		};
		/**
		* 应用 Effort 滑块：挂载固定锚点容器 + 捕获阶段拦截模型菜单「推理等级」行。
		* @param ctx - 宿主上下文（effect 生命周期负责回收）。
		*/
		function apply(ctx) {
			const body = document.body;
			const host = document.createElement("div");
			host.dataset.effortSliderHost = "";
			host.style.cssText = "position: fixed; z-index: 10000; top: 0; left: 0; width: 0; height: 0; pointer-events: none;";
			body.appendChild(host);
			let root = null;
			const hidePanel = () => {
				root?.unmount();
				root = null;
				schedulePaintAll();
			};
			const showPanel = (sessionId, anchor) => {
				const rect = anchor.getBoundingClientRect();
				const left = Math.max(8, Math.min(rect.right - PANEL_W, window.innerWidth - PANEL_W - 8));
				const top = window.innerHeight - rect.bottom >= 166 ? rect.bottom + 8 : Math.max(8, rect.top - PANEL_H - 8);
				host.style.left = `${left}px`;
				host.style.top = `${top}px`;
				if (root === null) root = (0, react_dom_client.createRoot)(host);
				root.render((0, react.createElement)(EffortPanel, {
					sessionId,
					connection: ctx.get("connection"),
					onClose: hidePanel,
					onEffortChange
				}));
			};
			/** 面板档位变化：记住当前档位，并给仍开着的菜单行即时涂色。 */
			const onEffortChange = (effortId) => {
				uiState.lastEffortId = effortId;
				paintAllEffortRows();
			};
			const paintObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => schedulePaintAll());
			if (paintObserver !== null) paintObserver.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true
			});
			const onDocClick = (event) => {
				const target = event.target;
				if (host.contains(target)) return;
				const row = target.closest?.("button[role=\"menuitem\"]");
				if (row instanceof HTMLElement) {
					const text = (row.textContent ?? "").trim();
					if (text.startsWith("推理等级") || text.startsWith("Effort")) {
						console.log("[effort-slider] intercept row:", JSON.stringify(text));
						event.preventDefault();
						event.stopPropagation();
						paintAllEffortRows();
						const current = ctx.get("sessions").list.getSnapshot().current;
						console.log("[effort-slider] session:", current);
						if (current !== void 0) showPanel(current, row);
						else console.warn("[effort-slider] no session id");
						return;
					}
				}
				if (!host.contains(target)) hidePanel();
			};
			document.addEventListener("click", onDocClick, true);
			ctx.effect(() => () => {
				document.removeEventListener("click", onDocClick, true);
				paintObserver?.disconnect();
				uiState.lastEffortId = null;
				hidePanel();
				host.remove();
			}, "ui-effort-slider: effort panel");
		}
		//#endregion
		exports.apply = apply;
		exports.effortColorFor = effortColorFor;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map