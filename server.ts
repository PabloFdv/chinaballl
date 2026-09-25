import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

const app = express();
app.use(express.json());

interface RoomPlayer {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'spec';
  slot: number;
  isHost: boolean;
  isReferee: boolean;
  isReady?: boolean;
  joinedAt: number;
  ping: number;
  ip: string;
  lastPingAt: number;
  ws?: WebSocket;
}

interface Room {
  id: string;
  name: string;
  mapSize: '1v1' | '2v2' | '3v3' | '4v4';
  teamSize: 1 | 2 | 3 | 4;
  maxPlayers: number;
  goalLimit: number;
  timeLimit: number;
  password?: string;
  region: string;
  hostPing: number;
  hostIp: string;
  balancedPing: number;
  pingQuality: 'Excelente (Pareado)' | 'Bom (Sincronizado)' | 'Ajustado com Buffer';
  bufferDelayMs: number;
  createdAt: number;
  isMatchStarted: boolean;
  players: Map<string, RoomPlayer>;
}

// Armazenamento em memória das salas 100% reais criadas por jogadores
const rooms = new Map<string, Room>();

// Recalcula o balanceamento de ping da sala para justiça competitiva
function recalculateRoomPingBalance(room: Room) {
  const playerList = Array.from(room.players.values());
  if (playerList.length === 0) return;

  const host = playerList.find((p) => p.isHost) || playerList[0];
  const pings = playerList.map((p) => (p.ping > 0 ? p.ping : 25));

  const hostPing = host.ping > 0 ? host.ping : 20;
  const avgPing = Math.round(pings.reduce((sum, p) => sum + p, 0) / pings.length);
  const minPing = Math.min(...pings);
  const maxPing = Math.max(...pings);
  const pingDiff = maxPing - minPing;

  // Cálculo de equalização: buffer proporcional à disparidade
  const bufferDelayMs = Math.min(30, Math.round(pingDiff / 2));

  let quality: Room['pingQuality'] = 'Excelente (Pareado)';
  if (pingDiff > 40) {
    quality = 'Ajustado com Buffer';
  } else if (pingDiff > 18) {
    quality = 'Bom (Sincronizado)';
  }

  room.hostPing = hostPing;
  room.hostIp = host.ip;
  room.balancedPing = avgPing;
  room.pingQuality = quality;
  room.bufferDelayMs = bufferDelayMs;

  // Notifica todos na sala sobre o ajuste dinâmico de latência
  broadcastToRoom(room, {
    type: 'ping_balance_sync',
    hostPing,
    balancedPing: avgPing,
    pingDiff,
    bufferDelayMs,
    quality,
    timestamp: Date.now(),
  });
}

function serializeRooms() {
  const list = [];
  for (const [, r] of rooms) {
    list.push({
      id: r.id,
      name: r.name,
      mapSize: r.mapSize,
      teamSize: r.teamSize,
      mode: `${r.teamSize}v${r.teamSize}`,
      players: r.players.size,
      maxPlayers: r.maxPlayers,
      goalLimit: r.goalLimit,
      timeLimit: r.timeLimit,
      hasPassword: Boolean(r.password),
      region: r.region,
      hostPing: r.hostPing,
      hostIp: r.hostIp,
      ping: r.balancedPing,
      pingQuality: r.pingQuality,
      bufferDelayMs: r.bufferDelayMs,
    });
  }
  return list;
}

// REST API para Salas
app.get('/api/rooms', (req, res) => {
  res.json({ rooms: serializeRooms() });
});

