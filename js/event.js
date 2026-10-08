"use strict";

/* =========================================================
   EVENT PLACE CONTROL
   Firebase paths used:
     event/mode         true | false
     event/hallLight    true | false
     event/stageLight   true | false
     event/music        true | false
     event/reactive     true | false
     event/soundLevel   0 - 100 (from MAX9814 sensor)
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const Shell = window.ControlShell;
    const Link = window.DioramaLink;

    Shell.init("event");

    const access = Shell.accessFor("event");
    if (!access.allowed) {
        Shell.renderLocked(document.getElementById("pageContent"), access);
        return;
    }

    const $ = id => document.getElementById(id);

    const el = {
        stage: $("eventStage"),
        chip: $("eventChip"),
        mode: $("modeSwitch"),
        hallLight: $("hallLightSwitch"),
        stageLight: $("stageLightSwitch"),
        music: $("musicSwitch"),
        reactive: $("reactiveSwitch"),
        visualizer: $("visualizer")
    };

    // Initialize visualizer bars
    const BAR_COUNT = 20;
    el.visualizer.innerHTML = Array.from({ length: BAR_COUNT }).map(() => '<div class="vis-bar"></div>').join("");
    const bars = el.visualizer.querySelectorAll(".vis-bar");

    let eventState = Link.get("event") || {};

    /* -----------------------------------------------------
       TOGGLES
    ----------------------------------------------------- */

    el.mode.addEventListener("click", () => {
        const on = !eventState.mode;
        Link.set("event/mode", on);
        Link.log(`Event Mode ${on ? "ON" : "OFF"}`);
        if (on) {
            Shell.toast("Event Mode activated. Pool lights will now react to music.");
            // When turning on Event Mode, automatically set reference to current guest to claim it
            if (access.reservation && access.reservation.reference) {
                Link.set("event/reference", access.reservation.reference);
            }
        } else {
            Shell.toast("Event Mode deactivated. Pool restored to normal.");
        }
    });

    el.hallLight.addEventListener("click", () => {
        const on = !eventState.hallLight;
        Link.set("event/hallLight", on);
        Link.log(`Event Hall Light ${on ? "ON" : "OFF"}`);
    });

    el.stageLight.addEventListener("click", () => {
        const on = !eventState.stageLight;
        Link.set("event/stageLight", on);
        Link.log(`Event Stage Light ${on ? "ON" : "OFF"}`);
    });

    el.music.addEventListener("click", () => {
        const on = !eventState.music;
        Link.set("event/music", on);
        Link.log(`Event Music ${on ? "PLAYING" : "STOPPED"}`);
    });

    el.reactive.addEventListener("click", () => {
        const on = !eventState.reactive;
        Link.set("event/reactive", on);
        Link.log(`Event Reactivity ${on ? "ON" : "OFF"}`);
    });

    /* -----------------------------------------------------
       RENDER
    ----------------------------------------------------- */

    function render() {
        const mode = Boolean(eventState.mode);
        const stageOn = Boolean(eventState.stageLight);
        const reactive = Boolean(eventState.reactive);
        const hallOn = Boolean(eventState.hallLight);
        
        el.mode.classList.toggle("on", mode);
        el.hallLight.classList.toggle("on", hallOn);
        el.stageLight.classList.toggle("on", stageOn);
        el.music.classList.toggle("on", Boolean(eventState.music));
        el.reactive.classList.toggle("on", reactive);

        el.chip.className = `cs-chip ${mode ? "on" : "off"}`;
        el.chip.textContent = mode ? "Active" : "Inactive";

        el.stage.classList.toggle("active", mode);
        el.stage.classList.toggle("lights-on", stageOn);
        el.stage.classList.toggle("reactive", stageOn && reactive && mode);
        
        if (hallOn) {
            el.stage.style.background = "#4a3c5a";
        } else {
            el.stage.style.background = "#2a2238";
        }

        // Visualize sound level
        const level = eventState.soundLevel || 0;
        bars.forEach((bar, i) => {
            // Fake spectrum effect based on single level
            const offset = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
            const height = Math.max(5, level - (offset * 50));
            bar.style.height = `${Math.min(100, Math.max(5, height))}%`;
            
            // Color based on reactivity state
            if (mode && reactive) {
                const hue = (level * 2 + i * 10) % 360;
                bar.style.backgroundColor = `hsl(${hue}, 80%, 60%)`;
            } else {
                bar.style.backgroundColor = 'var(--gold)';
            }
        });
    }

    Link.on("event", value => { 
        eventState = value || {}; 
        render(); 
    });

});
