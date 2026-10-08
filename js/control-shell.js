"use strict";

/* =========================================================
   CATHERINE'S CONTROL SHELL
   Shared sidebar, top bar, toast, access rules and
   reservation helpers for the facility control pages:
   KTV, Pool, Cottage, Event, Check-in, Check-out,
   Manual Override.
========================================================= */

(function (window) {

    const GUEST_NAV = [
        { href: "guest-dashboard.html", icon: "fa-solid fa-gauge-high", label: "Dashboard" },
        { href: "my-reservation.html", icon: "fa-regular fa-calendar-check", label: "My Reservation" },
        { href: "check-in.html", icon: "fa-solid fa-id-card", label: "Check-in", page: "check-in" },
        { href: "cottage.html", icon: "fa-solid fa-house-chimney", label: "My Cottage", page: "cottage" },
        { href: "pool.html", icon: "fa-solid fa-water-ladder", label: "Pool Lighting", page: "pool" },
        { href: "event.html", icon: "fa-solid fa-champagne-glasses", label: "Event Mode", page: "event" },
        { href: "ktv.html", icon: "fa-solid fa-microphone-lines", label: "Lighthouse KTV", page: "ktv" },
        { href: "checkout.html", icon: "fa-solid fa-door-open", label: "Check-out", page: "checkout" }
    ];

    const ADMIN_NAV = [
        { href: "admin-dashboard.html", icon: "fa-solid fa-sliders", label: "Operational Center" },
        { href: "admin-reservations.html", icon: "fa-regular fa-calendar-days", label: "Master Reservations" },
        { href: "manual-override.html", icon: "fa-solid fa-gamepad", label: "Manual Override", page: "manual-override" },
        { href: "check-in.html", icon: "fa-solid fa-id-card", label: "Check-in Desk", page: "check-in" },
        { href: "cottage.html", icon: "fa-solid fa-house-chimney", label: "Cottages", page: "cottage" },
        { href: "pool.html", icon: "fa-solid fa-water-ladder", label: "Pool & Bridge", page: "pool" },
        { href: "event.html", icon: "fa-solid fa-champagne-glasses", label: "Event Place", page: "event" },
        { href: "ktv.html", icon: "fa-solid fa-microphone-lines", label: "Lighthouse KTV", page: "ktv" },
        { href: "checkout.html", icon: "fa-solid fa-door-open", label: "Check-out Desk", page: "checkout" },
        { href: "sensors.html", icon: "fa-solid fa-satellite-dish", label: "Sensors Telemetry" }
    ];

    /* -----------------------------------------------------
       SESSION & RESERVATION HELPERS
    ----------------------------------------------------- */

    function role() {
        if (localStorage.getItem("isLoggedIn") !== "true") return null;
        return localStorage.getItem("userRole") === "admin" ? "admin" : "guest";
    }

    function isAdmin() {
        return role() === "admin";
    }

    function currentReservation() {
        let res = null;
        try {
            res = JSON.parse(localStorage.getItem("currentReservation") || "null");
        } catch (e) { res = null; }

        if (res && res.reference && window.ResortDB) {
            const fresh = window.ResortDB.findReservationByCode(res.reference);
            if (fresh) res = fresh;
        }
        return res;
    }

    function facilityNames(res) {
        return (res && Array.isArray(res.facilities) ? res.facilities : [])
            .map(f => String((f && (f.name || f.value)) || f || "").toLowerCase());
    }

    function hasFacility(res, kind) {
        const names = facilityNames(res);
        if (names.some(n => n.includes("buyout"))) return true;
        const match = {
            cottage: n => n.includes("cottage"),
            pool: n => n.includes("pool") || n.includes("bridge"),
            ktv: n => n.includes("ktv"),
            event: n => n.includes("event") || n.includes("pavilion") || n.includes("celebration")
        }[kind];
        return match ? names.some(match) : false;
    }

    /* Cottage number written in the facility name, e.g. "Cottage 2 Oceanfront" */
    function cottageFromReservation(res) {
        for (const n of facilityNames(res)) {
            const m = n.match(/cottage\s*#?\s*(\d)/);
            if (m) {
                const num = Number(m[1]);
                if (num >= 1 && num <= 4) return num;
            }
        }
        return 0;
    }

    function isCheckedIn(res) {
        if (!res) return false;
        const st = String(res.status || "").toLowerCase();
        return st.includes("checked in") || st.includes("in facility") || st === "active";
    }

    /*
       Access rule:
         Admin  -> always allowed.
         Guest  -> must be checked in AND have reserved the facility.
    */
    function accessFor(kind) {
        if (isAdmin()) return { allowed: true, admin: true };

        const r = role();
        if (!r) {
            return { allowed: false, reason: "Please sign in to use this control.", action: "login" };
        }

        const res = currentReservation();
        if (!res) {
            return { allowed: false, reason: "You don't have a reservation yet.", action: "reserve" };
        }

        if (!hasFacility(res, kind)) {
            const labels = { cottage: "a Cottage", pool: "the Swimming Pool", ktv: "the Lighthouse KTV", event: "the Event Place" };
            return {
                allowed: false,
                reason: `Your reservation #${res.reference} does not include ${labels[kind] || "this facility"}.`,
                action: "reserve"
            };
        }

        if (!isCheckedIn(res)) {
            return {
                allowed: false,
                reason: `Tap your NFC card at the entrance to check in first (reservation #${res.reference}).`,
                action: "checkin"
            };
        }

        return { allowed: true, reservation: res };
    }

    /* -----------------------------------------------------
       UI
    ----------------------------------------------------- */

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function renderSidebar(activePage) {
        const container = document.getElementById("controlSidebar");
        if (!container) return;

        const admin = isAdmin();
        const nav = admin ? ADMIN_NAV : GUEST_NAV;

        container.innerHTML = `
            <aside class="cs-sidebar" id="csSidebar">
                <a href="index.html" class="cs-brand">
                    <img src="assets/Catherine's Logo.png" alt="Catherine's Logo">
                    <div>
                        <strong>Catherine’s</strong>
                        <span>${admin ? "LIGHTHOUSE COMMAND" : "GUEST PORTAL"}</span>
                    </div>
                </a>

                <div class="cs-hw" id="csHardware">
                    <span class="cs-dot"></span>
                    <div>
                        <strong id="csHwTitle">Connecting…</strong>
                        <span id="csHwSub">ESP 1 · ESP 2</span>
                    </div>
                </div>

                <div class="cs-label">${admin ? "OWNER CONTROLS" : "MY STAY"}</div>

                <nav class="cs-nav">
                    ${nav.map(item => `
                        <a href="${item.href}" class="cs-nav-item ${item.page === activePage ? "active" : ""}" id="nav-${item.href.replace(".html", "")}">
                            <i class="${item.icon}"></i>
                            <span>${item.label}</span>
                        </a>
                    `).join("")}
                </nav>

                <div class="cs-footer">
                    <a href="index.html" class="cs-site"><i class="fa-solid fa-globe"></i> Visitor Site</a>
                    ${role()
                        ? `<button type="button" class="cs-logout" id="csLogout" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i></button>`
                        : `<a href="login.html" class="cs-logout" id="csLogin" aria-label="Sign in"><i class="fa-solid fa-right-to-bracket"></i></a>`}
                </div>
            </aside>
            <button type="button" class="cs-menu" id="csMenu" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>
        `;

        const logout = document.getElementById("csLogout");
        if (logout) {
            logout.addEventListener("click", () => {
                if (!window.confirm("Are you sure you want to log out?")) return;
                if (window.ResortDB) window.ResortDB.clearSession();
                localStorage.removeItem("currentReservation");
                window.location.href = "index.html";
            });
        }

        document.getElementById("csMenu").addEventListener("click", () => {
            document.getElementById("csSidebar").classList.toggle("open");
        });
    }

    function updateHardwarePill() {
        const link = window.DioramaLink;
        const title = document.getElementById("csHwTitle");
        const sub = document.getElementById("csHwSub");
        const box = document.getElementById("csHardware");
        const top = document.getElementById("csConnection");
        if (!link) return;

        const e1 = link.isDeviceOnline("esp1");
        const e2 = link.isDeviceOnline("esp2");

        let label, cls;
        if (link.mode === "simulation") {
            label = "Simulation Mode";
            cls = "sim";
        } else if (e1 && e2) {
            label = "Diorama Online";
            cls = "online";
        } else if (e1 || e2) {
            label = "Partially Online";
            cls = "partial";
        } else {
            label = "ESP32 Offline";
            cls = "offline";
        }

        if (title) title.textContent = label;
        if (sub) sub.textContent = `ESP 1 ${e1 ? "●" : "○"}  ·  ESP 2 ${e2 ? "●" : "○"}`;
        if (box) box.dataset.state = cls;
        if (top) {
            top.dataset.state = cls;
            top.innerHTML = `<i></i>${link.mode === "firebase" ? "Firebase" : "Simulation"} · ${label}`;
            top.title = link.mode === "simulation"
                ? "Firebase is not configured (js/firebase-config.js). Commands are simulated in this browser only."
                : "Connected to Firebase Realtime Database.";
        }
    }

    function toast(message, type = "info") {
        let el = document.querySelector(".cs-toast");
        if (!el) {
            el = document.createElement("div");
            el.className = "cs-toast";
            el.setAttribute("role", "status");
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.dataset.type = type;
        el.classList.add("show");
        clearTimeout(el.hideTimer);
        el.hideTimer = setTimeout(() => el.classList.remove("show"), 2600);
    }

    function renderLocked(container, access) {
        const actions = {
            login: `<a class="cs-btn primary" href="login.html" id="lockedLogin"><i class="fa-solid fa-right-to-bracket"></i> Sign in</a>`,
            reserve: `<a class="cs-btn primary" href="reservation.html" id="lockedReserve"><i class="fa-regular fa-calendar-plus"></i> Make a reservation</a>`,
            checkin: `<a class="cs-btn primary" href="check-in.html" id="lockedCheckin"><i class="fa-solid fa-id-card"></i> Go to Check-in</a>`
        };
        container.innerHTML = `
            <section class="cs-locked">
                <div class="cs-locked-icon"><i class="fa-solid fa-lock"></i></div>
                <h2>Control locked</h2>
                <p>${escapeHtml(access.reason)}</p>
                ${actions[access.action] || ""}
            </section>
        `;
    }

    function timeAgo(ts) {
        if (!ts) return "—";
        const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
        if (s < 60) return `${s}s ago`;
        if (s < 3600) return `${Math.round(s / 60)}m ago`;
        return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function init(activePage) {
        renderSidebar(activePage);
        if (window.DioramaLink) {
            window.DioramaLink.ready.then(updateHardwarePill);
            window.DioramaLink.on("status", updateHardwarePill);
            setInterval(updateHardwarePill, 3000);
        }
    }

    window.ControlShell = {
        init,
        role,
        isAdmin,
        currentReservation,
        hasFacility,
        cottageFromReservation,
        isCheckedIn,
        accessFor,
        toast,
        renderLocked,
        escapeHtml,
        timeAgo
    };

})(window);
