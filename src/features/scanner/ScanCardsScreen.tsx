import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CheckCircle2,
  Flashlight,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  Trash2,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useSettings } from "../../app/useSettings";
import { useDecks } from "../../db/hooks";
import {
  addDeckCard,
  addScanRecord,
  applyScanBatchToOwned,
  getScanBatch,
  getRecoverableScanBatch,
  listScanRecords,
  saveScanBatch,
  updateScanBatch,
  updateScanRecord,
} from "../../db/repositories";
import type {
  ScanBatch,
  ScanBatchDestination,
  ScannerMode,
  ScanRecord,
} from "../../types/domain";
import { catalogCardToManualInput } from "../cards/cardSearch";
import { evaluateAddCardRules } from "../decks/commanderRules";
import {
  analyzeVideoFrame,
  shouldSuppressDuplicateScan,
  shouldUseRecognitionFallback,
  type FrameAnalysis,
  type FrameAnalyzerMemory,
} from "./frameAnalysis";
import {
  applyTorchToStream,
  applyZoomToStream,
  getCameraSupportStatus,
  mapCameraError,
  openCameraStream,
  queryCameraPermissionState,
  stopCameraStream,
  type CameraCapabilities,
  type CameraDeviceOption,
  type CameraPermissionState,
} from "./scannerCamera";
import {
  batchNeedsPersistencePrompt,
  createScanRecordFromCard,
  createScanRecordFromResolvedCard,
  createScannerBatch,
  frameGuidanceText,
  getSimulatedScanCard,
  nextAutomaticFeederCycle,
  nextStackingFeederCycle,
  scannerDestinations,
  scannerFeedbackStates,
  scannerModes,
  summarizeBatchRecords,
  type AutomaticFeederState,
  type StackingFeederState,
} from "./scannerEngine";
import {
  createUnresolvedScannerResult,
  recognizeScannerFrame,
  scannerRecognitionBudgetMs,
  terminateScannerOcrWorker,
} from "./scannerRecognition";
import { createScanFeedbackController } from "./scanFeedback";
import { drawVisibleGuideToCanvas } from "./cameraGeometry";
import { prepareScannerRecognition } from "./scannerPipeline";
import { createScannerLifecycle } from "./scannerLifecycle";
import {
  ownershipToTrace,
  recordScannerTrace,
  recordScannerTransition,
} from "./scannerDiagnostics";

type ScannerLoopState =
  | "idle"
  | "waiting_for_camera"
  | "watching"
  | "monitoring"
  | "possible_new_target"
  | "stabilizing"
  | "capturing"
  | "resolving"
  | "success_feedback"
  | "queued"
  | "paused"
  | "error";

type CameraStatus = {
  state: CameraPermissionState | "idle";
  title: string;
  detail: string;
  action: string;
};

function sampleIntervalFor({
  previewQuality,
  performanceMode,
}: {
  previewQuality: string;
  performanceMode: string;
}): number {
  if (performanceMode === "performance" || previewQuality === "low") {
    return 520;
  }

  if (previewQuality === "high") {
    return 170;
  }

  return 290;
}

function analysisSizeFor(previewQuality: string): { width: number; height: number } {
  if (previewQuality === "high") {
    return { width: 320, height: 448 };
  }

  if (previewQuality === "low") {
    return { width: 180, height: 252 };
  }

  return { width: 240, height: 336 };
}

function modeLabel(mode: ScannerMode): string {
  return scannerModes.find((scannerMode) => scannerMode.id === mode)?.label ?? "Batch Scan";
}

function destinationLabel(destination: ScanBatchDestination): string {
  return scannerDestinations.find((scannerDestination) => scannerDestination.id === destination)?.label ?? "Owned Cards";
}

function identityLabel(record: ScanRecord): string {
  if (record.identityStatus === "verified" || record.status === "matched" || record.status === "confirmed") return "Card verified";
  if (record.identityStatus === "ambiguous") return "Multiple possible matches";
  if (record.identityStatus === "unresolved" || record.status === "unresolved") return "Card not identified";
  return "Review needed";
}

function printingLabel(record: ScanRecord): string {
  if (record.printingStatus === "verified" || record.printingId) return "Printing verified";
  if (record.printingStatus === "review_required") return "Printing needs review";
  return "Printing unknown";
}

