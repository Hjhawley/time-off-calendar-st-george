import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { firebaseConfig, CAMPUS_ID } from "./config.js";

console.log("Firebase Config Loaded:", firebaseConfig);

const app = initializeApp(firebaseConfig);
console.log("Firebase App Initialized:", app);

const db = getFirestore(app);
console.log("Firestore Initialized:", db);

export { db, doc, setDoc, getDoc, onSnapshot, collection, getDocs, query, where };

// Backup creation utility
export async function createBackup(data, suffix = "auto") {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupId = `backup-${timestamp}-${CAMPUS_ID}`;

    const backupRef = doc(db, "timeOff", CAMPUS_ID, "backups", backupId);
    await setDoc(backupRef, {
      timestamp: new Date(),
      type: suffix,
      campus: CAMPUS_ID,
      data: structuredClone(data),
    });

    console.log("Backup created:", backupId);
  } catch (error) {
    console.error("Failed to create backup:", error);
  }
}
