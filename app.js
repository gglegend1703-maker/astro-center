import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, addDoc, getCountFromServer, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ЭЛЕМЕНТЫ СТРАНИЦЫ ---
const userBlock = document.getElementById("user-block");
const loginHeaderBtn = document.getElementById("login-header-btn");
const userHeaderBlock = document.getElementById("user-header-block");
const userEmailDisplay = document.getElementById("user-email-display");
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submit-btn");
const authError = document.getElementById("auth-error");
const logoutBtn = document.getElementById("logout-btn");
const eventsList = document.getElementById("events-list");

let isLoginMode = true;

// --- УПРАВЛЕНИЕ МОДАЛЬНЫМ ОКНОМ ВХОДА ---
window.openAuthModal = function() { document.getElementById("auth-modal").classList.remove("hidden"); };
window.closeAuthModal = function() { document.getElementById("auth-modal").classList.add("hidden"); };

// --- ВКЛАДКИ ВХОД/РЕГИСТРАЦИЯ ---
window.switchTab = function(mode) {
  isLoginMode = (mode === 'login');
  document.getElementById("tab-login").classList.toggle("active", isLoginMode);
  document.getElementById("tab-register").classList.toggle("active", !isLoginMode);
  document.getElementById("fullname-group").classList.toggle("hidden", isLoginMode);
  submitBtn.textContent = isLoginMode ? "Войти" : "Зарегистрироваться";
  authError.textContent = "";
  authForm.reset();
};

// --- ОБРАБОТКА ВХОДА / РЕГИСТРАЦИИ ---
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value;
  const password = passwordInput.value;
  const fullname = document.getElementById("fullname").value;
  authError.textContent = "";
  submitBtn.disabled = true;

  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      if (!fullname.trim()) throw { message: "Введите ФИО" };
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), { fullname: fullname, email: email });
    }
    closeAuthModal(); 
  } catch (error) {
    let message = "Произошла ошибка.";
    if (error.message === "Введите ФИО") message = "Пожалуйста, введите ФИО.";
    else if (error.code === 'auth/email-already-in-use') message = "Этот email уже зарегистрирован.";
    else if (error.code === 'auth/invalid-email') message = "Неверный формат email.";
    else if (error.code === 'auth/weak-password') message = "Пароль слишком короткий (мин. 6 символов).";
    else if (error.code === 'auth/invalid-credential') message = "Неверный email или пароль.";
    authError.textContent = message;
  } finally {
    submitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

// --- ЗАГРУЗКА ЭКСКУРСИЙ ---
async function loadEvents() {
  eventsList.innerHTML = "<p style='text-align: center; color: #94a3b8;'>Загрузка...</p>";
  try {
    const querySnapshot = await getDocs(collection(db, "events"));
    if (querySnapshot.empty) {
      eventsList.innerHTML = "<p style='text-align: center; color: #94a3b8;'>Пока нет доступных экскурсий.</p>";
      return;
    }
    eventsList.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const date = new Date(data.date).toLocaleString("ru-RU");
      const el = document.createElement("div");
      el.className = "card event-card";
      el.innerHTML = `
        <h3>${data.title}</h3>
        <p>📅 ${date} | 👥 Лимит: ${data.limit} чел.</p>
        <p style="margin-top: 5px; font-size: 12px; color: #cbd5e1;">${data.description || ''}</p>
        <button style="width: auto; padding: 8px 15px; font-size: 14px; margin-top: 10px; float: right;" onclick="openBookingModal('${docSnap.id}', ${data.limit}, '${data.title}')">Записаться</button>
        <div style="clear: both;"></div>
      `;
      eventsList.appendChild(el);
    });
  } catch (error) {
    console.error("Ошибка загрузки экскурсий:", error);
  }
}

// --- ЗАГРУЗКА НОВОСТЕЙ ---
async function loadNews() {
  const newsList = document.getElementById("news-list");
  if (!newsList) return;
  try {
    const querySnapshot = await getDocs(collection(db, "news"));
    newsList.innerHTML = "";
    if (querySnapshot.empty) {
      newsList.innerHTML = "<p style='text-align: center; color: #94a3b8;'>Пока нет новостей.</p>";
      return;
    }
    const newsArray = [];
    querySnapshot.forEach(doc => newsArray.push(doc.data()));
    newsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    newsArray.forEach(data => {
      const el = document.createElement("div");
      el.className = "card news-card";
      let imgHtml = data.imageUrl ? `<img src="${data.imageUrl}" alt="Фото">` : "";
      el.innerHTML = `${imgHtml}<h3>${data.title}</h3><p>${data.content}</p>`;
      newsList.appendChild(el);
    });
  } catch (error) {
    console.error("Ошибка загрузки новостей:", error);
  }
}

