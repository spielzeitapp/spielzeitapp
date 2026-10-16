/** BPM estimate from positive changes in short-window energy. No invented BPM
 * for silence, sustained tones or recordings without a clear periodic pulse. */
export function estimateBpm(samples: Float32Array, sampleRate: number): number | null {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length < sampleRate * 8) return null;
  const hop = Math.max(1, Math.round(sampleRate / 200));
  const count = Math.min(Math.floor(samples.length / hop), 200 * 90);
  const onset = new Float32Array(count);
  let previous = 0, energySum = 0, energySquares = 0;
  for (let frame = 0; frame < count; frame++) {
    let sum = 0;
    const end = Math.min(samples.length, (frame + 4) * hop);
    for (let j = frame * hop; j < end; j++) sum += samples[j] * samples[j];
    const energy = Math.sqrt(sum / (end - frame * hop));
    energySum += energy; energySquares += energy * energy;
    onset[frame] = Math.max(0, energy - previous);
    previous = energy;
  }
  const energyMean = energySum / count;
  const energyVariation = Math.sqrt(Math.max(0, energySquares / count - energyMean ** 2));
  if (energyMean < .0001 || energyVariation / energyMean < .08) return null;
  const rate = sampleRate / hop;
  const mean = onset.reduce((sum, value) => sum + value, 0) / count;
  let power = 0;
  for (let i = 0; i < count; i++) { onset[i] = Math.max(0, onset[i] - mean); power += onset[i] ** 2; }
  if (power / count < 1e-8) return null;
  // Use normalized autocorrelation; include several beat intervals to avoid
  // selecting a lone accidental peak. Half/double-time ambiguity can be edited.
  const minLag = Math.ceil(rate * 60 / 180), maxLag = Math.floor(rate * 60 / 65);
  const correlation = (lag: number) => {
    let sum = 0, left = 0, right = 0;
    for (let i = lag; i < count; i++) { sum += onset[i] * onset[i - lag]; left += onset[i] ** 2; right += onset[i - lag] ** 2; }
    return sum / Math.sqrt(left * right || 1);
  };
  const scores = new Map<number, number>();
  let bestLag = 0, best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const score = correlation(lag) + .4 * correlation(lag * 2) + .2 * correlation(lag * 3);
    scores.set(lag, score);
    if (score > best) { best = score; bestLag = lag; }
  }
  if (best < .25) return null;
  // Quantization can make a two-beat lag score slightly above a one-beat
  // lag. Prefer the fundamental pulse when its score is almost as strong.
  for (let lag = Math.max(minLag, Math.floor(bestLag / 2) - 1); lag <= Math.min(maxLag, Math.ceil(bestLag / 2) + 1); lag++) {
    if ((scores.get(lag) ?? 0) >= best * .75) { bestLag = lag; best = scores.get(lag)!; break; }
  }
  // Parabolic interpolation avoids whole-frame BPM rounding.
  const left = scores.get(bestLag - 1) ?? best, right = scores.get(bestLag + 1) ?? best;
  const divisor = left - 2 * best + right;
  const offset = divisor ? Math.max(-.5, Math.min(.5, .5 * (left - right) / divisor)) : 0;
  return Math.round(60 * rate / (bestLag + offset) * 10) / 10;
}

export function validBpm(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 40 && value <= 240;
}

/** Returns null rather than claiming sync when the +/-20% transport limit
 * cannot reach the other deck's actual BPM. */
export function syncTempo(baseBpm: number, targetBpm: number): number | null {
  if (!validBpm(baseBpm) || !Number.isFinite(targetBpm) || targetBpm <= 0) return null;
  const rate = targetBpm / baseBpm;
  return rate >= .8 && rate <= 1.2 ? Math.round(rate * 100000) / 100000 : null;
}

export function bpmFromTaps(taps: number[]): number | null {
  if (taps.length < 4) return null;
  const intervals = taps.slice(1).map((time, i) => time - taps[i]);
  if (intervals.some(value => value <= 0 || value > 2000)) return null;
  const median = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
  const stable = intervals.filter(value => Math.abs(value - median) <= median * .2);
  if (stable.length < 3) return null;
  const bpm = Math.round(60000 / (stable.reduce((sum, value) => sum + value, 0) / stable.length) * 10) / 10;
  return validBpm(bpm) ? bpm : null;
}

export async function analyzeAudioBpm(file: Blob): Promise<number | null> {
  if (file.size > 16 * 1024 * 1024) return null;
  const Ctor = window.OfflineAudioContext || (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctor) throw new Error('BPM-Analyse wird hier nicht unterstützt.');
  // Decode at a low sample rate to limit memory on phones. Audio never leaves
  // the device. Decode failure does not affect the playback context.
  const context = new Ctor(1, 1, 11025);
  const audio = await context.decodeAudioData(await file.arrayBuffer());
  return estimateBpm(audio.getChannelData(0), audio.sampleRate);
}
