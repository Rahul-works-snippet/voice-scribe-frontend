// src/components/Transcriber.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const BASE_URL = "https://speech-to-text-backend-rzip.onrender.com";

 // Make sure backend is running

export default function Transcriber() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const audioPreviewRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    return () => stopVisualization();
  }, []);

  async function fetchHistory() {
    try {
      const res = await axios.get(`${BASE_URL}/history`);
      setHistory(res.data || []);
    } catch (err) {
      console.error("History fetch error:", err);
      setErrorMsg("Failed to fetch history from server.");
    }
  }

  const onFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] ?? null);
    setTranscription("");
    setErrorMsg("");
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setErrorMsg("");
    setTranscription("");

    const formData = new FormData();
    formData.append("audio", file);

    try {
      const res = await axios.post(`${BASE_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });

      const text = res.data?.text ?? res.data?.transcription ?? "";
      setTranscription(text);
      audioBlobRef.current = file;
      if (audioPreviewRef.current) audioPreviewRef.current.src = URL.createObjectURL(file);
      await fetchHistory();
    } catch (err) {
      console.error("Upload error:", err.response?.data || err.message);
      setErrorMsg("Upload failed — check console or server logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = async () => {
    if (!selectedFile) return setErrorMsg("Please choose an audio file first.");
    await uploadFile(selectedFile);
  };

  // --- Recording ---
  const startRecording = async () => {
    setErrorMsg("");
    setTranscription("");
    audioChunksRef.current = [];
    audioBlobRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      setupVisualization(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopVisualization();
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: blob.type });
        if (audioPreviewRef.current) audioPreviewRef.current.src = URL.createObjectURL(blob);
        setRecording(false);
        await uploadFile(file);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      setErrorMsg("Microphone access denied or not available.");
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop();
    else stopVisualization();
    setRecording(false);
  };

  // --- Waveform ---
  const setupVisualization = (stream) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      dataArrayRef.current = dataArray;

      drawWaveform();
    } catch (err) {
      console.error("Visualization setup failed:", err);
    }
  };

  const stopVisualization = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (analyserRef.current) analyserRef.current.disconnect();
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!canvas || !analyser || !dataArray) return;

    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;

    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(7,10,30,0.1)";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();

    let x = 0;
    const sliceWidth = width / dataArray.length;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    rafRef.current = requestAnimationFrame(drawWaveform);
  };

  // --- Utilities ---
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const downloadBlob = (blob, filename = "audio.webm") => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadUrl = async (url, name) => {
    try {
      const resp = await axios.get(url, { responseType: "blob" });
      downloadBlob(resp.data, name);
    } catch (err) {
      console.error("Download failed:", err);
      setErrorMsg("Failed to download audio.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-slate-800 text-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-4">🎤 VoiceScribe</h1>
        <p className="mb-6 text-slate-300">Record or upload audio to get transcriptions.</p>

        {/* Controls */}
        <div className="bg-slate-800/60 backdrop-blur-sm p-6 rounded-2xl mb-6 border border-slate-700 shadow-lg">
          <div className="flex flex-col md:flex-row gap-4 md:items-center">
            <input type="file" accept="audio/*" onChange={onFileChange} className="flex-1 p-2 rounded text-slate-800"/>
            <button
              onClick={handleUploadClick}
              disabled={loading || !selectedFile}
              className={`px-4 py-2 rounded font-semibold ${
                loading || !selectedFile ? "bg-slate-600 cursor-not-allowed" : "bg-gradient-to-r from-rose-500 to-orange-400 hover:scale-105"
              }`}
            >
              {loading ? "Transcribing..." : "Upload & Transcribe"}
            </button>

            {!recording ? (
              <button onClick={startRecording} className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded font-semibold">
                Record
              </button>
            ) : (
              <button onClick={stopRecording} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded font-semibold">
                Stop
              </button>
            )}
          </div>

          <canvas ref={canvasRef} width={1200} height={120} className="mt-4 w-full rounded bg-slate-900/50 border border-slate-700"/>
          <audio ref={audioPreviewRef} controls className="mt-2 w-64"/>
          {errorMsg && <p className="text-red-400 mt-2">{errorMsg}</p>}
        </div>

        {/* Latest transcription */}
        {transcription && (
          <div className="bg-slate-700/60 p-4 rounded mb-6 border border-slate-600 shadow">
            <h3 className="font-semibold">Latest transcription:</h3>
            <p>{transcription}</p>
            <button onClick={() => copyText(transcription)} className="mt-2 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm">Copy</button>
            {audioBlobRef.current && (
              <button onClick={() => downloadBlob(audioBlobRef.current)} className="ml-2 mt-2 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm">Download Audio</button>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-slate-800/50 p-4 rounded border border-slate-700 shadow">
            <h3 className="font-semibold mb-2">Transcription History:</h3>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((item, i) => (
                <li key={i} className="bg-slate-700/50 p-2 rounded flex justify-between items-center">
                  <span className="flex-1">{item.text}</span>
                  {item.url && (
                    <button onClick={() => handleDownloadUrl(item.url, `audio_${i}.webm`)} className="ml-2 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm">Download</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
//
    
      