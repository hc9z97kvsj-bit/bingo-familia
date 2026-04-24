import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBMwmIhO05GYAH-KSVua8VSvu9b-7pbVAw",
  authDomain: "bingodelafamilia-53c4f.firebaseapp.com",
  databaseURL: "https://bingodelafamilia-53c4f-default-rtdb.firebaseio.com",
  projectId: "bingodelafamilia-53c4f",
  storageBucket: "bingodelafamilia-53c4f.firebasestorage.app",
  messagingSenderId: "869177403413",
  appId: "1:869177403413:web:350616cafd1a66091cc61c",
  measurementId: "G-ZQ79RNJSS1"
};

// Inicializamos Firebase evitando duplicados en recargas de Next.js
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };