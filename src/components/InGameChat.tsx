import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: string;
  team: 'red' | 'blue' | 'spec' | 'system';
  text: string;
  time: string;
  timestamp: number;
}

interface InGameChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  myTeam: 'red' | 'blue' | 'spec';
}

export const InGameChat: React.FC<InGameChatProps> = ({
  messages,
  onSendMessage,
  isChatOpen,
  setIsChatOpen,
  myTeam,
}) => {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const now = Date.now();

  // Foco no input quando o chat é aberto
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isChatOpen]);

  // Tecla Enter para abrir ou enviar; Escape para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        if (!isChatOpen) {
          e.preventDefault();
          setIsChatOpen(true);
        }
      } else if (e.code === 'Escape' && isChatOpen) {
        e.preventDefault();
        setIsChatOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, setIsChatOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (text) {
      onSendMessage(text);
      setInputText('');
    }
    setIsChatOpen(false);
  };

  // Mensagens visíveis: se o chat estiver aberto, mostra as últimas 8; se fechado, só as que têm menos de 5 segundos
  const visibleMessages = messages.filter((m) => {
    if (isChatOpen) return true;
    return now - m.timestamp < 5000;
  }).slice(-8);

  const getTeamColor = (team: ChatMessage['team']) => {
    if (team === 'red') return 'text-amber-400 font-bold';
    if (team === 'blue') return 'text-blue-400 font-bold';
    if (team === 'system') return 'text-emerald-400 font-bold';
    return 'text-zinc-400 font-semibold';
  };

  return (
    <div className="fixed bottom-20 left-4 z-35 max-w-sm w-full pointer-events-none select-none flex flex-col justify-end space-y-1">
      {/* Lista de Mensagens que somem após 5 segundos */}
      <div className="space-y-1 overflow-hidden transition-all duration-300">
        {visibleMessages.map((msg) => {
          const age = now - msg.timestamp;
          // Se o chat estiver fechado e a mensagem estiver no final do ciclo (entre 4s e 5s), aplica fade out
          const isFading = !isChatOpen && age > 4000;

          return (
            <div
              key={msg.id}
              className={`px-3 py-1.5 rounded-lg text-xs backdrop-blur-md transition-all duration-500 shadow-md ${
                isFading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
              } ${
                msg.team === 'system'
                  ? 'bg-emerald-950/80 border border-emerald-500/30 text-emerald-200'
                  : 'bg-black/75 border border-zinc-800/80 text-white'
              }`}
            >
              <div className="flex items-start gap-1.5 leading-relaxed break-words">
                <span className="text-[10px] text-zinc-500 font-mono shrink-0 mt-0.5">
                  {msg.time}
                </span>
                <span className={`${getTeamColor(msg.team)} shrink-0`}>
                  {msg.sender}:
                </span>
                <span className="text-zinc-100">{msg.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Caixa de Texto do Chat (Oculta até pressionar Enter) */}
      {isChatOpen ? (
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto mt-1 flex items-center gap-1.5 p-1.5 rounded-xl bg-black/90 border border-zinc-700 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Digite sua mensagem (Enter para enviar, Esc para fechar)..."
            maxLength={100}
            className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
            onKeyDown={(e) => {
              // Garante que o input capture tudo e não passe para o jogo
              e.stopPropagation();
            }}
          />

          <button
            type="submit"
            className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors cursor-pointer"
            title="Enviar mensagem"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        /* Dica sutil para abrir chat ou botão touch no mobile */
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="px-2.5 py-1 rounded-full bg-black/60 hover:bg-zinc-800/80 border border-zinc-800/80 text-[11px] text-zinc-400 hover:text-white flex items-center gap-1.5 backdrop-blur-sm transition-colors cursor-pointer"
            title="Abrir Chat (Pressione Enter)"
          >
            <MessageSquare className="w-3 h-3 text-amber-400" />
            <span>Chat (Enter)</span>
          </button>
        </div>
      )}
    </div>
  );
};
