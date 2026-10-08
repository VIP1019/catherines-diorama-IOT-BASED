"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const Shell = window.ControlShell;
    const Link = window.DioramaLink;
    const DB = window.ResortDB;

    Shell.init("admin-dashboard");

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
        statOccupancy: $("statOccupancy"),
        statGuests: $("statGuests"),
        
        esp1State: $("esp1State"),
        esp1Rssi: $("esp1Rssi"),
        esp2State: $("esp2State"),
        esp2Rssi: $("esp2Rssi"),
        
        stPower: $("stPower"),
        stGuest: $("stGuest"),
        stGate: $("stGate"),
        stCar: $("stCar"),
        stPool: $("stPool"),
        stPump: $("stPump"),
        stKtv: $("stKtv"),
        stBeacon: $("stBeacon"),
        stEvent: $("stEvent"),
        
        logBox: $("activityLog")
    };

    function updateStats() {
        const stats = DB.getReservationStats();
        el.statOccupancy.textContent = `${stats.occupancyPct}%`;
        el.statGuests.textContent = `${stats.activeGuests} Active Guests`;
    }

    function renderStatus() {
        // ESP States
        const e1 = Link.isDeviceOnline("esp1");
        el.esp1State.textContent = Link.mode === "simulation" ? "Simulated" : (e1 ? "Online" : "Offline");
        el.esp1State.style.color = e1 || Link.mode === "simulation" ? "#4caf50" : "#f44336";
        
        const e2 = Link.isDeviceOnline("esp2");
        el.esp2State.textContent = Link.mode === "simulation" ? "Simulated" : (e2 ? "Online" : "Offline");
        el.esp2State.style.color = e2 || Link.mode === "simulation" ? "#4caf50" : "#f44336";
        
        const st1 = Link.get("status/esp1") || {};
        el.esp1Rssi.textContent = `Signal: ${st1.rssi || 0} dBm`;
        
        const st2 = Link.get("status/esp2") || {};
        el.esp2Rssi.textContent = `Signal: ${st2.rssi || 0} dBm`;

        // Components
        const sys = Link.get("system") || {};
        el.stPower.textContent = sys.power === false ? "OFF" : "ON";
        
        const guest = Link.get("guest") || {};
        el.stGuest.textContent = guest.checkedIn ? guest.name : "None";
        
        const gate = Link.get("gate") || {};
        el.stGate.textContent = (gate.target === "open" ? "Opening/Open" : "Closed");
        
        const car = Link.get("car") || {};
        el.stCar.textContent = car.state || "stopped";
        
        const pool = Link.get("pool") || {};
        el.stPool.textContent = pool.light ? "ON" : "OFF";
        el.stPump.textContent = pool.pump ? "ON" : "OFF";
        
        const ktv = Link.get("ktv") || {};
        el.stKtv.textContent = ktv.hallOpen ? "Detected" : "No Magnet";
        
        const beacon = Link.get("beacon") || {};
        el.stBeacon.textContent = beacon.on ? `Sweeping` : "OFF";
        
        const evt = Link.get("event") || {};
        el.stEvent.textContent = evt.mode ? "Active" : "Inactive";
        
        renderLogs();
    }
    
    function renderLogs() {
        const logs = Link.getLogs(25);
        if (logs.length === 0) {
            el.logBox.innerHTML = '<div style="color:var(--muted); text-align:center; padding-top:40px;">No recent activity</div>';
            return;
        }
        
        el.logBox.innerHTML = logs.map(l => {
            const time = new Date(l.t).toLocaleTimeString([], { hour12: false });
            return `
                <div class="log-entry">
                    <span class="log-time">[${time}]</span>
                    <span class="log-msg">${Shell.escapeHtml(l.msg)}</span>
                </div>
            `;
        }).join("");
    }

    // Subscribe to all changes
    Link.on("system", renderStatus);
    Link.on("status", renderStatus);
    Link.on("gate", renderStatus);
    Link.on("car", renderStatus);
    Link.on("pool", renderStatus);
    Link.on("ktv", renderStatus);
    Link.on("beacon", renderStatus);
    Link.on("event", renderStatus);
    Link.on("guest", renderStatus);
    Link.on("logs", renderStatus);
    
    window.addEventListener("resort:reservation-added", updateStats);
    window.addEventListener("resort:reservation-updated", updateStats);

    // Initial renders
    updateStats();
    
    // Heartbeat check interval
    setInterval(renderStatus, 2000);
});