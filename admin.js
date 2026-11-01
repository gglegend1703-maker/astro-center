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
    const usersSnapshot = await getDocs(collection(db, "users"));
    const usersMap = {};
    usersSnapshot.forEach(doc =>
