"use strict";

/* =========================================================
   LIGHTHOUSE KTV
   Firebase paths used:
     ktv/target      "open" | "closed"   (web -> ESP 1 servo)
     ktv/hallOpen    true | false         (ESP 1 KY-003 -> web)
     ktv/song        index in KTV_SONGS
     ktv/playback    "playing" | "paused" | "stopped"
     ktv/startedAt   ms timestamp when current play began
     ktv/position    seconds elapsed when paused
     ktv/volume      0 - 30  (DFPlayer range)
     ktv/lightMode   "static" | "party" | "pulse" | "off"
     ktv/light       { r, g, b }
     beacon/on, beacon/rpm
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const Shell = window.ControlShell;
    const Link = window.DioramaLink;
    const SONGS = window.KTV_SONGS || [];

    Shell.init("ktv");

    const access = Shell.accessFor("ktv");
    if (!access.allowed) {
        Shell.renderLocked(document.getElementById("pageContent"), access);
        return;
    }

    const $ = id => document.getElementById(id);

    const el = {
        lighthouse: $("lighthouse"),
        beam: $("lhBeam"),
        room: $("lhRoom"),
        panelButton: $("ktvPanelButton"),
        panelTarget: $("panelTarget"),
        hallState: $("hallState"),
        hallChip: $("hallChip"),
        beaconSwitch: $("beaconSwitch"),
        beaconLabel: $("beaconLabel"),
        beaconSpeed: $("beaconSpeed"),
        lyrics: $("lyricsScreen"),
        progress: $("lyricsProgress"),
        playChip: $("playChip"),
        play: $("playButton"),
        stop: $("stopButton"),
        prev: $("prevButton"),
        next: $("nextButton"),
        volume: $("volumeRange"),
        volumeValue: $("volumeValue"),
        hint: $("ktvHint"),
        songList: $("songList"),
        lightModes: $("lightModes"),
        lightModeChip: $("lightModeChip")
    };

    let ktv = Link.get("ktv") || {};
    let beacon = Link.get("beacon") || {};

    /* -----------------------------------------------------
       SONG LIST
    ----------------------------------------------------- */

    el.songList.innerHTML = SONGS.map((song, i) => `
        <li>
            <button type="button" data-song="${i}" id="song-${i}">
                <span class="num">${String(i + 1).padStart(2, "0")}</span>
                <span>
                    <strong>${Shell.escapeHtml(song.title)}</strong>
                    <small>${Shell.escapeHtml(song.artist)}</small>
                </span>
            </button>
        </li>
    `).join("");

    el.songList.addEventListener("click", e => {
        const btn = e.target.closest("[data-song]");
        if (!btn) return;
        loadSong(Number(btn.dataset.song), ktv.playback === "playing");
    });

    function loadSong(index, autoplay) {
        const count = SONGS.length;
        const i = ((index % count) + count) % count;
        Link.update("ktv", {
            song: i,
            position: 0,
            startedAt: autoplay ? Date.now() : 0,
            playback: autoplay ? "playing" : "stopped"
        });
        Link.log(`KTV song selected: ${SONGS[i].title}`);
    }

    /* -----------------------------------------------------
       PANEL & BEACON
    ----------------------------------------------------- */

    el.panelButton.addEventListener("click", () => {
        const opening = ktv.target !== "open";
        const changes = { target: opening ? "open" : "closed" };
        if (!opening) {
            changes.playback = "stopped";
            changes.position = 0;
        }
        Link.update("ktv", changes);
        Link.log(`KTV panel ${opening ? "opening" : "closing"}`);
        Shell.toast(opening ? "Opening the lighthouse KTV…" : "Closing the lighthouse KTV…");
    });

    el.beaconSwitch.addEventListener("click", () => {
        const on = !beacon.on;
        Link.set("beacon/on", on);
        Link.log(`Beacon ${on ? "ON" : "OFF"}`);
    });

    el.beaconSpeed.addEventListener("click", e => {
        const btn = e.target.closest("[data-rpm]");
        if (!btn) return;
        Link.set("beacon/rpm", Number(btn.dataset.rpm));
        Link.log(`Beacon speed ${btn.textContent.trim()}`);
    });

    /* -----------------------------------------------------
       TRANSPORT
    ----------------------------------------------------- */

    function elapsed() {
        if (ktv.playback === "playing" && ktv.startedAt) {
            return (Date.now() - ktv.startedAt) / 1000;
        }
        return Number(ktv.position) || 0;
    }

    el.play.addEventListener("click", () => {
        if (!ktv.hallOpen) return;
        if (ktv.playback === "playing") {
            Link.update("ktv", { playback: "paused", position: elapsed(), startedAt: 0 });
            Link.log("KTV paused");
        } else {
            const pos = ktv.playback === "paused" ? elapsed() : 0;
            Link.update("ktv", { playback: "playing", position: pos, startedAt: Date.now() - pos * 1000 });
            Link.log(`KTV playing: ${currentSong().title}`);
        }
    });

    el.stop.addEventListener("click", () => {
        Link.update("ktv", { playback: "stopped", position: 0, startedAt: 0 });
        Link.log("KTV stopped");
    });

    el.prev.addEventListener("click", () => loadSong((Number(ktv.song) || 0) - 1, ktv.playback === "playing"));
    el.next.addEventListener("click", () => loadSong((Number(ktv.song) || 0) + 1, ktv.playback === "playing"));

    let volumeTimer;
    el.volume.addEventListener("input", () => {
        el.volumeValue.textContent = el.volume.value;
        clearTimeout(volumeTimer);
        volumeTimer = setTimeout(() => Link.set("ktv/volume", Number(el.volume.value)), 150);
    });

    /* -----------------------------------------------------
       LIGHTING
    ----------------------------------------------------- */

    el.lightModes.addEventListener("click", e => {
        const btn = e.target.closest("[data-mode]");
        if (!btn) return;
        Link.set("ktv/lightMode", btn.dataset.mode);
        Link.log(`KTV lighting: ${btn.textContent.trim()}`);
    });

    document.querySelectorAll(".led").forEach(btn => {
        btn.addEventListener("click", () => {
            const key = btn.dataset.led;
            const light = Object.assign({ r: false, g: false, b: false }, ktv.light);
            light[key] = !light[key];
            Link.set("ktv/light", light);
            if (ktv.lightMode === "off") Link.set("ktv/lightMode", "static");
        });
    });

    /* -----------------------------------------------------
       RENDER
    ----------------------------------------------------- */

    function currentSong() {
        return SONGS[Number(ktv.song) || 0] || SONGS[0];
    }

    function renderLyrics() {
        const song = currentSong();
        if (!song) return;

        const open = Boolean(ktv.hallOpen);
        const state = ktv.playback || "stopped";

        if (!open) {
            el.lyrics.innerHTML = `<div class="idle">${ktv.target === "open" ? "Opening… waiting for the Hall sensor to confirm." : "Open the KTV to turn on the lyrics monitor."}</div>`;
            el.progress.style.width = "0%";
            return;
        }

        const t = elapsed();
        const duration = song.duration || (song.lines[song.lines.length - 1].t + 5);

        if (state === "playing" && t >= duration) {
            Link.update("ktv", { playback: "stopped", position: 0, startedAt: 0 });
            return;
        }

        let idx = -1;
        song.lines.forEach((line, i) => { if (line.t <= t) idx = i; });

        if (state === "stopped") {
            el.lyrics.innerHTML = `
                <div class="song-title">Ready · Track ${song.track}</div>
                <div class="line current">${Shell.escapeHtml(song.title)}</div>
                <div class="idle">${Shell.escapeHtml(song.artist)} — press play to start</div>`;
            el.progress.style.width = "0%";
            return;
        }

        const show = [idx - 1, idx, idx + 1].map(i => {
            const line = song.lines[i];
            if (!line) return `<div class="line">&nbsp;</div>`;
            return `<div class="line ${i === idx ? "current" : ""}">${Shell.escapeHtml(line.text)}</div>`;
        }).join("");

        el.lyrics.innerHTML = `<div class="song-title">${Shell.escapeHtml(song.title)}${state === "paused" ? " · Paused" : ""}</div>${show}`;
        el.progress.style.width = `${Math.min(100, (t / duration) * 100)}%`;
    }

    function render() {
        const target = ktv.target === "open" ? "open" : "closed";
        const open = Boolean(ktv.hallOpen);
        const moving = (target === "open") !== open;

        el.lighthouse.classList.toggle("open", target === "open");
        el.panelButton.innerHTML = target === "open"
            ? `<i class="fa-solid fa-door-closed"></i> Close KTV`
            : `<i class="fa-solid fa-door-open"></i> Open KTV`;
        el.panelTarget.textContent = moving ? (target === "open" ? "Opening…" : "Closing…") : (open ? "Open" : "Closed");
        el.hallState.textContent = open ? "Magnet detected" : "No magnet";
        el.hallChip.className = `cs-chip ${open ? "on" : moving ? "warn" : "off"}`;
        el.hallChip.textContent = open ? "Fully open" : moving ? "Moving" : "Closed";

        const state = ktv.playback || "stopped";
        el.playChip.className = `cs-chip ${state === "playing" ? "on" : state === "paused" ? "warn" : "off"}`;
        el.playChip.textContent = state;
        el.play.innerHTML = state === "playing" ? `<i class="fa-solid fa-pause"></i>` : `<i class="fa-solid fa-play"></i>`;

        [el.play, el.stop, el.prev, el.next].forEach(b => { b.disabled = !open; });
        el.hint.textContent = open ? "" : "Playback unlocks when the Hall sensor confirms the KTV panel is fully open.";

        if (document.activeElement !== el.volume) {
            el.volume.value = ktv.volume ?? 18;
            el.volumeValue.textContent = el.volume.value;
        }

        el.songList.querySelectorAll("[data-song]").forEach(b => {
            b.classList.toggle("active", Number(b.dataset.song) === (Number(ktv.song) || 0));
        });

        const mode = ktv.lightMode || "party";
        el.lightModes.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
        el.lightModeChip.textContent = mode;
        const light = ktv.light || {};
        document.querySelectorAll(".led").forEach(b => b.classList.toggle("on", mode !== "off" && Boolean(light[b.dataset.led])));

        const glow = mode === "off" ? "#2a2238"
            : `rgb(${light.r ? 230 : 40}, ${light.g ? 200 : 30}, ${light.b ? 255 : 60})`;
        el.room.style.setProperty("--ktv-glow", glow);

        el.lighthouse.classList.toggle("beacon-off", !beacon.on);
        el.beaconSwitch.classList.toggle("on", Boolean(beacon.on));
        el.beaconLabel.textContent = beacon.on ? `Sweeping at ${beacon.rpm || 6} RPM` : "Off";
        el.beam.style.setProperty("--sweep", `${60 / Math.max(1, beacon.rpm || 6)}s`);
        el.beaconSpeed.querySelectorAll("button").forEach(b => b.classList.toggle("active", Number(b.dataset.rpm) === Number(beacon.rpm)));

        renderLyrics();
    }

    Link.on("ktv", value => { ktv = value || {}; render(); });
    Link.on("beacon", value => { beacon = value || {}; render(); });

    setInterval(renderLyrics, 250);
});
