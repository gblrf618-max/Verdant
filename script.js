// ===== Категории =====
const categories = {
  health:    { name: 'Здоровье',       color: '#5bad8b' },
  beauty:    { name: 'Внешность',      color: '#87395c' },
  study:     { name: 'Учёба',          color: '#475fa3' },
  rest:      { name: 'Отдых',          color: '#705ea4' },
  home:      { name: 'Дом/Быт',        color: '#ab6a47' },
  urgent:    { name: 'Важно-срочно',   color: '#e8d175' },
  important: { name: 'Несрочно-важно', color: '#a64a23' }
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
let editingTaskId = null;    // null = создание новой, id = редактируем

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
  let heightPx = 0;
  if (task.startTime && task.endTime) {
    const startMinutes = timeToMinutes(task.startTime);
    const endMinutes = timeToMinutes(task.endTime);
    const dayStartMin = DAY_START_HOUR * 60;

    const topPx = ((startMinutes - dayStartMin) / 60) * PX_PER_HOUR;
    heightPx = Math.max(((endMinutes - startMinutes) / 60) * PX_PER_HOUR, 26);

    widget.style.top = topPx + 'px';
    widget.style.height = heightPx + 'px';

    // Плашку времени показываем ТОЛЬКО если задача выше 45px (≈45 мин)
    if (heightPx >= 50) {
      const time = document.createElement('span');
      time.className = 'task__time';
      time.textContent = `${task.startTime} — ${task.endTime}`;
      widget.appendChild(time);
    } else {
      // на коротких — короткий маркер-класс
      widget.classList.add('task--short');
    }
  } else {
    widget.style.top = '8px';
  }

  // Название
  const title = document.createElement('span');
  title.className = 'task__title';
  title.textContent = task.title;
  widget.appendChild(title);

   // Пояснение — только если задача ≥ 60 минут (60px высоты)
  const isLongEnough = task.startTime && task.endTime && heightPx >= 60;
  if (task.note && isLongEnough) {
    const note = document.createElement('div');
    note.className = 'task__note';
    note.textContent = task.note;
    widget.appendChild(note);
  }

  // Кнопки в углу
  const actions = document.createElement('div');
  actions.className = 'task__actions';

  const edit = document.createElement('button');
  edit.className = 'task__edit-btn';
  edit.type = 'button';
  edit.textContent = '✎';
  edit.title = 'Редактировать';
  actions.appendChild(edit);

  const del = document.createElement('button');
  del.className = 'task__delete';
  del.type = 'button';
  del.textContent = '×';
  del.title = 'Удалить';
  actions.appendChild(del);

  widget.appendChild(actions);

  // Обработчики
  widget.addEventListener('click', (e) => {
    if (e.target.closest('.task__delete')) return;
    if (e.target.closest('.task__edit-btn')) return;
    if (e.target.closest('.task__note')) return;
    if (e.target.closest('.task__edit')) return;
    toggleTask(task.id);
  });

  edit.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(task.id);
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
    // 0. Тёплое янтарное сияние — с тонкой диагональной текстурой
    {
      bg: `
        radial-gradient(ellipse 80% 60% at 20% 30%, rgba(255, 224, 102, 0.15), transparent 60%),
        radial-gradient(ellipse 70% 50% at 80% 70%, rgba(255, 165, 0, 0.10), transparent 65%),
        radial-gradient(ellipse 60% 40% at 50% 100%, rgba(245, 183, 30, 0.08), transparent 60%),
        repeating-linear-gradient(135deg, rgba(255, 224, 102, 0.02) 0 1px, transparent 1px 20px),
        linear-gradient(160deg, #1A1813 0%, #0A0A08 100%)
      `,
      size: 'auto, auto, auto, auto, cover',
      repeat: 'no-repeat, no-repeat, no-repeat, repeat, no-repeat'
    },

    // 1. Холодный синий туман — с тонкими горизонтальными волнами
    {
      bg: `
        radial-gradient(ellipse 90% 70% at 70% 20%, rgba(120, 180, 220, 0.12), transparent 60%),
        radial-gradient(ellipse 60% 80% at 20% 80%, rgba(80, 120, 180, 0.10), transparent 65%),
        repeating-linear-gradient(0deg, rgba(120, 180, 220, 0.025) 0 1px, transparent 1px 28px),
        linear-gradient(180deg, #0E1015 0%, #0A0B0F 100%)
      `,
      size: 'auto, auto, auto, cover',
      repeat: 'no-repeat, no-repeat, repeat, no-repeat'
    },

    // 2. Фиолетовое сияние снизу — с мягким «свечением» из центра
    {
      bg: `
        radial-gradient(ellipse 100% 60% at 50% 100%, rgba(160, 120, 200, 0.15), transparent 60%),
        radial-gradient(ellipse 50% 40% at 80% 20%, rgba(120, 100, 180, 0.08), transparent 65%),
        radial-gradient(circle at 50% 50%, rgba(160, 120, 200, 0.04), transparent 40%),
        linear-gradient(200deg, #100E15 0%, #0A0A0F 100%)
      `,
      size: 'auto, auto, auto, cover',
      repeat: 'no-repeat, no-repeat, no-repeat, no-repeat'
    },

    // 3. Тёплое свечение сверху — с тонкой сеткой (утро)
    {
      bg: `
        radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255, 200, 100, 0.14), transparent 55%),
        radial-gradient(ellipse 60% 50% at 20% 50%, rgba(255, 165, 0, 0.08), transparent 65%),
        repeating-linear-gradient(90deg, rgba(255, 200, 100, 0.02) 0 1px, transparent 1px 24px),
        repeating-linear-gradient(0deg, rgba(255, 200, 100, 0.02) 0 1px, transparent 1px 24px),
        linear-gradient(180deg, #18140E 0%, #0A0907 100%)
      `,
      size: 'auto, auto, auto, auto, cover',
      repeat: 'no-repeat, no-repeat, repeat, repeat, no-repeat'
    },

    // 4. Изумрудные всполохи — с лёгким звёздным шумом
    {
      bg: `
        radial-gradient(ellipse 70% 60% at 80% 30%, rgba(100, 180, 140, 0.10), transparent 60%),
        radial-gradient(ellipse 80% 50% at 20% 70%, rgba(80, 150, 120, 0.08), transparent 65%),
        radial-gradient(circle at 60% 100%, rgba(120, 200, 160, 0.06), transparent 45%),
        radial-gradient(rgba(150, 220, 180, 0.04) 1px, transparent 1.5px),
        linear-gradient(140deg, #0E1412 0%, #080A09 100%)
      `,
      size: 'auto, auto, auto, 28px 28px, cover',
      repeat: 'no-repeat, no-repeat, no-repeat, repeat, no-repeat'
    },

    // 5. Розово-персиковый закат — с тонкими диагональными линиями
    {
      bg: `
        radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255, 160, 130, 0.12), transparent 60%),
        radial-gradient(ellipse 60% 50% at 80% 30%, rgba(230, 130, 160, 0.08), transparent 65%),
        repeating-linear-gradient(45deg, rgba(255, 160, 130, 0.02) 0 1px, transparent 1px 22px),
        linear-gradient(200deg, #16100F 0%, #0A0808 100%)
      `,
      size: 'auto, auto, auto, cover',
      repeat: 'no-repeat, no-repeat, repeat, no-repeat'
    },

    // 6. Тёмная синева — со звёздной пылью двух размеров
    {
      bg: `
        radial-gradient(circle at 30% 25%, rgba(140, 180, 255, 0.10), transparent 45%),
        radial-gradient(circle at 75% 70%, rgba(100, 140, 220, 0.06), transparent 50%),
        radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1.5px),
        radial-gradient(rgba(200, 220, 255, 0.03) 0.5px, transparent 1px),
        linear-gradient(180deg, #0A0C12 0%, #050507 100%)
      `,
      size: 'auto, auto, 32px 32px, 18px 18px, cover',
      repeat: 'no-repeat, no-repeat, repeat, repeat, no-repeat'
    }
  ];

   const idx = ((offset % backgrounds.length) + backgrounds.length) % backgrounds.length;
  const chosen = backgrounds[idx];

  bg.style.background = chosen.bg;
  bg.style.backgroundSize = chosen.size;
  bg.style.backgroundPosition = 'center';
  bg.style.backgroundRepeat = chosen.repeat;
  bg.style.backgroundAttachment = 'fixed';
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
  editingTaskId = null;
  document.querySelector('.modal__title').textContent = 'Новая задача';
  document.getElementById('taskDeleteBtn').style.display = 'none';

  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  document.getElementById('taskStart').value = '09:00';
  document.getElementById('taskEnd').value = '10:00';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskNote').value = '';
  document.getElementById('taskCategory').value = 'health';

  modal.classList.add('modal--open');
  document.getElementById('taskTitle').focus();
}

