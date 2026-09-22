import { Line, Box } from '@react-three/drei';
import { SPACING, get3DCoords } from '../utils/coords';

export default function Board() {
  const lines = [];
  const yOffset = 0.01; // 선이 바닥에 묻히지 않도록 살짝 띄움

  // 세로선 9개 (x: 0 ~ 8)
  for (let x = 0; x <= 8; x++) {
    const start = get3DCoords(x, 0, yOffset);
    const end = get3DCoords(x, 9, yOffset);
    lines.push(
      <Line key={`v-${x}`} points={[start, end]} color="black" lineWidth={1} />
    );
  }

  // 가로선 10개 (y: 0 ~ 9)
  for (let y = 0; y <= 9; y++) {
    const start = get3DCoords(0, y, yOffset);
    const end = get3DCoords(8, y, yOffset);
    lines.push(
      <Line key={`h-${y}`} points={[start, end]} color="black" lineWidth={1} />
    );
  }

  // 초나라 궁성 대각선 (x: 3~5, y: 0~2)
  const choPalaceP1 = get3DCoords(3, 0, yOffset);
  const choPalaceP2 = get3DCoords(5, 2, yOffset);
  const choPalaceP3 = get3DCoords(3, 2, yOffset);
  const choPalaceP4 = get3DCoords(5, 0, yOffset);
  lines.push(<Line key="cho-diag-1" points={[choPalaceP1, choPalaceP2]} color="black" lineWidth={1} />);
  lines.push(<Line key="cho-diag-2" points={[choPalaceP3, choPalaceP4]} color="black" lineWidth={1} />);

  // 한나라 궁성 대각선 (x: 3~5, y: 7~9)
  const hanPalaceP1 = get3DCoords(3, 7, yOffset);
  const hanPalaceP2 = get3DCoords(5, 9, yOffset);
  const hanPalaceP3 = get3DCoords(3, 9, yOffset);
  const hanPalaceP4 = get3DCoords(5, 7, yOffset);
  lines.push(<Line key="han-diag-1" points={[hanPalaceP1, hanPalaceP2]} color="black" lineWidth={1} />);
  lines.push(<Line key="han-diag-2" points={[hanPalaceP3, hanPalaceP4]} color="black" lineWidth={1} />);

  // 바닥 나무 판자
  const boardWidth = 8 * SPACING + 0.6;
  const boardDepth = 9 * SPACING + 0.6;
  const boardHeight = 0.2;

  return (
    <group>
      {/* 바닥 판 */}
      <Box args={[boardWidth, boardHeight, boardDepth]} position={[0, -boardHeight / 2, 0]}>
        <meshStandardMaterial color="#deb887" /> {/* wood color */}
      </Box>

      {/* 격자선 */}
      {lines}
    </group>
  );
}
