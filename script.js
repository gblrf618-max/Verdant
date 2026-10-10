// ===== Категории =====
const categories = {
  rest:      { name: 'Отдых',          color: '#E8E2CE' },
  home:      { name: 'Дом/Быт',        color: '#E0C97A' },
  study:     { name: 'Учёба',          color: '#F5B71E' },
  health:    { name: 'Здоровье',       color: '#FFA500' },
  beauty:    { name: 'Внешность',      color: '#FF8C42' },
  important: { name: 'Несрочно-важно', color: '#F2D027' },
  urgent:    { name: 'Важно-срочно',   color: '#FFEF8A' }
};

// ===== Хранилище =====
const STORAGE_KEY = 'verdant-data';

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch (e) {
    console.warn('Не удалось прочитать данные', e);
    return [];
  }
}

function saveTasks(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: list }));
}

let tasks = loadTasks();

// ===== Состояние навигации =====
let weekOffset = 0;
let viewMode = 'week';
let focusedDay = 1;

// ===== Параметры сетки =====
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 23;
const PX_PER_HOUR = 60;
const MIN_FREE_MINUTES = 15;

// ===== Утилиты дат =====
function getWeekStart(offset = 0) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const jsDay = now.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  return monday;
}

function getWeekDates(offset = 0) {
  const monday = getWeekStart(offset);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(dates) {
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const first = dates[0];
  const last = dates[6];
  const y = last.getFullYear();
  return `${first.getDate()} ${months[first.getMonth()]} — ${last.getDate()} ${months[last.getMonth()]} ${y}`;
}

function getDayNumber(dateStr) {
  const d = new Date(dateStr);
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function makeId() {
  return 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function timeToMinutes(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

// ===== Рендер одной задачи =====
function renderTask(task) {
  const dayNumber = getDayNumber(task.date);
  const column = document.querySelector(`.week__column[data-day="${dayNumber}"]`);
  if (!column) return;

  const container = column.querySelector('.week__tasks');

  const widget = document.createElement('div');
  widget.className = 'task';
  widget.dataset.id = task.id;

  const cat = categories[task.category];
  widget.style.setProperty('--task-color', cat ? cat.color : '#888');

  if (task.completed) widget.classList.add('task--done');

  const todayISO = toISODate(new Date());
  if (!task.completed && task.date < todayISO) {
    widget.classList.add('task--overdue');
  }

  // Позиция и высота по времени
  if (task.startTime && task.endTime) {
    const startMinutes = timeToMinutes(task.startTime);
    const endMinutes = timeToMinutes(task.endTime);
    const dayStartMin = DAY_START_HOUR * 60;

    const topPx = ((startMinutes - dayStartMin) / 60) * PX_PER_HOUR;
    const heightPx = Math.max(((endMinutes - startMinutes) / 60) * PX_PER_HOUR, 26);

    widget.style.top = topPx + 'px';
    widget.style.height = heightPx + 'px';

    const time = document.createElement('span');
    time.className = 'task__time';
    time.textContent = `${task.startTime} — ${task.endTime}`;
    widget.appendChild(time);
  } else {
    widget.style.top = '8px';
  }

  const title = document.createElement('span');
  title.className = 'task__title';
  title.textContent = task.title;
  widget.appendChild(title);

  // Пояснение + стрелочка
  if (task.note) {
    const note = document.createElement('div');
    note.className = 'task__note';
    note.textContent = task.note;
    widget.appendChild(note);

    const toggle = document.createElement('button');
    toggle.className = 'task__expand';
    toggle.type = 'button';
    toggle.textContent = '⌄';
    toggle.title = 'Показать/скрыть пояснение';
    widget.appendChild(toggle);

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      widget.classList.toggle('task--expanded');
      toggle.style.transform = widget.classList.contains('task--expanded')
        ? 'rotate(180deg)'
        : 'rotate(0deg)';
    });
  }

  // Крестик удаления
  const del = document.createElement('button');
  del.className = 'task__delete';
  del.type = 'button';
  del.textContent = '×';
  widget.appendChild(del);

  // Обработчики
  widget.addEventListener('click', (e) => {
    if (e.target.closest('.task__delete')) return;
    if (e.target.closest('.task__edit')) return;
    if (e.target.closest('.task__expand')) return;
    if (e.target.closest('.task__note')) return;
    toggleTask(task.id);
  });
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });
  title.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEdit(widget, title, task.id);
  });

  container.appendChild(widget);
}

