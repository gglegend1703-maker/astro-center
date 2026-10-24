import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, addDoc, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
      
      // ВОТ НАША НОВАЯ КНОПКА:
      el.innerHTML = `
        <h3>${data.title}</h3>
        <p>📅 ${date} | 👥 Лимит: ${data.limit} чел.</p>
        <p style="margin-top: 5px; font-size: 12px; color: #cbd5e1;">${data.description || ''}</p>
        <button onclick="openBookingModal('${doc.id}', ${data.limit}, '${data.title}')">Записаться</button>
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
  // --- ЛОГИКА ЗАПИСИ НА ЭКСКУРСИЮ ---
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
    
    // Генерация порядкового номера
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

    alert(`Заявка №${listNumber} создана! Сумма к оплате: ${totalPrice} руб. Места будут забронированы после подтверждения оплаты администратором.`);
    closeModal();
    loadEvents(); // Обновить список

  } catch (error) {
    console.error("Ошибка:", error);
    alert("Ошибка при создании заявки.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Подтвердить заявку";
  }
});

