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

// 5. Генерация Word (в формате .docx)
window.downloadWord = async function() {
  try {
    const q = query(collection(db, "registrations"), where("status", "==", "paid"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      alert("Нет оплаченных заявок для формирования списка.");
      return;
    }

    const eventsSnapshot = await getDocs(collection(db, "events"));
    const eventsMap = {};
    eventsSnapshot.forEach(doc => {
      const data = doc.data();
      eventsMap[doc.id] = { title: data.title, date: data.date };
    });

    const guestsByEvent = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const eventId = data.eventId;
      const eventInfo = eventsMap[eventId] || { title: "Неизвестная экскурсия", date: "" };

      if (!guestsByEvent[eventId]) {
        guestsByEvent[eventId] = { title: eventInfo.title, date: eventInfo.date, guests: [] };
      }

      if (data.guests && Array.isArray(data.guests)) {
        data.guests.forEach(g => {
          guestsByEvent[eventId].guests.push({ name: g.name.toUpperCase(), isChild: g.isChild });
        });
      }
    });

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>Списки гостей</title>
        <style>
          body { font-family: 'Times New Roman', serif; }
          h2 { margin-bottom: 5px; }
          .event-header { margin-top: 30px; margin-bottom: 10px; background: #f0f0f0; padding: 10px; border-left: 4px solid #4CAF50; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #e0e0e0; }
        </style>
      </head><body><h1 style="text-align: center;">Списки гостей обсерватории</h1>`;

    for (const eventId in guestsByEvent) {
      const eventData = guestsByEvent[eventId];
      let dateStr = "Дата не указана", timeStr = "";
      if (eventData.date) {
        const d = new Date(eventData.date);
        dateStr = d.toLocaleDateString("ru-RU");
        timeStr = d.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
      }
      eventData.guests.sort((a, b) => a.name.localeCompare(b.name));
      htmlContent += `
        <div class="event-header"><h2>Экскурсия: ${eventData.title}</h2><p style="margin: 0;">Дата: ${dateStr} | Время: ${timeStr}</p></div>
        <table><tr><th style="width: 50px;">№</th><th>ФИО</th><th style="width: 150px;">Категория</th></tr>`;
      eventData.guests.forEach((guest, index) => {
        htmlContent += `<tr><td>${index + 1}</td><td>${guest.name}</td><td>${guest.isChild ? "Ребенок (до 14 лет)" : "Взрослый"}</td></tr>`;
      });
      htmlContent += `</table>`;
    }
    htmlContent += `</body></html>`;

    // Скачивание в формате .docx
    const blob = new Blob([htmlContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Списки_гостей_по_экскурсиям.docx";
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
        const IMGBB_API_KEY = "ВАШ_КЛЮЧ_IMGBB"; // Вставьте ключ
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
