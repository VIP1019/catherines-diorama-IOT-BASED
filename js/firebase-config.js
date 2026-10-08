"use strict";

/* =========================================================
   FIREBASE CONFIGURATION
   ---------------------------------------------------------
   1. Go to https://console.firebase.google.com
   2. Create a project  ->  Build  ->  Realtime Database
   3. Project settings  ->  Your apps  ->  Web app (</>)
   4. Paste the values below.

   While "apiKey" is empty the web app runs in
   SIMULATION MODE (state is kept in this browser and synced
   between open tabs). Nothing is sent to the ESP32 boards.
========================================================= */

window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyCQuIal-nZj4PKoJqU1a60Rx2W-EO6hxI8",
    authDomain: "catherines-diorama.firebaseapp.com",
    databaseURL: "https://catherines-diorama-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "catherines-diorama",
    storageBucket: "catherines-diorama.firebasestorage.app",
    messagingSenderId: "944536792122",
    appId: "1:944536792122:web:8f4c73969ecb38fd645903"
};

/* Root node in the Realtime Database that both ESP32s use */
window.DIORAMA_ROOT = "diorama";
