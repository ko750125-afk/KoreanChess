import { PieceState, Camp, PieceType } from '../types';
import { getPossibleMoves, Position } from './rules';

// 기물별 기본 가치 점수
const PIECE_VALUES: Record<PieceType, number> = {
  king: 10000,
  chariot: 13,
  cannon: 7,
  horse: 5,
  elephant: 3,
  guard: 3,
  pawn: 2,
};

// 위치 가중치 (궁성 중심에 가까울수록 점수 부여 등, 간단한 구현을 위해 중앙 통제력 우선)
const getPositionWeight = (x: number, y: number, type: PieceType, camp: Camp): number => {
  let weight = 0;
  
  // 졸/병은 전진할수록 가치가 약간 증가
  if (type === 'pawn') {
    if (camp === 'cho') {
      weight += y * 0.1; // 초는 y가 증가하는 방향으로 전진
    } else {
      weight += (9 - y) * 0.1; // 한은 y가 감소하는 방향으로 전진
    }
  }

  // 중앙(4, 4~5 부근)에 위치할수록 가산점 (왕과 사는 제외)
  if (type !== 'king' && type !== 'guard') {
    const distFromCenterX = Math.abs(x - 4);
    const distFromCenterY = Math.abs(y - 4.5);
    weight += (4 - distFromCenterX) * 0.05 + (4.5 - distFromCenterY) * 0.05;
  }

  return weight;
};

// 보드 상태 평가 함수
export const evaluateBoard = (board: PieceState[], aiCamp: Camp): number => {
  let score = 0;

  for (let i = 0; i < board.length; i++) {
    const piece = board[i];
    let pieceValue = PIECE_VALUES[piece.type] + getPositionWeight(piece.x, piece.y, piece.type, piece.camp);
    
    // AI 진영 기물이면 +, 플레이어 진영 기물이면 -
    if (piece.camp === aiCamp) {
      score += pieceValue;
    } else {
      score -= pieceValue;
    }
  }

  return score;
};

// 특정 기물의 이동 시뮬레이션 (새로운 보드 상태 반환)
const simulateMove = (board: PieceState[], pieceId: string, toX: number, toY: number): PieceState[] => {
  return board
    .filter((p) => !(p.x === toX && p.y === toY && p.id !== pieceId)) // 도착지에 있는 기물(적군) 제거 (캡처)
    .map((p) => {
      if (p.id === pieceId) {
        return { ...p, x: toX, y: toY }; // 선택한 기물 이동
      }
      return p;
    });
};

export interface MoveResult {
  pieceId: string;
  to: Position;
  score: number;
}

// Minimax with Alpha-Beta Pruning
export const minimax = (
  board: PieceState[],
  depth: number,
  isMaximizingPlayer: boolean,
  alpha: number,
  beta: number,
  aiCamp: Camp,
  currentCamp: Camp
): number => {
  // 종료 조건: 깊이가 0이거나, 왕이 잡혔을 경우 (승패 결정)
  const choKing = board.find((p) => p.type === 'king' && p.camp === 'cho');
  const hanKing = board.find((p) => p.type === 'king' && p.camp === 'han');
  
  if (!choKing) return aiCamp === 'han' ? 100000 : -100000;
  if (!hanKing) return aiCamp === 'cho' ? 100000 : -100000;
  
  if (depth === 0) {
    return evaluateBoard(board, aiCamp);
  }

  if (isMaximizingPlayer) {
    let maxEval = -Infinity;
    const pieces = board.filter((p) => p.camp === currentCamp);

    for (const piece of pieces) {
      const moves = getPossibleMoves(piece, board);
      for (const move of moves) {
        const nextBoard = simulateMove(board, piece.id, move.x, move.y);
        const evalScore = minimax(
          nextBoard,
          depth - 1,
          false,
          alpha,
          beta,
          aiCamp,
          currentCamp === 'cho' ? 'han' : 'cho'
        );
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break; // Alpha-Beta Pruning
      }
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    const pieces = board.filter((p) => p.camp === currentCamp);

    for (const piece of pieces) {
      const moves = getPossibleMoves(piece, board);
      for (const move of moves) {
        const nextBoard = simulateMove(board, piece.id, move.x, move.y);
        const evalScore = minimax(
          nextBoard,
          depth - 1,
          true,
          alpha,
          beta,
          aiCamp,
          currentCamp === 'cho' ? 'han' : 'cho'
        );
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break; // Alpha-Beta Pruning
      }
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

// 최적의 수 찾기 진입점
export const findBestMove = (board: PieceState[], depth: number, aiCamp: Camp): MoveResult | null => {
  let bestScore = -Infinity;
  let bestMove: MoveResult | null = null;
  const pieces = board.filter((p) => p.camp === aiCamp);
  
  // 첫 번째 수를 섞어주어 항상 같은 수만 두지 않게 처리 (가벼운 랜덤성)
  const pieceMovePairs: { piece: PieceState; to: Position }[] = [];
  pieces.forEach((piece) => {
    const moves = getPossibleMoves(piece, board);
    moves.forEach((move) => pieceMovePairs.push({ piece, to: move }));
  });
  
  // 간단히 셔플
  pieceMovePairs.sort(() => Math.random() - 0.5);

  let alpha = -Infinity;
  const beta = Infinity;

  for (const { piece, to } of pieceMovePairs) {
    const nextBoard = simulateMove(board, piece.id, to.x, to.y);
    const score = minimax(
      nextBoard,
      depth - 1,
      false,
      alpha,
      beta,
      aiCamp,
      aiCamp === 'cho' ? 'han' : 'cho' // 다음 턴은 상대방
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = { pieceId: piece.id, to, score };
    }
    alpha = Math.max(alpha, score);
  }

  return bestMove;
};
