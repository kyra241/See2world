import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { Monitor, Camera, CameraOff, Mic, MicOff, VideoOff, MessageSquare, Send, Copy, LogOut, Volume2, VolumeX, EyeOff, Eye, Globe, Maximize, Minus, Square, X, ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const VideoPlayer = ({ stream, isLocal, volume, isMainStage = false, isScreen = false }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && !isLocal) {
      videoRef.current.volume = volume;
    }
  }, [volume, isLocal]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={`w-full h-full bg-gray-950 ${isMainStage ? 'object-contain' : 'object-cover'} ${isLocal && !isScreen ? 'scale-x-[-1]' : ''}`}
    />
  );
};

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [showCameras, setShowCameras] = useState(true);
  const [chatText, setChatText] = useState('');
  const [globalVolume, setGlobalVolume] = useState(1);
  const [isBrowserMode, setIsBrowserMode] = useState(false);
  const [showAddressBar, setShowAddressBar] = useState(true);
  const [browserUrl, setBrowserUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [copyToast, setCopyToast] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // New browser history, webview ref, and warning states
  const [showWarningBanner, setShowWarningBanner] = useState(true);
  const [browserHistory, setBrowserHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const webviewRef = useRef(null);
  
  const [notification, setNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);

  const triggerNotification = (text) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(text);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const navigateToUrl = (url) => {
    let formattedUrl = url.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    
    const newHistory = browserHistory.slice(0, historyIndex + 1);
    newHistory.push(formattedUrl);
    setBrowserHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setCurrentUrl(formattedUrl);
    setBrowserUrl(formattedUrl);
    syncBrowser(isBrowserMode, formattedUrl);
  };

  const handleBrowserBack = () => {
    if (ipcRenderer && webviewRef.current) {
      try {
        if (webviewRef.current.canGoBack()) {
          webviewRef.current.goBack();
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      const prevUrl = browserHistory[prevIndex];
      setCurrentUrl(prevUrl);
      setBrowserUrl(prevUrl);
      syncBrowser(isBrowserMode, prevUrl);
    }
  };

  const handleBrowserForward = () => {
    if (ipcRenderer && webviewRef.current) {
      try {
        if (webviewRef.current.canGoForward()) {
          webviewRef.current.goForward();
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    if (historyIndex < browserHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const nextUrl = browserHistory[nextIndex];
      setCurrentUrl(nextUrl);
      setBrowserUrl(nextUrl);
      syncBrowser(isBrowserMode, nextUrl);
    }
  };

  const handleBrowserReload = () => {
    if (ipcRenderer && webviewRef.current) {
      try {
        webviewRef.current.reload();
        return;
      } catch (err) {
        console.error(err);
      }
    }
    
    const temp = currentUrl;
    setCurrentUrl('');
    setTimeout(() => {
      setCurrentUrl(temp);
      syncBrowser(isBrowserMode, temp);
    }, 50);
  };

  const handleToggleBrowserMode = async () => {
    if (!isHost) return;
    const nextMode = !isBrowserMode;
    setIsBrowserMode(nextMode);
    
    let targetUrl = currentUrl;
    if (nextMode && !targetUrl) {
      targetUrl = 'https://www.google.com';
      setCurrentUrl(targetUrl);
      setBrowserUrl(targetUrl);
    }
    
    if (nextMode) {
      if (!isScreenSharing) {
        try {
          await toggleScreenShare();
        } catch (err) {
          console.error("Auto screen share failed:", err);
        }
      }
    } else {
      if (isScreenSharing) {
        stopMedia();
      }
    }
    syncBrowser(nextMode, targetUrl);
  };

  // Sync address bar input with Electron webview actual navigation changes
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleNavigate = (e) => {
      setBrowserUrl(e.url);
      setCurrentUrl(e.url);
      syncBrowser(isBrowserMode, e.url);
    };

    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);

    return () => {
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
    };
  }, [currentUrl]);
  
  const {
    peers,
    localStream,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    stopMedia,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    messages,
    sendMessage,
    socketId,
    browserState,
    syncBrowser,
    isHost,
    participantCount,
    hostId
  } = useWebRTC(roomId, triggerNotification);

  // Sync local browser states when receiving updates from other participants
  useEffect(() => {
    if (browserState) {
      // Only set local browser mode if we are the host.
      // Participants will watch the host's WebRTC stream on the video stage instead!
      if (isHost) {
        setIsBrowserMode(browserState.isBrowserMode);
      } else {
        // Participants stay in standard video stage mode
        setIsBrowserMode(false);
      }
      
      setCurrentUrl(browserState.currentUrl);
      if (browserState.currentUrl) {
        setBrowserUrl(browserState.currentUrl);
        setShowAddressBar(false);
      }
    }
  }, [browserState, isHost]);

  // Turn off browser mode if host stops screen sharing
  useEffect(() => {
    if (isHost && isBrowserMode && !isScreenSharing) {
      setIsBrowserMode(false);
      syncBrowser(false, currentUrl);
    }
  }, [isScreenSharing, isBrowserMode, isHost]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  };

  const handleLeave = () => {
    stopMedia();
    navigate('/');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatText.trim()) {
      sendMessage(chatText);
      setChatText('');
    }
  };

  // Determine who is on the main stage
  let mainStream = null;
  let mainIsLocal = false;
  
  if (localStream && isScreenSharing) {
    mainStream = localStream;
    mainIsLocal = true;
  } else if (hostId && peers[hostId]) {
    // Prioritize the host's stream for all participants
    mainStream = peers[hostId];
    mainIsLocal = false;
  } else if (Object.values(peers).length > 0) {
    mainStream = Object.values(peers)[0];
    mainIsLocal = false;
  } else if (localStream) {
    mainStream = localStream;
    mainIsLocal = true;
  }

  // Determine if we have any cameras to show in the sidebar
  const hasSideCameras = (localStream && !mainIsLocal) || (Object.values(peers).length > (mainStream && !mainIsLocal ? 1 : 0));

  return (
    <div className="h-screen bg-gray-900 flex flex-col text-white overflow-hidden">

      {/* Toast de confirmation */}
      {copyToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-2.5 rounded-full shadow-xl text-sm font-medium flex items-center gap-2 animate-bounce">
          <Copy className="w-4 h-4" /> Code copié !
        </div>
      )}

      {/* Notification de salle */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-blue-600/95 backdrop-blur-md text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-3 border border-blue-500/30 animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></div>
          <span>{notification}</span>
        </div>
      )}

      {/* Modal de partage */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowShareModal(false)}>
          <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2">Inviter des participants</h2>
            <p className="text-gray-400 text-sm mb-6">Partagez ce code à vos amis. Ils pourront le saisir dans See2world pour rejoindre la salle.</p>
            <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between gap-4 border border-gray-700">
              <span className="font-mono text-2xl tracking-widest text-blue-400 font-bold">{roomId}</span>
              <button onClick={handleCopyCode} className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shrink-0" title="Copier le code">
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <button onClick={() => setShowShareModal(false)} className="mt-6 w-full py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors">Fermer</button>
          </div>
        </div>
      )}

      {/* Header (Title Bar) */}
      <header className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between shrink-0 z-20 select-none" style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex items-center gap-3 px-4" style={{ WebkitAppRegion: 'no-drag' }}>
          <h1 className="text-xl font-bold text-white tracking-tight">See2world</h1>
          <button
            onClick={() => setShowShareModal(true)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-mono flex items-center gap-2 transition-colors"
            title="Partager le code de la salle"
          >
            <span className="text-blue-400 font-bold tracking-wider">{roomId}</span>
            <Copy className="w-4 h-4 text-gray-400" />
          </button>
          
          {/* Live Participant Count Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-900 border border-gray-700 rounded-md text-xs text-gray-300 font-semibold shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <span>
              {participantCount <= 1 ? "1 Hôte" : `1 Hôte, ${participantCount - 1} Participant${participantCount - 1 > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        
        <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' }}>
          <button 
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen();
            }}
            className="p-2 mr-2 rounded-full hover:bg-gray-700 transition-colors"
            title="Plein écran (Application)"
          >
            <Maximize className="w-4 h-4 text-gray-300" />
          </button>

          <button 
            onClick={() => setShowCameras(!showCameras)}
            className={`p-2 mr-2 rounded-full transition-colors ${!showCameras ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            title={showCameras ? "Masquer les caméras" : "Afficher les caméras"}
          >
            {showCameras ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setChatOpen(!chatOpen)}
            className={`p-2 mr-2 rounded-full transition-colors ${chatOpen ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button onClick={handleLeave} className="p-2 mr-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors" title="Quitter la salle">
            <LogOut className="w-5 h-5" />
          </button>

          {ipcRenderer && (
            <div className="flex h-full border-l border-gray-700">
              <button onClick={() => ipcRenderer.send('window-minimize')} className="px-4 hover:bg-gray-700 transition-colors flex items-center justify-center text-gray-400 hover:text-white">
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={() => ipcRenderer.send('window-maximize')} className="px-4 hover:bg-gray-700 transition-colors flex items-center justify-center text-gray-400 hover:text-white">
                <Square className="w-3 h-3" />
              </button>
              <button onClick={() => ipcRenderer.send('window-close')} className="px-4 hover:bg-red-600 transition-colors flex items-center justify-center text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Main Video Area */}
        <div className="flex-1 p-4 flex flex-col relative overflow-hidden bg-black gap-2">
          
          {/* Browser Navigation Bar (Host Only) */}
          {isHost && isBrowserMode && showAddressBar && (
            <div className="h-12 bg-gray-800 rounded-lg flex items-center px-4 gap-3 shrink-0 shadow-md">
              <div className="flex items-center gap-1 border-r border-gray-700 pr-2">
                <button 
                  onClick={handleBrowserBack}
                  disabled={ipcRenderer ? false : historyIndex <= 0}
                  className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent text-gray-300 hover:text-white transition-colors"
                  title="Retour"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleBrowserForward}
                  disabled={ipcRenderer ? false : historyIndex >= browserHistory.length - 1}
                  className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent text-gray-300 hover:text-white transition-colors"
                  title="Suivant"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleBrowserReload}
                  className="p-1.5 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                  title="Actualiser"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
              <form 
                onSubmit={(e) => { 
                  e.preventDefault(); 
                  navigateToUrl(browserUrl);
                  setShowAddressBar(false);
                }}
                className="flex-1 flex gap-2"
              >
                <Globe className="w-5 h-5 text-gray-400 mt-1" />
                <input
                  type="text"
                  value={browserUrl}
                  onChange={(e) => setBrowserUrl(e.target.value)}
                  placeholder="Entrez une URL (ex: duckduckgo.com ou https://example.com)"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-white"
                />
                <button type="submit" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium">
                  Aller
                </button>
              </form>
            </div>
          )}

          <div id="main-video-container" className="flex-1 rounded-xl overflow-hidden relative shadow-lg bg-gray-950 group">
             {isHost && isBrowserMode && !showAddressBar && (
                <button 
                  onClick={() => setShowAddressBar(true)}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-gray-800/90 hover:bg-gray-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 shadow-lg backdrop-blur-sm"
                >
                  <Globe className="w-4 h-4" /> Afficher la barre d'adresse
                </button>
             )}
             
             {isHost && isBrowserMode && currentUrl ? (
                <div className="absolute inset-0 flex flex-col">
                  {!ipcRenderer && showWarningBanner && (
                    <div className="bg-yellow-600/95 text-white px-4 py-1.5 text-[11px] text-center font-medium shrink-0 flex items-center justify-between gap-2 shadow-inner">
                      <span className="flex-1 text-center">
                        ⚠️ Version Web : certains sites bloquent l'affichage par sécurité (X-Frame-Options). Utilisez l'app Desktop pour tout débloquer !
                      </span>
                      <button onClick={() => setShowWarningBanner(false)} className="hover:bg-yellow-700 p-0.5 rounded transition-colors shrink-0 text-white" title="Fermer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {ipcRenderer ? (
                    <webview ref={webviewRef} src={currentUrl} className="w-full h-full border-0 bg-white" allowpopups="true" />
                  ) : (
                    <iframe 
                      src={currentUrl} 
                      className="w-full h-full border-0 bg-white" 
                      title="Navigateur Partagé"
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    />
                  )}
                </div>
             ) : mainStream ? (
                <div className="w-full h-full relative">
                  <VideoPlayer stream={mainStream} isLocal={mainIsLocal} volume={globalVolume} isMainStage={true} isScreen={isScreenSharing && mainIsLocal} />
                  
                  {/* Badge indicating connection state */}
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 border border-gray-800 pointer-events-none select-none">
                    <span className={`w-2 h-2 rounded-full ${mainIsLocal ? 'bg-blue-500' : 'bg-red-500 animate-pulse'}`}></span>
                    <span className="text-[11px] font-bold tracking-wide text-gray-200">
                      {mainIsLocal ? (isScreenSharing ? "MON PARTAGE D'ÉCRAN" : "MA CAMÉRA") : "DIFFUSION DE L'HÔTE (DIRECT)"}
                    </span>
                  </div>

                  {/* Premium Overlay controls for participants */}
                  {!mainIsLocal && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-md border border-gray-800 rounded-xl px-4 py-2.5 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-2xl z-30">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setGlobalVolume(globalVolume === 0 ? 1 : 0)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {globalVolume === 0 ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.05" 
                          value={globalVolume}
                          onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
                          className="w-24 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{Math.round(globalVolume * 100)}%</span>
                      </div>
                      
                      <div className="h-4 w-px bg-gray-800" />
                      
                      <button 
                        onClick={() => {
                          const container = document.getElementById('main-video-container');
                          if (container) {
                            if (document.fullscreenElement) {
                              document.exitFullscreen();
                            } else {
                              container.requestFullscreen();
                            }
                          }
                        }}
                        className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold"
                        title="Agrandir la fenêtre"
                      >
                        <Maximize className="w-4 h-4" />
                        <span>Plein écran</span>
                      </button>
                    </div>
                  )}
                </div>
             ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col gap-4">
                  <Monitor className="w-16 h-16 opacity-50" />
                  <p className="text-lg">En attente de partage d'écran ou de caméra...</p>
                  <p className="text-sm text-gray-600">Utilisez les contrôles ci-dessous pour démarrer</p>
                </div>
             )}
          </div>
        </div>

        {/* Cameras Sidebar (Minimalist) */}
        {showCameras && (
          <div className="w-48 sm:w-56 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 overflow-y-auto p-4 gap-4 z-10 shadow-xl transition-all">
             
             {localStream && !mainIsLocal && (
                <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative shrink-0 border-2 border-blue-500">
                  <VideoPlayer stream={localStream} isLocal={true} volume={globalVolume} isScreen={isScreenSharing} />
                  <div className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 text-[10px] rounded font-medium">Vous</div>
                  {!isAudioEnabled && (
                    <div className="absolute top-1 right-1 bg-red-600 p-1 rounded-full"><MicOff className="w-3 h-3 text-white"/></div>
                  )}
                </div>
             )}

             {Object.entries(peers).map(([peerId, stream]) => {
                if (stream === mainStream) return null;

                return (
                  <div key={peerId} className="w-full aspect-video bg-black rounded-lg overflow-hidden relative shrink-0 border border-gray-700">
                    <VideoPlayer stream={stream} isLocal={false} volume={globalVolume} />
                    <div className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 text-[10px] rounded font-medium">Participant</div>
                  </div>
                )
             })}

             {/* Fallback if no streams are displayed in the sidebar */}
             {!(localStream && !mainIsLocal) && Object.entries(peers).filter(([_, s]) => s !== mainStream).length === 0 && (
               <div className="flex flex-col items-center justify-center text-center text-gray-500 py-10 px-2 gap-2 border border-dashed border-gray-800 rounded-lg">
                 <Camera className="w-6 h-6 opacity-30" />
                 <p className="text-xs">Aucune webcam active</p>
               </div>
             )}
          </div>
        )}

        {/* Chat Sidebar */}
        {chatOpen && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col shrink-0 transition-all z-20">
            <div className="p-4 border-b border-gray-700 font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Chat
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => {
                const isMe = msg.sender === socketId;
                return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl max-w-[90%] break-words text-sm ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 bg-gray-900">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 bg-gray-800 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                />
                <button type="submit" className="p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Controls Toolbar (Panneau de Contrôle) */}
      <footer className="h-20 bg-gray-900 flex items-center justify-between px-8 border-t border-gray-800 shrink-0 z-20">
        
        {/* Left: Volume control */}
        <div className="flex items-center gap-3 w-1/3">
           {globalVolume === 0 ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-gray-400" />}
           <input 
             type="range" 
             min="0" 
             max="1" 
             step="0.01" 
             value={globalVolume} 
             onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
             className="w-32 accent-blue-600"
           />
        </div>

        {/* Center: Media Controls */}
        <div className="flex items-center justify-center gap-4 w-1/3">
          <button 
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-colors shadow-lg ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            title={isAudioEnabled ? "Désactiver le micro" : "Activer le micro"}
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6 text-white" />}
          </button>
          
          <button 
            onClick={toggleVideo}
            disabled={isScreenSharing}
            className={`p-4 rounded-full transition-colors shadow-lg ${isVideoEnabled && !isScreenSharing ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} ${isScreenSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isVideoEnabled ? "Désactiver la caméra" : "Activer la caméra"}
          >
            {isVideoEnabled && !isScreenSharing ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6 text-white" />}
          </button>

          {isHost && (
            <>
              <button 
                onClick={toggleScreenShare}
                className={`p-4 rounded-full transition-colors shadow-lg ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                title={isScreenSharing ? "Arrêter le partage" : "Partager l'écran"}
              >
                {isScreenSharing ? <VideoOff className="w-6 h-6 text-white" /> : <Monitor className="w-6 h-6" />}
              </button>

              <button 
                onClick={handleToggleBrowserMode}
                className={`p-4 rounded-full transition-colors shadow-lg ${isBrowserMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                title={isBrowserMode ? "Fermer le navigateur" : "Ouvrir un navigateur interne"}
              >
                <Globe className="w-6 h-6 text-white" />
              </button>
            </>
          )}
        </div>

        {/* Right: Empty for balance */}
        <div className="w-1/3 flex justify-end"></div>

      </footer>
    </div>
  );
}
