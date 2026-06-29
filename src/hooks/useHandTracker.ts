import { useState, useEffect, useRef } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export interface HandCoords {
  x: number;
  y: number;
  pinch: boolean;
}

export function useHandTracker() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [pinchActive, setPinchActive] = useState(false);
  const [handCoords, setHandCoords] = useState<HandCoords>({ x: 50, y: 50, pinch: false });

  // Refs for tracking elements and landmarker
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const prevCoordsRef = useRef({ x: 50, y: 50 });
  const pinchActiveRef = useRef(false);

  // Initialize MediaPipe Hand Landmarker on mount
  useEffect(() => {
    async function initMediaPipe() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Resolve Fileset for Vision tasks from official CDN jsdelivr
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );

        // Create Hand Landmarker instance
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.7,
          minHandPresenceConfidence: 0.7,
          minTrackingConfidence: 0.7
        });

        landmarkerRef.current = landmarker;
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize MediaPipe Hand Landmarker:', err);
        setError('Failed to load computer vision model. Please check connection.');
        setIsLoading(false);
      }
    }

    initMediaPipe();

    // Clean up animation frame loop and camera tracks on unmount
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async (
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement
  ) => {
    if (!landmarkerRef.current) {
      setError('Model not initialized yet.');
      return;
    }

    videoRef.current = videoElement;
    canvasRef.current = canvasElement;

    try {
      setError(null);
      
      // Request video with standard constraints
      console.log("[DEBUG] 2. Requesting getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });

      streamRef.current = stream;
      videoElement.srcObject = stream;
      
      // Set properties to satisfy browser mobile/autoplay policies
      videoElement.playsInline = true;
      videoElement.muted = true;
      
      // Promise to coordinate metadata loading
      const metadataLoaded = new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => {
          console.log('Video metadata loaded. Dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
          if (canvasElement) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
          }
          resolve();
        };
      });

      // Crucial Fix: Call play() after attaching the stream to srcObject
      console.log('Invoking video.play()...');
      await videoElement.play();
      
      // Wait for metadata (dimensions) to be ready
      await metadataLoaded;

      setIsCameraActive(true);
      console.log("[DEBUG] 3. Camera stream acquired!");
      console.log('Webcam active. Initializing MediaPipe loop...');
      
      // Start processing frame loops only after metadata is loaded and video is active
      requestRef.current = requestAnimationFrame(predictFrame);
    } catch (err: any) {
      console.error("[DEBUG] 4. Camera failed:", err);
      setError(`Camera access failed: ${err.message || err.name || 'Permission Denied'}`);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    // Stop webcam tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Cancel next frame updates
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    // Reset tracking indicators
    setIsCameraActive(false);
    setPinchActive(false);
    setHandCoords({ x: 50, y: 50, pinch: false });
  };

  // Main frame processor
  const predictFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker || video.paused) {
      requestRef.current = requestAnimationFrame(predictFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame(predictFrame);
      return;
    }

    // Clear the overlay canvas before drawing new hand landmarks
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Make sure we have frames to process
    if (video.readyState >= 2) {
      const startTimeMs = performance.now();
      const results = landmarker.detectForVideo(video, startTimeMs);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];

        // 1. PINCH DETECTION LOGIC
        // Tip of Thumb (Landmark 4) and Tip of Index (Landmark 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const wrist = landmarks[0];
        const middleBase = landmarks[9]; // Middle finger MCP joint

        // Euclidean distance in 3D space
        const distance3d = Math.sqrt(
          Math.pow(thumbTip.x - indexTip.x, 2) +
          Math.pow(thumbTip.y - indexTip.y, 2) +
          Math.pow(thumbTip.z - indexTip.z, 2)
        );

        // Hand scale factor (distance between wrist and middle finger MCP joint)
        const handScale = Math.sqrt(
          Math.pow(wrist.x - middleBase.x, 2) +
          Math.pow(wrist.y - middleBase.y, 2) +
          Math.pow(wrist.z - middleBase.z, 2)
        );

        // Normalize distance by hand size to prevent scale issues
        const normalizedPinchRatio = distance3d / handScale;

        // Hysteresis threshold logic to prevent sticky releases
        const PINCH_START_THRESHOLD = 0.16;   // Requires closer fingers to initiate Grab
        const PINCH_RELEASE_THRESHOLD = 0.26; // Allows relaxed fingers before Drop
        
        let isPinching = pinchActiveRef.current;
        if (isPinching) {
          if (normalizedPinchRatio > PINCH_RELEASE_THRESHOLD) {
            isPinching = false;
          }
        } else {
          if (normalizedPinchRatio < PINCH_START_THRESHOLD) {
            isPinching = true;
          }
        }

        if (isPinching !== pinchActiveRef.current) {
          pinchActiveRef.current = isPinching;
          setPinchActive(isPinching);
          if (isPinching) {
            console.log('[DEBUG] 3. PINCH DETECTED');
          } else {
            console.log('[DEBUG] 3. PINCH RELEASED');
          }
        }

        // 2. COORDINATE POINTER CALCULATION
        // We use the midpoint of index tip and thumb tip as the pointer coordinate
        const midX = (thumbTip.x + indexTip.x) / 2;
        const midY = (thumbTip.y + indexTip.y) / 2;

        // Mirror coordinates for intuitive user controls (since video is user-facing)
        const xPercent = (1 - midX) * 100;
        const yPercent = midY * 100;

        const rawX = Math.max(0, Math.min(100, xPercent));
        const rawY = Math.max(0, Math.min(100, yPercent));

        // Exponential moving average filter for coordinate smoothing (70% previous, 30% new)
        const smoothX = prevCoordsRef.current.x * 0.7 + rawX * 0.3;
        const smoothY = prevCoordsRef.current.y * 0.7 + rawY * 0.3;

        prevCoordsRef.current = { x: smoothX, y: smoothY };

        setHandCoords({
          x: smoothX,
          y: smoothY,
          pinch: isPinching
        });

        // 3. HAND SKELETON RENDERING
        drawSkeleton(ctx, landmarks, canvas.width, canvas.height, isPinching);
      } else {
        // No hand visible
        setPinchActive(false);
      }
    }

    requestRef.current = requestAnimationFrame(predictFrame);
  };

  // Helper method to draw hand wireframe on canvas context
  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number,
    isPinching: boolean
  ) => {
    // Skeletal paths defined by landmark indices
    const connections = [
      [0, 1, 2, 3, 4],       // Thumb
      [0, 5, 6, 7, 8],       // Index
      [5, 9, 10, 11, 12],    // Middle
      [9, 13, 14, 15, 16],   // Ring
      [13, 17, 18, 19, 20],  // Pinky
      [0, 17]                // Palm bottom connection
    ];

    // Neon purple/blue connections
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 4;
    ctx.shadowColor = isPinching ? '#14b8a6' : '#a855f7'; // Teal glow for pinch, Purple for open

    connections.forEach(path => {
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const landmark = landmarks[path[i]];
        // Mirror drawing coordinates to match mirrored video
        const x = (1 - landmark.x) * width;
        const y = landmark.y * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = isPinching ? 'rgba(20, 184, 166, 0.65)' : 'rgba(168, 85, 247, 0.65)';
      ctx.stroke();
    });

    // Draw joints as smaller glowing circles
    landmarks.forEach((landmark, idx) => {
      const x = (1 - landmark.x) * width;
      const y = landmark.y * height;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      
      // Give pinch indicators special styles
      if (idx === 4 || idx === 8) {
        ctx.fillStyle = isPinching ? '#22d3ee' : '#e9d5ff'; // Cyan for pinch fingers
        ctx.shadowBlur = 8;
        ctx.arc(x, y, 2, 0, 2 * Math.PI); // Additional circle layer
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 2;
      }
      ctx.fill();
    });

    // Reset shadow properties for other rendering operations
    ctx.shadowBlur = 0;
  };

  return {
    isLoading,
    error,
    isCameraActive,
    pinchActive,
    handCoords,
    startCamera,
    stopCamera
  };
}
