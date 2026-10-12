import { CalculatedInsights, HarmonicComponent, RectifierParameters, WaveformSample } from '../types/rectifier';

/**
 * Solves the extinction angle beta for a single-phase half-wave R-L circuit:
 * f(beta) = sin(beta - phi) - sin(alpha - phi) * exp(- (R / (w*L)) * (beta - alpha)) = 0
 */
export function solveExtinctionAngle(alphaRad: number, phiRad: number, rOverWl: number): number {
  if (rOverWl > 1000 || isNaN(rOverWl)) {
    // Pure R load
    return Math.PI;
  }
  
  const f = (theta: number) => {
    return Math.sin(theta - phiRad) - Math.sin(alphaRad - phiRad) * Math.exp(-rOverWl * (theta - alphaRad));
  };

  // Search in [alphaRad + 0.001, 2*PI]
  let low = Math.max(Math.PI, alphaRad);
  let high = 2 * Math.PI;
  
  // Verify sign change
  const fLow = f(low);
  const fHigh = f(high);
  
  if (fLow * fHigh > 0) {
    // Scan with step
    let found = false;
    let step = 0.02;
    for (let t = low; t <= high; t += step) {
      if (f(t) <= 0) {
        high = t;
        low = t - step;
        found = true;
        break;
      }
    }
    if (!found) return Math.min(2 * Math.PI, Math.PI + phiRad);
  }

  // Bisection method for 20 iterations
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (f(low) * fMid <= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

/**
 * Computes full physics simulation across 2 AC cycles (720 degrees)
 * with periodic steady-state convergence.
 */
export function calculateRectifierInsights(params: RectifierParameters): CalculatedInsights {
  const { topology, loadType, alpha, vRms, freq, resistance, inductance, backEmf, hasFwd, switches } = params;

  const is3Phase = topology === 'three-phase-full' || topology === 'three-phase-semi';

  // Resolve switch configuration with defaults if not set
  const currentSwitches: {
    s1: 'thyristor' | 'diode' | 'removed';
    s2: 'thyristor' | 'diode' | 'removed';
    s3: 'thyristor' | 'diode' | 'removed';
    s4: 'thyristor' | 'diode' | 'removed';
    s5: 'thyristor' | 'diode' | 'removed';
    s6: 'thyristor' | 'diode' | 'removed';
    fwd: 'diode' | 'removed';
  } = {
    s1: switches?.s1 || 'thyristor',
    s2: switches?.s2 || (topology === 'half-wave' ? 'removed' : topology === 'semi-converter' || topology === 'three-phase-semi' ? 'diode' : 'thyristor'),
    s3: switches?.s3 || (topology === 'half-wave' || topology === 'full-wave-midpoint' ? 'removed' : 'thyristor'),
    s4: switches?.s4 || (topology === 'half-wave' || topology === 'full-wave-midpoint' ? 'removed' : topology === 'semi-converter' || topology === 'three-phase-semi' ? 'diode' : 'thyristor'),
    s5: switches?.s5 || (is3Phase ? 'thyristor' : 'removed'),
    s6: switches?.s6 || (topology === 'three-phase-full' ? 'thyristor' : topology === 'three-phase-semi' ? 'diode' : 'removed'),
    fwd: switches?.fwd || (hasFwd || loadType === 'RL_FWD' || topology === 'semi-converter' || topology === 'three-phase-semi' ? 'diode' : 'removed'),
  };

  // Peak line-to-line voltage for 3-phase, peak line-to-neutral for single-phase
  const vLineRms = vRms;
  const vmLine = Math.SQRT2 * vLineRms;
  const vmPhase = is3Phase ? vmLine / Math.sqrt(3) : vmLine;
  const vm = is3Phase ? vmLine : vmLine;

  const omega = 2 * Math.PI * freq;
  const periodS = 1 / freq;
  const periodMs = periodS * 1000;
  
  const R = Math.max(0.1, resistance);
  const L = loadType === 'R' ? 0.00001 : (inductance / 1000); // in Henries
  const E = loadType === 'RLE' ? Math.max(0, backEmf) : 0;
  
  // Inherent freewheeling occurs if:
  const hasDedicatedFwd = currentSwitches.fwd === 'diode' || hasFwd || loadType === 'RL_FWD';
  const hasLeg1DiodeFreewheel = currentSwitches.s1 === 'diode' && currentSwitches.s4 === 'diode';
  const hasLeg2DiodeFreewheel = currentSwitches.s3 === 'diode' && currentSwitches.s2 === 'diode';
  const hasBottomDiodeFreewheel = currentSwitches.s4 === 'diode' && currentSwitches.s2 === 'diode';
  const hasTopDiodeFreewheel = currentSwitches.s1 === 'diode' && currentSwitches.s3 === 'diode';

  const effectiveFwd = hasDedicatedFwd ||
                       hasLeg1DiodeFreewheel ||
                       hasLeg2DiodeFreewheel ||
                       hasBottomDiodeFreewheel ||
                       hasTopDiodeFreewheel ||
                       topology === 'semi-converter' ||
                       topology === 'three-phase-semi';
  
  const wl = omega * L;
  const impedance = Math.sqrt(R * R + wl * wl);
  const phiRad = Math.atan2(wl, R);
  const phiDeg = (phiRad * 180) / Math.PI;
  const alphaRad = (alpha * Math.PI) / 180;
  const rOverWl = L > 1e-5 ? R / wl : 100000;

  // Minimum firing angle for battery load
  let alphaMinDeg = 0;
  if (loadType === 'RLE' && E > 0) {
    const ratio = Math.min(1, E / Math.max(1, vm));
    alphaMinDeg = (Math.asin(ratio) * 180) / Math.PI;
  }

  // Calculate extinction angle
  let betaRad = Math.PI;
  if (loadType === 'R') {
    betaRad = Math.PI;
  } else if (effectiveFwd) {
    betaRad = Math.PI;
  } else {
    betaRad = solveExtinctionAngle(alphaRad, phiRad, rOverWl);
  }
  const betaDeg = (betaRad * 180) / Math.PI;
  const gammaDeg = Math.max(0, betaDeg - alpha);

  // Time-step simulation to find steady-state
  const pointsPerCycle = 360;
  const numCyclesSim = 4;
  const totalPoints = pointsPerCycle * numCyclesSim;
  const dt = periodS / pointsPerCycle;

  let io = 0;
  let isContinuous = false;

  const allSamples: WaveformSample[] = [];

  // Determine loop availability
  const canLoopPos = topology === 'half-wave'
    ? currentSwitches.s1 !== 'removed'
    : topology === 'full-wave-midpoint'
    ? currentSwitches.s1 !== 'removed'
    : currentSwitches.s1 !== 'removed' && currentSwitches.s2 !== 'removed';

  const canLoopNeg = topology === 'half-wave'
    ? false
    : topology === 'full-wave-midpoint'
    ? currentSwitches.s2 !== 'removed'
    : currentSwitches.s3 !== 'removed' && currentSwitches.s4 !== 'removed';

  // Earliest firing angles for each loop
  const alphaPosDeg = topology === 'half-wave'
    ? (currentSwitches.s1 === 'diode' ? 0 : alpha)
    : topology === 'full-wave-midpoint'
    ? (currentSwitches.s1 === 'diode' ? 0 : alpha)
    : (currentSwitches.s1 === 'diode' && currentSwitches.s2 === 'diode' ? 0 : alpha);

  const alphaNegDeg = topology === 'half-wave'
    ? 999
    : topology === 'full-wave-midpoint'
    ? (currentSwitches.s2 === 'diode' ? 180 : 180 + alpha)
    : (currentSwitches.s3 === 'diode' && currentSwitches.s4 === 'diode' ? 180 : 180 + alpha);

  for (let step = 0; step < totalPoints; step++) {
    const t = step * dt;
    const cycleIndex = Math.floor(step / pointsPerCycle);
    const thetaRad = (omega * t) % (2 * Math.PI);
    const thetaDeg = (thetaRad * 180) / Math.PI;

    const vs = vm * Math.sin(thetaRad);

    let vo = 0;
    let gate1 = 0;
    let gate2 = 0;
    let gate3 = 0;
    let gate4 = 0;
    let vThyristor1 = 0;
    let iFwd = 0;
    let is = 0;
    const activeThyristors: string[] = [];

    // Gate pulse active window
    const gateWindowDeg = 4;
    const isGatePosActive = Math.abs(thetaDeg - alpha) < gateWindowDeg && thetaDeg >= alpha;
    const isGateNegActive = Math.abs(thetaDeg - (180 + alpha)) < gateWindowDeg && thetaDeg >= 180 + alpha;

    let vA = 0;
    let vB = 0;
    let vC = 0;
    let vAb = 0;
    let vBc = 0;
    let vCa = 0;
    let gate5 = 0;
    let gate6 = 0;

    if (currentSwitches.s1 === 'thyristor' && isGatePosActive) gate1 = 1;
    if (currentSwitches.s2 === 'thyristor' && isGatePosActive) gate2 = 1;
    if (currentSwitches.s3 === 'thyristor' && isGateNegActive) gate3 = 1;
    if (currentSwitches.s4 === 'thyristor' && isGateNegActive) gate4 = 1;

    // Simulation logic based on topology
    if (is3Phase) {
      vA = vmPhase * Math.sin(thetaRad);
      vB = vmPhase * Math.sin(thetaRad - (2 * Math.PI) / 3);
      vC = vmPhase * Math.sin(thetaRad + (2 * Math.PI) / 3);

      vAb = vA - vB;
      vBc = vB - vC;
      vCa = vC - vA;
      const vBa = -vAb;
      const vCb = -vBc;
      const vAc = -vCa;

      const s1Name = currentSwitches.s1 === 'diode' ? 'D1' : 'T1';
      const s2Name = currentSwitches.s2 === 'diode' ? 'D2' : 'T2';
      const s3Name = currentSwitches.s3 === 'diode' ? 'D3' : 'T3';
      const s4Name = currentSwitches.s4 === 'diode' ? 'D4' : 'T4';
      const s5Name = currentSwitches.s5 === 'diode' ? 'D5' : 'T5';
      const s6Name = currentSwitches.s6 === 'diode' ? 'D6' : 'T6';

      // Gate pulse detection for thyristors
      const isGate = (targetDeg: number) => {
        const diff = (thetaDeg - targetDeg + 720) % 360;
        return diff < 4;
      };

      if (currentSwitches.s1 === 'thyristor' && isGate(alpha + 30)) gate1 = 1;
      if (currentSwitches.s3 === 'thyristor' && isGate(alpha + 150)) gate3 = 1;
      if (currentSwitches.s5 === 'thyristor' && isGate(alpha + 270)) gate5 = 1;

      if (topology === 'three-phase-full') {
        if (currentSwitches.s2 === 'thyristor' && isGate(alpha + 90)) gate2 = 1;
        if (currentSwitches.s4 === 'thyristor' && isGate(alpha + 210)) gate4 = 1;
        if (currentSwitches.s6 === 'thyristor' && isGate(alpha + 330)) gate6 = 1;
      }

      let rawVo = 0;
      let upperSwitch = s1Name;
      let lowerSwitch = s6Name;
      let isUpperRemoved = false;
      let isLowerRemoved = false;
      let isFreewheeling = false;

      if (topology === 'three-phase-semi') {
        // =========================================================================
        // THREE-PHASE SEMI-CONVERTER (3 SCRs on Top, 3 Diodes on Bottom)
        // Natural diode commutation: D6 (B) from 330°-90°, D2 (C) from 90°-210°, D4 (A) from 210°-330°
        // SCR firing: T1 at 30°+alpha, T3 at 150°+alpha, T5 at 270°+alpha
        // =========================================================================
        const tDeg = (thetaDeg + 720) % 360;

        if (alpha <= 60) {
          // Continuous 6-pulse regime without freewheeling
          const p1Start = (30 + alpha) % 360;
          const p2Start = 90;
          const p3Start = 150 + alpha;
          const p4Start = 210;
          const p5Start = 270 + alpha;
          const p6Start = 330;

          // Standard 6 conduction segments
          if ((tDeg >= p1Start && tDeg < p2Start) || (p1Start > p2Start && (tDeg >= p1Start || tDeg < p2Start))) {
            rawVo = vAb; upperSwitch = s1Name; lowerSwitch = s6Name;
            isUpperRemoved = currentSwitches.s1 === 'removed'; isLowerRemoved = currentSwitches.s6 === 'removed';
          } else if (tDeg >= p2Start && tDeg < p3Start) {
            rawVo = vAc; upperSwitch = s1Name; lowerSwitch = s2Name;
            isUpperRemoved = currentSwitches.s1 === 'removed'; isLowerRemoved = currentSwitches.s2 === 'removed';
          } else if (tDeg >= p3Start && tDeg < p4Start) {
            rawVo = vBc; upperSwitch = s3Name; lowerSwitch = s2Name;
            isUpperRemoved = currentSwitches.s3 === 'removed'; isLowerRemoved = currentSwitches.s2 === 'removed';
          } else if (tDeg >= p4Start && tDeg < p5Start) {
            rawVo = vBa; upperSwitch = s3Name; lowerSwitch = s4Name;
            isUpperRemoved = currentSwitches.s3 === 'removed'; isLowerRemoved = currentSwitches.s4 === 'removed';
          } else if (tDeg >= p5Start && tDeg < p6Start) {
            rawVo = vCa; upperSwitch = s5Name; lowerSwitch = s4Name;
            isUpperRemoved = currentSwitches.s5 === 'removed'; isLowerRemoved = currentSwitches.s4 === 'removed';
          } else {
            rawVo = vCb; upperSwitch = s5Name; lowerSwitch = s6Name;
            isUpperRemoved = currentSwitches.s5 === 'removed'; isLowerRemoved = currentSwitches.s6 === 'removed';
          }
        } else {
          // Discontinuous / 3-pulse regime with freewheeling periods (alpha > 60°)
          const fire1 = 30 + alpha;
          const zero1 = 150;
          const fire2 = 150 + alpha;
          const zero2 = 270;
          const fire3 = (270 + alpha) % 360;
          const zero3 = 30;

          if (tDeg >= fire1 && tDeg < zero1) {
            // Pulse 1: T1 and D2 conduct (Vac)
            rawVo = vAc; upperSwitch = s1Name; lowerSwitch = s2Name;
            isUpperRemoved = currentSwitches.s1 === 'removed'; isLowerRemoved = currentSwitches.s2 === 'removed';
          } else if (tDeg >= zero1 && tDeg < fire2) {
            // Freewheeling interval 1: T1 & D4 in Leg 1 (or FWD)
            isFreewheeling = true;
            rawVo = 0; upperSwitch = s1Name; lowerSwitch = s4Name;
          } else if (tDeg >= fire2 && tDeg < zero2) {
            // Pulse 2: T3 and D4 conduct (Vba)
            rawVo = vBa; upperSwitch = s3Name; lowerSwitch = s4Name;
            isUpperRemoved = currentSwitches.s3 === 'removed'; isLowerRemoved = currentSwitches.s4 === 'removed';
          } else if (tDeg >= zero2 && (tDeg < fire3 || fire3 < zero2)) {
            // Freewheeling interval 2: T3 & D6 in Leg 2 (or FWD)
            isFreewheeling = true;
            rawVo = 0; upperSwitch = s3Name; lowerSwitch = s6Name;
          } else if ((fire3 > zero3 && (tDeg >= fire3 || tDeg < zero3)) || (fire3 <= zero3 && tDeg >= fire3 && tDeg < zero3)) {
            // Pulse 3: T5 and D6 conduct (Vcb)
            rawVo = vCb; upperSwitch = s5Name; lowerSwitch = s6Name;
            isUpperRemoved = currentSwitches.s5 === 'removed'; isLowerRemoved = currentSwitches.s6 === 'removed';
          } else {
            // Freewheeling interval 3: T5 & D2 in Leg 3 (or FWD)
            isFreewheeling = true;
            rawVo = 0; upperSwitch = s5Name; lowerSwitch = s2Name;
          }
        }

      } else {
        // =========================================================================
        // THREE-PHASE FULLY CONTROLLED BRIDGE CONVERTER (6 SCRs)
        // 60-degree shifted conduction intervals starting at theta = 30° + alpha
        // =========================================================================
        const shiftedDeg = (thetaDeg - alpha - 30 + 720) % 360;

        if (shiftedDeg < 60) {
          rawVo = vAb;
          upperSwitch = s1Name;
          lowerSwitch = s6Name;
          isUpperRemoved = currentSwitches.s1 === 'removed';
          isLowerRemoved = currentSwitches.s6 === 'removed';
        } else if (shiftedDeg < 120) {
          rawVo = vAc;
          upperSwitch = s1Name;
          lowerSwitch = s2Name;
          isUpperRemoved = currentSwitches.s1 === 'removed';
          isLowerRemoved = currentSwitches.s2 === 'removed';
        } else if (shiftedDeg < 180) {
          rawVo = vBc;
          upperSwitch = s3Name;
          lowerSwitch = s2Name;
          isUpperRemoved = currentSwitches.s3 === 'removed';
          isLowerRemoved = currentSwitches.s2 === 'removed';
        } else if (shiftedDeg < 240) {
          rawVo = vBa;
          upperSwitch = s3Name;
          lowerSwitch = s4Name;
          isUpperRemoved = currentSwitches.s3 === 'removed';
          isLowerRemoved = currentSwitches.s4 === 'removed';
        } else if (shiftedDeg < 300) {
          rawVo = vCa;
          upperSwitch = s5Name;
          lowerSwitch = s4Name;
          isUpperRemoved = currentSwitches.s5 === 'removed';
          isLowerRemoved = currentSwitches.s4 === 'removed';
        } else {
          rawVo = vCb;
          upperSwitch = s5Name;
          lowerSwitch = s6Name;
          isUpperRemoved = currentSwitches.s5 === 'removed';
          isLowerRemoved = currentSwitches.s6 === 'removed';
        }
      }

      if (isUpperRemoved || isLowerRemoved) {
        vo = loadType === 'RLE' ? E : 0;
        is = 0;
      } else if (isFreewheeling) {
        vo = 0;
        iFwd = io;
        activeThyristors.push(upperSwitch, lowerSwitch);
        is = 0;
      } else if (topology === 'three-phase-semi' && rawVo < 0) {
        // Additional clamp for semi-converter
        vo = 0;
        iFwd = io;
        activeThyristors.push(upperSwitch, lowerSwitch);
        is = 0;
      } else if (topology === 'three-phase-full' && rawVo < 0 && effectiveFwd) {
        vo = 0;
        iFwd = io;
        activeThyristors.push('FWD');
        is = 0;
      } else if (topology === 'three-phase-full' && rawVo < 0 && loadType === 'R') {
        vo = 0;
        is = 0;
      } else {
        vo = rawVo;
        activeThyristors.push(upperSwitch, lowerSwitch);
        if (upperSwitch.includes('1')) is = io;
        else if (lowerSwitch.includes('4')) is = -io;
        else is = 0;
      }

      vThyristor1 = activeThyristors.some(n => n.includes('1')) ? 0 : vA - (upperSwitch.includes('3') ? vB : upperSwitch.includes('5') ? vC : 0);

    } else if (topology === 'half-wave') {
      const s1Label = currentSwitches.s1 === 'diode' ? 'D1' : 'T1';
      let canConduct = canLoopPos;
      if (loadType === 'RLE') {
        canConduct = canConduct && vs > E && (thetaDeg >= alphaPosDeg && thetaDeg < 180);
      } else {
        canConduct = canConduct && (thetaDeg >= alphaPosDeg && thetaDeg < 180);
      }

      if (effectiveFwd) {
        if (canConduct) {
          vo = vs;
          activeThyristors.push(s1Label);
        } else if (io > 0.001) {
          vo = 0;
          activeThyristors.push('FWD');
          iFwd = io;
        } else {
          vo = loadType === 'RLE' ? E : 0;
        }
      } else {
        if (canConduct || (io > 0.005 && thetaDeg >= alphaPosDeg && thetaDeg < betaDeg && canLoopPos)) {
          vo = vs;
          activeThyristors.push(s1Label);
        } else {
          vo = loadType === 'RLE' ? E : 0;
        }
      }

      is = activeThyristors.includes(s1Label) ? io : 0;
      vThyristor1 = activeThyristors.includes(s1Label) ? 0 : vs - vo;

    } else if (topology === 'full-wave-midpoint') {
      const s1Label = currentSwitches.s1 === 'diode' ? 'D1' : 'T1';
      const s2Label = currentSwitches.s2 === 'diode' ? 'D2' : 'T2';

      const isPosWindow = canLoopPos && (thetaDeg >= alphaPosDeg && thetaDeg < 180);
      const isNegWindow = canLoopNeg && (thetaDeg >= alphaNegDeg && thetaDeg < 360);

      if (effectiveFwd) {
        if (isPosWindow) {
          vo = vs;
          activeThyristors.push(s1Label);
          is = io;
        } else if (isNegWindow) {
          vo = -vs;
          activeThyristors.push(s2Label);
          is = -io;
        } else if (io > 0.001) {
          vo = 0;
          activeThyristors.push('FWD');
          iFwd = io;
        } else {
          vo = loadType === 'RLE' ? E : 0;
        }
      } else {
        // Continuous or discontinuous check
        const inPosCond = canLoopPos && (
          (thetaDeg >= alphaPosDeg && thetaDeg < 180) ||
          (io > 0.005 && thetaDeg >= alphaPosDeg && thetaDeg < betaDeg)
        );
        const inNegCond = canLoopNeg && (
          (thetaDeg >= alphaNegDeg && thetaDeg < 360) ||
          (io > 0.005 && thetaDeg >= alphaNegDeg && thetaDeg < 180 + betaDeg)
        );

        if (inPosCond) {
          vo = vs;
          activeThyristors.push(s1Label);
          is = io;
        } else if (inNegCond) {
          vo = -vs;
          activeThyristors.push(s2Label);
          is = -io;
        } else {
          vo = loadType === 'RLE' ? E : 0;
        }
      }

      vThyristor1 = activeThyristors.includes(s1Label) ? 0 : vs - vo;

    } else {
      // Full-Wave Bridge or Semi-Converter or Custom 4-arm Bridge
      const s1Name = currentSwitches.s1 === 'diode' ? 'D1' : 'T1';
      const s2Name = currentSwitches.s2 === 'diode' ? 'D2' : 'T2';
      const s3Name = currentSwitches.s3 === 'diode' ? 'D3' : 'T3';
      const s4Name = currentSwitches.s4 === 'diode' ? 'D4' : 'T4';

      const isPos = thetaDeg < 180;
      const isNeg = thetaDeg >= 180;

      if (effectiveFwd) {
        // Diode clamping or FWD present: vo >= 0
        if (canLoopPos && thetaDeg >= alphaPosDeg && thetaDeg < 180) {
          vo = vs;
          activeThyristors.push(s1Name, s2Name);
          is = io;
        } else if (canLoopNeg && thetaDeg >= alphaNegDeg && thetaDeg < 360) {
          vo = -vs;
          activeThyristors.push(s3Name, s4Name);
          is = -io;
        } else if (io > 0.001) {
          vo = 0;
          if (hasLeg1DiodeFreewheel) {
            activeThyristors.push('D1', 'D4');
          } else if (hasLeg2DiodeFreewheel) {
            activeThyristors.push('D3', 'D2');
          } else if (hasBottomDiodeFreewheel) {
            activeThyristors.push('D4', 'D2');
          } else if (hasTopDiodeFreewheel) {
            activeThyristors.push('D1', 'D3');
          } else if (hasDedicatedFwd) {
            activeThyristors.push('FWD');
          } else {
            activeThyristors.push('FREEWHEEL');
          }
          iFwd = io;
          is = 0;
        } else {
          vo = loadType === 'RLE' ? E : 0;
          is = 0;
        }
      } else {
        // Fully-controlled or custom bridge without freewheel
        const condBoundary = 180 + alpha;
        const isBothLoopsAvailable = canLoopPos && canLoopNeg;

        if (isBothLoopsAvailable && (betaDeg >= condBoundary || loadType === 'HIGHLY_INDUCTIVE')) {
          isContinuous = true;
          if (thetaDeg >= alphaPosDeg && thetaDeg < 180 + alpha) {
            vo = vs;
            activeThyristors.push(s1Name, s2Name);
            is = io;
          } else {
            vo = -vs;
            activeThyristors.push(s3Name, s4Name);
            is = -io;
          }
        } else {
          // Discontinuous conduction
          if (canLoopPos && ((thetaDeg >= alphaPosDeg && thetaDeg < 180) || (io > 0.005 && thetaDeg >= alphaPosDeg && thetaDeg < betaDeg))) {
            vo = vs;
            activeThyristors.push(s1Name, s2Name);
            is = io;
          } else if (canLoopNeg && ((thetaDeg >= alphaNegDeg && thetaDeg < 360) || (io > 0.005 && thetaDeg >= alphaNegDeg && thetaDeg < 180 + betaDeg))) {
            vo = -vs;
            activeThyristors.push(s3Name, s4Name);
            is = -io;
          } else {
            vo = loadType === 'RLE' ? E : 0;
            is = 0;
          }
        }
      }

      vThyristor1 = activeThyristors.includes(s1Name) ? 0 : vs - (isPos ? vo : 0);
    }

    // Dynamic current update (di/dt = (vo - R*io - E) / L)
    if (loadType === 'R') {
      io = Math.max(0, vo / R);
      if (activeThyristors.some(n => n.includes('1'))) is = io;
      else if (activeThyristors.some(n => n.includes('3'))) is = -io;
      else is = 0;
    } else if (loadType === 'HIGHLY_INDUCTIVE') {
      const approxVdc = topology === 'half-wave' 
        ? (vm / (2 * Math.PI)) * (1 + Math.cos(alphaRad))
        : effectiveFwd 
          ? (vm / Math.PI) * (1 + Math.cos(alphaRad))
          : (2 * vm / Math.PI) * Math.cos(alphaRad);
      const targetIdc = Math.max(0.05, (approxVdc - E) / R);
      io = targetIdc;
      if (activeThyristors.some(n => n.includes('1'))) is = io;
      else if (activeThyristors.some(n => n.includes('3'))) is = -io;
      else is = 0;
    } else {
      let drivingVolt = vo - E;
      if (activeThyristors.length === 0 && io <= 0.001) {
        io = 0;
      } else {
        const k1 = (drivingVolt - R * io) / L;
        const ioPredicted = Math.max(0, io + k1 * dt);
        const k2 = (drivingVolt - R * ioPredicted) / L;
        io = Math.max(0, io + 0.5 * (k1 + k2) * dt);
      }
      
      if (activeThyristors.some(n => n.includes('1'))) {
        is = io;
      } else if (activeThyristors.some(n => n.includes('3'))) {
        is = -io;
      } else {
        is = 0;
      }
    }

    if (cycleIndex >= numCyclesSim - 2) {
      const displayThetaDeg = (cycleIndex - (numCyclesSim - 2)) * 360 + thetaDeg;
      const displayTimeMs = (step - (numCyclesSim - 2) * pointsPerCycle) * dt * 1000;

      allSamples.push({
        timeMs: Number(displayTimeMs.toFixed(3)),
        thetaDeg: Math.round(displayThetaDeg),
        thetaRad,
        vs: Number((is3Phase ? vA : vs).toFixed(2)),
        vA: is3Phase ? Number(vA.toFixed(2)) : undefined,
        vB: is3Phase ? Number(vB.toFixed(2)) : undefined,
        vC: is3Phase ? Number(vC.toFixed(2)) : undefined,
        vAb: is3Phase ? Number(vAb.toFixed(2)) : undefined,
        vBc: is3Phase ? Number(vBc.toFixed(2)) : undefined,
        vCa: is3Phase ? Number(vCa.toFixed(2)) : undefined,
        is: Number(is.toFixed(2)),
        vo: Number(vo.toFixed(2)),
        io: Number(io.toFixed(3)),
        vThyristor1: Number(vThyristor1.toFixed(2)),
        gate1,
        gate2,
        gate3,
        gate4,
        gate5: is3Phase ? gate5 : undefined,
        gate6: is3Phase ? gate6 : undefined,
        iFwd: Number(iFwd.toFixed(3)),
        activeThyristors,
      });
    }
  }

  // Use the samples from one complete steady-state cycle (360 points) to compute statistics
  const oneCycleSamples = allSamples.slice(0, pointsPerCycle);

  let sumVo = 0;
  let sumVoSq = 0;
  let sumIo = 0;
  let sumIoSq = 0;
  let sumIsSq = 0;
  let sumPower = 0;
  let minIo = Infinity;

  for (const s of oneCycleSamples) {
    sumVo += s.vo;
    sumVoSq += s.vo * s.vo;
    sumIo += s.io;
    sumIoSq += s.io * s.io;
    sumIsSq += s.is * s.is;
    sumPower += s.vo * s.io;
    if (s.io < minIo) minIo = s.io;
  }

  const n = oneCycleSamples.length;
  const vDc = sumVo / n;
  const vRmsOut = Math.sqrt(sumVoSq / n);
  const iDc = sumIo / n;
  const iRmsOut = Math.sqrt(sumIoSq / n);
  const isRms = Math.sqrt(sumIsSq / n);
  const pDc = Math.max(0, vDc * iDc);
  const pAcOut = Math.max(0, sumPower / n);

  if (minIo > 0.05 && loadType !== 'R') {
    isContinuous = true;
  }

  // Form factor & Ripple factor
  const formFactor = vDc > 0.001 ? vRmsOut / vDc : 0;
  const rippleFactor = formFactor >= 1 ? Math.sqrt(formFactor * formFactor - 1) : 0;
  const efficiency = pAcOut > 0.001 ? (pDc / pAcOut) * 100 : 0;

  // Transformer Utilization Factor (TUF)
  const vsRms = is3Phase ? vLineRms : vRms;
  const sIn = is3Phase ? Math.sqrt(3) * vsRms * isRms : vsRms * isRms;
  const tuf = sIn > 0.001 ? pDc / sIn : is3Phase ? 0.955 : 0.812;

  // Peak Inverse Voltage (PIV)
  let piv = is3Phase ? vmLine : vm;
  if (topology === 'full-wave-midpoint') {
    piv = 2 * vm;
  }

  // Discrete Fourier Transform for Harmonics of Output Voltage & Input Current
  const harmonics: HarmonicComponent[] = [];
  let fundVoMag = 1;
  let fundIsMag = 1;

  const maxHarmonicOrder = is3Phase ? 18 : 10;
  for (let k = 0; k <= maxHarmonicOrder; k++) {
    let anV = 0;
    let bnV = 0;
    let anI = 0;
    let bnI = 0;

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * k * i) / n;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      anV += oneCycleSamples[i].vo * cosA;
      bnV += oneCycleSamples[i].vo * sinA;
      anI += oneCycleSamples[i].is * cosA;
      bnI += oneCycleSamples[i].is * sinA;
    }

    anV = (2 / n) * anV;
    bnV = (2 / n) * bnV;
    anI = (2 / n) * anI;
    bnI = (2 / n) * bnI;

    const magV = k === 0 ? Math.abs(vDc) : Math.sqrt(anV * anV + bnV * bnV);
    const magI = k === 0 ? Math.abs(iDc) : Math.sqrt(anI * anI + bnI * bnI);

    if (k === 1) {
      fundVoMag = Math.max(0.001, magV);
      fundIsMag = Math.max(0.001, magI);
    }

    harmonics.push({
      order: k,
      frequency: k * freq,
      voltageAmp: Number(magV.toFixed(2)),
      voltagePercent: k === 0 ? 100 : Number(((magV / fundVoMag) * 100).toFixed(1)),
      currentAmp: Number(magI.toFixed(2)),
      currentPercent: k === 0 ? 100 : Number(((magI / fundIsMag) * 100).toFixed(1)),
    });
  }

  // Total Harmonic Distortion
  let sumHarmonicSqV = 0;
  for (let k = 2; k < harmonics.length; k++) {
    sumHarmonicSqV += harmonics[k].voltageAmp * harmonics[k].voltageAmp;
  }
  const thdVoltage = fundVoMag > 0 ? (Math.sqrt(sumHarmonicSqV) / fundVoMag) * 100 : 0;

  let sumHarmonicSqI = 0;
  for (let k = 2; k < harmonics.length; k++) {
    sumHarmonicSqI += harmonics[k].currentAmp * harmonics[k].currentAmp;
  }
  const thdCurrent = fundIsMag > 0 ? (Math.sqrt(sumHarmonicSqI) / fundIsMag) * 100 : 0;

  // Displacement Power Factor (DPF = cos(phi_1))
  const dpf = Math.cos(alphaRad);
  const inputPf = isRms > 0.001 ? pAcOut / (vRms * isRms) : Math.cos(alphaRad) * 0.9;

  return {
    vm: Number(vm.toFixed(2)),
    omega: Number(omega.toFixed(1)),
    periodMs: Number(periodMs.toFixed(2)),
    impedance: Number(impedance.toFixed(2)),
    phiDeg: Number(phiDeg.toFixed(1)),
    betaDeg: Number(betaDeg.toFixed(1)),
    gammaDeg: Number(gammaDeg.toFixed(1)),
    isContinuous,
    alphaMinDeg: Number(alphaMinDeg.toFixed(1)),
    vDc: Number(vDc.toFixed(2)),
    vRmsOut: Number(vRmsOut.toFixed(2)),
    iDc: Number(iDc.toFixed(3)),
    iRmsOut: Number(iRmsOut.toFixed(3)),
    pDc: Number(pDc.toFixed(2)),
    pAcOut: Number(pAcOut.toFixed(2)),
    formFactor: Number(formFactor.toFixed(3)),
    rippleFactor: Number(rippleFactor.toFixed(3)),
    efficiency: Number(Math.min(100, efficiency).toFixed(1)),
    tuf: Number(tuf.toFixed(3)),
    piv: Number(piv.toFixed(1)),
    thdVoltage: Number(thdVoltage.toFixed(1)),
    thdCurrent: Number(thdCurrent.toFixed(1)),
    dpf: Number(Math.max(-1, Math.min(1, dpf)).toFixed(3)),
    inputPf: Number(Math.max(0, Math.min(1, inputPf)).toFixed(3)),
    harmonics,
    samples: allSamples,
  };
}