// ===== Свободные окна =====
function renderFreeSlots(weekTasks, dateStrings) {
  dateStrings.forEach((dateStr, i) => {
    const dayNumber = i + 1;
    const column = document.querySelector(`.week__column[data-day="${dayNumber}"]`);
    if (!column) return;

    const container = column.querySelector('.week__tasks');

    const dayTasks = weekTasks.filter(t =>
      t.date === dateStr && t.startTime && t.endTime
    );
    if (dayTasks.length === 0) return;

    dayTasks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const dayStart = DAY_START_HOUR * 60;
    const dayEnd = DAY_END_HOUR * 60;

    const busy = dayTasks.map(t => ({
      start: timeToMinutes(t.startTime),
      end: timeToMinutes(t.endTime)
    }));

    const freeSlots = [];
    let cursor = dayStart;
    busy.forEach(slot => {
      if (slot.start - cursor >= MIN_FREE_MINUTES) {
        freeSlots.push({ start: cursor, end: slot.start });
      }
      cursor = Math.max(cursor, slot.end);
    });
    if (dayEnd - cursor >= MIN_FREE_MINUTES) {
      freeSlots.push({ start: cursor, end: dayEnd });
    }

    freeSlots.forEach(slot => {
      const topPx = ((slot.start - dayStart) / 60) * PX_PER_HOUR;
      const heightPx = ((slot.end - slot.start) / 60) * PX_PER_HOUR;

      const el = document.createElement('div');
      el.className = 'free-slot';
      el.style.top = topPx + 'px';
      el.style.height = heightPx + 'px';
      el.textContent = formatDuration(slot.end - slot.start);

      container.appendChild(el);
    });
  });
}

// ===== Переключение задачи =====
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks(tasks);
  const widget = document.querySelector(`.task[data-id="${id}"]`);
  if (!widget) return;
  widget.classList.toggle('task--done', task.completed);
}

// ===== Удаление =====
function deleteTask(id) {
  const widget = document.querySelector(`.task[data-id="${id}"]`);
  if (widget) {
    widget.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    widget.style.opacity = '0';
    widget.style.transform = 'translateX(12px) scale(0.96)';
  }
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  setTimeout(() => {
    if (widget) widget.remove();
    // перерисуем свободные окна
    const dates = getWeekDates(weekOffset);
    const dateStrings = dates.map(toISODate);
    const weekTasks = tasks.filter(t => dateStrings.includes(t.date));
    document.querySelectorAll('.free-slot').forEach(el => el.remove());
    renderFreeSlots(weekTasks, dateStrings);
  }, 250);
}

