export function createSound() {
  let context, master;
  let enabled = false;

  function init() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    context = new Audio();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const length = context.sampleRate * 3;
    const noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i++) {
      brown = (brown + .023 * (Math.random() * 2 - 1)) / 1.023;
      data[i] = brown * 2.1;
    }
    const wind = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const windGain = context.createGain();
    wind.buffer = noise;
    wind.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 410;
    windGain.gain.value = .13;
    wind.connect(filter).connect(windGain).connect(master);
    wind.start();
    for (const [frequency, volume] of [[55,.04],[82.42,.018],[110,.009]]) {
      const hum = context.createOscillator();
      const gain = context.createGain();
      hum.frequency.value = frequency;
      gain.gain.value = volume;
      hum.connect(gain).connect(master);
      hum.start();
    }
    return true;
  }

  async function toggle() {
    try {
      if (!context && !init()) return false;
      await context.resume();
      enabled = !enabled;
      master.gain.setTargetAtTime(enabled ? .66 : 0, context.currentTime, .27);
      return enabled;
    } catch {
      return false;
    }
  }

  function chime(type) {
    if (!enabled || !context) return;
    const notes = type === 'repair' ? [392, 587.33, 783.99] : [659.25, 987.77];
    notes.forEach((frequency, index) => {
      const tone = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * .12;
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.027/(index+1), start+.035);
      gain.gain.exponentialRampToValueAtTime(.0001, start+1.7);
      tone.connect(gain).connect(master);
      tone.start(start);
      tone.stop(start+1.75);
    });
  }
  return {toggle, chime};
}
