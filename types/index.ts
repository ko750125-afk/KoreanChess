export type Camp = 'cho' | 'han'; // 초(파랑/녹색), 한(빨강)

export type PieceType = 'king' | 'chariot' | 'cannon' | 'horse' | 'elephant' | 'guard' | 'pawn';
// 궁(楚/漢), 차(車), 포(包), 마(馬), 상(象), 사(士), 졸/병(卒/兵)

export interface PieceState {
  id: string; // 고유 ID (예: 'cho-chariot-1')
  type: PieceType;
  camp: Camp;
  x: number; // 0 ~ 8 (가로)
  y: number; // 0 ~ 9 (세로)
}

export const PIECE_TEXT: Record<Camp, Record<PieceType, string>> = {
  cho: {
    king: '楚',
    chariot: '車',
    cannon: '包',
    horse: '馬',
    elephant: '象',
    guard: '士',
    pawn: '卒',
  },
  han: {
    king: '漢',
    chariot: '車',
    cannon: '包',
    horse: '馬',
    elephant: '象',
    guard: '士',
    pawn: '兵',
  },
};
