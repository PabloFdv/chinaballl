import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Trophy,
  Users,
  Palette,
  Volume2,
  VolumeX,
  Smartphone,
  Eye,
  Activity,
  PlusCircle,
  LogIn,
  ChevronRight,
  Shield,
  Zap,
  Globe,
  Flame,
  Check,
  Download,
  Share2,
  Copy,
  Gauge,
  Wifi,
  Scale,
  Award,
  TrendingUp,
  Percent,
  Clock,
  Trash2,
} from 'lucide-react';
import { HudConfig } from './HudSettingsModal';
import { PlayerProfile } from '../game/types';
import { MapSize, MAP_DIMENSIONS } from '../game/physicsConfig';
import { rankingManager, PlayerStats } from '../game/rankingManager';

export interface RoomInfo {
  id: string;
  name: string;
  mapSize: MapSize;
  teamSize?: number;
  mode: string;
  players: number;
  maxPlayers: number;
  goalLimit: number;
  timeLimit?: number;
  ping: number;
  region: string;
  hostPing?: number;
  hostIp?: string;
  pingQuality?: string;
  bufferDelayMs?: number;
}

export type MenuTab = 'play' | 'rooms' | 'ranking' | 'mobile' | 'settings' | 'profile';

interface GameMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'training' | 'hud' | 'rooms' | 'profile' | 'play' | 'settings' | 'mobile' | 'ranking';
  botMode: 'solo' | 'easy' | 'medium' | 'hard';
  onSelectBotMode: (mode: 'solo' | 'easy' | 'medium' | 'hard') => void;
  teamSize: 1 | 2 | 3 | 4;
  mapSize: MapSize;
  onSelectMatchFormat: (teamSize: 1 | 2 | 3 | 4, mapSize: MapSize) => void;
  hudConfig: HudConfig;
  onHudChange: (newConfig: HudConfig) => void;
  profile: PlayerProfile;
  onProfileChange: (newProfile: PlayerProfile) => void;
  activeRoomName: string;
  onJoinRoom: (room: RoomInfo, preferredTeam?: 'red' | 'blue' | 'spec') => void;
  onCreateRoom: (
    roomName: string,
    mapSize: MapSize,
    teamSize: 1 | 2 | 3 | 4,
    goalLimit: number,
    timeLimit: number,
    ownerTeam: 'red' | 'blue' | 'spec'
  ) => void;
  onToggleOrientation: () => void;
  isLandscapeForced: boolean;
}

const COLOR_OPTIONS = [
  { name: 'Ouro Real', color: '#f59e0b', accent: '#ffffff' },
  { name: 'China Red', color: '#ef4444', accent: '#ffffff' },
  { name: 'Azul Celeste', color: '#2563eb', accent: '#ffffff' },
  { name: 'Verde Brasil', color: '#10b981', accent: '#ffffff' },
  { name: 'Roxo Imperial', color: '#8b5cf6', accent: '#ffffff' },
  { name: 'Preto Grafite', color: '#1e293b', accent: '#38bdf8' },
  { name: 'Branco Prata', color: '#f1f5f9', accent: '#0f172a' },
  { name: 'Ciano Neon', color: '#06b6d4', accent: '#ffffff' },
];

