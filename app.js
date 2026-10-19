import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Получаем элементы со страницы
const authBlock = document.getElementById("auth-block");
const userBlock = document.getElementById("user-block");
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submit-btn");
const authError = document.getElementById("auth-error");
const userEmail = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

// Переменная для хранения текущего режима: 'login' или 'register'
let isLoginMode = true;

// Переключение вкладок (Вход / Регистрация)
window.switchTab = function(mode) {
  isLoginMode = (mode === 'login');
  
  document.getElementById("tab-login").classList.toggle("active", isLoginMode);
  document.getElementById("tab-register").classList.toggle("active", !isLoginMode);
  
  submitBtn.textContent = isLoginMode ? "Войти" : "Зарегистрироваться";
  authError.textContent = ""; // Очищаем ошибки при переключении
  authForm.reset();
};

// Обработка отправки формы
authForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // Не перезагружать страницу
  
  const email = emailInput.value;
  const password = passwordInput.value;
  authError.textContent = ""; // Очищаем старые ошибки
  submitBtn.disabled = true; // Блокируем кнопку на время запроса

  try {
    if (isLoginMode) {
      // Вход
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      // Регистрация
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    // Обработка ошибок Firebase
    let message = "Произошла ошибка.";
    if (error.code === 'auth/email-already-in-use') message = "Этот email уже зарегистрирован.";
    if (error.code === 'auth/invalid-email') message = "Неверный формат email.";
    if (error.code === 'auth/weak-password') message = "Пароль слишком короткий (минимум 6 символов).";
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      message = "Неверный email или пароль.";
    }
    authError.textContent = message;
  } finally {
    submitBtn.disabled = false; // Разблокируем кнопку обратно
  }
});

// Выход из аккаунта
logoutBtn.addEventListener("click", () => {
  signOut(auth);
});

// Следим за состоянием авторизации
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Пользователь вошел
    authBlock.classList.add("hidden");
    userBlock.classList.remove("hidden");
    userEmail.textContent = user.email;

    // ПРОВЕРКА НА АДМИНА
    try {
      // Ищем документ в коллекции admins с ID, равным UID пользователя
      const adminDocRef = doc(db, "admins", user.uid);
      const adminDoc = await getDoc(adminDocRef);

      const adminBtn = document.getElementById("admin-panel-btn");
      
      if (adminDoc.exists()) {
        // Если документ найден, значит это админ
        adminBtn.classList.remove("hidden");
        adminBtn.onclick = () => alert("Скоро здесь будет админ-панель!");
      } else {
        // Если нет — скрываем кнопку (на всякий случай)
        adminBtn.classList.add("hidden");
      }
    } catch (error) {
      console.error("Ошибка при проверке прав:", error);
    }

  } else {
    // Пользователь вышел
    authBlock.classList.remove("hidden");
    userBlock.classList.add("hidden");
    authForm.reset();
    document.getElementById("admin-panel-btn").classList.add("hidden");
  }
        if (adminDoc.exists()) {
        // Если документ найден, значит это админ
        adminBtn.classList.remove("hidden");
        // МЕНЯЕМ alert НА ПЕРЕХОД НА СТРАНИЦУ:
        adminBtn.onclick = () => {
          window.location.href = "admin.html";
        };
      } else {
});
