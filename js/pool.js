"use strict";

/* =========================================================
   POOL LIGHTING
   Firebase paths used:
     pool/light       true | false
     pool/color       "#rrggbb"
     pool/effect      "solid" | "wave" | "pulse" | "rainbow"
     pool/brightness  5 - 100
     pool/bridge      true | false
     pool/pump        true | false   (owner only)
     event/mode       read-only here
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const Shell = window.ControlShell;
    const Link = window.DioramaLink;

    Shell.init("pool");

    const access = Shell.accessFor("pool");
    if (!access.allowed) {
        Shell.renderLocked(document.getElementById("pageContent"), access);
        return;
    }

    const COLORS = [
        { name: "Lagoon", hex: "#2ec4d6" },
        { name: "Ocean", hex: "#1f6fe0" },
        { name: "Sunset", hex: "#ff7a3d" },
        { name: "Coral", hex: "#ff4f6d" },
        { name: "Orchid", hex: "#b54cff" },
        { name: "Lime", hex: "#5fe06a" },
        { name: "Gold", hex: "#ffc23d" },
        { name: "Moonlight", hex: "#f2f5ff" }
    ];

    const $ = id => document.getElementById(id);
    const el = {
        water: $("poolWater"),
        bridgeVis: $("poolBridge"),
        chip: $("poolChip"),
        poolSwitch: $("poolSwitch"),
        bridgeSwitch: $("bridgeSwitch"),
        pumpSwitch: $("pumpSwitch"),
        pumpRow: $("pumpRow"),
        brightness: $("brightnessRange"),
        brightnessValue: $("brightnessValue"),
        swatches: $("swatches"),
        custom: $("customColor"),
        effects: $("effects"),
        statColor: $("statColor"),
        statEffect: $("statEffect"),
        statBridge: $("statBridge"),
        statEvent: $("statEvent")
    };

    if (!Shell.isAdmin()) el.pumpRow.style.display = "none";

    let pool = Link.get("pool") || {};
    let eventMode = false;

    el.swatches.innerHTML = COLORS.map(c => `
        <button type="button" class="swatch" data-hex="${c.hex}" title="${c.name}" aria-label="${c.name}"
            id="swatch-${c.name.toLowerCase()}" style="background:${c.hex}"></button>
    `).join("");

    function colorName(hex) {
        const found = COLORS.find(c => c.hex.toLowerCase() === String(hex).toLowerCase());
        return found ? found.name : String(hex).toUpperCase();
    }

    function setColor(hex) {
        Link.update("pool", { color: hex, light: true });
        Link.log(`Pool color → ${colorName(hex)}`);
    }

    el.swatches.addEventListener("click", e => {
        const btn = e.target.closest("[data-hex]");
        if (btn) setColor(btn.dataset.hex);
    });

    let customTimer;
    el.custom.addEventListener("input", () => {
        clearTimeout(customTimer);
        customTimer = setTimeout(() => setColor(el.custom.value), 200);
    });

    el.poolSwitch.addEventListener("click", () => {
        const on = !pool.light;
        Link.set("pool/light", on);
        Link.log(`Pool lights ${on ? "ON" : "OFF"}`);
    });

    el.bridgeSwitch.addEventListener("click", () => {
        const on = !pool.bridge;
        Link.set("pool/bridge", on);
        Link.log(`Bridge lights ${on ? "ON" : "OFF"}`);
    });

    el.pumpSwitch.addEventListener("click", () => {
        const on = !pool.pump;
        Link.set("pool/pump", on);
        Link.log(`Pool pump ${on ? "ON" : "OFF"}`);
    });

    let brightTimer;
    el.brightness.addEventListener("input", () => {
        el.brightnessValue.textContent = `${el.brightness.value}%`;
        clearTimeout(brightTimer);
        brightTimer = setTimeout(() => Link.set("pool/brightness", Number(el.brightness.value)), 150);
    });

    el.effects.addEventListener("click", e => {
        const btn = e.target.closest("[data-effect]");
        if (!btn) return;
        Link.update("pool", { effect: btn.dataset.effect, light: true });
        Link.log(`Pool effect → ${btn.textContent.trim()}`);
    });

    function render() {
        const color = pool.color || "#2ec4d6";
        const effect = eventMode ? "pulse" : (pool.effect || "solid");
        const on = Boolean(pool.light) || eventMode;

        el.water.style.setProperty("--pool", color);
        el.water.style.opacity = on ? (0.45 + (pool.brightness ?? 80) / 180) : 1;
        el.water.className = `pool-water ${on ? "lit" : "off"} ${on && effect !== "solid" ? "fx-" + effect : ""}`;
        el.bridgeVis.classList.toggle("lit", Boolean(pool.bridge));

        el.poolSwitch.classList.toggle("on", Boolean(pool.light));
        el.bridgeSwitch.classList.toggle("on", Boolean(pool.bridge));
        el.pumpSwitch.classList.toggle("on", Boolean(pool.pump));

        if (document.activeElement !== el.brightness) {
            el.brightness.value = pool.brightness ?? 80;
            el.brightnessValue.textContent = `${el.brightness.value}%`;
        }

        el.swatches.querySelectorAll(".swatch").forEach(s => {
            s.classList.toggle("active", s.dataset.hex.toLowerCase() === color.toLowerCase());
        });
        if (document.activeElement !== el.custom) el.custom.value = color;

        el.effects.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.effect === (pool.effect || "solid")));

        el.chip.className = `cs-chip ${eventMode ? "info" : on ? "on" : "off"}`;
        el.chip.textContent = eventMode ? "Event effect" : on ? "Lights on" : "Lights off";

        el.statColor.textContent = colorName(color);
        el.statEffect.textContent = eventMode ? "Music-reactive" : (pool.effect || "solid");
        el.statBridge.textContent = pool.bridge ? "On" : "Off";
        el.statEvent.textContent = eventMode ? "Active" : "Off";
    }

    Link.on("pool", value => { pool = value || {}; render(); });
    Link.on("event/mode", value => { eventMode = Boolean(value); render(); });
});
