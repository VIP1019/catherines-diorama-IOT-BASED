"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const Shell = window.ControlShell;
    const Link = window.DioramaLink;
    const DB = window.ResortDB;

    Shell.init("check-in");

    // Only allow admin or logged in user to see the page, but admin sees arrivals
    const r = Shell.role();
    if (!r) {
        Shell.renderLocked(document.getElementById("pageContent"), { 
            allowed: false, 
            reason: "Please sign in to check in to your reservation.", 
            action: "login" 
        });
        return;
    }
    
    const isAdmin = Shell.isAdmin();

    const $ = id => document.getElementById(id);

    const el = {
        scanner: $("nfcScanner"),
        prompt: $("nfcPrompt"),
        sub: $("nfcSub"),
        status: $("scannerStatus"),
        guestInfo: $("guestInfo"),
        guestName: $("guestName"),
        guestRef: $("guestRef"),
        guestCottage: $("guestCottage"),
        adminSection: $("adminSection"),
        arrivalsList: $("arrivalsList"),
        gateRow: $("gateRow"),
        gateSwitch: $("gateSwitch"),
        simUid: $("simUid"),
        simBtn: $("simScanBtn")
    };
    
    if (!isAdmin) {
        el.adminSection.style.display = "none";
        document.querySelector(".span-6").classList.remove("span-6");
        document.querySelector(".cs-card").classList.add("span-8"); // Make scanner card wider
    }

    let nfcState = Link.get("nfc") || {};
    let gateState = Link.get("gate") || {};
    let lastProcessedUid = "";

    function loadArrivals() {
        if (!isAdmin) return;
        const resList = DB.getReservations().filter(r => 
            (r.status || "").toLowerCase().includes("arriving") || 
            (r.status || "").toLowerCase().includes("pending") ||
            (r.status || "").toLowerCase().includes("active")
        );
        
        if (resList.length === 0) {
            el.arrivalsList.innerHTML = `<div style="color:var(--muted); font-size:14px; text-align:center; padding: 20px;">No pending arrivals today.</div>`;
            return;
        }

        el.arrivalsList.innerHTML = resList.map(r => `
            <div class="res-item">
                <div>
                    <strong style="display:block; color:#fbefdc">${Shell.escapeHtml(r.guestName)}</strong>
                    <small style="color:var(--muted)">${r.reference} · RFID: ${r.rfidLinked}</small>
                </div>
                ${!Shell.isCheckedIn(r) 
                    ? `<button type="button" class="cs-btn primary sm checkin-btn" data-ref="${r.reference}">Check In</button>`
                    : `<span class="cs-chip on" style="font-size:11px">Checked In</span>`
                }
            </div>
        `).join("");
        
        el.arrivalsList.querySelectorAll(".checkin-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                manualCheckIn(btn.dataset.ref);
            });
        });
    }

    function manualCheckIn(reference) {
        const res = DB.findReservationByCode(reference);
        if (res) {
            processCheckIn(res);
        }
    }

    function processCheckIn(res) {
        DB.updateReservationStatus(res.reference, "Checked In");
        
        // Update DioramaLink Guest State
        Link.update("guest", {
            reference: res.reference,
            name: res.guestName,
            cottage: Shell.cottageFromReservation(res),
            checkedIn: true,
            checkinAt: Date.now()
        });
        
        // Setup welcome UI
        el.scanner.className = "nfc-scanner success";
        el.prompt.textContent = "Check-in Successful!";
        el.sub.textContent = `Welcome to Catherine's, ${res.guestName}`;
        el.status.textContent = "Matched";
        el.status.className = "cs-chip on";
        
        el.guestInfo.classList.add("active");
        el.guestName.textContent = res.guestName;
        el.guestRef.textContent = res.reference;
        
        const facNames = Shell.hasFacility(res, "cottage") ? `Cottage ${Shell.cottageFromReservation(res)}` : 
                         Shell.hasFacility(res, "event") ? "Event Pavilion" : "Resort Facilities";
        el.guestCottage.textContent = facNames;
        
        el.gateRow.style.display = "flex";
        
        // Auto-open gate briefly
        Link.set("gate/target", "open");
        Link.log(`NFC Check-in: ${res.guestName} (#${res.reference})`);
        
        setTimeout(() => {
            resetScanner();
        }, 10000);
        
        loadArrivals();
    }
    
    function resetScanner() {
        el.scanner.className = "nfc-scanner";
        el.prompt.textContent = "Tap NFC Card on the Diorama";
        el.sub.textContent = "Waiting for scan...";
        el.status.textContent = "Ready";
        el.status.className = "cs-chip info";
        el.guestInfo.classList.remove("active");
        lastProcessedUid = "";
    }

    // React to NFC state changes from Firebase/Simulation
    Link.on("nfc", value => {
        nfcState = value || {};
        const uid = nfcState.lastUid;
        
        if (uid && uid !== lastProcessedUid && Date.now() - (nfcState.lastScan || 0) < 5000) {
            lastProcessedUid = uid;
            
            el.scanner.className = "nfc-scanner scanning";
            el.prompt.textContent = "Scanning...";
            el.sub.textContent = `UID: ${uid}`;
            
            // Find reservation matching this RFID
            const allRes = DB.getReservations();
            let res = allRes.find(r => r.rfidLinked === uid);
            
            setTimeout(() => {
                if (res) {
                    processCheckIn(res);
                } else {
                    // DEMO FEATURE: If an unregistered card is scanned, auto-link it to the first pending arrival!
                    const pendingRes = allRes.find(r => 
                        (r.status || "").toLowerCase().includes("arriving") || 
                        (r.status || "").toLowerCase().includes("pending")
                    );
                    
                    if (pendingRes) {
                        pendingRes.rfidLinked = uid;
                        DB.saveReservations(allRes);
                        Link.log(`Auto-linked new card ${uid} to reservation #${pendingRes.reference}`);
                        processCheckIn(pendingRes);
                    } else {
                        el.scanner.className = "nfc-scanner error";
                        el.prompt.textContent = "Access Denied";
                        el.sub.textContent = `UID ${uid} - No pending arrivals found.`;
                        el.status.textContent = "Error";
                        el.status.className = "cs-chip warn";
                        
                        Link.log(`Failed NFC Scan: ${uid}`);
                        
                        setTimeout(resetScanner, 4000);
                    }
                }
            }, 800); // Small delay for visual effect
        }
    });
    
    Link.on("gate", value => {
        gateState = value || {};
        el.gateSwitch.classList.toggle("on", gateState.target === "open");
    });
    
    el.gateSwitch.addEventListener("click", () => {
        const on = gateState.target !== "open";
        Link.set("gate/target", on ? "open" : "closed");
    });

    if (el.simBtn) {
        el.simBtn.addEventListener("click", () => {
            const uid = el.simUid.value.trim();
            if (uid) {
                Link.update("nfc", {
                    lastUid: uid,
                    lastScan: Date.now()
                });
            }
        });
    }

    loadArrivals();
});
