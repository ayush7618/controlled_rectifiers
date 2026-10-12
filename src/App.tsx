/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { CircuitSwitchesConfig, PinnedSnapshot, RectifierParameters, SwitchDeviceType } from './types/rectifier';
import { calculateRectifierInsights } from './utils/physicsEngine';
import { CircuitSchematic } from './components/CircuitSchematic';
import { Oscilloscope } from './components/Oscilloscope';
import { ControlDeck } from './components/ControlDeck';
import { ParameterInsights } from './components/ParameterInsights';
import { TheoryDrawer } from './components/TheoryDrawer';
import { BookOpen, Zap } from 'lucide-react';

export default function App() {
  // Primary simulation parameters
  const [params, setParams] = useState<RectifierParameters>({
    topology: 'full-wave-bridge',
    loadType: 'RL',
    alpha: 45,
    vRms: 230,
    freq: 50,
    resistance: 10,
    inductance: 50,
    backEmf: 40,
    hasFwd: false,
    switches: {
      s1: 'thyristor',
      s2: 'thyristor',
      s3: 'thyristor',
      s4: 'thyristor',
      fwd: 'removed',
    },
  });

  // Playback & inspection states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [cursorSampleIndex, setCursorSampleIndex] = useState<number>(90);
  const [highlightedProbe, setHighlightedProbe] = useState<string | null>(null);
  const [theoryOpen, setTheoryOpen] = useState<boolean>(false);

  // Pinned waveform comparison snapshot (ghost trace)
  const [pinnedSnapshot, setPinnedSnapshot] = useState<PinnedSnapshot | null>(null);

  // Active view section navigation anchor
  const [activeSection, setActiveSection] = useState<'all' | 'scope' | 'schematic' | 'insights'>('all');

  // Fast memoized physics engine recalculation
  const insights = useMemo(() => {
    return calculateRectifierInsights(params);
  }, [params]);

  const handleParamChange = (newParams: Partial<RectifierParameters>) => {
    setParams(prev => {
      const updated = { ...prev, ...newParams };

      // If topology changed and switches were not explicitly overridden in newParams, update defaults
      if (newParams.topology && !newParams.switches) {
        if (newParams.topology === 'half-wave') {
          updated.switches = {
            s1: 'thyristor',
            s2: 'removed',
            s3: 'removed',
            s4: 'removed',
            fwd: prev.hasFwd ? 'diode' : 'removed',
          };
        } else if (newParams.topology === 'semi-converter') {
          updated.switches = {
            s1: 'thyristor',
            s2: 'diode',
            s3: 'thyristor',
            s4: 'diode',
            fwd: 'diode',
          };
          updated.hasFwd = true;
        } else if (newParams.topology === 'full-wave-midpoint') {
          updated.switches = {
            s1: 'thyristor',
            s2: 'thyristor',
            s3: 'removed',
            s4: 'removed',
            fwd: prev.hasFwd ? 'diode' : 'removed',
          };
        } else if (newParams.topology === 'full-wave-bridge') {
          updated.switches = {
            s1: 'thyristor',
            s2: 'thyristor',
            s3: 'thyristor',
            s4: 'thyristor',
            s5: 'removed',
            s6: 'removed',
            fwd: prev.hasFwd ? 'diode' : 'removed',
          };
        } else if (newParams.topology === 'three-phase-full') {
          updated.switches = {
            s1: 'thyristor',
            s2: 'thyristor',
            s3: 'thyristor',
            s4: 'thyristor',
            s5: 'thyristor',
            s6: 'thyristor',
            fwd: prev.hasFwd ? 'diode' : 'removed',
          };
          if (prev.vRms <= 240) updated.vRms = 400; // Standard 3-phase line voltage
        } else if (newParams.topology === 'three-phase-semi') {
          updated.switches = {
            s1: 'thyristor',
            s2: 'diode',
            s3: 'thyristor',
            s4: 'diode',
            s5: 'thyristor',
            s6: 'diode',
            fwd: 'diode',
          };
          updated.hasFwd = true;
          if (prev.vRms <= 240) updated.vRms = 400;
        }
      }

      // Keep FWD in sync if load type changed
      if (newParams.loadType === 'RL_FWD') {
        updated.hasFwd = true;
        updated.switches.fwd = 'diode';
      }
      if (newParams.topology === 'semi-converter' || newParams.topology === 'three-phase-semi') {
        updated.hasFwd = true;
        updated.switches.fwd = 'diode';
      }
      return updated;
    });
  };

  const handleUpdateSwitch = (arm: 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 'fwd', newType: SwitchDeviceType) => {
    setParams(prev => ({
      ...prev,
      switches: {
        ...prev.switches,
        [arm]: newType,
      },
      hasFwd: arm === 'fwd' ? newType === 'diode' : prev.hasFwd,
    }));
  };

  const handleApplySwitchPreset = (preset: CircuitSwitchesConfig) => {
    setParams(prev => ({
      ...prev,
      switches: preset,
      hasFwd: preset.fwd === 'diode',
    }));
  };

  const handlePinCurrent = () => {
    setPinnedSnapshot({
      id: String(Date.now()),
      alpha: params.alpha,
      topology: params.topology,
      loadType: params.loadType,
      vDc: insights.vDc,
      vRmsOut: insights.vRmsOut,
      iDc: insights.iDc,
      samples: [...insights.samples],
    });
  };

  const handleClearPin = () => {
    setPinnedSnapshot(null);
  };

  const currentSample = insights.samples[cursorSampleIndex] || insights.samples[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP BAR CONTRACT: Single text Brand, clean nav links, primary actions   */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-900/30">
            <Zap size={18} className="text-slate-950" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            ThyroWave
          </span>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 border-l border-slate-800 pl-3">
            <span>Controlled Rectifier Laboratory</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-cyan-400">α = {params.alpha}°</span>
            {pinnedSnapshot && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-amber-300">Ghost: α={pinnedSnapshot.alpha}°</span>
              </>
            )}
          </div>
        </div>

        {/* Zone 2: Clean text navigation tabs */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveSection('all')}
            className={`transition-colors hover:text-white ${
              activeSection === 'all' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            Full Workbench
          </button>
          <button
            onClick={() => setActiveSection('scope')}
            className={`transition-colors hover:text-white ${
              activeSection === 'scope' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            Oscilloscope (3 Graphs)
          </button>
          <button
            onClick={() => setActiveSection('schematic')}
            className={`transition-colors hover:text-white ${
              activeSection === 'schematic' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            Circuit Schematic
          </button>
          <button
            onClick={() => setActiveSection('insights')}
            className={`transition-colors hover:text-white ${
              activeSection === 'insights' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            Harmonics & Insights
          </button>
        </nav>

        {/* Zone 3: Primary Action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setTheoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shadow-sm"
          >
            <BookOpen size={14} className="text-cyan-400" />
            <span>Theory & Equations</span>
          </button>

          <button
            onClick={() => {
              handleParamChange({
                topology: 'half-wave',
                loadType: 'R',
                alpha: 30,
                vRms: 230,
                freq: 50,
                resistance: 10,
                inductance: 50,
                backEmf: 40,
                hasFwd: false,
                switches: {
                  s1: 'thyristor',
                  s2: 'removed',
                  s3: 'removed',
                  s4: 'removed',
                  fwd: 'removed',
                },
              });
            }}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-lg transition-colors whitespace-nowrap"
            title="Switch to Half-Wave Baseline"
          >
            <span>Half-Wave Preset</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN WORKBENCH CONTENT                                                    */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full max-w-[1560px] mx-auto p-4 lg:p-6 flex flex-col gap-5">
        {/* Quick status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-900/60 border border-slate-800/80 rounded-xl text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Engine Online
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Topology:{' '}
              <strong className="text-slate-200 uppercase font-mono">
                {params.topology}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Load:{' '}
              <strong className="text-slate-200 font-mono">
                {params.loadType}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Supply:{' '}
              <strong className="text-slate-200 font-mono">
                {params.vRms}V RMS @ {params.freq}Hz
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>
              V_dc = <span className="text-cyan-400 font-semibold">{insights.vDc} V</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              I_dc = <span className="text-emerald-400 font-semibold">{insights.iDc} A</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              RF = <span className="text-amber-400 font-semibold">{insights.rippleFactor}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              η = <span className="text-emerald-400 font-semibold">{insights.efficiency}%</span>
            </span>
          </div>
        </div>

        {/* Main Stage: Dual Split Workspace (Controls & Schematic on Left, Oscilloscope on Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column (Controls & Schematic): Half screen on desktop */}
          {(activeSection === 'all' || activeSection === 'schematic' || activeSection === 'scope') && (
            <div className={`flex flex-col gap-4 ${activeSection === 'schematic' ? 'lg:col-span-12' : 'lg:col-span-5'}`}>
              {/* Interactive Control Deck (Firing Angle α, R, L, E sliders & steppers) */}
              <ControlDeck
                params={params}
                onChangeParams={handleParamChange}
                alphaMinDeg={insights.alphaMinDeg}
              />

              {/* Circuit Schematic */}
              {(activeSection === 'all' || activeSection === 'schematic') && (
                <CircuitSchematic
                  topology={params.topology}
                  loadType={params.loadType}
                  alpha={params.alpha}
                  rVal={params.resistance}
                  lVal={params.inductance}
                  eVal={params.backEmf}
                  hasFwd={params.hasFwd}
                  switches={params.switches}
                  onUpdateSwitch={handleUpdateSwitch}
                  onApplySwitchPreset={handleApplySwitchPreset}
                  currentSample={currentSample}
                  highlightedProbe={highlightedProbe}
                  onSelectProbe={setHighlightedProbe}
                />
              )}
            </div>
          )}

          {/* Right Column: Oscilloscope with Stacked 3-Plot view and Live Trace Toggles */}
          {(activeSection === 'all' || activeSection === 'scope') && (
            <div className={`flex flex-col gap-3 ${activeSection === 'scope' ? 'lg:col-span-7' : 'lg:col-span-7'}`}>
              <Oscilloscope
                insights={insights}
                alpha={params.alpha}
                topology={params.topology}
                highlightedProbe={highlightedProbe}
                cursorSampleIndex={cursorSampleIndex}
                setCursorSampleIndex={setCursorSampleIndex}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                pinnedSnapshot={pinnedSnapshot}
                onPinCurrent={handlePinCurrent}
                onClearPin={handleClearPin}
              />
            </div>
          )}
        </div>

        {/* Bottom Stage: Parameter Insights, Waveform Analysis & CSV Export */}
        {(activeSection === 'all' || activeSection === 'insights') && (
          <ParameterInsights
            insights={insights}
            params={params}
          />
        )}
      </main>

      {/* Floating or Modal Theory Drawer */}
      <TheoryDrawer
        isOpen={theoryOpen}
        onClose={() => setTheoryOpen(false)}
        topology={params.topology}
        loadType={params.loadType}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 px-6 py-4 bg-slate-950 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>ThyroWave Phase-Controlled Rectifier Simulation Suite</span>
          <span aria-hidden="true">·</span>
          <span>Single-Phase Half-Wave & Full-Wave Topologies with Custom Diode/SCR Matrix</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheoryOpen(true)}
            className="hover:text-cyan-300 transition-colors"
          >
            Mathematical Formulation
          </button>
          <span aria-hidden="true">·</span>
          <span>Ghost Trace Comparison & Stacked 3-Plot Multi-Graph Analysis</span>
        </div>
      </footer>
    </div>
  );
}
