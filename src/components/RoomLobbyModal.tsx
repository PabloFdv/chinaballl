import React, { useState } from 'react';
import {
  Users,
  Shield,
  Crown,
  Play,
  Share2,
  Check,
  RotateCcw,
  LogOut,
  ChevronRight,
  ChevronLeft,
  X,
  Scale,
  Wifi,
  AlertCircle,
  Shuffle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare,
} from 'lucide-react';
import { MapSize } from '../game/physicsConfig';
import { sounds } from '../audio/soundManager';

export interface LobbyPlayer {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'spec';
  isHost: boolean;
  isReferee: boolean;
  isReady?: boolean;
  ping: number;
  ip?: string;
}

interface RoomLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  mapSize: MapSize;
  teamSize: number;
  goalLimit: number;
  timeLimit: number;
  ping: number;
  players: LobbyPlayer[];
  myPlayerId: string;
  isHost: boolean;
  isReferee: boolean;
  onSwitchTeam: (team: 'red' | 'blue' | 'spec') => void;
  onMovePlayer?: (targetPlayerId: string, team: 'red' | 'blue' | 'spec') => void;
  onTransferReferee?: (targetPlayerId: string) => void;
  onToggleReady?: () => void;
  onShuffleTeams?: () => void;
  onSwapTeams?: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onSendMessage?: (text: string) => void;
  chatMessages?: { id: string; sender: string; text: string; time: string; team: string }[];
}

