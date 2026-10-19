import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


onAuthStateChanged(auth, (user) => {
  const statusEl = document.getElementById("auth-status");
  if (user) {
    statusEl.textContent = `Вы вошли как: ${user.email}`;
  } else {
    statusEl.textContent = "Вы не авторизованы";
  }
});