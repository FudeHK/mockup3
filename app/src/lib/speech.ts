'use client';
import { useCallback, useEffect, useState } from 'react';

export type SpeechState = { supported: boolean; reason: string; speaking: boolean; checking: boolean };

/** Web Speech API（ja-JP）での読み上げ。非対応端末では理由を返す */
export function useSpeech() {
  const [state, setState] = useState<SpeechState>({ supported: false, reason: '', speaking: false, checking: true });

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 端末の対応状況を初回に判定
      setState({ supported: false, reason: 'この端末・ブラウザは音声読み上げに対応していません', speaking: false, checking: false });
      return;
    }
    const synth = window.speechSynthesis;
    const check = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) return false;
      const ja = voices.some((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
      setState((s) => ({
        ...s,
        checking: false,
        supported: ja,
        reason: ja ? '' : 'この端末には日本語の読み上げ音声が入っていません（端末の設定で追加できます）',
      }));
      return true;
    };
    if (!check()) {
      synth.addEventListener('voiceschanged', check);
      const t = window.setTimeout(() => {
        if (!check()) {
          setState((s) => ({ ...s, checking: false, supported: false, reason: 'この端末では読み上げ音声が見つかりません' }));
        }
      }, 2000);
      return () => {
        synth.removeEventListener('voiceschanged', check);
        window.clearTimeout(t);
        synth.cancel();
      };
    }
    return () => synth.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!state.supported) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.rate = 0.95;
      const ja = synth.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
      if (ja) u.voice = ja;
      u.onend = () => setState((s) => ({ ...s, speaking: false }));
      u.onerror = () => setState((s) => ({ ...s, speaking: false }));
      setState((s) => ({ ...s, speaking: true }));
      synth.speak(u);
    },
    [state.supported],
  );

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setState((s) => ({ ...s, speaking: false }));
  }, []);

  return { ...state, speak, stop };
}
