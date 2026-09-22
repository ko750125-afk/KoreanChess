'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import Board from '../components/Board';
import Piece from '../components/Piece';
import MoveMarker from '../components/MoveMarker';
import CameraRig from '../components/CameraRig';
import { getInitialSetup } from '../utils/initialSetup';
import { getPossibleMoves, Position } from '../utils/rules';
import { audioService } from '../utils/audio';
import { Camp, PieceState } from '../types';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

const generateUserId = () => Math.random().toString(36).substring(2, 9);
const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export default function Home() {
  const [pieces, setPieces] = useState<PieceState[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [turn, setTurn] = useState<Camp>('cho'); // 기본 선공: 초나라
  const [possibleMoves, setPossibleMoves] = useState<Position[]>([]);
  const [winner, setWinner] = useState<Camp | null>(null); // 승자 상태

  // 멀티플레이 관련 상태
  const [roomId, setRoomId] = useState<string>('');
  const [myUserId] = useState<string>(generateUserId());
  const [myRole, setMyRole] = useState<'cho' | 'han' | 'spectator' | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [capturedPieces, setCapturedPieces] = useState<PieceState[]>([]);
  const [isCheck, setIsCheck] = useState(false);

  // 게임 상태 Ref (비동기 콜백에서 최신 상태 참조용)
  const stateRef = useRef({ pieces, turn, winner });
  useEffect(() => {
    stateRef.current = { pieces, turn, winner };
  }, [pieces, turn, winner]);

  // 장군(Check) 판별 함수
  const checkForCheck = (currentPieces: PieceState[], targetCamp: Camp) => {
    const enemyCamp = targetCamp === 'cho' ? 'han' : 'cho';
    const targetKing = currentPieces.find(p => p.camp === targetCamp && p.type === 'king');
    if (!targetKing) return false;

    for (const piece of currentPieces) {
      if (piece.camp === enemyCamp) {
        const moves = getPossibleMoves(piece, currentPieces);
        if (moves.some(m => m.x === targetKing.x && m.y === targetKing.y)) {
          return true;
        }
      }
    }
    return false;
  };

  // 초기화 및 방 접속
  useEffect(() => {
    // 1. 방 ID 설정
    let currentRoomId = '';
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      currentRoomId = params.get('room') || '';
      if (!currentRoomId) {
        currentRoomId = generateRoomId();
        window.history.replaceState(null, '', `?room=${currentRoomId}`);
      }
      setRoomId(currentRoomId);
    }
    
    // 2. 초기 기물 세팅
    setPieces(getInitialSetup());
    
    if (!currentRoomId) return;

    // 3. Supabase Realtime 연결
    const roomChannel = supabase.channel(`room-${currentRoomId}`, {
      config: {
        presence: {
          key: myUserId,
        },
      },
    });

    roomChannel
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannel.presenceState();
        // 접속 시간(joined_at) 기준으로 정렬하여 역할 배정
        const users = Object.values(state).flat().sort((a: any, b: any) => a.joined_at - b.joined_at);
        
        setMyRole((prev) => {
          if (prev) return prev; // 브라우저 비활성화(탭 전환)로 인해 상대방이 잠시 끊겨도 내 진영이 바뀌지 않도록 완벽 고정
          
          const myIndex = users.findIndex((u: any) => u.user_id === myUserId);
          if (myIndex === 0) return 'cho';
          if (myIndex === 1) return 'han';
          if (myIndex > 1) return 'spectator';
          return null;
        });
        
        console.log('[Supabase] Presence Sync - Users:', users.length);
      })
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        console.log('[Supabase] Broadcast Received (move):', payload);
        
        // 동기화 시 사운드 재생
        if (payload.winner) {
          audioService.playWinSound();
        } else if (payload.isCapture) {
          audioService.playCaptureSound();
        } else {
          audioService.playMoveSound();
        }

        if (payload.capturedPiece) {
          setCapturedPieces(prev => [...prev, payload.capturedPiece]);
          setTimeout(() => {
            setCapturedPieces(prev => prev.filter(p => p.id !== payload.capturedPiece.id));
          }, 500); // 0.5초 뒤 완전히 제거
        }

        setPieces(payload.nextPieces);
        setTurn(payload.nextTurn);
        setWinner(payload.winner);
        setSelectedPieceId(null);
        setPossibleMoves([]);
        setIsCheck(payload.isCheck);
      })
      .on('broadcast', { event: 'request_state' }, () => {
        // 누군가(새로고침한 유저 등)가 상태를 요청하면 내 최신 상태를 전송
        console.log('[Supabase] State Requested, sending sync_state...');
        roomChannel.send({
          type: 'broadcast',
          event: 'sync_state',
          payload: stateRef.current,
        });
      })
      .on('broadcast', { event: 'sync_state' }, ({ payload }) => {
        // 상대방으로부터 최신 상태를 전달받아 덮어쓰기 (새로고침 복구용)
        console.log('[Supabase] State Synced:', payload);
        setPieces(payload.pieces);
        setTurn(payload.turn);
        setWinner(payload.winner);
        setSelectedPieceId(null);
        setPossibleMoves([]);
        setIsCheck(checkForCheck(payload.pieces, payload.turn));
      })
      .on('broadcast', { event: 'restart' }, () => {
        // 다시 하기 요청 받음
        console.log('[Supabase] Restart Received');
        setPieces(getInitialSetup());
        setTurn('cho');
        setWinner(null);
        setIsCheck(false);
        setSelectedPieceId(null);
        setPossibleMoves([]);
        setCapturedPieces([]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase] 접속 성공, Presence 등록');
          setIsConnected(true);
          await roomChannel.track({ user_id: myUserId, joined_at: Date.now() });
          
          // 0.5초 뒤, 현재 방에 있는 사람들에게 최신 장기판 상태를 달라고 요청 (새로고침 대응)
          setTimeout(() => {
            roomChannel.send({ type: 'broadcast', event: 'request_state' });
          }, 500);
        }
      });

    setChannel(roomChannel);

    // 브라우저 탭 비활성화 후 복귀 시(Wake up), 놓친 상태(Broadcast)가 있을 수 있으므로 재동기화 요청
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Supabase] Tab Active - Requesting state sync...');
        roomChannel.send({ type: 'broadcast', event: 'request_state' });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(roomChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyRoomLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      alert('방 주소가 복사되었습니다! 친구에게 전달하세요.');
    }
  };

  const handleRestart = () => {
    if (channel) {
      channel.send({ type: 'broadcast', event: 'restart' });
    }
    setPieces(getInitialSetup());
    setTurn('cho');
    setWinner(null);
    setIsCheck(false);
    setSelectedPieceId(null);
    setPossibleMoves([]);
    setCapturedPieces([]);
  };

  const handlePieceClick = (id: string) => {
    if (winner) return; // 게임 종료 시 조작 불가
    
    // 멀티플레이: 자신의 턴이 아니거나 관전자면 조작 불가
    if (myRole !== turn) {
      console.log(`조작 불가: 현재 내 역할은 ${myRole}이며, 이번 턴은 ${turn}입니다.`);
      return; 
    }

    const piece = pieces.find((p) => p.id === id);
    if (!piece) return;

    // 내 기물 클릭 시
    if (piece.camp === turn) {
      // 이미 선택된 기물 다시 클릭 시 선택 해제
      if (selectedPieceId === id) {
        setSelectedPieceId(null);
        setPossibleMoves([]);
      } else {
        // 새로운 기물 선택
        audioService.playClickSound();
        setSelectedPieceId(id);
        setPossibleMoves(getPossibleMoves(piece, pieces));
      }
    } else {
      // 상대방 기물 클릭 시 (잡기)
      if (selectedPieceId) {
        const move = possibleMoves.find((m) => m.x === piece.x && m.y === piece.y);
        if (move) {
          handleMove(piece.x, piece.y);
        }
      }
    }
  };

  const handleMove = (x: number, y: number) => {
    if (!selectedPieceId || winner || myRole !== turn) return;

    // 타겟 위치에 적 기물(왕)이 있는지 먼저 확인
    const targetPiece = pieces.find((p) => p.x === x && p.y === y && p.id !== selectedPieceId);
    const isKingCaptured = targetPiece && targetPiece.type === 'king';

    // 새로운 배열 계산 (상태 업데이트 전)
    const nextPieces = pieces
      .filter((p) => !(p.x === x && p.y === y && p.id !== selectedPieceId))
      .map((p) => (p.id === selectedPieceId ? { ...p, x, y } : p));
      
    const nextTurn = turn === 'cho' ? 'han' : 'cho';
    const nextWinner = isKingCaptured ? turn : null;
    const nextIsCheck = checkForCheck(nextPieces, nextTurn);

    // 내 로컬 상태 먼저 업데이트
    setPieces(nextPieces);
    setTurn(nextTurn);
    setWinner(nextWinner);
    setSelectedPieceId(null);
    setPossibleMoves([]);
    setIsCheck(nextIsCheck);

    if (targetPiece) {
      setCapturedPieces(prev => [...prev, { ...targetPiece, isCaptured: true }]);
      setTimeout(() => {
        setCapturedPieces(prev => prev.filter(p => p.id !== targetPiece.id));
      }, 500);
    }

    // 사운드 재생
    if (isKingCaptured) {
      audioService.playWinSound();
    } else if (targetPiece) {
      audioService.playCaptureSound();
    } else {
      audioService.playMoveSound();
    }

    // 상대방에게 브로드캐스트 전송
    if (channel) {
      console.log('[Supabase] Broadcast Sent: move');
      channel.send({
        type: 'broadcast',
        event: 'move',
        payload: {
          nextPieces,
          nextTurn,
          winner: nextWinner,
          isCapture: !!targetPiece,
          capturedPiece: targetPiece ? { ...targetPiece, isCaptured: true } : null,
          isCheck: nextIsCheck
        }
      });
    }
  };

  return (
    <main className="w-full h-screen bg-neutral-900 relative">
      {/* 장군(Check) 알림 UI */}
      {isCheck && !winner && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 bg-red-900/10">
          <span className="text-red-500 font-black text-8xl drop-shadow-2xl opacity-80 animate-pulse" style={{ textShadow: '0 0 30px red' }}>
            장 군 !
          </span>
        </div>
      )}

      {/* 승패 모달 팝업 */}
      {winner && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto">
          <div className="bg-neutral-800 p-10 rounded-3xl shadow-2xl border border-white/10 text-center flex flex-col items-center gap-6 animate-bounce">
            <span className="text-yellow-400 text-5xl font-bold">
              🎉 {winner === 'cho' ? '초(Cho)' : '한(Han)'} 승리!
            </span>
            <p className="text-gray-300 text-lg">상대방의 왕을 제압했습니다.</p>
            <button
              onClick={handleRestart}
              className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-xl transition-transform hover:scale-105 active:scale-95"
            >
              다시 하기
            </button>
          </div>
        </div>
      )}

      {/* 승패 결과 및 턴 표시 UI */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 px-6 py-3 rounded-2xl text-white font-bold text-lg border border-white/20 shadow-lg pointer-events-auto text-center flex flex-col gap-1 items-center">
        {!winner && (
          <div className="text-xl">
            현재 턴: <span className={turn === 'cho' ? 'text-blue-400' : 'text-red-400'}>
              {turn === 'cho' ? '초(Cho)' : '한(Han)'}
            </span>
          </div>
        )}
        
        {/* 접속 정보 표시 */}
        <div className="text-sm font-normal text-gray-300 mt-1 bg-white/10 px-3 py-1 rounded-full flex gap-3 items-center">
          <span>방 코드: <span className="text-white font-mono">{roomId}</span></span>
          <button 
            onClick={copyRoomLink}
            className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
          >
            복사
          </button>
          <span>|</span>
          <span>
            나의 진영: 
            <span className={myRole === 'cho' ? 'text-blue-300 ml-1' : myRole === 'han' ? 'text-red-300 ml-1' : 'text-gray-400 ml-1'}>
              {myRole === 'cho' ? '초(Cho)' : myRole === 'han' ? '한(Han)' : myRole === 'spectator' ? '관전자(조작불가)' : '연결 중...'}
            </span>
          </span>
        </div>
      </div>

      <Canvas shadows camera={{ position: [0, 8, 12], fov: 45 }}>
        <CameraRig myRole={myRole} isCheck={isCheck} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Board />
        
        <Suspense fallback={
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshBasicMaterial color="red" />
          </mesh>
        }>
          {/* 장기판 시각화 */}
          <Board />

          {/* 32개 장기말 렌더링 */}
          {pieces.map((piece) => (
            <Piece
              key={piece.id}
              piece={piece}
              isSelected={selectedPieceId === piece.id}
              onClick={handlePieceClick}
            />
          ))}

          {/* 이동 가능한 위치 마커 렌더링 */}
          {possibleMoves.map((pos, idx) => (
            <MoveMarker 
              key={`move-${idx}`} 
              x={pos.x} 
              y={pos.y} 
              onClick={handleMove} 
            />
          ))}

          {/* 기울기 고정: 더 이상 마우스로 화면이 회전/이동하지 않도록 영구 고정 */}
          <OrbitControls 
            target={myRole === 'cho' ? [0, 0, -2] : [0, 0, 2]} // 시선 중심 평행이동 동기화
            enableRotate={false}  // 회전 금지 (현재 뷰 고정)
            enablePan={false}     // 이동 금지
            enableZoom={false}    // 줌 금지
          />
        </Suspense>
      </Canvas>
    </main>
  );
}
