import { useEffect, useRef, useState } from 'react';
import { FiMic, FiSend, FiX } from 'react-icons/fi';
import type { AiTextResult } from '../../shared/extras';
import {
  enhanceMessageText,
  generateMessageText,
  parseFlexCommand,
  transcribeAudioFile,
} from '../extrasApi';
import { useToast } from '../ui/Toast';

const WELCOME_TEXT =
  "Hi, I'm Flex. Try: open General, send good morning @everyone for 7 a.m. tomorrow, snooze General for 2 hours, or keep me on snooze for 3 hours.";

type FlexChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type FlexAiPanelProps = {
  open: boolean;
  draft: string;
  conversationId: string | null;
  onToggle: () => void;
  onClose: () => void;
  onInsert: (text: string) => void;
  onCommand: (result: AiTextResult, input: string) => Promise<string>;
  onUnauthorized?: (status?: number) => boolean;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

function nextMessageId(): string {
  return `flex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function FlexRobotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7.5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1.15" fill="currentColor" />
      <rect x="5" y="7.5" width="14" height="11.5" rx="3.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9.4" cy="13" r="1.2" fill="currentColor" />
      <circle cx="14.6" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}

function EnhanceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 17c2.2-1.4 3.1 1.6 5.2.6 2.1-1 2.6-3.2 5-2.2 2.2.9 2.6 2.8 5.8 1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14.2 5.2 18 9M8 16.8 16.4 8.4a2.15 2.15 0 0 1 3 3L11 19.8H8v-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlexAiPanel({
  open,
  draft,
  conversationId,
  onToggle,
  onClose,
  onInsert,
  onCommand,
  onUnauthorized,
}: FlexAiPanelProps) {
  const toast = useToast();
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<FlexChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: WELCOME_TEXT },
  ]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, messages.length]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const appendMessages = (...next: FlexChatMessage[]) => {
    setMessages((current) => [...current, ...next]);
  };

  const runEnhanceOrGenerate = async () => {
    const source = input.trim() || draft.trim();

    if (!source) {
      toast.error('Type something for Flex to rewrite.');
      return;
    }

    const shouldGenerate = /^(write|generate|draft|compose)\b/i.test(source);
    setBusy(true);
    const response = shouldGenerate
      ? await generateMessageText(source)
      : await enhanceMessageText(source);
    setBusy(false);

    if (!response.ok) {
      if (onUnauthorized?.(response.status)) {
        return;
      }
      toast.error(response.error);
      return;
    }

    if (!response.data.text.trim()) {
      toast.error('AI did not return any text.');
      return;
    }

    setInput(response.data.text);
    onInsert(response.data.text);
    appendMessages({
      id: nextMessageId(),
      role: 'assistant',
      text: shouldGenerate ? response.data.text : `Here's a clearer version:\n${response.data.text}`,
    });
  };

  const runCommand = async () => {
    const command = input.trim();

    if (!command) {
      toast.error('Ask Flex something first.');
      return;
    }

    setInput('');
    appendMessages({ id: nextMessageId(), role: 'user', text: command });
    setBusy(true);

    const response = await parseFlexCommand(command, conversationId ?? undefined);
    if (!response.ok) {
      setBusy(false);
      if (onUnauthorized?.(response.status)) {
        return;
      }
      appendMessages({
        id: nextMessageId(),
        role: 'assistant',
        text: response.error,
      });
      return;
    }

    try {
      const reply = await onCommand(response.data, command);
      appendMessages({
        id: nextMessageId(),
        role: 'assistant',
        text: reply.trim() || response.data.text.trim() || 'Done.',
      });
    } catch {
      appendMessages({
        id: nextMessageId(),
        role: 'assistant',
        text: 'I could not finish that command.',
      });
    } finally {
      setBusy(false);
    }
  };

  const runTranscribe = async (file: File) => {
    setBusy(true);

    try {
      const base64 = await readFileAsBase64(file);
      const response = await transcribeAudioFile(file.name, file.type || 'audio/webm', base64);
      setBusy(false);

      if (!response.ok) {
        if (onUnauthorized?.(response.status)) {
          return;
        }
        toast.error(response.error);
        return;
      }

      if (!response.data.text.trim()) {
        toast.error('No transcription returned.');
        return;
      }

      setInput(response.data.text);
      inputRef.current?.focus();
    } catch {
      setBusy(false);
      toast.error('Unable to read audio.');
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void runTranscribe(new File([blob], 'flex-ai-recording.webm', { type: blob.type }));
      };

      recorder.start();
      setRecording(true);
    } catch {
      toast.error('Microphone access is required to dictate.');
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-5 left-[90px] z-[70] flex flex-col items-start">
      <div className="pointer-events-auto flex h-[460px] w-[380px] flex-col overflow-hidden rounded-[24px] border border-app-border bg-app-surface/95 backdrop-blur-xl shadow-2xl animate-pop-in">
          <div className="flex items-center justify-between border-b border-app-border bg-app-chat-panel/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-[#5c2431] text-white shadow-md shadow-accent/30">
                <FlexRobotIcon />
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight text-app-text">Flex AI</p>
                <p className="text-[11px] font-medium text-app-muted">Workplace Assistant</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close Flex"
              className="rounded-xl p-1.5 text-app-muted hover:bg-app-chat-hover hover:text-app-text transition-colors"
              onClick={onClose}
            >
              <FiX className="text-base" />
            </button>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-[18px] px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-accent via-accent to-[#632a38] text-white shadow-accent/20'
                      : 'border border-app-border bg-app-inset/90 text-app-text'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-accent-soft">
                <div className="h-2 w-2 animate-ping rounded-full bg-accent" />
                <span>Flex is thinking…</span>
              </div>
            ) : null}
          </div>

          <div className="border-t border-app-border bg-app-chat-panel/50 px-3.5 py-3">
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                value={input}
                placeholder="Ask Flex or dictate a message..."
                disabled={busy}
                className="h-9 min-w-0 flex-1 rounded-xl border border-app-border bg-app-surface-input px-3 text-xs text-app-text outline-none transition-all placeholder:text-app-placeholder/70 focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void runCommand();
                  }
                }}
              />
              <button
                type="button"
                aria-label="Enhance with Flex"
                title="Enhance or generate"
                disabled={busy}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-muted hover:bg-app-chat-hover hover:text-app-text transition-all active:scale-95 disabled:opacity-40"
                onClick={() => void runEnhanceOrGenerate()}
              >
                <EnhanceIcon />
              </button>
              <button
                type="button"
                aria-label={recording ? 'Stop dictation' : 'Dictate a message'}
                title={recording ? 'Stop dictation' : 'Dictate a message'}
                disabled={busy && !recording}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 hover:bg-app-chat-hover disabled:opacity-40 ${
                  recording ? 'text-accent font-bold ring-1 ring-accent animate-pulse' : 'text-app-muted hover:text-app-text'
                }`}
                onClick={() => void toggleRecording()}
              >
                <FiMic className="text-base" />
              </button>
              <button
                type="button"
                aria-label="Send to Flex"
                disabled={busy || !input.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#5c2431] text-white shadow-sm shadow-accent/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                onClick={() => void runCommand()}
              >
                <FiSend className="text-sm" />
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
