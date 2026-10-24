import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc,setDoc, getDoc, collection, getDocs, addDoc, query, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const authBlock = document.getElementById("auth-block");
const userBlock = document.getElementById("user-block");
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submit-btn");
const authError = document.getElementById("auth-error");
const userEmail = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const eventsList = document.getElementById("events-list");

let isLoginMode = true;

window.switchTab = function(mode) {
  isLoginMode = (mode === 'login');
  document.getElementById("tab-login").classList.toggle("active", isLoginMode);
  document.getElementById("tab-register").classList.toggle("active", !isLoginMode);
  
  // Скрываем/показываем ФИО
  document.getElementById("fullname-group").classList.toggle("hidden", isLoginMode);
  submitBtn.textContent = isLoginMode ? "Войти" : "Зарегистрироваться";
  authError.textContent = "";
  authForm.reset();
};
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value;
  const password = passwordInput.value;
  const fullname = document.getElementById("fullname").value; // Берем ФИО
  
  authError.textContent = "";
  submitBtn.disabled = true;

  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      // РЕГИСТРАЦИЯ
      if (!fullname.trim()) throw { message: "Введите ФИО" }; // Проверка
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Сохраняем ФИО в базу
      await setDoc(doc(db, "users", userCredential.user.uid), {
        fullname: fullname,
        email: email
      });
    }
  } catch (error) {
    // ... обработка ошибок ...
    if (error.message === "Введите ФИО") authError.textContent = "Пожалуйста, введите ФИО.";
    else if (error.code === 'auth/email-already-in-use') authError.textContent = "Этот email уже зарегистрирован.";
    // и т.д.
  } finally {
    submitBtn.disabled = false;
  }
});
logoutBtn.addEventListener("click", () => signOut(auth));

// Загрузка экскурсий
async function loadEvents() {
  eventsList.innerHTML = "<p style='text-align: center; color: #94a3b8;'>Загрузка...</p>";
  try {
    const querySnapshot = await getDocs(collection(db, "events"));
    if (querySnapshot.empty) {
      eventsList.innerHTML = "<p style='text-align: center; color: #94a3b8;'>Пока нет доступных экскурсий.</p>";
      return;
    }
    eventsList.innerHTML = "";
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const date = new Date(data.date).toLocaleString("ru-RU");
      
      const el = document.createElement("div");
      el.className = "event-card";
      el.innerHTML = `
        <h3>${data.title}</h3>
        <p>📅 ${date} | 👥 Лимит: ${data.limit} чел.</p>
        <p style="margin-top: 5px; font-size: 12px; color: #cbd5e1;">${data.description || ''}</p>
        <button id="btn-${doc.id}" onclick="registerForEvent('${doc.id}', ${data.limit})">Записаться</button>
        <div style="clear: both;"></div>
      `;
      eventsList.appendChild(el);
    });
  } catch (error) {
    console.error("Ошибка загрузки экскурсий:", error);
    eventsList.innerHTML = "<p style='color: #f87171; text-align: center;'>Ошибка загрузки.</p>";
  }
}
// Функция записи на экскурсию (глобальная)
window.registerForEvent = async function(eventId, limit) {
  const user = auth.currentUser;
  if (!user) {
    alert("Вы должны войти в систему!");
    return;
  }

  try {
    // 1. Считаем, сколько людей уже записано на эту экскурсию
    const regQuery = query(collection(db, "registrations"), where("eventId", "==", eventId));
    const snapshot = await getCountFromServer(regQuery);
    const currentCount = snapshot.data().count;

    // 2. Проверяем лимит
    if (currentCount >= limit) {
      alert("К сожалению, на эту экскурсию больше нет мест (лимит исчерпан).");
      return;
    }

    // 3. Проверяем, не записан ли уже этот пользователь
    const userQuery = query(collection(db, "registrations"), where("eventId", "==", eventId), where("userId", "==", user.uid));
    const userSnapshot = await getDocs(userQuery);
    if (!userSnapshot.empty) {
      alert("Вы уже записаны на эту экскурсию!");
      return;
    }

    // 4. Создаем заявку
    await addDoc(collection(db, "registrations"), {
      eventId: eventId,
      userId: user.uid,
      userEmail: user.email,
      createdAt: new Date().toISOString()
    });

    alert("Вы успешно записались на экскурсию!");
    
    // Меняем кнопку, чтобы нельзя было нажать дважды
    const btn = document.getElementById(`btn-${eventId}`);
    if (btn) {
      btn.textContent = "Вы записаны";
      btn.disabled = true;
      btn.style.background = "#4ade80";
    }

  } catch (error) {
    console.error("Ошибка записи:", error);
    alert("Произошла ошибка при записи. Попробуйте позже.");
  }
};
// Следим за состоянием авторизации
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authBlock.classList.add("hidden");
    userBlock.classList.remove("hidden");
    userEmail.textContent = user.email;

    // Запускаем загрузку экскурсий
    loadEvents();

    // Проверка на админа
    try {
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      const adminBtn = document.getElementById("admin-panel-btn");
      if (adminDoc.exists()) {
        adminBtn.classList.remove("hidden");
        adminBtn.onclick = () => { window.location.href = "admin.html"; };
      } else {
        adminBtn.classList.add("hidden");
      }
    } catch (error) {
      console.error("Ошибка при проверке прав:", error);
    }
  } else {
    authBlock.classList.remove("hidden");
    userBlock.classList.add("hidden");
    authForm.reset();
  }
});
