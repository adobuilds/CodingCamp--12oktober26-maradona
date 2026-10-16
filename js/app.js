// =============================================================================
// Todo Dashboard — app.js
// Self-contained Vanilla JS application.  No external dependencies.
// =============================================================================

// =============================================================================
// SECTION: Constants
// =============================================================================

/** Focus Timer duration in seconds (25 minutes). */
const TIMER_DURATION = 1500;

/** localStorage key names. */
const STORAGE_KEYS = {
  TASKS: 'todo_dashboard_tasks',
  LINKS: 'todo_dashboard_links',
};

/**
 * Greeting ranges keyed by greeting string.
 * Each entry is [startHour, endHour] (inclusive) in 24-hour time.
 * "Good Night" wraps midnight: hours 22–23 and 0–4.
 *
 * Requirements 1.3–1.6:
 *   05–11 → "Good Morning"
 *   12–17 → "Good Afternoon"
 *   18–21 → "Good Evening"
 *   22–04 → "Good Night"
 */
const GREETING_RANGES = [
  { greeting: 'Good Morning',   minHour: 5,  maxHour: 11 },
  { greeting: 'Good Afternoon', minHour: 12, maxHour: 17 },
  { greeting: 'Good Evening',   minHour: 18, maxHour: 21 },
  { greeting: 'Good Night',     minHour: 22, maxHour: 4  }, // wraps midnight
];

/** Full English weekday names, indexed by Date.getDay() (0 = Sunday). */
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Full English month names, indexed by Date.getMonth() (0 = January). */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// =============================================================================
// SECTION: Central Application State
// (Single source of truth — all modules read from and write to this object.)
// =============================================================================

/**
 * Top-level in-memory state.
 *
 * @type {{
 *   tasks: Array<{id: string, title: string, completed: boolean, createdAt: number}>,
 *   links: Array<{id: string, label: string, url: string}>,
 *   timer: {remaining: number, running: boolean, completed: boolean},
 * }}
 */
const state = {
  /** Ordered array of task objects (creation order maintained). */
  tasks: [],

  /** Ordered array of quick link objects. */
  links: [],

  /**
   * Focus Timer state.
   * Not persisted to localStorage (intentional design decision —
   * a Pomodoro timer that resumes from an arbitrary position is confusing UX).
   */
  timer: {
    remaining: TIMER_DURATION, // seconds left (0–1500)
    running: false,            // true while the setInterval is active
    completed: false,          // true once remaining hits 0
  },
};

// =============================================================================
// SECTION: Storage Module
// =============================================================================

/**
 * Module-level flag set to `true` if any localStorage read fails on initial
 * load (parse error, access error, or unavailable storage).
 * Checked by `main.init()` to decide whether to render the storage-warning banner.
 *
 * Requirements 5.1, 5.2
 */
let storageError = false;

/**
 * Reads and parses the tasks array from localStorage.
 * Returns an empty array on any error (parse failure, access error, etc.)
 * and sets the module-level `storageError` flag to `true`.
 *
 * @returns {Array<{id: string, title: string, completed: boolean, createdAt: number}>}
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (raw === null) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('[storage] loadTasks failed:', err);
    storageError = true;
    return [];
  }
}

/**
 * Serialises the tasks array and writes it to localStorage.
 *
 * @param {Array<{id: string, title: string, completed: boolean, createdAt: number}>} tasks
 * @returns {{ ok: true } | { ok: false, error: unknown }}
 */
function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return { ok: true };
  } catch (err) {
    console.error('[storage] saveTasks failed:', err);
    return { ok: false, error: err };
  }
}

/**
 * Reads and parses the quick-links array from localStorage.
 * Silently drops any entry whose stored URL is not a valid http/https URL
 * (Requirement 4.7).
 * Returns an empty array on any error and sets `storageError` to `true`.
 *
 * @returns {Array<{id: string, label: string, url: string}>}
 */
