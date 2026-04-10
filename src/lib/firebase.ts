import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA4-iS3vypusgnCmXvgYFwaKY_yLpEqSLs",
  authDomain: "abcf-pt.firebaseapp.com",
  projectId: "abcf-pt",
  storageBucket: "abcf-pt.firebasestorage.app",
  messagingSenderId: "961903175644",
  appId: "1:961903175644:web:9f182bc750a406a7ec9119",
  measurementId: "G-28M124NE6S",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
