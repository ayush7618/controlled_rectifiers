import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalculatedInsights, PinnedSnapshot, TopologyType, WaveformSample } from '../types/rectifier';
import { Play, Pause, RotateCcw, Pin, PinOff, LayoutGrid, Layers, Eye, EyeOff, Zap } from 'lucide-react';

interface OscilloscopeProps {
  insights: CalculatedInsights;
  alpha: number;
  topology?: TopologyType;
  highlightedProbe: string | null;
  cursorSampleIndex: number;
  setCursorSampleIndex: (index: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  pinnedSnapshot: PinnedSnapshot | null;
  onPinCurrent: () => void;
  onClearPin: () => void;
}

export type ScopeViewMode = 'stacked' | 'waveform' | 'fft' | 'lissajous';

export interface ChannelConfig {
  id: string;
  name: string;
  unit: string;
  color: string;
  visible: boolean;
  scaleFactor: number;
}

interface ConductionInterval {
  startDeg: number;
  endDeg: number;
  label: string;
  devices: string[];
  type: 'conduction' | 'freewheel' | 'blocking';
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  insights,
  alpha,
  topology,
  highlightedProbe,
  cursorSampleIndex,
  setCursorSampleIndex,
  isPlaying,
  setIsPlaying,
  pinnedSnapshot,
  onPinCurrent,
  onClearPin,
}) => {
  const is3Phase = topology === 'three-phase-full' || topology === 'three-phase-semi' || Boolean(insights.samples[0]?.vA !== undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default to 'stacked' mode (at least 3 synchronized plots in a single view!)
  const [viewMode, setViewMode] = useState<ScopeViewMode>('stacked');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [timeZoom, setTimeZoom] = useState<number>(1); // 1 = 2 cycles, 2 = 1 cycle

  // User toggleable waveform layers
  const [showGatePulses, setShowGatePulses] = useState<boolean>(false);
  const [showInputRef, setShowInputRef] = useState<boolean>(true); // Merged dashed input on output waveform by default
  const [showInputCurrent, setShowInputCurrent] = useState<boolean>(false);

  // Channels setup for Combined overlay
  const [channels, setChannels] = useState<ChannelConfig[]>([
    { id: 'vo', name: 'v_o (Output V)', unit: 'V', color: '#06b6d4', visible: true, scaleFactor: 1 },
    { id: 'io', name: 'i_o (Output I)', unit: 'A', color: '#10b981', visible: true, scaleFactor: 10 },
    { id: 'vs', name: 'v_s (Supply V)', unit: 'V', color: '#a855f7', visible: true, scaleFactor: 1 },
    { id: 'vt', name: 'v_T1 (SCR V)', unit: 'V', color: '#f59e0b', visible: false, scaleFactor: 1 },
    { id: 'vg', name: 'v_gate (Trigger)', unit: '', color: '#f43f5e', visible: true, scaleFactor: 80 },
    { id: 'is', name: 'i_s (Supply I)', unit: 'A', color: '#38bdf8', visible: false, scaleFactor: 10 },
  ]);

  useEffect(() => {
    if (!highlightedProbe) return;
    const probeMap: Record<string, string> = {
      Vo: 'vo',
      Vs: 'vs',
      VT1: 'vt',
      Gate: 'vg',
    };
    const targetChanId = probeMap[highlightedProbe];
    if (targetChanId) {
      setChannels(prev =>
        prev.map(ch => ({
          ...ch,
          visible: ch.id === targetChanId ? true : ch.visible,
        }))
      );
    }
  }, [highlightedProbe]);

  const toggleChannel = (id: string) => {
    setChannels(prev =>
      prev.map(ch => (ch.id === id ? { ...ch, visible: !ch.visible } : ch))
    );
  };

  // Animation sweep loop
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = now - lastTime;
      const samplesCount = insights.samples.length;
      if (samplesCount > 0) {
        const step = Math.max(1, Math.round((delta / 16) * 2 * playbackSpeed));
        setCursorSampleIndex((cursorSampleIndex + step) % samplesCount);
      }
      lastTime = now;
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, cursorSampleIndex, insights.samples.length, playbackSpeed, setCursorSampleIndex]);

  const samples = insights.samples;
  const currentSample = samples[cursorSampleIndex] || samples[0];
  const maxTheta = timeZoom === 2 ? 360 : 720;
  const visibleSamples = useMemo(() => samples.filter(s => s.thetaDeg <= maxTheta), [samples, maxTheta]);

  // Compute conduction intervals for the timeline below the graph
  const conductionIntervals = useMemo<ConductionInterval[]>(() => {
    if (!visibleSamples || visibleSamples.length === 0) return [];
    const intervals: ConductionInterval[] = [];

    let currentStart = visibleSamples[0].thetaDeg;
    let currentList = visibleSamples[0].activeThyristors;
    let currentKey = currentList.join(',') || 'OFF';

    const checkIsFwd = (devs: string[]) => {
      return (
        devs.includes('FWD') ||
        devs.includes('FREEWHEEL') ||
        (devs.includes('D1') && devs.includes('D4')) ||
        (devs.includes('D3') && devs.includes('D2')) ||
        (devs.includes('T1') && devs.includes('D4')) ||
        (devs.includes('T3') && devs.includes('D6')) ||
        (devs.includes('T5') && devs.includes('D2'))
      );
    };

    for (let i = 1; i < visibleSamples.length; i++) {
      const s = visibleSamples[i];
      const key = s.activeThyristors.join(',') || 'OFF';
      if (key !== currentKey) {
        const isFwd = checkIsFwd(currentList);
        const isBlock = currentList.length === 0;
        intervals.push({
          startDeg: currentStart,
          endDeg: s.thetaDeg,
          devices: currentList,
          label: isBlock ? 'OFF' : currentList.join(','),
          type: isBlock ? 'blocking' : isFwd ? 'freewheel' : 'conduction',
        });
        currentStart = s.thetaDeg;
        currentKey = key;
        currentList = s.activeThyristors;
      }
    }

    const lastSample = visibleSamples[visibleSamples.length - 1];
    const isFwd = checkIsFwd(currentList);
    const isBlock = currentList.length === 0;
    intervals.push({
      startDeg: currentStart,
      endDeg: lastSample.thetaDeg,
      devices: currentList,
      label: isBlock ? 'OFF' : currentList.join(','),
      type: isBlock ? 'blocking' : isFwd ? 'freewheel' : 'conduction',
    });

    return intervals;
  }, [visibleSamples]);

  // Helper to draw horizontal graticule and background
  const drawGraticule = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    numDivX: number,
    numDivY: number
  ) => {
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 1;

    const stepX = w / numDivX;
    const stepY = h / numDivY;

    for (let i = 0; i <= numDivX; i++) {
      const px = x + i * stepX;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + h);
      ctx.stroke();
    }

    for (let j = 0; j <= numDivY; j++) {
      const py = y + j * stepY;
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x + w, py);
      ctx.stroke();
    }
  };

  // =========================================================================
  // DRAW MODE 1: STACKED 3-PLOT MULTI-GRAPH
  // =========================================================================
  const drawStackedWaveforms = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    if (!samples || samples.length === 0) return;

    const n = visibleSamples.length;
    if (n < 2) return;

    // Sub-plot geometry (3 vertically stacked panes + Conduction Track at bottom)
    const paddingX = 42;
    const graphWidth = width - paddingX - 16;
    const gap = 10;
    const conductionH = 20;
    const totalGraphHeight = height - gap * 2 - 28 - conductionH;
    const h1 = totalGraphHeight * 0.28; // Plot 1: Supply V & Gate
    const h2 = totalGraphHeight * 0.40; // Plot 2: Output Rectified Voltage Vo (main)
    const h3 = totalGraphHeight * 0.32; // Plot 3: Output Current Io & Supply Current Is

    const y1 = 12;
    const y2 = y1 + h1 + gap;
    const y3 = y2 + h2 + gap;

    const maxVoltage = Math.max(10, insights.vm * 1.25);
    const maxCurrent = Math.max(1, insights.iRmsOut * 2.5, insights.iDc * 2);

    const getX = (thetaDeg: number) => paddingX + (thetaDeg / maxTheta) * graphWidth;

    // -------------------------------------------------------------
    // PLOT 1: Supply AC Voltage v_s(t) & Gate Pulses v_g(t)
    // -------------------------------------------------------------
    drawGraticule(ctx, paddingX, y1, graphWidth, h1, 8, 4);
    const centerY1 = y1 + h1 / 2;
    const scaleV1 = (h1 * 0.42) / maxVoltage;

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingX, centerY1);
    ctx.lineTo(paddingX + graphWidth, centerY1);
    ctx.stroke();

    ctx.fillStyle = is3Phase ? '#38bdf8' : '#a855f7';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(
      is3Phase
        ? showGatePulses
          ? 'GRAPH 1: 3-PHASE SUPPLY VOLTAGES (v_a, v_b, v_c) & GATE PULSES'
          : 'GRAPH 1: 3-PHASE SUPPLY VOLTAGES (v_a, v_b, v_c)'
        : showGatePulses
        ? 'GRAPH 1: SUPPLY VOLTAGE v_s(t) & GATE PULSES'
        : 'GRAPH 1: SUPPLY VOLTAGE v_s(t)',
      paddingX + 4,
      y1 + 12
    );

    const hasAnyGate = is3Phase
      ? Boolean(
          currentSample?.gate1 ||
            currentSample?.gate2 ||
            currentSample?.gate3 ||
            currentSample?.gate4 ||
            currentSample?.gate5 ||
            currentSample?.gate6
        )
      : Boolean(currentSample?.gate1 || currentSample?.gate2);

    ctx.fillStyle = '#cbd5e1';
    if (is3Phase) {
      ctx.fillText(
        `v_a:${currentSample?.vA ?? currentSample?.vs ?? 0}V | v_b:${currentSample?.vB ?? 0}V | v_c:${currentSample?.vC ?? 0}V${showGatePulses ? ` | Gate:${hasAnyGate ? 'HIGH' : 'LOW'}` : ''}`,
        paddingX + graphWidth - (showGatePulses ? 280 : 210),
        y1 + 12
      );
    } else {
      ctx.fillText(
        `v_s: ${currentSample?.vs ?? 0} V${showGatePulses ? ` | Gate: ${hasAnyGate ? 'HIGH' : 'LOW'}` : ''}`,
        paddingX + graphWidth - (showGatePulses ? 200 : 120),
        y1 + 12
      );
    }

    if (is3Phase) {
      // 3-Phase Sinusoidal Voltage Traces
      // Phase A / R (Rose/Red)
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = visibleSamples[i];
        const px = getX(s.thetaDeg);
        const py = centerY1 - (s.vA ?? s.vs) * scaleV1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Phase B / Y (Amber/Yellow)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = visibleSamples[i];
        const px = getX(s.thetaDeg);
        const py = centerY1 - (s.vB ?? 0) * scaleV1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Phase C / B (Sky Blue)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = visibleSamples[i];
        const px = getX(s.thetaDeg);
        const py = centerY1 - (s.vC ?? 0) * scaleV1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Legend in corner of Plot 1
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('v_a (R)', paddingX + 6, y1 + h1 - 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('v_b (Y)', paddingX + 60, y1 + h1 - 6);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('v_c (B)', paddingX + 114, y1 + h1 - 6);

    } else {
      // Single-Phase Supply Voltage trace (Purple)
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = visibleSamples[i];
        const px = getX(s.thetaDeg);
        const py = centerY1 - s.vs * scaleV1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Gate pulses trace (Rose) - ONLY when user enables it
    if (showGatePulses) {
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = visibleSamples[i];
        const px = getX(s.thetaDeg);
        const isGateFired = is3Phase
          ? Boolean(s.gate1 || s.gate2 || s.gate3 || s.gate4 || s.gate5 || s.gate6)
          : Boolean(s.gate1 || s.gate2);
        const gVal = (isGateFired ? 1 : 0) * (h1 * 0.35);
        const py = centerY1 + (h1 * 0.45) - gVal;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillText('+Vm', 4, y1 + 12);
    ctx.fillText(' 0V', 4, centerY1 + 3);
    ctx.fillText('-Vm', 4, y1 + h1 - 3);

    // -------------------------------------------------------------
    // PLOT 2: Rectified Output Voltage v_o(t) + Optional GHOST & DASHED INPUT REF
    // -------------------------------------------------------------
    drawGraticule(ctx, paddingX, y2, graphWidth, h2, 8, 4);
    const centerY2 = y2 + h2 * 0.72;
    const scaleV2 = (h2 * 0.65) / maxVoltage;

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingX, centerY2);
    ctx.lineTo(paddingX + graphWidth, centerY2);
    ctx.stroke();

    ctx.fillStyle = '#06b6d4';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(
      showInputRef
        ? 'GRAPH 2: OUTPUT RECTIFIED VOLTAGE v_o(t) [MERGED DASHED v_in REF]'
        : 'GRAPH 2: OUTPUT RECTIFIED VOLTAGE v_o(t)',
      paddingX + 4,
      y2 + 12
    );
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`v_o: ${currentSample?.vo ?? 0} V | V_dc: ${insights.vDc} V`, paddingX + graphWidth - 180, y2 + 12);

    // Alpha firing marker
    const alphaX1 = getX(alpha);
    if (alphaX1 <= paddingX + graphWidth) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(alphaX1, y2);
      ctx.lineTo(alphaX1, y2 + h2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f43f5e';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(`α=${alpha}°`, alphaX1 + 3, y2 + 24);
    }

    if (insights.betaDeg > 180) {
      const betaX = getX(insights.betaDeg);
      if (betaX <= paddingX + graphWidth) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(betaX, y2);
        ctx.lineTo(betaX, y2 + h2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#f59e0b';
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.fillText(`β=${insights.betaDeg}°`, betaX + 3, y2 + 36);
      }
    }

    // Merged Dashed Input Reference Trace (v_s(t) or 3-Phase line-to-line envelopes)
    // Seamlessly merged with the output rectified voltage v_o(t)
    if (showInputRef) {
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);

      if (is3Phase) {
        // In 3-phase converters, the output voltage v_o(t) is synthesized directly
        // from the 6 line-to-line AC voltages: v_ab, v_ac, v_bc, v_ba, v_ca, v_cb.
        // Drawing all 6 line-to-line reference envelopes ensures v_o(t) traces and merges
        // on top of these sinusoids during conduction!

        // Phase Pair A-B: v_ab and v_ba
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const s = visibleSamples[i];
          const px = getX(s.thetaDeg);
          const vA = s.vA ?? s.vs;
          const vB = s.vB ?? 0;
          const py = centerY2 - (vA - vB) * scaleV2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const s = visibleSamples[i];
          const px = getX(s.thetaDeg);
          const vA = s.vA ?? s.vs;
          const vB = s.vB ?? 0;
          const py = centerY2 - (vB - vA) * scaleV2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Phase Pair B-C: v_bc and v_cb
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const s = visibleSamples[i];
          const px = getX(s.thetaDeg);
          const vB = s.vB ?? 0;
          const vC = s.vC ?? 0;
          const py = centerY2 - (vB - vC) * scaleV2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const s = visibleSamples[i];
          const px = getX(s.thetaDeg);
          const vB = s.vB ?? 0;
          const vC = s.vC ?? 0;
          const py = centerY2 - (vC - vB) * scaleV2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Phase Pair C-A: v_ca and v_ac
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const s = visibleSamples[i];
          const px = getX(s.thetaDeg);
          const vA = s.vA ?? s.vs;
          const vC = s.vC ?? 0;
          const py = centerY2 - (vC - vA) * scaleV2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const s = visibleSamples[i];
          const px = getX(s.thetaDeg);
          const vA = s.vA ?? s.vs;
          const vC = s.vC ?? 0;
          const py = centerY2 - (vA - vC) * scaleV2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        // Single Phase:
        // Draw +v_s(t) dashed (Purple dashed)
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const s = visibleSamples[i];
          const px = getX(s.thetaDeg);
          const py = centerY2 - s.vs * scaleV2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // For Full-Wave Bridge, Midpoint, and Semi-Converter:
        // Also draw inverted supply wave -v_s(t) dashed, so that during the negative half-cycle
        // the rectified output voltage v_o(t) merges and sits directly on top of the dashed envelope!
        if (topology !== 'half-wave') {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const s = visibleSamples[i];
            const px = getX(s.thetaDeg);
            const py = centerY2 - (-s.vs) * scaleV2;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // PINNED GHOST TRACE OVERLAY on Graph 2
    if (pinnedSnapshot && pinnedSnapshot.samples.length > 0) {
      const ghostSamples = pinnedSnapshot.samples.filter(s => s.thetaDeg <= maxTheta);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
      ctx.lineWidth = 1.75;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < ghostSamples.length; i++) {
        const gs = ghostSamples[i];
        const gpx = getX(gs.thetaDeg);
        const gpy = centerY2 - gs.vo * scaleV2;
        if (i === 0) ctx.moveTo(gpx, gpy);
        else ctx.lineTo(gpx, gpy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(paddingX + 6, y2 + 28, 190, 18);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(paddingX + 6, y2 + 28, 190, 18);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(`PINNED: α=${pinnedSnapshot.alpha}° (Vdc=${pinnedSnapshot.vDc}V)`, paddingX + 10, y2 + 40);
    }

    // Live Vo trace (Cyan)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const s = visibleSamples[i];
      const px = getX(s.thetaDeg);
      const py = centerY2 - s.vo * scaleV2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#64748b';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillText('+Vm', 4, y2 + 12);
    ctx.fillText(' 0V', 4, centerY2 + 3);
    ctx.fillText('-Vm', 4, y2 + h2 - 3);

    // -------------------------------------------------------------
    // PLOT 3: Output Current i_o(t) & Optional Supply Current i_s(t)
    // -------------------------------------------------------------
    drawGraticule(ctx, paddingX, y3, graphWidth, h3, 8, 4);
    const centerY3 = y3 + h3 * 0.72;
    const scaleI = (h3 * 0.65) / maxCurrent;

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingX, centerY3);
    ctx.lineTo(paddingX + graphWidth, centerY3);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(
      showInputCurrent
        ? 'GRAPH 3: LOAD CURRENT i_o(t) & INPUT CURRENT i_s(t)'
        : 'GRAPH 3: LOAD CURRENT i_o(t)',
      paddingX + 4,
      y3 + 12
    );
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      showInputCurrent
        ? `i_o: ${currentSample?.io ?? 0} A | i_s: ${currentSample?.is ?? 0} A`
        : `i_o: ${currentSample?.io ?? 0} A | I_dc: ${insights.iDc} A`,
      paddingX + graphWidth - 190,
      y3 + 12
    );

    // Supply current (Sky blue dashed) - ONLY when user enables it
    if (showInputCurrent) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = visibleSamples[i];
        const px = getX(s.thetaDeg);
        const py = centerY3 - s.is * scaleI;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Load current (Emerald)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const s = visibleSamples[i];
      const px = getX(s.thetaDeg);
      const py = centerY3 - s.io * scaleI;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#64748b';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillText(`+${Math.round(maxCurrent)}A`, 4, y3 + 12);
    ctx.fillText(' 0A', 4, centerY3 + 3);

    // -------------------------------------------------------------
    // SHARED TIME CURSOR LINE across all 3 graphs
    // -------------------------------------------------------------
    const cursorSample = samples[cursorSampleIndex];
    if (cursorSample && cursorSample.thetaDeg <= maxTheta) {
      const cx = getX(cursorSample.thetaDeg);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cx, y1);
      ctx.lineTo(cx, y3 + h3);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(cx - 5, y1);
      ctx.lineTo(cx + 5, y1);
      ctx.lineTo(cx, y1 + 7);
      ctx.closePath();
      ctx.fill();

      // Dot 1 on Vs
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(cx, centerY1 - cursorSample.vs * scaleV1, 4, 0, Math.PI * 2);
      ctx.fill();

      // Dot 2 on Vo
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(cx, centerY2 - cursorSample.vo * scaleV2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Dot 3 on Io
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(cx, centerY3 - cursorSample.io * scaleI, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Degree markings along bottom axis
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "IBM Plex Mono", monospace';
    const numMarkers = timeZoom === 2 ? 4 : 8;
    const yMarkers = height - conductionH - 4;
    for (let m = 0; m <= numMarkers; m++) {
      const deg = Math.round((m / numMarkers) * maxTheta);
      const mx = paddingX + (m / numMarkers) * graphWidth;
      ctx.fillText(`${deg}°`, mx - 6, yMarkers);
    }

    // -------------------------------------------------------------
    // CONDUCTION STATE TRACK AT BOTTOM OF GRAPH
    // -------------------------------------------------------------
    const yCond = height - conductionH - 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '8px "IBM Plex Mono", monospace';
    ctx.fillText('PATH:', 6, yCond + 13);

    conductionIntervals.forEach(inv => {
      const xStart = paddingX + (inv.startDeg / maxTheta) * graphWidth;
      const xEnd = paddingX + (inv.endDeg / maxTheta) * graphWidth;
      const w = Math.max(1, xEnd - xStart);

      if (inv.type === 'conduction') {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
        ctx.strokeStyle = '#06b6d4';
      } else if (inv.type === 'freewheel') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.strokeStyle = '#f59e0b';
      } else {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.strokeStyle = '#334155';
      }

      ctx.fillRect(xStart, yCond, w, conductionH);
      ctx.lineWidth = 1;
      ctx.strokeRect(xStart, yCond, w, conductionH);

      if (w > 18) {
        ctx.fillStyle = inv.type === 'conduction' ? '#67e8f9' : inv.type === 'freewheel' ? '#fde68a' : '#64748b';
        ctx.font = 'bold 9px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(inv.label, xStart + w / 2, yCond + 13);
        ctx.textAlign = 'left';
      }
    });

    // Active Cursor Marker on Conduction Track
    if (cursorSample && cursorSample.thetaDeg <= maxTheta) {
      const cx = getX(cursorSample.thetaDeg);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(cx - 1.5, yCond - 2, 3, conductionH + 4);
    }
  }, [samples, currentSample, visibleSamples, timeZoom, alpha, topology, insights, pinnedSnapshot, cursorSampleIndex, maxTheta, conductionIntervals, showGatePulses, showInputRef, showInputCurrent]);

  // =========================================================================
  // DRAW MODE 2: COMBINED SINGLE OVERLAY
  // =========================================================================
  const drawSingleOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    drawGraticule(ctx, 0, 0, width, height, 10, 8);

    const centerY = height / 2;
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    if (!samples || samples.length === 0) return;

    const n = visibleSamples.length;
    if (n < 2) return;

    const maxVoltage = Math.max(10, insights.vm * 1.3);
    const vScale = (height * 0.42) / maxVoltage;

    const alphaX1 = (alpha / maxTheta) * width;
    if (alphaX1 <= width) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(alphaX1, 0);
      ctx.lineTo(alphaX1, height);
      ctx.stroke();
      ctx.fillStyle = '#f43f5e';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(`α = ${alpha}°`, alphaX1 + 4, 18);
    }

    if (insights.betaDeg > 180) {
      const betaX = (insights.betaDeg / maxTheta) * width;
      if (betaX <= width) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(betaX, 0);
        ctx.lineTo(betaX, height);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText(`β = ${insights.betaDeg}°`, betaX + 4, 32);
      }
    }
    ctx.setLineDash([]);

    if (pinnedSnapshot && pinnedSnapshot.samples.length > 0) {
      const ghostSamples = pinnedSnapshot.samples.filter(s => s.thetaDeg <= maxTheta);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = 0; i < ghostSamples.length; i++) {
        const gs = ghostSamples[i];
        const gx = (i / (ghostSamples.length - 1)) * width;
        const gy = centerY - gs.vo * vScale;
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const getChannelVal = (chId: string, s: WaveformSample): number => {
      switch (chId) {
        case 'vo': return s.vo;
        case 'io': return s.io * 10;
        case 'vs': return s.vs;
        case 'vt': return s.vThyristor1;
        case 'vg': return (s.gate1 || s.gate2 ? 1 : 0) * (insights.vm * 0.45);
        case 'is': return s.is * 10;
        default: return 0;
      }
    };

    channels.forEach(ch => {
      if (!ch.visible) return;
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = ch.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = visibleSamples[i];
        const x = (i / (n - 1)) * width;
        const val = getChannelVal(ch.id, s);
        const y = centerY - val * vScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    const cursorSample = samples[cursorSampleIndex];
    if (cursorSample && cursorSample.thetaDeg <= maxTheta) {
      const cursorX = (cursorSample.thetaDeg / maxTheta) * width;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      channels.forEach(ch => {
        if (!ch.visible) return;
        const val = getChannelVal(ch.id, cursorSample);
        const cy = centerY - val * vScale;
        ctx.fillStyle = ch.color;
        ctx.beginPath();
        ctx.arc(cursorX, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    const conductionH = 20;
    const yMarkers = height - conductionH - 4;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "IBM Plex Mono", monospace';
    const numMarkers = timeZoom === 2 ? 4 : 8;
    for (let m = 0; m <= numMarkers; m++) {
      const deg = Math.round((m / numMarkers) * maxTheta);
      const mx = (m / numMarkers) * width;
      ctx.fillText(`${deg}°`, Math.min(width - 24, mx + 2), yMarkers);
    }

    const yCond = height - conductionH - 1;
    conductionIntervals.forEach(inv => {
      const xStart = (inv.startDeg / maxTheta) * width;
      const xEnd = (inv.endDeg / maxTheta) * width;
      const w = Math.max(1, xEnd - xStart);

      if (inv.type === 'conduction') {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.strokeStyle = '#06b6d4';
      } else if (inv.type === 'freewheel') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
        ctx.strokeStyle = '#f59e0b';
      } else {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.strokeStyle = '#334155';
      }

      ctx.fillRect(xStart, yCond, w, conductionH);
      ctx.lineWidth = 1;
      ctx.strokeRect(xStart, yCond, w, conductionH);

      if (w > 18) {
        ctx.fillStyle = inv.type === 'conduction' ? '#67e8f9' : inv.type === 'freewheel' ? '#fde68a' : '#64748b';
        ctx.font = 'bold 9px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(inv.label, xStart + w / 2, yCond + 13);
        ctx.textAlign = 'left';
      }
    });

    if (cursorSample && cursorSample.thetaDeg <= maxTheta) {
      const cx = (cursorSample.thetaDeg / maxTheta) * width;
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(cx - 1.5, yCond - 2, 3, conductionH + 4);
    }
  }, [samples, channels, visibleSamples, cursorSampleIndex, timeZoom, alpha, insights, pinnedSnapshot, maxTheta, conductionIntervals]);

  // DRAW MODE 3: FFT
  const drawFft = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const harmonics = insights.harmonics || [];
    if (harmonics.length === 0) return;

    const maxAmp = Math.max(1, ...harmonics.map(h => h.voltageAmp));
    const padX = 40;
    const padY = 30;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padY + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - padX, y);
      ctx.stroke();
      const labelVal = Math.round(maxAmp * (1 - i / 5));
      ctx.fillStyle = '#64748b';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(`${labelVal}V`, 8, y + 3);
    }

    const barWidth = Math.min(36, (chartW / harmonics.length) * 0.65);
    const slotW = chartW / harmonics.length;

    harmonics.forEach((h, idx) => {
      const x = padX + idx * slotW + (slotW - barWidth) / 2;
      const barH = (h.voltageAmp / maxAmp) * chartH;
      const y = padY + chartH - barH;

      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      if (h.order === 0) {
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
      } else if (h.order === 1) {
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, '#0891b2');
      } else {
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, '#b45309');
      }

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barH);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      const label = h.order === 0 ? 'DC' : `h${h.order}`;
      ctx.fillText(label, x + barWidth / 2, height - 12);

      if (barH > 14) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.fillText(`${Math.round(h.voltageAmp)}V`, x + barWidth / 2, y - 4);
      }
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = '#06b6d4';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(`THD(v): ${insights.thdVoltage}% | THD(i): ${insights.thdCurrent}%`, width - padX, 20);
    ctx.textAlign = 'left';
  }, [insights.harmonics, insights.thdVoltage, insights.thdCurrent]);

  // DRAW MODE 4: LISSAJOUS
  const drawLissajous = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText('v_s (Input Voltage) →', width - 140, cy - 8);
    ctx.fillText('↑ v_o (Output)', cx + 8, 20);

    const maxV = Math.max(10, insights.vm * 1.2);
    const scale = Math.min(width, height) * 0.42 / maxV;

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    samples.forEach((s, idx) => {
      const px = cx + s.vs * scale;
      const py = cy - s.vo * scale;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [samples, insights.vm]);

  useEffect(() => {
    if (viewMode === 'stacked') drawStackedWaveforms();
    else if (viewMode === 'waveform') drawSingleOverlay();
    else if (viewMode === 'fft') drawFft();
    else if (viewMode === 'lissajous') drawLissajous();
  }, [viewMode, drawStackedWaveforms, drawSingleOverlay, drawFft, drawLissajous]);

  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || (viewMode !== 'stacked' && viewMode !== 'waveform')) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const paddingX = viewMode === 'stacked' ? 42 : 0;
    const graphW = viewMode === 'stacked' ? rect.width - 42 - 16 : rect.width;
    const adjustedX = Math.max(0, Math.min(graphW, x - paddingX));
    const ratio = adjustedX / graphW;
    const targetTheta = ratio * maxTheta;

    const nearestIdx = samples.findIndex(s => s.thetaDeg >= targetTheta);
    if (nearestIdx !== -1) {
      setCursorSampleIndex(nearestIdx);
      if (isPlaying) setIsPlaying(false);
    }
  };

  const deltaVdc = pinnedSnapshot ? (insights.vDc - pinnedSnapshot.vDc).toFixed(1) : null;
  const deltaAlpha = pinnedSnapshot ? (alpha - pinnedSnapshot.alpha) : null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden"
    >
      {/* Scope Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 text-xs">
        {/* Left: Mode Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('stacked')}
            className={`flex items-center gap-1.5 px-3 py-1 font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === 'stacked'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Show 3 separate synchronized graphs (Vs & Gate, Vo Rectified, Io & Is Current) in a single oscilloscope screen"
          >
            <Layers size={13} />
            <span>Stacked 3-Plot (All-in-One)</span>
          </button>
          <button
            onClick={() => setViewMode('waveform')}
            className={`flex items-center gap-1.5 px-3 py-1 font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === 'waveform'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={13} />
            <span>Combined Overlay</span>
          </button>
          <button
            onClick={() => setViewMode('fft')}
            className={`px-3 py-1 font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === 'fft'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            FFT / Harmonics
          </button>
          <button
            onClick={() => setViewMode('lissajous')}
            className={`px-3 py-1 font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === 'lissajous'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            X-Y Mode
          </button>
        </div>

        {/* Center: Pinned Ghost Waveform Controls */}
        <div className="flex items-center gap-2">
          {pinnedSnapshot ? (
            <div className="flex items-center gap-2 bg-cyan-950/70 border border-cyan-800/80 rounded-lg px-2.5 py-1 text-cyan-200 font-mono text-[11px]">
              <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                <Pin size={11} />
                Ghost α={pinnedSnapshot.alpha}°
              </span>
              <span className="text-slate-500">·</span>
              <span>ΔVdc: <strong className={Number(deltaVdc) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{Number(deltaVdc) > 0 ? `+${deltaVdc}` : deltaVdc}V</strong></span>
              <span className="text-slate-500">·</span>
              <span>Δα: <strong className="text-amber-300">{deltaAlpha && deltaAlpha > 0 ? `+${deltaAlpha}` : deltaAlpha}°</strong></span>
              
              <button
                onClick={onPinCurrent}
                className="text-[10px] bg-cyan-800/60 hover:bg-cyan-700/80 text-cyan-100 px-1.5 py-0.5 rounded transition-colors ml-1"
                title="Re-pin to current angle"
              >
                Re-pin
              </button>
              <button
                onClick={onClearPin}
                className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors"
                title="Clear pinned ghost waveform"
              >
                <PinOff size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={onPinCurrent}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors shadow-sm"
              title="Pin current waveform to compare as a ghost trace when adjusting firing angles"
            >
              <Pin size={12} className="text-cyan-400" />
              <span>Pin Ghost Trace</span>
            </button>
          )}

          {/* Run/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold text-xs transition-colors ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'PAUSE' : 'RUN'}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCursorSampleIndex(0);
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 rounded-md border border-slate-700/50"
            title="Reset sweep"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Right: Time Zoom */}
        {(viewMode === 'stacked' || viewMode === 'waveform') && (
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setTimeZoom(1)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                timeZoom === 1 ? 'bg-slate-800 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2 Cycles (720°)
            </button>
            <button
              onClick={() => setTimeZoom(2)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                timeZoom === 2 ? 'bg-slate-800 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1 Cycle (360°)
            </button>
          </div>
        )}
      </div>

      {/* Waveform Trace Layers Ribbon: User can toggle Gate Pulses, Dashed Input Ref, and Input Current */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-slate-950/95 border-b border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-medium text-[11px] mr-1">Trace Toggles:</span>

          {/* 1. Gate Pulses Toggle (default OFF) */}
          <button
            onClick={() => setShowGatePulses(!showGatePulses)}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded border transition-colors font-mono ${
              showGatePulses
                ? 'bg-rose-950/70 text-rose-300 border-rose-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
            title="Toggle gate trigger pulses on Graph 1 (Hidden by default)"
          >
            <Zap size={11} className={showGatePulses ? 'text-rose-400' : 'text-slate-500'} />
            <span>Gate Pulses</span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${showGatePulses ? 'bg-rose-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {showGatePulses ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* 2. Merged Dashed Input Ref in Output Waveform */}
          <button
            onClick={() => setShowInputRef(!showInputRef)}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded border transition-colors font-mono ${
              showInputRef
                ? 'bg-purple-950/70 text-purple-300 border-purple-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
            title="Toggle merged dashed AC input reference in Graph 2 output waveform"
          >
            <span className="w-2.5 border-b-2 border-dashed border-current" />
            <span>Merged Input Ref</span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${showInputRef ? 'bg-purple-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {showInputRef ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* 3. Input Current is(t) Toggle (default OFF) */}
          <button
            onClick={() => setShowInputCurrent(!showInputCurrent)}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded border transition-colors font-mono ${
              showInputCurrent
                ? 'bg-sky-950/70 text-sky-300 border-sky-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
            title="Show dashed input supply current i_s in Graph 3 (Hidden by default)"
          >
            <span className="w-2.5 border-b-2 border-dashed border-current" />
            <span>Input Current (i_s)</span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${showInputCurrent ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {showInputCurrent ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-400 font-mono text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> v_o
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> i_o
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400" /> v_s
          </span>
        </div>
      </div>

      {/* Screen Canvas Container */}
      <div className="relative w-full h-[380px] md:h-[450px] bg-[#090d16] select-none">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasInteraction}
          onMouseMove={e => {
            if (e.buttons === 1) handleCanvasInteraction(e);
          }}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Floating Calibration Graticule Legend */}
        <div className="absolute top-2 left-3 flex items-center gap-3 text-[10px] font-mono text-slate-400 pointer-events-none bg-slate-950/70 backdrop-blur-sm px-2 py-1 rounded border border-slate-800/80">
          <span>TIME: {insights.periodMs} ms/cycle</span>
          <span>·</span>
          <span>Vm: {insights.vm} V</span>
          <span>·</span>
          <span className="text-cyan-400">θ = {currentSample?.thetaDeg}° ({currentSample?.timeMs} ms)</span>
          {pinnedSnapshot && (
            <>
              <span>·</span>
              <span className="text-slate-300 font-medium">Ghost Trace Active</span>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONDUCTION TIMELINE & DEVICE STATUS (Directly Below the Graph)            */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-2 p-3 bg-slate-950 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-cyan-400" />
            <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
              Conduction Path
            </span>
          </div>

          {/* Instantaneous state at cursor */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-500">θ={currentSample?.thetaDeg}°:</span>
            {currentSample?.activeThyristors && currentSample.activeThyristors.length > 0 ? (
              (() => {
                const isFwd = currentSample.activeThyristors.includes('FWD') ||
                              currentSample.activeThyristors.includes('FREEWHEEL') ||
                              (currentSample.activeThyristors.includes('D1') && currentSample.activeThyristors.includes('D4')) ||
                              (currentSample.activeThyristors.includes('D3') && currentSample.activeThyristors.includes('D2'));
                return (
                  <span className={`px-2 py-0.5 rounded font-bold font-mono text-[11px] flex items-center gap-1.5 ${
                    isFwd
                      ? 'text-amber-200 bg-amber-950/80 border border-amber-600/70 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                      : 'text-cyan-200 bg-cyan-950/80 border border-cyan-600/70 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isFwd ? 'bg-amber-400' : 'bg-cyan-400'} animate-ping`} />
                    {currentSample.activeThyristors.join(',')} ({currentSample.io.toFixed(1)}A)
                  </span>
                );
              })()
            ) : (
              <span className="px-2 py-0.5 rounded text-slate-400 bg-slate-900 border border-slate-800 text-[11px]">
                OFF (0A)
              </span>
            )}
          </div>
        </div>

        {/* Timeline Bar with compact labels (e.g. T1,D2 or D1,D4) */}
        <div className="relative w-full h-7 bg-slate-950 rounded-md border border-slate-800 overflow-hidden flex shadow-inner cursor-pointer" title="Click any phase to jump cursor">
          {conductionIntervals.map((inv, idx) => {
            const widthPct = ((inv.endDeg - inv.startDeg) / maxTheta) * 100;
            if (widthPct <= 0) return null;

            let bgColor = 'bg-slate-900/40 text-slate-500 hover:bg-slate-900/80';
            let borderColor = 'border-slate-850';

            if (inv.type === 'conduction') {
              bgColor = 'bg-cyan-950/80 text-cyan-200 hover:bg-cyan-900/80';
              borderColor = 'border-cyan-800/80 shadow-[inset_0_0_8px_rgba(6,182,212,0.2)]';
            } else if (inv.type === 'freewheel') {
              bgColor = 'bg-amber-950/80 text-amber-200 hover:bg-amber-900/80';
              borderColor = 'border-amber-800/80 shadow-[inset_0_0_8px_rgba(245,158,11,0.2)]';
            }

            return (
              <div
                key={idx}
                style={{ width: `${widthPct}%` }}
                onClick={() => {
                  const targetIdx = samples.findIndex(s => s.thetaDeg >= inv.startDeg);
                  if (targetIdx !== -1) {
                    setCursorSampleIndex(targetIdx);
                    setIsPlaying(false);
                  }
                }}
                className={`h-full flex items-center justify-center text-[10px] font-mono font-bold border-r ${borderColor} ${bgColor} px-0.5 transition-all truncate select-none`}
                title={`${inv.startDeg}° - ${inv.endDeg}°: ${inv.label}`}
              >
                <span className="truncate">{inv.label}</span>
              </div>
            );
          })}

          {/* Real-time Cursor Needle on the timeline */}
          <div
            style={{ left: `${(currentSample.thetaDeg / maxTheta) * 100}%` }}
            className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_8px_#22d3ee] pointer-events-none transition-all duration-75"
          />
        </div>

        {/* Streamlined Live Semiconductor Devices Strip */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] pt-0.5">
          <span className="text-slate-500 mr-1 text-[11px] font-sans">Devices:</span>

          {/* Arm 1 */}
          {(() => {
            const is1 = currentSample?.activeThyristors?.some(n => n.includes('1'));
            return (
              <span className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                is1 ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.25)]' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${is1 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                {is3Phase ? 'T1/D1 (R+)' : 'T1/D1'}: {is1 ? 'ON' : 'OFF'}
              </span>
            );
          })()}

          {/* Arm 4 */}
          {(() => {
            const is4 = currentSample?.activeThyristors?.some(n => n.includes('4'));
            return (
              <span className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                is4 ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.25)]' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${is4 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                {is3Phase ? 'T4/D4 (R-)' : 'T4/D4'}: {is4 ? 'ON' : 'OFF'}
              </span>
            );
          })()}

          {/* Arm 3 */}
          {(() => {
            const is3 = currentSample?.activeThyristors?.some(n => n.includes('3'));
            return (
              <span className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                is3 ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.25)]' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${is3 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                {is3Phase ? 'T3/D3 (Y+)' : 'T3/D3'}: {is3 ? 'ON' : 'OFF'}
              </span>
            );
          })()}

          {/* Arm 6 (3-Phase) */}
          {is3Phase && (() => {
            const is6 = currentSample?.activeThyristors?.some(n => n.includes('6'));
            return (
              <span className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                is6 ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.25)]' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${is6 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                T6/D6 (Y-): {is6 ? 'ON' : 'OFF'}
              </span>
            );
          })()}

          {/* Arm 5 (3-Phase) */}
          {is3Phase && (() => {
            const is5 = currentSample?.activeThyristors?.some(n => n.includes('5'));
            return (
              <span className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                is5 ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.25)]' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${is5 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                T5/D5 (B+): {is5 ? 'ON' : 'OFF'}
              </span>
            );
          })()}

          {/* Arm 2 */}
          {(() => {
            const is2 = currentSample?.activeThyristors?.some(n => n.includes('2'));
            return (
              <span className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                is2 ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.25)]' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${is2 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                {is3Phase ? 'T2/D2 (B-)' : 'T2/D2'}: {is2 ? 'ON' : 'OFF'}
              </span>
            );
          })()}

          {/* FWD Diode */}
          {(() => {
            const isFwd = currentSample?.activeThyristors?.includes('FWD') || currentSample?.activeThyristors?.includes('FREEWHEEL');
            return (
              <span className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                isFwd ? 'bg-amber-950/80 border-amber-500/80 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.25)]' : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isFwd ? 'bg-amber-400' : 'bg-slate-600'}`} />
                FWD: {isFwd ? 'ON' : 'OFF'}
              </span>
            );
          })()}

          {/* Clean Color Legend */}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-cyan-400" />
              Active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-amber-400" />
              FWD
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-slate-700" />
              OFF
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Channel Trace Strips with Live Values (Shown in Combined Mode) */}
      {viewMode === 'waveform' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-950/90 border-t border-slate-800">
          {channels.map(ch => {
            let instantaneousVal = '';
            switch (ch.id) {
              case 'vo': instantaneousVal = `${currentSample?.vo ?? 0} V`; break;
              case 'io': instantaneousVal = `${currentSample?.io ?? 0} A`; break;
              case 'vs': instantaneousVal = `${currentSample?.vs ?? 0} V`; break;
              case 'vt': instantaneousVal = `${currentSample?.vThyristor1 ?? 0} V`; break;
              case 'vg': instantaneousVal = currentSample?.gate1 || currentSample?.gate2 ? 'PULSE' : 'LOW'; break;
              case 'is': instantaneousVal = `${currentSample?.is ?? 0} A`; break;
            }

            return (
              <button
                key={ch.id}
                onClick={() => toggleChannel(ch.id)}
                className={`flex flex-col text-left p-2 rounded-lg border transition-all ${
                  ch.visible
                    ? 'bg-slate-900 border-slate-700/80 hover:border-slate-600 shadow-sm'
                    : 'bg-slate-950/60 border-slate-850 opacity-40 hover:opacity-60'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ch.color, boxShadow: ch.visible ? `0 0 6px ${ch.color}` : 'none' }}
                    />
                    <span className="text-[11px] font-semibold text-slate-300 truncate">
                      {ch.name}
                    </span>
                  </div>
                  {ch.visible ? <Eye size={12} className="text-slate-400 shrink-0" /> : <EyeOff size={12} className="text-slate-600 shrink-0" />}
                </div>
                <div className="font-mono text-xs font-semibold" style={{ color: ch.visible ? ch.color : '#64748b' }}>
                  {instantaneousVal}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* In Stacked Mode: Sub-plot legend bar */}
      {viewMode === 'stacked' && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              Graph 1: v_s(t) Supply
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
              Graph 2: v_o(t) Rectified Output
            </span>
            {pinnedSnapshot && (
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-0.5 bg-slate-200 border-dashed border-t border-slate-400" />
                Ghost Trace (α={pinnedSnapshot.alpha}°)
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Graph 3: i_o(t) Load Current
            </span>
          </div>
          <div className="text-slate-500">
            Click / drag cursor across any graph to inspect synchronized time-domain coordinates.
          </div>
        </div>
      )}
    </div>
  );
};
