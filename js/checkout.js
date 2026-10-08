"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const Shell = window.ControlShell;
    const Link = window.DioramaLink;
    const DB = window.ResortDB;

    Shell.init("checkout");

    const r = Shell.role();
    if (!r) {
        Shell.renderLocked(document.getElementById("pageContent"), { 
            allowed: false, 
            reason: "Please sign in to view check-out options.", 
            action: "login" 
        });
        return;
    }
    
    const isAdmin = Shell.isAdmin();

    const $ = id => document.getElementById(id);

    const el = {
        guestSection: $("guestSection"),
        adminSection: $("adminSection"),
        activeList: $("activeList"),
        btnCheckout: $("btnCheckout"),
        checkoutBox: $("checkoutBox"),
        checkoutSuccess: $("checkoutSuccess"),
        prompt: $("checkoutPrompt")
    };
    
    if (isAdmin) {
        el.adminSection.style.display = "block";
        el.guestSection.style.display = "none";
    }

    let guestState = Link.get("guest") || {};

    function loadActiveGuests() {
        if (!isAdmin) return;
        const resList = DB.getReservations().filter(r => Shell.isCheckedIn(r));
        
        if (resList.length === 0) {
            el.activeList.innerHTML = `<div style="color:var(--muted); font-size:14px; text-align:center; padding: 20px;">No guests currently checked in.</div>`;
            return;
        }

        el.activeList.innerHTML = resList.map(r => `
            <div class="res-item">
                <div>
                    <strong style="display:block; color:#fbefdc">${Shell.escapeHtml(r.guestName)}</strong>
                    <small style="color:var(--muted)">${r.reference}</small>
                </div>
                <button type="button" class="cs-btn lg checkout-btn" data-ref="${r.reference}" style="border: 1px solid #f44336; color: #f44336; background: transparent;">Check Out</button>
            </div>
        `).join("");
        
        el.activeList.querySelectorAll(".checkout-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                if (window.confirm("Are you sure you want to check out this guest?")) {
                    processCheckOut(btn.dataset.ref);
                }
            });
        });
    }

    function processCheckOut(reference) {
        const res = DB.findReservationByCode(reference);
        if (res) {
            DB.updateReservationStatus(res.reference, "Checked Out");
            
            // If this was the guest currently active in the diorama
            if (guestState.reference === res.reference) {
                // Clear diorama state
                Link.update("guest", {
                    reference: "",
                    name: "",
                    cottage: 0,
                    checkedIn: false,
                    checkinAt: 0
                });
                
                // Clear specific usages if they had them
                const cottageNum = Shell.cottageFromReservation(res);
                if (cottageNum > 0) {
                    Link.update(`cottages/c${cottageNum}`, { light: false, occupied: false, reference: "" });
                }
                
                // If they had the event mode on
                const eventState = Link.get("event") || {};
                if (eventState.reference === res.reference) {
                    Link.update("event", {
                        mode: false,
                        hallLight: false,
                        stageLight: false,
                        music: false,
                        reference: ""
                    });
                }
                
                Link.log(`Check-out: ${res.guestName} (#${res.reference})`);
            }
            
            if (isAdmin) {
                Shell.toast(`Checked out ${res.guestName}.`);
                loadActiveGuests();
            } else {
                el.checkoutBox.style.display = "none";
                el.checkoutSuccess.classList.add("active");
            }
        }
    }
    
    // Guest checkout logic
    if (!isAdmin) {
        const res = Shell.currentReservation();
        if (res && Shell.isCheckedIn(res)) {
            el.btnCheckout.addEventListener("click", () => {
                if (window.confirm("Are you sure you want to check out?")) {
                    processCheckOut(res.reference);
                }
            });
        } else {
            el.btnCheckout.disabled = true;
            el.prompt.textContent = "Not Checked In";
            el.prompt.style.color = "var(--muted)";
        }
    }

    Link.on("guest", value => {
        guestState = value || {};
    });

    loadActiveGuests();
});
