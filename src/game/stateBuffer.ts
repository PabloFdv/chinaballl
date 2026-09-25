import { ChinaBallEngine, PlayerDisc } from './chinaEngine';

export interface PlayerSnapshot {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: 'red' | 'blue';
  isKicking: boolean;
  color?: string;
  number?: string;
}

export interface ReplayFrame {
  timestamp: number;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
  };
  players: PlayerSnapshot[];
  scoringTeam?: 'red' | 'blue';
}

export class ReplayBuffer {
  private buffer: ReplayFrame[] = [];
  private maxFrames: number;
  private isReplaying = false;
  private replayFrames: ReplayFrame[] = [];
  private playbackIndex = 0;
  private playbackSubFrame = 0;
  private playbackSpeed = 0.4; // Câmera lenta suave (0.4x)
  public scoringTeam: 'red' | 'blue' | null = null;
  public onReplayFinished?: () => void;

  constructor(seconds = 5.0, fps = 60) {
    this.maxFrames = Math.round(seconds * fps);
  }

  /**
   * Grava um frame a cada tick de física
   */
  public record(engine: ChinaBallEngine): void {
    if (this.isReplaying) return;

    const frame: ReplayFrame = {
      timestamp: performance.now(),
      ball: {
        x: engine.ball.x,
        y: engine.ball.y,
        vx: engine.ball.vx,
        vy: engine.ball.vy,
        angle: engine.ballAngle,
      },
      players: engine.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        team: p.team,
        isKicking: Boolean(p.isKicking),
        color: p.color,
        number: p.number,
      })),
    };

    this.buffer.push(frame);
    if (this.buffer.length > this.maxFrames) {
      this.buffer.shift();
    }
  }

  /**
   * Inicia a reprodução em câmera lenta dos últimos frames gravados
   */
  public triggerGoalReplay(team: 'red' | 'blue'): boolean {
    if (this.buffer.length < 15) return false;
    this.scoringTeam = team;
    this.replayFrames = [...this.buffer];
    this.playbackIndex = 0;
    this.playbackSubFrame = 0;
    this.isReplaying = true;
    return true;
  }

  public get active(): boolean {
    return this.isReplaying;
  }

  public get progress(): number {
    if (!this.isReplaying || this.replayFrames.length === 0) return 0;
    return Math.min(1, this.playbackIndex / this.replayFrames.length);
  }

  /**
   * Atualiza e avança o replay no frame rate desejado
   */
  public update(engine: ChinaBallEngine): boolean {
    if (!this.isReplaying || this.replayFrames.length === 0) return false;

    this.playbackSubFrame += this.playbackSpeed;
    if (this.playbackSubFrame >= 1.0) {
      const advance = Math.floor(this.playbackSubFrame);
      this.playbackIndex += advance;
      this.playbackSubFrame -= advance;
    }

    if (this.playbackIndex >= this.replayFrames.length) {
      this.stop();
      return false;
    }

    const cur = this.replayFrames[this.playbackIndex];
    const next = this.replayFrames[Math.min(this.replayFrames.length - 1, this.playbackIndex + 1)];
    const t = this.playbackSubFrame;

    // Interpola a bola suavemente
    engine.ball.x = cur.ball.x + (next.ball.x - cur.ball.x) * t;
    engine.ball.y = cur.ball.y + (next.ball.y - cur.ball.y) * t;
    engine.ball.vx = cur.ball.vx;
    engine.ball.vy = cur.ball.vy;
    engine.ballAngle = cur.ball.angle;

    // Interpola os jogadores
    for (const pSnap of cur.players) {
      const match = engine.players.find((p) => p.id === pSnap.id);
      if (match) {
        const nextSnap = next.players.find((p) => p.id === pSnap.id) || pSnap;
        match.x = pSnap.x + (nextSnap.x - pSnap.x) * t;
        match.y = pSnap.y + (nextSnap.y - pSnap.y) * t;
        match.vx = pSnap.vx;
        match.vy = pSnap.vy;
        match.isKicking = pSnap.isKicking;
      }
    }

    return true;
  }

  public stop(): void {
    if (!this.isReplaying) return;
    this.isReplaying = false;
    this.scoringTeam = null;
    this.playbackIndex = 0;
    this.playbackSubFrame = 0;
    if (this.onReplayFinished) {
      this.onReplayFinished();
    }
  }

  public clear(): void {
    this.buffer = [];
    this.stop();
  }
}
