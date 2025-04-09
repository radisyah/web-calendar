// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCcq9Rc_0BKp6RpoAbkfS7mwVvtjbOnTys",
  authDomain: "absensi-guru-mec.firebaseapp.com",
  projectId: "absensi-guru-mec",
  storageBucket: "absensi-guru-mec.firebasestorage.app",
  messagingSenderId: "770590527737",
  appId: "1:770590527737:web:855fcf73a2c28c2f5c5228",
  measurementId: "G-FSPVJDV0DK",
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
