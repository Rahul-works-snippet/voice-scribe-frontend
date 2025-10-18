import { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "./supabaseClient";
import Auth from "./components/Auth";
import Recorder from "./components/Recorder"; // add this
import "./index.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [token, setToken] = useState(null);

  const backendURL = "https://speech-to-text-backend-rzip.onrender.com";


  // 🔹 Listen for Supabase auth changes
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setToken(data.session?.access_token ?? null);
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setToken(session?.access_token ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // 🔹 Fetch stored transcriptions (only if logged in)
  useEffect(() => {
    if (!user || !token) return;
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${backendURL}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setHistory(res.data);
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };
    fetchHistory();
  }, [user, token]);

  // 🔹 Handle file selection
  const handleFileChange = (e) => setAudioFile(e.target.files[0]);

  // 🔹 Upload selected file
  const handleUpload = async () => {
    if (!audioFile) return alert("Please select an audio file first!");
    setLoading(true);
    const formData = new FormData();
    formData.append("audio", audioFile);

    try {
      const res = await axios.post(`${backendURL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      setTranscription(res.data.text);
      setHistory((prev) => [res.data.saved[0], ...prev]);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setToken(null);
  };

  // --- Conditional rendering ---
  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center p-8">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-blue-400">🎙️ AI Speech-to-Text</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-md"
        >
          Logout
        </button>
      </div>

      {/* Upload + Transcribe */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-md flex flex-col items-center mb-8">
        <input type="file" accept="audio/*" onChange={handleFileChange} className="mb-4" />
        <button
          onClick={handleUpload}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-all"
        >
          {loading ? "Processing..." : "Upload & Transcribe"}
        </button>

        {transcription && (
          <div className="mt-6 w-full text-center">
            <h2 className="text-lg font-semibold mb-2">Latest Transcription:</h2>
            <p className="bg-gray-700 p-4 rounded-lg">{transcription}</p>
          </div>
        )}
      </div>

      {/* 🎤 Recorder with Live Waveform */}
      <Recorder
        backendURL={backendURL}
        token={token}
        onNewTranscription={(newItem) => setHistory((prev) => [newItem, ...prev])}
      />

      {/* 🧾 History Section */}
      <div className="mt-8 w-full max-w-3xl">
        <h2 className="text-2xl font-semibold mb-4 text-blue-300">📜 Past Transcriptions</h2>
        <div className="grid gap-4">
          {history.length === 0 ? (
            <p className="text-gray-400">No transcriptions yet.</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-gray-800 p-4 rounded-xl border border-gray-700 hover:scale-[1.01] transition-transform"
              >
                <h3 className="font-semibold text-blue-400">{item.filename || "Unknown File"}</h3>
                <p className="text-gray-300 mt-2">{item.transcription}</p>
                <p className="text-gray-500 text-sm mt-2">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
