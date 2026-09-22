import { getPossibleMoves } from './utils/rules';
import { PieceState } from './types';

// Mock board
const board: PieceState[] = [
  // Cho (Blue) pieces
  { id: 'cho-king', camp: 'cho', type: 'king', x: 4, y: 1 },
  { id: 'cho-pawn-1', camp: 'cho', type: 'pawn', x: 4, y: 3 },
  { id: 'cho-horse', camp: 'cho', type: 'horse', x: 2, y: 2 },
  { id: 'cho-cannon', camp: 'cho', type: 'cannon', x: 4, y: 2 },
  
  // Han (Red) pieces
  { id: 'han-king', camp: 'han', type: 'king', x: 4, y: 8 },
  { id: 'han-pawn-1', camp: 'han', type: 'pawn', x: 4, y: 6 },
  { id: 'han-cannon', camp: 'han', type: 'cannon', x: 4, y: 7 },
  { id: 'han-horse', camp: 'han', type: 'horse', x: 1, y: 0 }, // blocking horse
];

console.log("=== JANGGI RULES ENGINE TEST ===");

// 1. Pawn Move Test (Cho Pawn at 4,3)
const choPawn = board.find(p => p.id === 'cho-pawn-1')!;
const pawnMoves = getPossibleMoves(choPawn, board);
console.log("Cho Pawn (4,3) Moves:", pawnMoves); 
// Should be (4,4), (3,3), (5,3).

// 2. Horse Move Test (Cho Horse at 2,2)
const choHorse = board.find(p => p.id === 'cho-horse')!;
const horseMoves = getPossibleMoves(choHorse, board);
console.log("Cho Horse (2,2) Moves:", horseMoves);
// Should not be able to jump over (2,1) or something if blocked.
// Horse jumps from 2,2: 
// 1,0 (blocked by han-horse at 1,0? No, horse lands on 1,0 so it captures).
// Let's block it explicitly. If block is at 2,1, it cannot reach 1,0 or 3,0.
// Let's add a blocker at 2,1
const boardWithBlocker = [...board, { id: 'blocker', camp: 'cho', type: 'pawn', x: 2, y: 1 } as PieceState];
const horseMovesBlocked = getPossibleMoves(choHorse, boardWithBlocker);
console.log("Cho Horse (2,2) Moves (with blocker at 2,1):", horseMovesBlocked.filter(m => m.y === 0));
// Should be empty for y=0

// 3. Cannon Move Test (Cho Cannon at 4,2)
const choCannon = board.find(p => p.id === 'cho-cannon')!;
const cannonMoves = getPossibleMoves(choCannon, board);
console.log("Cho Cannon (4,2) Moves (jumping over cho-pawn at 4,3):", cannonMoves.filter(m => m.x === 4));
// Should be able to jump to 4,4, 4,5, 4,6 (captures han-pawn). Cannot jump to 4,7 because it's a cannon. Cannot jump to 4,8 because han-cannon is in the way.

console.log("Test Complete.");
