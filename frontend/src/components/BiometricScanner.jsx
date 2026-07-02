import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "./BiometricScanner.css";

// emotion -> burnout weight mapping (higher = more burnout signal)
const EMOTION_WEIGHTS = {
  neutral: 0.2,
  happy: 0.0,
  surprised: 0.3,
  sad: 0.7,
  angry: 0.8,
  fearful: 0.75,
  disgusted: 0.6,
};

const EMOTION_LABELS = {
  neutral: "Neutral",
  happy: "Happy",
  surprised: "Surprised",
  sad: "Sad",
  angry: "Stressed",
  fearful: "Anxious",
  disgusted: "Frustrated",
};

const EMOTION_ICONS = {
  neutral: "😐",
  happy: "😊",
  surprised: "😮",
  sad: "😔",
  angry: "😤",
  fearful: "😰",
  disgusted: "😣",
};

const PHASES = {
  LOADING: "loading",
  READY: "ready",
  SCANNING: "scanning",
  DONE: "done",
  ERROR: "error",
};

const SCAN_DURATION_SECONDS = 10;
const FACE_SCAN_INTERVAL_MS = 200;
const VOICE_SAMPLE_INTERVAL_MS = 150;
const DEFAULT_ERROR_MESSAGE = "Couldn't access camera or load models.";
const FACE_BOX_COLOR = "#7c6af7";
const FACE_TEXT_COLOR = "#ffffff";
const FACE_TEXT_BG = "rgba(124, 106, 247, 0.85)";
const QUALITY_COLORS = {
  good: "#3ecf8e",
  fair: "#f5c842",
  poor: "#f06060",
};

let faceApiScriptPromise = null;
let faceApiModelsPromise = null;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const roundTo = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const smoothValue = (previous, next, alpha = 0.35) => {
  if (previous == null || Number.isNaN(previous)) return next;
  return previous + (next - previous) * alpha;
};

const normalizeExpressions = (expressions = {}) => {
  const entries = Object.entries(expressions);
  const total = entries.reduce((sum, [, value]) => sum + (value || 0), 0);

  if (!entries.length || total <= 0) {
    return {};
  }

  return Object.fromEntries(entries.map(([key, value]) => [key, (value || 0) / total]));
};

const getDominantEmotion = (expressions = {}) => {
  const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
  const [label, confidence] = sorted[0] || ["neutral", 0];
  return { label, confidence: confidence || 0 };
};

const getFatigueLevel = (score) => {
  if (score < 0.25) return { label: "Low", color: "#3ecf8e" };
  if (score < 0.55) return { label: "Moderate", color: "#f5c842" };
  return { label: "High", color: "#f06060" };
};

const getScanQualityLevel = (score) => {
  if (score >= 0.75) {
    return { label: "Good", color: QUALITY_COLORS.good };
  }
  if (score >= 0.45) {
    return { label: "Fair", color: QUALITY_COLORS.fair };
  }
  return { label: "Poor", color: QUALITY_COLORS.poor };
};

const buildAiRecommendation = ({
  fatigueLevel,
  dominantEmotion,
  moodScore,
  stressLevel,
  voiceStressPct,
  scanQualityLabel,
}) => {
  const emotionLabel = EMOTION_LABELS[dominantEmotion] || "Neutral";

  if (fatigueLevel === "High" || stressLevel >= 8) {
    return `High stress indicators detected with a ${emotionLabel.toLowerCase()} pattern and ${voiceStressPct}% voice stress. Prioritize a short break, hydration, and a lighter workload block before your next demanding task.`;
  }

  if (fatigueLevel === "Moderate" || stressLevel >= 5) {
    return `Moderate strain detected. Your mood score is ${moodScore}/5 with ${voiceStressPct}% voice stress. A 5-10 minute reset, slower breathing, and reducing context switching may help stabilize energy.`;
  }

  if (scanQualityLabel === "Poor") {
    return "Your indicators appear relatively stable, but scan quality was limited. For a more reliable result, retry in brighter light with your face centered and minimal background noise.";
  }

  return `Low stress pattern detected with a ${emotionLabel.toLowerCase()} emotional profile. You appear fairly stable right now - maintaining breaks, hydration, and consistent pacing should help keep it that way.`;
};

