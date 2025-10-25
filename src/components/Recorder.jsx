import React, { useState, useRef, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import axios from "axios";

export default function Recorder({ backendURL, token, onNewTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const waveRef = useRef(null);
  const wavesurfer = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  let animationFrame;

  useEffect(() => {
    wavesurfer.current = WaveSurfer.create({
      container: waveRef.current,
      waveColor: "#3b82f6",
      progressColor: "#2563eb",
      cursorColor: "#fff",
      barWidth: 3,
      barRadius: 3,
      height: 80,
    });

    return () => {
      wavesurfer.current.destroy();
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks = [];

      // Audio context for visualization
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      source.connect(analyser);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArrayRef.current);
        animationFrame = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        cancelAnimationFrame(animationFrame);
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        wavesurfer.current.load(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const handleUploadRecording = async () => {
    if (!audioBlob) return alert("No recording found!");
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
      const res = await axios.post(`${backendURL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` },
      });
      onNewTranscription(res.data.text);
    } catch {
      alert("Upload failed!");
    }
  };

  return (
    <div className="glass-card mx-auto flex flex-col items-center w-full max-w-md p-6 relative shadow-xl">
      <div ref={waveRef} className="w-full mb-4 rounded-lg overflow-hidden bg-slate-900"></div>
      <div className="flex gap-4 mb-4 flex-wrap justify-center w-full">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`btn-gradient ${isRecording ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
        >
          {isRecording ? "Stop" : "Record"}
        </button>
        {audioBlob && (
          <button onClick={handleUploadRecording} className="btn-gradient bg-blue-600 hover:bg-blue-700">
            Upload
          </button>
        )}
      </div>
    </div>
  );
}