export function ScanCardsScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const { decks } = useDecks();
  const defaultMode =
    (searchParams.get("mode") as ScannerMode | null) ??
    settings.scannerDefaultMode ??
    "batch";
  const defaultDestination: ScanBatchDestination = searchParams.get("section")
    ? "main_deck"
    : settings.scannerPreferredDestination &&
        settings.scannerPreferredDestination !== "ask"
      ? settings.scannerPreferredDestination
      : "owned_cards";
  const [mode, setMode] = useState<ScannerMode>(defaultMode);
  const [destination, setDestination] = useState<ScanBatchDestination>(
    defaultDestination,
  );
  const [setLock, setSetLock] = useState("");
  const [language, setLanguage] = useState("any");
  const [deckId, setDeckId] = useState(searchParams.get("deckId") ?? "");
  const [sectionId] = useState(searchParams.get("section") ?? "");
  const [batch, setBatch] = useState<ScanBatch | null>(null);
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [message, setMessage] = useState(
    "Deckstate needs camera access before live scanning can begin.",
  );
  const [scanIndex, setScanIndex] = useState(0);
  const [automaticState, setAutomaticState] = useState<AutomaticFeederState>("idle");
  const [stackingState, setStackingState] =
    useState<StackingFeederState>("idle_watching_tray");
  const [tooCloseDuration, setTooCloseDuration] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>({
    state: "idle",
    title: "Camera not started",
    detail: "Tap Allow Camera to request device camera access.",
    action: "Allow Camera",
  });
  const [cameraReady, setCameraReady] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [loopState, setLoopState] = useState<ScannerLoopState>("idle");
  const [cameraDevices, setCameraDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState(
    settings.scannerDefaultCameraId ?? "",
  );
  const [capabilities, setCapabilities] = useState<CameraCapabilities>({
    torchSupported: false,
    focusModes: [],
  });
  const [torchOn, setTorchOn] = useState(false);
  const [zoomValue, setZoomValue] = useState(1);
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);

  const deck = decks.find((candidate) => candidate.id === deckId);
  const summary = useMemo(() => summarizeBatchRecords(records), [records]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameMemoryRef = useRef<FrameAnalyzerMemory>({});
  const loopFrameRef = useRef<number | undefined>(undefined);
  const lastAnalysisAtRef = useRef(0);
  const recognizingRef = useRef(false);
  const batchRef = useRef<ScanBatch | null>(null);
  const modeRef = useRef(mode);
  const destinationRef = useRef(destination);
  const setLockRef = useRef(setLock);
  const languageRef = useRef(language);
  const recordsRef = useRef<ScanRecord[]>([]);
  const cameraReadyRef = useRef(false);
  const scannerPausedRef = useRef(false);
  const reviewOpenRef = useRef(false);
  const lastAcceptedFingerprintRef = useRef<string | undefined>(undefined);
  const stackingTransitionRef = useRef(false);
  const tooCloseStartedAtRef = useRef<number | undefined>(undefined);
  const lastFeedbackRef = useRef("");
  const manualScannerMessageRef = useRef(false);
  const feedbackControllerRef = useRef(createScanFeedbackController());
  const abortRecognitionRef = useRef<AbortController | null>(null);
  const [lifecycle] = useState(() => createScannerLifecycle("scan-session"));
  const lastReviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const autoCameraAttemptedRef = useRef(false);

  useEffect(() => {
    if (!reviewOpen) {
      lastReviewTriggerRef.current?.focus();
      return;
    }
    const closeButton = document.querySelector<HTMLButtonElement>('[aria-label="Close batch review"]');
    closeButton?.focus();
  }, [reviewOpen]);

  useEffect(() => {
    batchRef.current = batch;
  }, [batch]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    setLockRef.current = setLock.trim().toLowerCase();
  }, [setLock]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    cameraReadyRef.current = cameraReady;
  }, [cameraReady]);

  useEffect(() => {
    scannerPausedRef.current = scannerPaused;
  }, [scannerPaused]);

  useEffect(() => {
    reviewOpenRef.current = reviewOpen;
  }, [reviewOpen]);

  const refreshRecords = useCallback(async (batchId: string) => {
    const nextRecords = await listScanRecords(batchId);
    setRecords(nextRecords);
    recordsRef.current = nextRecords;
  }, []);

  const getOrCreateBatch = useCallback(async () => {
    if (batchRef.current && !["applied", "discarded"].includes(batchRef.current.status)) {
      return batchRef.current;
    }

    const nextBatch = createScannerBatch({
      mode: modeRef.current,
      destination: destinationRef.current,
      deckId: deckId || undefined,
      sectionId: sectionId || undefined,
    });
    const saved = await saveScanBatch(nextBatch);
    batchRef.current = saved;
    setBatch(saved);
    setRecords([]);
    return saved;
  }, [deckId, sectionId]);

  useEffect(() => {
    let mounted = true;

    async function recoverBatch() {
      try {
        const requestedBatchId = searchParams.get("batchId");
        if (requestedBatchId) {
          const requestedBatch = await getScanBatch(requestedBatchId);
          if (mounted && requestedBatch) {
            setBatch(requestedBatch);
            batchRef.current = requestedBatch;
            setMode(requestedBatch.mode ?? "batch");
            setDestination(requestedBatch.destination ?? "owned_cards");
            setDeckId(requestedBatch.deckId ?? searchParams.get("deckId") ?? "");
            lastAcceptedFingerprintRef.current = requestedBatch.lastAcceptedFingerprint;
            await refreshRecords(requestedBatch.id);
            if (!mounted) {
              return;
            }
            setReviewOpen(searchParams.get("review") === "1");
            setShowRecovery(false);
            return;
          }
        }

        const recoverable = await getRecoverableScanBatch();
        if (mounted && recoverable) {
          setBatch(recoverable);
          batchRef.current = recoverable;
          setMode(recoverable.mode ?? "batch");
          setDestination(recoverable.destination ?? "owned_cards");
          setDeckId(recoverable.deckId ?? searchParams.get("deckId") ?? "");
          lastAcceptedFingerprintRef.current = recoverable.lastAcceptedFingerprint;
          await refreshRecords(recoverable.id);
          if (mounted) {
            setShowRecovery(true);
          }
        }
      } catch {
        if (mounted) {
          setShowRecovery(false);
        }
      }
    }

    void recoverBatch();
    return () => {
      mounted = false;
    };
  }, [refreshRecords, searchParams]);

  useEffect(() => {
    void queryCameraPermissionState().then((permissionState) => {
      if (permissionState === "denied") {
        setCameraStatus({
          state: "denied",
          title: "Camera access is blocked.",
          detail:
            "Enable camera access for this site in your browser or device settings, then return and try again.",
          action: "Try Again",
        });
      }
      if (permissionState === "granted" && !autoCameraAttemptedRef.current && !cameraReadyRef.current) {
        autoCameraAttemptedRef.current = true;
        void requestCamera();
      }
    });
  }, []);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (batchNeedsPersistencePrompt(batch ?? undefined)) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [batch]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        abortRecognitionRef.current?.abort();
        lifecycle.invalidateTarget();
        frameMemoryRef.current = {};
        setScannerPaused(true);
        setLoopState("paused");
        setMessage("Recognition paused while the page is hidden. The batch remains saved.");
      } else if (cameraReadyRef.current && batchRef.current?.status !== "paused") {
        setScannerPaused(false);
        setMessage("Camera visible again. Recognition resumed.");
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const feedbackController = feedbackControllerRef.current;
    return () => {
      if (loopFrameRef.current) {
        cancelAnimationFrame(loopFrameRef.current);
      }
      abortRecognitionRef.current?.abort();
      stopCameraStream(streamRef.current);
      void feedbackController.close();
      void terminateScannerOcrWorker();
    };
  }, []);

  useEffect(() => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!cameraReady || !stream || !video || video.srcObject === stream) {
      return;
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => {
      setMessage("Camera stream is open; tap Refresh Camera if the preview does not start.");
    });
  }, [cameraReady]);

  async function attachStream(stream: MediaStream) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Video metadata timed out.")), 9000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve();
      };
    });
    await video.play();
  }

  async function startBatch(nextStatus: ScanBatch["status"] = "scanning") {
    if (batchRef.current && !["applied", "discarded"].includes(batchRef.current.status)) {
      const updated = await updateScanBatch(batchRef.current.id, {
        status: nextStatus,
        mode,
        destination,
        deckId: deckId || undefined,
        sectionId: sectionId || undefined,
      });
      batchRef.current = updated;
      setBatch(updated);
      setReviewOpen(false);
      setShowRecovery(false);
      setScannerPaused(false);
      await refreshRecords(updated.id);
      setMessage("Existing persistent scan batch resumed. No previous records were discarded.");
      return;
    }

    const nextBatch = createScannerBatch({
      mode,
      destination,
      deckId: deckId || undefined,
      sectionId: sectionId || undefined,
    });
    const saved = await saveScanBatch({ ...nextBatch, status: nextStatus });
    batchRef.current = saved;
    setBatch(saved);
    setRecords([]);
    setReviewOpen(false);
    setShowRecovery(false);
    setMessage("Persistent scan batch started. Records will remain until applied, saved, or discarded.");
  }

  async function requestCamera(deviceIdOverride?: string) {
    const support = getCameraSupportStatus();
    if (!support.supported) {
      setCameraStatus({
        state: support.state,
        title: support.title,
        detail: support.detail,
        action: support.state === "insecure_context" ? "Open Live Secure App" : "Manual Entry",
      });
      setLoopState("error");
      return;
    }

    setCameraStatus({
      state: "prompt",
      title: "Requesting camera access...",
      detail: "Your browser may ask for permission now.",
      action: "Allow Camera",
    });
    setLoopState("waiting_for_camera");

    try {
      abortRecognitionRef.current?.abort();
      lifecycle.invalidateTarget();
      await feedbackControllerRef.current.prime();
      stopCameraStream(streamRef.current);
      const requestedDeviceId =
        deviceIdOverride || selectedCameraId || settings.scannerDefaultCameraId;
      const result = await openCameraStream(requestedDeviceId);
      streamRef.current = result.stream;
      await attachStream(result.stream);
      setCameraDevices(result.devices);
      setSelectedCameraId(result.selectedDeviceId ?? "");
      setCapabilities(result.capabilities);
      setZoomValue(result.capabilities.zoom?.current ?? result.capabilities.zoom?.min ?? 1);
      setCameraReady(true);
      setScannerPaused(false);
      setLoopState("watching");
      setCameraStatus({
        state: result.permissionState,
        title: "Camera live",
        detail: "Live video stays on this device. Deck Nexus is watching for stable card candidates.",
        action: "Refresh Camera",
      });
      if (result.selectedDeviceId) {
        await updateSettings({ scannerDefaultCameraId: result.selectedDeviceId });
      }
      if (settings.scannerTorchDefault && result.capabilities.torchSupported) {
        const enabled = await applyTorchToStream(result.stream, true).catch(() => false);
        setTorchOn(enabled);
      }
      if (batchRef.current) {
        await updateScanBatch(batchRef.current.id, {
          status: "scanning",
          cameraDeviceId: result.selectedDeviceId,
          mode,
          destination,
        });
      }
      setMessage("Camera live. Scans save to the current batch.");
    } catch (error) {
      const mapped = mapCameraError(error);
      setCameraStatus(mapped);
      setCameraReady(false);
      setLoopState("error");
      setMessage(mapped.detail);
    }
  }

  async function switchCamera(nextDeviceId: string) {
    setSelectedCameraId(nextDeviceId);
    if (!cameraReady) {
      return;
    }

    setMessage("Switching camera while preserving the active batch...");
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    setCameraReady(false);
    await updateSettings({ scannerDefaultCameraId: nextDeviceId });
    await requestCamera(nextDeviceId);
  }

  async function toggleTorch() {
    const nextTorch = !torchOn;
    const applied = await applyTorchToStream(streamRef.current, nextTorch).catch(() => false);
    if (applied) {
      setTorchOn(nextTorch);
      setMessage(nextTorch ? "Torch enabled." : "Torch disabled.");
    } else {
      setMessage("Torch is not supported by this camera.");
    }
  }

  async function updateZoom(nextZoom: number) {
    const applied = await applyZoomToStream(streamRef.current, nextZoom).catch(() => false);
    if (applied) {
      setZoomValue(nextZoom);
    }
  }

  async function simulateScan(status: ScanRecord["status"] = "assumed", confidence = 0.82) {
    const activeBatch = await getOrCreateBatch();
    const card = getSimulatedScanCard(scanIndex);
    const record = createScanRecordFromCard({
      batchId: activeBatch.id,
      card,
      status,
      confidence,
      destination,
    });
    await addScanRecord(record);
    setScanIndex((current) => current + 1);
    await refreshRecords(activeBatch.id);
    setMessage(`${card.name} added to batch as ${status.replace("_", " ")}.`);
  }

  const queueRecognizedScan = useCallback(async (
    frameAnalysis: FrameAnalysis,
    targetGeometry?: { x: number; y: number; width: number; height: number },
  ) => {
    const video = videoRef.current;
    const captureCanvas = captureCanvasRef.current;
    const captureContext = captureCanvas?.getContext("2d", {
      alpha: false,
      willReadFrequently: false,
    });
    if (!video || !captureCanvas || !captureContext) {
      return;
    }

    if (
      shouldSuppressDuplicateScan({
        currentFingerprint: frameAnalysis.fingerprint,
        lastAcceptedFingerprint: lastAcceptedFingerprintRef.current,
        transitionStarted: stackingTransitionRef.current,
      })
    ) {
      if (lastFeedbackRef.current !== "Duplicate frame ignored.") {
        lastFeedbackRef.current = "Duplicate frame ignored.";
        setMessage("Duplicate frame ignored. Move to the next card or trigger the next stacking cue.");
      }
      return;
    }

    if (recognizingRef.current) {
      return;
    }
    recognizingRef.current = true;
    const activeBatch = await getOrCreateBatch().catch(() => undefined);
    if (!activeBatch) {
      recognizingRef.current = false;
      setLoopState("error");
      setMessage("The scan batch could not be prepared. Existing work remains safe.");
      return;
    }
    const target = lifecycle.acquireTarget(frameAnalysis.fingerprint);
    const ownership = lifecycle.createOwnership(activeBatch.id, frameAnalysis.fingerprint);
    recordScannerTransition({
      scanSessionId: ownership.scanSessionId,
      state: "TARGET_STABILIZING",
      requestedState: "CAPTURING",
      accepted: true,
      reason: frameAnalysis.stable ? "STABLE_FRAME" : "ACCEPTABLE_FRAME_BUDGET_REACHED",
      timestamp: frameAnalysis.timestamp,
      batchId: activeBatch.id,
      targetId: ownership.targetId,
      captureGeneration: ownership.captureGeneration,
      frameId: ownership.frameId,
      targetAgeMs: Math.max(0, frameAnalysis.timestamp - target.acquiredAt),
      detectionConfidence: frameAnalysis.boundaryConfidence,
      geometryConfidence: frameAnalysis.boundaryConfidence,
      stabilityMs: frameAnalysis.stableForMs,
      qualityClass: frameAnalysis.qualityClass,
      cardCoverage: frameAnalysis.candidateCoverage,
      tooClose: frameAnalysis.tooClose,
      bestFrameAvailable: frameAnalysis.usableForRecognition,
      recognitionJobState: "queued",
      terminalBudgetMs: scannerRecognitionBudgetMs,
    });
    setLoopState("capturing");
    const captureWidth = 520;
    const captureHeight = 728;
    captureCanvas.width = captureWidth;
    captureCanvas.height = captureHeight;
    drawVisibleGuideToCanvas(video, captureCanvas);
    const preparation = prepareScannerRecognition(captureCanvas, frameAnalysis);
    const recognitionCanvas = preparation?.recognitionCanvas ?? captureCanvas;
    const enhancedCanvas = preparation?.enhancedCanvas;

    const controller = new AbortController();
    abortRecognitionRef.current = controller;
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      setLoopState("resolving");
      const result = await Promise.race([
          recognizeScannerFrame({
            canvas: recognitionCanvas,
            enhancedCanvas,
            analysis: frameAnalysis,
            destination: destinationRef.current,
            saveThumbnail: settings.scannerStoreCorrectionThumbnails,
            setLock: setLockRef.current || undefined,
            language: languageRef.current === "any" ? undefined : languageRef.current,
            signal: controller.signal,
          }),
        new Promise<ReturnType<typeof createUnresolvedScannerResult>>((resolve) => {
          budgetTimer = setTimeout(() => {
            controller.abort();
            recordScannerTransition({
              scanSessionId: ownership.scanSessionId,
              state: "MATCHING_CARD",
              requestedState: "CAPTURE_COMMITTING",
              accepted: true,
              reason: "TERMINAL_DECISION_NOT_REACHED",
              timestamp: performance.now(),
              batchId: activeBatch.id,
              targetId: ownership.targetId,
              captureGeneration: ownership.captureGeneration,
              frameId: ownership.frameId,
              targetAgeMs: Math.max(0, performance.now() - target.acquiredAt),
              detectionConfidence: frameAnalysis.boundaryConfidence,
              geometryConfidence: frameAnalysis.boundaryConfidence,
              stabilityMs: frameAnalysis.stableForMs,
              qualityClass: frameAnalysis.qualityClass,
              cardCoverage: frameAnalysis.candidateCoverage,
              tooClose: frameAnalysis.tooClose,
              bestFrameAvailable: frameAnalysis.usableForRecognition,
              recognitionJobState: "budget_exhausted",
              terminalBudgetMs: scannerRecognitionBudgetMs,
            });
            resolve(createUnresolvedScannerResult({
              analysis: frameAnalysis,
              destination: destinationRef.current,
              capturedThumbnail: settings.scannerStoreCorrectionThumbnails
                ? recognitionCanvas.toDataURL("image/jpeg", 0.45)
                : undefined,
            }));
          }, scannerRecognitionBudgetMs);
        }),
      ]);
      if (budgetTimer) clearTimeout(budgetTimer);
      recordScannerTrace({
        ...ownershipToTrace(ownership),
        videoIntrinsic: { width: video.videoWidth, height: video.videoHeight },
        videoDisplay: { width: video.clientWidth, height: video.clientHeight },
        frame: frameAnalysis,
        pipelineStages: preparation?.stages ? [...preparation.stages] : undefined,
        finalCardIdentity: result.scryfallId,
        finalPrintingIdentity: result.printingId,
        cardIdentityConfidence: result.confidence,
        printingIdentityConfidence: result.printingConfidence,
      });
      if (!lifecycle.isCurrent(ownership) || target.targetId !== lifecycle.currentTarget()?.targetId) {
        return;
      }
      const record = createScanRecordFromResolvedCard({
        batchId: activeBatch.id,
        result,
        capture: {
          scanSessionId: ownership.scanSessionId,
          targetId: ownership.targetId,
          captureGeneration: ownership.captureGeneration,
        },
      });
      if (!lifecycle.isCurrent(ownership)) return;
      await addScanRecord(record);
      recordScannerTransition({
        scanSessionId: ownership.scanSessionId,
        state: "CAPTURE_COMMITTING",
        requestedState: "CAPTURED",
        accepted: true,
        reason: "DURABLE_BATCH_INSERT",
        timestamp: performance.now(),
        batchId: activeBatch.id,
        targetId: ownership.targetId,
        captureGeneration: ownership.captureGeneration,
        frameId: ownership.frameId,
        targetAgeMs: Math.max(0, frameAnalysis.timestamp - target.acquiredAt),
        detectionConfidence: frameAnalysis.boundaryConfidence,
        geometryConfidence: frameAnalysis.boundaryConfidence,
        stabilityMs: frameAnalysis.stableForMs,
        qualityClass: frameAnalysis.qualityClass,
        cardCoverage: frameAnalysis.candidateCoverage,
        tooClose: frameAnalysis.tooClose,
        bestFrameAvailable: frameAnalysis.usableForRecognition,
        recognitionJobState: "terminal",
        terminalBudgetMs: scannerRecognitionBudgetMs,
      });
      recordScannerTrace({
        ...ownershipToTrace(ownership),
        videoIntrinsic: { width: video.videoWidth, height: video.videoHeight },
        videoDisplay: { width: video.clientWidth, height: video.clientHeight },
        frame: frameAnalysis,
        pipelineStages: preparation?.stages ? [...preparation.stages] : undefined,
        finalCardIdentity: result.scryfallId,
        finalPrintingIdentity: result.printingId,
        cardIdentityConfidence: result.confidence,
        printingIdentityConfidence: result.printingConfidence,
        batchEntryId: record.id,
      });
      lifecycle.commitCapture(ownership, {
        fingerprint: frameAnalysis.fingerprint,
        candidate: targetGeometry,
      });
      lastAcceptedFingerprintRef.current = frameAnalysis.fingerprint;
      stackingTransitionRef.current = false;
      setLoopState("success_feedback");
      await updateScanBatch(activeBatch.id, {
        lastAcceptedFingerprint: frameAnalysis.fingerprint,
        lastAcceptedAt: new Date().toISOString(),
        feederState:
          modeRef.current === "stacking_feeder"
            ? "waiting_for_next_transition"
            : modeRef.current === "automatic_feeder"
              ? "waiting_for_removal"
              : "monitoring_for_next_target",
      }).catch(() => undefined);
      await refreshRecords(activeBatch.id).catch(() => undefined);
      await feedbackControllerRef.current.playAccepted({
        captureId: record.captureId ?? record.id,
        soundEnabled: settings.scannerConfirmationSound,
        volume: settings.scannerConfirmationVolume,
        hapticEnabled: settings.scannerHapticConfirmation,
      });
      window.dispatchEvent(new CustomEvent("deck-nexus:scan-record-queued", {
        detail: { recordId: record.id, name: record.name, status: record.status },
      }));
      setMessage(`${record.name} captured. ${record.identityStatus === "verified" ? "Card verified." : "Review needed before committing."}`);
      if (modeRef.current === "automatic_feeder") {
        setAutomaticState("wait_for_card_removal");
      }
      if (modeRef.current === "stacking_feeder") {
        setStackingState("wait_for_next_too_close_cue");
      }
      manualScannerMessageRef.current = false;
      setLoopState("monitoring");
    } catch (error) {
      if (!controller.signal.aborted) {
        setLoopState("error");
        setMessage(error instanceof Error ? error.message : "Scanner recognition failed. Batch remains saved.");
      }
    } finally {
      if (budgetTimer) clearTimeout(budgetTimer);
      recognizingRef.current = false;
      abortRecognitionRef.current = null;
    }
  }, [
    getOrCreateBatch,
    refreshRecords,
    settings.scannerConfirmationSound,
    settings.scannerConfirmationVolume,
    settings.scannerHapticConfirmation,
    settings.scannerStoreCorrectionThumbnails,
  ]);

  const processFrame = useCallback(
    async (timestamp: number) => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (
        !video ||
        !canvas ||
        !cameraReadyRef.current ||
        scannerPausedRef.current ||
        reviewOpenRef.current
      ) {
        return;
      }

      const size = analysisSizeFor(settings.scannerPreviewQuality);
      const nextAnalysis = analyzeVideoFrame({
        video,
        canvas,
        memory: frameMemoryRef.current,
        cropToGuide: true,
        options: {
          stableDurationMs: settings.scannerStableFrameDurationMs,
          timestamp,
          width: size.width,
          height: size.height,
        },
      });
      if (!nextAnalysis) {
        if (lifecycle.observeAbsent()) {
          lastAcceptedFingerprintRef.current = undefined;
          stackingTransitionRef.current = false;
          setMessage("Ready for the next card.");
        }
        return;
      }

      if (!nextAnalysis.candidateVisible) {
        if (lifecycle.observeAbsent()) {
          lastAcceptedFingerprintRef.current = undefined;
          stackingTransitionRef.current = false;
          setMessage("Ready for the next card.");
        }
        setAnalysis(nextAnalysis);
        return;
      }

      const previousTargetId = lifecycle.currentTarget()?.targetId;
      const targetGeometry = nextAnalysis.candidate
        ? {
            x: nextAnalysis.candidate.x / size.width,
            y: nextAnalysis.candidate.y / size.height,
            width: nextAnalysis.candidate.width / size.width,
            height: nextAnalysis.candidate.height / size.height,
          }
        : undefined;
      const nextTarget = lifecycle.acquireTarget(
        nextAnalysis.fingerprint,
        timestamp,
        targetGeometry,
        { tooClose: nextAnalysis.tooClose },
      );
      const newTargetDetected = Boolean(previousTargetId && nextTarget.targetId !== previousTargetId);
      if (newTargetDetected) {
        recordScannerTransition({
          scanSessionId: "scan-session",
          state: "POSSIBLE_NEW_TARGET",
          requestedState: "TARGET_DETECTED",
          accepted: true,
          reason: "NEW_PHYSICAL_TARGET_GENERATION",
          timestamp,
          targetId: nextTarget.targetId,
          captureGeneration: nextTarget.generation,
          targetAgeMs: 0,
          detectionConfidence: nextAnalysis.boundaryConfidence,
          geometryConfidence: nextAnalysis.boundaryConfidence,
          stabilityMs: nextAnalysis.stableForMs,
          qualityClass: nextAnalysis.qualityClass,
          cardCoverage: nextAnalysis.candidateCoverage,
          tooClose: nextAnalysis.tooClose,
          bestFrameAvailable: nextAnalysis.usableForRecognition,
          recognitionJobState: "not_started",
          terminalBudgetMs: scannerRecognitionBudgetMs,
        });
        frameMemoryRef.current = {};
        lastAcceptedFingerprintRef.current = undefined;
        stackingTransitionRef.current = false;
        setLoopState("possible_new_target");
        if (!manualScannerMessageRef.current) {
          setMessage("New card detected. Reading the next physical target.");
        }
        // The first changed frame establishes ownership; it must not be
        // discarded as a dead-end transition. Handheld and feeder cards can
        // enter without an empty frame, so continue through the normal
        // acquisition/quality budget immediately. The next frame uses the
        // reset memory for stability measurements.
      }

      const targetAgeMs = Math.max(0, timestamp - nextTarget.acquiredAt);
      const fallbackReady = shouldUseRecognitionFallback({
        analysis: nextAnalysis,
        targetAgeMs,
        stableDurationMs: settings.scannerStableFrameDurationMs,
      });
      if (!nextAnalysis.usableForRecognition) {
        recordScannerTransition({
          scanSessionId: "scan-session",
          state: "TARGET_DETECTED",
          requestedState: "TARGET_STABILIZING",
          accepted: false,
          reason: !nextAnalysis.candidateVisible
            ? "TARGET_REJECTED_INCOMPLETE_GEOMETRY"
            : nextAnalysis.sharpness <= 0.13
              ? "TARGET_REJECTED_LOW_SHARPNESS"
              : nextAnalysis.glare >= 0.98
                ? "TARGET_REJECTED_GLARE"
                : "TARGET_REJECTED_INSUFFICIENT_COVERAGE",
          timestamp,
          targetId: nextTarget.targetId,
          captureGeneration: nextTarget.generation,
          targetAgeMs,
          detectionConfidence: nextAnalysis.boundaryConfidence,
          geometryConfidence: nextAnalysis.boundaryConfidence,
          stabilityMs: nextAnalysis.stableForMs,
          qualityClass: nextAnalysis.qualityClass,
          cardCoverage: nextAnalysis.candidateCoverage,
          tooClose: nextAnalysis.tooClose,
          bestFrameAvailable: false,
        });
      } else if (!nextAnalysis.stable && !fallbackReady) {
        recordScannerTransition({
          scanSessionId: "scan-session",
          state: "TARGET_DETECTED",
          requestedState: "TARGET_STABILIZING",
          accepted: true,
          reason: "WAITING_FOR_STABILITY_OR_EVIDENCE_BUDGET",
          timestamp,
          targetId: nextTarget.targetId,
          captureGeneration: nextTarget.generation,
          targetAgeMs,
          detectionConfidence: nextAnalysis.boundaryConfidence,
          geometryConfidence: nextAnalysis.boundaryConfidence,
          stabilityMs: nextAnalysis.stableForMs,
          qualityClass: nextAnalysis.qualityClass,
          cardCoverage: nextAnalysis.candidateCoverage,
          tooClose: nextAnalysis.tooClose,
          bestFrameAvailable: true,
          terminalBudgetMs: scannerRecognitionBudgetMs,
        });
      }

      setAnalysis(nextAnalysis);
      const nextFeedback = nextAnalysis.feedback;
      if (nextFeedback !== lastFeedbackRef.current) {
        lastFeedbackRef.current = nextFeedback;
        if (!manualScannerMessageRef.current) {
          setMessage(nextFeedback);
        }
      }

      if (modeRef.current === "stacking_feeder") {
        // Large card coverage is guidance, not a hard rejection. Only pause
        // for a tray obstruction when the close frame is actually unusable
        // (clipped or lacking enough readable structure).
        const closeFrameBlocksRecognition = nextAnalysis.tooClose &&
          (!nextAnalysis.usableForRecognition || nextAnalysis.clipped);
        if (closeFrameBlocksRecognition) {
          tooCloseStartedAtRef.current ??= timestamp;
          const elapsed = timestamp - tooCloseStartedAtRef.current;
          setTooCloseDuration(elapsed);
          setStackingState("new_card_arrival_cue");
          stackingTransitionRef.current = true;
          if (elapsed >= settings.scannerTrayFullTimeoutMs) {
            const activeBatch = await getOrCreateBatch();
            const warning = "Tray may be full. Empty the catch tray, then resume scanning.";
            await updateScanBatch(activeBatch.id, {
              status: "paused",
              prompt: warning,
              feederState: "paused_for_tray_empty",
              lastCue: "too_close_timeout",
            });
            setBatch(await getScanBatch(activeBatch.id) ?? activeBatch);
            setScannerPaused(true);
            setLoopState("paused");
            setStackingState("paused_tray_full");
            setMessage(warning);
          }
          return;
        }

        if (tooCloseStartedAtRef.current) {
          tooCloseStartedAtRef.current = undefined;
          setTooCloseDuration(0);
          setStackingState("wait_for_stabilization");
          setMessage("Too-close cue accepted. Waiting for the newest top card to stabilize.");
        }
      }

      if (nextAnalysis.stable) {
        setLoopState("stabilizing");
        const mayCaptureStacking = modeRef.current !== "stacking_feeder" || !lifecycle.currentTarget()?.captureCommitted;
        if (mayCaptureStacking && !recognizingRef.current) {
          await queueRecognizedScan(nextAnalysis, targetGeometry);
        }
      } else if (fallbackReady && modeRef.current !== "stacking_feeder" && !recognizingRef.current) {
        setLoopState("stabilizing");
        await queueRecognizedScan(nextAnalysis, targetGeometry);
      } else if (!nextAnalysis.tooClose) {
        setLoopState("watching");
      }
    },
    [getOrCreateBatch, queueRecognizedScan, settings.scannerPreviewQuality, settings.scannerStableFrameDurationMs, settings.scannerTrayFullTimeoutMs],
  );

  useEffect(() => {
    if (!cameraReady || scannerPaused || reviewOpen) {
      if (loopFrameRef.current) {
        cancelAnimationFrame(loopFrameRef.current);
        loopFrameRef.current = undefined;
      }
      return;
    }

    const interval = sampleIntervalFor({
      previewQuality: settings.scannerPreviewQuality,
      performanceMode: settings.scannerPerformanceMode,
    });

    function tick(timestamp: number) {
      if (timestamp - lastAnalysisAtRef.current >= interval) {
        lastAnalysisAtRef.current = timestamp;
        void processFrame(timestamp);
      }
      loopFrameRef.current = requestAnimationFrame(tick);
    }

    loopFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (loopFrameRef.current) {
        cancelAnimationFrame(loopFrameRef.current);
        loopFrameRef.current = undefined;
      }
    };
  }, [
    cameraReady,
    processFrame,
    reviewOpen,
    scannerPaused,
    settings.scannerPerformanceMode,
    settings.scannerPreviewQuality,
  ]);

  async function runAutomaticCycle() {
    const cycle = nextAutomaticFeederCycle(automaticState, "stable");
    const nextState = cycle.automaticState ?? "idle";
    setAutomaticState(nextState);
    if (cycle.warning) {
      setMessage(cycle.warning);
    } else {
      setMessage(`Automatic feeder: ${nextState.replaceAll("_", " ")}.`);
    }
    if (cycle.shouldCapture) {
      await simulateScan("assumed", 0.84);
    }
  }

  async function runStackingCue() {
    const cycle = nextStackingFeederCycle({
      current: stackingState,
      cue: "too_close",
      tooCloseDurationMs: tooCloseDuration,
    });
    setStackingState(cycle.stackingState ?? "idle_watching_tray");
    setTooCloseDuration((current) => current + 900);
    stackingTransitionRef.current = true;
    manualScannerMessageRef.current = true;
    setMessage("Too-close cue detected. New card arrival registered for stacking feeder mode.");
  }

  async function runStackingStabilize() {
    const cycle = nextStackingFeederCycle({
      current: stackingState,
      cue: "stable",
      tooCloseDurationMs: 0,
    });
    setStackingState(cycle.stackingState ?? "idle_watching_tray");
    setTooCloseDuration(0);
    manualScannerMessageRef.current = false;
    setMessage(`Stacking feeder: ${(cycle.stackingState ?? "").replaceAll("_", " ")}.`);
    if (cycle.shouldCapture) {
      await simulateScan("assumed", 0.78);
    }
  }

  async function triggerTrayFull() {
    const cycle = nextStackingFeederCycle({
      current: stackingState,
      cue: "timeout",
      tooCloseDurationMs: settings.scannerTrayFullTimeoutMs + 1,
    });
    const activeBatch = await getOrCreateBatch();
    const updated = await updateScanBatch(activeBatch.id, {
      status: "paused",
      prompt: cycle.warning,
      feederState: "paused_for_tray_empty",
    });
    setBatch(updated);
    setScannerPaused(true);
    setStackingState("paused_tray_full");
    setMessage(cycle.warning ?? "Tray may be full. Empty the catch tray, then resume scanning.");
  }

  async function confirmAllHighConfidence() {
    for (const record of records.filter((candidate) => candidate.status !== "removed" && (candidate.identityStatus === "verified" || candidate.status === "matched"))) {
      await updateScanRecord(record.id, { status: "confirmed" });
    }
    if (batch) {
      await updateScanBatch(batch.id, { status: "reviewing" });
      await refreshRecords(batch.id);
    }
    setMessage("All high-confidence records confirmed for review.");
  }

  async function applyToOwned() {
    if (!batch) {
      return;
    }

    const count = await applyScanBatchToOwned(batch.id);
    await refreshRecords(batch.id);
    setBatch(await updateScanBatch(batch.id, { status: "applied" }));
    setMessage(`${count} scan records applied to Owned Cards.`);
  }

  async function applyToDeck(destinationOverride: "main" | "maybeboard" | "cuts") {
    if (!deck || !batch) {
      setMessage("Choose a deck before applying scanner records to a deck.");
      return;
    }

    let applied = 0;
    for (const record of records.filter((candidate) => candidate.status !== "applied" && candidate.status !== "removed" && (candidate.status === "confirmed" || candidate.identityStatus === "verified" || (candidate.status === "matched" && !candidate.identityStatus)))) {
      const input = catalogCardToManualInput({
        card: {
          id: record.scryfallId ?? record.id,
          scryfallId: record.scryfallId ?? record.id,
          oracleId: record.oracleId ?? record.id,
          name: record.name,
          manaCost: undefined,
          manaValue: 0,
          typeLine: record.typeLine ?? "Creature",
          oracleText: record.rawText,
          colorIdentity: record.colorIdentity ?? [],
          keywords: [],
          roles: ["scanner"],
          commanderLegal: true,
          banned: false,
          bracketImpact: 0,
        },
        destination: destinationOverride,
        requestedSection:
          sectionId === "creatures" ||
          sectionId === "instants" ||
          sectionId === "sorceries" ||
          sectionId === "artifacts" ||
          sectionId === "enchantments" ||
          sectionId === "otherPermanents" ||
          sectionId === "lands"
            ? sectionId
            : undefined,
      });
      const pricedInput = {
        ...input,
        prices: record.prices,
        priceUpdatedAt: record.priceUpdatedAt ?? record.prices?.fetchedAt,
        finish: record.finish,
        language: record.language,
        condition: record.condition,
        setCode: record.setCode,
        setName: record.setName,
        collectorNumber: record.collectorNumber,
        rarity: record.rarity,
      };
      const ruleResult = evaluateAddCardRules({ deck, input, mode: "guided" });
      if (destinationOverride === "main" && ruleResult.warnings.some((warning) => warning.severity === "illegal")) {
        await addDeckCard(deck.id, { ...pricedInput, destination: "maybeboard" }, "maybeboard");
      } else {
        await addDeckCard(deck.id, pricedInput, destinationOverride);
      }
      await updateScanRecord(record.id, { status: "applied" });
      applied += 1;
    }

    await updateScanBatch(batch.id, {
      status: "partially_applied",
      destination: destinationOverride === "main" ? "main_deck" : destinationOverride,
    });
    await refreshRecords(batch.id);
    setMessage(`${applied} records applied to ${destinationOverride}. Illegal main-deck cards were routed to Maybeboard.`);
  }

  async function saveForLater() {
    if (!batch) {
      return;
    }

    const saved = await updateScanBatch(batch.id, { status: "saved_for_later" });
    setBatch(saved);
    setMessage("Batch saved for later. It will be recovered when scanner opens again.");
  }

  async function openReview() {
    abortRecognitionRef.current?.abort();
    lifecycle.invalidateTarget();
    frameMemoryRef.current = {};
    setLoopState("paused");
    setReviewOpen(true);
    if (batchRef.current?.status === "scanning") {
      const reviewing = await updateScanBatch(batchRef.current.id, { status: "reviewing" });
      batchRef.current = reviewing;
      setBatch(reviewing);
    }
  }

  async function closeReview() {
    setReviewOpen(false);
    if (batchRef.current?.status === "reviewing") {
      const resumed = await updateScanBatch(batchRef.current.id, { status: "scanning" });
      batchRef.current = resumed;
      setBatch(resumed);
    }
    setLoopState(cameraReadyRef.current ? "monitoring" : "idle");
  }

  async function toggleScannerPause() {
    const nextPaused = !scannerPausedRef.current;
    if (nextPaused) {
      abortRecognitionRef.current?.abort();
      lifecycle.invalidateTarget();
      frameMemoryRef.current = {};
      setScannerPaused(true);
      setLoopState("paused");
      setMessage("Scanning paused. The current batch remains saved.");
      if (batchRef.current) {
        const paused = await updateScanBatch(batchRef.current.id, { status: "paused" });
        batchRef.current = paused;
        setBatch(paused);
      }
      return;
    }

    setScannerPaused(false);
    setLoopState("monitoring");
    setMessage("Scanning resumed. Looking for the next physical card.");
    if (batchRef.current?.status === "paused") {
      const resumed = await updateScanBatch(batchRef.current.id, { status: "scanning", prompt: undefined });
      batchRef.current = resumed;
      setBatch(resumed);
    }
  }

  async function discardBatch() {
    if (!batch) {
      return;
    }

    const discarded = await updateScanBatch(batch.id, { status: "discarded" });
    setBatch(discarded);
    setRecords([]);
    setMessage("Batch discarded by user.");
  }

  async function emptyTrayDone() {
    if (batch) {
      setBatch(await updateScanBatch(batch.id, {
        status: "scanning",
        prompt: undefined,
        feederState: "baseline_reset",
        lastCue: "empty_tray_done",
      }));
    }
    frameMemoryRef.current = {};
    tooCloseStartedAtRef.current = undefined;
    stackingTransitionRef.current = false;
    setTooCloseDuration(0);
    setStackingState("idle_watching_tray");
    setScannerPaused(false);
    setMessage("Tray baseline reset. Waiting for the next too-close cue.");
  }

  const activeCameraCopy =
    cameraStatus.state === "denied" ||
    cameraStatus.state === "no_device" ||
    cameraStatus.state === "device_busy" ||
    cameraStatus.state === "stream_error" ||
    cameraStatus.state === "insecure_context"
      ? cameraStatus
      : {
          state: cameraStatus.state,
          title: "Deck Nexus needs camera access to scan your cards.",
          detail:
            "Video stays on this device. Card lookup and pricing refreshes run separately after a card is recognized.",
          action: "Allow Camera",
        };

  return (
    <section className="screen feature-screen scanner-screen">
      <PageHeader title="Scan Cards">
        <StatusPill tone={cameraReady ? "amber" : "cyan"}>
          {cameraReady ? "Camera Live" : "Permission Required"}
        </StatusPill>
        <StatusPill tone="violet">{summary.total} in batch</StatusPill>
      </PageHeader>

      {showRecovery && batch ? (
        <HolographicPanel className="scanner-recovery">
          <ShieldAlert aria-hidden="true" />
          <div>
            <h2>Unfinished scan batch found</h2>
            <p>Resume scanning, review batch, save for later, or discard.</p>
          </div>
          <button type="button" onClick={() => setShowRecovery(false)}>
            Resume
          </button>
          <button type="button" onClick={() => void openReview()}>
            Review
          </button>
          <button type="button" onClick={saveForLater}>
            Save for Later
          </button>
          <button type="button" onClick={discardBatch}>
            Discard
          </button>
        </HolographicPanel>
      ) : null}

      {!cameraReady ? (
        <HolographicPanel className="scanner-permission-panel">
          <Camera aria-hidden="true" />
          <div>
            <h2>{activeCameraCopy.title}</h2>
            <p>{activeCameraCopy.detail}</p>
            <small>No microphone permission is requested. Card lookup and pricing refreshes run separately from the camera stream.</small>
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => void requestCamera()}>
              <Video aria-hidden="true" /> {activeCameraCopy.action}
            </button>
            {activeCameraCopy.state === "insecure_context" ? (
              <a href="https://haroldh1995.github.io/Deck-Nexus/scan">
                Open Live Secure App
              </a>
            ) : null}
            <button type="button" onClick={() => void startBatch()}>
              Manual Entry Instead
            </button>
            <button type="button" onClick={() => navigate("/")}>
              Cancel
            </button>
          </div>
        </HolographicPanel>
      ) : null}

      {cameraReady ? (
      <div className="scanner-layout">
        <HolographicPanel className="scanner-preview">
          <div
            className={`scanner-frame${cameraReady ? " scanner-frame--live" : ""}${analysis?.tooClose ? " scanner-frame--too-close" : ""}`}
            aria-label="Live scanner camera preview"
          >
            <video
              aria-label="Live camera preview"
              autoPlay
              className="scanner-video"
              muted
              playsInline
              ref={videoRef}
            />
            {!cameraReady ? (
              <div className="scanner-frame__empty">
                <VideoOff aria-hidden="true" />
                <strong>Camera preview waiting</strong>
                <small>Tap Allow Camera to open the live camera stream.</small>
              </div>
            ) : null}
            <span className="scanner-frame__corner scanner-frame__corner--one" />
            <span className="scanner-frame__corner scanner-frame__corner--two" />
            <span className="scanner-frame__corner scanner-frame__corner--three" />
            <span className="scanner-frame__corner scanner-frame__corner--four" />
            <div className="scanner-frame__guide" aria-hidden="true" />
            <div className="scanner-frame__hud">
              <strong>{mode === "stacking_feeder" ? "Stacking tray watch" : "Live card scanner"}</strong>
              <span>{loopState.replaceAll("_", " ")}</span>
              <span>{analysis?.candidateVisible ? "Card detected" : "Looking for card"}</span>
            </div>
          </div>
          <canvas aria-hidden="true" className="scanner-analysis-canvas" ref={analysisCanvasRef} />
          <canvas aria-hidden="true" className="scanner-analysis-canvas" ref={captureCanvasRef} />
          <div className="scanner-guidance" role="note">
            <span>Place cards inside the scan area. Deck Nexus captures recognized cards automatically.</span>
            <details>
              <summary>Scan tips</summary>
              <div>
                {frameGuidanceText.map((text) => (
                  <span key={text}>{text}</span>
                ))}
              </div>
            </details>
          </div>
        </HolographicPanel>

        <HolographicPanel className="scanner-controls-panel">
          <div className="scanner-top-controls" aria-label="Scanner camera controls">
            <button
              type="button"
              onClick={() => void updateSettings({ scannerConfirmationSound: !settings.scannerConfirmationSound })}
              aria-label={
                settings.scannerConfirmationSound
                  ? "Mute scan confirmation sound"
                  : "Enable scan confirmation sound"
              }
              title={settings.scannerConfirmationSound ? "Mute scan confirmation sound" : "Enable scan confirmation sound"}
            >
              {settings.scannerConfirmationSound ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => void requestCamera()}>
              <RefreshCw aria-hidden="true" /> Refresh Camera
            </button>
            {capabilities.torchSupported ? (
              <button type="button" onClick={() => void toggleTorch()} aria-pressed={torchOn}>
                <Flashlight aria-hidden="true" /> {torchOn ? "Torch On" : "Torch Off"}
              </button>
            ) : null}
          </div>

          <div className="feature-status" role="status">
            <ScanLine aria-hidden="true" />
            <span>{message}</span>
          </div>

          <div className="scanner-actions">
            <button
              type="button"
              onClick={() => void toggleScannerPause()}
            >
              {scannerPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              {scannerPaused ? "Resume" : "Pause"}
            </button>
            <button type="button" ref={lastReviewTriggerRef} onClick={() => void openReview()}>
              Review Batch
            </button>
          </div>

          <details className="scanner-mode-panel">
            <summary>Manual fallback and feeder controls</summary>
            <div className="feature-controls scanner-setup-controls">
              <p className="scanner-session-note">Automatic handheld scanning is ready when the camera is live. Start Batch is optional and only prepares an explicit feeder/session batch.</p>
              <button type="button" onClick={() => void startBatch()}>
                <Play aria-hidden="true" /> Start Batch
              </button>
              <label>
                Scanner mode
                <select
                  value={mode}
                  onChange={(event) => {
                    const nextMode = event.target.value as ScannerMode;
                    setMode(nextMode);
                    void updateSettings({ scannerDefaultMode: nextMode });
                  }}
                >
                  {scannerModes.map((scannerMode) => (
                    <option key={scannerMode.id} value={scannerMode.id}>
                      {scannerMode.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Batch destination
                <select
                  value={destination}
                  onChange={(event) => setDestination(event.target.value as ScanBatchDestination)}
                >
                  {scannerDestinations.map((scannerDestination) => (
                    <option key={scannerDestination.id} value={scannerDestination.id}>
                      {scannerDestination.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Set lock (optional)
                <input
                  inputMode="text"
                  maxLength={8}
                  placeholder="Any set, e.g. UDS"
                  value={setLock}
                  onChange={(event) => setSetLock(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 8))}
                />
              </label>
              <label>
                Card language
                <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option value="any">Any language</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                  <option value="it">Italian</option>
                  <option value="ko">Korean</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="zhs">Simplified Chinese</option>
                  <option value="zht">Traditional Chinese</option>
                </select>
              </label>
              <label>
                Active deck
                <select value={deckId} onChange={(event) => setDeckId(event.target.value)}>
                  <option value="">No deck selected</option>
                  {decks.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
              {cameraDevices.length > 1 ? (
                <label>
                  Camera
                  <select
                    value={selectedCameraId}
                    onChange={(event) => void switchCamera(event.target.value)}
                  >
                    {cameraDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {capabilities.zoom ? (
                <label>
                  Camera zoom
                  <input
                    type="range"
                    min={capabilities.zoom.min}
                    max={capabilities.zoom.max}
                    step={capabilities.zoom.step}
                    value={zoomValue}
                    onChange={(event) => void updateZoom(Number(event.target.value))}
                  />
                </label>
              ) : null}
            </div>
            {import.meta.env.DEV ? (
              <div className="scanner-actions" data-testid="scanner-development-controls">
                <button type="button" onClick={() => void simulateScan("assumed", 0.82)}>
                  Simulate Scan
                </button>
                <button type="button" onClick={() => void simulateScan("low_confidence", 0.48)}>
                  Low Confidence Scan
                </button>
              </div>
            ) : null}
            {mode === "automatic_feeder" ? (
              <div className="scanner-feeder-controls">
                <h2>Automatic Feeder Loop</h2>
                <p>Idle to entering to stable to capture to resolve to queue to wait for removal to ready.</p>
                <button type="button" onClick={runAutomaticCycle}>
                  Advance Feeder Cycle
                </button>
                <span>{automaticState.replaceAll("_", " ")}</span>
              </div>
            ) : null}
            {mode === "stacking_feeder" ? (
              <div className="scanner-feeder-controls">
                <h2>Stacking Feeder Loop</h2>
                <p>Too-close distortion is the new-card cue. Removal detection is not required.</p>
                <button type="button" onClick={runStackingCue}>
                  Too-Close Cue
                </button>
                <button type="button" onClick={runStackingStabilize}>
                  Stabilize / Capture
                </button>
                <button type="button" onClick={triggerTrayFull}>
                  Trigger Tray Full Prompt
                </button>
                <span>{stackingState.replaceAll("_", " ")}</span>
              </div>
            ) : null}
          </details>
        </HolographicPanel>
      </div>
      ) : null}

      {records.length > 0 ? (
      <HolographicPanel className="scanner-batch-panel">
        <div className="scanner-batch-summary">
          <strong>{summary.total} records</strong>
          <span>{summary.confirmed} confirmed</span>
          <span>{summary.assumed} assumed</span>
          <span>{summary.lowConfidence} low confidence</span>
          <span>{summary.unresolved} unresolved</span>
          <span>{modeLabel(mode)}</span>
          <span>{destinationLabel(destination)}</span>
        </div>
        <div className="scanner-feedback-list">
          {scannerFeedbackStates.map((feedback) => (
            <span key={feedback}>{feedback}</span>
          ))}
        </div>
      </HolographicPanel>
      ) : null}

      {reviewOpen ? (
        <div className="builder-modal-backdrop scanner-review-backdrop" role="presentation">
          <div className="builder-modal scanner-review-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-review-title">
            <div className="builder-modal__header">
              <div>
                <h2 id="scanner-review-title">Batch Review</h2>
                <span className="scanner-review-count">{summary.total} captured</span>
              </div>
              <button type="button" onClick={() => void closeReview()} aria-label="Close batch review">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="scanner-review-summary" aria-live="polite">
              <span>{summary.confirmed} verified</span>
              <span>{records.filter((record) => record.printingStatus === "review_required").length} printing reviews</span>
              <span>{records.filter((record) => record.identityStatus === "review_required" || record.identityStatus === "ambiguous").length} card reviews</span>
              <span>{summary.unresolved} unresolved</span>
            </div>
            <div className="scanner-review-actions">
              <button type="button" onClick={confirmAllHighConfidence}>
                <CheckCircle2 aria-hidden="true" /> Confirm All High Confidence
              </button>
              <button type="button" onClick={() => setMessage("Assumed-only review filter active in batch review.")}>
                Review Assumed Only
              </button>
              <button type="button" onClick={applyToOwned}>
                Apply All Confirmed to Owned
              </button>
              <button type="button" onClick={() => applyToDeck("main")}>
                Apply to Main
              </button>
              <button type="button" onClick={() => applyToDeck("maybeboard")}>
                Apply to Maybeboard
              </button>
              <button type="button" onClick={saveForLater}>
                Save Unresolved for Later
              </button>
              <button type="button" onClick={discardBatch}>
                <Trash2 aria-hidden="true" /> Undo Batch
              </button>
            </div>
            <div className="scanner-record-list">
              {records.length === 0 ? (
                <p className="foundation-summary">No scan records in this batch yet.</p>
              ) : (
                records.map((record) => (
                  <article className={`scanner-record scanner-record--${record.identityStatus ?? record.status}`} key={record.id}>
                    {(record.imageUri ?? record.capturedThumbnail) ? (
                      <img src={record.imageUri ?? record.capturedThumbnail} alt={record.name} />
                    ) : null}
                      <div className="scanner-record__main">
                        <strong>{record.name}</strong>
                        <span>{identityLabel(record)}</span>
                        <span>{printingLabel(record)}</span>
                        <small>{record.typeLine ?? "Type pending"}</small>
                        {record.setCode || record.collectorNumber ? (
                          <small>{[record.setCode?.toUpperCase(), record.collectorNumber].filter(Boolean).join(" ")}</small>
                        ) : null}
                      </div>
                      <span className="badge">{record.identityStatus === "verified" ? "Verified" : record.identityStatus === "unresolved" ? "Unresolved" : "Review"}</span>
                    {record.identityStatus !== "unresolved" && record.status !== "unresolved" ? (
                      <button type="button" onClick={() => updateScanRecord(record.id, { status: "confirmed", identityStatus: "verified" }).then(() => refreshRecords(record.batchId))}>
                        Confirm Match
                      </button>
                    ) : null}
                    <button type="button" onClick={() => updateScanRecord(record.id, { status: "removed" }).then(() => refreshRecords(record.batchId))}>
                      Remove
                    </button>
                    {record.printingStatus === "review_required" ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/search?context=scanner&batchId=${record.batchId}&recordId=${record.id}&printingOnly=1&q=${encodeURIComponent(record.name)}`)}
                      >
                        Choose Printing
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/search?context=scanner&batchId=${record.batchId}&recordId=${record.id}&q=${encodeURIComponent(record.name)}`,
                        )
                      }
                    >
                      Correct with Search
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {batch?.prompt ? (
        <HolographicPanel className="scanner-tray-prompt">
          <ShieldAlert aria-hidden="true" />
          <p>{batch.prompt}</p>
          <button type="button" onClick={() => updateScanBatch(batch.id, { status: "scanning", prompt: undefined }).then(setBatch)}>
            Resume Scanning
          </button>
          <button type="button" onClick={emptyTrayDone}>
            <RotateCcw aria-hidden="true" /> Empty Tray Done
          </button>
          <button type="button" onClick={() => void openReview()}>
            Review Batch
          </button>
          <button type="button" onClick={saveForLater}>
            Stop Batch
          </button>
        </HolographicPanel>
      ) : null}
    </section>
  );
}
