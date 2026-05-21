import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export const useWebRTC = (roomId, onNotification, isCreator = false) => {
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socketId, setSocketId] = useState(null);
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // State for browser synchronization
  const [browserState, setBrowserState] = useState({ isBrowserMode: false, currentUrl: '' });

  // Start with creator assumed host until server confirms otherwise
  const [isHost, setIsHost] = useState(isCreator);
  const [participantCount, setParticipantCount] = useState(1);
  const [hostId, setHostId] = useState(null);
  const [role, setRole] = useState(isCreator ? 'host' : 'participant');

  const socketRef = useRef();
  const peersRef = useRef({});
  const localStreamRef = useRef(localStream);
  const pendingMessagesRef = useRef([]);

  // Sync the ref with the state so we always have the latest localStream
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    const SERVER_URL = import.meta.env.VITE_SERVER_URL || 
      (import.meta.env.PROD ? 'https://see2world.bonto.run' : 'http://localhost:3001');
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
      setSocketId(socketRef.current.id);
      console.log(`Joining room ${roomId} (isCreator: ${isCreator})`);
      socketRef.current.emit('join-room', { roomId, isCreator });
    });

    socketRef.current.on('room-info', (data) => {
      console.log('Received room-info:', data);
      // Server is authoritative about host assignment
      setIsHost(data.isHost);
      setParticipantCount(data.participantCount);
      setHostId(data.hostId);
      setRole(data.role || (data.isHost ? 'host' : 'participant'));

      // Flush any pending chat messages queued while connecting
      if (pendingMessagesRef.current.length > 0) {
        pendingMessagesRef.current.forEach(m => setMessages(prev => [...prev, m]));
        pendingMessagesRef.current = [];
      }
    });

    socketRef.current.on('room-count', (data) => {
      console.log('Received room-count:', data);
      setParticipantCount(data.participantCount);
    });

    socketRef.current.on('host-changed', (data) => {
      console.log('Host changed:', data);
      const amIHost = socketRef.current.id === data.newHostId;
      setIsHost(amIHost);
      setHostId(data.newHostId);
      setRole(amIHost ? 'host' : 'participant');
      if (onNotification) {
        onNotification(amIHost ? "Vous êtes maintenant l'hôte de la salle !" : "Un nouvel hôte a été désigné.");
      }
    });

    socketRef.current.on('room-not-found', () => {
      if (onNotification) {
        onNotification("❌ Salle introuvable. Vérifiez le code et réessayez.");
      }
      setTimeout(() => window.history.back(), 2000);
    });

    socketRef.current.on('user-connected', async (userId) => {
      console.log('User connected socket event:', userId);
      let peerConnection = peersRef.current[userId];
      if (!peerConnection) {
        peerConnection = createPeerConnection(userId);
        peersRef.current[userId] = peerConnection;
      }

      if (onNotification) {
        onNotification("Un participant a rejoint la salle !");
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      } else {
        // If we don't have a local stream, trigger the initial negotiation manually
        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socketRef.current.emit('offer', {
            target: userId,
            caller: socketRef.current.id,
            sdp: peerConnection.localDescription
          });
        } catch (err) {
          console.error('Error creating initial offer:', err);
        }
      }
    });

    socketRef.current.on('offer', async (payload) => {
      console.log('Received offer socket event from:', payload.caller);
      let peerConnection = peersRef.current[payload.caller];
      if (!peerConnection) {
        peerConnection = createPeerConnection(payload.caller);
        peersRef.current[payload.caller] = peerConnection;

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStreamRef.current);
          });
        }
      }

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socketRef.current.emit('answer', {
          target: payload.caller,
          caller: socketRef.current.id,
          sdp: peerConnection.localDescription
        });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socketRef.current.on('answer', async (payload) => {
      const peerConnection = peersRef.current[payload.caller];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
    });

    socketRef.current.on('ice-candidate', async (payload) => {
      const peerConnection = peersRef.current[payload.caller];
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    });

    socketRef.current.on('user-disconnected', (userId) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
        setPeers((prev) => {
          const newPeers = { ...prev };
          delete newPeers[userId];
          return newPeers;
        });
      }
      if (onNotification) {
        onNotification("Un participant a quitté la salle.");
      }
    });

    socketRef.current.on('chat-message', (payload) => {
      setMessages((prev) => [...prev, payload]);
    });

    socketRef.current.on('browser-sync', (payload) => {
      setBrowserState({
        isBrowserMode: payload.isBrowserMode,
        currentUrl: payload.currentUrl
      });
    });

    return () => {
      socketRef.current.disconnect();
      Object.values(peersRef.current).forEach(peer => peer.close());
    };
  }, [roomId, isCreator]);

  const createPeerConnection = (userId) => {
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', {
          target: userId,
          caller: socketRef.current.id,
          candidate: event.candidate
        });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Received track from peer:', userId, event.streams[0]);
      setPeers((prev) => ({
        ...prev,
        [userId]: event.streams[0]
      }));
    };

    peerConnection.onnegotiationneeded = async () => {
      try {
        console.log('Negotiation needed for peer:', userId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socketRef.current.emit('offer', {
          target: userId,
          caller: socketRef.current.id,
          sdp: peerConnection.localDescription
        });
      } catch (err) {
        console.error('onnegotiationneeded error:', err);
      }
    };

    return peerConnection;
  };

  const updatePeerTracks = (stream) => {
    Object.values(peersRef.current).forEach(peerConnection => {
      stream.getTracks().forEach(track => {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          peerConnection.addTrack(track, stream);
        }
      });
    });
  };

  const toggleAudio = async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      } else {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const newAudioTrack = newStream.getAudioTracks()[0];
          localStream.addTrack(newAudioTrack);
          updatePeerTracks(localStream);
          setIsAudioEnabled(true);
        } catch(e) {}
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);
        setIsAudioEnabled(true);
        updatePeerTracks(stream);
      } catch (err) {}
    }
  };

  const toggleVideo = async () => {
    if (isScreenSharing) return;

    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      } else {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = newStream.getVideoTracks()[0];
          localStream.addTrack(newVideoTrack);
          updatePeerTracks(localStream);
          setIsVideoEnabled(true);
        } catch (e) {}
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);
        updatePeerTracks(stream);
      } catch (err) {}
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopMedia();
    } else {
      try {
        let stream;
        if (ipcRenderer) {
          console.log("Electron environment detected, using automatic window capture...");
          const sourceId = await ipcRenderer.invoke('get-self-source-id');
          if (!sourceId) {
            throw new Error("Impossible de trouver la source de capture de l'application.");
          }
          
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
                minWidth: 1280,
                maxWidth: 1920,
                minHeight: 720,
                maxHeight: 1080
              }
            }
          });
        } else {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        setLocalStream(stream);
        setIsScreenSharing(true);
        setIsVideoEnabled(true);
        
        const audioTrack = stream.getAudioTracks()[0];
        setIsAudioEnabled(!!audioTrack);

        stream.getVideoTracks()[0].onended = () => {
          stopMedia();
        };

        updatePeerTracks(stream);
      } catch (err) {
        console.error("Error sharing screen:", err);
        if (onNotification) {
          onNotification("Échec du partage d'écran : " + err.message);
        }
      }
    }
  };

  const stopMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
      setIsScreenSharing(false);
    }
  }, [localStream]);

  const sendMessage = (text) => {
    if (!socketRef.current || !socketRef.current.connected) {
      // If not yet connected, queue messages locally to show them when we reconnect
      const payload = {
        roomId,
        sender: 'local',
        senderLabel: 'Moi',
        text,
        timestamp: Date.now()
      };
      pendingMessagesRef.current.push(payload);
      setMessages((prev) => [...prev, payload]);
      return;
    }

    const payload = {
      roomId,
      sender: socketRef.current.id,
      senderLabel: 'Moi',
      text,
      timestamp: Date.now()
    };
    
    // Add locally for the sender immediately
    setMessages((prev) => [...prev, payload]);
    
    // Broadcast to others (server uses socket.to so sender won't get it back)
    socketRef.current.emit('chat-message', payload);
  };

  const syncBrowser = (isBrowserMode, currentUrl) => {
    setBrowserState({ isBrowserMode, currentUrl });
    if (socketRef.current) {
      socketRef.current.emit('browser-sync', {
        roomId,
        isBrowserMode,
        currentUrl
      });
    }
  };

  return {
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
    hostId,
    role
  };
};
