import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, doc, getDoc, collection, getDocs, addDoc, getCountFromServer, setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";

// --- ИНИЦИАЛИЗАЦИЯ ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ЭЛЕМЕНТЫ СТРАНИЦЫ ---
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

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК (ВХОД / РЕГИСТРАЦИЯ) ---
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
      await setDoc(doc(db, "users", userCredential.user.uid), {
        fullname: fullname,
        email: email
      });
    }
  } catch (error) {
    let message = "Произошла ошибка.";
    if (error.message === "Введите ФИО") message = "Пожалуйста, введите ФИО.";
    else if (error.code === 'auth/email-already-in-use') message = "Этот email уже зарегистрирован.";
    else if (error.code === 'auth/invalid-email') message = "Неверный формат email.";
    else if (error.code === 'auth/weak-password') message = "Пароль слишком короткий (мин. 6 символов).";
    else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') message = "Неверный email или пароль.";
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
      el.className = "event-card";
      el.innerHTML = `
        <h3>${data.title}</h3>
        <p>📅 ${date} | 👥 Лимит: ${data.limit} чел.</p>
        <p style="margin-top: 5px; font-size: 12px; color: #cbd5e1;">${data.description || ''}</p>
        <button onclick="openBookingModal('${docSnap.id}', ${data.limit}, '${data.title}')">Записаться</button>
        <div style="clear: both;"></div>
      `;
      eventsList.appendChild(el);
    });
  } catch (error) {
    console.error("Ошибка загрузки экскурсий:", error);
    eventsList.innerHTML = "<p style='color: #f87171; text-align: center;'>Ошибка загрузки.</p>";
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
      el.className = "news-card";
      
      let imgHtml = "";
      if (data.imageUrl) {
        const safeAlt = String(data.title || "").replace(/"/g, "&quot;");
        imgHtml = `<img class="news-image" src="${data.imageUrl}" alt="${safeAlt}">`;
      }

      el.innerHTML = `
        ${imgHtml}
        <h3>${data.title}</h3>
        <p>${data.content}</p>
      `;
      newsList.appendChild(el);
    });
  } catch (error) {
    console.error("Ошибка загрузки новостей:", error);
    newsList.innerHTML = "<p style='color: #f87171; text-align: center;'>Ошибка загрузки новостей.</p>";
  }
}

// --- СЛЕЖЕНИЕ ЗА АВТОРИЗАЦИЕЙ ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authBlock.classList.add("hidden");
    userBlock.classList.remove("hidden");
    userEmail.textContent = user.email;

    loadEvents();
    loadNews(); // Запускаем загрузку новостей

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

// --- ЛОГИКА МОДАЛЬНОГО ОКНА ЗАПИСИ ---
let currentEventId = null;
let extraGuestCount = 0;

window.openBookingModal = function(eventId, limit, title) {
  currentEventId = eventId;
  extraGuestCount = 0;
  
  document.getElementById("modal-title").textContent = `Запись: ${title}`;
  document.getElementById("extra-guests-container").innerHTML = "";
  document.getElementById("booking-form").reset();
  document.getElementById("booking-modal").classList.remove("hidden");
  document.getElementById("total-price").textContent = "0";

  const user = auth.currentUser;
  if (user) {
    getDoc(doc(db, "users", user.uid)).then(docSnap => {
      if (docSnap.exists()) {
        document.getElementById("main-guest-name").value = docSnap.data().fullname || "";
      }
    });
  }
};

window.closeModal = function() {
  document.getElementById("booking-modal").classList.add("hidden");
};

document.getElementById("add-guest-btn").addEventListener("click", () => {
  extraGuestCount++;
  const container = document.getElementById("extra-guests-container");
  const div = document.createElement("div");
  div.style.cssText = "border: 1px solid #334155; padding: 10px; border-radius: 6px; margin-bottom: 10px; position: relative;";
  div.innerHTML = `
    <p style="margin: 0 0 5px 0; font-size: 14px; color: #cbd5e1;">Гость ${extraGuestCount}</p>
    <input type="text" class="guest-name" placeholder="ФИО гостя" required style="margin-bottom: 5px;">
    <input type="date" class="guest-dob" required>
    <button type="button" onclick="this.parentElement.remove(); calculateTotal();" style="position: absolute; top: 5px; right: 5px; width: auto; background: #ef4444; padding: 2px 8px; font-size: 12px;">✕</button>
  `;
  container.appendChild(div);
  div.querySelector('.guest-dob').addEventListener('change', calculateTotal);
});

function calculateTotal() {
  let total = 0;
  const mainDob = document.getElementById("main-guest-dob").value;
  if (mainDob) {
    const age = new Date().getFullYear() - new Date(mainDob).getFullYear();
    total += (age < 14) ? 6 : 12;
  }
  document.querySelectorAll('.guest-dob').forEach(input => {
    if (input.value) {
      const age = new Date().getFullYear() - new Date(input.value).getFullYear();
      total += (age < 14) ? 6 : 12;
    }
  });
  document.getElementById("total-price").textContent = total;
}

document.getElementById("main-guest-dob").addEventListener("change", calculateTotal);

document.getElementById("booking-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Создание заявки...";

  try {
    const guests = [];
    
    const mainName = document.getElementById("main-guest-name").value;
    const mainDob = document.getElementById("main-guest-dob").value;
    const mainAge = new Date().getFullYear() - new Date(mainDob).getFullYear();
    guests.push({ name: mainName, dob: mainDob, age: mainAge, isChild: mainAge < 14 });

    const guestNames = document.querySelectorAll('.guest-name');
    const guestDobs = document.querySelectorAll('.guest-dob');
    for (let i = 0; i < guestNames.length; i++) {
      const age = new Date().getFullYear() - new Date(guestDobs[i].value).getFullYear();
      guests.push({ name: guestNames[i].value, dob: guestDobs[i].value, age: age, isChild: age < 14 });
    }

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

    // ПОКАЗЫВАЕМ ОКНО С ИНСТРУКЦИЕЙ ЕРИП
    document.getElementById("pay-list-number").textContent = listNumber;
    document.getElementById("pay-total-price").textContent = totalPrice;
    document.getElementById("pay-number-instruction").textContent = listNumber;
    
    closeModal(); // Закрываем окно записи
    document.getElementById("payment-modal").classList.remove("hidden"); // Открываем окно оплаты
    loadEvents(); 

  } catch (error) {
    console.error("Ошибка:", error);
    alert("Ошибка при создании заявки.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Подтвердить заявку";
  }
});

// --- ЗАКРЫТИЕ ОКНА ОПЛАТЫ ---
window.closePaymentModal = function() {
  document.getElementById("payment-modal").classList.add("hidden");
};
