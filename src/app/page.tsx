export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center h-screen text-white bg-black">
      <h1 className="text-4xl font-bold mb-4">Welcome to CryptoChat</h1>
      <p className="text-gray-400 mb-6">Start chatting securely with your friends.</p>
      <div className="flex gap-4">
        <a href="/login" className="px-4 py-2 border border-green-400 text-green-400 rounded hover:bg-green-400 hover:text-black">
          Login
        </a>
        <a href="/signup" className="px-4 py-2 border border-green-400 text-green-400 rounded hover:bg-green-400 hover:text-black">
          Sign Up
        </a>
      </div>
    </main>
  );
}