app.post('/api/rooms', (req, res) => {
  const { name, mapSize = '1v1', teamSize = 1, goalLimit = 5, timeLimit = 5, password = '', region = 'BR' } = req.body;

  const validTeamSize = Math.max(1, Math.min(4, Number(teamSize) || 1)) as 1 | 2 | 3 | 4;
  const validMapSize = (['1v1', '2v2', '3v3', '4v4'].includes(mapSize)
    ? mapSize
    : `${validTeamSize}v${validTeamSize}`) as '1v1' | '2v2' | '3v3' | '4v4';

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const maskedIp = clientIp.includes('.')
    ? clientIp.split('.').slice(0, 2).join('.') + '.*.*'
    : 'Local-IP';

  const id = `sala-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newRoom: Room = {
    id,
    name: name?.trim() || `Sala ${validMapSize} Pro`,
    mapSize: validMapSize,
    teamSize: validTeamSize,
    maxPlayers: validTeamSize * 2,
    goalLimit: Number(goalLimit) || 5,
    timeLimit: Number(timeLimit) || 5,
    password: password?.trim() || undefined,
    region: region || 'BR-SP',
    hostPing: 20,
    hostIp: maskedIp,
    balancedPing: 20,
    pingQuality: 'Excelente (Pareado)',
    bufferDelayMs: 0,
    createdAt: Date.now(),
    isMatchStarted: false,
    players: new Map(),
  };

  rooms.set(id, newRoom);
  res.status(201).json({ success: true, room: newRoom });
});

// Download do HTML Solo para testar no celular offline
app.get(['/download/futzin_mobile.html', '/download/chinaball_solo.html', '/download/ChinaBall_Solo_Mobile.html'], (req, res) => {
  const filePath = path.join(__dirname, 'public', 'futzin_1v1_mobile.html');
  res.download(filePath, 'ChinaBall_Solo_Mobile.html', (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('Erro ao baixar o arquivo mobile.');
    }
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// WebSocket para Multiplayer em Tempo Real com Ping Balanceado
wss.on('connection', (ws: WebSocket, req) => {
  let currentRoomId: string | null = null;
  let playerId: string | null = null;

  const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const playerIp = rawIp.includes('.')
    ? rawIp.split('.').slice(0, 2).join('.') + '.*.*'
    : '127.0.*.*';

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      // Latency Heartbeat RTT
      if (msg.type === 'client_ping') {
        ws.send(JSON.stringify({ type: 'server_pong', clientTime: msg.t, serverTime: Date.now() }));
        return;
      }

      // Atualização de ping do cliente
      if (msg.type === 'report_ping' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const p = room.players.get(playerId);
          if (p && typeof msg.ping === 'number') {
            p.ping = Math.max(1, Math.min(500, Math.round(msg.ping)));
            p.lastPingAt = Date.now();
            recalculateRoomPingBalance(room);
          }
        }
        return;
      }

      if (msg.type === 'join_room') {
        const room = rooms.get(msg.roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Sala não encontrada' }));
          return;
        }

        currentRoomId = msg.roomId;
        playerId = msg.playerId || `p_${Date.now()}_${Math.floor(Math.random() * 100)}`;

        const isHost = room.players.size === 0;
        const isReferee = isHost;
        const initialPing = typeof msg.ping === 'number' ? msg.ping : (isHost ? 18 : 25);

        const redCount = Array.from(room.players.values()).filter((p) => p.team === 'red').length;
        const blueCount = Array.from(room.players.values()).filter((p) => p.team === 'blue').length;
        let assignedTeam: 'red' | 'blue' | 'spec' = msg.preferredTeam;
        if (!assignedTeam || (assignedTeam !== 'red' && assignedTeam !== 'blue' && assignedTeam !== 'spec')) {
          assignedTeam = redCount <= blueCount ? 'red' : 'blue';
        }

        const player: RoomPlayer = {
          id: playerId!,
          name: msg.name || 'Jogador',
          team: assignedTeam,
          slot: room.players.size,
          isHost,
          isReferee,
          joinedAt: Date.now(),
          ping: initialPing,
          ip: playerIp,
          lastPingAt: Date.now(),
          ws,
        };

        room.players.set(playerId!, player);
        recalculateRoomPingBalance(room);

        // Notifica o jogador que entrou com informações completas de árbitro e dono
        ws.send(
          JSON.stringify({
            type: 'room_joined',
            roomId: room.id,
            roomName: room.name,
            mapSize: room.mapSize,
            teamSize: room.teamSize,
            goalLimit: room.goalLimit,
            timeLimit: room.timeLimit,
            isMatchStarted: room.isMatchStarted,
            player: {
              id: player.id,
              name: player.name,
              team: player.team,
              isHost: player.isHost,
              isReferee: player.isReferee,
              ping: player.ping,
              ip: player.ip,
            },
            balancedPing: room.balancedPing,
            hostPing: room.hostPing,
            bufferDelayMs: room.bufferDelayMs,
            pingQuality: room.pingQuality,
            players: Array.from(room.players.values()).map((p) => ({
              id: p.id,
              name: p.name,
              team: p.team,
              isHost: p.isHost,
              isReferee: p.isReferee,
              ping: p.ping,
            })),
          })
        );

        // Notifica os outros jogadores da sala
        broadcastToRoom(
          room,
          {
            type: 'player_joined',
            player: { id: player.id, name: player.name, team: player.team, isHost: player.isHost, isReferee: player.isReferee, ping: player.ping },
            balancedPing: room.balancedPing,
            bufferDelayMs: room.bufferDelayMs,
          },
          playerId!
        );
      }

      if (msg.type === 'transfer_referee' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const sender = room.players.get(playerId);
          if (sender && (sender.isHost || sender.isReferee)) {
            const target = room.players.get(msg.targetPlayerId);
            if (target) {
              sender.isReferee = false;
              target.isReferee = true;
              broadcastToRoom(room, {
                type: 'referee_transferred',
                refereeId: target.id,
                refereeName: target.name,
                message: `Árbitro transferido para ${target.name}!`,
              });
            }
          }
        }
      }

      if (msg.type === 'start_online_match' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const sender = room.players.get(playerId);
          if (sender && (sender.isHost || sender.isReferee)) {
            const redCount = Array.from(room.players.values()).filter((p) => p.team === 'red').length;
            const blueCount = Array.from(room.players.values()).filter((p) => p.team === 'blue').length;

            if (redCount === 0 || blueCount === 0) {
              ws.send(JSON.stringify({
                type: 'room_notice',
                message: 'Para iniciar a partida online é necessário pelo menos 1 jogador real em cada time! Convide um amigo pelo link.',
              }));
              return;
            }

            room.isMatchStarted = true;
            broadcastToRoom(room, {
              type: 'match_started_by_referee',
              startedBy: sender.name,
              message: `Partida iniciada pelo árbitro ${sender.name}!`,
            });
          }
        }
      }

      if (msg.type === 'toggle_ready' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const p = room.players.get(playerId);
          if (p) {
            p.isReady = !p.isReady;
            broadcastToRoom(room, {
              type: 'player_ready_updated',
              playerId: p.id,
              isReady: p.isReady,
            });
          }
        }
      }

      if (msg.type === 'swap_teams' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const sender = room.players.get(playerId);
          if (sender && (sender.isHost || sender.isReferee)) {
            for (const p of room.players.values()) {
              if (p.team === 'red') p.team = 'blue';
              else if (p.team === 'blue') p.team = 'red';
            }
            broadcastToRoom(room, {
              type: 'teams_swapped',
              players: Array.from(room.players.values()).map((p) => ({
                id: p.id,
                name: p.name,
                team: p.team,
                isHost: p.isHost,
                isReferee: p.isReferee,
                isReady: p.isReady,
                ping: p.ping,
              })),
              message: 'Lados invertidos pelo árbitro (Vermelho ⇄ Azul)!',
            });
          }
        }
      }

      if (msg.type === 'shuffle_teams' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const sender = room.players.get(playerId);
          if (sender && (sender.isHost || sender.isReferee)) {
            const active = Array.from(room.players.values()).filter((p) => p.team !== 'spec');
            for (let i = active.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [active[i], active[j]] = [active[j], active[i]];
            }
            active.forEach((p, idx) => {
              p.team = idx % 2 === 0 ? 'red' : 'blue';
            });
            broadcastToRoom(room, {
              type: 'teams_shuffled',
              players: Array.from(room.players.values()).map((p) => ({
                id: p.id,
                name: p.name,
                team: p.team,
                isHost: p.isHost,
                isReferee: p.isReferee,
                isReady: p.isReady,
                ping: p.ping,
              })),
              message: 'Times sorteados aleatoriamente pelo árbitro!',
            });
          }
        }
      }

      if (msg.type === 'switch_team' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const p = room.players.get(playerId);
          if (p && (msg.team === 'red' || msg.team === 'blue' || msg.team === 'spec')) {
            p.team = msg.team;
            broadcastToRoom(room, {
              type: 'team_switched',
              playerId: p.id,
              team: p.team,
            });
          }
        }
      }

      if (msg.type === 'sync_player' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const sender = room.players.get(playerId);
          broadcastToRoom(
            room,
            {
              type: 'peer_player_sync',
              playerId,
              team: sender?.team || 'red',
              slot: sender?.slot || 0,
              x: msg.x,
              y: msg.y,
              vx: msg.vx,
              vy: msg.vy,
              isKicking: Boolean(msg.isKicking),
            },
            playerId
          );
        }
      }

      if (msg.type === 'sync_ball' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const sender = room.players.get(playerId);
          if (sender?.isHost) {
            broadcastToRoom(
              room,
              {
                type: 'peer_ball_sync',
                x: msg.x,
                y: msg.y,
                vx: msg.vx,
                vy: msg.vy,
                angle: msg.angle,
                scoreYellow: msg.scoreYellow,
                scoreBlue: msg.scoreBlue,
              },
              playerId
            );
          }
        }
      }

      if (msg.type === 'sync_goal' && currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          broadcastToRoom(room, {
            type: 'peer_goal',
            scorerTeam: msg.scorerTeam,
            message: msg.message,
            scoreYellow: msg.scoreYellow,
            scoreBlue: msg.scoreBlue,
          });
        }
      }

      if (msg.type === 'sync_reset' && currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          broadcastToRoom(room, {
            type: 'peer_reset',
          });
        }
      }

      if (msg.type === 'move_player' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const sender = room.players.get(playerId);
          if (sender && (sender.isHost || sender.isReferee)) {
            const target = room.players.get(msg.targetPlayerId);
            if (target && (msg.team === 'red' || msg.team === 'blue' || msg.team === 'spec')) {
              target.team = msg.team;
              broadcastToRoom(room, {
                type: 'player_team_updated',
                playerId: target.id,
                team: target.team,
                movedBy: sender.name,
              });
            }
          }
        }
      }

      if (msg.type === 'leave_room' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const wasHost = room.players.get(playerId)?.isHost;
          room.players.delete(playerId);
          broadcastToRoom(room, { type: 'player_left', playerId });

          if (wasHost && room.players.size > 0) {
            const sorted = Array.from(room.players.values()).sort((a, b) => a.joinedAt - b.joinedAt);
            const newHost = sorted[0];
            if (newHost) {
              newHost.isHost = true;
              newHost.isReferee = true;
              broadcastToRoom(room, {
                type: 'host_transferred',
                hostId: newHost.id,
                hostName: newHost.name,
                isReferee: true,
                message: `${newHost.name} assumiu a liderança e arbitragem da sala!`,
              });
            }
          }

          if (room.players.size === 0) {
            rooms.delete(currentRoomId);
          }
          currentRoomId = null;
        }
      }

      if (msg.type === 'chat_message' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const sender = room.players.get(playerId);
          broadcastToRoom(room, {
            type: 'chat',
            id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            sender: sender?.name || 'Jogador',
            team: sender?.team || 'red',
            text: String(msg.text || '').slice(0, 120),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && playerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const wasHost = room.players.get(playerId)?.isHost;
        room.players.delete(playerId);
        broadcastToRoom(room, { type: 'player_left', playerId });

        if (wasHost && room.players.size > 0) {
          // O jogador mais antigo na sala herda a liderança e o controle de árbitro
          const sorted = Array.from(room.players.values()).sort((a, b) => a.joinedAt - b.joinedAt);
          const newHost = sorted[0];
          if (newHost) {
            newHost.isHost = true;
            newHost.isReferee = true;
            broadcastToRoom(room, {
              type: 'host_transferred',
              hostId: newHost.id,
              hostName: newHost.name,
              isReferee: true,
              message: `${newHost.name} assumiu a liderança e arbitragem da sala!`,
            });
          }
        }

        recalculateRoomPingBalance(room);

        // Se a sala ficar vazia, remove imediatamente (apenas salas ativas reais)
        if (room.players.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    }
  });
});

function broadcastToRoom(room: Room, msg: object, excludePlayerId?: string) {
  const json = JSON.stringify(msg);
  for (const [id, p] of room.players) {
    if (excludePlayerId && id === excludePlayerId) continue;
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(json);
    }
  }
}

// Inicia Vite em Dev ou Estáticos em Prod
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`⚽ Servidor ChinaBall Pro online na porta ${PORT}`);
  });
}

start();
