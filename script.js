// ===== Категории =====
const categories = {
  health:    { name: 'Здоровье',       color: '#f5d0c5' },
  beauty:    { name: 'Внешность',      color: '#dcd0f0' },
  study:     { name: 'Учёба',          color: '#f5edc5' },
  rest:      { name: 'Отдых',          color: '#d5eccb' },
  home:      { name: 'Дом/Быт',        color: '#ecdfc8' },
  urgent:    { name: 'Важно-срочно',   color: '#e8a5a5' },
  important: { name: 'Несрочно-важно', color: '#a5c8e8' }
};

// ===== Хранилище =====
const STORAGE_KEY = 'verdant-data';

// Стартовый набор — если localStorage пустой, покажем это
const starterTasks = [
  { id: 't1', title: 'Выпить витамины',       category: 'health',    date: '2026-09-28', completed: false },
  { id: 't2', title: 'Маска для лица',        category: 'beauty',    date: '2026-09-29', completed: false },
  { id: 't3', title: 'Прочитать главу книги', category: 'study',     date: '2026-09-30', completed: false }
];

// Загружаем задачи из localStorage. Если там пусто — берём стартовые.
function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return starterTasks.slice();
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch (e) {
    console.warn('Не удалось прочитать данные, беру стартовые', e);
    return starterTasks.slice();
  }
}

// Сохраняем задачи в localStorage
function saveTasks(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: list }));
}

// ===== Работа с задачами =====
let tasks = loadTasks();

// ===== Состояние навигации =====
let weekOffset = 0;        // 0 = текущая неделя, -1 = прошлая, +1 = следующая

// ===== Утилиты дат =====

// Получить понедельник недели, соответствующей смещению weekOffset
function getWeekStart(offset = 0) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);           // обнуляем время

  const jsDay = now.getDay();          // 0=Вс, 1=Пн...
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;  // сдвиг к понедельнику

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  return monday;
}

// Массив из 7 дат (Пн..Вс) для недели с заданным смещением
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

// Превратить Date в строку 'YYYY-MM-DD'
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Красивая подпись диапазона недели: «30 сент — 6 окт 2026»
function formatWeekLabel(dates) {
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const first = dates[0];
  const last = dates[6];
  const y = last.getFullYear();
  return `${first.getDate()} ${months[first.getMonth()]} — ${last.getDate()} ${months[last.getMonth()]} ${y}`;
}

// Утилита: из даты получить номер дня недели (1=Пн ... 7=Вс)
function getDayNumber(dateStr) {
  const d = new Date(dateStr);
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

// Утилита: сгенерировать уникальный id
function makeId() {
  return 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function renderTask(task) {
  const dayNumber = getDayNumber(task.date);
  const column = document.querySelector(`.week__column[data-day="${dayNumber}"]`);
  if (!column) return;

  const container = column.querySelector('.week__tasks');

  const widget = document.createElement('div');
  widget.className = 'task';
  widget.dataset.id = task.id;

  if (task.completed) {
    widget.classList.add('task--done');
    widget.style.background = lighten(categories[task.category].color);
  } else {
    widget.style.background = categories[task.category].color;
  }

  // --- Текст ---
  const title = document.createElement('span');
  title.className = 'task__title';
  title.textContent = task.title;
  widget.appendChild(title);

  // --- Крестик удаления ---
  const del = document.createElement('button');
  del.className = 'task__delete';
  del.type = 'button';
  del.textContent = '×';
  del.title = 'Удалить';
  widget.appendChild(del);

  // --- Обработчики ---
  // клик по виджету = переключить выполнение
  widget.addEventListener('click', (e) => {
    // если клик был по крестику или полю ввода — игнорируем
    if (e.target.closest('.task__delete')) return;
    if (e.target.closest('.task__edit')) return;
    toggleTask(task.id);
  });

  // клик по крестику = удалить (останавливаем всплытие)
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  // двойной клик по названию = редактирование
  title.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEdit(widget, title, task.id);
  });

  container.appendChild(widget);
}

// Удалить задачу
function deleteTask(id) {
  const widget = document.querySelector(`.task[data-id="${id}"]`);
  if (widget) {
    // маленькая анимация исчезновения
    widget.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    widget.style.opacity = '0';
    widget.style.transform = 'translateX(12px) scale(0.96)';
  }

  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);

  // убираем элемент из DOM после анимации
  setTimeout(() => {
    if (widget) widget.remove();
  }, 250);
}

// Включить режим редактирования
function startEdit(widget, titleEl, id) {
  // уже редактируем? не влезаем повторно
  if (widget.querySelector('.task__edit')) return;

  const currentText = titleEl.textContent;

  // создаём input на месте текста
  const input = document.createElement('input');
  input.className = 'task__edit';
  input.type = 'text';
  input.value = currentText;
  input.maxLength = 80;

  // подменяем
  widget.replaceChild(input, titleEl);
  input.focus();
  input.select();

  // завершить редактирование
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
    // возвращаем span на место
    widget.replaceChild(titleEl, input);
  };

  // Enter — сохранить, Esc — отменить
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });

  // клик вне поля — сохранить
  input.addEventListener('blur', () => finish(true));
}

