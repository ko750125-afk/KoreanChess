import { useState } from 'react';
import { Cylinder } from '@react-three/drei';
import { get3DCoords } from '../utils/coords';

interface MoveMarkerProps {
  x: number;
  y: number;
  onClick: (x: number, y: number) => void;
}

export default function MoveMarker({ x, y, onClick }: MoveMarkerProps) {
  const [hovered, setHovered] = useState(false);
  
  // 마커는 바닥 교차점에 렌더링 (높이를 아주 약간 띄워 z-fighting 방지)
  const [targetX, targetY, targetZ] = get3DCoords(x, y, 0.02);

  return (
    <group
      position={[targetX, targetY, targetZ]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(x, y);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <Cylinder args={[0.3, 0.3, 0.04, 16]}>
        <meshStandardMaterial 
          color={hovered ? '#ffffff' : '#888888'} 
          transparent 
          opacity={0.3} 
          depthTest={false} // 기물 위에도 마커가 보일 수 있게
        />
      </Cylinder>
    </group>
  );
}
