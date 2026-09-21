/**
 * useCameraKitSession — real Snap AR via the official Camera Kit Web SDK.
 *
 * Pipeline (per official docs, https://developers.snap.com/camera-kit):
 *   bootstrapCameraKit({ apiToken })        → downloads WASM rendering engine
 *   cameraKit.createSession({ canvas })     → rendering pipeline
 *   getUserMedia(...)                       → camera permission + stream
 *   createMediaStreamSource(stream, opts)   → attach front camera, mirrored
 *   cameraKit.lensRepository.loadLens(...)  → fetch lens by id + group
 *   session.applyLens(lens) / play()        → live AR
 *
 * The SDK is dynamically imported only when the hook mounts (i.e. when the
 * try-on UI opens), so it never touches the storefront bundle otherwise.
 * All teardown is handled on unmount: pause, remove lens, detach source,
 * stop every media track, destroy the SDK instance, and cancel timeouts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyTryOnError } from '../lib/tryOnConfig';
import type { TryOnErrorDetail, TryOnSessionConfig, TryOnStatus } from '../types/virtualTryOn';

interface UseCameraKitSessionArgs {
  /** True while the try-on experience should be running. */
  active: boolean;
  /** Resolved lens config + apiToken (null disables the pipeline). */
  config: (TryOnSessionConfig & { apiToken: string }) | null;
  /** Canvas the live AR output renders into. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** True for back-camera ("see the room") mode. */
  useBackCamera: boolean;
}

interface UseCameraKitSessionResult {
  status: TryOnStatus;
  error: TryOnErrorDetail | null;
  /** Stage label for the loading UI. */
  stage: string;
  /** Live session metrics (fps) — exposed for diagnostics; usually null. */
  fps: number | null;
  retry: () => void;
}

/** Stage labels surfaced in the loading overlay. */
const STAGES = {
  init: 'Initializing AR…',
  camera: 'Starting camera…',
  lens: 'Loading Lens…',
  start: 'Preparing Virtual Try-On…',
} as const;

export function useCameraKitSession({
  active,
  config,
  canvasRef,
  useBackCamera,
}: UseCameraKitSessionArgs): UseCameraKitSessionResult {
  const [status, setStatus] = useState<TryOnStatus>('idle');
  const [error, setError] = useState<TryOnErrorDetail | null>(null);
  const [stage, setStage] = useState<string>(STAGES.init);
  const [fps, setFps] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Refs holding live resources for synchronous cleanup.
  const cleanupRef = useRef<(() => Promise<void> | void) | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(async () => {
    cancelledRef.current = true;
    const fn = cleanupRef.current;
    cleanupRef.current = null;
    try {
      await fn?.();
    } catch {
      /* teardown must never throw */
    }
  }, []);

  const retry = useCallback(() => {
    setAttempt(a => a + 1);
  }, []);

  useEffect(() => {
    if (!active || !config) {
      setStatus('idle');
      return;
    }

    let disposed = false;
    cancelledRef.current = false;
    let stream: MediaStream | null = null;
    let session: import('@snap/camera-kit').CameraKitSession | null = null;
    let cameraKit: import('@snap/camera-kit').CameraKit | null = null;
    let lens: import('@snap/camera-kit').Lens | null = null;

    cleanupRef.current = async () => {
      try {
        await session?.pause('live');
      } catch {
        /* noop */
      }
      try {
        await session?.removeLens();
      } catch {
        /* noop */
      }
      try {
        await cameraKit?.destroy();
      } catch {
        /* noop */
      }
      stream?.getTracks().forEach(t => t.stop());
      stream = null;
      session = null;
      cameraKit = null;
      lens = null;
    };

    const fail = (detail: TryOnErrorDetail) => {
      if (disposed || cancelledRef.current) return;
      setError(detail);
      setStatus('error');
    };

    const run = async () => {
      setError(null);
      setFps(null);
      setStatus('loading');
      setStage(STAGES.init);

      if (!canvasRef.current) {
        fail({
          code: 'SESSION_FAILED',
          message: 'Virtual Try-On could not start.',
          hint: 'Please close and reopen the try-on experience.',
          raw: 'Live render canvas missing',
        });
        return;
      }

      try {
        // 1. Lazy-load + bootstrap the SDK (downloads WASM engine).
        const cameraKitModule = await import('@snap/camera-kit');
        if (disposed || cancelledRef.current) return;

        cameraKit = await cameraKitModule.bootstrapCameraKit({
          apiToken: config.apiToken,
          logger: import.meta.env.DEV ? 'console' : 'noop',
        });
        if (disposed || cancelledRef.current) return;

        // 2. Create session bound to our canvas.
        setStage(STAGES.start);
        session = await cameraKit.createSession({ liveRenderTarget: canvasRef.current });
        if (disposed || cancelledRef.current) return;

        session.events.addEventListener('error', event => {
          const detail = event.detail;
          if (detail?.error?.name === 'LensExecutionError') {
            fail({
              code: 'LENS_RUNTIME_ERROR',
              message: 'The AR experience stopped unexpectedly.',
              hint: 'Please try again — restarting reloads the lens.',
              raw: String(detail.error.message ?? 'LensExecutionError'),
            });
          }
        });

        // 3. Camera permission + stream.
        setStage(STAGES.camera);
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: useBackCamera ? 'environment' : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (disposed || cancelledRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        const source = cameraKitModule.createMediaStreamSource(stream, {
          cameraType: useBackCamera ? 'environment' : 'user',
          transform: useBackCamera ? undefined : cameraKitModule.Transform2D.MirrorX,
          fpsLimit: 30,
        });
        await session.setSource(source);
        if (disposed || cancelledRef.current) return;

        // 4. Load the product's lens.
        setStage(STAGES.lens);
        lens = await cameraKit.lensRepository.loadLens(config.lensId, config.lensGroupId);
        if (disposed || cancelledRef.current) return;

        // 5. Apply + play — the lens is now live on the user's body.
        await session.applyLens(lens);
        await session.play('live');
        if (disposed || cancelledRef.current) return;

        setStatus('ready');
        setStage('');
      } catch (err) {
        if (disposed || cancelledRef.current) return;
        fail(classifyTryOnError(err));
      }
    };

    run();

    return () => {
      disposed = true;
      void cleanup();
    };
  }, [active, config, canvasRef, useBackCamera, attempt, cleanup]);

  // Session metrics poll (fps) — cheap, only while ready.
  useEffect(() => {
    if (status !== 'ready') {
      setFps(null);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  return { status, error, stage, fps, retry };
}
