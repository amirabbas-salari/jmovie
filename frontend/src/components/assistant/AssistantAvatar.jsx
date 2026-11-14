import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ---------------------------------------------------------------------------
// آواتار سه‌بعدی دستیار با لیپ‌سینک دامنه‌ای (Web Audio دامنه‌ی صدای واقعی
// خروجی را می‌سنجد و دهان آواتار با آن باز/بسته می‌شود).
//
// دو حالت رندر:
// ۱) اگر فایل قانونیِ /models/avatar.glb موجود باشد (مدل دارای Morph
//    Target دهان/فک مثل mouthOpen/jawOpen/viseme_*) همان لود می‌شود و
//    مورف‌ها با دامنه‌ی صدا رانده می‌شوند. منبع و لایسنس مدل باید در
//    docs/assistant/ASSET_LICENSES.md ثبت شود.
// ۲) در غیر این صورت آواتار رویه‌ای (procedural) همین فایل رندر می‌شود
//    تا پروتوتایپ بدون هیچ فایل خارجی و با صفر ریسک لایسنس کار کند.
//
// حالت‌ها: idle | listening | thinking | speaking | error
// ---------------------------------------------------------------------------

const STATE_RING_COLORS = {
  idle: 0x475569,
  listening: 0x10b981,
  thinking: 0xf59e0b,
  speaking: 0xe11d48,
  error: 0xdc2626,
}

function buildProceduralAvatar(scene) {
  const group = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b98d, roughness: 0.65 })
  const skinDark = new THREE.MeshStandardMaterial({ color: 0xd9a06f, roughness: 0.7 })
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.85 })
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x8b1e2d, roughness: 0.8 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 })
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xb4544e, roughness: 0.55 })

  // تنه و شانه‌ها
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.95, 1.15, 32), shirtMat)
  torso.position.y = -1.28
  group.add(torso)
  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), shirtMat)
  shoulderL.position.set(-0.62, -0.82, 0)
  const shoulderR = shoulderL.clone()
  shoulderR.position.x = 0.62
  group.add(shoulderL, shoulderR)

  // گردن و سر
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.34, 20), skinDark)
  neck.position.y = -0.52
  group.add(neck)

  const headGroup = new THREE.Group()
  headGroup.position.y = 0.08
  group.add(headGroup)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 40, 32), skin)
  head.scale.set(0.94, 1.08, 0.98)
  headGroup.add(head)

  // مو (کلاه نیم‌کره)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.545, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hairMat,
  )
  hair.scale.set(0.96, 1.1, 1)
  hair.position.y = 0.045
  hair.rotation.x = -0.18
  headGroup.add(hair)

  // چشم‌ها (برای پلک‌زدن کل گروه چشم scale می‌شود)
  const eyes = {}
  ;[-1, 1].forEach((side) => {
    const eyeGroup = new THREE.Group()
    eyeGroup.position.set(0.185 * side, 0.08, 0.47)
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), whiteMat)
    white.scale.set(1, 0.82, 0.55)
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), darkMat)
    iris.position.z = 0.045
    eyeGroup.add(white, iris)
    headGroup.add(eyeGroup)
    eyes[side === -1 ? 'left' : 'right'] = { group: eyeGroup, iris }

    // ابرو
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 0.03), hairMat)
    brow.position.set(0.185 * side, 0.225, 0.485)
    brow.rotation.z = -0.08 * side
    headGroup.add(brow)
    eyes[side === -1 ? 'leftBrow' : 'rightBrow'] = brow
  })

  // بینی و گوش‌ها
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 12), skinDark)
  nose.position.set(0, -0.03, 0.51)
  nose.scale.set(0.8, 1.25, 0.8)
  headGroup.add(nose)
  ;[-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), skin)
    ear.position.set(0.5 * side, -0.02, 0)
    ear.scale.set(0.45, 0.8, 0.6)
    headGroup.add(ear)
  })

  // دهان: لب + حفره‌ی دهان که با دامنه‌ی صدا باز می‌شود (لیپ‌سینک دامنه‌ای)
  const mouthGroup = new THREE.Group()
  mouthGroup.position.set(0, -0.235, 0.485)
  const lips = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.021, 12, 28), lipMat)
  lips.scale.set(1.25, 0.62, 0.6)
  const mouthInner = new THREE.Mesh(
    new THREE.CircleGeometry(0.072, 24),
    new THREE.MeshStandardMaterial({ color: 0x3d0a12, roughness: 0.9 }),
  )
  mouthInner.position.z = -0.012
  mouthInner.scale.set(1.3, 0.15, 1)
  mouthGroup.add(lips, mouthInner)
  headGroup.add(mouthGroup)

  scene.add(group)
  return { group, headGroup, eyes, mouth: { lips, inner: mouthInner }, torso }
}

