import { PieceState, Camp } from '../types';

export interface Position {
  x: number;
  y: number;
}

const isOutOfBounds = (x: number, y: number) => {
  return x < 0 || x > 8 || y < 0 || y > 9;
};

const getPieceAt = (board: PieceState[], x: number, y: number): PieceState | undefined => {
  return board.find((p) => p.x === x && p.y === y);
};

const isPalace = (x: number, y: number, camp?: Camp): boolean => {
  if (x < 3 || x > 5) return false;
  if (camp === 'cho' || !camp) {
    if (y >= 0 && y <= 2) return true;
  }
  if (camp === 'han' || !camp) {
    if (y >= 7 && y <= 9) return true;
  }
  return false;
};

// 주어진 위치에서 궁성 대각선 방향으로 한 칸 이동할 수 있는 방향 벡터 반환
const getPalaceDiagonalDirections = (x: number, y: number): Position[] => {
  const dirs: Position[] = [];
  // 초나라 궁성
  if (x === 4 && y === 1) {
    return [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }];
  }
  if (x === 3 && y === 0) dirs.push({ x: 1, y: 1 });
  if (x === 5 && y === 0) dirs.push({ x: -1, y: 1 });
  if (x === 3 && y === 2) dirs.push({ x: 1, y: -1 });
  if (x === 5 && y === 2) dirs.push({ x: -1, y: -1 });

  // 한나라 궁성
  if (x === 4 && y === 8) {
    return [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }];
  }
  if (x === 3 && y === 7) dirs.push({ x: 1, y: 1 });
  if (x === 5 && y === 7) dirs.push({ x: -1, y: 1 });
  if (x === 3 && y === 9) dirs.push({ x: 1, y: -1 });
  if (x === 5 && y === 9) dirs.push({ x: -1, y: -1 });

  return dirs;
};

