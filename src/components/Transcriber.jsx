import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function Transcriber() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPreviewRef = useRef(null);

  const backendURL = "http://localhost:5000/api"; // replace with your deployed server

  // Fetch transcription history
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${backendURL}/transcriptions`);
      setHistory(res.data || []);
    } catch (err) {
      console.error("History fetch error:", err);
      setErrorMsg("Failed to fetch history.");
    }
  };

  const onFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] ?? null);
    setTranscription("");
    setErrorMsg("");
  };

  const handleUploadClick = async () => {
    if (!selectedFile) {
      setErrorMsg("Please choose an audio file first.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setTranscription("");

    const formData = new FormData();
    formData.append("audio", selectedFile);

    try {
      const res = await axios.post(`${backendURL}/transcribe`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        setTranscription(res.data.transcription);
        if (audioPreviewRef.current)
          audioPreviewRef.current.src = URL.createObjectURL(selectedFile);
        fetchHistory();
      } else {
        setErrorMsg("Transcription failed. Check server logs.");
      }
    } catch (err) {
      console.error("Upload/transcription error:", err);
      setErrorMsg(err?.response?.data?.error || "Upload failed — check console or server logs");
    } finally {
      setLoading(false);
    }
  };

  // Optional: Recording via mic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: blob.type });
        if (audioPreviewRef.current) audioPreviewRef.current.src = URL.createObjectURL(blob);

        setRecording(false);
        setSelectedFile(file);
        await handleUploadClick();
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      setErrorMsg("Microphone access denied or unavailable.");
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4 glass-card">
      <h2 className="text-xl font-semibold mb-4">Upload or Record Audio</h2>

      <input type="file" accept="audio/*" onChange={onFileChange} className="mb-4 w-full"/>
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleUploadClick}
          disabled={!selectedFile || loading}
          className="btn-gradient"
        >
          {loading ? "Uploading..." : "Upload"}
        </button>

        {!recording ? (
          <button onClick={startRecording} className="btn-gradient bg-green-600 hover:bg-green-700">
            Record
          </button>
        ) : (
          <button onClick={stopRecording} className="btn-gradient bg-red-600 hover:bg-red-700">
            Stop
          </button>
        )}
      </div>

      {errorMsg && <p className="text-red-400 mb-2">{errorMsg}</p>}

      {transcription && (
        <div className="transcription-card mb-4">
          <p className="whitespace-pre-wrap">{transcription}</p>
        </div>
      )}

      <audio ref={audioPreviewRef} controls className="w-full mb-4 rounded" />

      <h3 className="text-lg font-semibold mb-2">History</h3>
      <div className="grid grid-cols-1 gap-4">
        {history.map((item, idx) => (
          <div key={idx} className="history-card p-3 rounded shadow bg-slate-800/60">
            <p className="text-sm text-slate-300">{item.filename}</p>
            <p className="text-white">{item.transcription_text?.slice(0, 100)}...</p>
            <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
