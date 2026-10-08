"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const Shell = window.ControlShell;
    const Link = window.DioramaLink;

    Shell.init("manual-override");

    if (!Shell.isAdmin()) {
        Shell.renderLocked(document.getElementById("pageContent"), { 
            allowed: false, 
            reason: "This page is restricted to Resort Administrators.", 
            action: "login" 
        });
        return;
    }

    const $ = id => document.getElementById(id);

    const el = {
        gateSwitch: $("gateSwitch"),
        gateAutoSwitch: $("gateAutoSwitch"),
        gateState: $("gateState"),
        carCommand: $("carCommand"),
        carSpeed: $("carSpeed"),
        carSpeedValue: $("carSpeedValue"),
        carState: $("carState"),
        powerSwitch: $("powerSwitch"),
        beaconSwitch: $("beaconSwitch"),
        pumpSwitch: $("pumpSwitch"),
        statMode: $("statMode"),
        statIr: $("statIr")
    };

    let state = {
        gate: Link.get("gate") || {},
        car: Link.get("car") || {},
        system: Link.get("system") || {},
        beacon: Link.get("beacon") || {},
        pool: Link.get("pool") || {}
    };

    // Events
    el.gateSwitch.addEventListener("click", () => {
        const target = state.gate.target === "open" ? "closed" : "open";
        Link.set("gate/target", target);
        Link.log(`Manual Override: Gate ${target}`);
    });

    el.gateAutoSwitch.addEventListener("click", () => {
        const auto = !state.gate.auto;
        Link.set("gate/auto", auto);
        Link.log(`Manual Override: Gate Auto ${auto ? "ON" : "OFF"}`);
    });

    el.carCommand.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const cmd = btn.dataset.cmd;
        Link.set("car/command", cmd);
        Link.log(`Manual Override: Car ${cmd}`);
    });

    let speedTimer;
    el.carSpeed.addEventListener("input", () => {
        el.carSpeedValue.textContent = el.carSpeed.value;
        clearTimeout(speedTimer);
        speedTimer = setTimeout(() => {
            Link.set("car/speed", Number(el.carSpeed.value));
            Link.log(`Manual Override: Car speed ${el.carSpeed.value}`);
        }, 200);
    });

    el.powerSwitch.addEventListener("click", () => {
        const pwr = !state.system.power;
        Link.set("system/power", pwr);
        Link.log(`Manual Override: System Power ${pwr ? "ON" : "OFF"}`);
    });

    el.beaconSwitch.addEventListener("click", () => {
        const on = !state.beacon.on;
        Link.set("beacon/on", on);
        Link.log(`Manual Override: Beacon ${on ? "ON" : "OFF"}`);
    });

    el.pumpSwitch.addEventListener("click", () => {
        const on = !state.pool.pump;
        Link.set("pool/pump", on);
        Link.log(`Manual Override: Pump ${on ? "ON" : "OFF"}`);
    });

    // Render loop
    function render() {
        // Gate
        el.gateSwitch.classList.toggle("on", state.gate.target === "open");
        el.gateAutoSwitch.classList.toggle("on", state.gate.auto !== false); // default true
        el.gateState.textContent = `Target: ${state.gate.target || 'closed'} · State: ${state.gate.state || 'closed'}`;
        el.statIr.textContent = state.gate.irBlocked ? "Blocked!" : "Clear";
        el.statIr.style.color = state.gate.irBlocked ? "#f44336" : "inherit";

        // Car
        const cmd = state.car.command || "stop";
        el.carCommand.querySelectorAll("button").forEach(b => {
            b.classList.toggle("active", b.dataset.cmd === cmd);
        });
        if (document.activeElement !== el.carSpeed) {
            el.carSpeed.value = state.car.speed || 70;
            el.carSpeedValue.textContent = el.carSpeed.value;
        }
        el.carState.textContent = `Command: ${cmd} · State: ${state.car.state || 'stopped'}`;

        // System / Other
        el.powerSwitch.classList.toggle("on", state.system.power !== false); // default true
        el.beaconSwitch.classList.toggle("on", Boolean(state.beacon.on));
        el.pumpSwitch.classList.toggle("on", Boolean(state.pool.pump));
        el.statMode.textContent = state.system.mode || "normal";
    }

    // Subscriptions
    Link.on("gate", val => { state.gate = val || {}; render(); });
    Link.on("car", val => { state.car = val || {}; render(); });
    Link.on("system", val => { state.system = val || {}; render(); });
    Link.on("beacon", val => { state.beacon = val || {}; render(); });
    Link.on("pool", val => { state.pool = val || {}; render(); });

});