// ===== Редактирование текста =====
function startEdit(widget, titleEl, id) {
  if (widget.querySelector('.task__edit')) return;
  const currentText = titleEl.textContent;

  const input = document.createElement('input');
  input.className = 'task__edit';
  input.type = 'text';
  input.value = currentText;
  input.maxLength = 80;

  widget.replaceChild(input, titleEl);
  input.focus();
  input.select();

  const finish = (save) => {
    if (save) {
      const newText = input.value.trim();
      if (newText) {
        const task = tasks.find(t => t.id === id);
        if (task) {
          task.title = newText;
          saveTasks(tasks);
        }
        titleEl.textContent = newText;
      }
    }
    widget.replaceChild(titleEl, input);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

// ===== Шкала времени =====
function renderTimeScale() {
  const scale = document.getElementById('timeScale');
  if (!scale) return;
  scale.innerHTML = '';
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const item = document.createElement('div');
    item.className = 'time-scale__item';
    item.textContent = String(h).padStart(2, '0') + ':00';
    item.style.top = ((h - DAY_START_HOUR) * PX_PER_HOUR) + 'px';
    scale.appendChild(item);
  }
}

// ===== Фон =====
function applyWeekBackground(offset) {
  const bg = document.getElementById('bg');
  if (!bg) return;
  const backgrounds = [
    { bg: `radial-gradient(circle at 20% 30%, rgba(255,224,102,0.06), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,165,0,0.05), transparent 45%), linear-gradient(160deg, #16150F 0%, #0B0A08 100%)`, size: 'auto, auto, cover' },
    { bg: `repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 14px), linear-gradient(180deg, #0F0E0C 0%, #17140E 100%)`, size: 'auto, cover' },
    { bg: `radial-gradient(rgba(255,224,102,0.07) 1px, transparent 1.5px), linear-gradient(200deg, #12110C 0%, #0A0A08 100%)`, size: '22px 22px, cover' },
    { bg: `radial-gradient(ellipse at 50% 0%, rgba(245,183,30,0.12), transparent 55%), linear-gradient(180deg, #14120C 0%, #0A0A08 100%)`, size: 'auto, cover' },
    { bg: `radial-gradient(ellipse at 100% 50%, rgba(255,140,66,0.12), transparent 50%), linear-gradient(120deg, #0A0A08 0%, #15120C 100%)`, size: 'auto, cover' },
    { bg: `repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 9px), linear-gradient(220deg, #13110C 0%, #0B0A08 100%)`, size: 'auto, cover' },
    { bg: `radial-gradient(circle at 30% 20%, rgba(255,239,138,0.10), transparent 35%), radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.4px), linear-gradient(180deg, #0E0D0B 0%, #050504 100%)`, size: 'auto, 26px 26px, cover' }
  ];
  const idx = ((offset % backgrounds.length) + backgrounds.length) % backgrounds.length;
  const chosen = backgrounds[idx];
  bg.style.background = chosen.bg;
  bg.style.backgroundSize = chosen.size;
  bg.style.backgroundPosition = 'center';
  bg.style.backgroundRepeat = 'no-repeat, repeat';
}

// ===== Рендер всей недели =====
function renderAll() {
  const weekEl = document.getElementById('week');
  if (!weekEl) return;

  document.querySelectorAll('.week__tasks').forEach(c => (c.innerHTML = ''));

  const dates = getWeekDates(weekOffset);
  const dateStrings = dates.map(toISODate);
  const weekTasks = tasks.filter(t => dateStrings.includes(t.date));

  weekTasks.forEach(renderTask);
  renderFreeSlots(weekTasks, dateStrings);

  const label = document.getElementById('weekLabel');
  if (label) label.textContent = formatWeekLabel(dates);

  applyWeekBackground(weekOffset);

  if (viewMode === 'day') {
    weekEl.classList.add('week--day-mode');
    document.querySelectorAll('.week__column').forEach(col => {
      col.classList.remove('week__column--focused');
      if (Number(col.dataset.day) === focusedDay) {
        col.classList.add('week__column--focused');
      }
    });
    const closeBtn = document.getElementById('dayClose');
    if (closeBtn) closeBtn.classList.add('day-close--visible');
  } else {
    weekEl.classList.remove('week--day-mode');
    document.querySelectorAll('.week__column').forEach(col => {
      col.classList.remove('week__column--focused');
    });
    const closeBtn = document.getElementById('dayClose');
    if (closeBtn) closeBtn.classList.remove('day-close--visible');
  }
}

// ===== Навигация: смена недели / дня =====
function changeWeek(delta) {
  weekOffset += delta;
  renderAll();
}

function changeDay(delta) {
  focusedDay += delta;
  if (focusedDay < 1) {
    weekOffset -= 1;
    focusedDay = 7;
  } else if (focusedDay > 7) {
    weekOffset += 1;
    focusedDay = 1;
  }
  renderAll();
}

function enterDayMode(dayNumber) {
  viewMode = 'day';
  focusedDay = dayNumber;
  renderAll();
}

function exitDayMode() {
  viewMode = 'week';
  renderAll();
}

// ===== Модальное окно =====
const modal = document.getElementById('modal');
const addBtn = document.getElementById('addBtn');
const cancelBtn = document.getElementById('cancelBtn');
const overlay = document.getElementById('modalOverlay');
const form = document.getElementById('taskForm');
const dateInput = document.getElementById('taskDate');

function openModal() {
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  document.getElementById('taskStart').value = '09:00';
  document.getElementById('taskEnd').value = '10:00';
  modal.classList.add('modal--open');
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  modal.classList.remove('modal--open');
  form.reset();
}

if (addBtn) addBtn.addEventListener('click', openModal);
if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
if (overlay) overlay.addEventListener('click', closeModal);

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const newTask = {
      id: makeId(),
      title: formData.get('title').trim(),
      category: formData.get('category'),
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      note: (formData.get('note') || '').trim(),
      completed: false
    };

    if (!newTask.title) return;

    if (timeToMinutes(newTask.endTime) <= timeToMinutes(newTask.startTime)) {
      alert('Время конца должно быть позже начала');
      return;
    }

    tasks.push(newTask);
    saveTasks(tasks);
    renderAll();
    closeModal();
  });
}

// ===== Навигация стрелками =====
const prevBtn = document.getElementById('prevWeek');
const nextBtn = document.getElementById('nextWeek');

if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    if (viewMode === 'day') changeDay(-1);
    else changeWeek(-1);
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    if (viewMode === 'day') changeDay(1);
    else changeWeek(1);
  });
}

const dayCloseBtn = document.getElementById('dayClose');
if (dayCloseBtn) {
  dayCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exitDayMode();
  });
}

document.addEventListener('keydown', (e) => {
  if (modal && modal.classList.contains('modal--open')) return;
  if (e.key === 'ArrowLeft')  viewMode === 'day' ? changeDay(-1) : changeWeek(-1);
  if (e.key === 'ArrowRight') viewMode === 'day' ? changeDay(1)  : changeWeek(1);
  if (e.key === 'Escape' && viewMode === 'day') exitDayMode();
});

function setupNavZones() {
}

function setupColumnClicks() {
  document.querySelectorAll('.week__column').forEach(col => {
    col.addEventListener('click', (e) => {
      if (e.target.closest('.task')) return;
      if (viewMode === 'day') return;
      enterDayMode(Number(col.dataset.day));
    });
  });
}

// ===== Запуск =====
document.addEventListener('DOMContentLoaded', () => {
  const bg = document.getElementById('bg');
  const scene = document.querySelector('.scene');

  if (bg) requestAnimationFrame(() => bg.classList.add('bg--visible'));
  if (scene) setTimeout(() => scene.classList.add('scene--visible'), 1000);

  setupNavZones();
  setupColumnClicks();
  renderTimeScale();
  renderAll();
});