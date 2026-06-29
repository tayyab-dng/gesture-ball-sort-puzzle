export type BallColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple';

export type Tube = BallColor[];

export type GameState = Tube[];

export const TUBE_MAX_CAPACITY = 4;

// Predefined solvable configurations for levels
const PREDEFINED_LEVELS: Record<number, GameState> = {
  1: [
    ['red', 'blue', 'green', 'red'],
    ['blue', 'green', 'red', 'blue'],
    ['green', 'red', 'blue', 'green'],
    [],
    []
  ],
  2: [
    ['red', 'blue', 'green', 'yellow'],
    ['yellow', 'red', 'blue', 'green'],
    ['green', 'yellow', 'red', 'blue'],
    ['blue', 'green', 'yellow', 'red'],
    [],
    []
  ],
  3: [
    ['red', 'blue', 'green', 'yellow'],
    ['purple', 'red', 'blue', 'green'],
    ['yellow', 'purple', 'red', 'blue'],
    ['green', 'yellow', 'purple', 'red'],
    ['blue', 'green', 'yellow', 'purple'],
    [],
    []
  ]
};

/**
 * Initializes the game state for a given level.
 * Level 1: 3 colors, 5 tubes
 * Level 2: 4 colors, 6 tubes
 * Level 3: 5 colors, 7 tubes
 */
export function initializeLevel(level: number): GameState {
  const levelState = PREDEFINED_LEVELS[level] || PREDEFINED_LEVELS[1];
  // Return deep copy to prevent mutation
  return levelState.map(tube => [...tube]);
}

/**
 * Determines if moving a ball from the source tube to the target tube is a legal move.
 */
export function canMove(
  sourceIndex: number,
  targetIndex: number,
  currentState: GameState
): boolean {
  // Can't move to the same tube
  if (sourceIndex === targetIndex) return false;

  // Verify index bounds
  if (sourceIndex < 0 || sourceIndex >= currentState.length) return false;
  if (targetIndex < 0 || targetIndex >= currentState.length) return false;

  const sourceTube = currentState[sourceIndex];
  const targetTube = currentState[targetIndex];

  // Rule a) Source tube cannot be empty
  if (sourceTube.length === 0) return false;

  // Rule b) Target tube cannot be full
  if (targetTube.length >= TUBE_MAX_CAPACITY) return false;

  // Rule c) Target tube must be empty OR top ball matches the color of the source top ball
  if (targetTube.length === 0) return true;

  const sourceTopBall = sourceTube[sourceTube.length - 1];
  const targetTopBall = targetTube[targetTube.length - 1];

  return sourceTopBall === targetTopBall;
}

/**
 * Moves a ball from the source tube to the target tube.
 * Returns a new deep-copied GameState.
 */
export function moveBall(
  sourceIndex: number,
  targetIndex: number,
  currentState: GameState
): GameState {
  if (!canMove(sourceIndex, targetIndex, currentState)) {
    // If invalid, return the current state copy
    return currentState.map(tube => [...tube]);
  }

  // Create deep copy
  const newState = currentState.map(tube => [...tube]);
  
  const ball = newState[sourceIndex].pop();
  if (ball) {
    newState[targetIndex].push(ball);
  }

  return newState;
}

/**
 * Checks if the win condition has been met.
 * Win condition: every tube is either completely empty OR completely full with 4 balls of the exact same color.
 */
export function checkWinCondition(currentState: GameState): boolean {
  for (const tube of currentState) {
    if (tube.length === 0) {
      continue;
    }
    
    // If not empty, it must be full
    if (tube.length !== TUBE_MAX_CAPACITY) {
      return false;
    }

    // All balls must be the same color
    const firstBallColor = tube[0];
    const isUniform = tube.every(ball => ball === firstBallColor);
    
    if (!isUniform) {
      return false;
    }
  }

  return true;
}
