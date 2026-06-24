import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import "./DailyForm.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const SliderField = ({ label, name, min, max, value, onChange, markers, highlight }) => (
  <div className={`slider-field ${highlight ? "highlighted" : ""}`}>
    <div className="slider-header">
      <span className="slider-label">
        {label}
        {highlight && <span className="prefill-tag">◉ from scan</span>}
      </span>
      <span className="slider-val">{value}</span>
    </div>
    <input
      type="range" min={min} max={max} value={value}
      onChange={(e) => onChange(name, Number(e.target.value))}
      className="slider"
    />
    {markers && (
      <div className="slider-markers">
        {markers.map((m) => <span key={m}>{m}</span>)}
      </div>
    )}
  </div>
);

export default function DailyForm() {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  // pick up prefill from biometric scan if navigated with state
  const prefill = location.state?.prefill || {};
  const hasPrefill = Object.keys(prefill).length > 0;

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    mood: prefill.mood ?? 3,
    sleepHours: 7,
    sleepQuality: 3,
    stressLevel: prefill.stressLevel ?? 5,
    missedAssignments: 0,
    screenTime: 4,
    inactivityDays: 0,
    loginCount: 1,
    physicalActivity: false,
    notes: "",
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/entry`, form);
      toast.success(`Score: ${data.score.score}/10 — ${data.score.riskLevel} risk`);
      nav("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.msg || "failed to submit");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: "How are you feeling?",
      content: (
        <>
          {hasPrefill && (
            <div className="scan-prefill-notice">
              <span>◉</span> Mood & stress pre-filled from your face scan. Adjust if needed.
            </div>
          )}
          <SliderField label="Mood" name="mood" min={1} max={5} value={form.mood}
            onChange={set} markers={["terrible", "okay", "great"]}
            highlight={!!prefill.mood} />
          <SliderField label="Stress level" name="stressLevel" min={1} max={10}
            value={form.stressLevel} onChange={set} markers={["chill", "moderate", "maxed"]}
            highlight={!!prefill.stressLevel} />
        </>
      ),
    },
    {
      title: "Sleep check",
      content: (
        <>
          <SliderField label="Hours slept" name="sleepHours" min={0} max={12}
            value={form.sleepHours} onChange={set} markers={["0h", "6h", "12h"]} />
          <SliderField label="Sleep quality" name="sleepQuality" min={1} max={5}
            value={form.sleepQuality} onChange={set} markers={["rough", "okay", "solid"]} />
        </>
      ),
    },
    {
      title: "Academic & activity",
      content: (
        <>
          <SliderField label="Missed assignments" name="missedAssignments" min={0} max={10}
            value={form.missedAssignments} onChange={set} markers={["0", "5", "10"]} />
          <SliderField label="Screen time (hrs)" name="screenTime" min={0} max={16}
            value={form.screenTime} onChange={set} markers={["0h", "8h", "16h"]} />
          <SliderField label="Inactive days this week" name="inactivityDays" min={0} max={7}
            value={form.inactivityDays} onChange={set} markers={["0", "3-4", "7"]} />
          <div className="toggle-field">
            <span>Did any physical activity today?</span>
            <button
              className={`toggle-btn ${form.physicalActivity ? "on" : ""}`}
              onClick={() => set("physicalActivity", !form.physicalActivity)}
            >
              {form.physicalActivity ? "Yes" : "No"}
            </button>
          </div>
        </>
      ),
    },
    {
      title: "Anything else?",
      content: (
        <div className="notes-field">
          <label>Optional notes</label>
          <textarea
            rows={4}
            placeholder="Rough day, big exam, something on your mind..."
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="form-page">
      <div className="form-wrap">
        <div className="form-top">
          <button className="back-btn"
            onClick={() => step > 0 ? setStep(s => s - 1) : nav("/dashboard")}>
            ← back
          </button>
          <span className="step-count">{step + 1} / {steps.length}</span>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        <div className="form-card card">
          <p className="form-date">{new Date().toDateString()}</p>
          <h2>{steps[step].title}</h2>
          <div className="form-fields">{steps[step].content}</div>
        </div>

        <div className="form-nav">
          {step < steps.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep(s => s + 1)}>
              Continue →
            </button>
          ) : (
            <button className="btn-primary" onClick={submit} disabled={loading}>
              {loading ? "Submitting..." : "Submit check-in →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
