import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`✅ Check your email (${email}) for the magic login link!`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-blue-900 to-purple-900 text-white px-4">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center border border-blue-400">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">🔐 Login / Sign Up</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 rounded-md bg-gray-700 text-white text-center focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-md font-semibold transition-all"
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>
        {message && <p className="mt-4 text-green-400 text-sm">{message}</p>}
      </div>
    </div>
  );
}
