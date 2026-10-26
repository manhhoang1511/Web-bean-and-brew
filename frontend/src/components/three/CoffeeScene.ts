/**
 * Cảnh 3D trang chủ (lấy cảm hứng Dogstudio): tách cà phê sứ + hạt cà phê bay + khói + bụi sáng.
 * Toàn bộ hình khối dựng bằng code (không cần file .glb):
 *  - Tách & đĩa: LatheGeometry (xoay 1 đường biên dạng quanh trục, giống tiện gốm)
 *  - Hạt cà phê: hình elip + khắc rãnh chữ S bằng cách dịch đỉnh (vertex) -> InstancedMesh ~28 hạt,
 *    rải có kiểm soát: tránh vùng chữ và khoảng trước tách; sương mù (fog) làm hạt xa chìm vào nền
 *  - Mặt latte: vẽ bằng Canvas 2D rồi làm texture
 *  - Khói: dải mặt phẳng + nhiễu fbm trong fragment shader (mềm như khói thật, không phải chấm)
 *  - Bụi sáng: Points + ShaderMaterial chạy trên GPU
 * Tiến độ cuộn (0..1) điều khiển camera, vị trí tách và quỹ đạo hạt theo 3 "chương".
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function latteTexture() {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(s / 2, s / 2, 20, s / 2, s / 2, s / 2)
  grad.addColorStop(0, '#c08550')
  grad.addColorStop(0.7, '#8a5530')
  grad.addColorStop(1, '#4a2a16')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  // Latte art hình trái tim: lớp bọt sữa trắng + viền nâu bên trong + vệt kéo xuyên tim (như rót thật)
  const heart = (cx: number, cy: number, w: number) => {
    g.beginPath()
    g.moveTo(cx, cy + w * 0.95)
    g.bezierCurveTo(cx - w * 1.25, cy + w * 0.1, cx - w * 0.9, cy - w * 0.95, cx, cy - w * 0.35)
    g.bezierCurveTo(cx + w * 0.9, cy - w * 0.95, cx + w * 1.25, cy + w * 0.1, cx, cy + w * 0.95)
    g.fill()
  }
  g.shadowColor = 'rgba(250,240,225,0.5)'
  g.shadowBlur = 24
  g.fillStyle = 'rgba(250,242,228,0.97)'
  heart(s / 2, s / 2 + 6, 150)
  g.shadowBlur = 10
  g.fillStyle = 'rgba(176,112,64,0.55)'
  heart(s / 2, s / 2 + 2, 96)
  g.fillStyle = 'rgba(250,242,228,0.95)'
  heart(s / 2, s / 2 - 2, 62)
  g.lineWidth = 7
  g.lineCap = 'round'
  g.strokeStyle = 'rgba(250,242,228,0.9)'
  g.beginPath()
  g.moveTo(s / 2, 120)
  g.quadraticCurveTo(s / 2 + 6, s / 2, s / 2, 420)
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function beanGeometry() {
  const geo = new THREE.SphereGeometry(1, 40, 32)
  const p = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    v.x *= 0.62
    v.y *= 0.42
    v.z *= 0.9
    if (v.y > 0) {
      // Rãnh chữ S chạy dọc mặt trên của hạt
      const curve = 0.1 * Math.sin(v.z * 2.6)
      const d = v.x - curve
      const groove = 0.17 * Math.exp(-(d * d) / 0.006) * smooth(0.95, 0.55, Math.abs(v.z))
      v.y -= groove * (v.y / 0.42 + 0.35)
    }
    p.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }`
const STEAM_VERT = /* glsl */ `
  uniform float uTime; varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    vUv = uv;
    vec3 pos = position;
    // càng lên cao dải khói càng uốn lượn mạnh
    float sway = noise(vec2(0.5, uv.y * 1.4 - uTime * 0.18)) * 2.0 - 1.0;
    pos.x += sway * 0.32 * uv.y * uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }`
const STEAM_FRAG = /* glsl */ `
  uniform float uTime; uniform float uOpacity; varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    vec2 p = vec2(vUv.x * 2.2, vUv.y * 1.5 - uTime * 0.16);
    float n = fbm(p * 2.4 + fbm(p * 1.3 + uTime * 0.05));
    float smoke = smoothstep(0.42, 0.9, n);
    smoke *= smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);   // mờ 2 mép
    smoke *= smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.35, vUv.y); // tan dần khi bay lên
    gl_FragColor = vec4(1.0, 0.96, 0.9, smoke * uOpacity * 0.6);
  }`
