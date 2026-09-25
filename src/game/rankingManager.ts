export interface MatchRecord {
  id: string;
  timestamp: number;
  mode: string;
  mapSize: string;
  team: 'red' | 'blue';
  scoreYellow: number;
  scoreBlue: number;
  result: 'win' | 'loss' | 'draw';
  playerGoals: number;
  playerShots: number;
  durationSeconds: number;
  isRankedOnline?: boolean;
}

export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  goalsConceded: number;
  shotsTotal: number;
  cleanSheets: number;
  eloRating: number;
  history: MatchRecord[];
}

const STORAGE_KEY = 'chinaball_ranking_v2';

const INITIAL_STATS: PlayerStats = {
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  goalsScored: 0,
  goalsConceded: 0,
  shotsTotal: 0,
  cleanSheets: 0,
  eloRating: 0, // O Elo começa zerado conforme solicitado!
  history: [],
};

class RankingManager {
  private stats: PlayerStats;

  constructor() {
    this.stats = this.loadStats();
  }

  private loadStats(): PlayerStats {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...INITIAL_STATS,
          ...parsed,
          eloRating: typeof parsed.eloRating === 'number' ? parsed.eloRating : 0,
          history: Array.isArray(parsed.history) ? parsed.history : [],
        };
      }
    } catch {}
    return { ...INITIAL_STATS };
  }

  public saveStats(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch {}
  }

  public getStats(): PlayerStats {
    return { ...this.stats };
  }

  public recordMatch(record: Omit<MatchRecord, 'id' | 'timestamp'>): void {
    const fullRecord: MatchRecord = {
      ...record,
      id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    this.stats.matchesPlayed += 1;
    this.stats.goalsScored += fullRecord.playerGoals;
    this.stats.shotsTotal += Math.max(fullRecord.playerShots, fullRecord.playerGoals);

    const opponentGoals = record.team === 'red' ? record.scoreBlue : record.scoreYellow;
    this.stats.goalsConceded += opponentGoals;
    if (opponentGoals === 0) {
      this.stats.cleanSheets += 1;
    }

    if (fullRecord.result === 'win') {
      this.stats.wins += 1;
    } else if (fullRecord.result === 'loss') {
      this.stats.losses += 1;
    } else {
      this.stats.draws += 1;
    }

    // O ELO SÓ VALIDA EM RANK CONTRA PESSOAS REAIS ONLINE!
    if (fullRecord.isRankedOnline) {
      if (fullRecord.result === 'win') {
        this.stats.eloRating += 30 + Math.min(15, fullRecord.playerGoals * 3);
      } else if (fullRecord.result === 'loss') {
        this.stats.eloRating = Math.max(0, this.stats.eloRating - 16);
      } else {
        this.stats.eloRating += 5;
      }
    }

    // Mantém as últimas 40 partidas
    this.stats.history = [fullRecord, ...this.stats.history].slice(0, 40);
    this.saveStats();
  }

  // Métricas Calculadas
  public getWinRate(): number {
    if (this.stats.matchesPlayed === 0) return 0;
    return Math.round((this.stats.wins / this.stats.matchesPlayed) * 100);
  }

  public getGoalConversionRate(): number {
    if (this.stats.shotsTotal === 0) return 0;
    return Math.min(100, Math.round((this.stats.goalsScored / this.stats.shotsTotal) * 100));
  }

  public getAverageGoalsPerMatch(): number {
    if (this.stats.matchesPlayed === 0) return 0;
    return Number((this.stats.goalsScored / this.stats.matchesPlayed).toFixed(2));
  }

  public getRankTier(): { title: string; color: string; badge: string } {
    const elo = this.stats.eloRating;
    if (elo >= 1000) return { title: 'Mestre Lendário', color: '#f59e0b', badge: '👑' };
    if (elo >= 650) return { title: 'Craque Diamante', color: '#38bdf8', badge: '💎' };
    if (elo >= 400) return { title: 'Profissional Ouro', color: '#eab308', badge: '🥇' };
    if (elo >= 200) return { title: 'Avançado Prata', color: '#94a3b8', badge: '🥈' };
    if (elo >= 50) return { title: 'Bronze Competitivo', color: '#b45309', badge: '🥉' };
    return { title: 'Sem Ranking (0 ELO)', color: '#71717a', badge: '🌱' };
  }

  public resetStats(): void {
    this.stats = { ...INITIAL_STATS, history: [] };
    this.saveStats();
  }
}

export const rankingManager = new RankingManager();