export const getPossibleMoves = (piece: PieceState, board: PieceState[]): Position[] => {
  const moves: Position[] = [];
  const { x, y, type, camp } = piece;

  const addMoveIfValid = (targetX: number, targetY: number): boolean => {
    if (isOutOfBounds(targetX, targetY)) return false;
    
    // 왕과 사는 궁성을 벗어날 수 없음
    if ((type === 'king' || type === 'guard') && !isPalace(targetX, targetY, camp)) return false;

    const targetPiece = getPieceAt(board, targetX, targetY);
    if (targetPiece) {
      if (targetPiece.camp !== camp) {
        moves.push({ x: targetX, y: targetY }); // 적군이면 잡을 수 있으므로 이동 가능
      }
      return false; // 기물이 있으므로 이 방향으로의 추가적인 '무한 전진'은 불가
    }

    moves.push({ x: targetX, y: targetY });
    return true; // 빈 칸이므로 전진 가능
  };

  const orthogonalDirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

  if (type === 'king' || type === 'guard') {
    // 상하좌우 1칸
    orthogonalDirs.forEach((dir) => addMoveIfValid(x + dir.x, y + dir.y));
    // 궁성 내 대각선 1칸
    getPalaceDiagonalDirections(x, y).forEach((dir) => addMoveIfValid(x + dir.x, y + dir.y));
  } 
  else if (type === 'chariot') {
    // 상하좌우 직진
    orthogonalDirs.forEach((dir) => {
      let curX = x + dir.x;
      let curY = y + dir.y;
      while (addMoveIfValid(curX, curY)) {
        curX += dir.x;
        curY += dir.y;
      }
    });

    // 궁성 내 대각선 직진 (대각선을 타고 끝까지 갈 수 있음)
    getPalaceDiagonalDirections(x, y).forEach((dir) => {
      let curX = x + dir.x;
      let curY = y + dir.y;
      while (isPalace(curX, curY) && addMoveIfValid(curX, curY)) {
        // 궁성 중심(4,1 또는 4,8)을 통과하는 경우 반대편 모서리까지 계속 이동 가능
        const nextDirs = getPalaceDiagonalDirections(curX, curY);
        // 진행 방향과 동일한 방향이 있는지 확인
        const sameDir = nextDirs.find(nd => nd.x === dir.x && nd.y === dir.y);
        if (sameDir) {
           curX += dir.x;
           curY += dir.y;
        } else {
           break;
        }
      }
    });
  } 
  else if (type === 'cannon') {
    // 상하좌우 (반드시 하나를 넘어야 함)
    orthogonalDirs.forEach((dir) => {
      let curX = x + dir.x;
      let curY = y + dir.y;
      let jumped = false;

      while (!isOutOfBounds(curX, curY)) {
        const targetPiece = getPieceAt(board, curX, curY);
        if (!jumped) {
          if (targetPiece) {
            if (targetPiece.type === 'cannon') break; // 포는 포를 넘을 수 없음
            jumped = true; // 다리를 넘음
          }
        } else {
          // 이미 다리를 넘은 상태
          if (targetPiece) {
            if (targetPiece.type !== 'cannon' && targetPiece.camp !== camp) {
              moves.push({ x: curX, y: curY }); // 적 기물(포 제외)을 잡음
            }
            break; // 다른 기물을 만나면 더 이상 전진 불가
          } else {
            moves.push({ x: curX, y: curY }); // 빈 칸 이동
          }
        }
        curX += dir.x;
        curY += dir.y;
      }
    });

    // 궁성 내 대각선 포 이동
    // 포는 다리를 반드시 넘어야 하므로, 대각선 이동은 "모서리 -> 중심(다리) -> 반대편 모서리" 패턴만 가능
    if (isPalace(x, y)) {
      getPalaceDiagonalDirections(x, y).forEach((dir) => {
        const midX = x + dir.x;
        const midY = y + dir.y;
        
        // 중간 지점(대각선의 다음 칸)이 반드시 궁성 내 존재해야 함
        if (!isPalace(midX, midY)) return;
        const midPiece = getPieceAt(board, midX, midY);
        
        if (midPiece && midPiece.type !== 'cannon') {
           // 중간 지점에 다리(포가 아닌 기물)가 있다면, 그 다음 지점으로 점프
           // 대각선상에서 다리 너머의 지점은 현재 방향으로 한 칸 더 간 곳 (중심을 통과한 모서리)
           const destX = midX + dir.x;
           const destY = midY + dir.y;
           
           if (isPalace(destX, destY)) {
              const destPiece = getPieceAt(board, destX, destY);
              if (!destPiece) {
                 moves.push({ x: destX, y: destY });
              } else if (destPiece.camp !== camp && destPiece.type !== 'cannon') {
                 moves.push({ x: destX, y: destY });
              }
           }
        }
      });
    }
  } 
  else if (type === 'horse') {
    // 1직선 + 1대각선
    const horseDirs = [
      { dx: -1, dy: -2, bx: 0, by: -1 }, { dx: 1, dy: -2, bx: 0, by: -1 },
      { dx: -1, dy: 2, bx: 0, by: 1 }, { dx: 1, dy: 2, bx: 0, by: 1 },
      { dx: -2, dy: -1, bx: -1, by: 0 }, { dx: -2, dy: 1, bx: -1, by: 0 },
      { dx: 2, dy: -1, bx: 1, by: 0 }, { dx: 2, dy: 1, bx: 1, by: 0 }
    ];

    horseDirs.forEach(({ dx, dy, bx, by }) => {
      const blockPiece = getPieceAt(board, x + bx, y + by);
      if (!blockPiece) {
        addMoveIfValid(x + dx, y + dy);
      }
    });
  } 
  else if (type === 'elephant') {
    // 1직선 + 2대각선 (용)
    const elephantDirs = [
      { dx: -2, dy: -3, bx1: 0, by1: -1, bx2: -1, by2: -2 },
      { dx: 2, dy: -3, bx1: 0, by1: -1, bx2: 1, by2: -2 },
      { dx: -2, dy: 3, bx1: 0, by1: 1, bx2: -1, by2: 2 },
      { dx: 2, dy: 3, bx1: 0, by1: 1, bx2: 1, by2: 2 },
      { dx: -3, dy: -2, bx1: -1, by1: 0, bx2: -2, by2: -1 },
      { dx: -3, dy: 2, bx1: -1, by1: 0, bx2: -2, by2: 1 },
      { dx: 3, dy: -2, bx1: 1, by1: 0, bx2: 2, by2: -1 },
      { dx: 3, dy: 2, bx1: 1, by1: 0, bx2: 2, by2: 1 },
    ];

    elephantDirs.forEach(({ dx, dy, bx1, by1, bx2, by2 }) => {
      if (!getPieceAt(board, x + bx1, y + by1) && !getPieceAt(board, x + bx2, y + by2)) {
        addMoveIfValid(x + dx, y + dy);
      }
    });
  } 
  else if (type === 'pawn') {
    // 졸/병: 앞으로 전진 또는 좌우. 후진 불가.
    const forwardY = camp === 'cho' ? 1 : -1; // cho는 y증가 방향(0->9), han은 y감소 방향(9->0)
    
    // 직진 및 좌우
    addMoveIfValid(x, y + forwardY);
    addMoveIfValid(x - 1, y);
    addMoveIfValid(x + 1, y);

    // 궁성 내 대각선 전진
    if (isPalace(x, y, camp === 'cho' ? 'han' : 'cho')) {
       // 적군의 궁성에 진입한 경우에만 대각선 전진 가능
       getPalaceDiagonalDirections(x, y).forEach((dir) => {
         // 전진 방향(forwardY)과 일치하는 대각선 방향만 허용
         if (dir.y === forwardY) {
            addMoveIfValid(x + dir.x, y + dir.y);
         }
       });
    }
  }

  return moves;
};
