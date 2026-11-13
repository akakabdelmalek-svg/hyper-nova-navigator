import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Mic,
  MicOff,
  Globe,
  Code2,
  FileText,
  Languages,
  Bug,
  Layout,
  Gamepad2,
  Cpu,
  ExternalLink,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { CrononovaMessage } from '../types/nova';

interface CrononovaPanelProps {
  open: boolean;
  hyperDrive: boolean;
  messages: CrononovaMessage[];
  loading: boolean;
  activeMode: string;
  listeningTrigger: number;
  onChangeMode: (mode: string) => void;
  onSendPrompt: (prompt: string, modeOverride?: string) => void;
  onClose: () => void;
}

const MODES = [
  { id: 'assistant', label: 'Assistant', icon: Cpu },
  { id: 'search', label: 'Web Search', icon: Globe },
  { id: 'site', label: 'Créer Site', icon: Layout },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'summarize', label: 'Résumer', icon: FileText },
  { id: 'translate', label: 'Traduire', icon: Languages },
  { id: 'debug', label: 'Debug', icon: Bug },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
];

const QUICK_EXAMPLES = [
  { label: 'Ouvre YouTube', prompt: 'Crononova ouvre YouTube', mode: 'assistant' },
  { label: 'Résume cette page', prompt: 'Crononova résume cette page', mode: 'summarize' },
  { label: 'Crée une calculatrice web', prompt: 'Crononova crée une calculatrice futuriste interactive en HTML/CSS/JS', mode: 'site' },
  { label: 'Optimise la RAM', prompt: 'Lance GX Booster pour optimiser la RAM à 4 Go', mode: 'assistant' },
];

export const CrononovaPanel: React.FC<CrononovaPanelProps> = ({
  open,
  hyperDrive,
  messages,
  loading,
  activeMode,
  listeningTrigger,
  onChangeMode,
  onSendPrompt,
  onClose,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const startVoiceCommand = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
    };

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceNote('Reconnaissance vocale indisponible sur ce navigateur. Tapez votre commande ci-dessous.');
      window.setTimeout(() => setVoiceNote(null), 3500);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'fr-FR';
      rec.interimResults = false;
      setIsListening(true);
      setVoiceNote('Écoute en cours... Dites "Crononova ouvre YouTube"');

      rec.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput(transcript);
          onSendPrompt(transcript);
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setVoiceNote('Micro non autorisé ou silencieux.');
        window.setTimeout(() => setVoiceNote(null), 2500);
      };
      rec.onend = () => {
        setIsListening(false);
        setVoiceNote(null);
      };
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  useEffect(() => {
    if (listeningTrigger > 0) {
      startVoiceCommand();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listeningTrigger]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSendPrompt(input.trim());
    setInput('');
  };

  return (
    <aside
      aria-label="Assistant IA Crononova"
      className={`w-full sm:w-[430px] shrink-0 border-l flex flex-col h-full bg-[#090D16]/95 backdrop-blur-md z-30 ${
        hyperDrive ? 'border-rose-500/45' : 'border-slate-800/90'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              hyperDrive
                ? 'bg-rose-500/15 border-rose-400/50 text-rose-300'
                : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
            }`}
          >
            {hyperDrive ? <Zap className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-display text-sm font-bold text-slate-100">CRONONOVA IA</div>
            <div className="text-[11px] text-slate-400">
              {hyperDrive ? 'Noyau Hyper Drive Amélioré' : 'Assistant Tactique & Web'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer Crononova"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="px-3 py-2.5 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = activeMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChangeMode(m.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-[#0D1320] text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Messages Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="text-[11px] text-slate-500 mb-1 font-mono-tabular">
              {msg.role === 'user' ? 'MALEK' : 'CRONONOVA'} · {msg.timestamp}
            </div>
            <div
              className={`max-w-[92%] rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.error
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                  : msg.role === 'user'
                  ? 'bg-cyan-500/15 border-cyan-500/35 text-slate-100'
                  : 'bg-[#0D1320] border-slate-800 text-slate-200'
              }`}
            >
              {msg.text}

              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-700/60 space-y-1">
                  {msg.actions.map((act, idx) => (
                    <div
                      key={`${act.name}-${idx}`}
                      className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-emerald-300"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Action navigateur : {act.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-700/60 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Sources Web
                  </div>
                  {msg.sources.slice(0, 4).map((src, idx) => (
                    <a
                      key={`${src.uri}-${idx}`}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-cyan-300 hover:underline truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="p-3 rounded-lg border border-slate-800 bg-[#0D1320] text-xs text-cyan-300 font-mono-tabular">
            Traitement Crononova en cours...
          </div>
        )}
      </div>

      {/* Quick Voice / Command Chips */}
      <div className="px-3 py-2 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto">
        {QUICK_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => onSendPrompt(ex.prompt, ex.mode)}
            className="px-2.5 py-1 rounded border border-slate-800 bg-[#0C121E] text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200 whitespace-nowrap shrink-0 transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {voiceNote && (
        <div className="px-4 py-1.5 bg-cyan-500/10 border-t border-cyan-500/30 text-[11px] text-cyan-200">
          {voiceNote}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-800/80 bg-[#070B13] flex items-center gap-2"
      >
        <button
          type="button"
          onClick={startVoiceCommand}
          title="Commande vocale Crononova"
          aria-label="Activer le microphone pour commande vocale"
          className={`flex items-center justify-center w-10 h-10 rounded-md border shrink-0 transition-colors ${
            isListening
              ? 'bg-rose-500/20 border-rose-400 text-rose-300'
              : 'bg-[#0D1320] border-slate-800 text-cyan-300 hover:border-cyan-500/50'
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ex: "Crononova ouvre YouTube", code, traduction...'
          className="flex-1 h-10 px-3 rounded-md border border-slate-800 bg-[#0D1320] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Envoyer à Crononova"
          className="flex items-center justify-center w-10 h-10 rounded-md bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-40 transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
};
