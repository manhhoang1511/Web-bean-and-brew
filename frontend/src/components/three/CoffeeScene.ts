/**
 * Cảnh 3D trang chủ (lấy cảm hứng Dogstudio): tách cà phê sứ + hạt cà phê + khói + bụi sáng nhiều màu.
 * Toàn bộ hình khối dựng bằng code (không cần file .glb):
 *  - Tách & đĩa: đường biên dạng làm mềm bằng spline rồi xoay quanh trục (LatheGeometry, như tiện gốm);
 *    quai là ống (TubeGeometry) chạy theo đường cong; viền vàng kim ở miệng tách & mép đĩa
 *  - "Studio chụp sản phẩm" ảo: các tấm đèn phát sáng -> PMREM làm môi trường phản chiếu,
 *    nên sứ có vệt sáng dài như ảnh quảng cáo (đây là thứ làm sứ khác nhựa) + bóng đổ thật (shadow map)
 *  - Hạt cà phê: hình elip khắc rãnh chữ S (dịch đỉnh) -> InstancedMesh, lớp phủ bóng như hạt mới rang
 *  - Mặt latte: vẽ bằng Canvas 2D; khói: dải mặt phẳng + nhiễu fbm trong shader; bụi sáng: Points nhiều màu
 * Chuyển động: màn mở đầu (tách bay lên + rót đầy + hạt bung ra), bấm vào tách (xoay + hạt văng),
 * và tiến độ cuộn (0..1) điều khiển camera, vị trí tách, quỹ đạo hạt theo 3 "chương".
 */
import * as THREE from 'three'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)
const easeOutBack = (t: number) => {
  const x = clamp01(t), c = 1.4
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

/** Đường biên dạng (bán kính, độ cao) -> làm mềm bằng spline để mép tách tròn trịa, phản chiếu mượt */
const profile = (pts: number[][], n: number) => new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(n)

const CUP_PROFILE = [
  [0, 0], [0.42, 0], [0.5, 0.02], [0.545, 0.08], [0.58, 0.25], [0.66, 0.55], [0.74, 0.85], [0.8, 1.06], [0.815, 1.11],
  [0.8, 1.137], [0.775, 1.12], [0.765, 1.06], [0.7, 0.8], [0.62, 0.5], [0.55, 0.24], [0.48, 0.15], [0, 0.13],
]
/** Bán kính lòng tách theo độ cao (để mặt cà phê luôn khít thành tách khi "rót" dâng lên) */
const INNER = [[0.15, 0.48], [0.24, 0.55], [0.5, 0.62], [0.8, 0.7], [1.06, 0.765]]
const innerRadius = (y: number) => {
  for (let i = 1; i < INNER.length; i++) {
    if (y <= INNER[i][0]) {
      const [y0, r0] = INNER[i - 1], [y1, r1] = INNER[i]
      return lerp(r0, r1, clamp01((y - y0) / (y1 - y0)))
    }
  }
  return INNER[INNER.length - 1][1]
}
const LIQUID_FULL = 0.98

function latteTexture() {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(s / 2, s / 2, 20, s / 2, s / 2, s / 2)
  grad.addColorStop(0, '#c98f58')
  grad.addColorStop(0.65, '#94592f')
  grad.addColorStop(1, '#4a2a16')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  // Lớp crema lốm đốm như bọt thật
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,226,190' : '90,50,25'},${0.04 + Math.random() * 0.06})`
    g.beginPath()
    g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 0, Math.PI * 2)
    g.fill()
  }
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

