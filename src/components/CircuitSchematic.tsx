import React from 'react';
import { CircuitSwitchesConfig, LoadType, SwitchDeviceType, TopologyType, WaveformSample } from '../types/rectifier';
import { Cpu, Activity } from 'lucide-react';

interface CircuitSchematicProps {
  topology: TopologyType;
  loadType: LoadType;
  alpha: number;
  rVal: number;
  lVal: number;
  eVal: number;
  hasFwd: boolean;
  switches: CircuitSwitchesConfig;
  onUpdateSwitch: (arm: 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 'fwd', newType: SwitchDeviceType) => void;
  onApplySwitchPreset: (preset: CircuitSwitchesConfig) => void;
  currentSample?: WaveformSample;
  highlightedProbe?: string | null;
  onSelectProbe?: (probeId: string | null) => void;
}

export const CircuitSchematic: React.FC<CircuitSchematicProps> = ({
  topology,
  loadType,
  rVal,
  lVal,
  eVal,
  hasFwd,
  switches,
  onUpdateSwitch,
  onApplySwitchPreset,
  currentSample,
}) => {
  const is3Phase = topology === 'three-phase-full' || topology === 'three-phase-semi';

  const activeThyristors = currentSample?.activeThyristors || [];
  const isS1On = activeThyristors.some(n => n.includes('1'));
  const isS2On = activeThyristors.some(n => n.includes('2'));
  const isS3On = activeThyristors.some(n => n.includes('3'));
  const isS4On = activeThyristors.some(n => n.includes('4'));
  const isS5On = activeThyristors.some(n => n.includes('5'));
  const isS6On = activeThyristors.some(n => n.includes('6'));
  const isFwdOn = activeThyristors.includes('FWD') || activeThyristors.includes('FREEWHEEL');
  const isLeg1Freewheel = (topology === 'semi-converter' || (switches.s1 === 'diode' && switches.s4 === 'diode')) && ((activeThyristors.includes('D1') && activeThyristors.includes('D4')) || (isS1On && isS4On && activeThyristors.length === 2 && !isS2On && !isS3On && !isS5On && !isS6On));
  const isLeg2Freewheel = (topology === 'semi-converter' || (switches.s3 === 'diode' && switches.s2 === 'diode')) && ((activeThyristors.includes('D3') && activeThyristors.includes('D2')) || (isS3On && isS2On && activeThyristors.length === 2 && !isS1On && !isS4On && !isS5On && !isS6On));

  // 3-Phase freewheel pairs (e.g. T1,D4 or T3,D6 or T5,D2)
  const is3PhaseFreewheelA = is3Phase && (isS1On && isS4On);
  const is3PhaseFreewheelB = is3Phase && (isS3On && isS6On);
  const is3PhaseFreewheelC = is3Phase && (isS5On && isS2On);
  const is3PhaseFreewheel = is3Phase && (is3PhaseFreewheelA || is3PhaseFreewheelB || is3PhaseFreewheelC || isFwdOn);

  const hasInductor = loadType !== 'R';
  const hasEmf = loadType === 'RLE';
  const showFwd = switches.fwd === 'diode' || hasFwd || loadType === 'RL_FWD' || topology === 'semi-converter' || topology === 'three-phase-semi';
  const currentMagnitude = currentSample?.io ?? 0;
  const isCurrentFlowing = currentMagnitude > 0.005;

  // Cycle switch type: thyristor -> diode -> removed -> thyristor
  const cycleSwitch = (arm: 's1' | 's2' | 's3' | 's4' | 's5' | 's6') => {
    const cur = switches[arm] || 'thyristor';
    if (cur === 'thyristor') onUpdateSwitch(arm, 'diode');
    else if (cur === 'diode') onUpdateSwitch(arm, 'removed');
    else onUpdateSwitch(arm, 'thyristor');
  };

  const cycleFwd = () => {
    onUpdateSwitch('fwd', switches.fwd === 'diode' ? 'removed' : 'diode');
  };

  // Render SVG semiconductor symbol (Thyristor / Diode / Removed)
  // Orientation: Anode at bottom (or input), Cathode pointing towards output rail (UPWARDS)
  const renderSwitchComponent = (
    armKey: 's1' | 's2' | 's3' | 's4' | 's5' | 's6',
    x: number,
    y: number,
    labelBase: string,
    isOn: boolean,
    rotation: number = 0
  ) => {
    const type = switches[armKey] || 'thyristor';
    const isRemoved = type === 'removed';
    const isDiode = type === 'diode';
    const isThyristor = type === 'thyristor';

    const strokeColor = isRemoved ? '#ef4444' : isOn ? '#22d3ee' : '#64748b';
    const fillColor = isOn ? 'rgba(6, 182, 212, 0.45)' : 'rgba(30, 41, 59, 0.5)';
    const glowClass = isOn ? 'drop-shadow-[0_0_12px_rgba(34,211,238,0.95)]' : '';

    const deviceName = isDiode ? labelBase.replace('T', 'D') : labelBase;
    const deviceTypeLabel = isRemoved ? 'Open' : isDiode ? 'Diode' : 'SCR';

    return (
      <g
        transform={`translate(${x}, ${y})`}
        className={`cursor-pointer group transition-all duration-150 ${glowClass}`}
        onClick={() => cycleSwitch(armKey)}
      >
        <g transform={`rotate(${rotation})`}>
          {isRemoved ? (
            /* Open circuit gap with disconnected red terminals */
            <g>
              <line x1="0" y1="-18" x2="0" y2="-7" stroke="#64748b" strokeWidth="2.5" />
              <circle cx="0" cy="-7" r="3.5" fill="#0f172a" stroke="#ef4444" strokeWidth="2" />
              <line x1="0" y1="7" x2="0" y2="18" stroke="#64748b" strokeWidth="2.5" />
              <circle cx="0" cy="7" r="3.5" fill="#0f172a" stroke="#ef4444" strokeWidth="2" />
              <line x1="-5" y1="-5" x2="5" y2="5" stroke="#ef4444" strokeWidth="1.5" />
              <line x1="5" y1="-5" x2="-5" y2="5" stroke="#ef4444" strokeWidth="1.5" />
            </g>
          ) : (
            /* Diode or SCR pointing UPWARDS into cathode bar */
            <g>
              {isOn && (
                <circle cx="0" cy="0" r="18" fill="rgba(6, 182, 212, 0.25)" className="animate-pulse" />
              )}
              <polygon
                points="-13,13 13,13 0,-13"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isOn ? '3.5' : '2.5'}
                strokeLinejoin="round"
              />
              <line
                x1="-13"
                y1="-13"
                x2="13"
                y2="-13"
                stroke={strokeColor}
                strokeWidth={isOn ? '4' : '3'}
                strokeLinecap="round"
              />
              {isThyristor && (
                <path
                  d="M 6,-11 L 16,-20"
                  fill="none"
                  stroke={isOn ? '#f43f5e' : '#94a3b8'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}
              {isOn && (
                <circle cx="0" cy="0" r="2.5" fill="#ffffff" className="animate-ping" />
              )}
            </g>
          )}
        </g>

        {/* Compact Device Status Badge */}
        <g transform={`translate(${rotation === 0 ? 20 : 0}, ${rotation === 0 ? -2 : 28})`}>
          <rect
            x="-3"
            y="-8"
            width={isOn ? 76 : 68}
            height="16"
            rx="3"
            fill={isOn ? 'rgba(8, 51, 68, 0.95)' : 'rgba(15, 23, 42, 0.9)'}
            stroke={isRemoved ? '#ef4444' : isOn ? '#22d3ee' : isDiode ? '#10b981' : '#06b6d4'}
            strokeWidth={isOn ? '1.5' : '1'}
            className="group-hover:fill-slate-800 transition-colors"
          />
          <text
            x="2"
            y="3.5"
            fill={isRemoved ? '#f87171' : isOn ? '#67e8f9' : isDiode ? '#34d399' : '#38bdf8'}
            fontSize="9"
            fontWeight={isOn ? '700' : '600'}
            className="font-mono select-none"
          >
            {deviceName}: {deviceTypeLabel}
          </text>
        </g>
      </g>
    );
  };

  // Render Load branch
  const renderLoadBranch = (x: number, yTop: number, yBottom: number) => {
    const isLoadActive = (currentSample?.io ?? 0) > 0.005;
    const loadColor = isLoadActive ? '#38bdf8' : '#64748b';

    return (
      <g className="transition-colors duration-150">
        <line x1={x} y1={yTop} x2={x} y2={yTop + 24} stroke={loadColor} strokeWidth="2.5" />
        <circle cx={x} cy={yTop} r="3.5" fill="#64748b" />

        {/* Resistor R */}
        <rect
          x={x - 12}
          y={yTop + 24}
          width="24"
          height="40"
          fill="rgba(15, 23, 42, 0.9)"
          stroke={loadColor}
          strokeWidth="2.5"
          rx="3"
        />
        <text
          x={x + 18}
          y={yTop + 48}
          fill="#cbd5e1"
          fontSize="10"
          fontWeight="500"
          className="font-mono select-none"
        >
          R = {rVal}Ω
        </text>

        {/* Inductor L */}
        {hasInductor ? (
          <>
            <line x1={x} y1={yTop + 64} x2={x} y2={yTop + 80} stroke={loadColor} strokeWidth="2.5" />
            <g transform={`translate(${x}, ${yTop + 80})`}>
              <path
                d="M 0,0 C -12,0 -12,12 0,12 C -12,12 -12,24 0,24 C -12,24 -12,36 0,36 C -12,36 -12,48 0,48"
                fill="none"
                stroke={loadColor}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <text
                x="18"
                y="28"
                fill="#cbd5e1"
                fontSize="10"
                fontWeight="500"
                className="font-mono select-none"
              >
                {loadType === 'HIGHLY_INDUCTIVE' ? 'L → ∞' : `L = ${lVal}mH`}
              </text>
            </g>
            {/* Connect bottom of inductor cleanly along x={x} to EMF or bottom rail y2={yBottom} */}
            <line x1={x} y1={yTop + 128} x2={x} y2={hasEmf ? yTop + 144 : yBottom} stroke={loadColor} strokeWidth="2.5" />
          </>
        ) : (
          <line x1={x} y1={yTop + 64} x2={x} y2={hasEmf ? yTop + 88 : yBottom} stroke={loadColor} strokeWidth="2.5" />
        )}

        {/* DC Source / Back-EMF E */}
        {hasEmf && (
          <g transform={`translate(${x}, ${hasInductor ? yTop + 144 : yTop + 88})`}>
            {/* Top connection wire entering positive terminal */}
            <line x1="0" y1="0" x2="0" y2="8" stroke={loadColor} strokeWidth="2.5" />
            <line x1="-14" y1="8" x2="14" y2="8" stroke={loadColor} strokeWidth="3" strokeLinecap="round" />
            <text x="18" y="10" fill="#f43f5e" fontSize="9" fontWeight="700">+</text>
            <line x1="-8" y1="20" x2="8" y2="20" stroke={loadColor} strokeWidth="4" strokeLinecap="round" />
            <text x="18" y="22" fill="#94a3b8" fontSize="9" fontWeight="700">-</text>
            <text
              x="26"
              y="16"
              fill="#cbd5e1"
              fontSize="10"
              fontWeight="500"
              className="font-mono select-none"
            >
              E = {eVal}V
            </text>
            {/* Bottom connection wire leaving negative terminal down to yBottom */}
            <line x1="0" y1="20" x2="0" y2={yBottom - (hasInductor ? yTop + 144 : yTop + 88)} stroke={loadColor} strokeWidth="2.5" />
          </g>
        )}

        <circle cx={x} cy={yBottom} r="3.5" fill="#64748b" />
      </g>
    );
  };

  // Render Freewheeling Diode branch
  const renderFwdBranch = (x: number, yTop: number, yBottom: number) => {
    const isRemoved = switches.fwd === 'removed';
    const strokeColor = isRemoved ? '#ef4444' : isFwdOn ? '#f59e0b' : '#64748b';
    const fillColor = isFwdOn ? 'rgba(245, 158, 11, 0.45)' : 'rgba(30, 41, 59, 0.5)';
    const midY = (yTop + yBottom) / 2;

    return (
      <g className="cursor-pointer group" onClick={cycleFwd}>
        <line x1={x} y1={yTop} x2={x} y2={midY - 14} stroke={strokeColor} strokeWidth="2.5" />
        <g transform={`translate(${x}, ${midY})`}>
          {isRemoved ? (
            <g>
              <line x1="0" y1="-16" x2="0" y2="-6" stroke="#475569" strokeWidth="2.5" />
              <circle cx="0" cy="-6" r="3" fill="none" stroke="#ef4444" strokeWidth="2" />
              <line x1="0" y1="6" x2="0" y2="16" stroke="#475569" strokeWidth="2.5" />
              <circle cx="0" cy="6" r="3" fill="none" stroke="#ef4444" strokeWidth="2" />
            </g>
          ) : (
            <g>
              {isFwdOn && (
                <circle cx="0" cy="0" r="18" fill="rgba(245, 158, 11, 0.25)" className="animate-pulse" />
              )}
              <polygon
                points="-13,13 13,13 0,-13"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isFwdOn ? '3.5' : '2.5'}
                strokeLinejoin="round"
              />
              <line x1="-13" y1="-13" x2="13" y2="-13" stroke={strokeColor} strokeWidth={isFwdOn ? '4' : '3'} strokeLinecap="round" />
              {isFwdOn && <circle cx="0" cy="0" r="3" fill="#f59e0b" className="animate-ping" />}
            </g>
          )}
        </g>
        <line x1={x} y1={midY + 14} x2={x} y2={yBottom} stroke={strokeColor} strokeWidth="2.5" />

        <g transform={`translate(${x - 30}, ${midY + 4})`}>
          <rect
            x="-3"
            y="-7"
            width="60"
            height="14"
            rx="3"
            fill="rgba(15, 23, 42, 0.9)"
            stroke={isRemoved ? '#ef4444' : isFwdOn ? '#f59e0b' : '#06b6d4'}
            strokeWidth="1"
            className="group-hover:fill-slate-800 transition-colors"
          />
          <text
            x="2"
            y="3.5"
            fill={isRemoved ? '#f87171' : isFwdOn ? '#fde68a' : '#38bdf8'}
            fontSize="9"
            fontWeight="600"
            className="font-mono select-none"
          >
            {isRemoved ? 'FWD: None' : 'FWD Diode'}
          </text>
        </g>
      </g>
    );
  };

  return (
    <div className="relative w-full bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-xl overflow-hidden flex flex-col gap-3">
      {/* Top Header Bar with Live Conduction State & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-cyan-400" />
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
            {is3Phase ? '3-Phase Rectifier Schematic' : 'Single-Phase Rectifier Schematic'}
          </span>
          <span className="text-slate-500">·</span>
          {isCurrentFlowing ? (
            <span className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 ${
              is3PhaseFreewheel || isLeg1Freewheel || isLeg2Freewheel || isFwdOn
                ? 'text-amber-300 bg-amber-950/80 border border-amber-800/80 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                : 'text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 shadow-[0_0_8px_rgba(6,182,212,0.35)]'
            }`}>
              <span className={`w-2 h-2 rounded-full ${is3PhaseFreewheel || isFwdOn ? 'bg-amber-400' : 'bg-cyan-400'} animate-ping`} />
              {activeThyristors.join(',')} ({currentMagnitude.toFixed(2)} A)
            </span>
          ) : (
            <span className="font-mono text-slate-400 font-medium bg-slate-800/80 px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              ALL DEVICES BLOCKING (0 A)
            </span>
          )}
        </div>

        {/* Quick Component Switcher Presets */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-mono text-[11px]">Presets:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {is3Phase ? (
              <>
                <button
                  onClick={() =>
                    onApplySwitchPreset({
                      s1: 'thyristor',
                      s2: 'thyristor',
                      s3: 'thyristor',
                      s4: 'thyristor',
                      s5: 'thyristor',
                      s6: 'thyristor',
                      fwd: 'removed',
                    })
                  }
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 px-2 py-0.5 rounded border border-slate-700 transition-colors"
                >
                  3Φ All SCRs
                </button>
                <button
                  onClick={() =>
                    onApplySwitchPreset({
                      s1: 'thyristor',
                      s2: 'diode',
                      s3: 'thyristor',
                      s4: 'diode',
                      s5: 'thyristor',
                      s6: 'diode',
                      fwd: 'diode',
                    })
                  }
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded border border-slate-700 font-semibold transition-colors shadow-sm"
                >
                  3Φ Semi (Top SCR, Bottom Diode)
                </button>
                <button
                  onClick={() =>
                    onApplySwitchPreset({
                      s1: 'diode',
                      s2: 'diode',
                      s3: 'diode',
                      s4: 'diode',
                      s5: 'diode',
                      s6: 'diode',
                      fwd: 'removed',
                    })
                  }
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 transition-colors"
                >
                  3Φ All Diodes
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() =>
                    onApplySwitchPreset({
                      s1: 'thyristor',
                      s2: 'thyristor',
                      s3: 'thyristor',
                      s4: 'thyristor',
                      s5: 'removed',
                      s6: 'removed',
                      fwd: 'removed',
                    })
                  }
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 px-2 py-0.5 rounded border border-slate-700 transition-colors"
                >
                  All SCRs
                </button>
                <button
                  onClick={() =>
                    onApplySwitchPreset({
                      s1: 'diode',
                      s2: 'thyristor',
                      s3: 'thyristor',
                      s4: 'diode',
                      s5: 'removed',
                      s6: 'removed',
                      fwd: 'removed',
                    })
                  }
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded border border-slate-700 font-semibold transition-colors"
                >
                  D1,D4 Diode Leg (Freewheel)
                </button>
                <button
                  onClick={() =>
                    onApplySwitchPreset({
                      s1: 'thyristor',
                      s2: 'diode',
                      s3: 'thyristor',
                      s4: 'diode',
                      s5: 'removed',
                      s6: 'removed',
                      fwd: 'diode',
                    })
                  }
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-300 px-2 py-0.5 rounded border border-slate-700 transition-colors"
                >
                  Semi-Converter
                </button>
                <button
                  onClick={() =>
                    onApplySwitchPreset({
                      s1: 'diode',
                      s2: 'diode',
                      s3: 'diode',
                      s4: 'diode',
                      s5: 'removed',
                      s6: 'removed',
                      fwd: 'removed',
                    })
                  }
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 transition-colors"
                >
                  All Diodes
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SVG Canvas with Animated Current Flow Overlay */}
      <div className="w-full flex justify-center items-center overflow-x-auto py-1">
        <svg
          viewBox="0 0 680 300"
          className="w-full max-w-[680px] h-auto select-none"
          style={{ minWidth: '460px' }}
        >
          <defs>
            <style>
              {`
                @keyframes marchCurrentFlow {
                  from { stroke-dashoffset: 28; }
                  to { stroke-dashoffset: 0; }
                }
                .anim-current-flow {
                  stroke-dasharray: 8 6;
                  animation: marchCurrentFlow 0.5s linear infinite;
                }
                .anim-fwd-flow {
                  stroke-dasharray: 8 6;
                  animation: marchCurrentFlow 0.5s linear infinite;
                }
              `}
            </style>
          </defs>

          {/* ======================================================== */}
          {/* TOPOLOGY: 3-PHASE BRIDGE (6 ARMS: T1..T6 / D1..D6)       */}
          {/* ======================================================== */}
          {is3Phase && (
            <g>
              {/* 3-Phase AC Terminals */}
              <g transform="translate(45, 110)">
                <circle cx="0" cy="0" r="16" fill="rgba(244, 63, 94, 0.2)" stroke="#f43f5e" strokeWidth="2" />
                <text x="0" y="4" fill="#f43f5e" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">R</text>
              </g>
              <g transform="translate(45, 160)">
                <circle cx="0" cy="0" r="16" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="2" />
                <text x="0" y="4" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">Y</text>
              </g>
              <g transform="translate(45, 210)">
                <circle cx="0" cy="0" r="16" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="2" />
                <text x="0" y="4" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">B</text>
              </g>

              {/* Phase connection wires to bridge legs with explicit jumper arches */}
              {/* Phase R (A) -> Leg 1 midpoint (x=175, y=160) - enters cleanly */}
              <path d="M 61,110 L 135,110 L 135,160 L 175,160" fill="none" stroke="#f43f5e" strokeWidth="2.5" />
              <circle cx="175" cy="160" r="3.5" fill="#f43f5e" stroke="#0f172a" strokeWidth="1" />

              {/* Phase Y (B) -> Leg 2 midpoint (x=275, y=160) - jumps OVER Leg 1 at x=175 */}
              <path
                d="M 61,160 L 165,160 A 10,10 0 0,1 185,160 L 275,160"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
              />
              <circle cx="275" cy="160" r="3.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />

              {/* Phase B (C) -> Leg 3 midpoint (x=375, y=160) - jumps OVER Leg 1 (x=175) and Leg 2 (x=275) */}
              <path
                d="M 61,210 L 135,210 L 135,185 L 165,185 A 10,10 0 0,1 185,185 L 265,185 A 10,10 0 0,1 285,185 L 375,185 L 375,160"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />
              <circle cx="375" cy="160" r="3.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />

              {/* Top & Bottom DC Rails */}
              <line x1="175" y1="60" x2={showFwd ? '465' : '540'} y2="60" stroke="#475569" strokeWidth="2.5" />
              <line x1="175" y1="260" x2={showFwd ? '465' : '540'} y2="260" stroke="#475569" strokeWidth="2.5" />

              {/* Node Junction Dots connecting thyristors to rails */}
              <circle cx="175" cy="60" r="3" fill="#64748b" />
              <circle cx="275" cy="60" r="3" fill="#64748b" />
              <circle cx="375" cy="60" r="3" fill="#64748b" />
              <circle cx="175" cy="260" r="3" fill="#64748b" />
              <circle cx="275" cy="260" r="3" fill="#64748b" />
              <circle cx="375" cy="260" r="3" fill="#64748b" />

              {/* LEG 1 (Phase R): Arm 1 (T1 top) and Arm 4 (T4 bottom) */}
              <line x1="175" y1="160" x2="175" y2="105" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s1', 175, 90, 'T1', isS1On, 0)}
              <line x1="175" y1="75" x2="175" y2="60" stroke="#475569" strokeWidth="2.5" />

              <line x1="175" y1="260" x2="175" y2="245" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s4', 175, 230, 'T4', isS4On, 0)}
              <line x1="175" y1="215" x2="175" y2="160" stroke="#475569" strokeWidth="2.5" />

              {/* LEG 2 (Phase Y): Arm 3 (T3 top) and Arm 6 (T6 bottom) */}
              <line x1="275" y1="160" x2="275" y2="105" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s3', 275, 90, 'T3', isS3On, 0)}
              <line x1="275" y1="75" x2="275" y2="60" stroke="#475569" strokeWidth="2.5" />

              <line x1="275" y1="260" x2="275" y2="245" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s6', 275, 230, 'T6', isS6On, 0)}
              <line x1="275" y1="215" x2="275" y2="160" stroke="#475569" strokeWidth="2.5" />

              {/* LEG 3 (Phase B): Arm 5 (T5 top) and Arm 2 (T2 bottom) */}
              <line x1="375" y1="160" x2="375" y2="105" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s5', 375, 90, 'T5', isS5On, 0)}
              <line x1="375" y1="75" x2="375" y2="60" stroke="#475569" strokeWidth="2.5" />

              <line x1="375" y1="260" x2="375" y2="245" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s2', 375, 230, 'T2', isS2On, 0)}
              <line x1="375" y1="215" x2="375" y2="160" stroke="#475569" strokeWidth="2.5" />

              {/* Optional FWD Diode Branch */}
              {showFwd && (
                <>
                  <line x1="465" y1="60" x2="540" y2="60" stroke="#475569" strokeWidth="2.5" />
                  <line x1="465" y1="260" x2="540" y2="260" stroke="#475569" strokeWidth="2.5" />
                  {renderFwdBranch(465, 60, 260)}
                </>
              )}

              {/* Load branch */}
              {renderLoadBranch(540, 60, 260)}

              {/* ANIMATED CURRENT FLOW FOR 3-PHASE */}
              {isCurrentFlowing && !is3PhaseFreewheel && (
                <g>
                  {/* Pair T1, T6 (Phase R to Phase Y) */}
                  {isS1On && isS6On && (
                    <path
                      d="M 61,110 L 135,110 L 135,160 L 175,160 L 175,60 L 540,60 L 540,260 L 275,260 L 275,160 L 185,160 A 10,10 0 0,0 165,160 L 61,160"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3.5"
                      className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                    />
                  )}
                  {/* Pair T1, T2 (Phase R to Phase B) */}
                  {isS1On && isS2On && (
                    <path
                      d="M 61,110 L 135,110 L 135,160 L 175,160 L 175,60 L 540,60 L 540,260 L 375,260 L 375,185 L 285,185 A 10,10 0 0,0 265,185 L 185,185 A 10,10 0 0,0 165,185 L 135,185 L 135,210 L 61,210"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3.5"
                      className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                    />
                  )}
                  {/* Pair T3, T2 (Phase Y to Phase B) */}
                  {isS3On && isS2On && (
                    <path
                      d="M 61,160 L 165,160 A 10,10 0 0,1 185,160 L 275,160 L 275,60 L 540,60 L 540,260 L 375,260 L 375,185 L 285,185 A 10,10 0 0,0 265,185 L 185,185 A 10,10 0 0,0 165,185 L 135,185 L 135,210 L 61,210"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3.5"
                      className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                    />
                  )}
                  {/* Pair T3, T4 (Phase Y to Phase R) */}
                  {isS3On && isS4On && (
                    <path
                      d="M 61,160 L 165,160 A 10,10 0 0,1 185,160 L 275,160 L 275,60 L 540,60 L 540,260 L 175,260 L 175,160 L 135,160 L 135,110 L 61,110"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3.5"
                      className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                    />
                  )}
                  {/* Pair T5, T4 (Phase B to Phase R) */}
                  {isS5On && isS4On && (
                    <path
                      d="M 61,210 L 135,210 L 135,185 L 165,185 A 10,10 0 0,1 185,185 L 265,185 A 10,10 0 0,1 285,185 L 375,185 L 375,60 L 540,60 L 540,260 L 175,260 L 175,160 L 135,160 L 135,110 L 61,110"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3.5"
                      className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                    />
                  )}
                  {/* Pair T5, T6 (Phase B to Phase Y) */}
                  {isS5On && isS6On && (
                    <path
                      d="M 61,210 L 135,210 L 135,185 L 165,185 A 10,10 0 0,1 185,185 L 265,185 A 10,10 0 0,1 285,185 L 375,185 L 375,60 L 540,60 L 540,260 L 275,260 L 275,160 L 185,160 A 10,10 0 0,0 165,160 L 61,160"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3.5"
                      className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                    />
                  )}
                  <text x="440" y="52" fill="#22d3ee" fontSize="11" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#22d3ee" fontSize="11" fontWeight="bold">▼</text>
                  <text x="440" y="272" fill="#22d3ee" fontSize="11" fontWeight="bold">◀</text>
                </g>
              )}

              {/* 3-PHASE FREEWHEELING PATHS */}
              {isCurrentFlowing && is3PhaseFreewheel && (
                <g>
                  {is3PhaseFreewheelA && (
                    <path
                      d="M 540,260 L 175,260 L 175,60 L 540,60 Z"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="4"
                      className="anim-fwd-flow drop-shadow-[0_0_12px_#f59e0b]"
                    />
                  )}
                  {is3PhaseFreewheelB && (
                    <path
                      d="M 540,260 L 275,260 L 275,60 L 540,60 Z"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="4"
                      className="anim-fwd-flow drop-shadow-[0_0_12px_#f59e0b]"
                    />
                  )}
                  {is3PhaseFreewheelC && (
                    <path
                      d="M 540,260 L 375,260 L 375,60 L 540,60 Z"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="4"
                      className="anim-fwd-flow drop-shadow-[0_0_12px_#f59e0b]"
                    />
                  )}
                  {isFwdOn && showFwd && (
                    <path
                      d="M 540,260 L 465,260 L 465,60 L 540,60 Z"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="4"
                      className="anim-fwd-flow drop-shadow-[0_0_12px_#f59e0b]"
                    />
                  )}
                  <text x="500" y="52" fill="#f59e0b" fontSize="11" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#f59e0b" fontSize="11" fontWeight="bold">▼</text>
                  <text x="500" y="272" fill="#f59e0b" fontSize="11" fontWeight="bold">◀</text>
                </g>
              )}
            </g>
          )}

          {/* ======================================================== */}
          {/* BASE STATIC WIRES: HALF-WAVE (1-PHASE)                   */}
          {/* ======================================================== */}
          {topology === 'half-wave' && (
            <g>
              <g transform="translate(90, 160)">
                <circle cx="0" cy="0" r="26" fill="rgba(15, 23, 42, 0.8)" stroke="#64748b" strokeWidth="2.5" />
                <path d="M -14,0 Q -7,-12 0,0 Q 7,12 14,0" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                <text x="0" y="38" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" className="font-mono">
                  v_s(t)
                </text>
              </g>

              <path d="M 90,134 L 90,60 L 220,60" fill="none" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s1', 250, 60, 'T1', isS1On, 90)}
              <line x1="264" y1="60" x2={showFwd ? '440' : '540'} y2="60" stroke="#475569" strokeWidth="2.5" />

              {showFwd && (
                <>
                  <line x1="440" y1="60" x2="540" y2="60" stroke="#475569" strokeWidth="2.5" />
                  {renderFwdBranch(440, 60, 260)}
                </>
              )}

              {renderLoadBranch(540, 60, 260)}
              <path d={`M 540,260 L ${showFwd ? '440,260 L ' : ''}90,260 L 90,186`} fill="none" stroke="#475569" strokeWidth="2.5" />

              {isCurrentFlowing && isS1On && (
                <g>
                  <path
                    d="M 90,134 L 90,60 L 540,60 L 540,260 L 90,260 L 90,186"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="3.5"
                    className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                  />
                  <text x="360" y="52" fill="#22d3ee" fontSize="12" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#22d3ee" fontSize="12" fontWeight="bold">▼</text>
                  <text x="320" y="272" fill="#22d3ee" fontSize="12" fontWeight="bold">◀</text>
                </g>
              )}

              {isCurrentFlowing && isFwdOn && showFwd && (
                <g>
                  <path
                    d="M 540,260 L 440,260 L 440,60 L 540,60 L 540,260 Z"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    className="anim-fwd-flow drop-shadow-[0_0_10px_#f59e0b]"
                  />
                  <text x="490" y="52" fill="#f59e0b" fontSize="12" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#f59e0b" fontSize="12" fontWeight="bold">▼</text>
                  <text x="490" y="272" fill="#f59e0b" fontSize="12" fontWeight="bold">◀</text>
                </g>
              )}
            </g>
          )}

          {/* ======================================================== */}
          {/* TOPOLOGY: FULL-WAVE BRIDGE & 1-PHASE SEMI-CONVERTER      */}
          {/* ======================================================== */}
          {(topology === 'full-wave-bridge' || topology === 'semi-converter') && (
            <g>
              <g transform="translate(70, 160)">
                <circle cx="0" cy="0" r="24" fill="rgba(15, 23, 42, 0.8)" stroke="#64748b" strokeWidth="2.5" />
                <path d="M -12,0 Q -6,-10 0,0 Q 6,10 12,0" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                <text x="0" y="36" fill="#94a3b8" fontSize="10" fontWeight="600" textAnchor="middle" className="font-mono">
                  v_s(t)
                </text>
                <text x="-16" y="4" fill="#38bdf8" fontSize="10" fontWeight="700" className="font-mono">A</text>
                <text x="16" y="4" fill="#94a3b8" fontSize="10" fontWeight="700" className="font-mono">B</text>
              </g>

              {/* Phase A -> Leg 1 midpoint (x=200, y=160) */}
              <path d="M 70,136 L 140,136 L 140,160 L 200,160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
              <circle cx="200" cy="160" r="3.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />

              {/* Phase B -> Leg 2 midpoint (x=330, y=160) - with jumper arch over Leg 1 (x=200) */}
              <path
                d="M 70,184 L 140,184 L 140,185 L 190,185 A 10,10 0 0,1 210,185 L 330,185 L 330,160"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2.5"
              />
              <circle cx="330" cy="160" r="3.5" fill="#94a3b8" stroke="#0f172a" strokeWidth="1" />

              {/* Arm 4 (S4) */}
              <line x1="200" y1="260" x2="200" y2="245" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s4', 200, 230, 'T4', isS4On, 0)}
              <line x1="200" y1="215" x2="200" y2="160" stroke="#475569" strokeWidth="2.5" />

              {/* Arm 1 (S1) */}
              <line x1="200" y1="160" x2="200" y2="105" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s1', 200, 90, 'T1', isS1On, 0)}
              <line x1="200" y1="75" x2="200" y2="60" stroke="#475569" strokeWidth="2.5" />

              {/* Arm 2 (S2) */}
              <line x1="330" y1="260" x2="330" y2="245" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s2', 330, 230, 'T2', isS2On, 0)}
              <line x1="330" y1="215" x2="330" y2="160" stroke="#475569" strokeWidth="2.5" />

              {/* Arm 3 (S3) */}
              <line x1="330" y1="160" x2="330" y2="105" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s3', 330, 90, 'T3', isS3On, 0)}
              <line x1="330" y1="75" x2="330" y2="60" stroke="#475569" strokeWidth="2.5" />

              {/* Top & Bottom Conductors */}
              <line x1="200" y1="60" x2={showFwd ? '460' : '540'} y2="60" stroke="#475569" strokeWidth="2.5" />
              <line x1="200" y1="260" x2={showFwd ? '460' : '540'} y2="260" stroke="#475569" strokeWidth="2.5" />

              {/* Node Junction Dots connecting thyristors to rails */}
              <circle cx="200" cy="60" r="3" fill="#64748b" />
              <circle cx="330" cy="60" r="3" fill="#64748b" />
              <circle cx="200" cy="260" r="3" fill="#64748b" />
              <circle cx="330" cy="260" r="3" fill="#64748b" />

              {showFwd && (
                <>
                  <line x1="460" y1="60" x2="540" y2="60" stroke="#475569" strokeWidth="2.5" />
                  <line x1="460" y1="260" x2="540" y2="260" stroke="#475569" strokeWidth="2.5" />
                  <circle cx="460" cy="60" r="3" fill="#64748b" />
                  <circle cx="460" cy="260" r="3" fill="#64748b" />
                  {renderFwdBranch(460, 60, 260)}
                </>
              )}

              {renderLoadBranch(540, 60, 260)}

              {/* POSITIVE LOOP (S1 + S2) */}
              {isCurrentFlowing && isS1On && isS2On && !isLeg1Freewheel && !isLeg2Freewheel && !isFwdOn && (
                <g>
                  <path
                    d="M 70,136 L 140,136 L 140,160 L 200,160 L 200,60 L 540,60 L 540,260 L 330,260 L 330,185 L 210,185 A 10,10 0 0,0 190,185 L 140,185 L 140,184 L 70,184"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="3.5"
                    className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                  />
                  <text x="400" y="52" fill="#22d3ee" fontSize="11" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#22d3ee" fontSize="11" fontWeight="bold">▼</text>
                  <text x="430" y="272" fill="#22d3ee" fontSize="11" fontWeight="bold">◀</text>
                </g>
              )}

              {/* NEGATIVE LOOP (S3 + S4) */}
              {isCurrentFlowing && isS3On && isS4On && !isLeg1Freewheel && !isLeg2Freewheel && !isFwdOn && (
                <g>
                  <path
                    d="M 70,184 L 140,184 L 140,185 L 190,185 A 10,10 0 0,1 210,185 L 330,185 L 330,60 L 540,60 L 540,260 L 200,260 L 200,160 L 140,160 L 140,136 L 70,136"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="3.5"
                    className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                  />
                  <text x="400" y="52" fill="#22d3ee" fontSize="11" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#22d3ee" fontSize="11" fontWeight="bold">▼</text>
                  <text x="370" y="272" fill="#22d3ee" fontSize="11" fontWeight="bold">◀</text>
                </g>
              )}

              {/* LEG 1 FREEWHEEL (D4 -> D1) */}
              {isCurrentFlowing && isLeg1Freewheel && (
                <g>
                  <path
                    d="M 540,260 L 200,260 L 200,60 L 540,60 Z"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    className="anim-fwd-flow drop-shadow-[0_0_12px_#f59e0b]"
                  />
                  <text x="370" y="272" fill="#f59e0b" fontSize="12" fontWeight="bold">◀</text>
                  <text x="370" y="52" fill="#f59e0b" fontSize="12" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#f59e0b" fontSize="12" fontWeight="bold">▼</text>
                </g>
              )}

              {/* LEG 2 FREEWHEEL (D2 -> D3) */}
              {isCurrentFlowing && isLeg2Freewheel && (
                <g>
                  <path
                    d="M 540,260 L 330,260 L 330,60 L 540,60 Z"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    className="anim-fwd-flow drop-shadow-[0_0_12px_#f59e0b]"
                  />
                  <text x="435" y="272" fill="#f59e0b" fontSize="12" fontWeight="bold">◀</text>
                  <text x="435" y="52" fill="#f59e0b" fontSize="12" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#f59e0b" fontSize="12" fontWeight="bold">▼</text>
                </g>
              )}

              {/* DEDICATED FWD */}
              {isCurrentFlowing && isFwdOn && showFwd && !isLeg1Freewheel && !isLeg2Freewheel && (
                <g>
                  <path
                    d="M 540,260 L 460,260 L 460,60 L 540,60 Z"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    className="anim-fwd-flow drop-shadow-[0_0_12px_#f59e0b]"
                  />
                  <text x="500" y="272" fill="#f59e0b" fontSize="12" fontWeight="bold">◀</text>
                  <text x="500" y="52" fill="#f59e0b" fontSize="12" fontWeight="bold">▶</text>
                  <text x="548" y="160" fill="#f59e0b" fontSize="12" fontWeight="bold">▼</text>
                </g>
              )}
            </g>
          )}

          {/* ======================================================== */}
          {/* TOPOLOGY: CENTER-TAPPED (MID-POINT)                      */}
          {/* ======================================================== */}
          {topology === 'full-wave-midpoint' && (
            <g>
              <g transform="translate(80, 160)">
                <line x1="-20" y1="-50" x2="-20" y2="50" stroke="#38bdf8" strokeWidth="2.5" />
                <circle cx="-20" cy="-50" r="3" fill="#38bdf8" />
                <circle cx="-20" cy="50" r="3" fill="#38bdf8" />
                <text x="-35" y="4" fill="#94a3b8" fontSize="10" fontWeight="600" textAnchor="end" className="font-mono">
                  Primary
                </text>
              </g>

              <line x1="90" y1="85" x2="90" y2="235" stroke="#64748b" strokeWidth="2" strokeDasharray="3,3" />
              <line x1="94" y1="85" x2="94" y2="235" stroke="#64748b" strokeWidth="2" strokeDasharray="3,3" />

              <path d="M 110,80 L 110,160 L 110,240" stroke="#38bdf8" strokeWidth="2.5" fill="none" />
              <line x1="110" y1="160" x2="520" y2="160" stroke="#64748b" strokeWidth="2" strokeDasharray="4,4" />
              <text x="120" y="155" fill="#94a3b8" fontSize="10" className="font-mono">Center Tap (Neutral)</text>

              <line x1="110" y1="80" x2="220" y2="80" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s1', 250, 80, 'T1', isS1On, 90)}
              <line x1="264" y1="80" x2="380" y2="80" stroke="#475569" strokeWidth="2.5" />

              <line x1="110" y1="240" x2="220" y2="240" stroke="#475569" strokeWidth="2.5" />
              {renderSwitchComponent('s2', 250, 240, 'T2', isS2On, 90)}
              <line x1="264" y1="240" x2="380" y2="240" stroke="#475569" strokeWidth="2.5" />

              <line x1="380" y1="80" x2="380" y2="240" stroke="#475569" strokeWidth="2.5" />
              <line x1="380" y1="80" x2="520" y2="80" stroke="#475569" strokeWidth="2.5" />

              {renderLoadBranch(520, 80, 160)}
              <circle cx="520" cy="160" r="3.5" fill="#64748b" />

              {isCurrentFlowing && isS1On && (
                <g>
                  <path
                    d="M 110,80 L 380,80 L 520,80 L 520,160 L 110,160"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="3.5"
                    className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                  />
                  <text x="450" y="72" fill="#22d3ee" fontSize="11" fontWeight="bold">▶</text>
                  <text x="528" y="120" fill="#22d3ee" fontSize="11" fontWeight="bold">▼</text>
                  <text x="315" y="172" fill="#22d3ee" fontSize="11" fontWeight="bold">◀</text>
                </g>
              )}
              {isCurrentFlowing && isS2On && (
                <g>
                  <path
                    d="M 110,240 L 380,240 L 380,80 L 520,80 L 520,160 L 110,160"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="3.5"
                    className="anim-current-flow drop-shadow-[0_0_10px_#22d3ee]"
                  />
                  <text x="315" y="248" fill="#22d3ee" fontSize="11" fontWeight="bold">▶</text>
                  <text x="450" y="72" fill="#22d3ee" fontSize="11" fontWeight="bold">▶</text>
                  <text x="528" y="120" fill="#22d3ee" fontSize="11" fontWeight="bold">▼</text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* COMPONENT CUSTOMIZER MATRIX: Directly in Circuit Schematic Card */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 text-xs">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Activity size={13} className="text-cyan-400" />
            {is3Phase ? '3-Phase 6-Arm Semiconductor Switch Matrix' : 'Arm Customizer (Swap Thyristor ⇄ Diode ⇄ None)'}
          </span>
          <span className="text-slate-500">Click symbols in circuit or buttons below</span>
        </div>

        <div className={`grid gap-2 font-mono text-[11px] ${is3Phase ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-7' : 'grid-cols-2 sm:grid-cols-5'}`}>
          {/* Arm 1 */}
          <div className="flex flex-col gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-300 font-semibold">{is3Phase ? 'T1 (R+)' : 'T1 (Top-L)'}:</span>
              {isS1On && <span className="text-cyan-400 text-[9px] font-bold animate-pulse">ON</span>}
            </div>
            <div className="flex items-center gap-1">
              {(['thyristor', 'diode', 'removed'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => onUpdateSwitch('s1', t)}
                  className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                    switches.s1 === t
                      ? t === 'removed' ? 'bg-rose-500 text-slate-950 font-bold' : t === 'diode' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'thyristor' ? 'SCR' : t === 'diode' ? 'Diode' : 'None'}
                </button>
              ))}
            </div>
          </div>

          {/* Arm 3 */}
          <div className="flex flex-col gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-300 font-semibold">{is3Phase ? 'T3 (Y+)' : 'T3 (Top-R)'}:</span>
              {isS3On && <span className="text-cyan-400 text-[9px] font-bold animate-pulse">ON</span>}
            </div>
            <div className="flex items-center gap-1">
              {(['thyristor', 'diode', 'removed'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => onUpdateSwitch('s3', t)}
                  className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                    switches.s3 === t
                      ? t === 'removed' ? 'bg-rose-500 text-slate-950 font-bold' : t === 'diode' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'thyristor' ? 'SCR' : t === 'diode' ? 'Diode' : 'None'}
                </button>
              ))}
            </div>
          </div>

          {/* Arm 5 (3-Phase) */}
          {is3Phase && (
            <div className="flex flex-col gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-300 font-semibold">T5 (B+):</span>
                {isS5On && <span className="text-cyan-400 text-[9px] font-bold animate-pulse">ON</span>}
              </div>
              <div className="flex items-center gap-1">
                {(['thyristor', 'diode', 'removed'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => onUpdateSwitch('s5', t)}
                    className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                      switches.s5 === t
                        ? t === 'removed' ? 'bg-rose-500 text-slate-950 font-bold' : t === 'diode' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'thyristor' ? 'SCR' : t === 'diode' ? 'Diode' : 'None'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Arm 4 */}
          <div className="flex flex-col gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-300 font-semibold">{is3Phase ? 'T4 (R-)' : 'T4 (Bot-L)'}:</span>
              {isS4On && <span className="text-cyan-400 text-[9px] font-bold animate-pulse">ON</span>}
            </div>
            <div className="flex items-center gap-1">
              {(['thyristor', 'diode', 'removed'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => onUpdateSwitch('s4', t)}
                  className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                    switches.s4 === t
                      ? t === 'removed' ? 'bg-rose-500 text-slate-950 font-bold' : t === 'diode' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'thyristor' ? 'SCR' : t === 'diode' ? 'Diode' : 'None'}
                </button>
              ))}
            </div>
          </div>

          {/* Arm 6 (3-Phase) */}
          {is3Phase && (
            <div className="flex flex-col gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-300 font-semibold">T6 (Y-):</span>
                {isS6On && <span className="text-cyan-400 text-[9px] font-bold animate-pulse">ON</span>}
              </div>
              <div className="flex items-center gap-1">
                {(['thyristor', 'diode', 'removed'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => onUpdateSwitch('s6', t)}
                    className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                      switches.s6 === t
                        ? t === 'removed' ? 'bg-rose-500 text-slate-950 font-bold' : t === 'diode' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'thyristor' ? 'SCR' : t === 'diode' ? 'Diode' : 'None'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Arm 2 */}
          <div className="flex flex-col gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-300 font-semibold">{is3Phase ? 'T2 (B-)' : 'T2 (Bot-R)'}:</span>
              {isS2On && <span className="text-cyan-400 text-[9px] font-bold animate-pulse">ON</span>}
            </div>
            <div className="flex items-center gap-1">
              {(['thyristor', 'diode', 'removed'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => onUpdateSwitch('s2', t)}
                  className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                    switches.s2 === t
                      ? t === 'removed' ? 'bg-rose-500 text-slate-950 font-bold' : t === 'diode' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'thyristor' ? 'SCR' : t === 'diode' ? 'Diode' : 'None'}
                </button>
              ))}
            </div>
          </div>

          {/* FWD Diode */}
          <div className="flex flex-col gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-300 font-semibold">FWD:</span>
              {isFwdOn && <span className="text-amber-400 text-[9px] font-bold animate-pulse">ON</span>}
            </div>
            <div className="flex items-center gap-1">
              {(['diode', 'removed'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => onUpdateSwitch('fwd', t)}
                  className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                    switches.fwd === t
                      ? t === 'removed' ? 'bg-rose-500 text-slate-950 font-bold' : 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'removed' ? 'None' : 'Diode'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