function loadLinks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LINKS);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    // Silently drop entries whose URL is no longer considered valid (Req 4.7).
    return parsed.filter(
      (link) => typeof link.url === 'string' && /^https?:\/\/[^.]+\.[^\s/$.?#][^\s]*$/i.test(link.url)
    );
  } catch (err) {
    console.error('[storage] loadLinks failed:', err);
    storageError = true;
    return [];
  }
}

/**
 * Serialises the quick-links array and writes it to localStorage.
 *
 * @param {Array<{id: string, label: string, url: string}>} links
 * @returns {{ ok: true } | { ok: false, error: unknown }}
 */
function saveLinks(links) {
  try {
    localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(links));
    return { ok: true };
  } catch (err) {
    console.error('[storage] saveLinks failed:', err);
    return { ok: false, error: err };
  }
}

// =============================================================================
// SECTION: Greeting Module
// =============================================================================

/**
 * Returns the current time as a zero-padded "HH:MM" string.
 *
 * @param {Date} date
 * @returns {string} e.g. "09:05"
 *
 * Requirements: 1.1
 */
function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Returns the current date as "DayName, DD MonthName YYYY".
 *
 * @param {Date} date
 * @returns {string} e.g. "Monday, 14 October 2024"
 *
 * Requirements: 1.2
 */
function formatDate(date) {
  const dayName   = DAY_NAMES[date.getDay()];
  const dd        = String(date.getDate()).padStart(2, '0');
  const monthName = MONTH_NAMES[date.getMonth()];
  const yyyy      = date.getFullYear();
  return `${dayName}, ${dd} ${monthName} ${yyyy}`;
}

/**
 * Maps a 24-hour integer (0–23) to a greeting string.
 *
 * Ranges (inclusive):
 *   05–11 → "Good Morning"
 *   12–17 → "Good Afternoon"
 *   18–21 → "Good Evening"
 *   22–04 → "Good Night"  (wraps midnight)
 *
 * @param {number} hour  Integer in [0, 23]
 * @returns {string}
 *
 * Requirements: 1.3, 1.4, 1.5, 1.6
 */
function getGreeting(hour) {
  if (hour >= 5  && hour <= 11) return 'Good Morning';
  if (hour >= 12 && hour <= 17) return 'Good Afternoon';
  if (hour >= 18 && hour <= 21) return 'Good Evening';
  return 'Good Night'; // 22–23 and 0–4
}

/**
 * Renders the greeting banner with the current time, date, and greeting text.
 * If the provided date is invalid, clears the three display nodes and shows
 * an error message — satisfying Requirement 1.7.
 *
 * @param {Date} date
 *
 * Requirements: 1.1, 1.7
 */
function renderGreeting(date) {
  const timeEl    = document.getElementById('greeting-time');
  const dateEl    = document.getElementById('greeting-date');
  const textEl    = document.getElementById('greeting-text');
  const bannerEl  = document.getElementById('greeting-banner');

  // Ensure any previous error message is removed before re-rendering.
  const existingError = bannerEl.querySelector('.greeting-error');
  if (existingError) existingError.remove();

  // Guard: invalid or unavailable date (Requirement 1.7).
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    timeEl.textContent = '';
    dateEl.textContent = '';
    textEl.textContent = '';

    const errorEl = document.createElement('p');
    errorEl.className = 'greeting-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent = 'Time data unavailable';
    bannerEl.appendChild(errorEl);
    return;
  }

  timeEl.textContent = formatTime(date);
  dateEl.textContent = formatDate(date);
  textEl.textContent = getGreeting(date.getHours());
}

/**
 * Schedules the first greeting update at the next whole-minute boundary, then
 * keeps it updating every 60 seconds thereafter.
 *
 * Algorithm from design.md:
 *   msUntilNextMinute = 60000 - (Date.now() % 60000)
 *   setTimeout(firstTick, msUntilNextMinute)
 *   firstTick: renderGreeting(new Date()), setInterval(tick, 60000)
 *
 * Requirements: 1.1
 */