// --- ЗАГРУЗКА МОИХ ЗАЯВОК ---
async function loadMyRegistrations() {
  const container = document.getElementById("my-registrations-list");
  const user = auth.currentUser;
  if (!user || !container) return;

  try {
    const q = query(collection(db, "registrations"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>Вы пока никуда не записаны.</p>";
      return;
    }
    container.innerHTML = "";

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let statusText = data.status === "pending" ? "⏳ Ожидает оплаты" : "✅ Оплачено (место забронировано)";
      let statusColor = data.status === "pending" ? "#fbbf24" : "#4ade80";
      
      let guestsHtml = "";
      if (data.guests && Array.isArray(data.guests)) {
        guestsHtml = data.guests.map(g => `• ${g.name} ${g.isChild ? '(реб.)' : ''}`).join("<br>");
      }

      const el = document.createElement("div");
      el.className = "card";
      el.style.borderLeft = `4px solid ${statusColor}`;
      el.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #a78bfa; font-size: 18px;">${data.eventTitle}</h3>
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #cbd5e1;">Заявка № <b>${data.listNumber}</b></p>
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #cbd5e1;">Сумма: <b>${data.totalPrice} руб.</b></p>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: ${statusColor}; font-weight: bold;">Статус: ${statusText}</p>
        <div style="font-size: 13px; color: #94a3b8; background: #0f172a; padding: 10px; border-radius: 6px;"><b>Гости:</b><br>${guestsHtml || '—'}</div>
      `;
      container.appendChild(el);
    });
  } catch (error) {
    console.error("Ошибка загрузки моих заявок:", error);
  }
}

// --- АВТОРИЗАЦИЯ ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginHeaderBtn.classList.add("hidden");
    userHeaderBlock.classList.remove("hidden");
    userEmailDisplay.textContent = user.email;
    userBlock.classList.remove("hidden");

    // Приветствие
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const fullname = userDoc.data().fullname || user.email;
        const firstName = fullname.trim().split(" ")[1] || fullname; 
        document.getElementById("welcome-text").textContent = `Добро пожаловать, ${firstName}!`;
      }
    } catch (e) { console.log(e); }

    loadEvents();
    loadMyRegistrations();

    try {
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      const adminBtn = document.getElementById("admin-panel-btn");
      if (adminDoc.exists()) {
        adminBtn.classList.remove("hidden");
        adminBtn.onclick = () => { window.location.href = "admin.html"; };
      } else {
        adminBtn.classList.add("hidden");
      }
    } catch (error) { console.error(error); }
  } else {
    loginHeaderBtn.classList.remove("hidden");
    userHeaderBlock.classList.add("hidden");
    userBlock.classList.add("hidden");
    authForm.reset();
  }
});

// --- МОДАЛЬНОЕ ОКНО ЗАПИСИ ---
let currentEventId = null;
let adultCount = 1;
let childCount = 0;

window.openBookingModal = function(eventId, limit, title) {
  currentEventId = eventId;
  adultCount = 1;
  childCount = 0;
  
  document.getElementById("modal-title").textContent = `Запись: ${title}`;
  document.getElementById("adults-container").innerHTML = `<div class="form-group"><input type="text" class="adult-name" placeholder="ФИО взрослого" required></div>`;
  document.getElementById("children-container").innerHTML = "";
  document.getElementById("booking-form").reset();
  document.getElementById("booking-modal").classList.remove("hidden");
  updateTotal();

  const user = auth.currentUser;
  if (user) {
    getDoc(doc(db, "users", user.uid)).then(docSnap => {
      if (docSnap.exists()) {
        document.querySelector(".adult-name").value = docSnap.data().fullname || "";
        updateTotal();
      }
    });
  }
};

window.closeModal = function() { document.getElementById("booking-modal").classList.add("hidden"); };

// Динамическое добавление взрослых
document.getElementById("adults-container").addEventListener("input", (e) => {
  if (e.target.classList.contains("adult-name") && e.target.value.trim() !== "") {
    const inputs = document.querySelectorAll(".adult-name");
    if (inputs[inputs.length - 1] === e.target) {
      const div = document.createElement("div");
      div.className = "form-group";
      div.innerHTML = `<input type="text" class="adult-name" placeholder="ФИО взрослого">`;
      document.getElementById("adults-container").appendChild(div);
      updateTotal();
    }
  }
});

// Добавление детей
document.getElementById("add-child-btn").addEventListener("click", () => {
  childCount++;
  const div = document.createElement("div");
  div.className = "form-group";
  div.innerHTML = `<input type="text" class="child-name" placeholder="ФИО ребенка" required>`;
  document.getElementById("children-container").appendChild(div);
  updateTotal();
});

function updateTotal() {
  const adults = Array.from(document.querySelectorAll(".adult-name")).filter(i => i.value.trim() !== "").length;
  const children = Array.from(document.querySelectorAll(".child-name")).filter(i => i.value.trim() !== "").length;
  const total = (adults * 12) + (children * 6);
  document.getElementById("total-price").textContent = total;
  document.getElementById("confirm-price-text").textContent = total;
}

document.getElementById("booking-form").addEventListener("input", updateTotal);

// Отправка формы записи
document.getElementById("booking-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Создание...";

  try {
    const guests = [];
    document.querySelectorAll(".adult-name").forEach(input => {
      if (input.value.trim()) guests.push({ name: input.value, isChild: false });
    });
    document.querySelectorAll(".child-name").forEach(input => {
      if (input.value.trim()) guests.push({ name: input.value, isChild: true });
    });

    const totalPrice = parseInt(document.getElementById("total-price").textContent);
    const countSnapshot = await getCountFromServer(collection(db, "registrations"));
    const listNumber = countSnapshot.data().count + 1;

    await addDoc(collection(db, "registrations"), {
      eventId: currentEventId,
      eventTitle: document.getElementById("modal-title").textContent.replace("Запись: ", ""),
      userId: user.uid,
      userEmail: user.email,
      guests: guests,
      totalPrice: totalPrice,
      listNumber: listNumber,
      status: "pending",
      createdAt: new Date().toISOString()
    });

    document.getElementById("pay-list-number").textContent = listNumber;
    document.getElementById("pay-total-price").textContent = totalPrice;
    
    closeModal();
    document.getElementById("payment-modal").classList.remove("hidden");
    loadEvents(); 
    loadMyRegistrations();
  } catch (error) {
    console.error("Ошибка:", error);
    alert("Ошибка при создании заявки.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Поехали!";
  }
});

window.closePaymentModal = function() { document.getElementById("payment-modal").classList.add("hidden"); };

loadNews();
