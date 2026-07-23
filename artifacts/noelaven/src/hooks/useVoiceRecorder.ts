import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceRecording {
  blob: Blob;
  duration: number;        // seconds
  waveform: number[];      // 0-1 normalized amplitudes (32 bars)
}

interface State {
  isRecording: boolean;
  duration: number;        // live seconds while recording
  error: string | null;
}

export function useVoiceRecorder() {
  const [state, setState] = useState<State>({ isRecording: false, duration: 0, error: null });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformRef = useRef<number[]>([]);
  const waveformSamplesRef = useRef<number[][]>([]); // raw sample batches

  const stop = useCallback((): Promise<VoiceRecording | null> => {
    return new Promise(resolve => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') { resolve(null); return; }

      cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      mr.onstop = () => {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Reduce waveformSamples to 32 bars
        const samples = waveformSamplesRef.current;
        const bars = 32;
        const step = Math.max(1, Math.floor(samples.length / bars));
        const waveform: number[] = [];
        for (let i = 0; i < bars; i++) {
          const slice = samples.slice(i * step, (i + 1) * step);
          if (!slice.length) { waveform.push(0.1); continue; }
          const avg = slice.reduce((s, batch) => {
            const batchAvg = batch.reduce((a, v) => a + v, 0) / (batch.length || 1);
            return s + batchAvg;
          }, 0) / slice.length;
          waveform.push(Math.min(1, avg / 128));
        }

        // Stop stream tracks
        mr.stream.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        waveformSamplesRef.current = [];

        setState({ isRecording: false, duration: 0, error: null });
        resolve({ blob, duration, waveform });
      };

      mr.stop();
    });
  }, []);

  const start = useCallback(async () => {
    setState(s => ({ ...s, error: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '' });
      chunksRef.current = [];
      waveformSamplesRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(100);
      mediaRecorderRef.current = mr;
      startTimeRef.current = Date.now();

      // Live duration ticker
      timerRef.current = setInterval(() => {
        setState(s => ({ ...s, duration: (Date.now() - startTimeRef.current) / 1000 }));
      }, 500);

      // Live waveform sampling
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const sampleLoop = () => {
        if (!mediaRecorderRef.current) return;
        analyser.getByteFrequencyData(buf);
        waveformSamplesRef.current.push(Array.from(buf));
        animFrameRef.current = requestAnimationFrame(sampleLoop);
      };
      animFrameRef.current = requestAnimationFrame(sampleLoop);

      setState({ isRecording: true, duration: 0, error: null });
    } catch (e: any) {
      setState({ isRecording: false, duration: 0, error: e?.message ?? 'Microphone access denied' });
    }
  }, []);

  const cancel = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      mr.stream.getTracks().forEach(t => t.stop());
      mr.stop();
      mediaRecorderRef.current = null;
    }
    chunksRef.current = [];
    waveformSamplesRef.current = [];
    setState({ isRecording: false, duration: 0, error: null });
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { cancel(); }, [cancel]);

  return {
    isRecording: state.isRecording,
    duration: state.duration,
    error: state.error,
    start,
    stop,
    cancel,
  };
}
