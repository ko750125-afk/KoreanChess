import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraRigProps {
  myRole: 'cho' | 'han' | 'spectator' | null;
  isCheck?: boolean;
}

export default function CameraRig({ myRole, isCheck = false }: CameraRigProps) {
  const { camera, size } = useThree();
  const targetPosition = new THREE.Vector3();
  const targetLookAt = new THREE.Vector3(0, 0, 0);

  // 흔들림 효과 지속 시간 관리
  const shakeTime = useRef(0);
  const prevCheck = useRef(isCheck);

  useEffect(() => {
    // 방금 장군 상태가 되었을 때만 0.5초간 진동
    if (isCheck && !prevCheck.current) {
      shakeTime.current = 0.5;
    }
    prevCheck.current = isCheck;
  }, [isCheck]);

  // 반응형 카메라: 세로 화면(모바일)일 때 카메라를 더 뒤/위로 뺌
  const isMobile = size.width < size.height;
  const dist = isMobile ? 18 : 12;
  const height = isMobile ? 13 : 8;

  useFrame((state, delta) => {
    // 180도 회전하여 내 기물이 앞쪽(아래)에 보이도록 설정
    if (myRole === 'han') {
      targetPosition.set(0, height, dist);
    } else {
      targetPosition.set(0, height, -dist);
    }

    // 카메라 흔들림 (Screen Shake)
    if (shakeTime.current > 0) {
      const shakeIntensity = 0.3; // 흔들림 강도
      targetPosition.x += (Math.random() - 0.5) * shakeIntensity * 2;
      targetPosition.y += (Math.random() - 0.5) * shakeIntensity * 2;
      shakeTime.current -= delta;
    }

    camera.position.lerp(targetPosition, 0.05);
    camera.lookAt(targetLookAt);
  });

  return null;
}