const getPermissionErrorMessage = (error) => {
  const name = error?.name || "";
  const message = error?.message || "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera or microphone permission was denied. Please allow access and try again.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera or microphone was found on this device.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Your camera or microphone is already in use by another application.";
  }

  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "Requested camera settings are not available on this device.";
  }

  if (name === "AbortError") {
    return "Camera or microphone startup was interrupted. Please try again.";
  }

  if (/microphone/i.test(message) && /camera/i.test(message)) {
    return "Camera and microphone are unavailable right now. Check device permissions and availability.";
  }

  if (/microphone/i.test(message)) {
    return "Microphone is unavailable right now. Check device permissions and availability.";
  }

  if (/camera|video/i.test(message)) {
    return "Camera is unavailable right now. Check device permissions and availability.";
  }

  return "Couldn't access camera or microphone. Check browser permissions and try again.";
};

const loadFaceApiScript = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is unavailable."));
  }

  if (window.faceapi) {
    return Promise.resolve(window.faceapi);
  }

  if (faceApiScriptPromise) {
    return faceApiScriptPromise;
  }

  faceApiScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-face-api-script="true"]');

    if (existingScript) {
      if (window.faceapi) {
        resolve(window.faceapi);
        return;
      }

      existingScript.addEventListener("load", () => resolve(window.faceapi), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load face detection library from CDN.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
    script.async = true;
    script.defer = true;
    script.dataset.faceApiScript = "true";

    script.onload = () => {
      if (window.faceapi) {
        resolve(window.faceapi);
      } else {
        reject(new Error("Face detection library loaded but was not available."));
      }
    };

    script.onerror = () => {
      reject(new Error("Failed to load face detection library from CDN."));
    };

    document.head.appendChild(script);
  });

  return faceApiScriptPromise;
};

const loadFaceApiModels = async (faceapi, onProgress) => {
  if (!faceapi) {
    throw new Error("Face detection library is unavailable.");
  }

  if (faceApiModelsPromise) {
    return faceApiModelsPromise;
  }

  faceApiModelsPromise = (async () => {
    onProgress?.(33, "Loading face detector model...");
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");

    onProgress?.(66, "Loading emotion model...");
    await faceapi.nets.faceExpressionNet.loadFromUri("/models");

    onProgress?.(100, "Preparing scanner...");
    return true;
  })();

  return faceApiModelsPromise;
};

const clearCanvas = (canvas) => {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const syncCanvasToVideo = (video, canvas) => {
  if (!video || !canvas) return false;

  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  return true;
};

const drawFaceOverlay = ({ canvas, detection, dominantEmotion, confidence }) => {
  if (!canvas || !detection) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  clearCanvas(canvas);

  const box = detection.detection?.box || detection.box;
  if (!box) return;

  const x = box.x;
  const y = box.y;
  const width = box.width;
  const height = box.height;

  ctx.strokeStyle = FACE_BOX_COLOR;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);

  const label = `${EMOTION_ICONS[dominantEmotion] || "😐"} ${
    EMOTION_LABELS[dominantEmotion] || dominantEmotion
  } ${Math.round(confidence * 100)}%`;

  ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
  const textWidth = ctx.measureText(label).width;
  const textHeight = 24;
  const textX = Math.max(0, x);
  const textY = Math.max(0, y - textHeight - 6);

  ctx.fillStyle = FACE_TEXT_BG;
  ctx.fillRect(textX, textY, textWidth + 16, textHeight);

  ctx.fillStyle = FACE_TEXT_COLOR;
  ctx.fillText(label, textX + 8, textY + 16);
};