function startClockTick() {
  function tick() {
    renderGreeting(new Date());
  }

  function firstTick() {
    tick();
    setInterval(tick, 60_000);
  }

  const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
  setTimeout(firstTick, msUntilNextMinute);
}

// =============================================================================
// SECTION: Focus Timer Module
// =============================================================================

/**
 * Module-scope handle for the running setInterval.
 * null when the timer is not counting down.
 */
let timerIntervalId = null;

/**
 * Formats a total-seconds value as a zero-padded "MM:SS" string.
 *
 * @param {number} totalSeconds  Integer in [0, 1500]
 * @returns {string}  e.g. "25:00", "04:37"
 *
 * Requirements: 2.3, 2.7 — Property 5
 */
function formatMMSS(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Returns a new timer state with `running` set to `true`.
 * No-op if the timer is already running.
 *
 * @param {{ remaining: number, running: boolean, completed: boolean }} timerState
 * @returns {{ remaining: number, running: boolean, completed: boolean }}
 *
 * Requirements: 2.2, 2.8 — Property 8
 */
function startTimer(timerState) {
  if (timerState.running) return timerState;
  return { ...timerState, running: true };
}

/**
 * Returns a new timer state with `running` set to `false`.
 * No-op if the timer is not running.
 *
 * @param {{ remaining: number, running: boolean, completed: boolean }} timerState
 * @returns {{ remaining: number, running: boolean, completed: boolean }}
 *
 * Requirements: 2.4, 2.9 — Property 6, 8
 */
function stopTimer(timerState) {
  if (!timerState.running) return timerState;
  return { ...timerState, running: false };
}

/**
 * Returns the canonical initial timer state regardless of input.
 *
 * @param {{ remaining: number, running: boolean, completed: boolean }} _timerState
 * @returns {{ remaining: number, running: boolean, completed: boolean }}
 *
 * Requirements: 2.5 — Property 7
 */
function resetTimer(_timerState) {
  return { remaining: TIMER_DURATION, running: false, completed: false };
}

/**
 * Returns a new timer state with `remaining` decremented by one second.
 * When `remaining` reaches 0, sets `completed: true` and `running: false`.
 * Guards against going below 0 — if `remaining` is already 0, returns
 * state unchanged (with `completed: true`).
 *
 * @param {{ remaining: number, running: boolean, completed: boolean }} timerState
 * @returns {{ remaining: number, running: boolean, completed: boolean }}
 *
 * Requirements: 2.2, 2.3, 2.6 — Property 4
 */
function tickTimer(timerState) {
  if (timerState.remaining <= 0) {
    return { ...timerState, remaining: 0, completed: true, running: false };
  }
  const newRemaining = timerState.remaining - 1;
  if (newRemaining === 0) {
    return { ...timerState, remaining: 0, completed: true, running: false };
  }
  return { ...timerState, remaining: newRemaining };
}

/**
 * Renders the timer display from the current timer state.
 * Updates `#timer-display` text to the formatted MM:SS value.
 * Adds `.timer--complete` class when `state.completed === true`,
 * removes it otherwise.
 *
 * @param {{ remaining: number, running: boolean, completed: boolean }} timerState
 *
 * Requirements: 2.1, 2.6 — task 4.3
 */
function renderTimer(timerState) {
  const displayEl = document.getElementById('timer-display');
  displayEl.textContent = formatMMSS(timerState.remaining);

  if (timerState.completed) {
    displayEl.classList.add('timer--complete');
  } else {
    displayEl.classList.remove('timer--complete');
  }
}

/**
 * Wires the Focus Timer control buttons to the state machine.
 * Must be called once after the DOM is ready.
 *
 * Requirements: 2.1–2.9 — task 4.3
 */
function initTimer() {
  // Render initial "25:00" state.
  renderTimer(state.timer);

  document.getElementById('btn-start').addEventListener('click', () => {
    // No-op if already running (Requirement 2.8).
    if (state.timer.running) return;

    state.timer = startTimer(state.timer);

    timerIntervalId = setInterval(() => {
      state.timer = tickTimer(state.timer);
      renderTimer(state.timer);

      // Auto-stop when the timer completes (Requirement 2.6).
      if (state.timer.completed) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
      }
    }, 1000);

    renderTimer(state.timer);
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    // No-op if already stopped (Requirement 2.9).
    if (!state.timer.running) return;

    clearInterval(timerIntervalId);
    timerIntervalId = null;
    state.timer = stopTimer(state.timer);
    renderTimer(state.timer);
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
    state.timer = resetTimer(state.timer);
    renderTimer(state.timer);
  });
}