const DUST_VERT = /* glsl */ `
  uniform float uTime; uniform vec2 uMouse; attribute float aSeed; varying float vAlpha;
  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 0.3 + aSeed * 30.0) * 0.25;
    pos.x += cos(uTime * 0.2 + aSeed * 17.0) * 0.25;
    // Hạt gần con trỏ bị đẩy ra (kiểu Active Theory)
    vec2 diff = pos.xy - uMouse * vec2(5.0, 3.0);
    float f = smoothstep(1.6, 0.0, length(diff));
    pos.xy += normalize(diff + 0.0001) * f * 0.9;
    vAlpha = 0.25 + 0.75 * fract(aSeed * 13.7);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (6.0 + aSeed * 10.0) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`
const DUST_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(0.95, 0.72, 0.45, smoothstep(0.5, 0.1, d) * vAlpha * 0.8);
  }`

interface BeanData { base: THREE.Vector3; a: number; h: number; speed: number; axis: THREE.Vector3; spin: number; scale: number; depth: number }

export class CoffeeScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  private cup = new THREE.Group()
  private beans: THREE.InstancedMesh
  private beanData: BeanData[] = []
  private steam: THREE.Mesh
  private dust: THREE.Points
  private clock = new THREE.Clock()
  private raf = 0
  private running = false
  private progress = 0
  private progressTarget = 0
  private pointer = new THREE.Vector2()
  private pointerTarget = new THREE.Vector2()
  private dummy = new THREE.Object3D()
  private tmpA = new THREE.Vector3() // vector tạm dùng lại mỗi khung hình (tránh tạo rác cho GC)
  private tmpB = new THREE.Vector3()
  private mobile = false
  private fog = new THREE.Fog('#120d0a', 7, 14)
  private disposables: { dispose: () => void }[] = []

  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.95
    this.scene.fog = this.fog // hạt ở xa chìm dần vào màu nền -> chiều sâu như ống kính máy ảnh

    // Môi trường phản chiếu cho sứ bóng
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = envTex
    this.disposables.push(envTex, pmrem)

    // Ánh sáng 3 điểm kiểu chụp sản phẩm: đèn chính ấm, đèn viền caramel phía sau, đèn phụ lạnh bên trái
    this.scene.add(new THREE.HemisphereLight('#ffe9d2', '#2a1a10', 0.45))
    const key = new THREE.DirectionalLight('#fff1dc', 2.4)
    key.position.set(-3, 5, 4)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight('#e39a4a', 4.2)
    rim.position.set(3.5, 2.5, -4)
    this.scene.add(rim)
    const back = new THREE.DirectionalLight('#ffe2c4', 0.9)
    back.position.set(-4, 1.5, -3)
    this.scene.add(back)

    this.buildCup()
    this.beans = this.buildBeans()
    this.steam = this.buildSteam()
    this.dust = this.buildDust()
    this.resize()
  }

  private buildCup() {
    const ceramic = new THREE.MeshPhysicalMaterial({
      color: '#efe4d4', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.4, sheenColor: new THREE.Color('#ffd9b0'),
      envMapIntensity: 0.75, side: THREE.DoubleSide,
    })
    const profile = [[0, 0], [0.5, 0], [0.56, 0.04], [0.62, 0.3], [0.72, 0.75], [0.8, 1.08], [0.81, 1.12], [0.77, 1.13],
      [0.75, 1.08], [0.67, 0.75], [0.57, 0.3], [0.5, 0.14], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y))
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), ceramic)

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.06, 24, 64, Math.PI), ceramic)
    handle.rotation.z = -Math.PI / 2
    handle.position.set(0.72, 0.62, 0)
    handle.scale.set(1, 1.15, 1)

    const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.74, 64),
      new THREE.MeshPhysicalMaterial({ map: latteTexture(), roughness: 0.3, clearcoat: 0.6 }))
    liquid.rotation.x = -Math.PI / 2
    liquid.position.y = 0.98

    const saucerProfile = [[0, 0], [1.2, 0.02], [1.34, 0.1], [1.3, 0.13], [0.62, 0.07], [0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y))
    const saucer = new THREE.Mesh(new THREE.LatheGeometry(saucerProfile, 96), ceramic)
    saucer.position.y = -0.07

    // Bóng đổ mềm dưới đĩa (texture gradient tròn) -> tách "đứng" trên mặt phẳng, không lơ lửng
    const sc = document.createElement('canvas')
    sc.width = sc.height = 128
    const sg = sc.getContext('2d')!
    const grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(0,0,0,0.55)')
    grad.addColorStop(0.55, 'rgba(0,0,0,0.25)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    sg.fillStyle = grad
    sg.fillRect(0, 0, 128, 128)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, fog: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.09

    this.cup.add(body, handle, liquid, saucer, shadow)
    this.cup.scale.setScalar(0.9)
    this.scene.add(this.cup)
  }

  private buildBeans() {
    const max = 28
    const mesh = new THREE.InstancedMesh(beanGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05 }), max)
    const tones = ['#3f2314', '#4e2c18', '#5c3520'].map((c) => new THREE.Color(c))
    // Rải hạt có kiểm soát (rejection sampling) quanh tách – tọa độ tính TỪ TÂM TÁCH:
    //  - không nằm trước thân tách (che "nhân vật chính")
    //  - phía chữ (x âm) chỉ cho hạt ở xa phía sau, để chữ luôn thoáng
    //  - các hạt cách nhau đủ xa, không chồng cục
    const placed: THREE.Vector3[] = []
    for (let guard = 0; placed.length < max && guard < 5000; guard++) {
      const v = new THREE.Vector3(-1.8 + Math.random() * 5, -0.9 + Math.random() * 3.8, -3.6 + Math.random() * 5.2)
      if (v.z > -0.9 && Math.abs(v.x) < 1.55 && v.y > -0.5 && v.y < 1.7) continue
      if (v.x < -0.9 && v.z > -1.6) continue
      if (placed.some((q) => q.distanceTo(v) < 0.75)) continue
      placed.push(v)
    }
    placed.forEach((base, i) => {
      const depth = THREE.MathUtils.clamp((base.z + 3.6) / 5.2, 0, 1) // 0 = xa, 1 = gần camera
      this.beanData.push({
        base, a: Math.random() * Math.PI * 2, h: -0.6 + Math.random() * 2.9,
        speed: 0.12 + Math.random() * 0.2, axis: new THREE.Vector3().randomDirection(), spin: 0.2 + Math.random() * 0.6,
        scale: 0.075 + Math.random() * 0.04 + depth * 0.03, depth,
      })
      mesh.setColorAt(i, tones[i % tones.length])
    })
    mesh.count = placed.length
    this.scene.add(mesh)
    return mesh
  }

  private buildSteam() {
    const geo = new THREE.PlaneGeometry(1.1, 2.4, 8, 48)
    geo.translate(0, 1.2, 0) // gốc dải khói ở miệng tách
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    }))
    this.scene.add(mesh) // không gắn vào tách: dải khói luôn quay mặt về camera (billboard)
    return mesh
  }

  private buildDust() {
    const n = 900
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8
      pos[i * 3 + 2] = -1 - Math.random() * 6
      seed[i] = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() } },
    }))
    this.scene.add(pts)
    return pts
  }

  /** p: tiến độ cuộn 0..1 qua 3 chương */
  setProgress(p: number) { this.progressTarget = p }
  /** Màu nền hiện tại (CSS) -> màu sương mù, để hạt ở xa hòa vào đúng nền của chương */
  setBackground(css: string) { this.fog.color.set(css) }
  /** x, y: -1..1 */
  setPointer(x: number, y: number) { this.pointerTarget.set(x, y) }

  resize() {
    const parent = this.canvas.parentElement!
    const w = parent.clientWidth, h = parent.clientHeight
    this.mobile = w < 768
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (!this.running) this.render(0)
  }

  start() {
    if (this.running) return
    this.running = true
    this.clock.getDelta()
    const loop = () => {
      if (!this.running) return
      this.render(Math.min(this.clock.getDelta(), 0.05))
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  private render(dt: number) {
    const t = this.clock.elapsedTime
    // Nội suy theo THỜI GIAN (không theo số khung hình) -> máy nhanh hay chậm đều khớp với vị trí cuộn
    const ease = 1 - Math.exp(-dt * 7)
    this.progress = lerp(this.progress, this.progressTarget, dt ? ease : 1)
    this.pointer.lerp(this.pointerTarget, dt ? 1 - Math.exp(-dt * 4) : 1)
    const p = this.progress
    const c2 = smooth(0.18, 0.5, p) // chương 2: hạt đổ vào tách
    const c3 = smooth(0.58, 0.9, p) // chương 3: camera nhìn xuống latte

    // Camera: chương 1 nhìn chếch xuống (thấy mặt latte) -> chương 2 vòng sang bên -> chương 3 từ trên xuống
    const dist = this.mobile ? 8.6 : 6.4
    const orbit = lerp(0, 0.75, c2) - lerp(0, 0.75, c3)
    const camY = lerp(lerp(2.7, 3.0, c2), 4.1, c3)
    const camR = lerp(dist, dist * 0.62, c3)
    this.camera.position.set(Math.sin(orbit) * camR + this.pointer.x * 0.35, camY - this.pointer.y * 0.25, Math.cos(orbit) * camR)
    this.camera.lookAt(0, lerp(0.55, 0.95, c3), 0)

    // Tách đổi bên mỗi chương (chữ nằm phía còn lại): phải -> trái -> phải
    const side = smooth(0.15, 0.42, p) * (1 - smooth(0.55, 0.82, p)) // 0 = tách bên phải, 1 = bên trái
    // màn hình càng rộng thì đẩy tách ra xa giữa hơn -> chữ lớn không bao giờ đè lên tách
    const halfW = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * dist * this.camera.aspect
    const wide = THREE.MathUtils.clamp((halfW * 0.5) / 1.45, 0.9, 1.6)
    const offsetX = this.mobile ? 0 : lerp(lerp(1.45, -1.35, smooth(0.15, 0.42, p)), 1.25, smooth(0.55, 0.82, p)) * wide
    // Mobile: tách nằm nửa trên màn hình, chữ ở nửa dưới
    this.cup.position.set(offsetX, this.mobile ? 1.15 : 0, 0)
    // Quai tách luôn quay ra phía ngoài (xa chữ), hơi hướng về camera; lắc nhẹ thay vì quay tròn
    const baseRot = lerp(-0.55, Math.PI + 0.55, side) + orbit // + orbit: giữ góc quai so với camera khi camera bay vòng
    const turn = dt ? 1 - Math.exp(-dt * 3) : 1
    this.cup.rotation.y = lerp(this.cup.rotation.y, baseRot + Math.sin(t * 0.35) * 0.3 * (1 - c3), turn)
    this.cup.rotation.x = lerp(this.cup.rotation.x, this.pointer.y * 0.1, 0.1)
    this.cup.rotation.z = lerp(this.cup.rotation.z, -this.pointer.x * 0.06, 0.1)

    const steamU = (this.steam.material as THREE.ShaderMaterial).uniforms
    steamU.uTime.value = t
    steamU.uOpacity.value = 1 - c2 * 0.5 + c3 * 0.3
    this.steam.position.set(this.cup.position.x, this.cup.position.y + 0.95, 0)
    this.steam.rotation.y = Math.atan2(this.camera.position.x - this.steam.position.x, this.camera.position.z)

    const dustU = (this.dust.material as THREE.ShaderMaterial).uniforms
    dustU.uTime.value = t
    ;(dustU.uMouse.value as THREE.Vector2).copy(this.pointer)
    this.dust.rotation.y = this.pointer.x * 0.08

    // Hạt cà phê: lơ lửng quanh tách -> chương 2 xoáy vào miệng tách -> chương 3 tản rộng ra
    const cx = this.cup.position.x, cy = this.cup.position.y
    const k = c2 * (1 - c3)        // mức "đổ vào tách"
    const scatter = 1 + c3 * 0.6
    const mirror = this.mobile ? 0.5 : lerp(1, -1, side) // tách sang trái -> lật đám hạt sang trái (vẫn tránh chữ)
    const floatPos = this.tmpA, pourPos = this.tmpB
    this.beanData.forEach((b, i) => {
      // lơ lửng: nhấp nhô + trôi nhẹ; hạt gần camera lệch theo chuột nhiều hơn (parallax)
      const par = 0.15 + b.depth * 0.5
      floatPos.set(
        b.base.x * mirror * scatter + Math.cos(t * 0.3 + i) * 0.06 + this.pointer.x * par * 0.35,
        (this.mobile ? Math.max(b.base.y, -0.2) : b.base.y) + Math.sin(t * 0.55 + i * 1.7) * 0.1 - this.pointer.y * par * 0.2,
        b.base.z * scatter,
      )
      const a = b.a + t * b.speed
      const fall = ((b.h + 0.8) / 3.2 + t * b.speed * 0.9) % 1 // 0..1: vị trí trên vòng xoáy rơi
      const swirl = a * 2.4
      const rr = lerp(0.95, 0.12, fall)
      pourPos.set(Math.cos(swirl) * rr, lerp(3.2, 1.0, fall), Math.sin(swirl) * rr)
      this.dummy.position.copy(floatPos).lerp(pourPos, k)
      this.dummy.position.x += cx
      this.dummy.position.y += cy
      this.dummy.quaternion.setFromAxisAngle(b.axis, t * b.spin + i)
      // hạt "chìm" vào tách ở cuối vòng rơi
      const sink = k > 0 && fall > 0.9 ? 1 - ((fall - 0.9) / 0.1) * k : 1
      this.dummy.scale.setScalar(b.scale * sink)
      this.dummy.updateMatrix()
      this.beans.setMatrixAt(i, this.dummy.matrix)
    })
    this.beans.instanceMatrix.needsUpdate = true

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.stop()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      ;(Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
        Object.values(x).forEach((v) => (v instanceof THREE.Texture ? v.dispose() : null))
        x.dispose()
      })
    })
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }
}
