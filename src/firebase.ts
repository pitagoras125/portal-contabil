import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCsYXQ75Ra-zid1EgTr6eYXboJHoYPhtUg",
  authDomain: "portal-contabil-4c418.firebaseapp.com",
  databaseURL: "https://portal-contabil-4c418-default-rtdb.firebaseio.com",
  projectId: "portal-contabil-4c418",
  storageBucket: "portal-contabil-4c418.firebasestorage.app",
  messagingSenderId: "185887577481",
  appId: "1:185887577481:web:1ffbf956e1242b64c5bd58",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);