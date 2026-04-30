// === 1. GLOBAL STATE OBJECT ===
const state = {
  isRacing: false,
  firstPlaceAnnounced: false,
  raceStartTime: 0,
  timerInterval: null,
  countdownTimer: null,
  totalSteps: 11,
  racers: {
    finn:  { step: 0, finished: false, nameDisplay: 'Finn',  finishOffset: 'calc(150% + 15px)', mobileFinishOffset: 'calc(100% / 12 * 11.5 - 15px)' },
    bowen: { step: 0, finished: false, nameDisplay: 'Bowen', finishOffset: 'calc(-50% - 15px)',  mobileFinishOffset: 'calc(100% / 12 * 11.5 - 15px)' }
  }
};

let audioCtx = null;

// === 2. DOM ELEMENT CACHE ===
const ui = {
  startBtn: document.getElementById('start-btn'),
  resetBtn: document.getElementById('reset-btn'),
  countdownOverlay: document.getElementById('countdown-overlay'),
  countdownText: document.getElementById('countdown-text'),
  lanes:  { finn: document.getElementById('finn-lane'), bowen: document.getElementById('bowen-lane') },
  timers: { finn: document.getElementById('finn-timer'), bowen: document.getElementById('bowen-timer') },
  cars:   { finn: document.getElementById('finn-car'),  bowen: document.getElementById('bowen-car') },
  tracks: { finn: document.getElementById('finn-track'), bowen: document.getElementById('bowen-track') }
};

const isMobile = () => window.matchMedia('(max-width: 1024px)').matches;

// === 3. AUDIO ENGINE ===
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, type, duration, vol) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const playTick    = () => playTone(800, 'triangle', 0.05, 0.3);
const playBeep    = () => playTone(440, 'square',   0.2,  0.2);
const playGoBeep  = () => playTone(880, 'square',   0.5,  0.3);
const playReverse = () => playTone(280, 'sawtooth', 0.25, 0.25);

// === 4. RENDER FUNCTIONS ===
function renderCarPosition(racerId) {
  const step = state.racers[racerId].step;
  const colWidth = 100 / 12;
  const startOffset = (isMobile() && step === 0) ? colWidth / 2 : 0;
  const targetPosition = (colWidth * step) + (colWidth / 2) + startOffset;

  if (isMobile()) {
    const topValue = step === 0 ? `calc(${targetPosition}% - 40px)` : `calc(${targetPosition}%)`;
    ui.cars[racerId].style.top  = topValue;
    ui.cars[racerId].style.left = '40%';
    ui.tracks[racerId].style.height = step === 0 ? '0' : `calc(${targetPosition}%)`;
    ui.tracks[racerId].style.width  = '';
  } else {
    ui.cars[racerId].style.left = `calc(${targetPosition}%)`;
    ui.cars[racerId].style.top  = '';
    ui.tracks[racerId].style.width  = step === 0 ? '0' : `calc(${targetPosition}%)`;
    ui.tracks[racerId].style.height = '';
  }
}

function renderSplitMarker(racerId, timeString) {
  const step = state.racers[racerId].step;
  const splitEl = document.createElement('div');
  splitEl.className = 'split-time';
  splitEl.innerText = timeString;

  const colWidth = 100 / 12;
  const targetPosition = (colWidth * step) + (colWidth / 2);

  if (isMobile()) {
    splitEl.style.top = `calc(${targetPosition}%)`;
    // left/right pinned to outer edge per lane via CSS
  } else {
    splitEl.style.left = `calc(${targetPosition}%)`;
  }

  ui.lanes[racerId].appendChild(splitEl);
}

function renderTimers() {
  if (!state.isRacing) return;
  const elapsed = ((Date.now() - state.raceStartTime) / 1000).toFixed(1) + "s";

  Object.keys(state.racers).forEach(racerId => {
    if (!state.racers[racerId].finished) {
      ui.timers[racerId].innerText = elapsed;
    }
  });
}

// === 5. GAME LOGIC ===
function handleCountdown() {
  if (state.isRacing || state.firstPlaceAnnounced) return;
  initAudio();

  ui.startBtn.style.opacity = '0.5';
  ui.startBtn.style.pointerEvents = 'none';
  ui.countdownOverlay.style.display = 'flex';

  let count = 3;
  ui.countdownText.innerText = count;
  ui.countdownText.style.animation = 'none';
  void ui.countdownText.offsetWidth;
  ui.countdownText.style.animation = 'pop 1s infinite';

  playBeep();

  state.countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      ui.countdownText.innerText = count;
      playBeep();
    } else if (count === 0) {
      ui.countdownText.innerText = "GO!";
      ui.countdownText.style.color = "#2ecc71";
      ui.countdownText.style.textShadow = "10px 10px 0px #145a22";
      playGoBeep();

      state.raceStartTime = Date.now();
      state.timerInterval = setInterval(renderTimers, 100);
      state.isRacing = true;
      ui.startBtn.innerHTML = 'GO!';
      ui.startBtn.classList.add('is-go');
    } else {
      clearInterval(state.countdownTimer);
      ui.countdownOverlay.style.display = 'none';
      ui.countdownText.style.color = "#f1c40f";
      ui.countdownText.style.textShadow = "";
    }
  }, 1000);
}

function addResultText(racerId, isWinner) {
  const el = document.createElement('div');
  el.className = isWinner ? 'result-text' : 'result-text loser';
  el.innerHTML = isWinner ? 'WINNER!' : 'BETTER LUCK<br>NEXT TIME';
  ui.lanes[racerId].appendChild(el);
}

