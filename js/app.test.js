/**
 * Unit tests for Todo Dashboard pure functions.
 *
 * Covers the functions implemented in tasks 1.2, 2.1, 3.1, and 4.1.
 * Tests run with vitest + happy-dom (no browser required).
 */

import { describe, it, expect } from 'vitest';
import {
  formatTime,
  formatDate,
  getGreeting,
  formatMMSS,
  startTimer,
  stopTimer,
  resetTimer,
  tickTimer,
  TIMER_DURATION,
  DAY_NAMES,
  MONTH_NAMES,
} from './app.js';

// =============================================================================
// Greeting Module — formatTime
// =============================================================================

describe('formatTime', () => {
  it('returns zero-padded HH:MM for midnight', () => {
    const d = new Date(2024, 9, 14, 0, 0, 0); // 00:00
    expect(formatTime(d)).toBe('00:00');
  });

  it('returns zero-padded HH:MM for single-digit hour and minute', () => {
    const d = new Date(2024, 9, 14, 9, 5, 0); // 09:05
    expect(formatTime(d)).toBe('09:05');
  });

  it('returns correct string for noon', () => {
    const d = new Date(2024, 9, 14, 12, 30, 0); // 12:30
    expect(formatTime(d)).toBe('12:30');
  });

  it('returns correct string for the last minute of the day', () => {
    const d = new Date(2024, 9, 14, 23, 59, 0); // 23:59
    expect(formatTime(d)).toBe('23:59');
  });

  it('matches \\d{2}:\\d{2} format', () => {
    const d = new Date(2024, 0, 1, 7, 3, 45);
    expect(formatTime(d)).toMatch(/^\d{2}:\d{2}$/);
  });
});

// =============================================================================
// Greeting Module — formatDate
// =============================================================================

describe('formatDate', () => {
  it('formats a known Monday correctly', () => {
    // October 14, 2024 is a Monday
    const d = new Date(2024, 9, 14);
    expect(formatDate(d)).toBe('Monday, 14 October 2024');
  });

  it('zero-pads single-digit day', () => {
    // January 5, 2024 — Saturday
    const d = new Date(2024, 0, 5);
    expect(formatDate(d)).toBe('Saturday, 05 January 2024');
  });

  it('uses correct day name for Sunday', () => {
    // March 3, 2024 — Sunday
    const d = new Date(2024, 2, 3);
    expect(formatDate(d)).toBe('Sunday, 03 March 2024');
  });

  it('returns all 7 day names in correct order', () => {
    // Start from a known Sunday (Jan 7, 2024)
    for (let i = 0; i < 7; i++) {
      const d = new Date(2024, 0, 7 + i); // Sun Jan 7 ... Sat Jan 13
      const result = formatDate(d);
      expect(result.startsWith(DAY_NAMES[d.getDay()])).toBe(true);
    }
  });

  it('uses correct month names for all 12 months', () => {
    for (let m = 0; m < 12; m++) {
      const d = new Date(2024, m, 1);
      expect(formatDate(d)).toContain(MONTH_NAMES[m]);
    }
  });

  it('matches DayName, DD MonthName YYYY pattern', () => {
    const d = new Date(2024, 9, 14);
    expect(formatDate(d)).toMatch(/^[A-Za-z]+, \d{2} [A-Za-z]+ \d{4}$/);
  });
});

// =============================================================================
// Greeting Module — getGreeting
// =============================================================================

describe('getGreeting', () => {
  // Good Morning: 05–11
  it.each([5, 6, 7, 8, 9, 10, 11])(
    'returns "Good Morning" for hour %i',
    (hour) => {
      expect(getGreeting(hour)).toBe('Good Morning');
    }
  );

  // Good Afternoon: 12–17
  it.each([12, 13, 14, 15, 16, 17])(
    'returns "Good Afternoon" for hour %i',
    (hour) => {
      expect(getGreeting(hour)).toBe('Good Afternoon');
    }
  );

  // Good Evening: 18–21
  it.each([18, 19, 20, 21])(
    'returns "Good Evening" for hour %i',
    (hour) => {
      expect(getGreeting(hour)).toBe('Good Evening');
    }
  );

  // Good Night: 22–23 and 0–4
  it.each([22, 23, 0, 1, 2, 3, 4])(
    'returns "Good Night" for hour %i',
    (hour) => {
      expect(getGreeting(hour)).toBe('Good Night');
    }
  );

  it('covers all 24 hours exactly once (no gaps, no overlaps)', () => {
    const greetings = new Set([
      'Good Morning',
      'Good Afternoon',
      'Good Evening',
      'Good Night',
    ]);
    for (let h = 0; h <= 23; h++) {
      const g = getGreeting(h);
      expect(greetings.has(g)).toBe(true);
    }
  });
});

