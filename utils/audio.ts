'use client';

class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
  }

  // 기물 선택 시 가볍고 경쾌한 사운드 (탁!)
  public playClickSound() {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // 상대 기물을 잡을 때 좀 더 날카롭고 묵직한 타격음 (깡! 탁!)
  public playCaptureSound() {
    this.init();
    if (!this.ctx) return;

    // 1. 나무 부딪히는 묵직한 베이스 (기본 마찰음)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.1);
    gain1.gain.setValueAtTime(1, this.ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start();
    osc1.stop(this.ctx.currentTime + 0.15);

    // 2. 부딪혀서 튕기는 날카로운 고음 (타격감 추가)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.7, this.ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start();
    osc2.stop(this.ctx.currentTime + 0.1);
  }

  // 기물 놓을 때 묵직한 마찰음 (딱!)
  public playMoveSound() {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    // 나무가 부딪히는 둔탁한 소리를 위해 주파수를 낮추고 빠르게 떨어뜨림
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);

    // 어택감을 강하게
    gainNode.gain.setValueAtTime(1, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // 승리 시 축하 사운드 (팡파레: 빰- 빰- 빠-밤!)
  public playWinSound() {
    this.init();
    if (!this.ctx) return;

    const playNote = (freq: number, startTime: number, duration: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine'; // 맑은 관악기 느낌
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05); // Attack
      gain.gain.setValueAtTime(0.5, startTime + duration - 0.1); // Sustain
      gain.gain.linearRampToValueAtTime(0, startTime + duration); // Release

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = this.ctx.currentTime;
    
    // C Major Arpeggio (도 미 솔 도)
    playNote(523.25, now, 0.2);        // C5
    playNote(659.25, now + 0.25, 0.2); // E5
    playNote(783.99, now + 0.5, 0.2);  // G5
    playNote(1046.50, now + 0.75, 0.6); // C6 (길게)
  }
}

export const audioService = new AudioService();
