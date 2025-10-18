import { useState, useRef, useEffect } from "react";
import axios from "axios";
import WaveSurfer from "wavesurfer.js";


export default function Recorder({ backendURL, token, onNewTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transcription, setTranscription] = useState("");
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

    // Audio visualization setup
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
      const avg = sum / bufferLength;
      setVolume(avg);
      animationFrame = requestAnimationFrame(updateVolume);
    };
    updateVolume();

    mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorderRef.current.onstop = () => {
      cancelAnimationFrame(animationFrame);
      const blob = new Blob(chunks, { type: "audio/webm" });
      setAudioBlob(blob);
      const url = URL.createObjectURL(blob);
      wavesurfer.current.load(url);
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
    setLoading(true);
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
      const res = await axios.post(`${backendURL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      setTranscription(res.data.text);
      onNewTranscription(res.data.saved[0]);
    } catch (err) {
      console.error("Recording upload failed:", err);
      alert("Failed to upload recording.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md text-center shadow-xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-gray-800/20 to-purple-900/20 blur-xl pointer-events-none"></div>

      <h2 className="text-2xl font-semibold mb-4 text-blue-400 relative z-10">
        🎤 Live Recorder
      </h2>

      <div ref={waveRef} className="mb-4 rounded-lg overflow-hidden relative z-10"></div>

      {/* Mic Button */}
      <div className="relative flex justify-center mb-6 z-10">
        <div
          className={`absolute w-24 h-24 rounded-full blur-3xl transition-all duration-300 ${
            isRecording ? "bg-red-500/40 scale-125 animate-ping" : "bg-blue-500/10"
          }`}
          style={{
            opacity: Math.min(1, volume / 80),
            transform: `scale(${1 + volume / 200})`,
          }}
        ></div>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative z-20 rounded-full shadow-lg text-white text-xl w-16 h-16 flex items-center justify-center transition-all duration-200 ${
            isRecording
              ? "bg-red-600 hover:bg-red-700 animate-pulse scale-110"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isRecording ? "⏹" : "🎙️"}
        </button>
      </div>

      {/* Upload Button */}
      {audioBlob && (
        <button
          onClick={handleUploadRecording}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg text-white transition-all relative z-10"
        >
          {loading ? "Processing..." : "Upload Recording"}
        </button>
      )}

      {/* Transcription Result */}
      {transcription && (
        <div className="mt-6 text-left bg-gray-800/70 p-4 rounded-lg relative z-10 border border-gray-700">
          <h3 className="font-semibold text-blue-400 mb-2">
            🎧 Transcription:
          </h3>
          <p className="text-gray-300">{transcription}</p>
        </div>
      )}
    </div>
  );
}