// =============================================================================
// Timer Module — formatMMSS
// =============================================================================

describe('formatMMSS', () => {
  it('formats 1500 seconds as "25:00"', () => {
    expect(formatMMSS(1500)).toBe('25:00');
  });

  it('formats 0 seconds as "00:00"', () => {
    expect(formatMMSS(0)).toBe('00:00');
  });

  it('zero-pads minutes and seconds', () => {
    expect(formatMMSS(65)).toBe('01:05'); // 1 min 5 sec
  });

  it('formats 59 seconds correctly', () => {
    expect(formatMMSS(59)).toBe('00:59');
  });

  it('formats 277 seconds as "04:37"', () => {
    expect(formatMMSS(277)).toBe('04:37');
  });

  it('matches \\d{2}:\\d{2} format for all boundary values', () => {
    [0, 1, 59, 60, 61, 1499, 1500].forEach((n) => {
      expect(formatMMSS(n)).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  it('round-trips: Math.floor(n/60)*60 + (n%60) === n for several inputs', () => {
    [0, 1, 59, 60, 277, 1499, 1500].forEach((n) => {
      const str = formatMMSS(n);
      const [mm, ss] = str.split(':').map(Number);
      expect(mm * 60 + ss).toBe(n);
    });
  });
});

// =============================================================================
// Timer Module — startTimer
// =============================================================================

describe('startTimer', () => {
  it('sets running to true when timer is stopped', () => {
    const s = { remaining: 1500, running: false, completed: false };
    expect(startTimer(s).running).toBe(true);
  });

  it('is a no-op when timer is already running (returns same reference)', () => {
    const s = { remaining: 900, running: true, completed: false };
    expect(startTimer(s)).toBe(s);
  });

  it('does not mutate the original state', () => {
    const s = { remaining: 1500, running: false, completed: false };
    const result = startTimer(s);
    expect(s.running).toBe(false);
    expect(result.running).toBe(true);
  });

  it('preserves remaining and completed', () => {
    const s = { remaining: 300, running: false, completed: false };
    const result = startTimer(s);
    expect(result.remaining).toBe(300);
    expect(result.completed).toBe(false);
  });
});

// =============================================================================
// Timer Module — stopTimer
// =============================================================================

describe('stopTimer', () => {
  it('sets running to false when timer is running', () => {
    const s = { remaining: 900, running: true, completed: false };
    expect(stopTimer(s).running).toBe(false);
  });

  it('is a no-op when timer is already stopped (returns same reference)', () => {
    const s = { remaining: 900, running: false, completed: false };
    expect(stopTimer(s)).toBe(s);
  });

  it('preserves remaining unchanged', () => {
    const s = { remaining: 450, running: true, completed: false };
    expect(stopTimer(s).remaining).toBe(450);
  });

  it('does not mutate the original state', () => {
    const s = { remaining: 600, running: true, completed: false };
    stopTimer(s);
    expect(s.running).toBe(true);
  });
});

// =============================================================================
// Timer Module — resetTimer
// =============================================================================

describe('resetTimer', () => {
  it('returns canonical initial state from any state', () => {
    const states = [
      { remaining: 0, running: false, completed: true },
      { remaining: 900, running: true, completed: false },
      { remaining: 1500, running: false, completed: false },
    ];
    states.forEach((s) => {
      const result = resetTimer(s);
      expect(result).toEqual({ remaining: TIMER_DURATION, running: false, completed: false });
    });
  });

  it(`sets remaining to ${TIMER_DURATION} (25 minutes)`, () => {
    const s = { remaining: 0, running: false, completed: true };
    expect(resetTimer(s).remaining).toBe(1500);
  });

  it('sets running to false', () => {
    const s = { remaining: 600, running: true, completed: false };
    expect(resetTimer(s).running).toBe(false);
  });

  it('sets completed to false', () => {
    const s = { remaining: 0, running: false, completed: true };
    expect(resetTimer(s).completed).toBe(false);
  });
});

// =============================================================================
// Timer Module — tickTimer
// =============================================================================

describe('tickTimer', () => {
  it('decrements remaining by exactly 1', () => {
    const s = { remaining: 100, running: true, completed: false };
    expect(tickTimer(s).remaining).toBe(99);
  });

  it('sets completed to true when remaining reaches 0', () => {
    const s = { remaining: 1, running: true, completed: false };
    const result = tickTimer(s);
    expect(result.remaining).toBe(0);
    expect(result.completed).toBe(true);
  });

  it('sets running to false when reaching 0', () => {
    const s = { remaining: 1, running: true, completed: false };
    expect(tickTimer(s).running).toBe(false);
  });

  it('is a no-op (guards against going below 0) when remaining is already 0', () => {
    const s = { remaining: 0, running: false, completed: true };
    const result = tickTimer(s);
    expect(result.remaining).toBe(0);
    expect(result.completed).toBe(true);
  });

  it('does not set completed when remaining > 1 after tick', () => {
    const s = { remaining: 5, running: true, completed: false };
    expect(tickTimer(s).completed).toBe(false);
  });

  it('does not mutate the original state', () => {
    const s = { remaining: 50, running: true, completed: false };
    tickTimer(s);
    expect(s.remaining).toBe(50);
  });
});

// =============================================================================
// Task Management Module — renderTasks (DOM tests, happy-dom environment)
// =============================================================================

import { renderTasks } from './app.js';

// Helper: set up a minimal DOM fragment that renderTasks requires.
function setupTaskDOM() {
  document.body.innerHTML = `
    <section id="task-list-section">
      <form id="add-task-form" aria-label="Add new task">
        <label for="task-input">New task</label>
        <input id="task-input" type="text" maxlength="100" />
        <button type="submit">Add Task</button>
      </form>
      <ul id="task-list" aria-label="Task list" aria-live="polite"></ul>
    </section>
  `;
}

// Minimal task factory for tests.
function makeTask(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: 'Test task',
    completed: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('renderTasks — DOM rendering', () => {
  beforeEach(() => {
    setupTaskDOM();
    // Stub localStorage so saveTasks doesn't throw in happy-dom.
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders an empty list when tasks array is empty', () => {
    renderTasks([]);
    const listEl = document.getElementById('task-list');
    expect(listEl.children.length).toBe(0);
  });

  it('renders one <li> per task', () => {
    const tasks = [makeTask(), makeTask()];
    renderTasks(tasks);
    const listEl = document.getElementById('task-list');
    expect(listEl.children.length).toBe(2);
  });

  it('sets data-id attribute from task.id', () => {
    const task = makeTask({ id: 'abc-123' });
    renderTasks([task]);
    const li = document.querySelector('[data-id="abc-123"]');
    expect(li).not.toBeNull();
  });

  it('renders task title in a .task__title span', () => {
    const task = makeTask({ title: 'Buy groceries' });
    renderTasks([task]);
    const span = document.querySelector('.task__title');
    expect(span.textContent).toBe('Buy groceries');
  });

  it('adds .task--complete class for completed tasks', () => {
    const task = makeTask({ completed: true });
    renderTasks([task]);
    const li = document.querySelector('[data-id]');
    expect(li.classList.contains('task--complete')).toBe(true);
  });

  it('does not add .task--complete class for incomplete tasks', () => {
    const task = makeTask({ completed: false });
    renderTasks([task]);
    const li = document.querySelector('[data-id]');
    expect(li.classList.contains('task--complete')).toBe(false);
  });

  it('renders complete, edit, and delete buttons with correct aria-labels', () => {
    renderTasks([makeTask()]);
    expect(document.querySelector('.task__btn--complete').getAttribute('aria-label')).toBe('Toggle complete');
    expect(document.querySelector('.task__btn--edit').getAttribute('aria-label')).toBe('Edit task');
    expect(document.querySelector('.task__btn--delete').getAttribute('aria-label')).toBe('Delete task');
  });

  it('maintains task order matching the input array (Requirement 3.10)', () => {
    const t1 = makeTask({ title: 'First',  createdAt: 1000 });
    const t2 = makeTask({ title: 'Second', createdAt: 2000 });
    const t3 = makeTask({ title: 'Third',  createdAt: 3000 });
    renderTasks([t1, t2, t3]);
    const spans = document.querySelectorAll('.task__title');
    expect(spans[0].textContent).toBe('First');
    expect(spans[1].textContent).toBe('Second');
    expect(spans[2].textContent).toBe('Third');
  });

  it('replaces previous render on second call (no duplicate items)', () => {
    renderTasks([makeTask()]);
    renderTasks([makeTask(), makeTask()]);
    expect(document.getElementById('task-list').children.length).toBe(2);
  });

  it('shows inline save-error when localStorage.setItem throws (Requirement 3.8)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('QuotaExceededError'); },
      removeItem: () => {},
    });
    renderTasks([makeTask()]);
    const errorEl = document.querySelector('.task-save-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.getAttribute('role')).toBe('alert');
  });

  it('removes previous save-error on a successful subsequent render', () => {
    // First render with broken localStorage.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('QuotaExceededError'); },
      removeItem: () => {},
    });
    renderTasks([makeTask()]);
    expect(document.querySelector('.task-save-error')).not.toBeNull();

    // Second render with working localStorage.
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    });
    renderTasks([makeTask()]);
    expect(document.querySelector('.task-save-error')).toBeNull();
  });
});