// =============================================================================
// SECTION: Task Management Module
// =============================================================================

/**
 * Validates a task title string.
 * Returns an error message string if invalid, or null if valid.
 *
 * Rules:
 *   - Must not be empty or whitespace-only  → "Title is required"
 *   - Must be ≤ 100 characters              → "Title must be 100 characters or fewer"
 *
 * @param {string} title
 * @returns {string|null}
 */
function validateTaskTitle(title) {
  if (typeof title !== 'string' || title.trim() === '') {
    return 'Title is required';
  }
  if (title.length > 100) {
    return 'Title must be 100 characters or fewer';
  }
  return null;
}

/**
 * Appends a new task to the tasks array after validating the title.
 *
 * @param {Array<{id: string, title: string, completed: boolean, createdAt: number}>} tasks
 * @param {string} title
 * @returns {{ tasks: Array, error?: string }}
 *
 * Requirements: 3.1, 3.2 — Property 9, 10
 */
function addTask(tasks, title) {
  const error = validateTaskTitle(title);
  if (error) {
    return { tasks, error };
  }
  const newTask = {
    id: crypto.randomUUID(),
    title,
    completed: false,
    createdAt: Date.now(),
  };
  return { tasks: [...tasks, newTask] };
}

/**
 * Flips the `completed` flag on the task matching the given id.
 * Returns the tasks array unchanged if the id is not found.
 *
 * @param {Array<{id: string, title: string, completed: boolean, createdAt: number}>} tasks
 * @param {string} id
 * @returns {Array<{id: string, title: string, completed: boolean, createdAt: number}>}
 *
 * Requirements: 3.3 — Property 11
 */
function toggleTask(tasks, id) {
  return tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );
}

/**
 * Replaces the title of the task matching the given id after validating the new title.
 * Returns the tasks array unchanged (with an error) if validation fails.
 * Returns the tasks array unchanged (no error) if the id is not found.
 *
 * @param {Array<{id: string, title: string, completed: boolean, createdAt: number}>} tasks
 * @param {string} id
 * @param {string} newTitle
 * @returns {{ tasks: Array, error?: string }}
 *
 * Requirements: 3.4, 3.5 — Property 10, 12
 */
function editTask(tasks, id, newTitle) {
  const error = validateTaskTitle(newTitle);
  if (error) {
    return { tasks, error };
  }
  return {
    tasks: tasks.map((task) =>
      task.id === id ? { ...task, title: newTitle } : task
    ),
  };
}

/**
 * Removes the task with the given id from the tasks array.
 * Returns the tasks array unchanged if the id is not found.
 *
 * @param {Array<{id: string, title: string, completed: boolean, createdAt: number}>} tasks
 * @param {string} id
 * @returns {Array<{id: string, title: string, completed: boolean, createdAt: number}>}
 *
 * Requirements: 3.6 — Property 13
 */
function deleteTask(tasks, id) {
  return tasks.filter((task) => task.id !== id);
}

// =============================================================================
// SECTION: Task Rendering and Event Wiring
// =============================================================================

