import React, { useState } from "react";
import { supabase } from "../supabaseClient";

function Auth() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("Sending magic link... ✉️");

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("✅ Check your email for the magic link!");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-slate-800 text-slate-100">
      <div className="bg-slate-900/60 backdrop-blur-lg border border-slate-700 p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-4">🎙️ VoiceScribe</h1>
        <p className="text-slate-300 mb-6">
          Enter your email below to receive a magic sign-in link.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 placeholder-slate-400"
          />
          <button
            type="submit"
            className="btn-gradient w-full py-3 rounded-lg text-white font-semibold text-lg shadow-lg transition-all hover:scale-105"
          >
            ✉️ Send Magic Link
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
      </div>
    </div>
  );
}

export default Auth;
