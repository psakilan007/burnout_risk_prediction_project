import { useEffect, useRef, useState, useCallback } from "react";
import "./BiometricScanner.css";

// emotion → burnout weight mapping (higher = more burnout signal)
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

// maps 0–1 burnout weight to a readable fatigue label
const getFatigueLevel = (score) => {
  if (score < 0.25) return { label: "Low", color: "#3ecf8e" };
  if (score < 0.55) return { label: "Moderate", color: "#f5c842" };
  return { label: "High", color: "#f06060" };
};

export default function BiometricScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);

  const [phase, setPhase] = useState("loading"); // loading | ready | scanning | done | error
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceApiLib, setFaceApiLib] = useState(null);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [voiceStress, setVoiceStress] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // dynamically load face-api.js from CDN
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
    script.onload = () => setFaceApiLib(window.faceapi);
    script.onerror = () => setPhase("error");
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, []);

  // load models once faceapi is available
  useEffect(() => {
  if (!faceApiLib) return;

  const loadModels = async () => {
    try {
      console.log("STEP 1");

      await faceApiLib.nets.tinyFaceDetector.loadFromUri("/models");

      console.log("STEP 2");

      await faceApiLib.nets.faceExpressionNet.loadFromUri("/models");

      console.log("STEP 3");

      setPhase("ready");
    } catch (err) {
      console.error("MODEL FAILED:", err);
      setPhase("error");
    }
  };

  loadModels();
}, [faceApiLib]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // set up audio analyser for voice stress
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
      }

      setPhase("scanning");
      startScan();
    } catch {
      setPhase("error");
    }
  }, [faceApiLib]); // eslint-disable-line

  const getVoiceStressLevel = () => {
    if (!analyserRef.current) return 0;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    // high-frequency energy correlates with vocal stress
    const highFreq = data.slice(Math.floor(data.length * 0.6));
    const avg = highFreq.reduce((a, b) => a + b, 0) / highFreq.length;
    return Math.min(avg / 128, 1); // 0–1
  };

  const startScan = useCallback(() => {
    const collected = [];
    let tick = 0;
    const total = 10;

    const timer = setInterval(() => {
      tick++;
      setCountdown(total - tick);
      setScanProgress((tick / total) * 100);

      // voice
      const vs = getVoiceStressLevel();
      setVoiceStress(vs);

      if (tick >= total) {
        clearInterval(timer);
        finaliseScan(collected);
      }
    }, 1000);

    // face detection at 5fps
    const faceTimer = setInterval(async () => {
      if (!videoRef.current || !faceApiLib || !canvasRef.current) return;
      const detection = await faceApiLib
        .detectSingleFace(videoRef.current, new faceApiLib.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (detection) {
        setFaceDetected(true);
        const exprs = detection.expressions;
        const top = Object.entries(exprs).sort((a, b) => b[1] - a[1])[0];
        setCurrentEmotion({ label: top[0], confidence: top[1], all: exprs });
        collected.push(exprs);

        // draw box on canvas
        const canvas = canvasRef.current;
        const dims = faceApiLib.matchDimensions(canvas, videoRef.current, true);
        faceApiLib.draw.drawDetections(canvas, faceApiLib.resizeResults(detection, dims));
      } else {
        setFaceDetected(false);
      }
    }, 200);

    intervalRef.current = { timer, faceTimer };
  }, [faceApiLib]);

  const finaliseScan = (collected) => {
    stopStream();

    if (collected.length === 0) {
      setPhase("error");
      return;
    }

    // average expressions over all frames
    const keys = Object.keys(collected[0]);
    const avg = {};
    keys.forEach((k) => {
      avg[k] = collected.reduce((s, f) => s + (f[k] || 0), 0) / collected.length;
    });

    // compute burnout signal from expressions
    const burnoutSignal = keys.reduce(
      (s, k) => s + (avg[k] || 0) * (EMOTION_WEIGHTS[k] || 0),
      0
    );

    const dominantEmotion = keys.sort((a, b) => avg[b] - avg[a])[0];
    const fatigue = getFatigueLevel(burnoutSignal);

    const finalResult = {
      dominantEmotion,
      emotionAvg: avg,
      burnoutSignal: Math.round(burnoutSignal * 10) / 10,
      fatigueLevel: fatigue.label,
      fatigueColor: fatigue.color,
      // translate to form-compatible values
      moodScore: Math.round(5 - burnoutSignal * 4), // invert: high stress = low mood
      stressLevel: Math.round(burnoutSignal * 9 + 1),
    };

    setResult(finalResult);
    setEmotionHistory(collected);
    setPhase("done");
  };

  const stopStream = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current.timer);
      clearInterval(intervalRef.current.faceTimer);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
  };

  useEffect(() => () => stopStream(), []);

  const handleUseResult = () => {
    if (result && onResult) onResult(result);
    onClose();
  };

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">
        {/* header */}
        <div className="scanner-header">
          <div className="scanner-title">
            <span className="scan-icon">◉</span>
            Biometric Scan
          </div>
          <button className="scanner-close" onClick={() => { stopStream(); onClose(); }}>✕</button>
        </div>

        {/* loading */}
        {phase === "loading" && (
          <div className="scanner-center">
            <div className="spin-ring" />
            <p>Loading face detection models...</p>
            <p className="scanner-sub">downloading ~6MB, one-time only</p>
          </div>
        )}

        {/* ready */}
        {phase === "ready" && (
          <div className="scanner-center">
            <div className="ready-icon">◎</div>
            <p>Ready to scan</p>
            <p className="scanner-sub">Camera + mic access required. 10-second scan.</p>
            <button className="scan-btn" onClick={startCamera}>Start scan →</button>
          </div>
        )}

        {/* scanning */}
        {phase === "scanning" && (
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
                <span className="live-stat-val">
                  {currentEmotion
                    ? `${EMOTION_ICONS[currentEmotion.label]} ${EMOTION_LABELS[currentEmotion.label]}`
                    : "—"}
                </span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Confidence</span>
                <span className="live-stat-val">
                  {currentEmotion ? `${Math.round(currentEmotion.confidence * 100)}%` : "—"}
                </span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Voice stress</span>
                <span className="live-stat-val">{Math.round(voiceStress * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* done */}
        {phase === "done" && result && (
          <div className="scanner-result">
            <div className="result-emotion">
              <span className="result-emoji">{EMOTION_ICONS[result.dominantEmotion]}</span>
              <div>
                <p className="result-emotion-label">Dominant emotion</p>
                <p className="result-emotion-val">{EMOTION_LABELS[result.dominantEmotion]}</p>
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
              {Object.entries(result.emotionAvg)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([k, v]) => (
                  <div className="breakdown-row" key={k}>
                    <span>{EMOTION_ICONS[k]} {EMOTION_LABELS[k]}</span>
                    <div className="breakdown-bar-wrap">
                      <div className="breakdown-bar" style={{ width: `${v * 100}%` }} />
                    </div>
                    <span className="breakdown-pct">{Math.round(v * 100)}%</span>
                  </div>
                ))}
            </div>

            <div className="result-note">
              This will auto-fill mood ({result.moodScore}/5) and stress ({result.stressLevel}/10) in your check-in form.
            </div>

            <div className="result-actions">
              <button className="scan-btn" onClick={handleUseResult}>
                Use these results →
              </button>
              <button className="scan-btn-ghost" onClick={() => { stopStream(); onClose(); }}>
                Discard
              </button>
            </div>
          </div>
        )}

        {/* error */}
        {phase === "error" && (
          <div className="scanner-center">
            <p className="error-icon">⚠</p>
            <p>Couldn't access camera or load models.</p>
            <p className="scanner-sub">Check browser permissions and try again.</p>
            <button className="scan-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