/**
 * Rebuilds the `#task-list` <ul> from the tasks state array.
 *
 * Each task is rendered as:
 *   <li data-id="uuid" class="task [task--complete]">
 *     <span class="task__title">Title</span>
 *     <button class="task__btn task__btn--complete" aria-label="Toggle complete">✓</button>
 *     <button class="task__btn task__btn--edit"     aria-label="Edit task">✎</button>
 *     <button class="task__btn task__btn--delete"   aria-label="Delete task">✕</button>
 *   </li>
 *
 * Persists via saveTasks BEFORE updating the DOM (Requirement 3.7).
 * On save failure renders an inline <p class="field-error" role="alert"> (Requirement 3.8).
 *
 * @param {Array<{id: string, title: string, completed: boolean, createdAt: number}>} tasks
 *
 * Requirements: 3.1, 3.3, 3.7, 3.8, 3.10
 */
function renderTasks(tasks) {
  const listEl = document.getElementById('task-list');

  // Persist BEFORE DOM update (Requirement 3.7).
  const saveResult = saveTasks(tasks);

  // Remove any previous save-error message.
  const prevError = listEl.parentElement.querySelector('.task-save-error');
  if (prevError) prevError.remove();

  // Surface a save-failure error if needed (Requirement 3.8).
  if (!saveResult.ok) {
    const errorEl = document.createElement('p');
    errorEl.className = 'field-error task-save-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent = 'Could not save tasks. Changes may not persist.';
    listEl.parentElement.insertBefore(errorEl, listEl);
  }

  // Rebuild the list from state.
  listEl.innerHTML = '';

  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = task.completed ? 'task task--complete' : 'task';
    li.dataset.id = task.id;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'task__title';
    titleSpan.textContent = task.title;

    const completeBtn = document.createElement('button');
    completeBtn.type = 'button';
    completeBtn.className = 'task__btn task__btn--complete';
    completeBtn.setAttribute('aria-label', 'Toggle complete');
    completeBtn.textContent = '✓';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'task__btn task__btn--edit';
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.textContent = '✎';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'task__btn task__btn--delete';
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.textContent = '✕';

    li.appendChild(titleSpan);
    li.appendChild(completeBtn);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    listEl.appendChild(li);
  });
}

/**
 * Activates the inline edit mode for the task <li> matching the given id.
 * Replaces the <span class="task__title"> with a pre-filled text input.
 * Wires Enter (save), blur (save), and Escape (discard) handlers.
 *
 * @param {string} id  The task id to edit.
 *
 * Requirements: 3.4, 3.5
 */
function activateInlineEdit(id) {
  const listEl = document.getElementById('task-list');
  const li = listEl.querySelector(`[data-id="${id}"]`);
  if (!li) return;

  // Already in edit mode — do nothing.
  if (li.querySelector('.task__edit-input')) return;

  const titleSpan = li.querySelector('.task__title');
  const currentTitle = titleSpan.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task__edit-input';
  input.value = currentTitle;
  input.maxLength = 100;
  input.setAttribute('aria-label', 'Edit task title');

  // Replace the span with the input.
  li.replaceChild(input, titleSpan);
  input.focus();
  input.select();

  /**
   * Shows or removes an inline validation error on this <li>.
   * @param {string|null} message  Error text, or null to clear.
   */
  function setEditError(message) {
    const prev = li.querySelector('.task-edit-error');
    if (prev) prev.remove();
    if (message) {
      const p = document.createElement('p');
      p.className = 'field-error task-edit-error';
      p.setAttribute('role', 'alert');
      p.textContent = message;
      li.appendChild(p);
    }
  }

  /**
   * Attempts to save the edited title.
   * @returns {boolean} true if saved successfully, false on validation error.
   */
  function attemptSave() {
    const newTitle = input.value;
    const result = editTask(state.tasks, id, newTitle);
    if (result.error) {
      setEditError(result.error);
      return false;
    }
    setEditError(null);
    state.tasks = result.tasks;
    renderTasks(state.tasks);
    return true;
  }

  // Track whether we already handled a save to avoid double-triggering on blur after Enter.
  let saved = false;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saved = attemptSave();
    } else if (e.key === 'Escape') {
      saved = true; // Treat as handled — discard changes.
      renderTasks(state.tasks); // Restore original span.
    }
  });

  input.addEventListener('blur', () => {
    if (!saved) {
      attemptSave();
    }
  });
}

