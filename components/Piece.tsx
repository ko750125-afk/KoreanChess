import { useState, useRef, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/three';
import { Cylinder, Html } from '@react-three/drei';
import { PieceState, PIECE_TEXT } from '../types';
import { get3DCoords } from '../utils/coords';

interface PieceProps {
  piece: PieceState;
  onClick: (id: string) => void;
  isSelected?: boolean;
  isCaptured?: boolean;
}

export default function Piece({ piece, onClick, isSelected = false, isCaptured = false }: PieceProps) {
  const [hovered, setHovered] = useState(false);

  const isCho = piece.camp === 'cho';
  const textChar = PIECE_TEXT[piece.camp][piece.type];
  const color = isCho ? '#0033cc' : '#cc0000'; // 파랑 vs 빨강

  // 크기와 두께(높이), 텍스트 크기 결정
  let scale = 1;
  let pieceHeight = 0.2;

  if (piece.type === 'king') {
    scale = 1.15;
    pieceHeight = 0.25; 
  } else if (['chariot', 'cannon', 'horse', 'elephant'].includes(piece.type)) {
    scale = 0.85;
    pieceHeight = 0.18;
  } else {
    scale = 0.65;
    pieceHeight = 0.13;
  }

  let textScale = 0.26; // 작은 알 (졸/병, 사) 기본값
  if (piece.type === 'king') {
    textScale = 0.38; // 큰 알 (비례치 0.46에서 조금 더 줄임)
  } else if (['chariot', 'cannon', 'horse', 'elephant'].includes(piece.type)) {
    textScale = 0.31; // 중간 알 (비례치 0.34에서 아주 약간 줄임)
  }

  // 3D 목표 좌표
  const baseHeight = pieceHeight / 2; 
  const yPos = baseHeight;
  const [targetX, targetY, targetZ] = get3DCoords(piece.x, piece.y, yPos);

  // 잡혔을 경우 크기를 0으로, 아니면 원래 크기로
  const targetScale = isCaptured ? 0 : scale;

  // React Spring 애니메이션 설정 (api를 통해 수동 제어)
  const prevPosRef = useRef({ x: piece.x, y: piece.y });
  
  const [{ position, springScale }, api] = useSpring(() => ({
    position: [targetX, targetY, targetZ] as [number, number, number],
    springScale: [targetScale, targetScale, targetScale] as [number, number, number],
    config: isCaptured 
      ? { mass: 1, tension: 250, friction: 20 }
      : { mass: 1, tension: 220, friction: 24 }, // 다단계 경로를 위해 살짝 더 빠르고 경쾌하게
  }));

  useEffect(() => {
    if (isCaptured) {
      api.start({ springScale: [0, 0, 0] });
      return;
    }

    const prevX = prevPosRef.current.x;
    const prevY = prevPosRef.current.y;
    
    // 위치 이동이 감지된 경우
    if (prevX !== piece.x || prevY !== piece.y) {
      const dx = piece.x - prevX;
      const dy = piece.y - prevY;
      
      // 마 (Horse) 경로 계산: 직진 1칸 -> 대각 1칸
      if (piece.type === 'horse' && (Math.abs(dx) + Math.abs(dy) === 3)) {
        const midX = Math.abs(dx) === 2 ? prevX + dx / 2 : prevX;
        const midY = Math.abs(dy) === 2 ? prevY + dy / 2 : prevY;
        const [mid3DX, mid3DY, mid3DZ] = get3DCoords(midX, midY, yPos);
        
        api.start({
          to: async (next) => {
            await next({ position: [mid3DX, mid3DY, mid3DZ] });
            await next({ position: [targetX, targetY, targetZ] });
          }
        });
      } 
      // 상 (Elephant) 경로 계산: 직진 1칸 -> 대각 2칸
      else if (piece.type === 'elephant' && (Math.abs(dx) + Math.abs(dy) === 5)) {
        const mid1X = prevX + (Math.abs(dx) === 3 ? Math.sign(dx) : 0);
        const mid1Y = prevY + (Math.abs(dy) === 3 ? Math.sign(dy) : 0);
        const [m1X, m1Y, m1Z] = get3DCoords(mid1X, mid1Y, yPos);

        const mid2X = mid1X + Math.sign(dx);
        const mid2Y = mid1Y + Math.sign(dy);
        const [m2X, m2Y, m2Z] = get3DCoords(mid2X, mid2Y, yPos);

        api.start({
          to: async (next) => {
            await next({ position: [m1X, m1Y, m1Z] });
            await next({ position: [m2X, m2Y, m2Z] });
            await next({ position: [targetX, targetY, targetZ] });
          }
        });
      } else {
        // 기본 직선 이동 (차, 포, 졸, 사, 궁 등)
        api.start({ position: [targetX, targetY, targetZ], springScale: [targetScale, targetScale, targetScale] });
      }
      
      prevPosRef.current = { x: piece.x, y: piece.y };
    } else {
      // 이동이 아닌 속성(크기 등) 변경 시
      api.start({
        position: [targetX, targetY, targetZ],
        springScale: [targetScale, targetScale, targetScale],
      });
    }
  }, [piece.x, piece.y, isCaptured, targetX, targetY, targetZ, targetScale, api, yPos, piece.type]);

  return (
    <animated.group
      position={position as any}
      scale={springScale as any}
      onClick={(e) => {
        if (isCaptured) return;
        e.stopPropagation();
        onClick(piece.id);
      }}
      onPointerOver={(e) => {
        if (isCaptured) return;
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        if (isCaptured) return;
        e.stopPropagation();
        setHovered(false);
      }}
    >
      {/* 8각 기둥 (실제 장기말 모양, 22.5도 회전) */}
      <Cylinder args={[0.45, 0.45, pieceHeight, 8]} rotation={[0, Math.PI / 8, 0]}>
        <meshStandardMaterial 
          color={hovered || isSelected ? '#e0f7fa' : '#ffffff'} 
          roughness={0.2}
          metalness={0.1}
        />
      </Cylinder>
        
      {/* 기물 한자 텍스트 (Cylinder 밖으로 분리하여 기울어짐 방지) */}
      <Html
        transform
        position={[0, pieceHeight / 2 + 0.005, 0]}
        rotation={[-Math.PI / 2, 0, isCho ? Math.PI : 0]} // 내 기물은 내 시야를 향하게, 상대 기물은 상대를 향하게 180도 뒤집음
        occlude
        wrapperClass="ignore-clicks"
      >
        <div
          style={{
            width: '100px',
            height: '100px',
            fontFamily: isCho 
              ? "'궁서', 'Gungsuh', 'Zhi Mang Xing', cursive" 
              : "'Noto Serif KR', 'Batang', serif",
            color: color,
            fontSize: `70px`, // 고정된 큰 CSS 폰트 사이즈
            fontWeight: 'bold',
            WebkitTextStroke: `1.5px ${color}`,
            userSelect: 'none',
            pointerEvents: 'none', 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transform: `scale(${textScale})`, // 각 기물 크기에 맞게 3D 공간 스케일링
          }}
        >
          {textChar}
        </div>
      </Html>
    </animated.group>
  );
}
