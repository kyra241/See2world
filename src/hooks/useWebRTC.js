import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export const useWebRTC = (roomId) => {
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socketId, setSocketId] = useState(null);
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // State for browser synchronization
  const [browserState, setBrowserState] = useState({ isBrowserMode: false, currentUrl: '' });

  const [isHost, setIsHost] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [hostId, setHostId] = useState(null);

  const socketRef = useRef();
  const peersRef = useRef({});
  const localStreamRef = useRef(localStream);

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
      socketRef.current.emit('join-room', roomId);
    });

    socketRef.current.on('room-info', (data) => {
      console.log('Received room-info:', data);
      setIsHost(data.isHost);
      setParticipantCount(data.participantCount);
      setHostId(data.hostId);
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
    });

    socketRef.current.on('user-connected', async (userId) => {
      const peerConnection = createPeerConnection(userId);
      peersRef.current[userId] = peerConnection;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socketRef.current.emit('offer', {
        target: userId,
        caller: socketRef.current.id,
        sdp: peerConnection.localDescription
      });
    });

    socketRef.current.on('offer', async (payload) => {
      const peerConnection = createPeerConnection(payload.caller);
      peersRef.current[payload.caller] = peerConnection;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socketRef.current.emit('answer', {
        target: payload.caller,
        caller: socketRef.current.id,
        sdp: peerConnection.localDescription
      });
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
    });

    socketRef.current.on('chat-message', (payload) => {
      // Éviter les doublons de messages pour l'expéditeur
      if (payload.sender === socketRef.current.id) return;
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
  }, [roomId]);

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
      setPeers((prev) => ({
        ...prev,
        [userId]: event.streams[0]
      }));
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
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
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
    if (!socketRef.current) return;
    const payload = {
      roomId,
      sender: socketRef.current.id || 'me',
      text,
      timestamp: Date.now()
    };
    
    // Afficher localement immédiatement pour le destinataire
    setMessages((prev) => [...prev, payload]);
    
    // Envoyer aux autres participants de la salle
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
    hostId
  };
};