/**
 * Initialises all Task Management UI interactions:
 * - Add-task form submission
 * - Event-delegated complete / edit / delete buttons on #task-list
 *
 * Must be called once after the DOM is ready.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.10
 */
function initTasks() {
  // Render current persisted tasks on startup.
  renderTasks(state.tasks);

  // ── Add-task form ────────────────────────────────────────────────────────
  const form = document.getElementById('add-task-form');
  const taskInput = document.getElementById('task-input');

  /**
   * Returns or creates the validation error <p> adjacent to the task input.
   * @param {string|null} message  Error text, or null to clear.
   */
  function setAddError(message) {
    let errorEl = form.querySelector('.task-add-error');
    if (!message) {
      if (errorEl) errorEl.remove();
      return;
    }
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'field-error task-add-error';
      errorEl.setAttribute('role', 'alert');
      // Insert immediately after the input.
      taskInput.insertAdjacentElement('afterend', errorEl);
    }
    errorEl.textContent = message;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = taskInput.value;
    const result = addTask(state.tasks, title);

    if (result.error) {
      setAddError(result.error);
      return;
    }

    setAddError(null);
    state.tasks = result.tasks;
    renderTasks(state.tasks);
    taskInput.value = '';
  });

  // ── Event delegation on #task-list ───────────────────────────────────────
  const listEl = document.getElementById('task-list');

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const li = btn.closest('[data-id]');
    if (!li) return;

    const id = li.dataset.id;

    if (btn.classList.contains('task__btn--complete')) {
      state.tasks = toggleTask(state.tasks, id);
      renderTasks(state.tasks);

    } else if (btn.classList.contains('task__btn--delete')) {
      state.tasks = deleteTask(state.tasks, id);
      renderTasks(state.tasks);

    } else if (btn.classList.contains('task__btn--edit')) {
      activateInlineEdit(id);
    }
  });
}

// =============================================================================
// SECTION: Quick Links Module
// =============================================================================

/**
 * Tests whether a URL string is a valid http/https URL with at least one
 * dot-separated host segment.
 *
 * @param {string} url
 * @returns {boolean}
 *
 * Requirements: 4.1, 4.2
 */
