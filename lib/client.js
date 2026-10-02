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
		* @param getActive - whether the fire should burn (slider usable — the track
		*   is hidden otherwise, so the loop sleeps after MAX_IDLE idle frames and is
		*   re-ignited by the per-render kick once it becomes usable again).
		*/
		function useWebglFire(canvasRef, getSlider, getActive) {
			const sliderRef = (0, react.useRef)(0);
			const activeRef = (0, react.useRef)(false);
			sliderRef.current = getSlider();
			activeRef.current = getActive();
			const ensureLoopRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const canvasElement = canvasRef.current;
				if (canvasElement === null) {
					console.warn("[effort-slider] fire: canvas not found");
					return;
				}
				const glContext = canvasElement.getContext("webgl2", {
					preserveDrawingBuffer: false,
					antialias: false
				});
				if (glContext === null) {
					console.warn("[effort-slider] fire: webgl2 context unavailable (browser GPU/hardware acceleration off?)");
					return;
				}
				const gl = glContext;
				const canvas = canvasElement;
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
				const U = {
					simTime: null,
					simSlider: null,
					simElapsed: null,
					simBack: null,
					blurDir: null,
					blurExt: null,
					blurTex: null,
					blurRes: null,
					compScene: null,
					compGlow: null
				};
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
					resizeObserver = new ResizeObserver(() => {
						window.clearTimeout(resizeDebounce);
						resizeDebounce = window.setTimeout(resize, 80);
					});
					resizeObserver.observe(canvas);
					resize();
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
		//#region src/client/effort/directory.ts
		/**
		* 解析当前主视图会话 id。0.1.x 直接读 `list.current`；0.2.0 该字段移除
		* （「导航归视图所有」），官方 uiSession 以 `retainedBy.mainView > 0`
		* 判定当前会话，这里跟随同一判定，并保留旧字段兜底。
		*/
		function currentSessionId(sessions) {
			let snapshot;
			try {
				snapshot = sessions.list.getSnapshot();
			} catch {
				return;
			}
			const direct = snapshot.current;
			if (typeof direct === "string" && direct.length > 0) return direct;
			for (const [key, row] of Object.entries(snapshot.byId ?? {})) if ((row?.retainedBy?.mainView ?? 0) > 0) return typeof row?.id === "string" && row.id.length > 0 ? row.id : key;
		}
		/** 安全读取目录快照：目录可能尚未装配完整。 */
		function snapshotOf(directory) {
			try {
				return directory.store.getSnapshot() ?? null;
			} catch {
				return null;
			}
		}
		//#endregion
		//#region \0dsh-effort-css:D:\PersonalFile\TXC\Project\dsh-effort-slider\src\client\effort\effort.module.css.mjs
		const css = ".sASq9G_panel{user-select:none;z-index:10;pointer-events:auto;width:var(--effort-panel-w,280px);position:absolute;top:0;left:0}.sASq9G_glow{opacity:.6;filter:blur(8px);z-index:0;pointer-events:none;background:linear-gradient(135deg,#a855f74d,#3b82f626,#a855f733);border-radius:18px;position:absolute;inset:-3px}.sASq9G_inner{z-index:1;background:linear-gradient(160deg,#0e0a16 0%,#140e20 50%,#0c0818 100%);border:1px solid #a855f71f;border-radius:13px;padding:14px 16px 12px;position:relative;box-shadow:0 8px 32px #00000080,inset 0 1px #ffffff0a}.sASq9G_head{justify-content:space-between;align-items:center;margin-bottom:2px;display:flex}.sASq9G_headLeft{align-items:center;gap:7px;font-size:14px;font-weight:500;display:inline-flex;overflow:hidden}.sASq9G_labelText{color:#8880a0;letter-spacing:.03em;font-weight:600}.sASq9G_status{color:#aaa0c0;text-transform:uppercase;will-change:transform, opacity, filter;vertical-align:middle;font-family:Georgia,Palatino Linotype,serif;font-style:italic;font-weight:700;transition:color .4s cubic-bezier(.25,.46,.45,.94),text-shadow .4s cubic-bezier(.25,.46,.45,.94);display:inline-block}.sASq9G_statusGlow{color:#c084fc;text-shadow:0 0 14px #a855f7b3}.sASq9G_statusError{color:#f87171}.sASq9G_level0{color:#c882a0bf}.sASq9G_level1{color:#c8aa82bf}.sASq9G_level2{color:#82aac8bf}.sASq9G_level3{color:#c084fcf2;text-shadow:0 0 10px #a855f7b3}.sASq9G_level4{color:#d8b4fe;text-shadow:0 0 12px #a855f7}.sASq9G_close{color:#8880a0;cursor:pointer;background:#a855f714;border:1px solid #a855f72e;border-radius:7px;justify-content:center;align-items:center;width:24px;height:24px;font-size:13px;line-height:1;display:inline-flex}.sASq9G_close:hover{color:#e8e0f0;background:#a855f729;border-color:#a855f766}.sASq9G_headActions{align-items:center;gap:6px;display:inline-flex}.sASq9G_help{color:#8880a0;cursor:pointer;background:#a855f714;border:1px solid #a855f72e;border-radius:50%;justify-content:center;align-items:center;width:24px;height:24px;padding:0;font-size:12px;font-weight:700;line-height:1;display:inline-flex}.sASq9G_help:hover,.sASq9G_helpExpanded{color:#e8e0f0;background:#a855f729;border-color:#a855f766}.sASq9G_helpHint{color:#aaa0c0;letter-spacing:.01em;z-index:3;background:#0c0818;border:1px solid #a855f72e;border-radius:8px;padding:8px 10px;font-size:11px;font-weight:500;line-height:1.7;position:absolute;top:40px;left:12px;right:12px;box-shadow:0 6px 18px #00000080}.sASq9G_levelLabels{height:15px;margin-bottom:4px;position:relative}.sASq9G_levelLabel{color:#6a6080;letter-spacing:.04em;text-transform:uppercase;font-size:10px;font-weight:700;transition:color .15s;position:absolute;top:0;transform:translate(-50%)}.sASq9G_levelLabelActive{color:#c084fc}.sASq9G_trackWrapper{isolation:isolate;background:#08050e;border:1px solid #a855f714;border-radius:8px;height:32px;position:relative;overflow:hidden}.sASq9G_trackBg{z-index:0;background:linear-gradient(135deg,#0c0518,#06030c);position:absolute;inset:0}.sASq9G_dotsLayer{pointer-events:none;z-index:1;position:absolute;inset:0}.sASq9G_dot{background:#a855f740;border-radius:50%;width:4px;height:4px;transition:background .15s,box-shadow .15s;position:absolute;top:50%;transform:translate(-50%,-50%)}.sASq9G_dotActive{background:#c084fc;box-shadow:0 0 8px #a855f7e6}.sASq9G_fire{pointer-events:none;mix-blend-mode:screen;z-index:2;width:100%;height:100%;position:absolute;inset:0}.sASq9G_range{-webkit-appearance:none;appearance:none;cursor:pointer;z-index:5;background:0 0;outline:none;width:100%;height:100%;margin:0;padding:0;position:absolute;inset:0}.sASq9G_range::-webkit-slider-thumb{-webkit-appearance:none;cursor:grab;width:var(--effort-thumb-w,28px);height:var(--effort-thumb-w,28px);background:linear-gradient(145deg,#e8e0f0 0%,#c8b8e0 50%,#b8a8d8 100%);border:none;border-radius:8px;transition:box-shadow .5s cubic-bezier(.25,.46,.45,.94),transform .35s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px #0006,0 0 0 1px #a855f726,inset 0 1px #ffffff80}.sASq9G_range::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(.92);box-shadow:0 1px 4px #00000080,0 0 0 1px #a855f740}.sASq9G_rangeGlow::-webkit-slider-thumb{box-shadow:0 2px 8px #0006,0 0 0 1px #a855f74d,0 0 20px #a855f759,0 0 40px #a855f726,inset 0 1px #ffffff80}.sASq9G_rangeGlow::-webkit-slider-thumb:active{box-shadow:0 1px 4px #00000080,0 0 0 1px #a855f766,0 0 24px #a855f766,0 0 48px #a855f733}.sASq9G_range::-moz-range-thumb{cursor:grab;width:var(--effort-thumb-w,28px);height:var(--effort-thumb-w,28px);background:linear-gradient(145deg,#e8e0f0 0%,#c8b8e0 50%,#b8a8d8 100%);border:none;border-radius:7px;box-shadow:0 2px 8px #0006,0 0 0 1px #a855f726}.sASq9G_range::-moz-range-thumb:active{cursor:grabbing;transform:scale(.95)}.sASq9G_range::-moz-range-track{background:0 0;border:none;height:32px}.sASq9G_pointLight{pointer-events:none;z-index:3;opacity:0;background:radial-gradient(circle,#a855f733 0%,#a855f70f 30%,#a855f704 55%,#0000 70%);border-radius:50%;width:150px;height:150px;transition:opacity .25s cubic-bezier(.25,.46,.45,.94);position:absolute;transform:translate(-50%,-50%)}.sASq9G_pointLightOn{opacity:1}.sASq9G_emptyOverlay{color:#6a6080;letter-spacing:.02em;text-align:center;padding:10px 0 2px;font-size:13px;font-weight:600}.sASq9G_overlayHint{color:#6a6080;letter-spacing:.01em;margin-top:7px;font-size:11px;font-weight:500;line-height:1.6}.sASq9G_retry{color:#c8b8e0;cursor:pointer;letter-spacing:.02em;background:#a855f714;border:1px solid #a855f72e;border-radius:7px;margin-top:7px;padding:2px 14px;font-family:inherit;font-size:12px;font-weight:600}.sASq9G_retry:hover{color:#e8e0f0;background:#a855f729;border-color:#a855f766}.sASq9G_statusEnterActive{transition:all .4s cubic-bezier(.25,.46,.45,.94)}.sASq9G_statusEnterFrom{opacity:0;filter:blur(10px);transform:translateY(8px)}";
		const tagId = "dsh-effort-slider/effort.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-effort-slider";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var effort_module_css_default = {
			"close": "sASq9G_close",
			"dot": "sASq9G_dot",
			"dotActive": "sASq9G_dotActive",
			"dotsLayer": "sASq9G_dotsLayer",
			"emptyOverlay": "sASq9G_emptyOverlay",
			"fire": "sASq9G_fire",
			"glow": "sASq9G_glow",
			"head": "sASq9G_head",
			"headActions": "sASq9G_headActions",
			"headLeft": "sASq9G_headLeft",
			"help": "sASq9G_help",
			"helpExpanded": "sASq9G_helpExpanded",
			"helpHint": "sASq9G_helpHint",
			"inner": "sASq9G_inner",
			"labelText": "sASq9G_labelText",
			"level0": "sASq9G_level0",
			"level1": "sASq9G_level1",
			"level2": "sASq9G_level2",
			"level3": "sASq9G_level3",
			"level4": "sASq9G_level4",
			"levelLabel": "sASq9G_levelLabel",
			"levelLabelActive": "sASq9G_levelLabelActive",
			"levelLabels": "sASq9G_levelLabels",
			"overlayHint": "sASq9G_overlayHint",
			"panel": "sASq9G_panel",
			"pointLight": "sASq9G_pointLight",
			"pointLightOn": "sASq9G_pointLightOn",
			"range": "sASq9G_range",
			"rangeGlow": "sASq9G_rangeGlow",
			"retry": "sASq9G_retry",
			"status": "sASq9G_status",
			"statusEnterActive": "sASq9G_statusEnterActive",
			"statusEnterFrom": "sASq9G_statusEnterFrom",
			"statusError": "sASq9G_statusError",
			"statusGlow": "sASq9G_statusGlow",
			"trackBg": "sASq9G_trackBg",
			"trackWrapper": "sASq9G_trackWrapper"
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
		/** 写入失败态在 header 状态文字上的停留时长（之后自动恢复常规档位文字）。 */
		const WRITE_ERROR_VISIBLE_MS = 2e3;
		/**
		* 面板用户可见文案（最小双语文案表）。菜单行识别对中英文都兼容，但面板自己的
		* 提示必须二选一渲染：按 DSH 界面语言（<html lang>，退回 navigator）取一套，
		* 不引入 i18n 框架——对插件体量是过度设计。
		*/
		const STRINGS = {
			zh: {
				close: "关闭",
				writeFailed: "写入失败",
				loadFailed: "模型目录加载失败",
				retry: "重试",
				loading: "模型目录加载中…",
				unsupported: "当前模型不支持思考强度调节",
				unsupportedHint: "若为自定义模型：请检查插件的 enabled 与方言配置；开启 debugReport 可在宿主日志查看供给明细",
				slider: "思考强度",
				help: "排查帮助",
				helpHint: "拖动了但模型思考行为没变？可能是线方言没配对：在插件设置检查 {route} 或 defaultDialect（对照 README 方言表）；开启 debugReport 可在宿主日志核对插件写入了什么、请求携带了哪档。"
			},
			en: {
				close: "Close",
				writeFailed: "Write failed",
				loadFailed: "Failed to load model directory",
				retry: "Retry",
				loading: "Loading model directory…",
				unsupported: "This model doesn’t support effort adjustment",
				unsupportedHint: "For a custom model, check the plugin’s enabled & dialect config; enable debugReport for a provisioning report in the host log",
				slider: "Reasoning effort",
				help: "Troubleshooting",
				helpHint: "Dragged but the model’s thinking didn’t change? The wire dialect may be wrong: check {route} or defaultDialect in the plugin settings (see the README dialect table); enable debugReport to verify in the host log what the plugin wrote and which effort requests carry."
			}
		};
		/** 界面语言探测：文档语言优先（DSH 在 <html lang> 带界面语言），退回 navigator。 */
		const isZhUi = () => {
			const lang = (document.documentElement?.lang || navigator.language || "").trim();
			return /^zh([_-]|$)/i.test(lang);
		};
		/**
		* 订阅会话共享目录（与 /model 弹层、模型座位同一份状态）。
		* 打开面板时先读一次快照，再订阅后续变化，并触发一次 load()。
		* load() 被拒时记录到面板本地（宿主 store 未必会把失败上抛到快照里，
		* 必须独立兜底），reload() 重新发起一次 load()。
		* @param directory - 会话的共享目录。
		* @returns 目录快照、面板自身的 load 失败标记与重试入口。
		*/
		function useDirectory(directory) {
			const [state, setState] = (0, react.useState)(() => snapshotOf(directory));
			const [loadFailed, setLoadFailed] = (0, react.useState)(false);
			const [attempt, setAttempt] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let alive = true;
				const read = () => {
					if (alive) setState(snapshotOf(directory));
				};
				read();
				setLoadFailed(false);
				const stop = directory.store.subscribe(read);
				let pending;
				try {
					pending = Promise.resolve(directory.load());
				} catch (error) {
					pending = Promise.reject(error);
				}
				pending.then(read, (error) => {
					console.warn("[effort-slider] directory load failed:", error);
					if (alive) setLoadFailed(true);
				});
				return () => {
					alive = false;
					stop();
				};
			}, [directory, attempt]);
			return {
				state,
				loadFailed,
				reload: (0, react.useCallback)(() => setAttempt((n) => n + 1), [])
			};
		}
		/**
		* The floating effort card.
		* @param props - session + shared directory + close verb.
		*/
		function EffortPanel(props) {
			const { sessionId, directory, onClose, onEffortChange } = props;
			const t = STRINGS[isZhUi() ? "zh" : "en"];
			const { state, loadFailed, reload } = useDirectory(directory);
			const [dragging, setDragging] = (0, react.useState)(false);
			const [helpOpen, setHelpOpen] = (0, react.useState)(false);
			const [writeError, setWriteError] = (0, react.useState)(false);
			const writeSeqRef = (0, react.useRef)(0);
			const writeErrorTimerRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => () => {
				if (writeErrorTimerRef.current !== null) clearTimeout(writeErrorTimerRef.current);
			}, []);
			const [rawValue, setRawValue] = (0, react.useState)(0);
			const rawCurrent = state?.current ?? null;
			const firstGroup = state?.groups[0];
			const fallback = firstGroup?.models[0] === void 0 ? null : {
				provider: firstGroup.id,
				model: firstGroup.models[0].id
			};
			const current = rawCurrent ?? fallback;
			const model = (current === null ? void 0 : state?.groups.find((entry) => entry.id === current.provider))?.models.find((entry) => entry.id === current?.model);
			const declaredEfforts = model?.reasoning?.efforts;
			const efforts = declaredEfforts !== void 0 && declaredEfforts.length > 0 ? declaredEfforts : UNIVERSAL_EFFORTS;
			const usable = state !== null && current !== null && efforts.length >= 2;
			const dirStatus = state?.status;
			const dirErrored = loadFailed || dirStatus === "error";
			const dirLoading = !dirErrored && (state === null || dirStatus === "loading" || dirStatus === "idle" || dirStatus === void 0 && (state?.groups.length ?? 0) === 0);
			const storeError = state?.status === "error" ? state.error ?? "(no message)" : null;
			(0, react.useEffect)(() => {
				if (storeError !== null) console.warn("[effort-slider] directory error:", storeError);
			}, [storeError]);
			const currentEffortId = current?.reasoningEffort ?? model?.reasoning?.defaultEffort;
			const rawIndex = currentEffortId === void 0 ? -1 : efforts.findIndex((level) => level.id === currentEffortId);
			const step100 = efforts.length > 1 ? 100 / (efforts.length - 1) : 100;
			const initialRaw = usable && rawIndex >= 0 ? rawIndex * step100 : 0;
			const writtenEffortRef = (0, react.useRef)(null);
			const syncedEffortRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!usable || currentEffortId === void 0) return;
				onEffortChange?.(currentEffortId);
				if (writtenEffortRef.current === currentEffortId) return;
				writtenEffortRef.current = null;
				if (syncedEffortRef.current === currentEffortId) return;
				syncedEffortRef.current = currentEffortId;
				setRawValue(initialRaw);
			}, [
				state,
				usable,
				currentEffortId,
				initialRaw
			]);
			const displayIndex = usable ? Math.round(rawValue / step100) : 0;
			const level = efforts[displayIndex];
			const slider100 = usable ? rawValue : 0;
			const slider01 = usable ? .15 + rawValue / 100 * .85 : 0;
			const fireRef = (0, react.useRef)(null);
			useWebglFire(fireRef, () => slider01, () => usable);
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
				writtenEffortRef.current = effort.id;
				onEffortChange?.(effort.id);
				const seq = ++writeSeqRef.current;
				setWriteError(false);
				if (writeErrorTimerRef.current !== null) {
					clearTimeout(writeErrorTimerRef.current);
					writeErrorTimerRef.current = null;
				}
				directory.select({
					provider: current.provider,
					model: current.model,
					reasoningEffort: effort.id
				}).catch((error) => {
					console.warn("[effort-slider] selectModel failed:", error);
					if (seq !== writeSeqRef.current) return;
					setWriteError(true);
					writeErrorTimerRef.current = setTimeout(() => {
						writeErrorTimerRef.current = null;
						setWriteError(false);
					}, WRITE_ERROR_VISIBLE_MS);
				});
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
			const panelVars = { "--effort-panel-w": `280px` };
			const trackVars = { "--effort-thumb-w": `28px` };
			const routeRef = current !== null && current.provider.length > 0 ? `routes.${current.provider}` : "routes";
			const helpHintText = t.helpHint.replace("{route}", routeRef);
			/**
			* 刻度点/标签布点：原生 thumb 的行程是「半 thumb 宽 → 容器宽 - 半 thumb 宽」，
			* 两端各缩进 THUMB_W/2——按行程布点才能与滑块的实际吸附位置对齐，
			* 否则首尾档偏差约半个 thumb（P2-5）。
			*/
			const levelPos = (index) => {
				return `calc(14px + ${(index / Math.max(efforts.length - 1, 1)).toFixed(4)} * (100% - 28px))`;
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: effort_module_css_default.panel,
				style: panelVars,
				"data-effort-panel": "true",
				"data-session": sessionId,
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
								}), usable && writeError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${effort_module_css_default.status} ${effort_module_css_default.statusError}`,
									children: t.writeFailed
								}) : usable && level !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${effort_module_css_default.status} ${effort_module_css_default[`level${displayIndex}`] ?? ""} ${displayIndex === efforts.length - 1 ? effort_module_css_default.statusGlow : ""}`,
									children: displayName(level)
								}, level.name) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: effort_module_css_default.status,
									children: "—"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: effort_module_css_default.headActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${effort_module_css_default.help}${helpOpen ? ` ${effort_module_css_default.helpExpanded}` : ""}`,
									onClick: () => setHelpOpen((open) => !open),
									"aria-label": t.help,
									"aria-expanded": helpOpen,
									...helpOpen ? { "aria-controls": "effort-help-hint" } : {},
									children: "?"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: effort_module_css_default.close,
									onClick: onClose,
									"aria-label": t.close,
									children: "×"
								})]
							})]
						}),
						helpOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							id: "effort-help-hint",
							role: "tooltip",
							className: effort_module_css_default.helpHint,
							children: helpHintText
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: effort_module_css_default.levelLabels,
							children: efforts.map((entry, labelIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${effort_module_css_default.levelLabel}${labelIndex === displayIndex ? ` ${effort_module_css_default.levelLabelActive}` : ""}`,
								style: { left: levelPos(labelIndex) },
								children: labelIndex === 0 ? "OFF" : labelIndex === efforts.length - 1 ? "MAX" : displayName(entry)
							}, entry.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: effort_module_css_default.trackWrapper,
							style: trackVars,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: effort_module_css_default.trackBg }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: effort_module_css_default.dotsLayer,
									children: efforts.map((_, dotIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `${effort_module_css_default.dot}${dotIndex === displayIndex ? ` ${effort_module_css_default.dotActive}` : ""}`,
										style: { left: levelPos(dotIndex) }
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
									"aria-label": t.slider,
									"aria-valuetext": usable && level !== void 0 ? displayName(level) : void 0,
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
							children: dirErrored ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t.loadFailed }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: effort_module_css_default.retry,
								onClick: reload,
								children: t.retry
							})] }) : dirLoading ? t.loading : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t.unsupported }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: effort_module_css_default.overlayHint,
								children: t.unsupportedHint
							})] })
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
		/** id 别名 → 规范 id（ultra/xhigh/maximum 都按 max 处理）。 */
		const canonicalEffortId = (effortId) => ALIASES[effortId] ?? effortId;
		/** 档位显示名 → 规范 id；无法识别返回 null。 */
		const effortIdFromLabel = (label) => {
			const key = label.trim().toLowerCase();
			return LABEL_ALIASES[key] ?? null;
		};
		/** 由显示名推断档位颜色；无法识别时返回 null（保持官方原色）。 */
		const effortColorFromLabel = (label) => {
			const id = effortIdFromLabel(label);
			if (id === null) return null;
			return EFFORT_COLORS[id] ?? null;
		};
		//#endregion
		//#region src/client/index.ts
		/** 需要的客户端服务：sessions（当前会话）与 modelDirectories（每会话共享模型目录）。 */
		const inject = ["sessions", "modelDirectories"];
		/**
		* 最近一次面板设置的档位（面板关闭后仍用于给菜单行着色）。
		* 用对象属性而非模块级 let：某些 bundler 会把「let x = null」+「if (x !== null)」
		* 误判为恒假分支并整体删除；对象属性写入无法静态折叠，不会被误删。
		*/
		const uiState = { lastEffortId: null };
		/** 任意一次扫描命中过 Effort 入口（菜单行或触发按钮）。 */
		let effortUiDetected = false;
		/** 「从未识别到入口却发生菜单行点击」的一次性诊断 warn 只发一次。 */
		let unrecognizedMenuWarned = false;
		/**
		* 官方 Effort 入口识别文案（中/英两套语言包）。DSH 新增界面语言或官方改措辞时
		* 在这两张表里追加即可；识别失败不再静默——见 onDocClick 的一次性诊断 warn。
		*/
		const EFFORT_LABELS = ["推理等级", "Effort"];
		const EFFORT_LABEL_TEXTS = new Set(EFFORT_LABELS);
		/** 触发按钮（模型座位）aria-label 里的 Effort 片段（includes 匹配）。 */
		const EFFORT_TRIGGER_ARIA = ["推理等级", "reasoning effort"];
		/** 菜单行按前缀匹配（label 在行文本开头）。 */
		const matchesEffortRowText = (text) => EFFORT_LABELS.some((label) => text.startsWith(label));
		/** 触发按钮 aria-label 按片段匹配。 */
		const matchesEffortTriggerAria = (aria) => EFFORT_TRIGGER_ARIA.some((fragment) => aria.includes(fragment));
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
		}
		/**
		* 面板上报的 lastEffortId 与行内档位文本是否仍然一致。面板用过的档位可能已被
		* 用户从官方入口（/model 弹层）改掉——行内文本才是用户眼前的现实，颜色必须
		* 跟着文本走，否则「行上写着 Low、颜色还停在 High 的紫」两个信号打架。
		*/
		function lastEffortMatchesText(valueText) {
			const last = uiState.lastEffortId;
			if (last === null || valueText.length === 0) return false;
			const textId = effortIdFromLabel(valueText);
			if (textId !== null) return textId === canonicalEffortId(last);
			return last.toLowerCase() === valueText.trim().toLowerCase();
		}
		/**
		* 全量扫描文档里的「推理等级」菜单行并涂色。
		* 不依赖任何单节点引用或 mutation 粒度：官方重开菜单（整树原子挂载）、
		* 复用节点改文本、字符数据原地更新，都会在下一次扫描时被覆盖。
		* 着色依据：行内文本与 lastEffortId 一致时按 lastEffortId；不一致回退文本反推；
		* 文本也认不出（自定义命名）时清除 inline 色、回退官方原色——宁可失去着色，
		* 也不沿用可能过期的颜色。
		*/
		function paintAllEffortRows() {
			for (const row of Array.from(document.querySelectorAll("button[role=\"menuitem\"]"))) {
				const text = (row.textContent ?? "").trim();
				if (!matchesEffortRowText(text)) continue;
				effortUiDetected = true;
				const value = effortValueSpan(row);
				const valueText = (value?.textContent ?? "").trim();
				if (uiState.lastEffortId !== null && lastEffortMatchesText(valueText)) paintEffortRow(row, uiState.lastEffortId);
				else if (value !== null) {
					const inferred = effortColorFromLabel(valueText);
					if (inferred !== null) {
						value.style.color = inferred.color;
						value.style.textShadow = inferred.glow ?? "none";
					} else {
						value.style.color = "";
						value.style.textShadow = "";
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
				if (!matchesEffortTriggerAria(aria)) continue;
				effortUiDetected = true;
				const value = Array.from(trigger.querySelectorAll("span"))[1];
				if (value === void 0) continue;
				const valueText = (value.textContent ?? "").trim();
				if (uiState.lastEffortId !== null && lastEffortMatchesText(valueText)) {
					const tone = effortColorFor(uiState.lastEffortId);
					value.style.color = tone.color;
					value.style.textShadow = tone.glow ?? "none";
					continue;
				}
				const inferred = effortColorFromLabel(valueText);
				if (inferred !== null) {
					value.style.color = inferred.color;
					value.style.textShadow = inferred.glow ?? "none";
				} else {
					value.style.color = "";
					value.style.textShadow = "";
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
			effortUiDetected = false;
			unrecognizedMenuWarned = false;
			const sessions = ctx.get("sessions");
			const directories = ctx.get("modelDirectories");
			if (sessions === void 0 || directories === void 0) {
				console.warn("[effort-slider] sessions/modelDirectories service unavailable — panel disabled");
				return;
			}
			const host = document.createElement("div");
			host.dataset.effortSliderHost = "";
			host.style.cssText = "position: fixed; z-index: 10000; top: 0; left: 0; width: 0; height: 0; pointer-events: none;";
			body.appendChild(host);
			let root = null;
			let anchorRef = null;
			const hidePanel = () => {
				anchorRef = null;
				root?.unmount();
				root = null;
				schedulePaintAll();
			};
			/** 按锚点矩形把面板摆进视口（下方不够时弹到锚点上方）。 */
			const placePanelAt = (rect) => {
				const left = Math.max(8, Math.min(rect.right - 280, window.innerWidth - 280 - 8));
				const top = window.innerHeight - rect.bottom >= 166 ? rect.bottom + 8 : Math.max(8, rect.top - 150 - 8);
				host.style.left = `${left}px`;
				host.style.top = `${top}px`;
			};
			/**
			* scroll/resize 时的跟随重定位。锚点已卸载（官方菜单关闭即卸载行）或被隐藏
			* （getBoundingClientRect 全 0，如 display:none）时「重算」没有意义，
			* 唯一正确行为是直接关面板——这个检查也是跟随逻辑天然要求实现的部分。
			*/
			const repositionPanel = () => {
				const anchor = anchorRef;
				if (anchor === null || root === null) return;
				if (!anchor.isConnected) {
					hidePanel();
					return;
				}
				const rect = anchor.getBoundingClientRect();
				if (rect.top === 0 && rect.left === 0 && rect.width === 0 && rect.height === 0) {
					hidePanel();
					return;
				}
				placePanelAt(rect);
			};
			const showPanel = (sessionId, anchor) => {
				anchorRef = anchor;
				placePanelAt(anchor.getBoundingClientRect());
				if (root === null) root = (0, react_dom_client.createRoot)(host);
				root.render((0, react.createElement)(EffortPanel, {
					sessionId,
					directory: directories.directoryFor(sessionId),
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
				if (target !== null && host.contains(target)) return;
				const row = target?.closest?.("button[role=\"menuitem\"]");
				if (row instanceof HTMLElement) {
					const text = (row.textContent ?? "").trim();
					if (matchesEffortRowText(text)) {
						event.preventDefault();
						event.stopPropagation();
						if (root !== null && anchorRef === row) {
							hidePanel();
							return;
						}
						paintAllEffortRows();
						const current = currentSessionId(sessions);
						if (current !== void 0) showPanel(current, row);
						else console.warn("[effort-slider] no session id");
						return;
					}
					if (!effortUiDetected && !unrecognizedMenuWarned) {
						unrecognizedMenuWarned = true;
						console.warn("[effort-slider] a menu item was clicked but the effort row/trigger has never been recognized — official wording or UI language may have changed and interception/coloring are inactive (known labels: 推理等级 / Effort)");
					}
				}
				hidePanel();
			};
			document.addEventListener("click", onDocClick, true);
			const onKeyDown = (event) => {
				if (event.key === "Escape" && root !== null) hidePanel();
			};
			document.addEventListener("keydown", onKeyDown, true);
			window.addEventListener("scroll", repositionPanel, true);
			window.addEventListener("resize", repositionPanel);
			ctx.effect(() => () => {
				document.removeEventListener("click", onDocClick, true);
				document.removeEventListener("keydown", onKeyDown, true);
				window.removeEventListener("scroll", repositionPanel, true);
				window.removeEventListener("resize", repositionPanel);
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