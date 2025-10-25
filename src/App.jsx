import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./components/Auth"; 
import Transcriber from "./components/Transcriber";

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

  if (loading) return <div className="flex items-center justify-center min-h-screen text-white text-lg">Loading...</div>;

  if (!session) return <Auth />;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-slate-800 text-slate-100">
      <nav className="fixed top-0 left-0 w-full flex justify-between items-center px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-700 z-20">
        <h1 className="text-xl font-semibold">🎙️ VoiceScribe</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">{session.user?.email}</span>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition">Logout</button>
        </div>
      </nav>
      <div className="pt-24 px-4">
        <Transcriber />
      </div>
    </div>
  );
}

export default App;