export const GameMenuModal: React.FC<GameMenuModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'play',
  botMode,
  onSelectBotMode,
  teamSize,
  mapSize,
  onSelectMatchFormat,
  hudConfig,
  onHudChange,
  profile,
  onProfileChange,
  activeRoomName,
  onJoinRoom,
  onCreateRoom,
}) => {
  const normalizeTab = (t: string): MenuTab => {
    if (t === 'rooms') return 'rooms';
    if (t === 'ranking') return 'ranking';
    if (t === 'mobile') return 'mobile';
    if (t === 'settings' || t === 'hud') return 'settings';
    if (t === 'profile') return 'profile';
    return 'play';
  };

  const [activeTab, setActiveTab] = useState<MenuTab>(normalizeTab(initialTab));

  useEffect(() => {
    if (isOpen) {
      setActiveTab(normalizeTab(initialTab));
    }
  }, [isOpen, initialTab]);

  const [onlineRooms, setOnlineRooms] = useState<RoomInfo[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomFilter, setRoomFilter] = useState<'all' | '1v1' | '2v2' | '3v3' | '4v4'>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Ranking data
  const [rankingStats, setRankingStats] = useState<PlayerStats>(() => rankingManager.getStats());

  useEffect(() => {
    if (isOpen && activeTab === 'ranking') {
      setRankingStats(rankingManager.getStats());
    }
  }, [isOpen, activeTab]);

  // Criar Sala state
  const [showCreateRoomForm, setShowCreateRoomForm] = useState(false);
  const [newRoomName, setNewRoomName] = useState('Arena Pro 1v1');
  const [newRoomMapSize, setNewRoomMapSize] = useState<MapSize>('1v1');
  const [newRoomTeamSize, setNewRoomTeamSize] = useState<1 | 2 | 3 | 4>(1);
  const [newGoalLimit, setNewGoalLimit] = useState(5);
  const [newTimeLimit, setNewTimeLimit] = useState(5);
  const [newOwnerTeam, setNewOwnerTeam] = useState<'red' | 'blue' | 'spec'>('red');

  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setOnlineRooms(data.rooms || []);
      } else {
        setOnlineRooms([]);
      }
    } catch {
      // 100% Real: sem salas falsas
      setOnlineRooms([]);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'rooms') {
      fetchRooms();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCopyMobileLink = () => {
    const soloUrl = `${window.location.origin}/download/ChinaBall_Solo_Mobile.html`;
    navigator.clipboard.writeText(soloUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => {});
  };

  const handleCopyRoomInvite = (roomId: string) => {
    const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedRoomId(roomId);
      setTimeout(() => setCopiedRoomId(null), 2000);
    }).catch(() => {});
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim() || 'Arena Pro',
          mapSize: newRoomMapSize,
          teamSize: newRoomTeamSize,
          goalLimit: newGoalLimit,
          timeLimit: newTimeLimit,
          ownerTeam: newOwnerTeam,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreateRoom(
          data.room.name,
          data.room.mapSize,
          data.room.teamSize,
          data.room.goalLimit,
          data.room.timeLimit,
          newOwnerTeam
        );
        setNotification(`Sala "${data.room.name}" aberta! Você é o dono e árbitro.`);
        setTimeout(() => {
          setNotification(null);
          onClose();
        }, 1200);
        return;
      }
    } catch {}

    onCreateRoom(newRoomName.trim() || 'Arena Pro', newRoomMapSize, newRoomTeamSize, newGoalLimit, newTimeLimit, newOwnerTeam);
    onClose();
  };

  const filteredRooms = onlineRooms.filter((r) => {
    if (roomFilter === 'all') return true;
    return r.mapSize === roomFilter;
  });

  const rankTier = rankingManager.getRankTier();
  const winRate = rankingManager.getWinRate();
  const conversionRate = rankingManager.getGoalConversionRate();
  const avgGoals = rankingManager.getAverageGoalsPerMatch();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#0c1015] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* Cabeçalho Profissional e Limpo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-[#10151c]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center font-bold text-amber-400 text-sm shadow-sm">
              ⚽
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  ChinaBall <span className="text-amber-400 font-extrabold">PRO</span>
                </h2>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  v2.5
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <span>{rankTier.badge}</span>
                  <span>{rankTier.title} ({rankingStats.eloRating} ELO)</span>
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Física Canônica, Replay Instantâneo & Ranking Competitivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
              title="Fechar Menu (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificação Toast */}
        {notification && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-200 text-xs px-4 py-2 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Navegação por Abas Estilo Esport Clean */}
        <div className="flex items-center px-4 pt-2 border-b border-zinc-800/80 bg-[#0f141a] overflow-x-auto no-scrollbar gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('play')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'play'
                ? 'border-amber-400 text-amber-300 bg-zinc-800/40'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Modos de Jogo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'rooms'
                ? 'border-amber-400 text-amber-300 bg-zinc-800/40'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Salas Online</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              100% Real
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ranking')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'ranking'
                ? 'border-amber-400 text-amber-300 bg-zinc-800/40'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20'
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>Ranking & Estatísticas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mobile')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'mobile'
                ? 'border-amber-400 text-amber-300 bg-zinc-800/40'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Versão Mobile (Solo)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-amber-400 text-amber-300 bg-zinc-800/40'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Configurações</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-amber-400 text-amber-300 bg-zinc-800/40'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Meu Perfil</span>
          </button>
        </div>

        {/* Conteúdo Principal das Abas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* ABA 1: MODOS DE JOGO */}
          {activeTab === 'play' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  1. Escolha o Formato da Partida
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Card: Treino Solo Livre */}
                  <div
                    onClick={() => onSelectBotMode('solo')}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      botMode === 'solo'
                        ? 'bg-amber-950/20 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-[#12171f] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-white">Treino Solo Livre</span>
                      </div>
                      {botMode === 'solo' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                          SELECIONADO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Campo aberto para treinar chutes, condução colada, efeitos tangenciais e puxar a bola de volta com tecla R.
                    </p>
                  </div>

                  {/* Card: Duelo 1v1 contra Bot */}
                  <div
                    onClick={() => {
                      if (botMode === 'solo') onSelectBotMode('medium');
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      botMode !== 'solo'
                        ? 'bg-blue-950/20 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                        : 'bg-[#12171f] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-bold text-white">Duelo 1v1 com Bot</span>
                      </div>
                      {botMode !== 'solo' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                          SELECIONADO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                      Enfrente o robô com IA realista (sem chutes de costas ou ângulos impossíveis).
                    </p>

                    {/* Dificuldade do Bot */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/80">
                      {(['easy', 'medium', 'hard'] as const).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBotMode(diff);
                          }}
                          className={`flex-1 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                            botMode === diff
                              ? diff === 'easy'
                                ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
                                : diff === 'hard'
                                ? 'bg-rose-500/20 border border-rose-500 text-rose-300 font-bold'
                                : 'bg-blue-500/20 border border-blue-500 text-blue-300'
                              : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-transparent'
                          }`}
                        >
                          {diff === 'easy' ? 'Fácil' : diff === 'medium' ? 'Médio' : 'Craque'}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Formato do Campo */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  2. Dimensão do Campo
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['1v1', '2v2', '3v3', '4v4'] as MapSize[]).map((size) => {
                    const info = MAP_DIMENSIONS[size];
                    const numPlayers = size === '1v1' ? 1 : size === '2v2' ? 2 : size === '3v3' ? 3 : 4;
                    const isSelected = mapSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => onSelectMatchFormat(numPlayers as 1 | 2 | 3 | 4, size)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-800 border-amber-400/80 text-white shadow-sm ring-1 ring-amber-400/30'
                            : 'bg-[#12171f] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white mb-0.5">{info.name}</div>
                        <div className="text-[11px] text-zinc-500 leading-tight">{info.width}x{info.height}px</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm tracking-wide transition-all shadow-lg active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>ENTRAR EM CAMPO</span>
                </button>
              </div>
            </div>
          )}

          {/* ABA 2: SALAS ONLINE (MULTI PLAYER COM ÁRBITRO E PING BALANCEADO) */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              
              {/* Banner de Explicação da Tecnologia de Ping Balanceado & Árbitro */}
              <div className="p-3.5 rounded-xl bg-[#121922] border border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Scale className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Salas Online com Árbitro & Ping Adaptativo</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                        Ativo
                      </span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      O criador da sala tem controle de <strong>Árbitro</strong> e escolhe seu time, tempo e limite de gols. Quando o dono sai, o jogador mais antigo assume automaticamente a sala!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateRoomForm((prev) => !prev)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{showCreateRoomForm ? 'Ver Salas' : 'Criar Nova Sala'}</span>
                </button>
              </div>

              {/* Formulário de Criação de Sala */}
              {showCreateRoomForm ? (
                <form onSubmit={handleCreateRoom} className="p-4 rounded-xl bg-[#12171f] border border-zinc-800 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Configurar Nova Sala</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Nome da Sala</label>
                      <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Ex: Arena Pro 1v1"
                        maxLength={35}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Formato / Mapa</label>
                      <select
                        value={newRoomMapSize}
                        onChange={(e) => {
                          const size = e.target.value as MapSize;
                          setNewRoomMapSize(size);
                          setNewRoomTeamSize(size === '4v4' ? 4 : size === '3v3' ? 3 : size === '2v2' ? 2 : 1);
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="1v1">1v1 Duelo Rápido</option>
                        <option value="2v2">2v2 Duplas</option>
                        <option value="3v3">3v3 Trio Pro</option>
                        <option value="4v4">4v4 Estádio Monumental</option>
                      </select>
                    </div>

                    {/* Escolha do Time do Dono da Sala */}
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Meu Time Inicial</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNewOwnerTeam('red')}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                            newOwnerTeam === 'red'
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          🟡 Amarelo
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewOwnerTeam('blue')}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                            newOwnerTeam === 'blue'
                              ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          🔵 Azul
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewOwnerTeam('spec')}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                            newOwnerTeam === 'spec'
                              ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          👀 Árbitro
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Duração da Partida</label>
                      <select
                        value={newTimeLimit}
                        onChange={(e) => setNewTimeLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value={3}>3 Minutos</option>
                        <option value={5}>5 Minutos (Padrão)</option>
                        <option value={7}>7 Minutos</option>
                        <option value={10}>10 Minutos</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Limite de Gols</label>
                      <select
                        value={newGoalLimit}
                        onChange={(e) => setNewGoalLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value={3}>3 Gols</option>
                        <option value={5}>5 Gols (Padrão)</option>
                        <option value={7}>7 Gols</option>
                        <option value={10}>10 Gols</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide transition-colors cursor-pointer shadow-md"
                      >
                        Publicar Sala Online
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* Lista de Salas Ativas 100% Reais */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {(['all', '1v1', '2v2', '3v3', '4v4'] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setRoomFilter(filter)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                            roomFilter === filter
                              ? 'bg-zinc-800 text-white border border-zinc-700'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {filter === 'all' ? 'Todas' : filter}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={fetchRooms}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isLoadingRooms ? 'animate-spin' : ''}`} />
                      <span>Atualizar</span>
                    </button>
                  </div>

                  {filteredRooms.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#12171f] border border-zinc-800 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-zinc-800/80 text-zinc-400 mx-auto flex items-center justify-center border border-zinc-700/50 shadow-inner">
                        <Wifi className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">Nenhuma sala aberta no momento</h4>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                          Servidor 100% autêntico e sem partidas fictícias. Seja o primeiro a abrir uma sala online com IP e cálculo de ping balanceado!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCreateRoomForm(true)}
                        className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-md active:scale-95"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Criar Sala Agora</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredRooms.map((room) => (
                        <div
                          key={room.id}
                          className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{room.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                                {room.mapSize}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                                ⚖️ {room.ping || 20}ms
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400 font-mono">
                              <span>Host: {room.hostIp || '177.136.*.*'}</span>
                              <span>•</span>
                              <span>Região: {room.region || 'BR-SP'}</span>
                              <span>•</span>
                              <span>{room.players}/{room.maxPlayers} Jogadores</span>
                              <span>•</span>
                              <span>{room.goalLimit} Gols | {room.timeLimit || 5} min</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyRoomInvite(room.id)}
                              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700"
                              title="Copiar Link de Convite para o Grupo"
                            >
                              {copiedRoomId === room.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Share2 className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedRoomId === room.id ? 'Link Copiado!' : 'Convidar'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onJoinRoom(room);
                                onClose();
                              }}
                              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>Entrar na Sala</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: RANKING & HISTÓRICO COM ESTATÍSTICAS AVANÇADAS */}
          {activeTab === 'ranking' && (
            <div className="space-y-4">
              {/* Card de Nível e ELO */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#121922] to-[#1a2230] border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-amber-500/40 flex items-center justify-center text-3xl shadow-lg">
                    {rankTier.badge}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Tier Competitivo</div>
                    <div className="text-lg font-black text-white flex items-center gap-2">
                      <span style={{ color: rankTier.color }}>{rankTier.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono border border-zinc-700">
                        {rankingStats.eloRating} ELO
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Suba de ranking vencendo partidas e marcando gols em ritmo elevado.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    rankingManager.resetStats();
                    setRankingStats(rankingManager.getStats());
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 hover:text-rose-300 text-zinc-400 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
                  title="Limpar Histórico Local"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Zerar Dados</span>
                </button>
              </div>

              {/* Grid de Métricas Avançadas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-400 mb-1">
                    <span className="text-xs font-semibold">Aproveitamento</span>
                    <Percent className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-black text-emerald-400 font-mono">{winRate}%</div>
                  <div className="text-[10px] text-zinc-500">{rankingStats.wins}V - {rankingStats.draws}E - {rankingStats.losses}D</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-400 mb-1">
                    <span className="text-xs font-semibold">Conversão de Chutes</span>
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-amber-400 font-mono">{conversionRate}%</div>
                  <div className="text-[10px] text-zinc-500">{rankingStats.goalsScored} gols em {rankingStats.shotsTotal} chutes</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-400 mb-1">
                    <span className="text-xs font-semibold">Média de Gols/Jogo</span>
                    <Activity className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-xl font-black text-cyan-400 font-mono">{avgGoals}</div>
                  <div className="text-[10px] text-zinc-500">Saldo: {rankingStats.goalsScored - rankingStats.goalsConceded} gols</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-400 mb-1">
                    <span className="text-xs font-semibold">Jogos Sem Sofrer Gol</span>
                    <Shield className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-xl font-black text-purple-400 font-mono">{rankingStats.cleanSheets}</div>
                  <div className="text-[10px] text-zinc-500">{rankingStats.matchesPlayed} partidas disputadas</div>
                </div>
              </div>

              {/* Histórico das Últimas Partidas */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Histórico Recente de Partidas
                </h4>

                {rankingStats.history.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#12171f] border border-zinc-800 text-center text-xs text-zinc-400">
                    Nenhuma partida registrada ainda. Jogue uma partida solo ou online para ver seu histórico detalhado aqui!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {rankingStats.history.map((m) => (
                      <div
                        key={m.id}
                        className="px-3.5 py-2.5 rounded-lg bg-[#12171f] border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                              m.result === 'win'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : m.result === 'loss'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                            }`}
                          >
                            {m.result === 'win' ? 'V' : m.result === 'loss' ? 'D' : 'E'}
                          </span>

                          <span className="font-bold text-white font-mono">
                            {m.scoreYellow} : {m.scoreBlue}
                          </span>

                          <span className="text-[11px] text-zinc-400">
                            {m.mode} ({m.mapSize})
                          </span>

                          <span className="text-[10px] text-zinc-500 font-mono">
                            Time {m.team === 'red' ? '🟡 Amarelo' : '🔵 Azul'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                          <span>{m.playerGoals} gols</span>
                          <span>•</span>
                          <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 4: VERSÃO MOBILE SOLO (OFFLINE) */}
          {activeTab === 'mobile' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#12171f] border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">ChinaBall Solo Mobile (HTML Offline)</h3>
                    <p className="text-xs text-zinc-400">
                      Jogue no celular sem precisar de internet ou servidor. Arquivo único e autocontido com analógico touch e áudio sintetizado.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs space-y-1 text-zinc-300">
                  <div className="font-semibold text-white">Como testar no seu celular:</div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px]">
                    <li>Baixe o arquivo clicando no botão abaixo ou acesse o link direto no celular.</li>
                    <li>Abra no Chrome ou Safari. Não precisa de internet após abrir!</li>
                    <li>Toque em "Adicionar à Tela Inicial" para jogar em tela cheia como se fosse um app nativo.</li>
                  </ol>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <a
                    href="/download/ChinaBall_Solo_Mobile.html"
                    download="ChinaBall_Solo_Mobile.html"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar ChinaBall_Solo_Mobile.html (35KB)</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyMobileLink}
                    className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-700"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link para Celular'}</span>
                  </button>

                  <a
                    href="/public/futzin_1v1_mobile.html"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
                  >
                    <span>Abrir Solo no Navegador ↗</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ABA 5: CONFIGURAÇÕES */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#12171f] border border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Controles & Analógico</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      Modo do Analógico Touch
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onHudChange({ ...hudConfig, joystickMode: 'fixed' })}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          hudConfig.joystickMode === 'fixed'
                            ? 'bg-zinc-800 border-amber-400 text-white'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        Fixo no Canto
                      </button>
                      <button
                        type="button"
                        onClick={() => onHudChange({ ...hudConfig, joystickMode: 'floating' })}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          hudConfig.joystickMode === 'floating'
                            ? 'bg-zinc-800 border-amber-400 text-white'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        Flutuante (Segue Dedo)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      Zoom da Câmera
                    </label>
                    <div className="flex gap-2">
                      {(['auto', 'wide', 'close'] as const).map((zoom) => (
                        <button
                          key={zoom}
                          type="button"
                          onClick={() => onHudChange({ ...hudConfig, cameraZoom: zoom })}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                            hudConfig.cameraZoom === zoom
                              ? 'bg-zinc-800 border-amber-400 text-white'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          {zoom === 'auto' ? 'Automático' : zoom === 'wide' ? 'Amplo' : 'Perto'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Opções de Desempenho & Leveza */}
              <div className="p-4 rounded-xl bg-[#12171f] border border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Desempenho & Efeitos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer">
                    <span className="text-xs text-zinc-300">Partículas e Grama</span>
                    <input
                      type="checkbox"
                      checked={hudConfig.showVisualEffects}
                      onChange={(e) => onHudChange({ ...hudConfig, showVisualEffects: e.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer">
                    <span className="text-xs text-zinc-300">Rastro da Bola</span>
                    <input
                      type="checkbox"
                      checked={hudConfig.showBallTrail}
                      onChange={(e) => onHudChange({ ...hudConfig, showBallTrail: e.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer">
                    <span className="text-xs text-zinc-300">Mira Laser do Chute</span>
                    <input
                      type="checkbox"
                      checked={hudConfig.showAimLaser}
                      onChange={(e) => onHudChange({ ...hudConfig, showAimLaser: e.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer">
                    <span className="text-xs text-zinc-300">Câmera Lenta no Gol</span>
                    <input
                      type="checkbox"
                      checked={hudConfig.enableSlowMo}
                      onChange={(e) => onHudChange({ ...hudConfig, enableSlowMo: e.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ABA 6: PERFIL DO JOGADOR */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#12171f] border border-zinc-800 space-y-4">
                <div className="flex items-center gap-4">
                  {/* Prévia do Disco do Jogador */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg shadow-lg border-2"
                    style={{
                      backgroundColor: profile.color,
                      borderColor: profile.accentColor,
                      color: profile.accentColor,
                    }}
                  >
                    {profile.number}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Nome de Jogador</label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => onProfileChange({ ...profile, name: e.target.value.slice(0, 14) })}
                        maxLength={14}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Número da Camisa</label>
                      <input
                        type="text"
                        value={profile.number}
                        onChange={(e) => onProfileChange({ ...profile, number: e.target.value.slice(0, 2) })}
                        maxLength={2}
                        className="w-20 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Cores */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-2">Uniforme do Jogador</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => onProfileChange({ ...profile, color: c.color, accentColor: c.accent })}
                        className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer ${
                          profile.color === c.color ? 'scale-110 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.color, borderColor: c.accent }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Rodapé Limpo */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-[#10151c] text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span>Pressione <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">M</kbd> ou <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">ESC</kbd> para abrir/fechar</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors cursor-pointer"
          >
            Voltar ao Jogo
          </button>
        </div>

      </div>
    </div>
  );
};
