import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, query, where, deleteDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("create-event-form");
const formMessage = document.getElementById("form-message");
const eventsContainer = document.getElementById("events-container");

// Ограничиваем год
const eventDateInput = document.getElementById("event-date");
if (eventDateInput) {
  eventDateInput.setAttribute("max", "2100-12-31T23:59");
}

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
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const date = new Date(data.date).toLocaleString("ru-RU");
      const el = document.createElement("div");
      el.className = "event-item";
      
      el.innerHTML = `
        <div class="event-info">
          <h3>${data.title}</h3>
          <p>📅 ${date} | 👥 Лимит: ${data.limit} чел.</p>
        </div>
        <div style="display:flex; flex-direction: column; gap: 5px;">
            <button onclick="downloadWordForEvent('${docSnap.id}')" style="background: #3b82f6; width: auto; padding: 8px 15px; font-size: 12px; margin: 0;">📄 Word</button>
            <button onclick="deleteEvent('${docSnap.id}')" style="background: #ef4444; width: auto; padding: 8px 15px; font-size: 12px; margin: 0;">Удалить</button>
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
          <th style="padding: 10px;">Действие</th>
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
          <td style="padding: 10px;">
            <button onclick="deleteRegistration('${docSnap.id}')" 
                    style="background: #ef4444; width: auto; padding: 6px 12px; font-size: 12px; margin: 0;">
              🗑 Удалить
            </button>
          </td>
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

window.downloadWordForEvent = async function(eventId) {
  try {
    const q = query(collection(db, "registrations"), where("eventId", "==", eventId));
    const snapshot = await getDocs(q);
    
    const eventDoc = await getDoc(doc(db, "events", eventId));
    const eventData = eventDoc.data();
    
    let totalGuests = 0;
    const groups = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.guests && Array.isArray(data.guests)) {
        totalGuests += data.guests.length;
        groups.push({
          listNumber: data.listNumber,
          totalPrice: data.totalPrice,
          guests: data.guests.map(g => g.name.toUpperCase())
        });
      }
    });

    if (groups.length === 0) {
      alert("На эту экскурсию пока нет записей.");
      return;
    }

    const d = new Date(eventData.date);
    const dateStr = d.toLocaleDateString("ru-RU");
    const timeStr = d.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', serif; }
          h1 { text-align: center; }
          .header-info { text-align: center; margin-bottom: 20px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #e0e0e0; }
          .footer { text-align: left; font-weight: bold; margin-top: 10px; }
        </style>
      </head>
      <body>
        <h1>Список гостей Астрономического центра ВГУ</h1>
        <div class="header-info">на ${dateStr}, ${timeStr}</div>
        <table>
          <tr>
            <th style="width: 80px;">№ заявки</th>
            <th>ФИО</th>
            <th style="width: 120px;">Сумма заявки</th>
            <th style="width: 150px;">Отметка об оплате</th>
          </tr>`;

    groups.forEach(group => {
      const groupSize = group.guests.length;
      group.guests.forEach((guestName, index) => {
        htmlContent += `<tr>`;
        if (index === 0) {
          htmlContent += `
            <td style="vertical-align: middle;" rowspan="${groupSize}">${group.listNumber}</td>
          `;
        }
        htmlContent += `<td>${guestName}</td>`;
        if (index === 0) {
          htmlContent += `
            <td style="vertical-align: middle;" rowspan="${groupSize}">${group.totalPrice} руб.</td>
            <td style="vertical-align: middle;" rowspan="${groupSize}"></td>
          `;
        }
        htmlContent += `</tr>`;
      });
    });

    htmlContent += `</table>
        <div class="footer">Всего заявлено гостей на экскурсию: ${totalGuests}</div>
      </body></html>`;

    const converted = window.htmlDocx.asBlob(htmlContent);
    const fileName = `Список_${eventData.title.replace(/\s+/g, '_')}.docx`;

    const file = new File([converted], fileName, { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Список гостей' });
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

window.deleteRegistration = async function(regId) {
  if (!confirm("Вы уверены, что хотите удалить эту заявку? Места будут освобождены.")) return;
  try {
    const regDoc = await getDoc(doc(db, "registrations", regId));
    if (!regDoc.exists()) return;
    const regData = regDoc.data();
    
    await deleteDoc(doc(db, "registrations", regId));
    
    if (regData.eventId && regData.guests && Array.isArray(regData.guests)) {
      try {
        await updateDoc(doc(db, "events", regData.eventId), {
          bookedSeats: increment(-regData.guests.length)
        });
      } catch (e) {}
    }
    
    alert("Заявка удалена, места освобождены.");
    loadGuests();
  } catch (error) {
    console.error("Ошибка удаления заявки:", error);
    alert("Не удалось удалить заявку.");
  }
};

window.deleteEvent = async function(eventId) {
  if (!confirm("Вы уверены, что хотите удалить эту экскурсию?")) return;
  try {
    await deleteDoc(doc(db, "events", eventId));
    alert("Экскурсия удалена.");
    loadEvents(); 
  } catch (error) {
    console.error("Ошибка удаления экскурсии:", error);
    alert("Не удалось удалить экскурсию.");
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
    await addDoc(collection(db, "events"), { 
      title, 
      date, 
      limit, 
      description: desc, 
      bookedSeats: 0,
      createdAt: new Date().toISOString() 
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
