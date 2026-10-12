import React from 'react';
import { LoadType, TopologyType } from '../types/rectifier';
import { BookOpen, X, ChevronRight } from 'lucide-react';

interface TheoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  topology: TopologyType;
  loadType: LoadType;
}

export const TheoryDrawer: React.FC<TheoryDrawerProps> = ({
  isOpen,
  onClose,
  topology,
  loadType,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <BookOpen size={20} className="text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Power Electronics Theory & Governing Equations
              </h2>
              <p className="text-xs text-slate-400">
                Mathematical derivations, boundary conditions, and commutation physics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-col gap-6 py-6 text-slate-300 text-sm leading-relaxed">
          {/* Section 1: Selected Configuration Formulae */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-2">
              Active Configuration Formulation
            </span>
            <div className="space-y-3 font-mono text-xs">
              {topology === 'half-wave' && loadType === 'R' && (
                <>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Average DC Output Voltage:</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      V_dc = (V_m / 2π) · (1 + cos α)
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">RMS Output Voltage:</p>
                    <p className="text-emerald-300 font-semibold text-sm mt-1">
                      V_rms = (V_m / 2) · √[ 1 - (α/π) + (sin 2α / 2π) ]
                    </p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Conduction interval: α ≤ ωt ≤ π. Device turns off naturally at ωt = π when input voltage reverses.
                  </p>
                </>
              )}

              {topology === 'half-wave' && (loadType === 'RL' || loadType === 'HIGHLY_INDUCTIVE') && (
                <>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Governing Differential Equation (α ≤ ωt ≤ β):</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      L · (di_o / dt) + R · i_o = V_m · sin(ωt)
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Instantaneous Current Solution:</p>
                    <p className="text-emerald-300 font-semibold text-xs mt-1">
                      i_o(ωt) = (V_m / Z) · [ sin(ωt - φ) - sin(α - φ) · e^(-(R/ωL)(ωt - α)) ]
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Average DC Output Voltage:</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      V_dc = (V_m / 2π) · (cos α - cos β)
                    </p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Extinction angle β satisfies i_o(β) = 0. Due to inductive energy storage, conduction continues into the negative half cycle (π &lt; ωt &lt; β), causing negative voltage spikes!
                  </p>
                </>
              )}

              {topology === 'half-wave' && loadType === 'RL_FWD' && (
                <>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Average DC Output Voltage (with Freewheeling Diode):</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      V_dc = (V_m / 2π) · (1 + cos α)
                    </p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    At ωt = π, the freewheeling diode (FWD) becomes forward-biased and clamps v_o to 0V. Inductor current recirculates through FWD, protecting load and preventing negative voltage spikes.
                  </p>
                </>
              )}

              {topology === 'full-wave-bridge' && loadType === 'R' && (
                <>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Average DC Output Voltage:</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      V_dc = (V_m / π) · (1 + cos α)
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">RMS Output Voltage:</p>
                    <p className="text-emerald-300 font-semibold text-sm mt-1">
                      V_rms = (V_m / √2) · √[ 1 - (α/π) + (sin 2α / 2π) ]
                    </p>
                  </div>
                </>
              )}

              {topology === 'full-wave-bridge' && (loadType === 'RL' || loadType === 'HIGHLY_INDUCTIVE') && (
                <>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Continuous Conduction Mode (CCM):</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      V_dc = (2 · V_m / π) · cos α
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">RMS Output Voltage:</p>
                    <p className="text-emerald-300 font-semibold text-sm mt-1">
                      V_rms = V_m / √2 = V_s(rms)
                    </p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Notice that when α &gt; 90°, cos α &lt; 0 so V_dc becomes negative! If a DC source is present in the load circuit, power flows from DC back to the AC grid (Line-Commutated Inverter Mode).
                  </p>
                </>
              )}

              {topology === 'semi-converter' && (
                <>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">1-Phase Semi-Converter (Half-Controlled):</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      V_dc = (V_m / π) · (1 + cos α)
                    </p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    The diode arms provide automatic freewheeling. In symmetrical semi-converters (top SCRs, bottom diodes), freewheeling happens across common diodes. In asymmetrical semi-converters (one entire leg is diodes D1 &amp; D4, other leg is SCRs T3 &amp; T2), current freewheels in series through D4 and D1, naturally clamping v_o to 0V and preventing negative voltage excursion!
                  </p>
                </>
              )}

              {topology === 'three-phase-full' && (
                <>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">3-Phase Fully Controlled Bridge (6-Pulse Converter):</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      V_dc = (3·V_mL / π) · cos α = (3√3·V_m,ph / π) · cos α ≈ 1.654·V_m,ph · cos α
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Resistive Load (α &gt; 60° discontinuous):</p>
                    <p className="text-emerald-300 font-semibold text-xs mt-1">
                      V_dc = (3·V_mL / π) · [ 1 + cos(α + 60°) ]
                    </p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Six SCRs (T1..T6) fire in sequence (T1-T2-T3-T4-T5-T6) every 60°, synchronized 30° after natural phase crossings. Each pair conducts for 60° (each device conducts for 120°). Under highly inductive loads, v_o goes negative during parts of the cycle, allowing four-quadrant or two-quadrant operation.
                  </p>
                </>
              )}

              {topology === 'three-phase-semi' && (
                <>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">3-Phase Semi-Converter (Half-Controlled: 3 SCRs + 3 Diodes):</p>
                    <p className="text-cyan-300 font-semibold text-sm mt-1">
                      V_dc = (3·V_mL / 2π) · (1 + cos α) = (3√3·V_m,ph / 2π) · (1 + cos α)
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <p className="text-slate-400">Conduction Regimes:</p>
                    <p className="text-amber-300 text-xs mt-1">
                      • α ≤ 60°: Continuous 6 pulses per cycle, no freewheeling.<br/>
                      • α &gt; 60°: 3 pulses of line voltage per cycle with freewheeling periods (v_o = 0V) through same-leg pairs (T1,D4 or T3,D6 or T5,D2) or FWD diode.
                    </p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Top SCRs (T1, T3, T5) fire at 30°+α, 150°+α, 270°+α. Bottom diodes (D4, D6, D2) commutate naturally at 210°, 330°, 90°. Since diodes clamp negative excursion automatically, v_o never goes below 0V.
                  </p>
                </>
              )}

              {loadType === 'RLE' && (
                <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                  <p className="text-slate-400">Battery / Back-EMF Critical Firing Angle:</p>
                  <p className="text-amber-300 font-semibold text-sm mt-1">
                    α_min = arcsin(E / V_m)
                  </p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    If α &lt; α_min, the anode voltage is below the cathode potential (held up by E), so thyristor is reverse-biased and cannot turn on.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Performance Figures of Merit */}
          <div>
            <h3 className="text-sm font-semibold text-slate-100 mb-2">
              Figures of Merit Definitions
            </h3>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Form Factor (FF):</strong> Ratio of RMS output voltage to average DC voltage: <code>FF = V_rms / V_dc</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Ripple Factor (RF):</strong> Quantitative index of harmonic AC voltage superimposed on DC output: <code>RF = √(FF² - 1)</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Rectification Efficiency (η):</strong> The ratio of DC power delivered to total active load power: <code>η = P_dc / P_total</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Displacement Power Factor (DPF):</strong> Phase displacement between supply fundamental current and supply voltage: <code>DPF = cos α</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Peak Inverse Voltage (PIV):</strong> Maximum reverse voltage stress experienced across thyristors during non-conducting periods. Bridge: <code>PIV = V_m</code>; Center-Tapped: <code>PIV = 2·V_m</code>.
                </span>
              </li>
            </ul>
          </div>

          {/* Section 3: Conduction Regimes (CCM vs DCM) */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">
              Conduction Regimes: CCM vs DCM
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              In single-phase rectifiers supplying inductive loads, <strong>Continuous Conduction Mode (CCM)</strong> occurs when the load inductance is sufficiently large or resistance sufficiently low such that load current never decays to zero before the next SCR pair is fired. Conversely, in <strong>Discontinuous Conduction Mode (DCM)</strong>, current extinguishes at angle β prior to the subsequent gate trigger, leaving an interval where all semiconductor switches block and output current remains zero.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
