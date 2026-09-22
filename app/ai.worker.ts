import { PieceState, Camp } from '../types';
import { findBestMove } from '../utils/ai';

self.onmessage = (e: MessageEvent) => {
  const { board, depth, aiCamp } = e.data as { board: PieceState[]; depth: number; aiCamp: Camp };

  try {
    const bestMove = findBestMove(board, depth, aiCamp);
    self.postMessage({ type: 'SUCCESS', bestMove });
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: String(error) });
  }
};
