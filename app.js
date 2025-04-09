// DOM элементы
const noteInput = document.getElementById('note-input');
const addNoteBtn = document.getElementById('add-note-btn');
const notesList = document.getElementById('notes-list');
const offlineStatus = document.getElementById('offline-status');

// Текущее состояние
let currentEditingId = null;

// Проверка онлайн статуса
function updateOnlineStatus() {
    if (navigator.onLine) {
        offlineStatus.classList.add('hidden');
    } else {
        offlineStatus.classList.remove('hidden');
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// Инициализация базы данных
let db;
const DB_NAME = 'notesDB';
const STORE_NAME = 'notes';

function initDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.log("IndexedDB не поддерживается");
            resolve(null);
            return;
        }

        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = (event) => {
            console.error("Ошибка открытия базы данных", event);
            reject("Ошибка базы данных");
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Сохранение заметки
async function saveNote(noteText) {
    if (!noteText.trim()) return;

    const note = {
        text: noteText,
        date: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (currentEditingId) {
        // Редактирование существующей заметки
        note.id = currentEditingId;
        if (db) {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await store.put(note);
        } else {
            let notes = JSON.parse(localStorage.getItem('notes') || '[]');
            notes = notes.map(n => n.id === currentEditingId ? note : n);
            localStorage.setItem('notes', JSON.stringify(notes));
        }
        currentEditingId = null;
    } else {
        // Создание новой заметки
        if (db) {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await store.add(note);
        } else {
            const notes = JSON.parse(localStorage.getItem('notes') || '[]');
            notes.push({
                id: Date.now(),
                ...note
            });
            localStorage.setItem('notes', JSON.stringify(notes));
        }
    }

    noteInput.value = '';
    addNoteBtn.textContent = 'Добавить';
    loadNotes();
}

// Загрузка заметок
async function loadNotes() {
    let notes = [];

    if (db) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        notes = await new Promise((resolve) => {
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    } else {
        notes = JSON.parse(localStorage.getItem('notes') || '[]');
    }

    renderNotes(notes.reverse());
}

// Удаление заметки
async function deleteNote(id) {
    if (confirm('Удалить эту заметку?')) {
        if (db) {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await store.delete(id);
        } else {
            let notes = JSON.parse(localStorage.getItem('notes') || '[]');
            notes = notes.filter(note => note.id !== id);
            localStorage.setItem('notes', JSON.stringify(notes));
        }

        if (currentEditingId === id) {
            currentEditingId = null;
            noteInput.value = '';
            addNoteBtn.textContent = 'Добавить';
        }

        loadNotes();
    }
}

// Редактирование заметки
function editNote(id) {
    if (db) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event) => {
            const note = event.target.result;
            if (note) {
                currentEditingId = id;
                noteInput.value = note.text;
                noteInput.focus();
                addNoteBtn.textContent = 'Сохранить';
            }
        };
    } else {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const note = notes.find(n => n.id === id);
        if (note) {
            currentEditingId = id;
            noteInput.value = note.text;
            noteInput.focus();
            addNoteBtn.textContent = 'Сохранить';
        }
    }
}

// Отображение заметок
function renderNotes(notes) {
    notesList.innerHTML = '';

    if (notes.length === 0) {
        notesList.innerHTML = '<p class="no-notes">Нет заметок</p>';
        return;
    }

    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note';
        
        const date = new Date(note.date);
        const updatedAt = note.updatedAt ? new Date(note.updatedAt) : null;
        
        let dateText = `Создано: ${date.toLocaleString()}`;
        if (updatedAt) {
            dateText += `<br>Изменено: ${updatedAt.toLocaleString()}`;
        }
        
        noteElement.innerHTML = `
            <div class="note-content">${note.text}</div>
            <div class="note-date">${dateText}</div>
            <div class="note-actions">
                <button class="edit-btn" data-id="${note.id}">Редактировать</button>
                <button class="delete-btn" data-id="${note.id}">Удалить</button>
            </div>
        `;
        
        notesList.appendChild(noteElement);
    });

    // Обработчики для кнопок
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = Number(e.target.getAttribute('data-id'));
            deleteNote(id);
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = Number(e.target.getAttribute('data-id'));
            editNote(id);
        });
    });
}

// Инициализация приложения
async function initApp() {
    await initDB();
    loadNotes();

    // Обработчик добавления/сохранения заметки
    addNoteBtn.addEventListener('click', () => {
        saveNote(noteInput.value);
    });

    noteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveNote(noteInput.value);
        }
    });

    // Отмена редактирования по ESC
    noteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentEditingId) {
            currentEditingId = null;
            noteInput.value = '';
            addNoteBtn.textContent = 'Добавить';
        }
    });
}

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker registration successful');
        }).catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}

// Запуск приложения
initApp();