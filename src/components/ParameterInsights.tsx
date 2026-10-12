import React, { useState } from 'react';
import { CalculatedInsights, RectifierParameters } from '../types/rectifier';
import { Activity, Download, Copy, Check, Info } from 'lucide-react';

interface ParameterInsightsProps {
  insights: CalculatedInsights;
  params: RectifierParameters;
}

export const ParameterInsights: React.FC<ParameterInsightsProps> = ({
  insights,
  params,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyReport = () => {
    const report = `=== THYROWAVE RECTIFIER SIMULATION REPORT ===
Topology: ${params.topology}
Load Type: ${params.loadType}
Firing Angle (alpha): ${params.alpha}°
Supply: ${params.vRms} V RMS @ ${params.freq} Hz (Vm = ${insights.vm} V)
Load Parameters: R = ${params.resistance} Ω, L = ${params.inductance} mH, E = ${params.backEmf} V

ELECTRICAL OUTPUT INSIGHTS:
- Average DC Voltage (Vdc): ${insights.vDc} V
- RMS Output Voltage (Vrms): ${insights.vRmsOut} V
- Average DC Current (Idc): ${insights.iDc} A
- RMS Output Current (Irms): ${insights.iRmsOut} A
- DC Output Power (Pdc): ${insights.pDc} W
- Total Output Power (Pac): ${insights.pAcOut} W
- Form Factor (FF): ${insights.formFactor}
- Ripple Factor (RF): ${insights.rippleFactor}
- Rectification Efficiency (eta): ${insights.efficiency}%
- Extinction Angle (beta): ${insights.betaDeg}°
- Conduction Angle (gamma): ${insights.gammaDeg}°
- Conduction Mode: ${insights.isContinuous ? 'Continuous (CCM)' : 'Discontinuous (DCM)'}
- Peak Inverse Voltage (PIV): ${insights.piv} V
- Voltage THD: ${insights.thdVoltage}%
- Supply Current THD: ${insights.thdCurrent}%
- Displacement Power Factor (DPF): ${insights.dpf}
- Input Power Factor (PF): ${insights.inputPf}
- Transformer Utilization Factor (TUF): ${insights.tuf}
=============================================`;

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (!insights.samples || insights.samples.length === 0) return;
    const headers = 'time_ms,theta_deg,vs_v,is_a,vo_v,io_a,vt_v,gate1,active_devices\n';
    const rows = insights.samples.map(s => 
      `${s.timeMs},${s.thetaDeg},${s.vs},${s.is},${s.vo},${s.io},${s.vThyristor1},${s.gate1},"${s.activeThyristors.join(';')}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `thyristor_${params.topology}_alpha_${params.alpha}deg.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-900 rounded-xl border border-slate-800 p-4 lg:p-5 shadow-xl">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
            Parameter Insights & Metrics
          </h2>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-cyan-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied Report' : 'Copy Report'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-cyan-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Conduction Mode & Diagnostic Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Conduction Regime:</span>
          {insights.isContinuous ? (
            <span className="font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              Continuous Conduction Mode (CCM)
            </span>
          ) : (
            <span className="font-mono font-semibold text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
              Discontinuous Conduction Mode (DCM)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-300 font-mono text-[11px]">
          <span>β (Extinction): <strong className="text-cyan-300">{insights.betaDeg}°</strong></span>
          <span>·</span>
          <span>γ (Conduction): <strong className="text-cyan-300">{insights.gammaDeg}°</strong></span>
          <span>·</span>
          <span>PIV: <strong className="text-rose-300">{insights.piv} V</strong></span>
        </div>
      </div>

      {/* Grid of Key Electrical Parameter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Vdc */}
        <div className="flex flex-col p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400">Average DC (V_dc)</span>
          <span className="text-lg font-bold font-mono text-cyan-300 mt-1">
            {insights.vDc} <span className="text-xs font-normal text-slate-400">V</span>
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">Mean rectified voltage</span>
        </div>

        {/* Vrms */}
        <div className="flex flex-col p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400">RMS Voltage (V_rms)</span>
          <span className="text-lg font-bold font-mono text-cyan-300 mt-1">
            {insights.vRmsOut} <span className="text-xs font-normal text-slate-400">V</span>
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">Effective heating value</span>
        </div>

        {/* Idc */}
        <div className="flex flex-col p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400">DC Current (I_dc)</span>
          <span className="text-lg font-bold font-mono text-emerald-300 mt-1">
            {insights.iDc} <span className="text-xs font-normal text-slate-400">A</span>
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">Average output current</span>
        </div>

        {/* Irms */}
        <div className="flex flex-col p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400">RMS Current (I_rms)</span>
          <span className="text-lg font-bold font-mono text-emerald-300 mt-1">
            {insights.iRmsOut} <span className="text-xs font-normal text-slate-400">A</span>
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">True RMS load current</span>
        </div>

        {/* Ripple Factor */}
        <div className="flex flex-col p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400">Ripple Factor (RF)</span>
          <span className="text-lg font-bold font-mono text-amber-300 mt-1">
            {insights.rippleFactor}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">√(FF² - 1) AC ripple ratio</span>
        </div>

        {/* Efficiency */}
        <div className="flex flex-col p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400">Efficiency (η)</span>
          <span className="text-lg font-bold font-mono text-emerald-400 mt-1">
            {insights.efficiency} <span className="text-xs font-normal text-slate-400">%</span>
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">P_dc / P_total ratio</span>
        </div>
      </div>

      {/* Secondary Detailed Tabular Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Power & Quality */}
        <div className="flex flex-col p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <span className="text-xs font-semibold text-slate-300 mb-2">Power Characteristics</span>
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-850">
              <span className="text-slate-400">DC Power (P_dc):</span>
              <span className="text-slate-200 font-semibold">{insights.pDc} W</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-850">
              <span className="text-slate-400">Total Power (P_ac):</span>
              <span className="text-slate-200 font-semibold">{insights.pAcOut} W</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Form Factor (FF):</span>
              <span className="text-slate-200 font-semibold">{insights.formFactor}</span>
            </div>
          </div>
        </div>

        {/* Harmonics & Grid Quality */}
        <div className="flex flex-col p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <span className="text-xs font-semibold text-slate-300 mb-2">Harmonics & Grid Quality</span>
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-850">
              <span className="text-slate-400">THD Output Voltage:</span>
              <span className="text-amber-300 font-semibold">{insights.thdVoltage}%</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-850">
              <span className="text-slate-400">THD Supply Current:</span>
              <span className="text-amber-300 font-semibold">{insights.thdCurrent}%</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Displacement PF (cos α):</span>
              <span className="text-cyan-300 font-semibold">{insights.dpf}</span>
            </div>
          </div>
        </div>

        {/* Transformer & Angles */}
        <div className="flex flex-col p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <span className="text-xs font-semibold text-slate-300 mb-2">Circuit Angles & TUF</span>
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-850">
              <span className="text-slate-400">Load Angle (φ = atan ωL/R):</span>
              <span className="text-slate-200 font-semibold">{insights.phiDeg}°</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-850">
              <span className="text-slate-400">Input Power Factor:</span>
              <span className="text-cyan-300 font-semibold">{insights.inputPf}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Transf. Util. Factor (TUF):</span>
              <span className="text-slate-200 font-semibold">{insights.tuf}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
