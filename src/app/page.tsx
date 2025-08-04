export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold mb-4">Welcome to CryptoChat</h1>
      <p className="text-gray-400">Start chatting securely with your friends.</p>
      <a href="/chat" className="mt-6 px-4 py-2 bg-green-400 text-black rounded hover:bg-green-500">
        Go to Chat
      </a>
    </main>
  );
}
