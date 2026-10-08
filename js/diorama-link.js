"use strict";

/* =========================================================
   CATHERINE'S DIORAMA LINK
   ---------------------------------------------------------
   One shared state tree used by the web app and both ESP32s.

   - FIREBASE MODE   : window.FIREBASE_CONFIG.apiKey is set.
                       Reads/writes  /<DIORAMA_ROOT>/...  in the
                       Firebase Realtime Database.
   - SIMULATION MODE : no Firebase config. State lives in
                       localStorage and syncs across tabs, with
                       simple simulated sensor responses so the
                       pages can be tested without hardware.

   API (window.DioramaLink):
     ready                   Promise resolved when connected
     mode                    "firebase" | "simulation"
     get(path)               current cached value
     set(path, value)        write a value
     update(path, object)    merge several keys
     on(path, callback)      subscribe -> returns unsubscribe()
     log(message, source)    append to the activity log
     getLogs(limit)          newest-first array of log entries
     isDeviceOnline(id)      "esp1" | "esp2" heartbeat check
========================================================= */

(function (window) {

    /* -----------------------------------------------------
       DEFAULT STATE  (keep in sync with ESP32 firmware)
    ----------------------------------------------------- */

    const DEFAULT_STATE = {
        system: { mode: "normal", power: true },

        status: {
            esp1: { heartbeat: 0, ip: "", rssi: 0 },
            esp2: { heartbeat: 0, ip: "", rssi: 0 }
        },

        gate: { target: "closed", state: "closed", auto: true, irBlocked: false },

        car: { command: "stop", state: "stopped", speed: 70 },

        nfc: { lastUid: "", lastScan: 0, result: "idle" },

        guest: { reference: "", name: "", cottage: 0, checkedIn: false, checkinAt: 0 },

        cottages: {
            c1: { light: false, occupied: false, reference: "" },
            c2: { light: false, occupied: false, reference: "" },
            c3: { light: false, occupied: false, reference: "" },
            c4: { light: false, occupied: false, reference: "" }
        },

        pool: {
            light: false,
            color: "#2ec4d6",
            effect: "solid",
            brightness: 80,
            bridge: false,
            pump: false
        },

        event: {
            mode: false,
            hallLight: false,
            stageLight: false,
            music: false,
            reactive: true,
            soundLevel: 0,
            reference: ""
        },

        ktv: {
            target: "closed",
            hallOpen: false,
            song: 0,
            playback: "stopped",
            position: 0,
            startedAt: 0,
            volume: 18,
            lightMode: "party",
            light: { r: true, g: false, b: true }
        },

        beacon: { on: true, rpm: 6 },

        logs: {}
    };

    const SIM_KEY = "dioramaSimState";
    const config = window.FIREBASE_CONFIG || {};
    const ROOT = window.DIORAMA_ROOT || "diorama";

    let cache = clone(DEFAULT_STATE);
    let dbRef = null;
    const listeners = new Set();
    const heartbeatSeen = { esp1: { value: null, at: 0 }, esp2: { value: null, at: 0 } };

    const Link = {
        mode: config.apiKey ? "firebase" : "simulation",
        ready: null,
        get,
        set,
        update,
        on,
        log,
        getLogs,
        isDeviceOnline,
        DEFAULT_STATE
    };

    /* -----------------------------------------------------
       HELPERS
    ----------------------------------------------------- */

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function split(path) {
        return String(path || "").split("/").filter(Boolean);
    }

    function readPath(tree, path) {
        return split(path).reduce(
            (node, key) => (node && typeof node === "object" ? node[key] : undefined),
            tree
        );
    }

    function writePath(tree, path, value) {
        const keys = split(path);
        if (keys.length === 0) return value;
        let node = tree;
        keys.slice(0, -1).forEach(key => {
            if (!node[key] || typeof node[key] !== "object") node[key] = {};
            node = node[key];
        });
        if (value === null || value === undefined) {
            delete node[keys[keys.length - 1]];
        } else {
            node[keys[keys.length - 1]] = value;
        }
        return tree;
    }

    function deepMerge(base, extra) {
        if (!extra || typeof extra !== "object") return base;
        Object.keys(extra).forEach(key => {
            const v = extra[key];
            if (v && typeof v === "object" && !Array.isArray(v) &&
                base[key] && typeof base[key] === "object") {
                deepMerge(base[key], v);
            } else {
                base[key] = v;
            }
        });
        return base;
    }

    function notify() {
        trackHeartbeats();
        listeners.forEach(entry => {
            const value = readPath(cache, entry.path);
            const serialized = JSON.stringify(value);
            if (serialized !== entry.last) {
                entry.last = serialized;
                try {
                    entry.callback(value === undefined ? null : clone(value));
                } catch (err) {
                    console.error("[DioramaLink] listener error", err);
                }
            }
        });
    }

    function trackHeartbeats() {
        ["esp1", "esp2"].forEach(id => {
            const hb = readPath(cache, `status/${id}/heartbeat`);
            if (hb !== heartbeatSeen[id].value) {
                if (heartbeatSeen[id].value !== null) heartbeatSeen[id].at = Date.now();
                heartbeatSeen[id].value = hb;
            }
        });
    }

    /* -----------------------------------------------------
       PUBLIC API
    ----------------------------------------------------- */

    function get(path) {
        const value = readPath(cache, path);
        return value === undefined ? null : clone(value);
    }

    function set(path, value) {
        writePath(cache, path, value === undefined ? null : clone(value));
        notify();

        if (Link.mode === "firebase" && dbRef) {
            return dbRef.child(path).set(value === undefined ? null : value);
        }

        saveSim();
        simulateHardware(path, value);
        return Promise.resolve();
    }

    function update(path, values) {
        Object.keys(values || {}).forEach(key => {
            writePath(cache, `${path}/${key}`, clone(values[key]));
        });
        notify();

        if (Link.mode === "firebase" && dbRef) {
            return dbRef.child(path).update(values);
        }

        saveSim();
        Object.keys(values || {}).forEach(key => simulateHardware(`${path}/${key}`, values[key]));
        return Promise.resolve();
    }

    function on(path, callback) {
        const entry = { path, callback, last: undefined };
        listeners.add(entry);
        const value = readPath(cache, path);
        entry.last = JSON.stringify(value);
        try {
            callback(value === undefined ? null : clone(value));
        } catch (err) {
            console.error("[DioramaLink] listener error", err);
        }
        return () => listeners.delete(entry);
    }

    function log(message, source = "WEB") {
        const id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const entry = { t: Date.now(), msg: String(message), src: source };

        if (Link.mode === "firebase" && dbRef) {
            dbRef.child(`logs/${id}`).set(entry);
            trimLogs();
        } else {
            writePath(cache, `logs/${id}`, entry);
            const keys = Object.keys(cache.logs || {}).sort();
            while (keys.length > 40) delete cache.logs[keys.shift()];
            saveSim();
            notify();
        }
    }

    function trimLogs() {
        const keys = Object.keys(cache.logs || {}).sort();
        if (keys.length <= 40) return;
        const removals = {};
        keys.slice(0, keys.length - 40).forEach(k => { removals[k] = null; });
        dbRef.child("logs").update(removals);
    }

    function getLogs(limit = 20) {
        return Object.values(cache.logs || {})
            .filter(Boolean)
            .sort((a, b) => b.t - a.t)
            .slice(0, limit);
    }

    function isDeviceOnline(id) {
        if (Link.mode === "simulation") return true;
        const seen = heartbeatSeen[id];
        return Boolean(seen && seen.at && Date.now() - seen.at < 15000);
    }

    /* -----------------------------------------------------
       SIMULATION MODE
    ----------------------------------------------------- */

    function loadSim() {
        try {
            const raw = window.localStorage.getItem(SIM_KEY);
            if (raw) cache = deepMerge(clone(DEFAULT_STATE), JSON.parse(raw));
        } catch (err) {
            console.warn("[DioramaLink] could not read simulation state", err);
        }
    }

    function saveSim() {
        if (Link.mode !== "simulation") return;
        try {
            window.localStorage.setItem(SIM_KEY, JSON.stringify(cache));
        } catch (err) {
            console.warn("[DioramaLink] could not save simulation state", err);
        }
    }

    const simTimers = {};

    function later(key, ms, fn) {
        clearTimeout(simTimers[key]);
        simTimers[key] = setTimeout(fn, ms);
    }

    function simWrite(path, value) {
        writePath(cache, path, value);
        saveSim();
        notify();
    }

    /* Fake sensor feedback so the UI can be exercised */
    function simulateHardware(path, value) {
        if (Link.mode !== "simulation") return;

        if (path === "ktv/target") {
            later("ktv", value === "open" ? 1400 : 300, () => {
                simWrite("ktv/hallOpen", value === "open");
                log(`Hall sensor: KTV panel ${value === "open" ? "fully open" : "closed"}`, "ESP1-SIM");
            });
        }

        if (path === "gate/target") {
            later("gate", 900, () => {
                simWrite("gate/state", value);
                log(`Gate servos ${value}`, "ESP1-SIM");
            });
        }

        if (path === "car/command") {
            later("car", 150, () => {
                simWrite("car/state", value === "stop" ? "stopped" : value);
            });
        }
    }

    function startSimulationLoop() {
        let beat = 0;
        setInterval(() => {
            beat++;
            writePath(cache, "status/esp1/heartbeat", beat);
            writePath(cache, "status/esp2/heartbeat", beat);
            writePath(cache, "status/esp1/rssi", -52 - Math.floor(Math.random() * 6));
            writePath(cache, "status/esp2/rssi", -58 - Math.floor(Math.random() * 6));

            if (cache.event && cache.event.mode && cache.event.music) {
                writePath(cache, "event/soundLevel", Math.floor(25 + Math.random() * 75));
            } else if (cache.event) {
                writePath(cache, "event/soundLevel", Math.floor(Math.random() * 8));
            }
            notify();
        }, 1000);

        window.addEventListener("storage", e => {
            if (e.key !== SIM_KEY || !e.newValue) return;
            try {
                cache = deepMerge(clone(DEFAULT_STATE), JSON.parse(e.newValue));
                notify();
            } catch (err) { /* ignore */ }
        });
    }

    /* -----------------------------------------------------
       FIREBASE MODE
    ----------------------------------------------------- */

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });
    }

    async function connectFirebase() {
        const base = "https://www.gstatic.com/firebasejs/10.12.2";
        await loadScript(`${base}/firebase-app-compat.js`);
        await loadScript(`${base}/firebase-database-compat.js`);

        const app = window.firebase.apps.length
            ? window.firebase.app()
            : window.firebase.initializeApp(config);

        dbRef = app.database().ref(ROOT);

        await new Promise(resolve => {
            let first = true;
            dbRef.on("value", snapshot => {
                const remote = snapshot.val();
                if (remote === null && first) {
                    // Empty database: seed defaults once
                    dbRef.set(DEFAULT_STATE);
                }
                cache = deepMerge(clone(DEFAULT_STATE), remote || {});
                notify();
                if (first) { first = false; resolve(); }
            });
        });

        // Re-evaluate device online status regularly
        setInterval(notifyStatus, 3000);
    }

    function notifyStatus() {
        window.dispatchEvent(new CustomEvent("diorama:status"));
    }

    /* -----------------------------------------------------
       BOOT
    ----------------------------------------------------- */

    Link.ready = (async () => {
        if (Link.mode === "firebase") {
            try {
                await connectFirebase();
                console.log("[DioramaLink] Connected to Firebase Realtime Database.");
                return;
            } catch (err) {
                console.error("[DioramaLink] Firebase failed, falling back to simulation.", err);
                Link.mode = "simulation";
            }
        }
        loadSim();
        startSimulationLoop();
        notify();
        console.log("[DioramaLink] Running in SIMULATION mode (no Firebase config).");
    })();

    window.DioramaLink = Link;

})(window);
