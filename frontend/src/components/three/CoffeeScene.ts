/**
 * Cảnh 3D trang chủ (lấy cảm hứng Dogstudio): tách cà phê sứ + hạt cà phê bay + khói + bụi sáng.
 * Toàn bộ hình khối dựng bằng code (không cần file .glb):
 *  - Tách & đĩa: LatheGeometry (xoay 1 đường biên dạng quanh trục, giống tiện gốm)
 *  - Hạt cà phê: hình elip + khắc rãnh chữ S bằng cách dịch đỉnh (vertex) -> InstancedMesh 90 hạt
 *  - Mặt latte: vẽ bằng Canvas 2D rồi làm texture
 *  - Khói & bụi: Points + ShaderMaterial chạy trên GPU
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
  // Vẽ "tulip" latte art: các cánh sữa chồng nhau + đường kéo
  g.fillStyle = 'rgba(250,240,225,0.95)'
  g.shadowColor = 'rgba(250,240,225,0.6)'
  g.shadowBlur = 18
  const petals = [[300, 120, 70], [270, 92, 62], [240, 66, 54], [212, 44, 46], [186, 28, 36]]
  for (const [y, w, h] of petals) {
    g.beginPath()
    g.ellipse(s / 2, y, w, h, 0, Math.PI, 0)
    g.quadraticCurveTo(s / 2 + w * 0.4, y + h * 0.35, s / 2, y + h * 0.15)
    g.quadraticCurveTo(s / 2 - w * 0.4, y + h * 0.35, s / 2 - w, y)
    g.fill()
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = 'rgba(140,85,48,0.55)'
    g.beginPath()
    g.ellipse(s / 2, y + 6, w * 0.72, h * 0.55, 0, Math.PI, 0)
    g.fill()
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = 'rgba(250,240,225,0.95)'
  }
  g.lineWidth = 6
  g.strokeStyle = 'rgba(250,240,225,0.9)'
  g.beginPath()
  g.moveTo(s / 2, 150)
  g.lineTo(s / 2, 400)
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

const STEAM_VERT = /* glsl */ `
  uniform float uTime; uniform float uOpacity;
  attribute float aSeed; varying float vAlpha;
  void main() {
    float life = fract(uTime * (0.12 + aSeed * 0.1) + aSeed * 7.0);
    vec3 pos = position;
    pos.y += life * 1.7;
    pos.x += sin(life * 6.0 + aSeed * 20.0) * 0.18 * life;
    pos.z += cos(life * 5.0 + aSeed * 13.0) * 0.18 * life;
    vAlpha = sin(life * 3.14159) * uOpacity * 0.55;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (40.0 + life * 90.0) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`
const STEAM_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(1.0, 0.97, 0.93, smoothstep(0.5, 0.0, d) * vAlpha);
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

interface BeanData { r: number; a: number; h: number; speed: number; axis: THREE.Vector3; spin: number; scale: number }

