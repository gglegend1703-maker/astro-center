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
      el.innerHTML = `<div class="event-info"><h3>${data.title}</h3><p>📅 ${date} | 👥 Лимит: ${data.limit} чел.</p></div>`;
      eventsContainer.appendChild(el);
    });
  } catch (error) { console.error("Ошибка загрузки:", error); }
}

async function loadGuests() {
  const container = document.getElementById("guests-container");
  container.innerHTML = "Загрузка...";
  try {
    const querySnapshot = await getDocs(collection(db, "registrations"));
    if (querySnapshot.empty) {
      container.innerHTML = "<p style='color: #94a3b8;'>Пока нет ни одной заявки.</p>";
      return;
    }

    let html = `<table style="width: 100%; border-collapse: collapse; text-align: left; color: #cbd5e1; font-size: 14px;"><tr style="border-bottom: 2px solid #475569;"><th style="padding: 10px;">№</th><th style="padding: 10px;">Экскурсия</th><th style="padding: 10px;">ФИО (все)</th><th style="padding: 10px;">Сумма</th><th style="padding: 10px;">Статус</th><th style="padding: 10px;">Действие</th></tr>`;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let names = "—";
      if (data.guests && Array.isArray(data.guests)) {
        names = data.guests.map(g => `${g.name} ${g.isChild ? '(реб.)' : ''}`).join("<br>");
      }
      const status = data.status === "pending" ? "⏳ Ожидает" : "✅ Оплачено";
      const statusColor = data.status === "pending" ? "#fbbf24" : "#4ade80";
      let actionBtn = data.status === "pending" ? `<button onclick="confirmPayment('${docSnap.id}')" style="background: #10b981;