function findMorphTargets(root) {
  const found = { mouth: [], blink: [] }
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.morphTargetDictionary) return
    Object.entries(obj.morphTargetDictionary).forEach(([name, index]) => {
      const n = name.toLowerCase()
      if (/(mouthopen|jawopen|viseme_aa|mouth_open|aa$)/.test(n)) {
        found.mouth.push({ mesh: obj, index })
      } else if (/(eyeblink|blink)/.test(n)) {
        found.blink.push({ mesh: obj, index })
      }
    })
  })
  return found
}

function setMorph(list, value) {
  list.forEach(({ mesh, index }) => {
    if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = value
  })
}

export default function AssistantAvatar({ state = 'idle', amplitudeRef }) {
  const mountRef = useRef(null)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const width = mount.clientWidth || 320
    const height = mount.clientHeight || 320
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50)
    camera.position.set(0, 0.25, 4.4)
    camera.lookAt(0, -0.15, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const keyLight = new THREE.DirectionalLight(0xfff2e0, 1.6)
    keyLight.position.set(2.5, 3, 4)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0x8ab4ff, 0.5)
    fillLight.position.set(-3, 1, 2)
    scene.add(fillLight)

    // حلقه‌ی وضعیت زیر آواتار (رنگ = حالت مکالمه)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.028, 12, 64),
      new THREE.MeshStandardMaterial({ color: STATE_RING_COLORS.idle, roughness: 0.4 }),
    )
    ring.rotation.x = Math.PI / 2.25
    ring.position.y = -1.95
    scene.add(ring)

    let avatar = buildProceduralAvatar(scene)
    let morphs = null
    let glbLoaded = false

    // تلاش برای مدل قانونیِ کاربر (اگر فایل گذاشته باشد)؛ وگرنه رویه‌ای می‌ماند
    const loader = new GLTFLoader()
    loader.load(
      '/models/avatar.glb',
      (gltf) => {
        const found = findMorphTargets(gltf.scene)
        scene.remove(avatar.group)
        gltf.scene.position.y = -0.9
        scene.add(gltf.scene)
        avatar = { group: gltf.scene, headGroup: gltf.scene, eyes: null, mouth: null, torso: null }
        morphs = found.mouth.length ? found : null
        glbLoaded = true
      },
      undefined,
      () => {
        /* فایل مدل وجود ندارد: آواتار رویه‌ای (پیش‌فرض پروتوتایپ) */
      },
    )

    const clock = new THREE.Clock()
    let raf = 0
    let blinkAt = 1.6
    let blinkPhase = 0
    let errorShakeUntil = 0
    let smoothedAmp = 0

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const s = stateRef.current
      const rawAmp = THREE.MathUtils.clamp(amplitudeRef?.current || 0, 0, 1)
      smoothedAmp += (rawAmp - smoothedAmp) * 0.35

      // رنگ و تپش حلقه‌ی وضعیت
      const targetColor = new THREE.Color(STATE_RING_COLORS[s] || STATE_RING_COLORS.idle)
      ring.material.color.lerp(targetColor, 0.08)
      const ringScale = 1 + (s === 'speaking' ? smoothedAmp * 0.08 : Math.sin(t * 2) * 0.012)
      ring.scale.set(ringScale, ringScale, 1)

      if (s === 'error') errorShakeUntil = t + 0.45

      if (!glbLoaded && avatar.headGroup) {
        const head = avatar.headGroup
        // تنفس و شناوری ملایم (Idle)
        const breathe = Math.sin(t * 1.4) * 0.012
        if (avatar.torso) avatar.torso.scale.set(1 + breathe, 1, 1 + breathe)
        head.position.y = 0.08 + Math.sin(t * 1.4) * 0.008

        head.rotation.set(0, 0, 0)
        if (s === 'idle') {
          head.rotation.y = Math.sin(t * 0.35) * 0.05
        } else if (s === 'listening') {
          // سر کمی به سمت کاربر خم می‌شود؛ ابروها بالا (توجه)
          head.rotation.z = 0.07
          head.rotation.x = 0.04 + Math.sin(t * 2.2) * 0.012
          if (avatar.eyes) {
            avatar.eyes.leftBrow.position.y = 0.245
            avatar.eyes.rightBrow.position.y = 0.245
          }
        } else if (s === 'thinking') {
          // نگاه به بالا و کنار = در حال فکرکردن
          head.rotation.set(-0.1, 0.22, -0.05)
          if (avatar.eyes) {
            avatar.eyes.left.iris.position.y = 0.02
            avatar.eyes.right.iris.position.y = 0.02
            avatar.eyes.leftBrow.position.y = 0.225
            avatar.eyes.rightBrow.position.y = 0.225
          }
        } else if (s === 'speaking') {
          head.rotation.x = smoothedAmp * 0.06
          head.rotation.y = Math.sin(t * 0.8) * 0.03
          if (avatar.eyes) {
            avatar.eyes.left.iris.position.y = 0
            avatar.eyes.right.iris.position.y = 0
          }
        }
        if (t < errorShakeUntil) {
          head.rotation.y = Math.sin(t * 45) * 0.06
        }

        // پلک‌زدن
        if (avatar.eyes) {
          if (t > blinkAt) {
            blinkPhase = 0.16
            blinkAt = t + 1.8 + Math.random() * 2.6
          }
          if (blinkPhase > 0) {
            blinkPhase -= 0.016
            const lid = Math.max(0.08, Math.abs(blinkPhase - 0.08) / 0.08)
            avatar.eyes.left.group.scale.y = lid
            avatar.eyes.right.group.scale.y = lid
          } else {
            avatar.eyes.left.group.scale.y = 1
            avatar.eyes.right.group.scale.y = 1
          }
        }

        // لیپ‌سینک دامنه‌ای: بازشدن دهان متناسب با بلندی صدای خروجی
        if (avatar.mouth) {
          const open = s === 'speaking' ? 0.15 + smoothedAmp * 1.15 : 0.15
          avatar.mouth.inner.scale.y = open
          avatar.mouth.lips.scale.y = 0.62 * (0.6 + open * 0.55)
        }
      }

      if (glbLoaded && morphs) {
        // مدل GLB دارای مورف دهان: همان دامنه، روی Morph Target
        setMorph(morphs.mouth, s === 'speaking' ? smoothedAmp : 0)
        if (t > blinkAt) {
          setMorph(morphs.blink, 1)
          window.setTimeout(() => setMorph(morphs.blink, 0), 110)
          blinkAt = t + 2 + Math.random() * 2.6
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w = mount.clientWidth || width
      const h = mount.clientHeight || height
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((m) => m.dispose())
        }
      })
    }
    // amplitudeRef یک ref پایدار است؛ فقط یک‌بار صحنه ساخته می‌شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={mountRef}
      className="h-full w-full [&>canvas]:h-full [&>canvas]:w-full"
      aria-hidden="true"
    />
  )
}
