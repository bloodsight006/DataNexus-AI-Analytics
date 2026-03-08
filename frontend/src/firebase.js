import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Replace this entire block with YOUR keys from the Firebase website!
const firebaseConfig = {
  apiKey: "AIzaSyBwfoOLaX0M_TGnaoSsI39DfpP4mEpWty8",
  authDomain: "datanexus-d7d03.firebaseapp.com",
  projectId: "datanexus-d7d03E",
  storageBucket: "datanexus-d7d03.firebasestorage.app",
  messagingSenderId: "8553637917",
  appId: "1:8553637917:web:1304acda60d8928f507ef4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and export it
export const auth = getAuth(app);