function handleFinishLine(racerId) {
  const racer = state.racers[racerId];

  if (racer.step === state.totalSteps) {
    racer.finished = true;

    if (state.racers.finn.finished && state.racers.bowen.finished) {
      clearInterval(state.timerInterval);
    }

    const carEl = ui.cars[racerId];

    if (!state.firstPlaceAnnounced) {
      state.firstPlaceAnnounced = true;

      // Winner: reorient car and move it to the checkered finish square
      carEl.classList.add('finish-orientation');
      const laneRect  = ui.lanes[racerId].getBoundingClientRect();
      const trophyEl  = ui.lanes[racerId].querySelector('.trophy');
      if (isMobile()) {
        carEl.style.top = racer.mobileFinishOffset;
        const medianCenterX = window.innerWidth / 2;
        const leftPct = ((medianCenterX - laneRect.left) / laneRect.width) * 100;
        carEl.style.left   = `${leftPct.toFixed(1)}%`;
        trophyEl.style.left = `${leftPct.toFixed(1)}%`;
        trophyEl.style.top  = `calc(${racer.mobileFinishOffset} - 3.5rem)`;
      } else {
        // Desktop: median is the horizontal centre of the track container
        const trackRect    = document.querySelector('.track-container').getBoundingClientRect();
        const medianCenterY = trackRect.top + trackRect.height / 2;
        const topPct = ((medianCenterY - laneRect.top) / laneRect.height) * 100;
        carEl.style.top    = `${topPct.toFixed(1)}%`;
        trophyEl.style.top = `calc(${topPct.toFixed(1)}% - 3.5rem)`;
        // left is already at the finish-line position from renderCarPosition
      }

      ui.lanes[racerId].classList.add('is-winner');
      addResultText(racerId, true);

      confetti({ particleCount: 250, spread: 150, origin: { y: 0.4 }, zIndex: 1000 });

      window.speechSynthesis.cancel();
      const announcement = new SpeechSynthesisUtterance(`And the winner is... ${racer.nameDisplay}!`);
      announcement.pitch = 1.1;
      announcement.rate = 1.0;
      window.speechSynthesis.speak(announcement);
    } else {
      // Loser on mobile: match winner orientation and center in lane
      if (isMobile()) {
        carEl.classList.add('finish-orientation');
        carEl.style.left = '50%';
      }
      addResultText(racerId, false);
    }
  }
}

function advanceRacer(racerId) {
  if (!state.isRacing || state.racers[racerId].step >= state.totalSteps) return;
  playTick();
  state.racers[racerId].step++;

  if (state.racers[racerId].step < state.totalSteps) {
    const splitTime = ((Date.now() - state.raceStartTime) / 1000).toFixed(1) + "s";
    renderSplitMarker(racerId, splitTime);
  }

  renderCarPosition(racerId);
  handleFinishLine(racerId);

  if (isMobile()) {
    ui.cars[racerId].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function regressRacer(racerId) {
  if (!state.isRacing || state.racers[racerId].step === 0 || state.racers[racerId].finished) return;
  playReverse();
  state.racers[racerId].step--;

  const splits = ui.lanes[racerId].querySelectorAll('.split-time');
  if (splits.length > 0) splits[splits.length - 1].remove();

  renderCarPosition(racerId);
}

function resetRace() {
  state.isRacing = false;
  state.firstPlaceAnnounced = false;
  clearInterval(state.countdownTimer);
  clearInterval(state.timerInterval);
  ui.countdownOverlay.style.display = 'none';
  ui.countdownText.style.color = '#f1c40f';
  ui.countdownText.style.textShadow = '';

  document.querySelectorAll('.split-time').forEach(el => el.remove());
  document.querySelectorAll('.result-text').forEach(el => el.remove());
  window.speechSynthesis.cancel();

  ui.startBtn.style.opacity = '1';
  ui.startBtn.style.pointerEvents = 'auto';
  ui.startBtn.innerHTML = 'START YOUR<br>ENGINES';
  ui.startBtn.classList.remove('is-go');

  Object.keys(state.racers).forEach(racerId => {
    state.racers[racerId].step = 0;
    state.racers[racerId].finished = false;
    ui.timers[racerId].innerText = "0.0s";

    const carEl = ui.cars[racerId];
    carEl.classList.remove('finish-orientation');
    carEl.style.top  = '';
    carEl.style.left = '';
    const trophyEl = ui.lanes[racerId].querySelector('.trophy');
    trophyEl.style.left = '';
    trophyEl.style.top  = '';
    ui.lanes[racerId].classList.remove('is-winner');

    renderCarPosition(racerId);
  });

  if (isMobile()) {
    document.querySelector('.scroll-wrapper').scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// === 6. EVENT LISTENERS ===
ui.startBtn.addEventListener('click', handleCountdown);
ui.resetBtn.addEventListener('click', resetRace);

// Long-press = regress (anti-cheat), tap = advance
const longPressTimer = { finn: null, bowen: null };

function setupLane(racerId) {
  const lane = ui.lanes[racerId];

  lane.addEventListener('pointerdown', () => {
    longPressTimer[racerId] = setTimeout(() => {
      longPressTimer[racerId] = null;
      regressRacer(racerId);
    }, 600);
  });

  lane.addEventListener('pointerup', () => {
    if (longPressTimer[racerId]) {
      clearTimeout(longPressTimer[racerId]);
      longPressTimer[racerId] = null;
      advanceRacer(racerId);
    }
  });

  const cancelLongPress = () => {
    clearTimeout(longPressTimer[racerId]);
    longPressTimer[racerId] = null;
  };

  lane.addEventListener('pointerleave', cancelLongPress);
  lane.addEventListener('pointercancel', cancelLongPress);
  lane.addEventListener('contextmenu', e => e.preventDefault());
}

setupLane('finn');
setupLane('bowen');

// Run initial setup
renderCarPosition('finn');
renderCarPosition('bowen');