function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingTaskId = id;
  document.querySelector('.modal__title').textContent = 'Редактировать задачу';
  document.getElementById('taskDeleteBtn').style.display = 'inline-block';

  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskCategory').value = task.category;
  document.getElementById('taskDate').value = task.date;
  document.getElementById('taskStart').value = task.startTime || '09:00';
  document.getElementById('taskEnd').value = task.endTime || '10:00';
  document.getElementById('taskNote').value = task.note || '';

  modal.classList.add('modal--open');
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  modal.classList.remove('modal--open');
  form.reset();
}

function deleteFromModal() {
  if (!editingTaskId) return;
  if (!confirm('Удалить задачу?')) return;
  const id = editingTaskId;
  editingTaskId = null;
  deleteTask(id);
  closeModal();
}

if (addBtn) addBtn.addEventListener('click', openModal);
if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
if (overlay) overlay.addEventListener('click', closeModal);

const deleteBtn = document.getElementById('taskDeleteBtn');
if (deleteBtn) deleteBtn.addEventListener('click', deleteFromModal);

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const data = {
      title: formData.get('title').trim(),
      category: formData.get('category'),
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      note: (formData.get('note') || '').trim()
    };

    if (!data.title) return;

    if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) {
      alert('Время конца должно быть позже начала');
      return;
    }

    if (editingTaskId) {
      // обновляем существующую
      const task = tasks.find(t => t.id === editingTaskId);
      if (task) {
        Object.assign(task, data);
        saveTasks(tasks);
      }
    } else {
      // создаём новую
      const newTask = {
        id: makeId(),
        ...data,
        completed: false
      };
      tasks.push(newTask);
      saveTasks(tasks);
    }

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