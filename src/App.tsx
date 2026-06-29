import { useState, useRef, useEffect } from 'react'
import { 
  Camera, 
  Sparkles, 
  HelpCircle, 
  Volume2, 
  Tv, 
  Cpu, 
  Hand,
  Play,
  RotateCcw,
  Undo2,
  RefreshCw
} from 'lucide-react'
import { useGameState } from './hooks/useGameState'
import { useHandTracker } from './hooks/useHandTracker'
import { canMove } from './game/gameLogic'

function App() {
  // Core game state hooks
  const {
    currentState: tubes,
    currentLevel,
    moveCount,
    selectedTubeIndex,
    isWon,
    historyLength,
    loadLevel,
    reset: handleReset,
    undo: handleUndo,
    selectTube
  } = useGameState(1);

  // Computer Vision model tracking hook
  const {
    isLoading: isModelLoading,
    error: trackerError,
    isCameraActive,
    pinchActive,
    handCoords: realHandCoords,
    startCamera,
    stopCamera
  } = useHandTracker();

  // Refs for HTML5 video stream and canvas overlay rendering
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // DOM References for each tube to calculate screen bounding boxes dynamically
  const tubeRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Interaction and simulation states
  const [gestureStatus, setGestureStatus] = useState<string>('Ready (Webcam stopped)');
  const [simulatedCoords, setSimulatedCoords] = useState({ x: 50, y: 50, pinch: false });
  const [isSimulating, setIsSimulating] = useState(false);
  const [hoveredTubeIndex, setHoveredTubeIndex] = useState<number | null>(null);

  // Keep track of previous pinch state to detect transition edges (Grab/Drop)
  const prevPinchRef = useRef(false);

  // Determine pointer coordinates (prefer real CV camera tracking, fallback to simulation)
  const activeHandCoords = isCameraActive ? realHandCoords : simulatedCoords;
  const isPinchActive = isCameraActive ? pinchActive : simulatedCoords.pinch;

  // 1. COLLISION DETECTION LOOP
  // Calculates which tube (if any) the hand cursor is hovering over
  useEffect(() => {
    const clientX = (activeHandCoords.x / 100) * window.innerWidth;
    const clientY = (activeHandCoords.y / 100) * window.innerHeight;

    let foundIndex: number | null = null;
    
    tubeRefs.current.forEach((el, index) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          foundIndex = index;
        }
      }
    });

    setHoveredTubeIndex(foundIndex);
  }, [activeHandCoords]);

  // 2. GESTURE TO GAME STATE LINKER
  // Intercepts pinch/release transitions and executes select, drag, or drop
  useEffect(() => {
    const prevPinch = prevPinchRef.current;
    
    if (isPinchActive && !prevPinch) {
      // EDGE TRANSITION: Pinch detected (Grab action)
      if (hoveredTubeIndex !== null && selectedTubeIndex === null) {
        if (tubes[hoveredTubeIndex].length > 0) {
          selectTube(hoveredTubeIndex);
        }
      }
    } else if (!isPinchActive && prevPinch) {
      // EDGE TRANSITION: Pinch released (Drop action)
      if (selectedTubeIndex !== null) {
        if (hoveredTubeIndex !== null && hoveredTubeIndex !== selectedTubeIndex) {
          // If released over a valid target, execute the move
          if (canMove(selectedTubeIndex, hoveredTubeIndex, tubes)) {
            selectTube(hoveredTubeIndex);
          } else {
            // Invalid move, snap ball back
            selectTube(selectedTubeIndex);
          }
        } else {
          // Released over same tube or empty space, snap ball back
          selectTube(selectedTubeIndex);
        }
      }
    }

    prevPinchRef.current = isPinchActive;
  }, [isPinchActive, hoveredTubeIndex, selectedTubeIndex, tubes]);

  // Sync real-time vision status text when not in grab/drop transitions
  useEffect(() => {
    if (isCameraActive) {
      if (pinchActive) {
        setGestureStatus('PINCH (Grabbed Ball)');
      } else {
        setGestureStatus('Hand Detected (Open)');
      }
    } else {
      if (!isSimulating) {
        setGestureStatus('Webcam Stopped');
      }
    }
  }, [isCameraActive, pinchActive, isSimulating]);

  // Handle start/stop camera actions respecting browser privacy policies
  const handleToggleCamera = () => {
    console.log("[DEBUG] 1. Enable Webcam button clicked! Current isCameraActive state:", isCameraActive);
    console.log("[DEBUG] DOM Refs check - Video Ref:", videoRef.current, "Canvas Ref:", canvasRef.current);
    
    if (isCameraActive) {
      console.log("[DEBUG] Stopping webcam stream...");
      stopCamera();
    } else {
      if (videoRef.current && canvasRef.current) {
        console.log("[DEBUG] Refs exist, calling startCamera...");
        startCamera(videoRef.current, canvasRef.current);
      } else {
        console.warn("[DEBUG] Error: Cannot start camera, video/canvas DOM refs are NULL!");
      }
    }
  };

  // Simulation control loops for validation
  const simulateGesture = () => {
    if (isWon || isCameraActive || isSimulating) return;
    setIsSimulating(true);
    setGestureStatus('Simulating: Detecting hand...');

    // We simulate coordinates moving over Tube 1, grabbing, dragging to Tube 4, and releasing
    setTimeout(() => {
      setSimulatedCoords({ x: 17, y: 55, pinch: false });
      
      setTimeout(() => {
        setSimulatedCoords({ x: 17, y: 55, pinch: true });
        setGestureStatus('Simulating: Pinch Grab (Tube 1)');
        
        setTimeout(() => {
          setSimulatedCoords({ x: 57, y: 40, pinch: true });
          setGestureStatus('Simulating: Dragging...');
          
          setTimeout(() => {
            setSimulatedCoords({ x: 57, y: 55, pinch: false });
            setGestureStatus('Simulating: Released (Tube 4)');
            setIsSimulating(false);
          }, 1500);
        }, 1500);
      }, 1000);
    }, 1000);
  };

  // Ball color mapper for tailwind styling classes
  const getBallStyles = (color: string) => {
    switch (color) {
      case 'red':
        return 'bg-gradient-to-tr from-rose-600 to-rose-400 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.5),0_0_12px_rgba(244,63,94,0.6)] text-rose-100';
      case 'blue':
        return 'bg-gradient-to-tr from-sky-600 to-sky-400 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.5),0_0_12px_rgba(56,189,248,0.6)] text-sky-100';
      case 'green':
        return 'bg-gradient-to-tr from-emerald-600 to-emerald-400 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.5),0_0_12px_rgba(52,211,153,0.6)] text-emerald-100';
      case 'yellow':
        return 'bg-gradient-to-tr from-amber-500 to-amber-300 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.5),0_0_12px_rgba(251,191,36,0.6)] text-amber-900';
      case 'purple':
        return 'bg-gradient-to-tr from-purple-600 to-purple-400 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.5),0_0_12px_rgba(168,85,247,0.6)] text-purple-100';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="relative min-h-screen w-screen bg-[#07080f] text-slate-100 font-sans overflow-hidden flex flex-col">
      
      {/* Background Decorative Glow Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-900/10 blur-[120px] animate-glow-1 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-900/10 blur-[150px] animate-glow-2 pointer-events-none" />
      <div className="absolute top-[40%] left-[35%] w-[30vw] h-[30vw] rounded-full bg-teal-900/5 blur-[100px] pointer-events-none" />

      {/* Header bar */}
      <header className="glass-panel relative z-10 mx-6 mt-6 px-6 py-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-900/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-wide bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Gesture Ball Sort Puzzle
            </h1>
            <p className="text-xs text-purple-400/80 font-medium font-mono">v1.0.0 Stable</p>
          </div>
        </div>

        {/* Level Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900/40 p-1 rounded-xl border border-white/5">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold px-2">Levels:</span>
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              onClick={() => {
                loadLevel(lvl);
                stopCamera();
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentLevel === lvl
                  ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lvl {lvl}
            </button>
          ))}
        </div>

        {/* Game Info Panel */}
        <div className="flex items-center gap-6 bg-slate-900/40 px-5 py-2 rounded-xl border border-white/5 text-sm">
          <div>
            <span className="text-slate-400 text-xs uppercase tracking-wider block">Moves</span>
            <span className="font-display font-bold text-lg text-white">{moveCount}</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className="text-slate-400 text-xs uppercase tracking-wider block">System Status</span>
            <span className="font-medium text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleUndo}
            disabled={historyLength === 0}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer shadow-md active:scale-95 transition-all ${
              historyLength === 0 
                ? 'bg-slate-800/40 border-white/5 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-800 border-white/10 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>

          <button 
            onClick={() => {
              handleReset();
              stopCamera();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-xs font-semibold text-slate-200 border border-white/5 cursor-pointer shadow-md"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          
          <button className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 cursor-pointer">
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-h-[calc(100vh-120px)] relative z-10 overflow-y-auto lg:overflow-hidden">
        
        {/* LEFT PANEL: Game Board Area (Col span 7/12) */}
        <section className="lg:col-span-7 xl:col-span-8 glass-panel rounded-3xl p-8 flex flex-col justify-between min-h-[450px] relative overflow-hidden">
          
          {/* HIGH-FIDELITY WIN SCREEN CELEBRATION OVERLAY */}
          {isWon && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl rounded-3xl flex flex-col items-center justify-center text-center p-6 z-20 transition-all duration-500 animate-fade-in">
              
              {/* Floating Confetti Particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-2 h-2 bg-pink-500 rounded-full left-[10%] animate-confetti-1" />
                <div className="absolute w-2.5 h-1 bg-yellow-400 rounded-sm left-[22%] animate-confetti-2" />
                <div className="absolute w-1.5 h-3 bg-cyan-400 rounded-sm left-[38%] animate-confetti-3" />
                <div className="absolute w-2 h-2 bg-emerald-400 rounded-full left-[55%] animate-confetti-1" />
                <div className="absolute w-2 h-1.5 bg-purple-500 rounded-sm left-[70%] animate-confetti-2" />
                <div className="absolute w-3 h-1 bg-amber-400 rounded-sm left-[88%] animate-confetti-3" />
              </div>

              {/* Glowing Icon Card */}
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(16,185,129,0.4)] animate-bounce">
                <Sparkles className="w-12 h-12 text-white" />
                <div className="absolute inset-0 rounded-3xl border border-white/20 animate-ping opacity-30" />
              </div>

              <h3 className="font-display font-black text-4xl text-white mb-2 tracking-wide uppercase bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                YOU WIN!
              </h3>
              
              <p className="text-slate-300 text-sm max-w-sm mb-8 font-medium">
                Level {currentLevel} complete! You solved the puzzle in <strong className="text-emerald-400 text-base">{moveCount}</strong> total moves.
              </p>

              <div className="flex gap-4 relative z-30">
                <button
                  onClick={() => {
                    handleReset();
                    stopCamera();
                  }}
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md"
                >
                  Play Again
                </button>
                {currentLevel < 3 ? (
                  <button
                    onClick={() => loadLevel(currentLevel + 1)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-lg shadow-purple-900/30"
                  >
                    Next Level
                  </button>
                ) : (
                  <button
                    onClick={() => loadLevel(1)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-405 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-900/30"
                  >
                    Restart Lvl 1
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Top of board bar */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
                <Tv className="w-5 h-5 text-purple-400" />
                Game Board
              </h2>
              <p className="text-slate-400 text-sm">Pinch to grab a ball, drag it to another tube, and release to drop it.</p>
            </div>
            
            {/* Interactive Legend / Hint */}
            <div className="text-xs bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg text-purple-300 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Webcam or Mouse Drag compatible!
            </div>
          </div>

          {/* Tube sorting sandbox */}
          <div className="flex-1 flex items-center justify-center gap-8 py-8 flex-wrap">
            {tubes.map((tube, index) => {
              const isSelected = selectedTubeIndex === index;
              const isHovered = hoveredTubeIndex === index;
              
              // Determine visual highlight style based on cursor actions
              const isValidTarget = selectedTubeIndex !== null && canMove(selectedTubeIndex, index, tubes);
              const isInvalidTarget = selectedTubeIndex !== null && !canMove(selectedTubeIndex, index, tubes) && index !== selectedTubeIndex;

              let borderHighlightClass = '';
              if (isSelected) {
                borderHighlightClass = 'border-purple-500 bg-purple-950/20 shadow-[0_0_20px_rgba(168,85,247,0.25)] scale-105';
              } else if (isHovered) {
                if (selectedTubeIndex === null) {
                  borderHighlightClass = 'border-purple-400 bg-white/[0.04] scale-102 shadow-[0_0_15px_rgba(168,85,247,0.2)]';
                } else if (isValidTarget) {
                  borderHighlightClass = 'border-emerald-500 bg-emerald-950/15 scale-102 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
                } else if (isInvalidTarget) {
                  borderHighlightClass = 'border-rose-500/80 bg-rose-950/10 scale-98 shadow-[0_0_12px_rgba(244,63,94,0.2)]';
                }
              } else {
                borderHighlightClass = 'border-white/10 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]';
              }

              return (
                <div 
                  key={index}
                  ref={(el) => {
                    tubeRefs.current[index] = el;
                  }}
                  onClick={() => selectTube(index)}
                  className={`group relative flex flex-col justify-end items-center cursor-pointer transition-all duration-300 ${borderHighlightClass}`}
                  style={{
                    width: '72px',
                    height: '240px',
                    borderWidth: '3px',
                    borderStyle: 'solid',
                    borderBottomLeftRadius: '36px',
                    borderBottomRightRadius: '36px',
                    borderTopWidth: '0px'
                  }}
                >
                  {/* Tube Rim Highlight */}
                  <div className={`absolute top-0 left-[-3px] right-[-3px] h-2.5 rounded-full transition-all duration-300 ${
                    isSelected ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' : 'bg-slate-700 group-hover:bg-slate-600'
                  }`} />
                  
                  {/* Selection Indicator Arrow */}
                  {isSelected && (
                    <div className="absolute -top-8 text-purple-400 animate-bounce">
                      <div className="w-3 h-3 border-r-2 border-b-2 border-purple-400 rotate-45 mx-auto" />
                    </div>
                  )}

                  {/* Balls inside the tube */}
                  <div className="flex flex-col-reverse justify-start items-center p-2 pb-3 w-full h-full gap-2.5">
                    {tube.map((color, idx) => {
                      // Hide the top ball if this tube is selected and we are active dragging (pinching)
                      const isTopBall = idx === tube.length - 1;
                      const isDragged = isSelected && isPinchActive && isTopBall;

                      return (
                        <div
                          key={idx}
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-display font-extrabold text-sm select-none transition-all duration-300 transform group-hover:scale-105 animate-drop-ball ${getBallStyles(color)} ${
                            isDragged ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100'
                          }`}
                        >
                          {color.substring(0, 1).toUpperCase()}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tube label ID */}
                  <div className="absolute -bottom-8 font-display text-slate-500 text-xs font-bold uppercase tracking-widest">
                    Tube {index + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Board Footer Controls */}
          <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex gap-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" /> Red</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_6px_#0ea5e9]" /> Blue</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" /> Green</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" /> Yellow</span>
              {currentLevel === 3 && (
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]" /> Purple</span>
              )}
            </div>
            
            <p>Hover and Pinch or click to sort.</p>
          </div>

        </section>

        {/* RIGHT PANEL: Camera Feed & Gestures (Col span 5/12) */}
        <section className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          
          {/* CAMERA FEED PANEL */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4 flex-1">
            <div className="flex justify-between items-center">
              <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <Camera className="w-4.5 h-4.5 text-purple-400" />
                Gesture Input Stream
              </h2>
              
              <button 
                onClick={handleToggleCamera}
                disabled={isModelLoading}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
                  isCameraActive 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                }`}
              >
                {isCameraActive ? 'Stop Webcam' : 'Enable Webcam'}
              </button>
            </div>

            {/* Webcam/Detection Canvas Container */}
            <div className="relative flex-1 bg-slate-950/80 rounded-2xl border border-white/5 overflow-hidden min-h-[240px] flex flex-col items-center justify-center text-center p-4">
              
              {/* MediaPipe Model loading spinner overlay */}
              {isModelLoading && (
                <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-mono">Loading MediaPipe Models...</span>
                </div>
              )}

              {/* Webcam Hardware errors */}
              {trackerError && (
                <div className="absolute inset-0 bg-slate-950/95 z-20 flex flex-col items-center justify-center p-4 text-center text-xs text-rose-400 gap-2">
                  <span className="font-bold uppercase tracking-wider text-rose-500">Camera Error</span>
                  <p>{trackerError}</p>
                </div>
              )}

              {/* Real WebCam Video Feed - always rendered to keep Ref populated */}
              <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] z-0 ${
                  isCameraActive ? 'block' : 'hidden pointer-events-none'
                }`}
                muted
                playsInline
              />

              {/* HTML5 Overlay Canvas - always rendered to keep Ref populated */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none ${
                  isCameraActive ? 'block' : 'hidden'
                }`}
              />

              {/* Camera Tracking Elements */}
              {isCameraActive && (
                <>
                  {/* Visual tracking crosshair for the pointer */}
                  <div 
                    className={`absolute w-8 h-8 rounded-full border-2 transition-all duration-100 pointer-events-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2 z-20 ${
                      isPinchActive 
                        ? 'border-emerald-400 bg-emerald-500/20 scale-90 shadow-[0_0_15px_#34d399]' 
                        : 'border-purple-400 bg-purple-500/10 scale-100 shadow-[0_0_10px_#a855f7]'
                    }`}
                    style={{
                      left: `${activeHandCoords.x}%`,
                      top: `${activeHandCoords.y}%`,
                    }}
                  >
                    <Hand className={`w-3.5 h-3.5 ${isPinchActive ? 'text-emerald-300 animate-pulse' : 'text-purple-300'}`} />
                  </div>
                </>
              )}

              {/* Idle Overlay when camera is stopped */}
              {!isCameraActive && (
                <>
                  {/* Idle/Simulated State Overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                  
                  <div className="z-10 flex flex-col items-center gap-3 p-6">
                    <div className="relative w-16 h-16 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center shadow-lg">
                      <Camera className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="text-slate-400 text-xs max-w-[200px]">
                      Click <strong className="text-purple-400">Enable Webcam</strong> above to test real-time gesture control, or test simulated gestures below.
                    </div>
                  </div>

                  {isSimulating && (
                    <>
                      {/* Simulated coordinate dot */}
                      <div 
                        className={`absolute w-8 h-8 rounded-full border-2 transition-all duration-300 pointer-events-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2 z-20 ${
                          isPinchActive 
                            ? 'border-emerald-400 bg-emerald-500/20 scale-90 shadow-[0_0_15px_#34d399]' 
                            : 'border-purple-400 bg-purple-500/10 scale-100 shadow-[0_0_10px_#a855f7]'
                        }`}
                        style={{
                          left: `${activeHandCoords.x}%`,
                          top: `${activeHandCoords.y}%`,
                        }}
                      >
                        <Hand className={`w-3.5 h-3.5 ${isPinchActive ? 'text-emerald-300' : 'text-purple-300'}`} />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Gesture Feedback Status bar */}
            <div className="bg-slate-900/60 rounded-xl px-4 py-2.5 border border-white/5 flex items-center justify-between text-xs font-mono text-slate-300">
              <span className="text-slate-500">Tracking Status:</span>
              <span className={`font-semibold ${isPinchActive ? 'text-emerald-400' : 'text-purple-400'}`}>
                {gestureStatus}
              </span>
            </div>

            {/* Gesture Simulator trigger */}
            <button
              onClick={simulateGesture}
              disabled={isWon || isCameraActive || isSimulating}
              className={`w-full py-2 px-4 rounded-xl text-xs font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isWon || isCameraActive || isSimulating
                  ? 'bg-slate-800/40 text-slate-500 border border-white/5 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 active:scale-98 shadow-purple-900/20'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Simulate Webcam Gesture Cycle
            </button>
          </div>

          {/* GESTURE INSTRUCTION CARD */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
            <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
              <HelpCircle className="w-4.5 h-4.5 text-purple-400" />
              How to Play (Gestures)
            </h2>
            
            <div className="flex flex-col gap-3 text-xs text-slate-300">
              <div className="flex gap-3 bg-slate-900/30 p-2.5 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-400 shrink-0">1</div>
                <div>
                  <p className="font-semibold text-slate-200">Grab Ball (Pinch)</p>
                  <p className="text-slate-400">Bring your thumb and index finger together over the tube you want to grab from.</p>
                </div>
              </div>

              <div className="flex gap-3 bg-slate-900/30 p-2.5 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-400 shrink-0">2</div>
                <div>
                  <p className="font-semibold text-slate-200">Drag Ball (Move)</p>
                  <p className="text-slate-400">Keep fingers pinched and move your hand left or right to position the ball over another tube.</p>
                </div>
              </div>

              <div className="flex gap-3 bg-slate-900/30 p-2.5 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-400 shrink-0">3</div>
                <div>
                  <p className="font-semibold text-slate-200">Drop Ball (Release)</p>
                  <p className="text-slate-400">Open your fingers (release pinch) to drop the ball down into the selected tube.</p>
                </div>
              </div>
            </div>
          </div>
          
        </section>
      </main>

      {/* GLOBAL SCREEN CURSOR (SPATIAL MAPPED VIEWPORT RING) */}
      <div 
        className={`fixed w-7 h-7 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 transition-all duration-75 ease-out ${
          isPinchActive 
            ? 'border-emerald-400 bg-emerald-500/30 scale-75 shadow-[0_0_20px_#34d399]' 
            : 'border-purple-400 bg-purple-500/10 scale-100 shadow-[0_0_15px_#a855f7]'
        }`}
        style={{
          left: `${activeHandCoords.x}%`,
          top: `${activeHandCoords.y}%`,
        }}
      >
        <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-2 transition-all ${isPinchActive ? 'bg-emerald-400' : 'bg-purple-400'}`} />
      </div>

      {/* FLOATING DRAGGED BALL OVERLAY */}
      {isPinchActive && selectedTubeIndex !== null && (
        (() => {
          const selectedTube = tubes[selectedTubeIndex];
          if (selectedTube && selectedTube.length > 0) {
            const draggedColor = selectedTube[selectedTube.length - 1];
            return (
              <div
                className={`fixed w-12 h-12 rounded-full flex items-center justify-center font-display font-extrabold text-sm pointer-events-none z-45 -translate-x-1/2 -translate-y-1/2 shadow-[0_12px_24px_rgba(0,0,0,0.6)] animate-pulse ${getBallStyles(draggedColor)}`}
                style={{
                  left: `${activeHandCoords.x}%`,
                  top: `${activeHandCoords.y}%`,
                }}
              >
                {draggedColor.substring(0, 1).toUpperCase()}
              </div>
            );
          }
          return null;
        })()
      )}

      {/* Footer copyright */}
      <footer className="text-center py-4 text-[10px] text-slate-600 font-mono relative z-10 border-t border-white/[0.02] bg-[#07080f]/80">
        © 2026 GESTURE BALL SORT PUZZLE • LEAD ENGINEER SCRATCHPAD
      </footer>
    </div>
  )
}

export default App
