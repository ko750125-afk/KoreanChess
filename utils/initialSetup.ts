import { PieceState } from '../types';

export function getInitialSetup(): PieceState[] {
  const pieces: PieceState[] = [];

  // 초(Cho, 파랑/녹색) - 아래쪽 (y=0 ~ y=3)
  // 마상마상 형태로 배치해봅시다. (차, 마, 상, 사, 빈칸, 사, 마, 상, 차)
  pieces.push(
    { id: 'cho-chariot-1', type: 'chariot', camp: 'cho', x: 0, y: 0 },
    { id: 'cho-horse-1', type: 'horse', camp: 'cho', x: 1, y: 0 },
    { id: 'cho-elephant-1', type: 'elephant', camp: 'cho', x: 2, y: 0 },
    { id: 'cho-guard-1', type: 'guard', camp: 'cho', x: 3, y: 0 },
    { id: 'cho-guard-2', type: 'guard', camp: 'cho', x: 5, y: 0 },
    { id: 'cho-horse-2', type: 'horse', camp: 'cho', x: 6, y: 0 },
    { id: 'cho-elephant-2', type: 'elephant', camp: 'cho', x: 7, y: 0 },
    { id: 'cho-chariot-2', type: 'chariot', camp: 'cho', x: 8, y: 0 },
    { id: 'cho-king', type: 'king', camp: 'cho', x: 4, y: 1 },
    { id: 'cho-cannon-1', type: 'cannon', camp: 'cho', x: 1, y: 2 },
    { id: 'cho-cannon-2', type: 'cannon', camp: 'cho', x: 7, y: 2 },
    { id: 'cho-pawn-1', type: 'pawn', camp: 'cho', x: 0, y: 3 },
    { id: 'cho-pawn-2', type: 'pawn', camp: 'cho', x: 2, y: 3 },
    { id: 'cho-pawn-3', type: 'pawn', camp: 'cho', x: 4, y: 3 },
    { id: 'cho-pawn-4', type: 'pawn', camp: 'cho', x: 6, y: 3 },
    { id: 'cho-pawn-5', type: 'pawn', camp: 'cho', x: 8, y: 3 },
  );

  // 한(Han, 빨강) - 위쪽 (y=9 ~ y=6)
  // 대칭으로 상마상마 (차, 상, 마, 사, 빈칸, 사, 상, 마, 차) - 편의상 초와 동일한 마상마상 패턴의 대칭으로 배치
  pieces.push(
    { id: 'han-chariot-1', type: 'chariot', camp: 'han', x: 0, y: 9 },
    { id: 'han-elephant-1', type: 'elephant', camp: 'han', x: 1, y: 9 },
    { id: 'han-horse-1', type: 'horse', camp: 'han', x: 2, y: 9 },
    { id: 'han-guard-1', type: 'guard', camp: 'han', x: 3, y: 9 },
    { id: 'han-guard-2', type: 'guard', camp: 'han', x: 5, y: 9 },
    { id: 'han-elephant-2', type: 'elephant', camp: 'han', x: 6, y: 9 },
    { id: 'han-horse-2', type: 'horse', camp: 'han', x: 7, y: 9 },
    { id: 'han-chariot-2', type: 'chariot', camp: 'han', x: 8, y: 9 },
    { id: 'han-king', type: 'king', camp: 'han', x: 4, y: 8 },
    { id: 'han-cannon-1', type: 'cannon', camp: 'han', x: 1, y: 7 },
    { id: 'han-cannon-2', type: 'cannon', camp: 'han', x: 7, y: 7 },
    { id: 'han-pawn-1', type: 'pawn', camp: 'han', x: 0, y: 6 },
    { id: 'han-pawn-2', type: 'pawn', camp: 'han', x: 2, y: 6 },
    { id: 'han-pawn-3', type: 'pawn', camp: 'han', x: 4, y: 6 },
    { id: 'han-pawn-4', type: 'pawn', camp: 'han', x: 6, y: 6 },
    { id: 'han-pawn-5', type: 'pawn', camp: 'han', x: 8, y: 6 },
  );

  return pieces;
}
