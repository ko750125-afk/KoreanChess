export const SPACING = 1;

/**
 * 장기판 논리 좌표(x, y)를 3D 공간 좌표([x, y, z])로 변환
 * @param logicalX 0 ~ 8
 * @param logicalY 0 ~ 9
 * @param height 기물의 Y축 높이(들려있는 상태 등)
 * @returns [x, y, z] 배열
 */
export function get3DCoords(logicalX: number, logicalY: number, height: number = 0.1): [number, number, number] {
  // x축 중심: 4 (0~8의 중간)
  const x = (logicalX - 4) * SPACING;
  // z축 중심: 4.5 (0~9의 중간)
  const z = (logicalY - 4.5) * SPACING;
  return [x, height, z];
}
