// src/components/Transcriber.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

/**
 * Polished Transcriber component
 * - Upload audio file
 * - Live record (MediaRecorder)
 * - Canvas waveform while recording
 * - Fetch & show history
 * - Copy / Download actions on history items
 *
 * Backend expected endpoints:
 * POST  /upload      (form-data, field name: "audio")
 * GET   /history     (returns array of { id, filename, transcription, created_at, audio_url? })
 *
 * NOTE: change BASE_URL if your backend runs on a different host/port.
 */
// src/components/Transcriber.jsx
const BASE_URL = "https://speech-to-text-backend-rzip.onrender.com"; // live Render URL
 // <- update if needed

export default function Transcriber() {
  // UI state
  const [selectedFile, setSelectedFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Recording refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);

  // Waveform refs
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);

  // Playback ref for downloaded/recorded audio preview
  const audioPreviewRef = useRef(null);

  // On mount -> fetch history
  useEffect(() => {
    fetchHistory();
    // cleanup on unmount
    return () => stopVisualization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch history from backend
  async function fetchHistory() {
    try {
      const res = await axios.get(`${BASE_URL}/history`);
      setHistory(res.data || []);
    } catch (err) {
      console.error("Error fetching history:", err);
      setErrorMsg("Failed to fetch history.");
    }
  }

  // File input handler
  function onFileChange(e) {
    setSelectedFile(e.target.files?.[0] ?? null);
    setTranscription("");
    setErrorMsg("");
  }

  // Upload helper (file: File)
  async function uploadFile(file) {
    if (!file) return;
    setLoading(true);
    setErrorMsg("");
    setTranscription("");

    const formData = new FormData();
    formData.append("audio", file);

    try {
      const res = await axios.post(`${BASE_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000, // generous timeout for long files
      });

      // backend returns .text or .message structure; adapt as needed
      const text = res.data?.text ?? res.data?.message ?? res.data?.transcription ?? "";
      setTranscription(text);
      // refresh history to include newly saved record
      await fetchHistory();
      // preview the uploaded (or recorded) audio if backend returned audio_url optionally
      if (res.data?.audio_url && audioPreviewRef.current) {
        audioPreviewRef.current.src = res.data.audio_url;
      }
    } catch (err) {
      console.error("Upload/transcription error:", err);
      setErrorMsg(
        err?.response?.data?.error || err?.message || "Upload failed — check server console"
      );
    } finally {
      setLoading(false);
    }
  }

  // UI: click Upload button
  async function handleUploadClick() {
    if (!selectedFile) {
      setErrorMsg("Please choose an audio file first.");
      return;
    }
    await uploadFile(selectedFile);
  }

  // --- Recording logic ---
  async function startRecording() {
    setErrorMsg("");
    setTranscription("");
    audioChunksRef.current = [];
    audioBlobRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      // Setup waveform visualization
      setupVisualization(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopVisualization();

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;

        // prepare File object (some servers like .mp3/.wav; we keep webm but backend can accept)
        const file = new File([blob], `recording_${Date.now()}.webm`, {
          type: blob.type,
        });

        // set preview src
        if (audioPreviewRef.current) {
          audioPreviewRef.current.src = URL.createObjectURL(blob);
        }

        setRecording(false);
        // upload file to server (re-uses uploadFile)
        await uploadFile(file);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      setErrorMsg("Microphone access denied or not available.");
      setRecording(false);
    }
  }

  function stopRecording() {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      } else {
        // no active recorder, ensure visualization stops
        stopVisualization();
        setRecording(false);
      }
    } catch (err) {
      console.error("Error stopping recording:", err);
      stopVisualization();
      setRecording(false);
    }
  }

  // --- Waveform visualization using WebAudio + Canvas ---
  function setupVisualization(stream) {
    try {
      // create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // resolution
      analyserRef.current = analyser;

      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      drawWaveform(); // start RAF loop
    } catch (err) {
      console.error("Visualization setup failed:", err);
    }
  }

  function stopVisualization() {
    try {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch {}
        sourceRef.current = null;
      }
      // clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (err) {
      console.error("Error stopping visualization:", err);
    }
  }

  function drawWaveform() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    if (!canvas || !analyser || !dataArray) return;

    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    analyser.getByteTimeDomainData(dataArray);

    // gradient background fill
    ctx.fillStyle = "rgba(7, 10, 30, 0.1)";
    ctx.fillRect(0, 0, width, height);

    // create gradient stroke
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "#ff7a18");
    grad.addColorStop(0.5, "#af002d");
    grad.addColorStop(1, "#32064b");
    ctx.lineWidth = 2;
    ctx.strokeStyle = grad;
    ctx.beginPath();

    const sliceWidth = (width * 1.0) / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0; // 0..2
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // subtle glow bars under waveform
    const barCount = 40;
    const barWidth = width / barCount;
    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * dataArray.length);
      const magnitude = Math.abs(dataArray[idx] - 128) / 128;
      const barHeight = Math.max(2, magnitude * height * 0.9);

      // color varying along gradient
      const t = i / barCount;
      const r = Math.floor(255 * (1 - t));
      const g = Math.floor(122 * t);
      const b = 150 + Math.floor(100 * t);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.08 + 0.6 * magnitude})`;
      const bx = i * barWidth;
      ctx.fillRect(bx, height - barHeight, barWidth * 0.8, barHeight);
    }

    rafRef.current = requestAnimationFrame(drawWaveform);
  }

  // --- Utility: copy text to clipboard ---
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard");
    } catch (err) {
      console.error("Copy failed:", err);
      setErrorMsg("Copy failed. Use manual copy.");
    }
  }

  // --- Utility: download blob/file ---
  function downloadBlob(blob, filename = "audio.webm") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // If history item includes audio_url, allow downloading it by fetching blob then saving
  async function handleDownloadUrl(url, fallbackName = "audio") {
    try {
      const resp = await axios.get(url, { responseType: "blob" });
      downloadBlob(resp.data, `${fallbackName}_${Date.now()}.webm`);
    } catch (err) {
      console.error("Download failed:", err);
      setErrorMsg("Failed to download audio.");
    }
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-slate-800 text-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-300">
            VoiceScribe
          </h1>
          <p className="mt-1 text-slate-300">
            Record or upload audio — get accurate transcriptions and store them in Supabase.
          </p>
        </header>

        {/* Controls */}
        <section className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-lg border border-slate-700">
          <div className="md:flex md:items-center md:gap-6">
            <div className="flex-1 mb-4 md:mb-0">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Upload audio file
              </label>
              <input
                aria-label="Upload audio"
                type="file"
                accept="audio/*"
                onChange={onFileChange}
                className="block w-full text-slate-800 rounded px-3 py-2"
              />
            </div>

            <div className="flex gap-3 items-center">
              <button
                onClick={handleUploadClick}
                disabled={loading || !selectedFile}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition transform 
                  ${loading || !selectedFile ? "bg-slate-600 cursor-not-allowed" : "bg-gradient-to-r from-rose-500 to-orange-400 hover:scale-105"}`}
              >
                {/* upload icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v8m0 0V4m0 8l4-4m-4 4L8 8" />
                </svg>
                {loading ? "Transcribing..." : "Upload & Transcribe"}
              </button>

              {!recording ? (
                <button
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold bg-green-500 hover:bg-green-600 transform transition hover:scale-105"
                >
                  <span className="w-3 h-3 rounded-full bg-white/90 animate-pulse inline-block" />
                  Record
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold bg-red-500 hover:bg-red-600 transform transition hover:scale-105"
                >
                  <span className="w-3 h-3 rounded-full bg-white/90 inline-block" />
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Waveform canvas */}
          <div className="mt-6">
            <canvas
              ref={canvasRef}
              width={1200}
              height={140}
              className="w-full rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700"
            />
            <div className="mt-2 flex items-center gap-4">
              <audio ref={audioPreviewRef} controls className="w-64" />
              <div className="text-slate-400 text-sm">Live waveform while recording</div>
              {errorMsg && <div className="ml-auto text-red-400">{errorMsg}</div>}
            </div>
          </div>
        </section>

        {/* Result + spinner */}
        <section className="mb-6">
          {loading && (
            <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="w-10 h-10 border-4 border-t-4 border-slate-600 rounded-full animate-spin" />
              <div>
                <div className="text-slate-200 font-semibold">Transcribing audio</div>
                <div className="text-slate-400 text-sm">This can take a few seconds for long files</div>
              </div>
            </div>
          )}

          {!loading && transcription && (
            <div className="p-4 rounded-lg bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-700 shadow-md mb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Latest transcription</h3>
                  <p className="mt-2 text-slate-200">{transcription}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => copyText(transcription)}
                    className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 text-sm"
                  >
                    Copy
                  </button>
                  {audioBlobRef.current && (
                    <button
                      onClick={() => downloadBlob(audioBlobRef.current, "recording.webm")}
                      className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 text-sm"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="text-2xl font-bold mb-4">History</h2>
          <div className="grid gap-4">
            {history.length === 0 && (
              <div className="p-4 bg-slate-800 rounded">No transcriptions yet.</div>
            )}
            {history.map((item) => (
              <article
                key={item.id}
                className="p-4 rounded-lg bg-slate-800/40 border border-slate-700 hover:bg-slate-800/60 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm text-slate-300 font-medium">{item.filename || "Audio file"}</div>
                    <div className="mt-2 text-slate-200">{item.transcription}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      title="Copy transcription"
                      onClick={() => copyText(item.transcription)}
                      className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                    >
                      Copy
                    </button>

                    {item.audio_url ? (
                      <button
                        onClick={() => handleDownloadUrl(item.audio_url, item.filename?.replace(/\s/g, "_") || "audio")}
                        className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                      >
                        Download
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">No audio URL</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* hidden helpers */}
      <audio ref={audioPreviewRef} style={{ display: "none" }} />

      {/* Extra inline styles for little polish */}
      <style jsx>{`
        /* tiny scale on hover bigger effect */
        .hover\\:scale-105:hover {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}
