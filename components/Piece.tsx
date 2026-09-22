import { useState } from 'react';
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

  let textScale = 0.20; 
  if (piece.type === 'king') {
    textScale = 0.15;
  } else if (['chariot', 'cannon', 'horse', 'elephant'].includes(piece.type)) {
    textScale = 0.20;
  } else {
    textScale = 0.26;
  }

  // 3D 목표 좌표
  const baseHeight = pieceHeight / 2; 
  const yPos = baseHeight;
  const [targetX, targetY, targetZ] = get3DCoords(piece.x, piece.y, yPos);

  // 잡혔을 경우 크기를 0으로, 아니면 원래 크기로
  const targetScale = isCaptured ? 0 : scale;

  // React Spring 애니메이션 적용
  const { position, springScale } = useSpring({
    position: [targetX, targetY, targetZ] as [number, number, number],
    springScale: [targetScale, targetScale, targetScale] as [number, number, number],
    config: isCaptured 
      ? { mass: 1, tension: 250, friction: 20 } // 잡힐 때는 빠르게 축소
      : { mass: 1, tension: 170, friction: 26 }, // 이동 시에는 부드럽게
  });

  return (
    <animated.group
      position={position}
      scale={springScale}
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
        <meshStandardMaterial color={hovered || isSelected ? '#ffefd5' : '#e6c280'} />
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
