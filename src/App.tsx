import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sounds } from './audio/soundManager';
import { SimpleJoystick } from './components/SimpleJoystick';
import { SimpleKickButton } from './components/SimpleKickButton';
import { HudSettingsModal, HudConfig, DEFAULT_HUD_CONFIG } from './components/HudSettingsModal';
import { GameMenuModal, RoomInfo } from './components/GameMenuModal';
import { RoomLobbyModal, LobbyPlayer } from './components/RoomLobbyModal';
import { InGameChat, ChatMessage } from './components/InGameChat';
import { PlayerProfile } from './game/types';
import { ChinaBallEngine } from './game/chinaEngine';
import { HAXBALL, MapSize, MAP_DIMENSIONS } from './game/physicsConfig';
import { PitchRenderer } from './game/pitchRenderer';
import { rankingManager } from './game/rankingManager';
import { ReplayBuffer } from './game/stateBuffer';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Users,
  Play,
  Pause,
  Menu,
  Scale,
  Sparkles,
  Wifi,
  Share2,
  Award,
  Crown,
  FastForward,
  Check,
  MessageSquare,
  LayoutGrid,
} from 'lucide-react';
import { toggleFullscreen, isFullscreenActive } from './utils/fullscreen';

const DEFAULT_PROFILE: PlayerProfile = {
  name: 'Pablo',
  number: '10',
  color: '#f59e0b',
  accentColor: '#ffffff',
  goals: 0,
  kicks: 0,
  matchesPlayed: 0,
  wins: 0,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ChinaBallEngine>(new ChinaBallEngine());
  const rendererRef = useRef<PitchRenderer | null>(null);
  const replayBufferRef = useRef<ReplayBuffer>(new ReplayBuffer(5.0, 60));

  // Input refs
  const inputVecRef = useRef({ x: 0, y: 0 });
  const kickStateRef = useRef(false);

  // HUD Config
  const [hudConfig, setHudConfig] = useState<HudConfig>(() => {
    try {
      const saved = localStorage.getItem('futzin_hud_config');
      return saved ? { ...DEFAULT_HUD_CONFIG, ...JSON.parse(saved) } : DEFAULT_HUD_CONFIG;
    } catch {
      return DEFAULT_HUD_CONFIG;
    }
  });
  const hudConfigRef = useRef(hudConfig);
  hudConfigRef.current = hudConfig;

  // Estado dos Modais (O jogo começa no menu para selecionar o modo)
  const [isHudModalOpen, setIsHudModalOpen] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(true);
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);
  const [menuInitialTab, setMenuInitialTab] = useState<'play' | 'rooms' | 'mobile' | 'settings' | 'profile' | 'ranking'>('play');
  const [isMatchPaused, setIsMatchPaused] = useState(false);

  // Orientação Mobile
  const [isLandscapeForced, setIsLandscapeForced] = useState(false);

  // Perfil do Jogador
  const [profile, setProfile] = useState<PlayerProfile>(() => {
    try {
      const saved = localStorage.getItem('chinaball_profile');
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const handleProfileChange = useCallback((newProfile: PlayerProfile) => {
    setProfile(newProfile);
    try {
      localStorage.setItem('chinaball_profile', JSON.stringify(newProfile));
    } catch {}
  }, []);

  // Sala & Modos
  const [activeRoomName, setActiveRoomName] = useState('Modo Solo');
  const [botMode, setBotMode] = useState<'solo' | 'easy' | 'medium' | 'hard'>('medium');
  const [teamSize, setTeamSize] = useState<1 | 2 | 3 | 4>(1);
  const [mapSize, setMapSize] = useState<MapSize>('1v1');
  const [goalLimit, setGoalLimit] = useState(5);
  const [timeLimit, setTimeLimit] = useState(5);

  // UI State
  const [fps, setFps] = useState(60);
  const [ping, setPing] = useState(18);
  const [balancedDelayMs, setBalancedDelayMs] = useState(0);
  const [scoreYellow, setScoreYellow] = useState(0);
  const [scoreBlue, setScoreBlue] = useState(0);
  const [matchSeconds, setMatchSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [keyboardVector, setKeyboardVector] = useState({ x: 0, y: 0 });
  const [keyboardKick, setKeyboardKick] = useState(false);

  // GOL FX & Instant Replay
  const [goalBanner, setGoalBanner] = useState<{
    active: boolean;
    team: 'red' | 'blue';
    message: string;
    scoreYellow: number;
    scoreBlue: number;
  } | null>(null);
  const [edgeGlow, setEdgeGlow] = useState<'red' | 'blue' | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);

  // Chat em Tempo Real
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Notificação no topo
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sessão Online Ativa & Lista de Jogadores do Lobby
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [onlineSession, setOnlineSession] = useState<{
    roomId: string;
    roomName: string;
    isHost: boolean;
    isReferee: boolean;
    refereeName?: string;
    isMatchStarted?: boolean;
    team: 'red' | 'blue' | 'spec';
    slot: number;
    playerCount: number;
    hostPing: number;
    balancedPing: number;
    bufferDelayMs: number;
    quality: string;
  } | null>(null);
  const onlineSessionRef = useRef(onlineSession);
  onlineSessionRef.current = onlineSession;

  const wsRef = useRef<WebSocket | null>(null);

  // Estatísticas da partida em andamento para ranking local
  const currentMatchShotsRef = useRef(0);
  const currentMatchGoalsRef = useRef(0);

  // Disparo do Efeito e Animação de Gol
  const triggerGoalFX = useCallback((team: 'red' | 'blue', message: string, sy: number, sb: number) => {
    setGoalBanner({
      active: true,
      team,
      message,
      scoreYellow: sy,
      scoreBlue: sb,
    });
    setEdgeGlow(team);

    // Incrementa estatística pessoal se foi o jogador
    const myTeam = engineRef.current.player.team;
    if (myTeam === team) {
      currentMatchGoalsRef.current += 1;
    }

    // Inicia Replay de 5 segundos em câmera lenta
    const started = replayBufferRef.current.triggerGoalReplay(team);
    if (started) {
      setIsReplaying(true);
    }

    setTimeout(() => {
      setGoalBanner(null);
    }, 2800);

    setTimeout(() => {
      setEdgeGlow(null);
    }, 3500);
  }, []);

  // Callback de fim de replay
  useEffect(() => {
    replayBufferRef.current.onReplayFinished = () => {
      setIsReplaying(false);
      engineRef.current.resetToKickoff();
    };
  }, []);

  // Vincula callback de gol do motor
  useEffect(() => {
    engineRef.current.onGoalScored = (team, message, sy, sb) => {
      triggerGoalFX(team, message, sy, sb);

      // Notifica o servidor se for partida online e o jogador for o host
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && onlineSessionRef.current?.isHost) {
        wsRef.current.send(
          JSON.stringify({
            type: 'sync_goal',
            scorerTeam: team,
            message,
            scoreYellow: sy,
            scoreBlue: sb,
          })
        );
      }
    };
  }, [triggerGoalFX]);

  // Finalização e Gravação de Ranking ao concluir partida (O ELO só valida contra humanos!)
  const finalizeMatchRanking = useCallback((finalYellow: number, finalBlue: number) => {
    if (finalYellow === 0 && finalBlue === 0 && matchSeconds < 15) return;

    const myTeam = engineRef.current.player.team === 'blue' ? 'blue' : 'red';
    let result: 'win' | 'loss' | 'draw' = 'draw';
    if (finalYellow > finalBlue) {
      result = myTeam === 'red' ? 'win' : 'loss';
    } else if (finalBlue > finalYellow) {
      result = myTeam === 'blue' ? 'win' : 'loss';
    }

    // Só é ranked se for partida online com adversários reais conectados!
    const isRankedOnline = Boolean(
      onlineSessionRef.current &&
      onlineSessionRef.current.playerCount >= 2 &&
      engineRef.current.isOnlineRoom
    );

    rankingManager.recordMatch({
      mode: activeRoomName,
      mapSize,
      team: myTeam,
      scoreYellow: finalYellow,
      scoreBlue: finalBlue,
      result,
      playerGoals: currentMatchGoalsRef.current,
      playerShots: currentMatchShotsRef.current,
      durationSeconds: matchSeconds,
      isRankedOnline,
    });

    currentMatchShotsRef.current = 0;
    currentMatchGoalsRef.current = 0;
  }, [activeRoomName, mapSize, matchSeconds]);

  // Selecionar Formato de Partida (Offline / Treino)
  const handleSelectMatchFormat = useCallback((newTeamSize: 1 | 2 | 3 | 4, newMapSize: MapSize) => {
    finalizeMatchRanking(scoreYellow, scoreBlue);
    setTeamSize(newTeamSize);
    setMapSize(newMapSize);
    const engine = engineRef.current;
    engine.isOnlineRoom = false;
    engine.setMatchFormat(newTeamSize, newMapSize, botMode === 'solo');
    setScoreYellow(0);
    setScoreBlue(0);
    setMatchSeconds(0);
    replayBufferRef.current.clear();
  }, [botMode, finalizeMatchRanking, scoreYellow, scoreBlue]);

  // Selecionar Modo do Bot (Offline)
  const handleSelectBotMode = useCallback((mode: 'solo' | 'easy' | 'medium' | 'hard') => {
    finalizeMatchRanking(scoreYellow, scoreBlue);
    setBotMode(mode);
    const engine = engineRef.current;
    engine.isOnlineRoom = false;
    if (mode === 'solo') {
      engine.setMatchFormat(1, mapSize, true);
      setScoreYellow(0);
      setScoreBlue(0);
      setMatchSeconds(0);
    } else {
      engine.setMatchFormat(teamSize, mapSize, false);
      engine.botActive = true;
      engine.botDifficulty = mode;
      engine.resetToKickoff();
      setScoreYellow(0);
      setScoreBlue(0);
      setMatchSeconds(0);
    }
    replayBufferRef.current.clear();
  }, [teamSize, mapSize, finalizeMatchRanking, scoreYellow, scoreBlue]);

  // Trocar de Time pelo jogador
  const handleSwitchTeam = useCallback((nextTeam: 'red' | 'blue' | 'spec') => {
    const engine = engineRef.current;
    if (nextTeam !== 'spec') {
      engine.player.team = nextTeam;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && onlineSessionRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'switch_team',
          team: nextTeam,
        })
      );
      setOnlineSession((prev) => (prev ? { ...prev, team: nextTeam } : null));
      setLobbyPlayers((prev) =>
        prev.map((p) => (p.name === profileRef.current.name ? { ...p, team: nextTeam } : p))
      );
    }
  }, []);

  // Mover outro jogador (Função do Árbitro / Host)
  const handleMovePlayer = useCallback((targetPlayerId: string, targetTeam: 'red' | 'blue' | 'spec') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'move_player',
          targetPlayerId,
          team: targetTeam,
        })
      );
    }
  }, []);

  // Transferir cargo de Árbitro
  const handleTransferReferee = useCallback((targetPlayerId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'transfer_referee',
          targetPlayerId,
        })
      );
    }
  }, []);

  // Iniciar partida a partir do Lobby (Árbitro)
  const handleStartMatchFromLobby = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start_online_match' }));
    }
  }, []);

  const handleToggleReady = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'toggle_ready' }));
    }
  }, []);

  const handleShuffleTeams = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'shuffle_teams' }));
    }
  }, []);

  const handleSwapTeams = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'swap_teams' }));
    }
  }, []);

  // Sair da Sala Online
  const handleLeaveRoom = useCallback(() => {
    finalizeMatchRanking(scoreYellow, scoreBlue);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_room' }));
      wsRef.current.close();
    }
    setOnlineSession(null);
    setIsLobbyModalOpen(false);
    setActiveRoomName('Modo Solo');
    setBotMode('solo');
    const engine = engineRef.current;
    engine.isOnlineRoom = false;
    engine.setMatchFormat(1, '1v1', true);
    setScoreYellow(0);
    setScoreBlue(0);
    setMatchSeconds(0);
    setIsGameMenuOpen(true);
  }, [finalizeMatchRanking, scoreYellow, scoreBlue]);

  // Enviar Mensagem no Chat
  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && onlineSessionRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          text: text.trim(),
        })
      );
    } else {
      // Chat local em modo treino
      setChatMessages((prev) => [
        ...prev.slice(-30),
        {
          id: `local_${Date.now()}`,
          sender: profileRef.current.name,
          team: engineRef.current.player.team,
          text: text.trim(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
        },
      ]);
    }
  }, []);

  // Entrar em Sala Online com Ping Balanceado & Abrir Lobby de Seleção
  const handleJoinRoom = useCallback((room: RoomInfo, preferredTeam: 'red' | 'blue' | 'spec' = 'red') => {
    finalizeMatchRanking(scoreYellow, scoreBlue);
    setActiveRoomName(room.name);
    setScoreYellow(0);
    setScoreBlue(0);
    setMatchSeconds(0);
    setGoalLimit(room.goalLimit || 5);
    setTimeLimit(room.timeLimit || 5);

    const targetTeamSize = (room.teamSize || (room.mapSize === '4v4' ? 4 : room.mapSize === '3v3' ? 3 : room.mapSize === '2v2' ? 2 : 1)) as 1 | 2 | 3 | 4;
    const targetMapSize = room.mapSize || '1v1';
    setTeamSize(targetTeamSize);
    setMapSize(targetMapSize);

    const engine = engineRef.current;
    engine.setMatchFormat(targetTeamSize, targetMapSize, false);
    engine.isOnlineRoom = true;
    engine.botActive = false;
    replayBufferRef.current.clear();

    try {
      if (wsRef.current) {
        wsRef.current.close();
      }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: 'join_room',
            roomId: room.id,
            name: profileRef.current.name,
            preferredTeam,
            ping: 18,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'server_pong') {
            const rtt = Math.max(1, Date.now() - data.clientTime);
            setPing(rtt);
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'report_ping', ping: rtt }));
            }
          }

          if (data.type === 'room_notice') {
            setMatchNotice(data.message);
            setTimeout(() => setMatchNotice(null), 3500);
          }

          if (data.type === 'ping_balance_sync') {
            setPing(data.balancedPing || data.hostPing);
            setBalancedDelayMs(data.bufferDelayMs || 0);
            setOnlineSession((prev) => (prev ? {
              ...prev,
              hostPing: data.hostPing,
              balancedPing: data.balancedPing,
              bufferDelayMs: data.bufferDelayMs,
              quality: data.quality,
            } : null));
          }

          // Entrou na sala: abre o Lobby de Seleção de Times
          if (data.type === 'room_joined') {
            const sess = {
              roomId: data.roomId,
              roomName: data.roomName,
              isHost: data.player.isHost,
              isReferee: data.player.isReferee,
              refereeName: data.player.isReferee ? data.player.name : undefined,
              isMatchStarted: data.isMatchStarted,
              team: data.player.team,
              slot: data.player.slot || 0,
              playerCount: data.players?.length || 1,
              hostPing: data.hostPing || 18,
              balancedPing: data.balancedPing || 18,
              bufferDelayMs: data.bufferDelayMs || 0,
              quality: data.pingQuality || 'Excelente',
            };
            setOnlineSession(sess);
            setLobbyPlayers(data.players || []);
            setIsGameMenuOpen(false);

            // Se a partida ainda não foi iniciada, abre a tela de seleção de times (Lobby)
            if (!data.isMatchStarted) {
              setIsLobbyModalOpen(true);
            }
          }

          // Novo jogador real entrou na sala
          if (data.type === 'player_joined') {
            setOnlineSession((prev) => (prev ? {
              ...prev,
              playerCount: prev.playerCount + 1,
              balancedPing: data.balancedPing || prev.balancedPing,
              bufferDelayMs: data.bufferDelayMs || prev.bufferDelayMs,
            } : null));

            setLobbyPlayers((prev) => {
              const exists = prev.some((p) => p.id === data.player.id);
              if (exists) return prev;
              return [...prev, data.player];
            });

            setMatchNotice(`Jogador real entrou: ${data.player.name}`);
            setChatMessages((prev) => [
              ...prev.slice(-30),
              {
                id: `sys_${Date.now()}`,
                sender: 'SISTEMA',
                team: 'system',
                text: `${data.player.name} entrou na sala.`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: Date.now(),
              },
            ]);
            setTimeout(() => setMatchNotice(null), 3000);
          }

          if (data.type === 'player_left') {
            setOnlineSession((prev) => (prev ? { ...prev, playerCount: Math.max(1, prev.playerCount - 1) } : null));
            setLobbyPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
          }

          if (data.type === 'host_transferred') {
            setOnlineSession((prev) => (prev ? { ...prev, isHost: true, isReferee: true, refereeName: data.hostName } : null));
            setMatchNotice(data.message || 'Você é o jogador mais antigo e assumiu a liderança e arbitragem da sala!');
            setLobbyPlayers((prev) =>
              prev.map((p) => (p.id === data.hostId ? { ...p, isHost: true, isReferee: true } : p))
            );
            setTimeout(() => setMatchNotice(null), 3500);
          }

          if (data.type === 'referee_transferred') {
            setOnlineSession((prev) => (prev ? {
              ...prev,
              isReferee: data.refereeId === profileRef.current.name,
              refereeName: data.refereeName,
            } : null));
            setLobbyPlayers((prev) =>
              prev.map((p) => ({ ...p, isReferee: p.id === data.refereeId }))
            );
            setMatchNotice(data.message);
            setTimeout(() => setMatchNotice(null), 3000);
          }

          // Atualização de time de jogador
          if (data.type === 'team_switched' || data.type === 'player_team_updated') {
            setLobbyPlayers((prev) =>
              prev.map((p) => (p.id === data.playerId ? { ...p, team: data.team } : p))
            );
            const peer = engine.players.find((p) => p.id === data.playerId);
            if (peer) {
              peer.team = data.team;
            }
          }

          if (data.type === 'player_ready_updated') {
            setLobbyPlayers((prev) =>
              prev.map((p) => (p.id === data.playerId ? { ...p, isReady: data.isReady } : p))
            );
          }

          if (data.type === 'teams_swapped') {
            setLobbyPlayers(data.players || []);
            setMatchNotice(data.message);
            sounds.playKick();
            setTimeout(() => setMatchNotice(null), 3000);
          }

          if (data.type === 'teams_shuffled') {
            setLobbyPlayers(data.players || []);
            setMatchNotice(data.message);
            sounds.playKick();
            setTimeout(() => setMatchNotice(null), 3000);
          }

          // Árbitro iniciou a partida online com jogadores reais
          if (data.type === 'match_started_by_referee') {
            setOnlineSession((prev) => (prev ? { ...prev, isMatchStarted: true } : null));
            setIsLobbyModalOpen(false);
            setScoreYellow(0);
            setScoreBlue(0);
            setMatchSeconds(0);

            // Monta o campo EXCLUSIVAMENTE com os jogadores reais conectados
            setLobbyPlayers((currentPlayers) => {
              const activeCombatants = currentPlayers
                .filter((p) => p.team === 'red' || p.team === 'blue')
                .map((p) => ({
                  id: p.id,
                  name: p.name,
                  team: p.team as 'red' | 'blue',
                  isMe: p.name === profileRef.current.name,
                }));

              engine.setupRealOnlinePlayers(activeCombatants);
              engine.resetToKickoff();
              return currentPlayers;
            });

            setMatchNotice(`Partida iniciada pelo árbitro!`);
            sounds.playKick();
            setTimeout(() => setMatchNotice(null), 2500);
          }

          // Mensagens de Chat em Tempo Real
          if (data.type === 'chat') {
            setChatMessages((prev) => [
              ...prev.slice(-30),
              {
                id: data.id || `chat_${Date.now()}`,
                sender: data.sender,
                team: data.team,
                text: data.text,
                time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: data.timestamp || Date.now(),
              },
            ]);
          }

          // Sincronização de Jogador Online
          if (data.type === 'peer_player_sync') {
            const peer = engine.players.find((p) => p.id === data.playerId);
            if (peer) {
              peer.x = data.x;
              peer.y = data.y;
              peer.vx = data.vx;
              peer.vy = data.vy;
              peer.isKicking = data.isKicking;
              if (data.isKicking) {
                engine.executeKick(peer, 0, 0, 1.0);
              }
            }
          }

          // Sincronização de Bola Online
          if (data.type === 'peer_ball_sync') {
            engine.ball.x = data.x;
            engine.ball.y = data.y;
            engine.ball.vx = data.vx;
            engine.ball.vy = data.vy;
            if (data.angle !== undefined) engine.ballAngle = data.angle;
            if (typeof data.scoreYellow === 'number') setScoreYellow(data.scoreYellow);
            if (typeof data.scoreBlue === 'number') setScoreBlue(data.scoreBlue);
          }

          // Gol recebido online: ativa replay dos últimos 5 segundos e banner flutuante
          if (data.type === 'peer_goal') {
            if (typeof data.scoreYellow === 'number') setScoreYellow(data.scoreYellow);
            if (typeof data.scoreBlue === 'number') setScoreBlue(data.scoreBlue);
            triggerGoalFX(data.scorerTeam || 'red', data.message || 'GOOOOL!', data.scoreYellow || 0, data.scoreBlue || 0);
          }

          if (data.type === 'peer_reset') {
            engine.resetToKickoff();
          }
        } catch {}
      };
    } catch {}
  }, [finalizeMatchRanking, scoreYellow, scoreBlue, triggerGoalFX]);

  // Criação de sala pelo dono: conecta na sala e abre o Lobby de Seleção
  const handleCreateRoom = useCallback((
    name: string,
    newMapSize: MapSize,
    newTeamSize: 1 | 2 | 3 | 4,
    limit: number,
    time: number,
    ownerTeam: 'red' | 'blue' | 'spec'
  ) => {
    setActiveRoomName(name);
    setTeamSize(newTeamSize);
    setMapSize(newMapSize);
    setGoalLimit(limit);
    setTimeLimit(time);

    // Conecta na sala recém criada
    handleJoinRoom({
      id: `sala-${Date.now()}`,
      name,
      mapSize: newMapSize,
      teamSize: newTeamSize,
      mode: `${newTeamSize}v${newTeamSize}`,
      players: 1,
      maxPlayers: newTeamSize * 2,
      goalLimit: limit,
      timeLimit: time,
      ping: 18,
      region: 'BR',
    }, ownerTeam);
  }, [handleJoinRoom]);

  // Detecção de link direto com `?room=XYZ` no carregamento da página
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoomId = params.get('room');
      if (urlRoomId) {
        handleJoinRoom({
          id: urlRoomId,
          name: `Sala ${urlRoomId}`,
          mapSize: '1v1',
          mode: '1v1',
          players: 1,
          maxPlayers: 2,
          goalLimit: 5,
          timeLimit: 5,
          ping: 18,
          region: 'BR',
        }, 'red');
      }
    } catch {}
  }, [handleJoinRoom]);

  // Copiar link de convite
  const handleCopyInviteLink = () => {
    if (!onlineSession) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(onlineSession.roomId)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => {});
  };

  // Heartbeat de Ping
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'client_ping', t: Date.now() }));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Relógio da partida
  useEffect(() => {
    if (isMatchPaused || isGameMenuOpen || isReplaying || isLobbyModalOpen) return;
    const timer = setInterval(() => {
      setMatchSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isMatchPaused, isGameMenuOpen, isReplaying, isLobbyModalOpen]);

  // Controles
  const handleJoystickMove = useCallback((x: number, y: number) => {
    inputVecRef.current = { x, y };
  }, []);

  const handleKickChange = useCallback((isKicking: boolean) => {
    kickStateRef.current = isKicking;
    if (isKicking) {
      currentMatchShotsRef.current += 1;
      setProfile((prev) => {
        const next = { ...prev, kicks: prev.kicks + 1 };
        try {
          localStorage.setItem('chinaball_profile', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, []);

  // Loop Principal de Física e Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    rendererRef.current = new PitchRenderer(ctx);
    const engine = engineRef.current;
    const replay = replayBufferRef.current;

    let lastTime = performance.now();
    let accumulator = 0;
    const TICK_TIME = 1000 / 60;
    let frameCount = 0;
    let animId: number;

    const loop = (now: number) => {
      let delta = now - lastTime;
      lastTime = now;
      if (delta > 100) delta = 100;

      // Se o Replay dos últimos 5 segundos estiver ativo, reproduz o buffer
      if (replay.active) {
        replay.update(engine);
        setReplayProgress(replay.progress);
      } else if (!isMatchPaused && !isGameMenuOpen && !isLobbyModalOpen) {
        accumulator += delta;
        let steps = 0;
        while (accumulator >= TICK_TIME) {
          engine.tick(inputVecRef.current.x, inputVecRef.current.y, kickStateRef.current, 1 / 60);
          replay.record(engine);
          accumulator -= TICK_TIME;
          steps++;
          if (steps > 5) {
            accumulator = 0;
            break;
          }
        }
      }

      // Sincronização Multiplayer (~30Hz)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && onlineSessionRef.current) {
        if (frameCount % 2 === 0) {
          const sess = onlineSessionRef.current;
          wsRef.current.send(
            JSON.stringify({
              type: 'sync_player',
              x: engine.player.x,
              y: engine.player.y,
              vx: engine.player.vx,
              vy: engine.player.vy,
              isKicking: kickStateRef.current,
            })
          );

          if (sess.isHost && !replay.active) {
            wsRef.current.send(
              JSON.stringify({
                type: 'sync_ball',
                x: engine.ball.x,
                y: engine.ball.y,
                vx: engine.ball.vx,
                vy: engine.ball.vy,
                angle: engine.ballAngle,
                scoreYellow: engine.scoreYellow,
                scoreBlue: engine.scoreBlue,
              })
            );
          }
        }
      }

      // Render em Alta Resolução (Retina HD)
      if (canvas.width > 0 && canvas.height > 0) {
        const alpha = accumulator / TICK_TIME;
        rendererRef.current?.render(
          engine,
          canvas.width,
          canvas.height,
          alpha,
          hudConfigRef.current,
          profileRef.current,
          inputVecRef.current.x,
          inputVecRef.current.y
        );
      }

      // Sincroniza placar local
      if (engine.scoreYellow !== scoreYellow) setScoreYellow(engine.scoreYellow);
      if (engine.scoreBlue !== scoreBlue) setScoreBlue(engine.scoreBlue);

      frameCount++;
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isMatchPaused, isGameMenuOpen, isLobbyModalOpen, scoreYellow, scoreBlue]);

  // Resize do Canvas com Suporte a Tela Retina
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Teclado (Ignora comandos de movimento se estiver digitando no Chat!)
  useEffect(() => {
    const keysDown = new Set<string>();

    const updateKeyboard = () => {
      if (isChatOpen) {
        inputVecRef.current = { x: 0, y: 0 };
        setKeyboardVector({ x: 0, y: 0 });
        kickStateRef.current = false;
        setKeyboardKick(false);
        return;
      }

      let kx = 0;
      let ky = 0;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) kx -= 1;
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) kx += 1;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) ky -= 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) ky += 1;

      const len = Math.hypot(kx, ky);
      if (len > 0) {
        inputVecRef.current = { x: kx / len, y: ky / len };
        setKeyboardVector({ x: kx / len, y: ky / len });
      } else {
        inputVecRef.current = { x: 0, y: 0 };
        setKeyboardVector({ x: 0, y: 0 });
      }

      const isKicking = keysDown.has('Space') || keysDown.has('KeyX') || keysDown.has('KeyK');
      kickStateRef.current = isKicking;
      setKeyboardKick(isKicking);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Se estiver digitando no chat, não intercepta teclas de jogo
      if (isChatOpen) return;

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'KeyR' && !e.repeat && botMode === 'solo' && !onlineSessionRef.current) {
        engineRef.current.resetBallToPlayer();
      }
      if ((e.code === 'KeyM' || e.code === 'Escape') && !e.repeat) {
        setIsGameMenuOpen((prev) => !prev);
      }
      if (e.code === 'KeyP' && !e.repeat) {
        setIsMatchPaused((prev) => !prev);
      }
      if (!keysDown.has(e.code)) {
        keysDown.add(e.code);
        updateKeyboard();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keysDown.has(e.code)) {
        keysDown.delete(e.code);
        updateKeyboard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [botMode, isChatOpen]);

  const formatClock = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-[#0a160e] text-slate-100 select-none touch-none transition-shadow duration-300 ${
        edgeGlow === 'red'
          ? 'shadow-[inset_0_0_120px_rgba(245,158,11,0.65)] ring-4 ring-amber-400/80 animate-pulse'
          : edgeGlow === 'blue'
          ? 'shadow-[inset_0_0_120px_rgba(37,99,235,0.7)] ring-4 ring-blue-500/80 animate-pulse'
          : ''
      }`}
    >
      {/* Canvas do Jogo */}
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair touch-none" />

      {/* ===================================================================== */}
      {/* ANIMAÇÃO DE GOOOOL FLUTUANTE NO CENTRO DA TELA */}
      {/* ===================================================================== */}
      {goalBanner && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center animate-in zoom-in-75 duration-200">
          <div className="text-center px-8 py-5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 shadow-2xl space-y-2 transform -translate-y-6">
            <div
              className={`text-5xl sm:text-7xl font-black italic tracking-tighter uppercase drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] animate-bounce ${
                goalBanner.team === 'red'
                  ? 'text-amber-400 drop-shadow-[0_0_35px_rgba(245,158,11,0.8)]'
                  : 'text-blue-400 drop-shadow-[0_0_35px_rgba(59,130,246,0.8)]'
              }`}
            >
              GOOOOL!
            </div>
            <div className="text-sm sm:text-base font-bold text-white tracking-wide">
              {goalBanner.message}
            </div>
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700 font-mono text-lg font-black text-white">
              <span className="text-amber-400">{goalBanner.scoreYellow}</span>
              <span className="text-zinc-500">:</span>
              <span className="text-blue-400">{goalBanner.scoreBlue}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* REPLAY DOS ÚLTIMOS 5 SEGUNDOS (CÂMERA LENTA) */}
      {/* ===================================================================== */}
      {isReplaying && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-35 pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-rose-500/50 shadow-2xl animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-black tracking-wider uppercase text-rose-300">
              🔴 Replay do Gol (0.4x)
            </span>
          </div>

          <div className="w-24 sm:w-36 h-2 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
            <div
              className="h-full bg-rose-500 transition-all duration-75"
              style={{ width: `${Math.round(replayProgress * 100)}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => replayBufferRef.current.stop()}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-zinc-600 active:scale-95"
            title="Pular Replay e ir para o reinício"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Pular</span>
          </button>
        </div>
      )}

      {/* Toast de Notificação */}
      {matchNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-35 pointer-events-auto px-4 py-1.5 rounded-lg bg-zinc-900/90 border border-amber-500/40 text-amber-300 text-xs font-semibold backdrop-blur-md shadow-xl animate-in slide-in-from-top duration-150">
          {matchNotice}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CHAT EM TEMPO REAL (CANTO INFERIOR ESQUERDO, FADE 5S, INPUT COM ENTER) */}
      {/* ===================================================================== */}
      <InGameChat
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        myTeam={onlineSession?.team || 'red'}
      />

      {/* ===================================================================== */}
      {/* BARRA SUPERIOR LIMPA, PROFISSIONAL & CONTROLES */}
      {/* ===================================================================== */}
      <div className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        
        {/* Esquerda: Placar & Relógio Limpo */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center bg-[#0d1218]/90 border border-zinc-800 backdrop-blur-md rounded-lg shadow-xl overflow-hidden px-2.5 py-1.5 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" />
              <span className="font-mono text-sm font-black text-white">{scoreYellow}</span>
            </div>

            <span className="text-zinc-600 font-bold">:</span>

            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-black text-white">{scoreBlue}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
            </div>

            <span className="text-zinc-700">|</span>

            <span className="font-mono text-xs font-semibold text-zinc-400">
              {formatClock(matchSeconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setMenuInitialTab('play');
              setIsGameMenuOpen(true);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#0d1218]/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition-colors cursor-pointer shadow-lg flex items-center gap-1.5"
            title="Menu do Jogo (M)"
          >
            <Menu className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Menu</span>
          </button>

          {/* Botão de Retornar ao Lobby da Sala Online */}
          {onlineSession && (
            <button
              type="button"
              onClick={() => setIsLobbyModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-amber-400 transition-colors cursor-pointer shadow-lg flex items-center gap-1.5"
              title="Abrir Seleção de Times da Sala"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Times</span>
            </button>
          )}
        </div>

        {/* Centro: Indicador de Ping Balanceado ou Dono/Árbitro */}
        <div className="hidden md:flex items-center gap-2 pointer-events-auto">
          {onlineSession ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d1218]/90 border border-emerald-500/40 text-xs font-mono text-emerald-400 backdrop-blur-md shadow-lg">
              <Scale className="w-3.5 h-3.5 text-cyan-400" />
              <span>⚖️ Ping: <strong>{ping}ms</strong></span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-300">{onlineSession.roomName}</span>

              {onlineSession.isReferee && (
                <>
                  <span className="text-zinc-500">•</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" />
                    <span>Árbitro</span>
                  </span>
                </>
              )}
            </div>
          ) : botMode === 'solo' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d1218]/90 border border-amber-500/40 text-xs font-mono text-amber-300 backdrop-blur-md shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Treino Solo (Chamar Bola: R)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d1218]/90 border border-zinc-700/60 text-xs font-mono text-zinc-300 backdrop-blur-md shadow-lg">
              <span>Duelo vs Bot ({botMode})</span>
            </div>
          )}
        </div>

        {/* Direita: Controles Rápidos da Partida */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          
          {/* Botão de Convidar Amigos via Link (Quando Online) */}
          {onlineSession && (
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d1218]/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition-all cursor-pointer shadow-lg active:scale-95"
              title="Copiar Link da Sala para Amigos"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
              <span className="hidden sm:inline">{copiedLink ? 'Copiado!' : 'Link'}</span>
            </button>
          )}

          {/* Trocar Time (Amarelo / Azul) */}
          {!onlineSession && (
            <button
              type="button"
              onClick={() => handleSwitchTeam(engineRef.current.player.team === 'red' ? 'blue' : 'red')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d1218]/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-white transition-all cursor-pointer shadow-lg active:scale-95"
              title="Alternar entre Time Amarelo e Time Azul"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Time</span>
            </button>
          )}

          {/* Pausar / Retomar */}
          <button
            type="button"
            onClick={() => setIsMatchPaused((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95 ${
              isMatchPaused
                ? 'bg-amber-500 border-amber-400 text-zinc-950 font-black ring-2 ring-amber-400/50'
                : 'bg-[#0d1218]/90 hover:bg-zinc-800 border-zinc-800 text-white'
            }`}
            title="Pausar / Retomar Partida (P)"
          >
            {isMatchPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{isMatchPaused ? 'Retomar' : 'Pausar'}</span>
          </button>

          {/* Configurações */}
          <button
            type="button"
            onClick={() => setIsHudModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d1218]/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition-all cursor-pointer shadow-lg active:scale-95"
            title="Abrir Configurações do Jogo"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden xs:inline">Config</span>
          </button>
        </div>

      </div>

      {/* Botão de Chamar Bola SOMENTE em Treino Solo */}
      {botMode === 'solo' && !onlineSession && (
        <div className="fixed bottom-3 left-3 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => engineRef.current.resetBallToPlayer()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d1218]/90 hover:bg-black border border-amber-500/40 text-amber-300 text-xs font-bold shadow-xl backdrop-blur-md cursor-pointer active:scale-95 transition-all"
            title="Trazer bola aos pés do jogador (Tecla R)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Chamar Bola (R)</span>
          </button>
        </div>
      )}

      {/* OVERLAY DE PAUSA */}
      {isMatchPaused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[#0c1015] border border-zinc-800 shadow-2xl text-center space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wide uppercase">Partida Pausada</h3>
            <p className="text-xs text-zinc-400">
              O jogo está congelado. Escolha uma ação para continuar.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setIsMatchPaused(false)}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Continuar Jogando
              </button>

              <button
                type="button"
                onClick={() => {
                  finalizeMatchRanking(scoreYellow, scoreBlue);
                  engineRef.current.resetMatch();
                  setScoreYellow(0);
                  setScoreBlue(0);
                  setMatchSeconds(0);
                  setIsMatchPaused(false);
                  replayBufferRef.current.clear();
                }}
                className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Reiniciar Partida
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMatchPaused(false);
                  setIsGameMenuOpen(true);
                }}
                className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Menu Principal / Ranking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CAMADA DE CONTROLES: ANALÓGICO VIRTUAL E BOTÃO DE CHUTE */}
      {/* ===================================================================== */}
      <div
        className="fixed z-30 pointer-events-auto touch-none select-none transition-all"
        style={{
          bottom: `${hudConfig.joystickOffsetY || 24}px`,
          [hudConfig.layout === 'inverted' ? 'right' : 'left']: `${hudConfig.joystickOffsetX || 24}px`,
        }}
      >
        <SimpleJoystick
          onMove={handleJoystickMove}
          keyboardVector={keyboardVector}
          size={hudConfig.joystickSize}
          opacity={hudConfig.opacity}
          mode={hudConfig.joystickMode}
          isFixed={hudConfig.joystickMode === 'fixed'}
          vibrationEnabled={hudConfig.vibration}
        />
      </div>

      <div
        className="fixed z-30 pointer-events-auto touch-none select-none transition-all"
        style={{
          bottom: `${hudConfig.kickOffsetY || 24}px`,
          [hudConfig.layout === 'inverted' ? 'left' : 'right']: `${hudConfig.kickOffsetX || 24}px`,
        }}
      >
        <SimpleKickButton
          onKickChange={handleKickChange}
          keyboardActive={keyboardKick}
          size={hudConfig.kickSize}
          opacity={hudConfig.opacity}
          color={hudConfig.kickColor}
          vibrationEnabled={hudConfig.vibration}
        />
      </div>

      {/* ===================================================================== */}
      {/* MODAL DO LOBBY DA SALA ONLINE: SELEÇÃO DE TIMES & ÁRBITRO */}
      {/* ===================================================================== */}
      {onlineSession && (
        <RoomLobbyModal
          isOpen={isLobbyModalOpen}
          onClose={() => setIsLobbyModalOpen(false)}
          roomId={onlineSession.roomId}
          roomName={onlineSession.roomName}
          mapSize={mapSize}
          teamSize={teamSize}
          goalLimit={goalLimit}
          timeLimit={timeLimit}
          ping={ping}
          players={lobbyPlayers}
          myPlayerId={profile.name}
          isHost={onlineSession.isHost}
          isReferee={onlineSession.isReferee}
          onSwitchTeam={handleSwitchTeam}
          onMovePlayer={handleMovePlayer}
          onTransferReferee={handleTransferReferee}
          onToggleReady={handleToggleReady}
          onShuffleTeams={handleShuffleTeams}
          onSwapTeams={handleSwapTeams}
          onStartMatch={handleStartMatchFromLobby}
          onLeaveRoom={handleLeaveRoom}
          onSendMessage={handleSendMessage}
          chatMessages={chatMessages}
        />
      )}

      {/* Modais do Jogo */}
      <GameMenuModal
        isOpen={isGameMenuOpen}
        onClose={() => setIsGameMenuOpen(false)}
        initialTab={menuInitialTab}
        botMode={botMode}
        onSelectBotMode={handleSelectBotMode}
        teamSize={teamSize}
        mapSize={mapSize}
        onSelectMatchFormat={handleSelectMatchFormat}
        hudConfig={hudConfig}
        onHudChange={(cfg) => {
          setHudConfig(cfg);
          try {
            localStorage.setItem('futzin_hud_config', JSON.stringify(cfg));
          } catch {}
        }}
        profile={profile}
        onProfileChange={handleProfileChange}
        activeRoomName={activeRoomName}
        onJoinRoom={handleJoinRoom}
        onCreateRoom={handleCreateRoom}
        onToggleOrientation={() => setIsLandscapeForced((prev) => !prev)}
        isLandscapeForced={isLandscapeForced}
      />

      <HudSettingsModal
        isOpen={isHudModalOpen}
        onClose={() => setIsHudModalOpen(false)}
        config={hudConfig}
        onChange={(cfg) => {
          setHudConfig(cfg);
          try {
            localStorage.setItem('futzin_hud_config', JSON.stringify(cfg));
          } catch {}
        }}
      />
    </div>
  );
}
