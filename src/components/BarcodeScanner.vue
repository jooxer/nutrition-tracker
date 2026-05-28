<script setup lang="ts">
import { ref, onBeforeUnmount, watch, nextTick } from 'vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  scanned: [barcode: string];
  captured: [imageDataUrl: string];
}>();

type Mode = 'scan' | 'capture';
const mode = ref<Mode>('scan');
const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const error = ref('');
const scanning = ref(false);
const detectorSupported = ref(false);
let rafId: number | null = null;

async function startCamera() {
  error.value = '';
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    await nextTick();
    if (video.value) {
      video.value.srcObject = stream.value;
      await video.value.play();
    }
    if (mode.value === 'scan') startScanLoop();
  } catch (e: any) {
    error.value = e?.message || '无法访问摄像头';
  }
}

function stopCamera() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  scanning.value = false;
  if (stream.value) {
    stream.value.getTracks().forEach(t => t.stop());
    stream.value = null;
  }
}

async function startScanLoop() {
  // @ts-expect-error - BarcodeDetector is experimental
  if (typeof window.BarcodeDetector === 'undefined') {
    detectorSupported.value = false;
    return;
  }
  detectorSupported.value = true;
  // @ts-expect-error
  const detector = new window.BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
  });
  scanning.value = true;
  const tick = async () => {
    if (!scanning.value || !video.value) return;
    try {
      const codes = await detector.detect(video.value);
      if (codes && codes.length) {
        const value = codes[0].rawValue;
        if (value) {
          scanning.value = false;
          emit('scanned', value);
          return;
        }
      }
    } catch { /* ignore frame errors */ }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function capture() {
  if (!video.value || !canvas.value) return;
  const v = video.value;
  const c = canvas.value;

  // 限制最大尺寸，避免 base64 过大
  const maxWidth = 1920;
  const maxHeight = 1920;
  let width = v.videoWidth;
  let height = v.videoHeight;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  }

  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(v, 0, 0, width, height);
  const dataUrl = c.toDataURL('image/jpeg', 0.8);
  console.log('[Scanner] Captured image size:', Math.round(dataUrl.length / 1024), 'KB');
  emit('captured', dataUrl);
}

function switchMode(m: Mode) {
  if (mode.value === m) return;
  mode.value = m;
  if (m === 'scan') startScanLoop();
  else { scanning.value = false; if (rafId !== null) cancelAnimationFrame(rafId); }
}

const manualBarcode = ref('');
function submitManual() {
  const v = manualBarcode.value.trim();
  if (!v) return;
  emit('scanned', v);
  manualBarcode.value = '';
}

watch(() => props.open, async (o) => {
  if (o) {
    mode.value = 'capture';
    error.value = '';
    manualBarcode.value = '';
    await startCamera();
  } else {
    stopCamera();
  }
});

onBeforeUnmount(() => stopCamera());
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[60] bg-black flex flex-col">
    <div class="flex items-center justify-between p-4 text-white">
      <button class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20" @click="$emit('close')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="text-sm">{{ mode === 'capture' ? '对准营养成分表拍照' : '对准条码扫描' }}</span>
      <span class="w-9"></span>
    </div>

    <div class="flex-1 relative overflow-hidden">
      <video ref="video" class="absolute inset-0 w-full h-full object-cover" playsinline muted></video>
      <canvas ref="canvas" class="hidden"></canvas>

      <!-- 扫描框 -->
      <div v-if="mode === 'scan'" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-64 h-64 relative">
          <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white"></div>
          <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white"></div>
          <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white"></div>
          <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white"></div>
          <div v-if="scanning" class="absolute left-0 right-0 h-0.5 bg-emerald-400 animate-scan-line"></div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="absolute inset-0 flex items-center justify-center p-4">
        <div class="bg-black/70 text-white text-sm rounded-xl p-4 max-w-xs text-center">{{ error }}</div>
      </div>

      <!-- 不支持 BarcodeDetector 时的手动输入 -->
      <div v-if="mode === 'scan' && !detectorSupported && !error" class="absolute bottom-32 left-4 right-4">
        <div class="bg-black/70 text-white text-xs rounded-xl p-3 mb-2 text-center">当前浏览器不支持自动扫码，请手动输入条码</div>
        <div class="flex gap-2">
          <input v-model="manualBarcode" placeholder="输入条码" class="flex-1 px-3 py-2 rounded-lg bg-white/90 text-sm" />
          <button class="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm" @click="submitManual">查询</button>
        </div>
      </div>
    </div>

    <!-- 底部模式切换 -->
    <div class="p-6 flex items-center justify-center gap-6 bg-black">
      <button :class="['px-4 py-2 rounded-full text-sm transition',
        mode === 'scan' ? 'bg-white text-black font-medium' : 'text-white/60']"
        @click="switchMode('scan')">扫条码</button>
      <button v-if="mode === 'capture'"
        class="w-16 h-16 rounded-full bg-white border-4 border-white/40 active:scale-95 transition"
        @click="capture"></button>
      <button :class="['px-4 py-2 rounded-full text-sm transition',
        mode === 'capture' ? 'bg-white text-black font-medium' : 'text-white/60']"
        @click="switchMode('capture')">拍配料表</button>
    </div>
  </div>
</template>

<style scoped>
@keyframes scan-line {
  0% { top: 0; }
  50% { top: calc(100% - 2px); }
  100% { top: 0; }
}
.animate-scan-line { animation: scan-line 2s linear infinite; }
</style>
