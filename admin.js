import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Элементы страницы
const form = document.getElementById("create-event-form");
const formMessage = document.getElementById("form-message");
const eventsContainer = document.getElementById("events-container");

// Защита страницы и запуск загрузки данных
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html"; // Если не вошел, кидаем на главную
    return;
  }
  
  // Проверка на админа
  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));
    if (!adminDoc.exists()) {
      alert("У вас нет прав администратора!");
      window.location.href = "index.html";
      return;
    }
  } catch (error) {
    console.error("Ошибка проверки прав:", error);
    return;
  }

  // Если проверка пройдена — загружаем данные
  loadEvents();
  loadGuests(); // <--- ВОТ ЭТА СТРОКА ЗАПУСКАЕТ ЗАГРУЗКУ ГОСТЕЙ
});

// Функция загрузки экскурсий
async function loadEvents() {
  eventsContainer.innerHTML = "Загрузка...";
  try {
    const querySnapshot = await getDocs(collection(db, "events"));
    eventsContainer.innerHTML = ""; 

    if (querySnapshot.empty) {
      eventsContainer.innerHTML = "<p style='color: #94a3b8;'>Пока нет созданных экскурсий.</p>";
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const date = new Date(data.date).toLocaleString("ru-RU");
      
      const el = document.createElement("div");
      el.className = "event-item";
      el.innerHTML = `
        <div class="event-info">
          <h3>${data.title}</h3>
          <p>📅 ${date} | 👥 Лимит: ${data.limit} чел.</p>
        </div>
      `;
      eventsContainer.appendChild(el);
    });
  } catch (error) {
    console.error("Ошибка загрузки:", error);
    eventsContainer.innerHTML = `<p style="color: #f87171;">Ошибка загрузки данных.</p>`;
  }
}

// Функция загрузки гостей
async function loadGuests() {
  const container = document.getElementById("guests-container");
  container.innerHTML = "Загрузка...";

  try {
    const querySnapshot = await getDocs(collection(db, "registrations"));
    
    if (querySnapshot.empty) {
      container.innerHTML = "<p style='color: #94a3b8;'>Пока нет ни одной заявки.</p>";
      return;
    }

    // Получаем список экскурсий, чтобы знать их названия
    const eventsSnapshot = await getDocs(collection(db, "events"));
    const eventsMap = {};
    eventsSnapshot.forEach(doc => {
      eventsMap[doc.id] = doc.data().title;
    });

    // Строим таблицу
    let html = `
      <table style="width: 100%; border-collapse: collapse; text-align: left; color: #cbd5e1;">
        <tr style="border-bottom: 2px solid #475569;">
          <th style="padding: 10px;">Экскурсия</th>
          <th style="padding: 10px;">Email гостя</th>
          <th style="padding: 10px;">Дата заявки</th>
        </tr>
    `;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const eventTitle = eventsMap[data.eventId] || "Неизвестно";
      const regDate = new Date(data.createdAt).toLocaleString("ru-RU");
      
      html += `
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 10px; color: #a78bfa; font-weight: bold;">${eventTitle}</td>
          <td style="padding: 10px;">${data.userEmail}</td>
          <td style="padding: 10px;">${regDate}</td>
        </tr>
      `;
    });

    html += `</table>`;
    container.innerHTML = html;

  } catch (error) {
    console.error("Ошибка загрузки гостей:", error);
    container.innerHTML = "<p style='color: #f87171;'>Ошибка загрузки списка гостей.</p>";
  }
}

// Обработка формы создания экскурсии
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "Создание...";
  formMessage.className = "";

  const title = document.getElementById("event-title").value;
  const date = document.getElementById("event-date").value;
  const limit = parseInt(document.getElementById("event-limit").value);
  const desc = document.getElementById("event-desc").value;

  try {
    await addDoc(collection(db, "events"), {
      title: title,
      date: date,
      limit: limit,
      description: desc,
      createdAt: new Date().toISOString()
    });

    formMessage.textContent = "Экскурсия успешно создана!";
    formMessage.className = "success";
    form.reset();
    
    loadEvents(); // Обновляем список экскурсий
  } catch (error) {
    console.error("Ошибка добавления:", error);
    formMessage.textContent = "Ошибка при создании. Проверьте консоль.";
    formMessage.className = "error";
  }
});
