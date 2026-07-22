"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Temporary authentication storage
      // We will replace this with sessions later
      localStorage.setItem(
        "loggedInUser",
        JSON.stringify({
          id: data.id,
          username: data.username,
        })
      );

      router.push("/chat");

    } catch (error) {
      console.error(error);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center h-screen text-white bg-black">
      <h1 className="text-3xl font-bold mb-4">
        Login
      </h1>

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

        {error && (
          <p className="text-red-400 text-sm">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-green-400 text-black px-4 py-2 rounded hover:bg-green-500 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        <Link
          href="/"
          className="text-sm text-green-400 hover:underline text-center mt-2"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}