function isValidUrl(url) {
  return /^https?:\/\/[^.]+\.[^\s/$.?#][^\s]*$/i.test(url);
}

/**
 * Appends a new quick link to the links array after validating all fields.
 *
 * Validation order (first failing check wins):
 *   1. Empty label                    → "Label is required"
 *   2. Label > 100 chars              → "Label must be 100 characters or fewer"
 *   3. Empty URL                      → "URL must start with http:// or https://"
 *   4. Invalid URL format             → "URL must start with http:// or https://"
 *   5. URL > 2048 chars               → "URL must be 2048 characters or fewer"
 *   6. Already at 50-link cap         → "Maximum of 50 quick links reached"
 *
 * On success returns `{ links: [...links, newLink] }`.
 * On failure returns `{ links, error: <message> }`.
 *
 * @param {Array<{id: string, label: string, url: string}>} links
 * @param {string} label
 * @param {string} url
 * @returns {{ links: Array<{id: string, label: string, url: string}>, error?: string }}
 *
 * Requirements: 4.1, 4.2, 4.4, 4.8
 */
function addLink(links, label, url) {
  // Label validation
  if (typeof label !== 'string' || label.trim() === '') {
    return { links, error: 'Label is required' };
  }
  if (label.length > 100) {
    return { links, error: 'Label must be 100 characters or fewer' };
  }

  // URL validation — empty / format / length
  if (typeof url !== 'string' || url.trim() === '') {
    return { links, error: 'URL must start with http:// or https://' };
  }
  if (!isValidUrl(url)) {
    return { links, error: 'URL must start with http:// or https://' };
  }
  if (url.length > 2048) {
    return { links, error: 'URL must be 2048 characters or fewer' };
  }

  // Cap check
  if (links.length >= 50) {
    return { links, error: 'Maximum of 50 quick links reached' };
  }

  const newLink = {
    id: crypto.randomUUID(),
    label,
    url,
  };
  return { links: [...links, newLink] };
}

/**
 * Removes the quick link with the given id from the links array.
 * Returns the array unchanged if the id is not found.
 *
 * @param {Array<{id: string, label: string, url: string}>} links
 * @param {string} id
 * @returns {Array<{id: string, label: string, url: string}>}
 *
 * Requirements: 4.8
 */
function deleteLink(links, id) {
  return links.filter((link) => link.id !== id);
}

// =============================================================================
// SECTION: Quick Links Rendering and Event Wiring
// =============================================================================

/**
 * Rebuilds the `#quick-links-grid` element entirely from the links array.
 *
 * Each entry is rendered as:
 *   <div class="quick-link" data-id="<id>">
 *     <a href="<url>" target="_blank" rel="noopener noreferrer" class="quick-link__btn"><label></a>
 *     <button class="quick-link__delete" aria-label="Delete link">✕</button>
 *   </div>
 *
 * Persists via saveLinks BEFORE updating the DOM (Requirement 4.5).
 * On save failure shows inline error but retains the link in the displayed
 * list (Requirement 4.6).
 *
 * @param {Array<{id: string, label: string, url: string}>} links
 *
 * Requirements: 4.3, 4.5, 4.6
 */
function renderLinks(links) {
  const gridEl = document.getElementById('quick-links-grid');

  // Persist BEFORE DOM update (Requirement 4.5).
  const saveResult = saveLinks(links);

  // Remove any previous save-error message.
  const prevError = gridEl.parentElement.querySelector('.links-save-error');
  if (prevError) prevError.remove();

  // Surface a save-failure error if needed (Requirement 4.6).
  if (!saveResult.ok) {
    const errorEl = document.createElement('p');
    errorEl.className = 'field-error links-save-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent = 'Could not save links. Changes may not persist.';
    gridEl.parentElement.insertBefore(errorEl, gridEl);
  }

  // Rebuild the grid from the links array.
  gridEl.innerHTML = '';

  links.forEach((link) => {
    const div = document.createElement('div');
    div.className = 'quick-link';
    div.dataset.id = link.id;

    const anchor = document.createElement('a');
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.className = 'quick-link__btn';
    anchor.textContent = link.label;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'quick-link__delete';
    deleteBtn.setAttribute('aria-label', 'Delete link');
    deleteBtn.textContent = '✕';

    div.appendChild(anchor);
    div.appendChild(deleteBtn);
    gridEl.appendChild(div);
  });
}

/**
 * Initialises all Quick Links UI interactions:
 * - Add-link form submission with per-field validation
 * - Event-delegated delete buttons on #quick-links-panel
 *
 * Must be called once after the DOM is ready.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
 */
function initQuickLinks() {
  // Render current persisted links on startup.
  renderLinks(state.links);

  // ── Add-link form ──────────────────────────────────────────────────────────
  const form = document.getElementById('add-link-form');
  const labelInput = document.getElementById('link-label-input');
  const urlInput = document.getElementById('link-url-input');

  /**
   * Shows or clears a field-level validation error adjacent to the given input.
   * @param {HTMLElement} inputEl   The form field with the error.
   * @param {string|null}  message  Error text, or null to clear.
   * @param {string}       cssClass Unique class to identify this error element.
   */
  function setFieldError(inputEl, message, cssClass) {
    // Remove any previous error for this field.
    const prev = form.querySelector('.' + cssClass);
    if (prev) prev.remove();

    if (message) {
      const errorEl = document.createElement('p');
      errorEl.className = 'field-error ' + cssClass;
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = message;
      inputEl.insertAdjacentElement('afterend', errorEl);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const label = labelInput.value;
    const url   = urlInput.value;

    // Clear previous field errors before re-validating.
    setFieldError(labelInput, null, 'link-label-error');
    setFieldError(urlInput,   null, 'link-url-error');

    const result = addLink(state.links, label, url);

    if (result.error) {
      // Determine which field to attach the error to.
      // Label errors relate to the label field; URL / cap errors go to the URL field.
      const isLabelError =
        result.error === 'Label is required' ||
        result.error === 'Label must be 100 characters or fewer';

      if (isLabelError) {
        setFieldError(labelInput, result.error, 'link-label-error');
      } else {
        setFieldError(urlInput, result.error, 'link-url-error');
      }
      return;
    }

    // On success: update state, persist, render, clear inputs.
    state.links = result.links;
    renderLinks(state.links);
    labelInput.value = '';
    urlInput.value   = '';
  });

  // ── Event delegation on #quick-links-panel ────────────────────────────────
  const panelEl = document.getElementById('quick-links-panel');

  panelEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.quick-link__delete');
    if (!btn) return;

    const div = btn.closest('[data-id]');
    if (!div) return;

    const id = div.dataset.id;
    const updatedLinks = deleteLink(state.links, id);
    state.links = updatedLinks;
    renderLinks(state.links);
  });
}