export class CoffeeScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  private cup = new THREE.Group()
  private beans: THREE.InstancedMesh
  private beanData: BeanData[] = []
  private steam: THREE.Points
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
  private disposables: { dispose: () => void }[] = []

  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    // Môi trường phản chiếu cho sứ bóng
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = envTex
    this.disposables.push(envTex, pmrem)

    this.scene.add(new THREE.AmbientLight('#ffe6cc', 0.35))
    const key = new THREE.DirectionalLight('#fff1dc', 2.2)
    key.position.set(-3, 5, 4)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight('#d08a3c', 3)
    rim.position.set(3, 2, -4)
    this.scene.add(rim)

    this.buildCup()
    this.beans = this.buildBeans()
    this.steam = this.buildSteam()
    this.dust = this.buildDust()
    this.resize()
  }

  private buildCup() {
    const ceramic = new THREE.MeshPhysicalMaterial({ color: '#f6efe4', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide })
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

    this.cup.add(body, handle, liquid, saucer)
    this.cup.scale.setScalar(0.9)
    this.scene.add(this.cup)
  }

  private buildBeans() {
    const count = 90
    const mesh = new THREE.InstancedMesh(beanGeometry(), new THREE.MeshStandardMaterial({ color: '#4e2c18', roughness: 0.38, metalness: 0.08 }), count)
    for (let i = 0; i < count; i++) {
      this.beanData.push({
        r: 1.4 + Math.random() * 1.7, a: Math.random() * Math.PI * 2, h: -0.6 + Math.random() * 2.9,
        speed: 0.1 + Math.random() * 0.25, axis: new THREE.Vector3().randomDirection(), spin: 0.3 + Math.random() * 1.2,
        scale: 0.13 + Math.random() * 0.08,
      })
    }
    this.scene.add(mesh)
    return mesh
  }

  private buildSteam() {
    const n = 140
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.6
      pos[i * 3 + 1] = 1.05
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6
      seed[i] = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    }))
    this.cup.add(pts) // khói đi theo tách
    return pts
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

    // Camera: chương 1 nhìn ngang -> chương 2 vòng sang bên -> chương 3 từ trên xuống
    const dist = this.mobile ? 8.6 : 6.4
    const orbit = lerp(0, 0.75, c2) - lerp(0, 0.75, c3)
    const camY = lerp(lerp(1.5, 2.3, c2), 4.1, c3)
    const camR = lerp(dist, dist * 0.42, c3)
    this.camera.position.set(Math.sin(orbit) * camR + this.pointer.x * 0.35, camY - this.pointer.y * 0.25, Math.cos(orbit) * camR)
    this.camera.lookAt(0, lerp(0.75, 0.95, c3), 0)

    // Tách đổi bên mỗi chương (chữ nằm phía còn lại): phải -> trái -> phải
    const offsetX = this.mobile ? 0 : lerp(lerp(1.35, -1.3, smooth(0.15, 0.42, p)), 1.2, smooth(0.55, 0.82, p))
    // Mobile: tách nằm nửa trên màn hình, chữ ở nửa dưới
    this.cup.position.set(offsetX, this.mobile ? 1.15 : 0, 0)
    this.cup.rotation.y += dt * 0.25 * (1 - c3)
    this.cup.rotation.x = lerp(this.cup.rotation.x, this.pointer.y * 0.12, 0.1)
    this.cup.rotation.z = lerp(this.cup.rotation.z, -this.pointer.x * 0.08, 0.1)
    ;(this.steam.material as THREE.ShaderMaterial).uniforms.uTime.value = t
    ;(this.steam.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 1 - c2 * 0.6 + c3 * 0.4

    const dustU = (this.dust.material as THREE.ShaderMaterial).uniforms
    dustU.uTime.value = t
    ;(dustU.uMouse.value as THREE.Vector2).copy(this.pointer)
    this.dust.rotation.y = this.pointer.x * 0.08

    // Hạt cà phê: bay theo quỹ đạo quanh tách -> chương 2 xoáy vào miệng tách -> chương 3 tản ra
    const cx = this.cup.position.x
    const k = c2 * (1 - c3)        // mức "đổ vào tách"
    const scatter = 1 + c3 * 1.6   // chương 3: hạt tản rộng ra xung quanh
    const orbitPos = this.tmpA, pourPos = this.tmpB
    this.beanData.forEach((b, i) => {
      const a = b.a + t * b.speed
      orbitPos.set(Math.cos(a) * b.r * scatter, b.h + Math.sin(t * 0.6 + i) * 0.15, Math.sin(a) * b.r * 0.7 * scatter)
      const fall = ((b.h + 0.8) / 3.2 + t * b.speed * 0.9) % 1 // 0..1: vị trí trên vòng xoáy rơi
      const swirl = a * 2.4
      const rr = lerp(0.95, 0.12, fall)
      pourPos.set(Math.cos(swirl) * rr, lerp(3.2, 1.0, fall), Math.sin(swirl) * rr)
      this.dummy.position.copy(orbitPos).lerp(pourPos, k)
      this.dummy.position.x += cx
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
