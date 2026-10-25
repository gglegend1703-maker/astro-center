import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("create-event-form");
const formMessage = document.getElementById("form-message");
const eventsContainer = document.getElementById("events-container");

// 1. Проверка авторизации
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
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
  loadEvents();
  loadGuests();
});

// 2. Загрузка экскурсий
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
  }
}

// 3. Загрузка гостей (с кнопками подтверждения)
async function loadGuests() {
  const container = document.getElementById("guests-container");
  container.innerHTML = "Загрузка...";
  try {
    const querySnapshot = await getDocs(collection(db, "registrations"));
    if (querySnapshot.empty) {
      container.innerHTML = "<p style='color: #94a3b8;'>Пока нет ни одной заявки.</p>";
      return;
    }

    let html = `
      <table style="width: 100%; border-collapse: collapse; text-align: left; color: #cbd5e1; font-size: 14px;">
        <tr style="border-bottom: 2px solid #475569;">
          <th style="padding: 10px;">№</th>
          <th style="padding: 10px;">Экскурсия</th>
          <th style="padding: 10px;">ФИО (все)</th>
          <th style="padding: 10px;">Сумма</th>
          <th style="padding: 10px;">Статус</th>
          <th style="padding: 10px;">Действие</th>
        </tr>
    `;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let names = "—";
      if (data.guests && Array.isArray(data.guests)) {
        names = data.guests.map(g => `${g.name} ${g.isChild ? '(реб.)' : ''}`).join("<br>");
      }
      
      const status = data.status === "pending" ? "⏳ Ожидает" : "✅ Оплачено";
      const statusColor = data.status === "pending" ? "#fbbf24" : "#4ade80";
      
      let actionBtn = "";
      if (data.status === "pending") {
        actionBtn = `<button onclick="confirmPayment('${docSnap.id}')" style="background: #10b981; padding: 5px 10px; width: auto; font-size: 12px;">Подтвердить</button>`;
      } else {
        actionBtn = `<span style="color: #94a3b8; font-size: 12px;">Готово</span>`;
      }

      html += `
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 10px; color: #a78bfa; font-weight: bold;">${data.listNumber || '—'}</td>
          <td style="padding: 10px;">${data.eventTitle || data.eventId}</td>
          <td style="padding: 10px;">${names}</td>
          <td style="padding: 10px;">${data.totalPrice || 0} руб.</td>
          <td style="padding: 10px; color: ${statusColor}; font-weight: bold;">${status}</td>
          <td style="padding: 10px;">${actionBtn}</td>
        </tr>
      `;
    });

    html += `</table>`;
    container.innerHTML = html;
  } catch (error) {
    console.error("Ошибка загрузки гостей:", error);
    container.innerHTML = "<p style='color: #f87171;'>Ошибка загрузки.</p>";
  }
}

// 4. Подтверждение оплаты
window.confirmPayment = async function(regId) {
  if (!confirm("Вы уверены, что оплата поступила? Места будут забронированы.")) return;
  try {
    await updateDoc(doc(db, "registrations", regId), { status: "paid" });
    loadGuests(); 
  } catch (error) {
    console.error("Ошибка обновления:", error);
    alert("Не удалось обновить статус.");
  }
};

// 5. Генерация Word
window.downloadWord = async function() {
  try {
    const q = query(collection(db, "registrations"), where("status", "==", "paid"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      alert("Нет оплаченных заявок для формирования списка.");
      return;
    }

    let allGuests = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.guests && Array.isArray(data.guests)) {
        data.guests.forEach(g => {
          allGuests.push({ name: g.name.toUpperCase(), isChild: g.isChild, event: data.eventTitle });
        });
      }
    });

    allGuests.sort((a, b) => a.name.localeCompare(b.name));

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>Список гостей</title></head>
      <body>
        <h2 style="text-align: center;">Список гостей обсерватории (алфавитный порядок)</h2>
        <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f2f2f2;">
            <th>№</th>
            <th>ФИО</th>
            <th>Категория</th>
            <th>Экскурсия</th>
          </tr>
    `;

    allGuests.forEach((guest, index) => {
      htmlContent += `
        <tr>
          <td>${index + 1}</td>
          <td>${guest.name}</td>
          <td>${guest.isChild ? "Ребенок (до 14 лет)" : "Взрослый"}</td>
          <td>${guest.event}</td>
        </tr>
      `;
    });

    htmlContent += `</table></body></html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Список_гостей_обсерватории.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Ошибка генерации Word:", error);
    alert("Ошибка при создании файла.");
  }
};

// 6. Создание экскурсии
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
      title, date, limit, description: desc, createdAt: new Date().toISOString()
    });
    formMessage.textContent = "Экскурсия успешно создана!";
    formMessage.className = "success";
    form.reset();
    loadEvents(); 
  } catch (error) {
    formMessage.textContent = "Ошибка при создании.";
    formMessage.className = "error";
  }
});

// 7. Создание новости (через ImgBB)
const newsForm = document.getElementById("create-news-form");
const newsMessage = document.getElementById("news-message");

if (newsForm) {
  newsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    newsMessage.textContent = "Публикация...";
    newsMessage.className = "";

    const title = document.getElementById("news-title").value;
    const content = document.getElementById("news-content").value;
    const fileInput = document.getElementById("news-photo");
    const file = fileInput.files[0];

    try {
      let imageUrl = "";

      if (file) {
        // ВСТАВЬТЕ СЮДА ВАШ КЛЮЧ IMGBB
        const IMGBB_API_KEY = "d24bd2790ad860c507ebda4faef55517"; 
        
        const formData = new FormData();
        formData.append("image", file);
        formData.append("key", IMGBB_API_KEY);

        const response = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          imageUrl = result.data.url;
        } else {
          throw new Error("Ошибка ImgBB: " + result.error.message);
        }
      }

      await addDoc(collection(db, "news"), {
        title: title,
        content: content,
        imageUrl: imageUrl,
        createdAt: new Date().toISOString()
      });

      newsMessage.textContent = "Новость успешно опубликована!";
      newsMessage.className = "success";
      newsForm.reset();
      
    } catch (error) {
      console.error("Ошибка публикации:", error);
      newsMessage.textContent = "Ошибка: " + error.message;
      newsMessage.className = "error";
    }
  });
}