// =============================================================================
// SECTION: Main / Init
// =============================================================================

/**
 * Bootstraps the entire application.
 *
 * Execution order:
 *   1. Load persisted tasks and links into module-scope state.
 *   2. If localStorage failed on load, show the dismissible storage-warning banner.
 *   3. Wire the dismiss-button handler.
 *   4. Render all four sections from the loaded/initial state.
 *   5. Start the clock tick so the greeting updates at each minute boundary.
 *
 * Requirements: 3.9, 4.7, 5.1, 5.2
 */
function init() {
  // ── 1. Load persisted state ────────────────────────────────────────────────
  state.tasks = loadTasks();
  state.links = loadLinks();

  // ── 2. Storage-error banner (Requirement 5.2) ──────────────────────────────
  if (storageError) {
    const warningEl = document.getElementById('storage-warning');
    if (warningEl) {
      // The element uses the HTML `hidden` attribute; remove it to make it visible.
      warningEl.removeAttribute('hidden');
    }
  }

  // ── 3. Dismiss-button handler ──────────────────────────────────────────────
  const dismissBtn = document.getElementById('btn-dismiss-warning');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      const warningEl = document.getElementById('storage-warning');
      if (warningEl) {
        warningEl.setAttribute('hidden', '');
      }
    });
  }

  // ── 4. Render all sections ────────────────────────────────────────────────
  // Greeting banner — rendered once now; clock tick handles subsequent updates.
  renderGreeting(new Date());

  // Focus Timer — renderTimer called internally by initTimer.
  initTimer();

  // Task Management — renderTasks called internally by initTasks using state.tasks.
  initTasks();

  // Quick Links — renderLinks called internally by initQuickLinks using state.links.
  initQuickLinks();

  // ── 5. Start clock ────────────────────────────────────────────────────────
  startClockTick();
}

// Call init at module load when running in a browser context.
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

// =============================================================================
// SECTION: Exports (for unit / property-based testing only)
// =============================================================================

export {
  // Greeting pure functions
  formatTime,
  formatDate,
  getGreeting,
  // Timer pure functions
  formatMMSS,
  startTimer,
  stopTimer,
  resetTimer,
  tickTimer,
  // Task pure functions
  addTask,
  toggleTask,
  editTask,
  deleteTask,
  // Task render / init (for DOM-level tests)
  renderTasks,
  // Quick link pure functions
  isValidUrl,
  addLink,
  deleteLink,
  // Quick link render / init (for DOM-level tests)
  renderLinks,
  initQuickLinks,
  // Storage functions (for DOM-level / integration tests)
  loadTasks,
  loadLinks,
  saveTasks,
  saveLinks,
  // Main init (for integration tests)
  init,
  // Constants (needed by tests)
  TIMER_DURATION,
  DAY_NAMES,
  MONTH_NAMES,
};
