import { useState, useMemo } from 'react';
import type { GameState } from '../game/gameLogic';
import {
  initializeLevel,
  canMove,
  moveBall,
  checkWinCondition
} from '../game/gameLogic';

export function useGameState(initialLevelNumber: number = 1) {
  const [currentLevel, setCurrentLevel] = useState<number>(initialLevelNumber);
  const [currentState, setCurrentState] = useState<GameState>(() => 
    initializeLevel(initialLevelNumber)
  );
  const [history, setHistory] = useState<GameState[]>([]);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [selectedTubeIndex, setSelectedTubeIndex] = useState<number | null>(null);

  // Compute if the game is won
  const isWon = useMemo(() => checkWinCondition(currentState), [currentState]);

  /**
   * Loads a specific level and resets the state
   */
  const loadLevel = (levelNumber: number) => {
    setCurrentLevel(levelNumber);
    setCurrentState(initializeLevel(levelNumber));
    setHistory([]);
    setMoveCount(0);
    setSelectedTubeIndex(null);
  };

  /**
   * Resets the current level to its starting state
   */
  const reset = () => {
    setCurrentState(initializeLevel(currentLevel));
    setHistory([]);
    setMoveCount(0);
    setSelectedTubeIndex(null);
  };

  /**
   * Undoes the last valid move
   */
  const undo = () => {
    if (history.length === 0) return;

    const previousState = history[history.length - 1];
    setHistory(prevHistory => prevHistory.slice(0, -1));
    setCurrentState(previousState);
    setMoveCount(prev => Math.max(0, prev - 1));
    setSelectedTubeIndex(null);
  };

  /**
   * Handles user interaction when selecting or targetting a tube.
   * Returns a boolean indicating if a move was successfully executed.
   */
  const selectTube = (tubeIndex: number): boolean => {
    // If the game is already won, ignore inputs
    if (isWon) return false;

    // Boundary check
    if (tubeIndex < 0 || tubeIndex >= currentState.length) return false;

    if (selectedTubeIndex === null) {
      // First click: Select the top ball of the tube (if it's not empty)
      if (currentState[tubeIndex].length > 0) {
        setSelectedTubeIndex(tubeIndex);
        return true;
      }
      return false;
    } else {
      // Second click: Target tube selection
      if (selectedTubeIndex === tubeIndex) {
        // Clicking same tube deselects it
        setSelectedTubeIndex(null);
        return true;
      }

      // Check if the move is legal
      if (canMove(selectedTubeIndex, tubeIndex, currentState)) {
        // Save current state to history stack for Undo functionality
        setHistory(prev => [...prev, currentState]);
        
        // Execute the move
        const nextState = moveBall(selectedTubeIndex, tubeIndex, currentState);
        setCurrentState(nextState);
        setMoveCount(prev => prev + 1);
        setSelectedTubeIndex(null);
        return true;
      } else {
        // If the move is invalid, but the clicked tube contains balls:
        // Transition the selection to this new tube instead of failing silently.
        // This is a premium UX feature that makes selection-switching fluid.
        if (currentState[tubeIndex].length > 0) {
          setSelectedTubeIndex(tubeIndex);
          return true;
        } else {
          // Clicked an empty tube that is invalid, just deselect
          setSelectedTubeIndex(null);
          return false;
        }
      }
    }
  };

  return {
    currentState,
    currentLevel,
    moveCount,
    selectedTubeIndex,
    isWon,
    historyLength: history.length,
    loadLevel,
    reset,
    undo,
    selectTube
  };
}