export default function BiometricScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const voiceIntervalRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const isStartingRef = useRef(false);
  const isScanningRef = useRef(false);
  const isFinalizingRef = useRef(false);
  const detectionInFlightRef = useRef(false);
  const countdownRef = useRef(SCAN_DURATION_SECONDS);
  const voiceStressHistoryRef = useRef([]);
  const expressionFramesRef = useRef([]);
  const smoothVoiceStressRef = useRef(0);
  const smoothEmotionRef = useRef({});
  const faceQualitySamplesRef = useRef([]);
  const faceDetectionStatsRef = useRef({
    detectedFrames: 0,
    totalFrames: 0,
  });

  const [phase, setPhase] = useState(PHASES.LOADING);
  const [faceApiLib, setFaceApiLib] = useState(null);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [voiceStress, setVoiceStress] = useState(0);
  const [countdown, setCountdown] = useState(SCAN_DURATION_SECONDS);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState(DEFAULT_ERROR_MESSAGE);
  const [loadingProgress, setLoadingProgress] = useState(5);
  const [loadingLabel, setLoadingLabel] = useState("Loading face detection library...");
  const [scanQuality, setScanQuality] = useState({
    score: 0,
    label: "Waiting",
    color: QUALITY_COLORS.fair,
  });

  const stopAllTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (faceIntervalRef.current) {
      clearInterval(faceIntervalRef.current);
      faceIntervalRef.current = null;
    }

    if (voiceIntervalRef.current) {
      clearInterval(voiceIntervalRef.current);
      voiceIntervalRef.current = null;
    }

    detectionInFlightRef.current = false;
  }, []);

  const stopStream = useCallback(() => {
    stopAllTimers();
    isScanningRef.current = false;
    isStartingRef.current = false;
    isFinalizingRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop errors
        }
      });
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      const audioContext = audioCtxRef.current;
      audioCtxRef.current = null;
      analyserRef.current = null;
      audioContext.close().catch(() => {});
    } else {
      analyserRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore pause errors
      }
      videoRef.current.srcObject = null;
    }

    clearCanvas(canvasRef.current);
  }, [stopAllTimers]);

  const resetLiveState = useCallback(() => {
    setCurrentEmotion(null);
    setVoiceStress(0);
    setCountdown(SCAN_DURATION_SECONDS);
    setScanProgress(0);
    setFaceDetected(false);
    setScanQuality({
      score: 0,
      label: "Waiting",
      color: QUALITY_COLORS.fair,
    });

    countdownRef.current = SCAN_DURATION_SECONDS;
    voiceStressHistoryRef.current = [];
    expressionFramesRef.current = [];
    smoothVoiceStressRef.current = 0;
    smoothEmotionRef.current = {};
    faceQualitySamplesRef.current = [];
    faceDetectionStatsRef.current = { detectedFrames: 0, totalFrames: 0 };

    clearCanvas(canvasRef.current);
  }, []);

  const setErrorState = useCallback(
    (message) => {
      stopStream();
      if (!isMountedRef.current) return;
      setErrorMessage(message || DEFAULT_ERROR_MESSAGE);
      setPhase(PHASES.ERROR);
    },
    [stopStream]
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopStream();
    };
  }, [stopStream]);

  useEffect(() => {
    let cancelled = false;

    const initialise = async () => {
      try {
        setLoadingProgress(10);
        setLoadingLabel("Loading face detection library...");

        const faceapi = await loadFaceApiScript();
        if (cancelled || !isMountedRef.current) return;

        setFaceApiLib(faceapi);
        setLoadingProgress(25);
        setLoadingLabel("Loading face detector model...");

        await loadFaceApiModels(faceapi, (progress, label) => {
          if (cancelled || !isMountedRef.current) return;
          setLoadingProgress(progress);
          setLoadingLabel(label);
        });

        if (cancelled || !isMountedRef.current) return;

        setLoadingProgress(100);
        setLoadingLabel("Ready to scan");
        setPhase(PHASES.READY);
      } catch (error) {
        if (cancelled || !isMountedRef.current) return;
        setErrorMessage(error?.message || "Couldn't load face detection models.");
        setPhase(PHASES.ERROR);
      }
    };

    initialise();

    return () => {
      cancelled = true;
    };
  }, []);

  const getVoiceStressLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);

    const highStart = Math.floor(frequencyData.length * 0.55);
    const highFreq = frequencyData.slice(highStart);
    const midFreq = frequencyData.slice(Math.floor(frequencyData.length * 0.3), highStart);

    const highEnergy = average(Array.from(highFreq)) / 255;
    const midEnergy = average(Array.from(midFreq)) / 255;

    let rms = 0;
    for (let i = 0; i < timeData.length; i += 1) {
      const normalized = (timeData[i] - 128) / 128;
      rms += normalized * normalized;
    }
    rms = Math.sqrt(rms / timeData.length);

    const voicedSignal = clamp((rms - 0.01) / 0.18);
    const tensionRatio = clamp(highEnergy * 0.7 + (highEnergy - midEnergy + 0.2) * 0.3);

    return clamp(tensionRatio * 0.75 + voicedSignal * 0.25);
  }, []);

  const updateVoiceStressSample = useCallback(() => {
    const rawStress = getVoiceStressLevel();
    const smoothed = clamp(smoothValue(smoothVoiceStressRef.current, rawStress, 0.22));

    smoothVoiceStressRef.current = smoothed;
    voiceStressHistoryRef.current.push(smoothed);

    if (voiceStressHistoryRef.current.length > 200) {
      voiceStressHistoryRef.current.shift();
    }

    if (isMountedRef.current) {
      setVoiceStress(smoothed);
    }
  }, [getVoiceStressLevel]);

  const updateScanQualityState = useCallback((score) => {
    const quality = getScanQualityLevel(score);
    setScanQuality({
      score: roundTo(score, 2),
      label: quality.label,
      color: quality.color,
    });
  }, []);

  const processFaceDetection = useCallback(async () => {
    if (
      detectionInFlightRef.current ||
      !isScanningRef.current ||
      !videoRef.current ||
      !canvasRef.current ||
      !faceApiLib
    ) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return;
    }

    detectionInFlightRef.current = true;

    try {
      syncCanvasToVideo(video, canvas);

      const detection = await faceApiLib
        .detectSingleFace(
          video,
          new faceApiLib.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 })
        )
        .withFaceExpressions();

      if (!isMountedRef.current || !isScanningRef.current) {
        return;
      }

      faceDetectionStatsRef.current.totalFrames += 1;

      if (!detection) {
        setFaceDetected(false);
        clearCanvas(canvas);
        updateScanQualityState(average(faceQualitySamplesRef.current.length ? faceQualitySamplesRef.current : [0]));
        return;
      }

      faceDetectionStatsRef.current.detectedFrames += 1;
      setFaceDetected(true);

      const normalizedExpressions = normalizeExpressions(detection.expressions || {});
      const smoothedExpressions = {};

      Object.keys(EMOTION_LABELS).forEach((key) => {
        const nextValue = normalizedExpressions[key] || 0;
        const prevValue = smoothEmotionRef.current[key] || 0;
        smoothedExpressions[key] = smoothValue(prevValue, nextValue, 0.3);
      });

      const normalizedSmoothed = normalizeExpressions(smoothedExpressions);
      smoothEmotionRef.current = normalizedSmoothed;

      const dominant = getDominantEmotion(normalizedSmoothed);
      setCurrentEmotion({
        label: dominant.label,
        confidence: dominant.confidence,
        all: normalizedSmoothed,
      });

      expressionFramesRef.current.push({ ...normalizedSmoothed });
      if (expressionFramesRef.current.length > 500) {
        expressionFramesRef.current.shift();
      }

      const box = detection.detection?.box;
      const frameArea = Math.max(1, video.videoWidth * video.videoHeight);
      const faceAreaRatio = box ? (box.width * box.height) / frameArea : 0;
      const centeringScore = box
        ? clamp(
            1 -
              (Math.abs(box.x + box.width / 2 - video.videoWidth / 2) / (video.videoWidth / 2)) * 0.55 -
              (Math.abs(box.y + box.height / 2 - video.videoHeight / 2) / (video.videoHeight / 2)) * 0.45
          )
        : 0;
      const sizeScore = clamp(faceAreaRatio / 0.18);
      const confidenceScore = clamp(detection.detection?.score || 0);
      const expressionConfidence = clamp(dominant.confidence || 0);

      const qualityScore = clamp(
        centeringScore * 0.3 +
          sizeScore * 0.25 +
          confidenceScore * 0.25 +
          expressionConfidence * 0.2
      );

      faceQualitySamplesRef.current.push(qualityScore);
      if (faceQualitySamplesRef.current.length > 300) {
        faceQualitySamplesRef.current.shift();
      }

      updateScanQualityState(average(faceQualitySamplesRef.current));

      drawFaceOverlay({
        canvas,
        detection,
        dominantEmotion: dominant.label,
        confidence: dominant.confidence,
      });
    } catch {
      // ignore frame failure
    } finally {
      detectionInFlightRef.current = false;
    }
  }, [faceApiLib, updateScanQualityState]);

  const finaliseScan = useCallback(() => {
    if (isFinalizingRef.current) return;
    isFinalizingRef.current = true;

    stopAllTimers();
    isScanningRef.current = false;

    const collectedExpressions = [...expressionFramesRef.current];
    const voiceReadings = [...voiceStressHistoryRef.current];
    const detectionStats = faceDetectionStatsRef.current;
    const faceQualityAverage = average(faceQualitySamplesRef.current);
    const faceDetectionRate =
      detectionStats.totalFrames > 0
        ? detectionStats.detectedFrames / detectionStats.totalFrames
        : 0;

    stopStream();

    if (!collectedExpressions.length) {
      setErrorState(
        "No face was detected during the scan. Make sure your face is clearly visible, centered, and well-lit."
      );
      return;
    }

    const emotionKeys = Object.keys(EMOTION_LABELS);
    const avgExpressions = {};

    emotionKeys.forEach((key) => {
      avgExpressions[key] =
        collectedExpressions.reduce((sum, frame) => sum + (frame[key] || 0), 0) /
        collectedExpressions.length;
    });

    const normalizedAverageExpressions = normalizeExpressions(avgExpressions);
    const { label: dominantEmotion, confidence: dominantConfidence } =
      getDominantEmotion(normalizedAverageExpressions);

    const avgVoiceStress = average(voiceReadings);
    const negativeEmotionLoad =
      (normalizedAverageExpressions.sad || 0) * 0.9 +
      (normalizedAverageExpressions.angry || 0) * 1.05 +
      (normalizedAverageExpressions.fearful || 0) * 0.95 +
      (normalizedAverageExpressions.disgusted || 0) * 0.75;

    const positiveRegulation =
      (normalizedAverageExpressions.happy || 0) * 0.6 +
      (normalizedAverageExpressions.neutral || 0) * 0.25 +
      (normalizedAverageExpressions.surprised || 0) * 0.1;

    const weightedBurnoutBase = emotionKeys.reduce(
      (sum, key) => sum + (normalizedAverageExpressions[key] || 0) * (EMOTION_WEIGHTS[key] || 0),
      0
    );

    const burnoutSignal = clamp(
      weightedBurnoutBase * 0.55 +
        negativeEmotionLoad * 0.25 +
        avgVoiceStress * 0.15 +
        (1 - faceQualityAverage) * 0.05 -
        positiveRegulation * 0.08
    );

    const fatigue = getFatigueLevel(burnoutSignal);
    const scanQualityMeta = getScanQualityLevel(faceQualityAverage);
    const moodScore = Math.max(
      1,
      Math.min(
        5,
        Math.round(
          5 -
            burnoutSignal * 2.7 -
            avgVoiceStress * 0.8 +
            (normalizedAverageExpressions.happy || 0) * 0.5
        )
      )
    );
    const stressLevel = Math.max(
      1,
      Math.min(
        10,
        Math.round(
          1 +
            burnoutSignal * 6.4 +
            avgVoiceStress * 1.6 +
            (negativeEmotionLoad - positiveRegulation) * 1.1
        )
      )
    );
    const voiceStressPct = Math.round(avgVoiceStress * 100);

    const finalResult = {
      dominantEmotion,
      emotionAvg: Object.fromEntries(
        Object.entries(normalizedAverageExpressions).map(([key, value]) => [key, roundTo(value, 3)])
      ),
      burnoutSignal: roundTo(burnoutSignal, 2),
      fatigueLevel: fatigue.label,
      fatigueColor: fatigue.color,
      moodScore,
      stressLevel,
      voiceStressPct,
      voiceStress: roundTo(avgVoiceStress, 3),
      scanQuality: roundTo(faceQualityAverage, 2),
      scanQualityLabel: scanQualityMeta.label,
      faceDetectedRate: roundTo(faceDetectionRate, 2),
      dominantEmotionConfidence: roundTo(dominantConfidence, 3),
      recommendation: buildAiRecommendation({
        fatigueLevel: fatigue.label,
        dominantEmotion,
        moodScore,
        stressLevel,
        voiceStressPct,
        scanQualityLabel: scanQualityMeta.label,
      }),
    };

    if (!isMountedRef.current) return;

    setEmotionHistory(collectedExpressions);
    setResult(finalResult);
    setScanQuality({
      score: roundTo(faceQualityAverage, 2),
      label: scanQualityMeta.label,
      color: scanQualityMeta.color,
    });
    setPhase(PHASES.DONE);
  }, [setErrorState, stopAllTimers, stopStream]);

  const startScanLoops = useCallback(() => {
    resetLiveState();

    isScanningRef.current = true;
    isFinalizingRef.current = false;
    countdownRef.current = SCAN_DURATION_SECONDS;

    countdownIntervalRef.current = setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1);

      if (isMountedRef.current) {
        setCountdown(countdownRef.current);
        setScanProgress(
          ((SCAN_DURATION_SECONDS - countdownRef.current) / SCAN_DURATION_SECONDS) * 100
        );
      }

      if (countdownRef.current <= 0) {
        finaliseScan();
      }
    }, 1000);

    voiceIntervalRef.current = setInterval(() => {
      if (!isScanningRef.current) return;
      updateVoiceStressSample();
    }, VOICE_SAMPLE_INTERVAL_MS);

    faceIntervalRef.current = setInterval(() => {
      if (!isScanningRef.current) return;
      processFaceDetection();
    }, FACE_SCAN_INTERVAL_MS);

    processFaceDetection();
    updateVoiceStressSample();
  }, [finaliseScan, processFaceDetection, resetLiveState, updateVoiceStressSample]);

  const startCamera = useCallback(async () => {
    if (isStartingRef.current || isScanningRef.current || phase === PHASES.LOADING) {
      return;
    }

    isStartingRef.current = true;
    setErrorMessage(DEFAULT_ERROR_MESSAGE);

    try {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) {
        throw new Error("Camera and microphone access are not supported in this browser.");
      }

      if (!faceApiLib) {
        throw new Error("Face detection models are still loading. Please try again.");
      }

      stopStream();
      resetLiveState();

      const stream = await mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

// Tell React to switch to the scanning screen FIRST
setPhase(PHASES.SCANNING);

// Wait for React to render the <video> element
await new Promise(resolve => setTimeout(resolve, 100));

const video = videoRef.current;

if (!video) {
  throw new Error("Video element is unavailable.");
}

video.srcObject = stream;
await video.play();

      syncCanvasToVideo(video, canvasRef.current);

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const audioSource = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.82;

        audioSource.connect(analyser);
        audioCtxRef.current = audioContext;
        analyserRef.current = analyser;
      }

      if (!isMountedRef.current) return;

      setPhase(PHASES.SCANNING);
      startScanLoops();
    } catch (error) {
      console.error("Camera Error:", error);
  console.error("Error name:", error.name);
  console.error("Error message:", error.message);
      setErrorState(getPermissionErrorMessage(error));
    } finally {
      isStartingRef.current = false;
    }
  }, [faceApiLib, phase, resetLiveState, setErrorState, startScanLoops, stopStream]);

  const handleUseResult = useCallback(() => {
    if (result && onResult) {
      onResult(result);
    }
    stopStream();
    onClose?.();
  }, [onClose, onResult, result, stopStream]);

  const handleClose = useCallback(() => {
    stopStream();
    onClose?.();
  }, [onClose, stopStream]);

  const handleRetry = useCallback(() => {
    stopStream();
    resetLiveState();
    setResult(null);
    setPhase(faceApiLib ? PHASES.READY : PHASES.LOADING);
  }, [faceApiLib, resetLiveState, stopStream]);

  const sortedEmotionBreakdown = useMemo(() => {
    if (!result?.emotionAvg) return [];

    return Object.entries(result.emotionAvg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [result]);

  const currentEmotionLabel = currentEmotion
    ? `${EMOTION_ICONS[currentEmotion.label] || "😐"} ${
        EMOTION_LABELS[currentEmotion.label] || currentEmotion.label
      }`
    : "—";

  const currentEmotionConfidence = currentEmotion
    ? `${Math.round((currentEmotion.confidence || 0) * 100)}%`
    : "—";

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">
        <div className="scanner-header">
          <div className="scanner-title">
            <span className="scan-icon">◉</span>
            Biometric Scan
          </div>
          <button
            type="button"
            className="scanner-close"
            onClick={handleClose}
            aria-label="Close biometric scanner"
          >
            ✕
          </button>
        </div>

        {phase === PHASES.LOADING && (
          <div className="scanner-center">
            <div className="spin-ring" />
            <p>{loadingLabel}</p>
            <p className="scanner-sub">
              Loading progress: {loadingProgress}% - face detection runs locally in your browser
            </p>
            <div className="scan-progress-bar" aria-hidden="true">
              <div className="scan-progress-fill" style={{ width: `${loadingProgress}%` }} />
            </div>
          </div>
        )}

        {phase === PHASES.READY && (
          <div className="scanner-center">
            <div className="ready-icon">◎</div>
            <p>Ready to scan</p>
            <p className="scanner-sub">
              Camera + mic access required. 10-second scan with face, emotion, and voice analysis.
            </p>
            <button
              type="button"
              className="scan-btn"
              onClick={startCamera}
              disabled={isStartingRef.current}
            >
              {isStartingRef.current ? "Starting..." : "Start scan →"}
            </button>
          </div>
        )}

        {phase === PHASES.SCANNING && (
          <div className="scanner-live">
            <div className="video-wrap">
              <video ref={videoRef} muted playsInline className="scanner-video" />
              <canvas ref={canvasRef} className="scanner-canvas" />
              <div className="video-overlay">
                <div className={`face-indicator ${faceDetected ? "detected" : ""}`}>
                  {faceDetected ? "✓ Face detected" : "Position your face in frame"}
                </div>
                <div className="countdown-badge">{countdown}s</div>
              </div>
            </div>

            <div className="scan-progress-bar">
              <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }} />
            </div>

            <div className="live-stats">
              <div className="live-stat">
                <span className="live-stat-label">Emotion</span>
                <span className="live-stat-val">{currentEmotionLabel}</span>
              </div>

              <div className="live-stat">
                <span className="live-stat-label">Confidence</span>
                <span className="live-stat-val">{currentEmotionConfidence}</span>
              </div>

              <div className="live-stat">
                <span className="live-stat-label">Voice stress</span>
                <span className="live-stat-val">{Math.round(voiceStress * 100)}%</span>
              </div>

              <div className="live-stat">
                <span className="live-stat-label">Scan quality</span>
                <span className="live-stat-val" style={{ color: scanQuality.color }}>
                  {scanQuality.label}
                </span>
              </div>

              <div className="live-stat">
                <span className="live-stat-label">Quality score</span>
                <span className="live-stat-val">{Math.round(scanQuality.score * 100)}%</span>
              </div>

              <div className="live-stat">
                <span className="live-stat-label">Frames analysed</span>
                <span className="live-stat-val">
                  {emotionHistory.length || expressionFramesRef.current.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {phase === PHASES.DONE && result && (
          <div className="scanner-result">
            <div className="result-emotion">
              <span className="result-emoji">{EMOTION_ICONS[result.dominantEmotion] || "😐"}</span>
              <div>
                <p className="result-emotion-label">Dominant emotion</p>
                <p className="result-emotion-val">
                  {EMOTION_LABELS[result.dominantEmotion] || result.dominantEmotion}
                </p>
              </div>
            </div>

            <div className="result-meter">
              <div className="result-meter-label">
                <span>Stress signal</span>
                <span style={{ color: result.fatigueColor }}>{result.fatigueLevel}</span>
              </div>
              <div className="result-meter-bar">
                <div
                  className="result-meter-fill"
                  style={{
                    width: `${result.burnoutSignal * 100}%`,
                    background: result.fatigueColor,
                  }}
                />
              </div>
            </div>

            <div className="result-breakdown">
              {sortedEmotionBreakdown.map(([key, value]) => (
                <div className="breakdown-row" key={key}>
                  <span>
                    {EMOTION_ICONS[key] || "😐"} {EMOTION_LABELS[key] || key}
                  </span>
                  <div className="breakdown-bar-wrap">
                    <div className="breakdown-bar" style={{ width: `${value * 100}%` }} />
                  </div>
                  <span className="breakdown-pct">{Math.round(value * 100)}%</span>
                </div>
              ))}
            </div>

            <div className="live-stats">
              <div className="live-stat">
                <span className="live-stat-label">Mood score</span>
                <span className="live-stat-val">{result.moodScore}/5</span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Stress score</span>
                <span className="live-stat-val">{result.stressLevel}/10</span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Voice stress</span>
                <span className="live-stat-val">{result.voiceStressPct}%</span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Scan quality</span>
                <span className="live-stat-val" style={{ color: scanQuality.color }}>
                  {result.scanQualityLabel}
                </span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Detection rate</span>
                <span className="live-stat-val">
                  {Math.round((result.faceDetectedRate || 0) * 100)}%
                </span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Confidence</span>
                <span className="live-stat-val">
                  {Math.round((result.dominantEmotionConfidence || 0) * 100)}%
                </span>
              </div>
            </div>

            <div className="result-note">
              This will auto-fill mood ({result.moodScore}/5) and stress ({result.stressLevel}/10)
              in your check-in form.
              <br />
              <br />
              <strong>AI recommendation:</strong> {result.recommendation}
            </div>

            <div className="result-actions">
              <button type="button" className="scan-btn" onClick={handleUseResult}>
                Use these results →
              </button>
              <button type="button" className="scan-btn-ghost" onClick={handleClose}>
                Discard
              </button>
            </div>
          </div>
        )}

        {phase === PHASES.ERROR && (
          <div className="scanner-center">
            <p className="error-icon">⚠</p>
            <p>{errorMessage}</p>
            <p className="scanner-sub">
              Allow camera and microphone permissions, ensure no other app is using them, and try
              again.
            </p>

            <div className="permission-guide">
              <strong>Common fixes:</strong>
              <ul>
                <li>Allow camera and microphone when prompted</li>
                <li>Ensure no other app is using the camera</li>
                <li>Run the app on localhost or HTTPS</li>
                <li>Verify the face-api model files exist in public/models</li>
              </ul>
            </div>

            <button type="button" className="scan-btn" onClick={handleRetry}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
