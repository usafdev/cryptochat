"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const rawUsers = localStorage.getItem("users");
    const users = rawUsers ? JSON.parse(rawUsers) : {};
    if (users[username] && users[username] === password) {
      localStorage.setItem("loggedInUser", username);
      router.push("/chat");
    } else {
      setError("Invalid username or password");
    }
  };

  useEffect(() => {
    const loggedIn = localStorage.getItem("loggedInUser");
    if (loggedIn) router.push("/chat");
  }, []);

  return (
    <main className="flex flex-col items-center justify-center h-screen text-white bg-black">
      <h1 className="text-3xl font-bold mb-4">Login</h1>
      <div className="flex flex-col w-64 gap-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="px-4 py-2 rounded bg-gray-900 border border-gray-700 text-white"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="px-4 py-2 rounded bg-gray-900 border border-gray-700 text-white"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleLogin}
          className="bg-green-400 text-black px-4 py-2 rounded hover:bg-green-500"
        >
          Log In
        </button>
        {/* New back-to-home link */}
        <a href="/" className="text-sm text-green-400 hover:underline text-center mt-2">
          ← Back to Home
        </a>
      </div>
    </main>
  );
}