export type TopologyType =
  | 'half-wave'
  | 'full-wave-bridge'
  | 'full-wave-midpoint'
  | 'semi-converter'
  | 'three-phase-full'
  | 'three-phase-semi';

export type LoadType =
  | 'R'
  | 'RL'
  | 'RL_FWD'
  | 'HIGHLY_INDUCTIVE'
  | 'RLE';

export type SwitchDeviceType = 'thyristor' | 'diode' | 'removed';

export interface CircuitSwitchesConfig {
  s1: SwitchDeviceType; // Top Phase A (Arm 1 - T1/D1)
  s2: SwitchDeviceType; // Bottom Phase C (Arm 2 - T2/D2)
  s3: SwitchDeviceType; // Top Phase B (Arm 3 - T3/D3)
  s4: SwitchDeviceType; // Bottom Phase A (Arm 4 - T4/D4)
  s5?: SwitchDeviceType; // Top Phase C (Arm 5 - T5/D5) (3-phase)
  s6?: SwitchDeviceType; // Bottom Phase B (Arm 6 - T6/D6) (3-phase)
  fwd: 'diode' | 'removed'; // Freewheeling diode
}

export interface PinnedSnapshot {
  id: string;
  alpha: number;
  topology: TopologyType;
  loadType: LoadType;
  vDc: number;
  vRmsOut: number;
  iDc: number;
  samples: WaveformSample[];
}

export interface RectifierParameters {
  topology: TopologyType;
  loadType: LoadType;
  alpha: number; // firing angle in degrees [0, 180]
  vRms: number; // Supply RMS voltage (V) (Line-to-Line for 3-phase or Line-to-Neutral)
  freq: number; // Frequency in Hz (50 or 60)
  resistance: number; // Load resistance in Ohms
  inductance: number; // Load inductance in mH
  backEmf: number; // Load DC back-EMF / battery voltage in V
  hasFwd: boolean; // Freewheeling diode present
  switches: CircuitSwitchesConfig;
}

export interface WaveformSample {
  timeMs: number;
  thetaDeg: number; // omega * t in degrees [0, 720]
  thetaRad: number;
  vs: number; // Supply voltage (Phase A / single phase)
  vA?: number; // 3-phase Phase A voltage
  vB?: number; // 3-phase Phase B voltage
  vC?: number; // 3-phase Phase C voltage
  vAb?: number; // Line-to-Line Vab
  vBc?: number; // Line-to-Line Vbc
  vCa?: number; // Line-to-Line Vca
  is: number; // Supply current (Phase A)
  vo: number; // Output voltage
  io: number; // Output current
  vThyristor1: number; // Voltage across T1
  gate1: number; // Gate trigger pulse T1 (0 or 1)
  gate2: number; // Gate trigger pulse T2 (0 or 1)
  gate3: number; // Gate trigger pulse T3 (0 or 1)
  gate4: number; // Gate trigger pulse T4 (0 or 1)
  gate5?: number; // Gate trigger pulse T5 (0 or 1)
  gate6?: number; // Gate trigger pulse T6 (0 or 1)
  iFwd: number; // Freewheeling diode current
  activeThyristors: string[]; // e.g., ['T1', 'T6'] or ['D1', 'D4']
}

export interface HarmonicComponent {
  order: number;
  frequency: number;
  voltageAmp: number;
  voltagePercent: number;
  currentAmp: number;
  currentPercent: number;
}

export interface CalculatedInsights {
  vm: number; // Peak supply voltage
  omega: number; // Angular frequency (rad/s)
  periodMs: number; // AC period in ms
  impedance: number; // Z = sqrt(R^2 + (wL)^2)
  phiDeg: number; // Load angle phi in deg = atan(wL/R)
  betaDeg: number; // Extinction angle beta in deg
  gammaDeg: number; // Conduction angle gamma = beta - alpha in deg
  isContinuous: boolean; // Continuous Conduction Mode (CCM)
  alphaMinDeg: number; // Minimum firing angle for battery load = asin(E/Vm)
  vDc: number; // Average DC voltage (V)
  vRmsOut: number; // RMS output voltage (V)
  iDc: number; // Average DC current (A)
  iRmsOut: number; // RMS output current (A)
  pDc: number; // DC output power (W)
  pAcOut: number; // Total output power (W)
  formFactor: number; // FF = Vrms / Vdc
  rippleFactor: number; // RF = sqrt(FF^2 - 1)
  efficiency: number; // Rectification efficiency eta (%)
  tuf: number; // Transformer Utilization Factor
  piv: number; // Peak Inverse Voltage on SCRs (V)
  thdVoltage: number; // THD of output voltage (%)
  thdCurrent: number; // THD of input supply current (%)
  dpf: number; // Displacement Power Factor (cos phi_1)
  inputPf: number; // Input power factor
  harmonics: HarmonicComponent[];
  samples: WaveformSample[];
}
