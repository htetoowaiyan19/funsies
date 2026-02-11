// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBcl8ZvNgUJ8PbCQIQMLapeuTxFBh1a0xk",
  authDomain: "funsies-828a9.firebaseapp.com",
  projectId: "funsies-828a9",
  storageBucket: "funsies-828a9.firebasestorage.app",
  messagingSenderId: "377680322558",
  appId: "1:377680322558:web:98705a3b57762dd9942aaf",
  measurementId: "G-PHSS1NWM8P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