// =============================================================================
// Quick Links Module — renderLinks (DOM tests, happy-dom environment)
// =============================================================================

import { renderLinks } from './app.js';

// Helper: set up a minimal DOM fragment that renderLinks requires.
function setupLinksDOM() {
  document.body.innerHTML = `
    <section id="quick-links-panel" aria-labelledby="quick-links-heading">
      <h2 id="quick-links-heading">Quick Links</h2>
      <div id="quick-links-grid" aria-label="Quick links" aria-live="polite"></div>
    </section>
  `;
}

// Minimal link factory for tests.
function makeLink(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    label: 'Test Link',
    url: 'https://example.com',
    ...overrides,
  };
}

describe('renderLinks — DOM rendering', () => {
  beforeEach(() => {
    setupLinksDOM();
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders an empty grid when links array is empty', () => {
    renderLinks([]);
    const gridEl = document.getElementById('quick-links-grid');
    expect(gridEl.children.length).toBe(0);
  });

  it('renders one .quick-link div per link', () => {
    const links = [makeLink(), makeLink()];
    renderLinks(links);
    const divs = document.querySelectorAll('.quick-link');
    expect(divs.length).toBe(2);
  });

  it('sets data-id attribute from link.id', () => {
    const link = makeLink({ id: 'link-xyz' });
    renderLinks([link]);
    const div = document.querySelector('[data-id="link-xyz"]');
    expect(div).not.toBeNull();
  });

  it('renders an <a> with correct href, target, rel, and label text', () => {
    const link = makeLink({ label: 'GitHub', url: 'https://github.com' });
    renderLinks([link]);
    const anchor = document.querySelector('.quick-link__btn');
    expect(anchor.tagName).toBe('A');
    expect(anchor.getAttribute('href')).toBe('https://github.com');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor.textContent).toBe('GitHub');
  });

  it('renders a delete button with aria-label "Delete link"', () => {
    renderLinks([makeLink()]);
    const btn = document.querySelector('.quick-link__delete');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBe('Delete link');
  });

  it('replaces previous render on second call (no duplicates)', () => {
    renderLinks([makeLink()]);
    renderLinks([makeLink(), makeLink()]);
    expect(document.querySelectorAll('.quick-link').length).toBe(2);
  });

  it('shows inline save-error when localStorage.setItem throws (Requirement 4.6)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('QuotaExceededError'); },
      removeItem: () => {},
    });
    renderLinks([makeLink()]);
    const errorEl = document.querySelector('.links-save-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.getAttribute('role')).toBe('alert');
    // Link is still rendered in the grid despite the save failure (Req 4.6).
    expect(document.querySelectorAll('.quick-link').length).toBe(1);
  });

  it('removes previous save-error on a successful subsequent render', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('QuotaExceededError'); },
      removeItem: () => {},
    });
    renderLinks([makeLink()]);
    expect(document.querySelector('.links-save-error')).not.toBeNull();

    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    });
    renderLinks([makeLink()]);
    expect(document.querySelector('.links-save-error')).toBeNull();
  });
});
