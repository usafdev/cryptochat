"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        return;
      }

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
    }
  };

  return (
    <main className="flex flex-col items-center justify-center h-screen text-white bg-black">
      <h1 className="text-3xl font-bold mb-4">Sign Up</h1>
      <div className="flex flex-col w-64 gap-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a username"
          className="px-4 py-2 rounded bg-gray-900 border border-gray-700 text-white"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="px-4 py-2 rounded bg-gray-900 border border-gray-700 text-white"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
          className="px-4 py-2 rounded bg-gray-900 border border-gray-700 text-white"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleSignup}
          className="bg-green-400 text-black px-4 py-2 rounded hover:bg-green-500"
        >
          Sign Up
        </button>
        <Link href="/" className="text-sm text-green-400 hover:underline text-center mt-2">
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}