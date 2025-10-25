import React, { useState, useRef, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import axios from "axios";

export default function Recorder({ backendURL, token, onNewTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [volume, setVolume] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const waveRef = useRef(null);
  const wavesurfer = useRef(null);
  let animationFrame;

  useEffect(() => {
    wavesurfer.current = WaveSurfer.create({
      container: waveRef.current,
      waveColor: "#2563eb",
      progressColor: "#3b82f6",
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    const chunks = [];

    audioContextRef.current = new AudioContext();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    const bufferLength = analyserRef.current.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);
    sourceRef.current.connect(analyserRef.current);

    const updateVolume = () => {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArrayRef.current[i];
      setVolume(sum / bufferLength);
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
    } catch (err) {
      console.error(err);
      alert("Failed to upload recording.");
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md text-center shadow-xl relative overflow-hidden">
      <div ref={waveRef} className="mb-4 rounded-lg overflow-hidden"></div>
      <button onClick={isRecording ? stopRecording : startRecording} className={isRecording ? "bg-red-600" : "bg-blue-600"}>
        {isRecording ? "Stop" : "Record"}
      </button>
      {audioBlob && <button onClick={handleUploadRecording}>Upload Recording</button>}
    </div>
  );
}
