import React, { useEffect, useState } from 'react';
import { LoadType, RectifierParameters, TopologyType } from '../types/rectifier';
import { Sliders, Zap, RotateCcw, Play, Pause, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ControlDeckProps {
  params: RectifierParameters;
  onChangeParams: (newParams: Partial<RectifierParameters>) => void;
  alphaMinDeg: number;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  params,
  onChangeParams,
  alphaMinDeg,
}) => {
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepDirection, setSweepDirection] = useState<1 | -1>(1);

  // Auto-sweep effect for firing angle alpha
  useEffect(() => {
    if (!isSweeping) return;
    const interval = setInterval(() => {
      onChangeParams({
        alpha: (() => {
          let next = params.alpha + sweepDirection * 2;
          if (next >= 150) {
            setSweepDirection(-1);
            return 150;
          }
          if (next <= 15) {
            setSweepDirection(1);
            return 15;
          }
          return next;
        })(),
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isSweeping, params.alpha, sweepDirection, onChangeParams]);

  const presetAngles = [0, 30, 45, 60, 90, 120];
  const presetResistors = [5, 10, 20, 50];
  const presetInductors = [0, 20, 50, 100];
  const presetEmf = [0, 24, 48, 80];
  const presetVoltages = [110, 230, 400];

  const topologies: { id: TopologyType; label: string; desc: string }[] = [
    { id: 'half-wave', label: 'Half-Wave (1Φ)', desc: '1 SCR' },
    { id: 'full-wave-bridge', label: 'Full Bridge (1Φ)', desc: '4 SCRs' },
    { id: 'full-wave-midpoint', label: 'Center-Tap (1Φ)', desc: '2 SCRs' },
    { id: 'semi-converter', label: 'Semi-Conv (1Φ)', desc: '2 SCR + 2 Diode' },
    { id: 'three-phase-full', label: '3Φ Full Bridge', desc: '6 SCRs (6-Pulse)' },
    { id: 'three-phase-semi', label: '3Φ Semi-Conv', desc: '3 SCR + 3 Diode' },
  ];

  const loadTypes: { id: LoadType; label: string; desc: string }[] = [
    { id: 'R', label: 'Resistive (R)', desc: 'In phase' },
    { id: 'RL', label: 'Inductive (R-L)', desc: 'Extends conduction' },
    { id: 'RL_FWD', label: 'R-L + FWD', desc: 'Free-wheel path' },
    { id: 'HIGHLY_INDUCTIVE', label: 'High-L (L→∞)', desc: 'Ripple-free DC' },
    { id: 'RLE', label: 'Battery (R-L-E)', desc: 'Back-EMF source' },
  ];

  const handleStepAlpha = (delta: number) => {
    const next = Math.max(0, Math.min(180, Math.round(params.alpha + delta)));
    onChangeParams({ alpha: next });
  };

  const handleStepR = (delta: number) => {
    const next = Math.max(0.5, Math.min(200, Math.round((params.resistance + delta) * 10) / 10));
    onChangeParams({ resistance: next });
  };

  const handleStepL = (delta: number) => {
    const next = Math.max(0, Math.min(300, Math.round(params.inductance + delta)));
    onChangeParams({ inductance: next });
  };

  const handleStepE = (delta: number) => {
    const next = Math.max(0, Math.min(250, Math.round(params.backEmf + delta)));
    onChangeParams({ backEmf: next });
  };

  const handleStepV = (delta: number) => {
    const next = Math.max(20, Math.min(500, Math.round(params.vRms + delta)));
    onChangeParams({ vRms: next });
  };

  const handleResetDefaults = () => {
    setIsSweeping(false);
    onChangeParams({
      topology: 'full-wave-bridge',
      loadType: 'RL',
      alpha: 45,
      vRms: 230,
      freq: 50,
      resistance: 10,
      inductance: 50,
      backEmf: 40,
      hasFwd: false,
    });
  };

  const isInductorDisabled = params.loadType === 'R' || params.loadType === 'HIGHLY_INDUCTIVE';
  const isEmfDisabled = params.loadType !== 'RLE';

  return (
    <div className="flex flex-col gap-3.5 bg-slate-900/95 rounded-xl border border-slate-800 p-3.5 sm:p-4 shadow-xl">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-cyan-400" />
          <h2 className="text-xs font-semibold text-slate-100 uppercase tracking-wider font-mono">
            Control Deck & Lab Parameters
          </h2>
        </div>
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 transition-colors bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700/60"
        >
          <RotateCcw size={11} />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* 1. Topology & Load Characteristic Compact Selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
        {/* Topology Selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Topology
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-1">
            {topologies.map(top => {
              const isSelected = params.topology === top.id;
              return (
                <button
                  key={top.id}
                  onClick={() => onChangeParams({ topology: top.id })}
                  className={`flex flex-col text-left px-2 py-1 rounded border transition-all ${
                    isSelected
                      ? 'bg-cyan-950/70 border-cyan-500 shadow-sm text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="font-semibold text-[11px] leading-tight truncate">{top.label}</span>
                  <span className="text-[9px] text-slate-500 truncate">{top.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Load Selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Load Type
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-3 gap-1">
            {loadTypes.map(l => {
              const isSelected = params.loadType === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => onChangeParams({ loadType: l.id })}
                  className={`flex flex-col text-left px-2 py-1 rounded border transition-all ${
                    isSelected
                      ? 'bg-emerald-950/70 border-emerald-500 shadow-sm text-emerald-200'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="font-semibold text-[11px] leading-tight truncate">{l.label}</span>
                  <span className="text-[9px] text-slate-500 truncate">{l.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Interactive Parameter Sliders Grid (Alpha, R, L, E side-by-side) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* ========================================================= */}
        {/* PARAMETER 1: Firing Angle (α) Main Slider & Controls     */}
        {/* ========================================================= */}
        <div className="flex flex-col gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-rose-400" />
              <span className="font-semibold text-slate-200 text-xs">
                Firing Angle (α)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsSweeping(!isSweeping)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                  isSweeping
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Automated angle sweep"
              >
                {isSweeping ? <Pause size={10} /> : <Play size={10} />}
                <span>Sweep</span>
              </button>

              <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={params.alpha}
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) onChangeParams({ alpha: Math.max(0, Math.min(180, val)) });
                  }}
                  className="w-10 bg-transparent text-right font-mono text-cyan-300 text-xs font-bold focus:outline-none"
                />
                <span className="text-slate-400 text-[10px] ml-0.5">°</span>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] font-mono text-slate-500">0°</span>
            <input
              type="range"
              min="0"
              max="180"
              step="1"
              value={params.alpha}
              onChange={e => onChangeParams({ alpha: Number(e.target.value) })}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-[10px] font-mono text-slate-500">180°</span>
          </div>

          {/* Steppers & Presets */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono">
            <div className="flex items-center gap-1">
              <button onClick={() => handleStepAlpha(-5)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">-5°</button>
              <button onClick={() => handleStepAlpha(-1)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">-1°</button>
              <button onClick={() => handleStepAlpha(1)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">+1°</button>
              <button onClick={() => handleStepAlpha(5)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">+5°</button>
            </div>
            <div className="flex items-center gap-0.5">
              {presetAngles.map(deg => (
                <button
                  key={deg}
                  onClick={() => onChangeParams({ alpha: deg })}
                  className={`px-1 py-0.5 rounded transition-colors ${
                    params.alpha === deg
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-400 border border-slate-750'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          {params.loadType === 'RLE' && params.alpha < alphaMinDeg && (
            <div className="flex items-center gap-1.5 p-1 bg-amber-950/60 border border-amber-800/80 rounded text-amber-300 text-[10px]">
              <AlertTriangle size={12} className="shrink-0" />
              <span>Vm &lt; E at α={params.alpha}°. Thyristor fires at α &ge; {alphaMinDeg}°.</span>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* PARAMETER 2: Load Resistance (R) Slider & Precision Deck */}
        {/* ========================================================= */}
        <div className="flex flex-col gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between gap-1 text-xs">
            <span className="font-semibold text-slate-200 text-xs">
              Resistance (R)
            </span>

            <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                value={params.resistance}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) onChangeParams({ resistance: Math.max(0.5, Math.min(100, val)) });
                }}
                className="w-12 bg-transparent text-right font-mono text-emerald-300 text-xs font-bold focus:outline-none"
              />
              <span className="text-slate-400 text-[10px] ml-0.5">Ω</span>
            </div>
          </div>

          {/* Slider */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] font-mono text-slate-500">1Ω</span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={params.resistance}
              onChange={e => onChangeParams({ resistance: Number(e.target.value) })}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <span className="text-[10px] font-mono text-slate-500">100Ω</span>
          </div>

          {/* Steppers & Presets */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono">
            <div className="flex items-center gap-1">
              <button onClick={() => handleStepR(-5)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">-5</button>
              <button onClick={() => handleStepR(-1)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">-1</button>
              <button onClick={() => handleStepR(1)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">+1</button>
              <button onClick={() => handleStepR(5)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">+5</button>
            </div>
            <div className="flex items-center gap-0.5">
              {presetResistors.map(r => (
                <button
                  key={r}
                  onClick={() => onChangeParams({ resistance: r })}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    params.resistance === r
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-400 border border-slate-750'
                  }`}
                >
                  {r}Ω
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PARAMETER 3: Load Inductance (L) Slider & Precision Deck  */}
        {/* ========================================================= */}
        <div className={`flex flex-col gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 shadow-inner ${isInductorDisabled ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-200 text-xs">
                Inductance (L)
              </span>
              {isInductorDisabled && (
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950/60 px-1 rounded">
                  {params.loadType === 'HIGHLY_INDUCTIVE' ? 'L→∞ (Fixed)' : 'R-only'}
                </span>
              )}
            </div>

            <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">
              <input
                type="number"
                min="0"
                max="250"
                step="5"
                disabled={isInductorDisabled}
                value={params.inductance}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) onChangeParams({ inductance: Math.max(0, Math.min(250, val)) });
                }}
                className="w-12 bg-transparent text-right font-mono text-indigo-300 text-xs font-bold focus:outline-none disabled:opacity-50"
              />
              <span className="text-slate-400 text-[10px] ml-0.5">mH</span>
            </div>
          </div>

          {/* Slider */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] font-mono text-slate-500">0mH</span>
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              disabled={isInductorDisabled}
              value={params.inductance}
              onChange={e => onChangeParams({ inductance: Number(e.target.value) })}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400 disabled:opacity-40"
            />
            <span className="text-[10px] font-mono text-slate-500">200mH</span>
          </div>

          {/* Steppers & Presets */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono">
            <div className="flex items-center gap-1">
              <button disabled={isInductorDisabled} onClick={() => handleStepL(-25)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700">-25</button>
              <button disabled={isInductorDisabled} onClick={() => handleStepL(-5)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700">-5</button>
              <button disabled={isInductorDisabled} onClick={() => handleStepL(5)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700">+5</button>
              <button disabled={isInductorDisabled} onClick={() => handleStepL(25)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700">+25</button>
            </div>
            <div className="flex items-center gap-0.5">
              {presetInductors.map(l => (
                <button
                  key={l}
                  disabled={isInductorDisabled}
                  onClick={() => onChangeParams({ inductance: l })}
                  className={`px-1 py-0.5 rounded transition-colors disabled:opacity-40 ${
                    params.inductance === l
                      ? 'bg-indigo-500 text-slate-950 font-bold'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-400 border border-slate-750'
                  }`}
                >
                  {l}mH
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PARAMETER 4: Back-EMF (E) / DC Source Slider & Controls   */}
        {/* ========================================================= */}
        <div className={`flex flex-col gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 shadow-inner ${isEmfDisabled ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-200 text-xs">
                Back-EMF (E)
              </span>
              {isEmfDisabled ? (
                <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1 rounded">
                  Requires R-L-E
                </span>
              ) : (
                <span className="text-[9px] font-mono text-amber-300 bg-amber-950/60 px-1 rounded">
                  Active
                </span>
              )}
            </div>

            <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">
              <input
                type="number"
                min="0"
                max="200"
                step="5"
                disabled={isEmfDisabled}
                value={params.backEmf}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) onChangeParams({ backEmf: Math.max(0, Math.min(200, val)) });
                }}
                className="w-10 bg-transparent text-right font-mono text-amber-300 text-xs font-bold focus:outline-none disabled:opacity-50"
              />
              <span className="text-slate-400 text-[10px] ml-0.5">V</span>
            </div>
          </div>

          {/* Slider */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] font-mono text-slate-500">0V</span>
            <input
              type="range"
              min="0"
              max="150"
              step="5"
              disabled={isEmfDisabled}
              value={params.backEmf}
              onChange={e => onChangeParams({ backEmf: Number(e.target.value) })}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 disabled:opacity-40"
            />
            <span className="text-[10px] font-mono text-slate-500">150V</span>
          </div>

          {/* Steppers & Presets */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono">
            <div className="flex items-center gap-1">
              <button disabled={isEmfDisabled} onClick={() => handleStepE(-10)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700">-10</button>
              <button disabled={isEmfDisabled} onClick={() => handleStepE(-2)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700">-2</button>
              <button disabled={isEmfDisabled} onClick={() => handleStepE(2)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700">+2</button>
              <button disabled={isEmfDisabled} onClick={() => handleStepE(10)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700">+10</button>
            </div>
            <div className="flex items-center gap-0.5">
              {presetEmf.map(eVal => (
                <button
                  key={eVal}
                  disabled={isEmfDisabled}
                  onClick={() => onChangeParams({ backEmf: eVal })}
                  className={`px-1 py-0.5 rounded transition-colors disabled:opacity-40 ${
                    params.backEmf === eVal
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-400 border border-slate-750'
                  }`}
                >
                  {eVal}V
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Compact Supply Voltage & Frequency Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-950/70 rounded-lg border border-slate-800 text-xs">
        {/* Supply Voltage (Vrms) */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">Supply (V_rms):</span>
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">
            <input
              type="number"
              min="20"
              max="500"
              value={params.vRms}
              onChange={e => onChangeParams({ vRms: Number(e.target.value) })}
              className="w-12 bg-transparent text-right font-mono text-cyan-300 text-xs font-semibold focus:outline-none"
            />
            <span className="text-slate-500 text-[10px] ml-0.5">V</span>
          </div>

          <div className="flex items-center gap-1 font-mono text-[10px]">
            <button onClick={() => handleStepV(-10)} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded">-10</button>
            <button onClick={() => handleStepV(10)} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded">+10</button>
            {presetVoltages.map(v => (
              <button
                key={v}
                onClick={() => onChangeParams({ vRms: v })}
                className={`px-1.5 py-0.5 rounded ${params.vRms === v ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}
              >
                {v}V
              </button>
            ))}
          </div>
        </div>

        {/* Frequency (f) */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">Freq (f):</span>
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">
            <input
              type="number"
              min="10"
              max="400"
              value={params.freq}
              onChange={e => onChangeParams({ freq: Number(e.target.value) })}
              className="w-10 bg-transparent text-right font-mono text-slate-200 text-xs font-semibold focus:outline-none"
            />
            <span className="text-slate-500 text-[10px] ml-0.5">Hz</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px]">
            {[50, 60].map(f => (
              <button
                key={f}
                onClick={() => onChangeParams({ freq: f })}
                className={`px-1.5 py-0.5 rounded ${params.freq === f ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}
              >
                {f}Hz
              </button>
            ))}
          </div>
        </div>

        {/* FWD Diode checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={params.hasFwd || params.loadType === 'RL_FWD' || params.topology === 'semi-converter' || params.topology === 'three-phase-semi'}
            onChange={e => onChangeParams({ hasFwd: e.target.checked })}
            className="rounded accent-cyan-500 w-3.5 h-3.5 cursor-pointer"
          />
          <span className="font-mono text-[11px]">Freewheeling Diode (FWD)</span>
        </label>
      </div>
    </div>
  );
};
