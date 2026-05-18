import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Room from './components/Room';
import { Video } from 'lucide-react';

function Home() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 9);
    navigate(`/room/${id}`);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl overflow-hidden p-8 space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">See2world</h1>
          <p className="text-gray-400 mt-2">Regardez ensemble, peu importe la distance.</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={createRoom}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 transition-colors"
          >
            Créer une nouvelle salle
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">Ou</span>
            </div>
          </div>

          <form onSubmit={joinRoom} className="flex gap-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Code de la salle"
              className="flex-1 block w-full rounded-lg bg-gray-900 border-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-3 outline-none"
              required
            />
            <button
              type="submit"
              className="inline-flex justify-center py-3 px-6 border border-gray-600 rounded-lg shadow-sm text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-800 transition-colors"
            >
              Rejoindre
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </Router>
  );
}

export default App;