// Переключить статус задачи
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks(tasks);

  // обновляем только этот виджет, без полной перерисовки
  const widget = document.querySelector(`.task[data-id="${id}"]`);
  if (!widget) return;

  if (task.completed) {
    widget.classList.add('task--done');
    widget.style.background = lighten(categories[task.category].color);
  } else {
    widget.classList.remove('task--done');
    widget.style.background = categories[task.category].color;
  }
}

// Осветлить цвет — для выполненной задачи (нейтральный оттенок категории)
function lighten(hex) {
  // hex вида #f5d0c5 → разбираем на R, G, B
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // подмешиваем белый на 55%
  const mix = (c) => Math.round(c + (255 - c) * 0.55);

  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// Перерисовать всю неделю с нуля
function renderAll() {
  // 1. Очищаем все контейнеры задач
  document.querySelectorAll('.week__tasks').forEach(c => (c.innerHTML = ''));

  // 2. Считаем даты текущей недели
  const dates = getWeekDates(weekOffset);
  const dateStrings = dates.map(toISODate);   // ['2026-09-28', '2026-09-29', ...]

  // 3. Фильтруем задачи: только те, что попадают в эту неделю
  const weekTasks = tasks.filter(t => dateStrings.includes(t.date));

  // 4. Рисуем
  weekTasks.forEach(renderTask);

  // 5. Обновляем подпись недели
  document.getElementById('weekLabel').textContent = formatWeekLabel(dates);

  // 6. Меняем фон под неделю (пока простые оттенки)
  applyWeekBackground(weekOffset);
}

// ===== Модальное окно =====
const modal = document.getElementById('modal');
const addBtn = document.getElementById('addBtn');
const cancelBtn = document.getElementById('cancelBtn');
const overlay = document.getElementById('modalOverlay');
const form = document.getElementById('taskForm');
const dateInput = document.getElementById('taskDate');

function openModal() {
  // по умолчанию — сегодняшняя дата
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  modal.classList.add('modal--open');
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  modal.classList.remove('modal--open');
  form.reset();
}

addBtn.addEventListener('click', openModal);
cancelBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('modal--open')) closeModal();
});

// Отправка формы
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const formData = new FormData(form);
  const newTask = {
    id: makeId(),
    title: formData.get('title').trim(),
    category: formData.get('category'),
    date: formData.get('date'),
    completed: false
  };

  if (!newTask.title) return;

  tasks.push(newTask);
  saveTasks(tasks);
  renderTask(newTask);
  closeModal();
});

// ===== Навигация по неделям =====
function changeWeek(delta) {
  weekOffset += delta;
  renderAll();
}

const prevBtn = document.getElementById('prevWeek');
const nextBtn = document.getElementById('nextWeek');

prevBtn.addEventListener('click', () => changeWeek(-1));
nextBtn.addEventListener('click', () => changeWeek(1));

// Стрелки клавиатуры
document.addEventListener('keydown', (e) => {
  if (modal.classList.contains('modal--open')) return; // не мешаем модалке
  if (e.key === 'ArrowLeft')  changeWeek(-1);
  if (e.key === 'ArrowRight') changeWeek(1);
});

// Невидимые зоны по краям экрана — показывают стрелки
function setupNavZones() {
  const leftZone  = document.createElement('div');
  const rightZone = document.createElement('div');
  leftZone.className  = 'nav-zone nav-zone--left';
  rightZone.className = 'nav-zone nav-zone--right';
  document.body.appendChild(leftZone);
  document.body.appendChild(rightZone);

  leftZone.addEventListener('mouseenter',  () => prevBtn.classList.add('nav-arrow--visible'));
  leftZone.addEventListener('mouseleave',  () => prevBtn.classList.remove('nav-arrow--visible'));
  rightZone.addEventListener('mouseenter', () => nextBtn.classList.add('nav-arrow--visible'));
  rightZone.addEventListener('mouseleave', () => nextBtn.classList.remove('nav-arrow--visible'));
}

// ===== Запуск =====
document.addEventListener('DOMContentLoaded', () => {
  const bg = document.getElementById('bg');
  const scene = document.querySelector('.scene');

  requestAnimationFrame(() => bg.classList.add('bg--visible'));
  setTimeout(() => scene.classList.add('scene--visible'), 1000);

  setupNavZones();
  renderAll();
   
});

function applyWeekBackground(offset) {
  const bg = document.getElementById('bg');

  // набор пастельных градиентов — по одному на каждую неделю
  const palettes = [
    'linear-gradient(135deg, #eef3ec, #e6f0e2)',
    'linear-gradient(135deg, #f5e6ef, #eef3ec)',
    'linear-gradient(135deg, #eef0f7, #f5eddc)',
    'linear-gradient(135deg, #e6f0e2, #f2e6d9)',
    'linear-gradient(135deg, #f7e6e0, #eef3ec)',
    'linear-gradient(135deg, #e8e6f5, #e2f0ea)',
    'linear-gradient(135deg, #f5eddc, #e0eef0)'
  ];

  // индекс: всегда 0..6, даже для отрицательных offset
  const idx = ((offset % palettes.length) + palettes.length) % palettes.length;
  bg.style.background = palettes[idx];
}