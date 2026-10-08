"use strict";

/* =========================================================
   COTTAGES
   Firebase paths used:
     cottages/c1..c4/light      true | false
     cottages/c1..c4/occupied   true | false  (set on check-in)
     cottages/c1..c4/reference  reservation code
     guest/*                    last checked-in guest
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const Shell = window.ControlShell;
    const Link = window.DioramaLink;

    Shell.init("cottage");

    const access = Shell.accessFor("cottage");
    if (!access.allowed) {
        Shell.renderLocked(document.getElementById("pageContent"), access);
        return;
    }

    const admin = Shell.isAdmin();
    const res = Shell.currentReservation();

    const NAMES = {
        1: "Beachfront",
        2: "Oceanfront",
        3: "Sunset Bay",
        4: "Bridal Suite"
    };

    const $ = id => document.getElementById(id);
    const grid = $("cottageGrid");

    let cottages = Link.get("cottages") || {};

    if (!admin) {
        $("cottageTitle").textContent = "My Cottage";
        $("cottageIntro").textContent = "Your cottage light was turned on automatically when you checked in. You can switch it on or off here.";
        $("mapHint").textContent = "Your cottage is highlighted in gold";
    } else {
        $("myStayCard").style.display = "none";
    }

    function myCottage() {
        if (!res) return 0;
        for (let i = 1; i <= 4; i++) {
            const c = cottages[`c${i}`];
            if (c && c.reference && c.reference.toUpperCase() === res.reference.toUpperCase()) return i;
        }
        return Shell.cottageFromReservation(res);
    }

    grid.addEventListener("click", e => {
        const btn = e.target.closest("[data-light]");
        if (!btn) return;
        const n = Number(btn.dataset.light);
        if (!admin && n !== myCottage()) return;
        const on = !(cottages[`c${n}`] && cottages[`c${n}`].light);
        Link.set(`cottages/c${n}/light`, on);
        Link.log(`Cottage ${n} light ${on ? "ON" : "OFF"}`);
    });

    grid.addEventListener("click", e => {
        const btn = e.target.closest("[data-release]");
        if (!btn || !admin) return;
        const n = Number(btn.dataset.release);
        if (!window.confirm(`Release Cottage ${n}? This marks it vacant and turns the light off.`)) return;
        Link.set(`cottages/c${n}`, { light: false, occupied: false, reference: "" });
        Link.log(`Cottage ${n} released by owner`);
        Shell.toast(`Cottage ${n} is now vacant.`);
    });

    function render() {
        const mine = myCottage();
        let occupied = 0;

        grid.innerHTML = [1, 2, 3, 4].map(n => {
            const c = cottages[`c${n}`] || {};
            if (c.occupied) occupied++;
            const isMine = !admin && n === mine;
            const canToggle = admin || isMine;

            let status = c.occupied ? `Occupied · #${Shell.escapeHtml(c.reference || "")}` : "Vacant";
            if (isMine) status = "Your cottage";

            return `
                <article class="cottage ${c.light ? "lit" : ""} ${isMine ? "mine" : ""}" id="cottage-${n}">
                    <div class="hut">
                        <div class="hut-roof"></div>
                        <div class="hut-body"><div class="hut-window"></div></div>
                    </div>
                    <h3>Cottage ${n}</h3>
                    <p>${NAMES[n]}<br>${status}</p>
                    <span class="cs-chip ${c.light ? "on" : "off"}" style="margin-bottom:12px">${c.light ? "Light on" : "Light off"}</span>
                    ${canToggle ? `
                        <button type="button" class="cs-btn ${c.light ? "dark" : "primary"} block" data-light="${n}" id="toggleCottage${n}">
                            <i class="fa-solid fa-lightbulb"></i> ${c.light ? "Turn off" : "Turn on"}
                        </button>` : ""}
                    ${admin && c.occupied ? `
                        <button type="button" class="cs-btn danger block" style="margin-top:8px" data-release="${n}" id="releaseCottage${n}">
                            <i class="fa-solid fa-key"></i> Release
                        </button>` : ""}
                </article>`;
        }).join("");

        $("occupancyChip").textContent = `${occupied} / 4 occupied`;

        if (!admin && res) {
            const c = mine ? (cottages[`c${mine}`] || {}) : {};
            $("myStay").innerHTML = `
                <div><span>Guest</span><strong>${Shell.escapeHtml(res.guestName)}</strong></div>
                <div><span>Reservation</span><strong>#${Shell.escapeHtml(res.reference)}</strong></div>
                <div><span>Assigned cottage</span><strong>${mine ? `Cottage ${mine} · ${NAMES[mine]}` : "Assigned at check-in"}</strong></div>
                <div><span>Cottage light</span><strong>${c.light ? "On" : "Off"}</strong></div>
                <div><span>Stay</span><strong>${Shell.escapeHtml(res.duration || "—")}</strong></div>
            `;
        }
    }

    Link.on("cottages", value => { cottages = value || {}; render(); });
});
