// Exercise the camera component with controlled media devices; no real camera or uploads.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as recovery from '../lib/camera/recovery.ts'

const source = fs.readFileSync('components/checkin/CameraCapture.tsx', 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText

function mount(getUserMedia) {
  const slots = [], effects = [], timers = new Map(), captures = []
  let cursor = 0, timerId = 0, initialized = false
  const video = {
    srcObject: null, readyState: 2, videoWidth: 640, videoHeight: 480, paused: false,
    play: async () => {},
  }
  const canvas = {
    getContext: () => ({ translate() {}, scale() {}, drawImage() {} }),
    toDataURL: () => 'data:image/jpeg;base64,live',
    toBlob: (fn) => fn(new Blob(['live'])),
  }
  const jsx = (type, props) => {
    if (type === 'video') props.ref.current = video
    if (type === 'canvas') props.ref.current = canvas
    return { type, props: props ?? {} }
  }
  const react = {
    useState(value) {
      const i = cursor++
      if (!(i in slots)) slots[i] = value
      return [slots[i], (next) => { slots[i] = next }]
    },
    useRef(value) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { current: value }
      return slots[i]
    },
    useCallback: (fn) => fn,
    useEffect(fn) { if (!initialized) effects.push(fn) },
  }
  const context = {
    exports: {}, navigator: { userAgent: 'Android', mediaDevices: { getUserMedia } },
    window: { location: { origin: 'https://app.amgovenger.com' } },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId },
    clearTimeout(id) { timers.delete(id) },
    require(name) {
      if (name === '@/lib/camera/recovery') return recovery
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (name === '@/components/aoo') return { Button: 'Button' }
      if (name === 'lucide-react') return new Proxy({}, { get: (_obj, key) => key })
      throw new Error(name)
    },
  }
  vm.runInNewContext(code, context)
  const render = () => {
    cursor = 0
    return context.exports.default({ onCapture: (blob) => captures.push(blob), onCancel() {} })
  }
  render()
  initialized = true
  const cleanups = effects.map(fn => fn())
  const nodes = (node) => !node || typeof node !== 'object' ? [] :
    [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
  const text = (node) => typeof node === 'string' ? node :
    [node?.props?.children].flat(Infinity).map(child => child ? text(child) : '').join('')
  return {
    video, captures, render,
    nodes: () => nodes(render()),
    button(label) { return nodes(render()).find(n => n.type === 'Button' && text(n).trim() === label) },
    ready() { nodes(render()).find(n => n.type === 'video').props.onCanPlay() },
    unmount() { cleanups.forEach(fn => fn?.()) },
    timeout() { [...timers.values()].forEach(fn => fn()) },
  }
}
const stream = () => {
  const track = { readyState: 'live', muted: false, stops: 0, stop() { this.stops++; this.readyState = 'ended' } }
  return { track, getTracks: () => [track], getVideoTracks: () => [track] }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
let passed = 0
async function check(name, fn) {
  await fn()
  passed++
  console.log(`✓ ${name}`)
}
await check('No file picker; capture and confirm a live frame; retake attaches a new stream', async () => {
  const streams = []
  const app = mount(async () => { const s = stream(); streams.push(s); return s })
  await flush()
  assert.equal(app.nodes().some(n => n.type === 'input'), false)
  assert.equal(app.button('ถ่ายรูป').props.disabled, true)
  app.ready()
  assert.equal(app.button('ถ่ายรูป').props.disabled, false)
  app.button('ถ่ายรูป').props.onClick()
  assert.equal(streams[0].track.stops, 1)
  app.button('ยืนยัน').props.onClick()
  assert.equal(app.captures.length, 1)
  app.button('ถ่ายใหม่').props.onClick()
  await flush()
  assert.equal(app.video.srcObject, streams[1])
  app.unmount()
  assert.equal(streams[1].track.stops, 1)
})
await check('Denied permission offers retry without gallery fallback', async () => {
  let denied = true
  const app = mount(async () => { if (denied) throw new Error('denied'); return stream() })
  await flush()
  assert.ok(app.button('ลองอีกครั้ง'))
  assert.equal(app.nodes().some(n => n.type === 'input'), false)
  denied = false
  await app.button('ลองอีกครั้ง').props.onClick()
  app.ready()
  assert.equal(app.button('ถ่ายรูป').props.disabled, false)
  app.unmount()
})
await check('Permission granted after closing modal releases the camera', async () => {
  let resolve
  const pending = new Promise(r => { resolve = r })
  const app = mount(() => pending)
  app.unmount()
  const s = stream()
  resolve(s)
  await flush()
  assert.equal(s.track.stops, 1)
  assert.equal(app.video.srcObject, null)
})
await check('No video frames times out into retry, never enables capture', async () => {
  const s = stream()
  const app = mount(async () => s)
  await flush()
  app.video.readyState = 0
  app.video.videoWidth = 0
  app.ready()
  assert.equal(app.button('ถ่ายรูป').props.disabled, true)
  app.timeout()
  assert.ok(app.button('ลองอีกครั้ง'))
  assert.equal(s.track.stops, 1)
  app.unmount()
})
await check('Interrupted stream cannot submit a stale frame', async () => {
  const s = stream()
  const app = mount(async () => s)
  await flush()
  app.ready()
  s.track.muted = true
  app.button('ถ่ายรูป').props.onClick()
  assert.ok(app.button('ลองอีกครั้ง'))
  assert.equal(app.button('ยืนยัน'), undefined)
  assert.equal(app.captures.length, 0)
  app.unmount()
})
await check('Camera errors offer Chrome and settings guidance without a file picker', async () => {
  const app = mount(async () => { throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' }) })
  await flush()
  const link = app.nodes().find(n => n.type === 'a' && n.props.href.startsWith('intent:'))
  assert.equal(link.props.href, recovery.chromeCheckinIntent('https://app.amgovenger.com'))
  assert.ok(app.nodes().find(n => n.type === 'details'))
  assert.ok(app.nodes().find(n => n.props.role === 'alert'))
  assert.equal(app.nodes().some(n => n.type === 'input'), false)
  app.unmount()
})
await check('Recovery distinguishes permission, busy, missing camera and generic failures', async () => {
  assert.match(recovery.cameraFailureMessage({ name: 'NotAllowedError' }), /ไม่อนุญาต/)
  assert.match(recovery.cameraFailureMessage({ name: 'NotReadableError' }), /แอปอื่น/)
  assert.match(recovery.cameraFailureMessage({ name: 'NotFoundError' }), /ไม่พบกล้อง/)
  assert.match(recovery.cameraFailureMessage(null), /เปิดกล้องไม่สำเร็จ/)
  const intent = recovery.chromeCheckinIntent('https://app.amgovenger.com/auth/verify?token_hash=secret')
  assert.ok(intent.startsWith('intent://app.amgovenger.com/checkin#Intent;'))
  assert.ok(!intent.includes('secret'))
  assert.ok(intent.includes('package=com.android.chrome;'))
})
await check('Help link is visible while camera permission is still pending', async () => {
  const app = mount(() => new Promise(() => {}))
  assert.ok(app.nodes().find(n => n.type === 'a' && n.props.href === '/camera-help'))
  app.unmount()
})
console.log(`ผ่าน ${passed} · ไม่ผ่าน 0`)