/** Bóng đổ mềm dưới đĩa (gradient tròn) – mặt đất vô hình nên dùng texture thay vì shadow map */
function blobShadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.6)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/**
 * "Studio chụp ảnh sản phẩm" ảo: phòng tối + các tấm đèn phát sáng (giá trị màu > 1 = đèn mạnh).
 * PMREM biến cảnh này thành môi trường phản chiếu -> sứ bóng hiện các vệt sáng dài giống ảnh quảng cáo.
 */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene()
  env.background = new THREE.Color(0.02, 0.016, 0.014)
  const geo = new THREE.PlaneGeometry(1, 1)
  const panel = (rgb: [number, number, number], w: number, h: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }))
    m.scale.set(w, h, 1)
    m.position.set(...pos)
    m.lookAt(0, 0, 0)
    env.add(m)
  }
  panel([6, 5.3, 4.5], 5, 3.5, [-4, 5, 4])     // softbox chính, ánh ấm, trên-trái
  panel([5, 2.4, 0.9], 1.1, 7, [6, 1, -3])     // dải đèn viền cam bên phải
  panel([3.2, 1.1, 1.9], 0.9, 6, [-6, 1, -2])  // dải đèn hồng bên trái -> mép sứ ánh hồng
  panel([1.3, 1.2, 1.1], 9, 1.2, [0, -3.5, 5]) // tấm hắt sáng phía dưới
  panel([8, 7.6, 7], 1.2, 1.2, [3, 3.5, 6])    // đèn chấm nhỏ -> điểm sáng lấp lánh
  const pmrem = new THREE.PMREMGenerator(renderer)
  const tex = pmrem.fromScene(env, 0.015).texture
  env.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose())
  geo.dispose()
  pmrem.dispose()
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
  uniform float uTime; uniform vec2 uMouse; attribute float aSeed; varying float vAlpha; varying vec3 vColor; varying float vBokeh;
  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 0.3 + aSeed * 30.0) * 0.25;
    pos.x += cos(uTime * 0.2 + aSeed * 17.0) * 0.25;
    // Hạt gần con trỏ bị đẩy ra (kiểu Active Theory)
    vec2 diff = pos.xy - uMouse * vec2(5.0, 3.0);
    float f = smoothstep(1.6, 0.0, length(diff));
    pos.xy += normalize(diff + 0.0001) * f * 0.9;
    // Bảng màu ấm rực rỡ: vàng kim / cam / hồng đào
    float k = fract(aSeed * 7.31);
    vColor = k < 0.45 ? vec3(1.0, 0.78, 0.42) : k < 0.8 ? vec3(1.0, 0.52, 0.22) : vec3(1.0, 0.45, 0.6);
    vBokeh = step(0.94, fract(aSeed * 3.17)); // ~6% là đốm "bokeh" to, mờ như ống kính mở khẩu
    vAlpha = (0.25 + 0.75 * fract(aSeed * 13.7)) * (0.7 + 0.3 * sin(uTime * 1.5 + aSeed * 40.0)) * (1.0 - vBokeh * 0.65);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (6.0 + aSeed * 10.0 + vBokeh * 70.0) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`
const DUST_FRAG = /* glsl */ `
  varying float vAlpha; varying vec3 vColor; varying float vBokeh;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = mix(smoothstep(0.5, 0.1, d), smoothstep(0.5, 0.42, d) * 0.6 + smoothstep(0.42, 0.0, d) * 0.35, vBokeh);
    gl_FragColor = vec4(vColor, disc * vAlpha * 0.8);
  }`

interface BeanData { base: THREE.Vector3; a: number; h: number; speed: number; axis: THREE.Vector3; spin: number; scale: number; depth: number }

export class CoffeeScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  private cup = new THREE.Group()
  private liquid!: THREE.Mesh
  private beans: THREE.InstancedMesh
  private beanData: BeanData[] = []
  private steam: THREE.Mesh
  private dust: THREE.Points
  private key: THREE.DirectionalLight
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
  private raycaster = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private mobile = false
  private fog = new THREE.Fog('#120d0a', 7, 14)
  private disposables: { dispose: () => void }[] = []
  private rotY = -0.55
  /** Đồng hồ màn mở đầu (giây); 99 = đã xong, playIntro() đặt lại */
  private introT = 99
  private introDelay = 0
  /** Thời điểm bấm vào tách (giây theo đồng hồ cảnh); <0 = không có hiệu ứng */
  private burstAt = -1

  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.scene.fog = this.fog // hạt ở xa chìm dần vào màu nền -> chiều sâu như ống kính máy ảnh

    const envTex = studioEnvironment(this.renderer)
    this.scene.environment = envTex
    this.disposables.push(envTex)

    // Ánh sáng kiểu chụp sản phẩm: đèn chính ấm (đổ bóng) + 2 đèn viền màu cam & hồng tạo mép sáng rực rỡ
    this.scene.add(new THREE.HemisphereLight('#ffe9d2', '#2a1a10', 0.25))
    this.key = new THREE.DirectionalLight('#fff2e0', 2.6)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(1024, 1024)
    this.key.shadow.radius = 5
    this.key.shadow.bias = -0.0004
    this.key.shadow.normalBias = 0.02
    Object.assign(this.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 })
    this.scene.add(this.key, this.key.target)
    const rimWarm = new THREE.DirectionalLight('#ff9a4a', 3.6)
    rimWarm.position.set(4, 3, -4)
    const rimRose = new THREE.DirectionalLight('#ff6f91', 1.3)
    rimRose.position.set(-4.5, 2, -3)
    const fill = new THREE.DirectionalLight('#ffd7b0', 0.35)
    fill.position.set(0, 1, 6)
    this.scene.add(rimWarm, rimRose, fill)

    this.buildCup()
    this.beans = this.buildBeans()
    this.steam = this.buildSteam()
    this.dust = this.buildDust()
    this.resize()
  }

  private buildCup() {
    // Sứ men bóng: nhám thấp + lớp phủ clearcoat + chút "sheen" ấm -> bắt sáng studio, không bị nhựa
    const porcelain = new THREE.MeshPhysicalMaterial({
      color: '#f7f2ea', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, ior: 1.5,
      sheen: 0.25, sheenColor: new THREE.Color('#fff0dd'), sheenRoughness: 0.6, envMapIntensity: 1.15, side: THREE.DoubleSide,
    })
    const gold = new THREE.MeshPhysicalMaterial({ color: '#d9a441', metalness: 1, roughness: 0.22, envMapIntensity: 1.4 })

    const body = new THREE.Mesh(new THREE.LatheGeometry(profile(CUP_PROFILE, 160), 160), porcelain)

    // Quai: ống tròn chạy theo đường cong hình tai, hai đầu cắm vào thành tách
    const handlePath = new THREE.CatmullRomCurve3([
      [0.74, 0.92], [0.95, 0.98], [1.1, 0.8], [1.08, 0.55], [0.9, 0.4], [0.63, 0.38],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0)))
    const handle = new THREE.Mesh(new THREE.TubeGeometry(handlePath, 64, 0.055, 20, false), porcelain)

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.792, 0.014, 16, 160), gold) // viền vàng miệng tách
    rim.rotation.x = Math.PI / 2
    rim.position.y = 1.13

    this.liquid = new THREE.Mesh(new THREE.CircleGeometry(1, 96),
      new THREE.MeshPhysicalMaterial({ map: latteTexture(), roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.6 }))
    this.liquid.rotation.x = -Math.PI / 2
    this.setLiquidLevel(LIQUID_FULL)

    const saucerGroup = new THREE.Group()
    const saucer = new THREE.Mesh(new THREE.LatheGeometry(profile([
      [0, 0], [0.5, 0], [0.55, 0.03], [0.62, 0.06], [1.1, 0.09], [1.28, 0.15], [1.33, 0.17], [1.31, 0.185],
      [1.25, 0.17], [1.08, 0.12], [0.66, 0.095], [0.6, 0.085], [0, 0.085],
    ], 120), 160), porcelain)
    const saucerRim = new THREE.Mesh(new THREE.TorusGeometry(1.318, 0.011, 12, 200), gold)
    saucerRim.rotation.x = Math.PI / 2
    saucerRim.position.y = 0.178
    saucerGroup.add(saucer, saucerRim)
    saucerGroup.position.y = -0.09

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, fog: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.1
    shadow.raycast = () => {} // bóng mờ rộng hơn đĩa: không tính là "bấm trúng tách"

    for (const m of [body, handle, saucer]) { m.castShadow = true; m.receiveShadow = true }
    this.liquid.receiveShadow = true
    this.cup.add(body, handle, rim, this.liquid, saucerGroup, shadow)
    this.cup.scale.setScalar(0.9)
    this.scene.add(this.cup)
  }

  /** Mặt cà phê ở độ cao y (trong hệ tọa độ tách), bán kính khít lòng tách */
  private setLiquidLevel(y: number) {
    const r = innerRadius(y) - 0.005
    this.liquid.position.y = y
    this.liquid.scale.set(r, r, 1)
  }

  private buildBeans() {
    const max = 28
    // Lớp phủ bóng (clearcoat) như dầu trên hạt mới rang
    const mesh = new THREE.InstancedMesh(beanGeometry(),
      new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.3, envMapIntensity: 0.9 }), max)
    mesh.castShadow = true
    const tones = ['#4a2716', '#5b311a', '#6a3a1e', '#3b1f12'].map((c) => new THREE.Color(c))
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
  /** Chạy màn mở đầu sau `delay` giây (chờ màn chào biến mất) */
  playIntro(delay: number) { this.introT = 0; this.introDelay = delay }

  /** Tọa độ chuẩn hóa (-1..1, y hướng lên) có trúng tách/đĩa không */
  hitTest(x: number, y: number) {
    this.raycaster.setFromCamera(this.ndc.set(x, y), this.camera)
    return this.raycaster.intersectObject(this.cup, true).length > 0
  }

  /** Bấm vào tách: tách xoay 1 vòng + nảy nhẹ, hạt văng ra rồi bay về */
  burst() {
    if (this.burstAt >= 0 && this.clock.elapsedTime - this.burstAt < 1.2) return
    this.burstAt = this.clock.elapsedTime
  }

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

    // ---- Màn mở đầu: tách bay lên & xoay, cà phê rót đầy dần, hạt bung ra ----
    this.introT += dt
    const it = this.introT - this.introDelay
    const iRise = easeOutCubic(it / 1.3)
    const iPop = easeOutBack(it / 1.4)
    const iFill = smooth(0.5, 2.1, it)
    const introSpin = (1 - easeOutCubic(it / 1.8)) * -Math.PI * 1.5

    // ---- Bấm vào tách ----
    const bu = this.burstAt >= 0 ? (t - this.burstAt) / 1.5 : 1
    if (bu >= 1) this.burstAt = -1
    const burstSpin = bu < 1 ? easeOutCubic(bu) * Math.PI * 2 : 0
    const burstPush = bu < 1 ? Math.sin(Math.PI * clamp01(bu)) * (1 - bu * 0.3) : 0
    const burstHop = bu < 1 ? Math.sin(Math.PI * clamp01(bu * 2.2)) * 0.18 : 0

    // Camera: chương 1 nhìn chếch xuống (thấy mặt latte) -> chương 2 vòng sang bên -> chương 3 từ trên xuống
    const dist = this.mobile ? 8.6 : 6.4
    const orbit = lerp(0, 0.75, c2) - lerp(0, 0.75, c3)
    // Mobile: tách đặt cao (nửa trên màn hình) nên nâng camera theo để vẫn nhìn được vào lòng tách
    const camY = lerp(lerp(2.7, 3.0, c2), 4.1, c3) + (this.mobile ? 1.6 : 0)
    const camR = lerp(dist, dist * (this.mobile ? 0.85 : 0.62), c3)
    this.camera.position.set(Math.sin(orbit) * camR + this.pointer.x * 0.35, camY - this.pointer.y * 0.25, Math.cos(orbit) * camR)
    this.camera.lookAt(0, lerp(0.55, 0.95, c3) + (this.mobile ? 0.25 : 0), 0)

    // Tách đổi bên mỗi chương (chữ nằm phía còn lại): phải -> trái -> phải
    const side = smooth(0.15, 0.42, p) * (1 - smooth(0.55, 0.82, p)) // 0 = tách bên phải, 1 = bên trái
    // màn hình càng rộng thì đẩy tách ra xa giữa hơn -> chữ lớn không bao giờ đè lên tách
    const halfW = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * dist * this.camera.aspect
    const wide = THREE.MathUtils.clamp((halfW * 0.58) / 1.45, 0.9, 1.75)
    const offsetX = this.mobile ? 0 : lerp(lerp(1.45, -1.35, smooth(0.15, 0.42, p)), 1.25, smooth(0.55, 0.82, p)) * wide
    // Mobile: tách nằm nửa trên màn hình, chữ ở nửa dưới
    this.cup.visible = it > 0
    this.cup.position.set(offsetX, (this.mobile ? 1.15 : 0) + lerp(-1.6, 0, iRise) + burstHop, 0)
    this.cup.scale.setScalar(0.9 * lerp(0.35, 1, iPop))
    // Quai tách luôn quay ra phía ngoài (xa chữ), hơi hướng về camera; lắc nhẹ thay vì quay tròn
    const baseRot = lerp(-0.55, Math.PI + 0.55, side) + orbit // + orbit: giữ góc quai so với camera khi camera bay vòng
    this.rotY = lerp(this.rotY, baseRot + Math.sin(t * 0.35) * 0.3 * (1 - c3), dt ? 1 - Math.exp(-dt * 3) : 1)
    this.cup.rotation.y = this.rotY + introSpin + burstSpin
    this.cup.rotation.x = lerp(this.cup.rotation.x, this.pointer.y * 0.1, 0.1)
    this.cup.rotation.z = lerp(this.cup.rotation.z, -this.pointer.x * 0.06, 0.1)
    this.setLiquidLevel(lerp(0.2, LIQUID_FULL, iFill))

    // Đèn đổ bóng đi theo tách để bóng luôn rơi đúng lên đĩa
    this.key.position.copy(this.cup.position).add(this.tmpA.set(-3, 5, 4))
    this.key.target.position.copy(this.cup.position)
    this.key.target.updateMatrixWorld()

    const steamU = (this.steam.material as THREE.ShaderMaterial).uniforms
    steamU.uTime.value = t
    steamU.uOpacity.value = (1 - c2 * 0.5 + c3 * 0.3) * smooth(1.6, 2.8, it)
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
      // bấm vào tách: hạt văng ra xa theo hướng từ tách rồi trôi về
      if (burstPush) floatPos.addScaledVector(floatPos.clone().normalize(), burstPush * (1.2 + b.depth))
      // mở đầu: hạt bung từ tâm tách ra vị trí của mình, lần lượt từng hạt
      const bi = easeOutCubic((it - 0.6 - i * 0.03) / 1.3)
      floatPos.lerp(this.tmpB.set(0, 0.6, 0), 1 - bi)
      const a = b.a + t * b.speed
      const fall = ((b.h + 0.8) / 3.2 + t * b.speed * 0.9) % 1 // 0..1: vị trí trên vòng xoáy rơi
      const swirl = a * 2.4
      const rr = lerp(0.95, 0.12, fall)
      pourPos.set(Math.cos(swirl) * rr, lerp(3.2, 1.0, fall), Math.sin(swirl) * rr)
      this.dummy.position.copy(floatPos).lerp(pourPos, k)
      this.dummy.position.x += cx
      this.dummy.position.y += cy
      this.dummy.quaternion.setFromAxisAngle(b.axis, t * b.spin + i + burstPush * 6)
      // hạt "chìm" vào tách ở cuối vòng rơi
      const sink = k > 0 && fall > 0.9 ? 1 - ((fall - 0.9) / 0.1) * k : 1
      this.dummy.scale.setScalar(b.scale * sink * bi)
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
