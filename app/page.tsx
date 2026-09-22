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
  const [turn, setTurn] = useState<Camp>('cho'); // 실제 턴 로직
  const [uiTurn, setUiTurn] = useState<Camp>('cho'); // 전광판 시각적 턴 표시용 (애니메이션 대기)
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

  // 게임 모드 및 AI 워커 상태
  const [gameMode, setGameMode] = useState<'lobby' | 'online' | 'local_ai' | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room')) setGameMode('online');
    }
  }, []);
  const [lobbyRooms, setLobbyRooms] = useState<{ roomId: string; roomName: string; hostId: string }[]>([]);
  const [roomNameInput, setRoomNameInput] = useState('');
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null);
  const isCreator = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  // 게임 상태 Ref (비동기 콜백에서 최신 상태 참조용)
  const stateRef = useRef({ pieces, turn, winner });
  useEffect(() => {
    stateRef.current = { pieces, turn, winner };
  }, [pieces, turn, winner]);

  // 글로벌 로비 채널 연결 (앱 전체 수명주기 동안 유지)
  useEffect(() => {
    const lobbyCh = supabase.channel('global_lobby', {
      config: { presence: { key: myUserId } }
    });
    
    lobbyCh.on('presence', { event: 'sync' }, () => {
      const state = lobbyCh.presenceState();
      const activeRooms: { roomId: string; roomName: string; hostId: string }[] = [];
      
      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => {
          if (p.isHosting && p.roomId && p.roomName) {
            activeRooms.push({ roomId: p.roomId, roomName: p.roomName, hostId: p.user_id });
          }
        });
      });
      setLobbyRooms(activeRooms);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await lobbyCh.track({ user_id: myUserId, isHosting: false });
      }
    });

    lobbyChannelRef.current = lobbyCh;

    return () => {
      supabase.removeChannel(lobbyCh);
      lobbyChannelRef.current = null;
    };
  }, [myUserId]);

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
    if (gameMode === null) return;

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
    
    if (gameMode === 'local_ai') {
      // AI 모드일 경우 플레이어는 무조건 '초', AI는 '한'
      setMyRole('cho');
      return;
    }

    if (!currentRoomId) return;

    // 3. Supabase Realtime 연결 (온라인 모드일 때만)
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
          if (prev) return prev; // 이미 배정된 역할 고정
          
          if (isCreator.current) return 'cho'; // 방장 무조건 초나라
          
          // 방장이 아니라면(초대를 받고 들어옴), 실제 방장의 정보(presence)가 도착하여 방에 2명이 인지될 때까지 대기
          if (users.length < 2) return null;

          const myIndex = users.findIndex((u: any) => u.user_id === myUserId);
          if (myIndex === 0) return 'cho'; // fallback
          if (myIndex === 1) return 'han';
          if (myIndex > 1) return 'spectator';
          return null;
        });

        // 방에 2명 이상 들어왔고, 내가 호스트(index 0)라면 글로벌 로비에서 내 방을 숨김 처리
        if (users.length >= 2 && (users[0] as any).user_id === myUserId && lobbyChannelRef.current) {
          lobbyChannelRef.current.track({ user_id: myUserId, isHosting: false });
        }
        
        console.log('[Supabase] Presence Sync - Users:', users.length);
      })
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        console.log('[Supabase] Broadcast Received (move):', payload);
        const moveDelay = payload.moveDelay || 400;

        setPieces(payload.nextPieces);
        setTurn(payload.nextTurn);
        setTimeout(() => {
          setUiTurn(payload.nextTurn);
          setWinner(payload.winner);
          setIsCheck(payload.isCheck);
        }, moveDelay);
        
        setSelectedPieceId(null);
        setPossibleMoves([]);

        if (payload.capturedPiece) {
          // initially render at original size
          setCapturedPieces(prev => [...prev, payload.capturedPiece]);
          
          setTimeout(() => {
            // play sound and shrink
            if (payload.winner) audioService.playWinSound();
            else audioService.playCaptureSound();
            
            setCapturedPieces(prev => prev.map(p => p.id === payload.capturedPiece.id ? { ...p, isCaptured: true } : p));
            
            // remove entirely
            setTimeout(() => {
              setCapturedPieces(prev => prev.filter(p => p.id !== payload.capturedPiece.id));
            }, 500);
          }, moveDelay);
        } else {
          setTimeout(() => {
            audioService.playMoveSound();
          }, moveDelay);
        }
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
        setUiTurn(payload.turn);
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
        setUiTurn('cho');
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
  }, [gameMode]);

  // AI 턴 처리 및 Web Worker 초기화
  useEffect(() => {
    if (gameMode === 'local_ai') {
      if (!workerRef.current) {
        // workerRef.current = new Worker(new URL('./ai.worker.ts', import.meta.url));
        workerRef.current = undefined as any; // 임시 조치 (빌드 에러 원인 확인용)
        /*
        workerRef.current.onmessage = (e) => {
          if (e.data.type === 'SUCCESS') {
            const { bestMove } = e.data;
            if (bestMove) {
              // AI의 수를 실제 보드에 적용 (2초 대기 후 적용하여 내 기물의 다단계 애니메이션이 끝날 시간을 줌)
              setTimeout(() => {
                const piece = stateRef.current.pieces.find(p => p.id === bestMove.pieceId);
                if (piece) {
                  applyMove(bestMove.pieceId, bestMove.to.x, bestMove.to.y, 'han');
                }
              }, 2000);
            }
          } else {
            console.error('AI Error:', e.data.error);
          }
        };
        */
      }

      if (turn === 'han' && !winner) {
        // AI에게 현재 보드 상태 전달하여 연산 지시 (기본 깊이 3)
        workerRef.current.postMessage({
          board: stateRef.current.pieces,
          depth: 3,
          aiCamp: 'han'
        });
      }
    }

    return () => {
      if (workerRef.current && gameMode !== 'local_ai') {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [gameMode, turn, winner]);

  // 이동 공통 로직 (handleMove와 AI 턴에서 재사용)
  const applyMove = (pieceId: string, x: number, y: number, playerRole: Camp) => {
    if (winner) return;

    const currentPieces = stateRef.current.pieces;
    const targetPiece = currentPieces.find((p) => p.x === x && p.y === y && p.id !== pieceId);
    const isKingCaptured = targetPiece && targetPiece.type === 'king';

    const movingPiece = currentPieces.find((p) => p.id === pieceId);
    let moveDelay = 250;
    if (movingPiece?.type === 'horse') moveDelay = 400;
    else if (movingPiece?.type === 'elephant') moveDelay = 600;

    const nextPieces = currentPieces
      .filter((p) => !(p.x === x && p.y === y && p.id !== pieceId))
      .map((p) => (p.id === pieceId ? { ...p, x, y } : p));

    const nextTurn = playerRole === 'cho' ? 'han' : 'cho';
    const nextWinner = isKingCaptured ? playerRole : null;
    const nextIsCheck = checkForCheck(nextPieces, nextTurn);

    setPieces(nextPieces);
    setTurn(nextTurn);
    
    setTimeout(() => {
      setUiTurn(nextTurn);
      setWinner(nextWinner);
      setIsCheck(nextIsCheck);
    }, moveDelay);

    setSelectedPieceId(null);
    setPossibleMoves([]);

    if (targetPiece) {
      // 1. 사라지지 않고 대기 (isCaptured: false)
      setCapturedPieces(prev => [...prev, { ...targetPiece, isCaptured: false }]);
      
      setTimeout(() => {
        // 2. 도착 순간 사운드 및 축소 애니메이션 시작
        if (isKingCaptured) audioService.playWinSound();
        else audioService.playCaptureSound();
        
        setCapturedPieces(prev => prev.map(p => p.id === targetPiece.id ? { ...p, isCaptured: true } : p));
        
        // 3. 축소 완료 후 배열에서 제거
        setTimeout(() => {
          setCapturedPieces(prev => prev.filter(p => p.id !== targetPiece.id));
        }, 500);
      }, moveDelay);
    } else {
      setTimeout(() => {
        audioService.playMoveSound();
      }, moveDelay);
    }

    // 온라인 모드일 때만 브로드캐스트
    if (gameMode === 'online' && channel && playerRole === myRole) {
      console.log('[Supabase] Broadcast Sent: move');
      channel.send({
        type: 'broadcast',
        event: 'move',
        payload: {
          nextPieces,
          nextTurn,
          winner: nextWinner,
          isCapture: !!targetPiece,
          capturedPiece: targetPiece ? { ...targetPiece, isCaptured: false } : null,
          isCheck: nextIsCheck,
          moveDelay
        }
      });
    }
  };

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
    
    // 멀티플레이: 자신의 턴이 아니거나 관전자면 조작 불가, AI전에서는 내 턴일때만 가능
    if (gameMode === 'local_ai' && turn !== 'cho') return;
    if (gameMode === 'online' && myRole !== turn) {
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
    if (!selectedPieceId || winner) return;
    if (gameMode === 'online' && myRole !== turn) return;
    if (gameMode === 'local_ai' && turn !== 'cho') return;

    applyMove(selectedPieceId, x, y, turn);
  };

  const createRoom = async () => {
    if (!roomNameInput.trim()) return;
    const newRoomId = generateRoomId();
    isCreator.current = true; // 방을 만든 사람은 무조건 초나라
    if (lobbyChannelRef.current) {
      await lobbyChannelRef.current.track({
        user_id: myUserId,
        isHosting: true,
        roomName: roomNameInput.trim(),
        roomId: newRoomId
      });
    }
    window.history.replaceState(null, '', `?room=${newRoomId}`);
    setRoomId(newRoomId);
    setGameMode('online');
  };

  const joinRoom = (targetRoomId: string) => {
    window.history.replaceState(null, '', `?room=${targetRoomId}`);
    setRoomId(targetRoomId);
    setGameMode('online');
  };

  if (!isMounted) return null;

  if (gameMode === null) {
    return (
      <main className="w-full h-screen bg-neutral-900 flex items-center justify-center relative overflow-hidden">
        {/* 장식용 배경 요소 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="bg-neutral-800/80 backdrop-blur-md p-12 rounded-[2.5rem] shadow-2xl border border-white/10 z-10 flex flex-col items-center max-w-2xl w-full mx-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500" />
          
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-400 mb-4 tracking-tight">
            초한대전
          </h1>
          <p className="text-neutral-400 text-lg mb-12">클래식 전략 게임을 3D로 즐기세요</p>
          
          <div className="flex flex-col sm:flex-row gap-6 w-full px-4">
            <button
              onClick={() => setGameMode('lobby')}
              className="flex-1 group relative p-6 bg-neutral-700/50 hover:bg-neutral-600/80 border border-white/5 hover:border-blue-500/50 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/20 text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <span className="block text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">1:1 온라인 대전</span>
                <span className="block text-sm text-neutral-400">친구와 방을 공유하여 실시간으로 대결합니다.</span>
              </div>
            </button>
            
            <button
              onClick={() => setGameMode('local_ai')}
              className="flex-1 group relative p-6 bg-neutral-700/50 hover:bg-neutral-600/80 border border-white/5 hover:border-red-500/50 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/20 text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <span className="block text-2xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">컴퓨터와 대결</span>
                <span className="block text-sm text-neutral-400">브라우저 내장 AI와 가볍게 연습 게임을 즐깁니다.</span>
              </div>
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (gameMode === 'lobby') {
    return (
      <main className="w-full h-screen bg-neutral-900 flex flex-col items-center justify-center relative overflow-hidden">
        {/* 장식용 배경 요소 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="bg-neutral-800/80 backdrop-blur-md p-10 rounded-[2.5rem] shadow-2xl border border-white/10 z-10 flex flex-col max-w-2xl w-full mx-4 relative overflow-hidden h-[80vh]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500" />
          
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-400">
              온라인 대기실
            </h1>
            <button 
              onClick={() => setGameMode(null)}
              className="text-neutral-400 hover:text-white px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
            >
              ← 뒤로가기
            </button>
          </div>

          <div className="flex flex-col gap-4 mb-8">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="방 이름을 입력하세요"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                maxLength={20}
                className="flex-1 bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && createRoom()}
              />
              <button
                onClick={createRoom}
                disabled={!roomNameInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold px-8 rounded-xl transition-all shadow-lg hover:shadow-blue-500/20"
              >
                방 만들기
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 custom-scrollbar">
            <h2 className="text-xl font-bold text-neutral-300 mb-2">접속 가능한 방 ({lobbyRooms.length})</h2>
            
            {lobbyRooms.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-4">
                <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <p>생성된 방이 없습니다. 새로운 방을 만들어 보세요!</p>
              </div>
            ) : (
              lobbyRooms.map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => joinRoom(room.roomId)}
                  className="w-full group bg-neutral-700/30 hover:bg-neutral-600/50 border border-white/5 hover:border-blue-500/30 p-4 rounded-xl text-left transition-all flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {room.roomName}
                    </span>
                    <span className="text-sm text-neutral-400 mt-1">
                      방 코드: {room.roomId}
                    </span>
                  </div>
                  <div className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg font-bold group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    입장하기
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </main>
    );
  }

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

      {/* 좌측 상단 컨트롤 (다시 버튼) */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <button 
          onClick={() => {
            if (confirm('메인 화면으로 돌아가시겠습니까? 진행 중인 게임은 초기화됩니다.')) {
              window.location.href = '/';
            }
          }}
          className="bg-red-500/80 hover:bg-red-600 px-4 py-2 rounded-xl text-white font-bold shadow-lg transition-colors border border-white/20"
        >
          다시
        </button>
      </div>

      {/* 승패 결과 및 턴 표시 UI */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 px-6 py-3 rounded-2xl text-white font-bold text-lg border border-white/20 shadow-lg pointer-events-auto text-center flex flex-col gap-2 items-center">

        {!winner && (
          <div className="text-xl">
            현재 턴: <span className={uiTurn === 'cho' ? 'text-blue-400' : 'text-red-400'}>
              {uiTurn === 'cho' ? (myRole === 'cho' ? '나(楚)' : myRole === 'han' ? '상대(楚)' : '초(楚)') : (myRole === 'han' ? '나(漢)' : myRole === 'cho' ? '상대(漢)' : '한(漢)')}
            </span>
          </div>
        )}
        
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

        </Suspense>
      </Canvas>
    </main>
  );
}
