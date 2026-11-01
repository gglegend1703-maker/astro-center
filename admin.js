import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("create-event-form");
const formMessage = document.getElementById("form-message");
const eventsContainer = document.getElementById("events-container");

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

async function loadGuests() {
  const container = document.getElementById("guests-container");
  container.innerHTML = "Загрузка...";
  
  try {
    // Загружаем пользователей для получения телефонов
    const usersSnapshot = await getDocs(collection(db, "users"));
    const usersMap = {};
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      usersMap[doc.id] = data.phone || "—";
    });

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
          <th style="padding: 10px;">Телефон</th>
        </tr>
    `;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let names = "—";
      if (data.guests && Array.isArray(data.guests)) {
        names = data.guests.map(g => `${g.name} ${g.isChild ? '(реб.)' : ''}`).join("<br>");
      }
      const phone = usersMap[data.userId] || "—";
      
      html += `
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 10px; color: #a78bfa; font-weight: bold;">${data.listNumber || '—'}</td>
          <td style="padding: 10px;">${data.eventTitle || data.eventId}</td>
          <td style="padding: 10px;">${names}</td>
          <td style="padding: 10px;">${data.totalPrice || 0} руб.</td>
          <td style="padding: 10px;">${phone}</td>
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

window.downloadWord = async function() {
  try {
    const q = query(collection(db, "registrations"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      alert("Нет заявок для формирования списка.");
      return;
    }

    // Получаем экскурсии
    const eventsSnapshot = await getDocs(collection(db, "events"));
    const eventsMap = {};
    eventsSnapshot.forEach(doc => {
      const data = doc.data();
      eventsMap[doc.id] = { title: data.title, date: data.date };
    });

    // Группируем заявки по экскурсиям
    const eventsData = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const eventId = data.eventId;
      const eventInfo = eventsMap[eventId] || { title: "Неизвестная экскурсия", date: "" };
      
      if (!eventsData[eventId]) {
        eventsData[eventId] = { 
          title: eventInfo.title, 
          date: eventInfo.date, 
          groups: [] // массив заявок
        };
      }

      // Собираем всех гостей этой заявки в одну группу
      if (data.guests && Array.isArray(data.guests)) {
        eventsData[eventId].groups.push({
          listNumber: data.listNumber,
          totalPrice: data.totalPrice,
          guests: data.guests.map(g => g.name.toUpperCase())
        });
      }
    });

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', serif; }
          h1 { text-align: center; }
          .event-header { margin-top: 30px; background: #f0f0f0; padding: 10px; border-left: 4px solid #4CAF50; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #e0e0e0; }
        </style>
      </head>
      <body>
        <h1>Списки гостей обсерватории</h1>
    `;

    for (const eventId in eventsData) {
      const event = eventsData[eventId];
      let dateStr = "Дата не указана", timeStr = "";
      if (event.date) {
        const d = new Date(event.date);
        dateStr = d.toLocaleDateString("ru-RU");
        timeStr = d.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
      }

      htmlContent += `
        <div class="event-header">
          <h2>Экскурсия: ${event.title}</h2>
          <p style="margin: 0;">Дата: ${dateStr} | Время: ${timeStr}</p>
        </div>
        <table>
          <tr>
            <th style="width: 50px;">№</th>
            <th style="width: 80px;">№ заявки</th>
            <th>ФИО</th>
            <th style="width: 100px;">Сумма заявки</th>
            <th style="width: 150px;">Отметка об оплате</th>
          </tr>`;

      let rowIndex = 1;

      // Перебираем каждую заявку (группу)
      event.groups.forEach(group => {
        // Количество человек в группе
        const groupSize = group.guests.length;

        group.guests.forEach((guestName, index) => {
          htmlContent += `<tr>`;
          
          // Если это первый человек в группе, объединяем ячейки (rowspan)
          if (index === 0) {
            htmlContent += `
              <td style="vertical-align: middle;" rowspan="${groupSize}">${rowIndex}</td>
              <td style="vertical-align: middle;" rowspan="${groupSize}">${group.listNumber}</td>
            `;
          }

          // ФИО
          htmlContent += `<td>${guestName}</td>`;

          // Если это первый человек в группе, объединяем сумму и отметку
          if (index === 0) {
            htmlContent += `
              <td style="vertical-align: middle;" rowspan="${groupSize}">${group.totalPrice} руб.</td>
              <td style="vertical-align: middle;" rowspan="${groupSize}"></td>
            `;
          }

          htmlContent += `</tr>`;
        });
        
        rowIndex++;
      });

      htmlContent += `</table>`;
    }

    htmlContent += `</body></html>`;

    const converted = window.htmlDocx.asBlob(htmlContent);
    const fileName = "Списки_гостей_по_экскурсиям.docx";

    const file = new File([converted], fileName, { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Списки гостей' });
        return; 
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(converted);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 60000); 

  } catch (error) {
    console.error("Ошибка генерации Word:", error);
    alert("Ошибка при создании файла.");
  }
};
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "Создание...";
  formMessage.className = "";
  const title = document.getElementById("event-title").value;
  const date = document.getElementById("event-date").value;
  const limit = parseInt(document.getElementById("event-limit").value);
  const desc = document.getElementById("event-desc").value;

  try {
    await addDoc(collection(db, "events"), { title, date, limit, description: desc, createdAt: new Date().toISOString() });
    formMessage.textContent = "Экскурсия успешно создана!";
    formMessage.className = "success";
    form.reset();
    loadEvents(); 
  } catch (error) {
    formMessage.textContent = "Ошибка при создании.";
    formMessage.className = "error";
  }
});

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
        const IMGBB_API_KEY = "d24bd2790ad860c507ebda4faef55517"; // Вставьте ваш ключ
        const formData = new FormData();
        formData.append("image", file);
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const result = await response.json();
        if (result.success) { imageUrl = result.data.url; }
        else { throw new Error("Ошибка ImgBB: " + result.error.message); }
      }
      await addDoc(collection(db, "news"), { title: title, content: content, imageUrl: imageUrl, createdAt: new Date().toISOString() });
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