export const RoomLobbyModal: React.FC<RoomLobbyModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomName,
  mapSize,
  teamSize,
  goalLimit,
  timeLimit,
  ping,
  players,
  myPlayerId,
  isHost,
  isReferee,
  onSwitchTeam,
  onMovePlayer,
  onTransferReferee,
  onToggleReady,
  onShuffleTeams,
  onSwapTeams,
  onStartMatch,
  onLeaveRoom,
  onSendMessage,
  chatMessages = [],
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lobbyTab, setLobbyTab] = useState<'teams' | 'chat'>('teams');
  const [chatInput, setChatInput] = useState('');

  if (!isOpen) return null;

  const redPlayers = players.filter((p) => p.team === 'red');
  const bluePlayers = players.filter((p) => p.team === 'blue');
  const specPlayers = players.filter((p) => p.team === 'spec');

  const myPlayer = players.find((p) => p.id === myPlayerId || p.name === myPlayerId);
  const canStart = redPlayers.length >= 1 && bluePlayers.length >= 1;

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedLink(true);
      sounds.playKick();
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => {});
  };

  const handleAttemptStart = () => {
    if (!canStart) {
      setNotice('A partida só pode começar com pelo menos 1 jogador real em cada time! Convide amigos pelo link.');
      setTimeout(() => setNotice(null), 3500);
      return;
    }
    sounds.playGoal();
    onStartMatch();
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && onSendMessage) {
      onSendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[94vh] bg-[#0c1015] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* Cabeçalho da Sala com visual esportivo e botões táteis */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-[#10151c] gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-xl shadow-md">
              🏟️
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black tracking-tight text-white">{roomName}</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
                  {mapSize}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-400 border border-emerald-500/30 font-bold">
                  ⚖️ {ping || 18}ms
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Até {goalLimit} Gols • {timeLimit} Minutos • Servidor 100% Real (Sem Bots)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyInvite}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-700 active:scale-95 shadow-sm"
              title="Copiar Link de Convite da Sala"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
              <span className="hidden xs:inline">{copiedLink ? 'Link Copiado!' : 'Convidar'}</span>
            </button>

            <button
              type="button"
              onClick={onLeaveRoom}
              className="p-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-950/50 border border-transparent hover:border-rose-800 transition-all cursor-pointer active:scale-95"
              title="Sair da Sala"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificação Flutuante de Alerta */}
        {notice && (
          <div className="px-4 py-2 bg-amber-950/90 border-b border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 animate-in slide-in-from-top duration-150">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Barra de Ferramentas do Árbitro / Host */}
        <div className="px-4 sm:px-6 py-2 bg-[#0d1217] border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {/* Alternador de visualização para celular (Times vs Chat) */}
            <div className="flex sm:hidden p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => setLobbyTab('teams')}
                className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                  lobbyTab === 'teams' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
                }`}
              >
                Times
              </button>
              <button
                type="button"
                onClick={() => setLobbyTab('chat')}
                className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                  lobbyTab === 'chat' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
                }`}
              >
                Chat ({chatMessages.length})
              </button>
            </div>

            {/* Status Pronto do Jogador */}
            {onToggleReady && (
              <button
                type="button"
                onClick={() => {
                  sounds.playKick();
                  onToggleReady();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border active:scale-95 ${
                  myPlayer?.isReady
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white'
                }`}
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${myPlayer?.isReady ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span>{myPlayer?.isReady ? 'Estou Pronto!' : 'Marcar Pronto'}</span>
              </button>
            )}
          </div>

          {/* Ferramentas Exclusivas do Árbitro / Dono da Sala */}
          {isReferee && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {onShuffleTeams && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playKick();
                    onShuffleTeams();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-700 active:scale-95"
                  title="Distribuir jogadores aleatoriamente entre Vermelho e Azul"
                >
                  <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xs:inline">Sortear Times</span>
                </button>
              )}

              {onSwapTeams && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playKick();
                    onSwapTeams();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-700 active:scale-95"
                  title="Inverter os lados (Vermelho ⇄ Azul)"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden xs:inline">Inverter Lados</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* CORPO DO LOBBY: SELEÇÃO DE TIMES (OU CHAT NO MOBILE) */}
        {/* ===================================================================== */}
        <div className="p-3 sm:p-5 overflow-y-auto max-h-[62vh]">
          {lobbyTab === 'chat' ? (
            /* Mini Chat para Mobile dentro do Lobby */
            <div className="flex flex-col h-[340px] rounded-xl bg-[#0f141a] border border-zinc-800 p-3">
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-500">
                    Nenhuma mensagem ainda. Diga oi para os jogadores!
                  </div>
                ) : (
                  chatMessages.map((m) => (
                    <div key={m.id} className="text-xs break-words">
                      <span className="text-[10px] text-zinc-500 font-mono mr-1.5">{m.time}</span>
                      <span className={`font-bold mr-1.5 ${m.team === 'red' ? 'text-amber-400' : m.team === 'blue' ? 'text-blue-400' : 'text-zinc-400'}`}>
                        {m.sender}:
                      </span>
                      <span className="text-zinc-200">{m.text}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="mt-2 flex items-center gap-2 pt-2 border-t border-zinc-800">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Mensagem na sala..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none"
                />
                <button type="submit" className="p-2 rounded-lg bg-amber-500 text-zinc-950 font-bold">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            /* 3 Colunas dos Times (Responsivo) */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* 1. TIME VERMELHO (AMARELO) */}
              <div className="rounded-xl border border-amber-500/40 bg-[#14120e] p-3.5 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                        Time Vermelho ({redPlayers.length}/{teamSize})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 min-h-[140px]">
                    {redPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="font-semibold text-white truncate max-w-[100px]">{p.name}</span>
                          {p.isReferee && (
                            <span title="Árbitro da Sala">
                              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            </span>
                          )}
                          {p.isReady && (
                            <span title="Pronto!">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                          <span>{p.ping}ms</span>
                          {isReferee && p.id !== myPlayerId && (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playKick();
                                onMovePlayer?.(p.id, 'blue');
                              }}
                              className="p-1 hover:text-white"
                              title="Mover para Time Azul"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {Array.from({ length: Math.max(0, teamSize - redPlayers.length) }).map((_, idx) => (
                      <div
                        key={`empty-red-${idx}`}
                        className="px-2.5 py-2 rounded-lg border border-dashed border-zinc-800 text-[11px] text-zinc-600 flex items-center justify-center font-mono"
                      >
                        Vaga Aberta (Jogador Real)
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playKick();
                      onSwitchTeam('red');
                    }}
                    disabled={myPlayer?.team === 'red'}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
                      myPlayer?.team === 'red'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-default'
                        : 'bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-white'
                    }`}
                  >
                    {myPlayer?.team === 'red' ? '✓ Você está neste time' : 'Entrar no Time Vermelho'}
                  </button>
                </div>
              </div>

              {/* 2. ESPECTADORES / BANCO DE RESERVAS */}
              <div className="rounded-xl border border-zinc-800 bg-[#0f141a] p-3.5 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                        Espectadores ({specPlayers.length})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 min-h-[140px]">
                    {specPlayers.length === 0 ? (
                      <div className="text-center py-10 text-xs text-zinc-500">
                        Nenhum espectador na espera
                      </div>
                    ) : (
                      specPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-zinc-500" />
                            <span className="font-semibold text-zinc-300 truncate max-w-[100px]">{p.name}</span>
                            {p.isReferee && (
                              <span title="Árbitro da Sala">
                                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {isReferee && p.id !== myPlayerId && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    sounds.playKick();
                                    onMovePlayer?.(p.id, 'red');
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold hover:bg-amber-500/30"
                                  title="Mover para Vermelho"
                                >
                                  Vermelho
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    sounds.playKick();
                                    onMovePlayer?.(p.id, 'blue');
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold hover:bg-blue-500/30"
                                  title="Mover para Azul"
                                >
                                  Azul
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playKick();
                      onSwitchTeam('spec');
                    }}
                    disabled={myPlayer?.team === 'spec'}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
                      myPlayer?.team === 'spec'
                        ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-default'
                        : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {myPlayer?.team === 'spec' ? '✓ Você é espectador' : 'Ficar Espectador'}
                  </button>
                </div>
              </div>

              {/* 3. TIME AZUL */}
              <div className="rounded-xl border border-blue-500/40 bg-[#0e141a] p-3.5 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                      <span className="text-xs font-black text-blue-400 uppercase tracking-wider">
                        Time Azul ({bluePlayers.length}/{teamSize})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 min-h-[140px]">
                    {bluePlayers.map((p) => (
                      <div
                        key={p.id}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-semibold text-white truncate max-w-[100px]">{p.name}</span>
                          {p.isReferee && (
                            <span title="Árbitro da Sala">
                              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            </span>
                          )}
                          {p.isReady && (
                            <span title="Pronto!">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                          <span>{p.ping}ms</span>
                          {isReferee && p.id !== myPlayerId && (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playKick();
                                onMovePlayer?.(p.id, 'red');
                              }}
                              className="p-1 hover:text-white"
                              title="Mover para Time Vermelho"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {Array.from({ length: Math.max(0, teamSize - bluePlayers.length) }).map((_, idx) => (
                      <div
                        key={`empty-blue-${idx}`}
                        className="px-2.5 py-2 rounded-lg border border-dashed border-zinc-800 text-[11px] text-zinc-600 flex items-center justify-center font-mono"
                      >
                        Vaga Aberta (Jogador Real)
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playKick();
                      onSwitchTeam('blue');
                    }}
                    disabled={myPlayer?.team === 'blue'}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
                      myPlayer?.team === 'blue'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 cursor-default'
                        : 'bg-zinc-800 hover:bg-blue-500 hover:text-white text-white'
                    }`}
                  >
                    {myPlayer?.team === 'blue' ? '✓ Você está neste time' : 'Entrar no Time Azul'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Rodapé com Início de Jogo e Aviso */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-zinc-800 bg-[#10151c] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-tight">
              {isReferee
                ? 'Você é o Árbitro: inicie a partida quando os jogadores estiverem posicionados.'
                : 'Aguarde o Árbitro da sala autorizar o pontapé inicial.'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isReferee ? (
              <button
                type="button"
                onClick={handleAttemptStart}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                  canStart
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 ring-1 ring-emerald-400/40'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>INICIAR PARTIDA ONLINE</span>
              </button>
            ) : (
              <div className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
                Aguardando Apito Inicial...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
