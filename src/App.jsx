import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./components/Auth.jsx";
import Transcriber from "./components/Transcriber.jsx";

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };
    fetchSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-white text-lg">
        Loading...
      </div>
    );

  if (!session) return <Auth />;

  return (
    <div className="app-container">
      <div className="bg-blobs"></div>

      {/* Navbar */}
      <nav className="glass-box w-full flex justify-between items-center px-6 py-4 mb-6">
        <h1 className="app-title text-2xl">🎙️ VoiceScribe 2025</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-200">{session.user?.email}</span>
          <button onClick={handleLogout} className="btn-neon">Logout</button>
        </div>
      </nav>

      {/* Transcriber Component */}
      <Transcriber backendURL={import.meta.env.VITE_BACKEND_URL} />
    </div>
  );
}

export default App;
