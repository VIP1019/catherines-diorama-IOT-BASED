"use strict";

/* =========================================================
   CATHERINE'S BAGASBAS LIGHTHOUSE RESORT
   BUILT-IN DATABASE & AUTHENTICATION ENGINE (ResortDB)
========================================================= */

(function (window) {
    const STORAGE_KEY_USERS = "resortUsers";
    const STORAGE_KEY_RESERVATIONS = "reservationHistory";
    const STORAGE_KEY_CURRENT_RES = "currentReservation";
    const STORAGE_KEY_DB_VERSION = "resortDb_version";
    const CURRENT_DB_VERSION = "1.0.0";

    // Hard-coded Resort Administrator Account
    const ADMIN_ACCOUNT = {
        id: "admin-catherine",
        fullName: "Catherine",
        email: "admin@catherines.com",
        password: "Admin123!",
        role: "admin",
        createdAt: "2026-01-01T00:00:00.000Z",
        membershipTier: "Resort Administrator"
    };

    // Pre-registered Seed Demo Accounts
    const SEED_USERS = [
        ADMIN_ACCOUNT,
        {
            id: "user-demo-guest",
            fullName: "Maria Santos",
            email: "guest@catherineslighthouse.ph",
            phone: "+63 917 123 4567",
            password: "Sanctuary2026!",
            role: "guest",
            createdAt: "2026-01-15T00:00:00.000Z",
            membershipTier: "Sanctuary Member",
            subscribeOffers: true
        }
    ];

    // Seed Master Reservations for Catherine's Lighthouse Resort
    const SEED_RESERVATIONS = [
        {
            reference: "CBLR-7482",
            checkinDate: "Today, 2:00 PM",
            duration: "2 Nights",
            totalGuests: 6,
            adults: 4,
            children: 2,
            senior: 0,
            guestName: "Maria Elena Santos",
            email: "maria.santos@email.ph",
            mobile: "+63 917 842 1904",
            honorific: "Ms.",
            specialRequests: "Family VIP setup with baby cot",
            facilities: [
                { name: "Cottage 2 Oceanfront", price: 4500 },
                { name: "Pool Bridge Unlimited Pass", price: 1200 },
                { name: "Lighthouse KTV (7:00 PM – 10:00 PM)", price: 2500 }
            ],
            prices: { total: 8782 },
            status: "Active",
            paymentMethod: "Paid via Maya QR",
            nodeNumber: 4,
            rfidLinked: "7482",
            createdAt: "2026-10-06T06:00:00.000Z"
        },
        {
            reference: "CBLR-7483",
            checkinDate: "Today, 3:30 PM",
            duration: "1 Night",
            totalGuests: 2,
            adults: 2,
            children: 0,
            senior: 0,
            guestName: "Capt. Rodrigo Tan",
            email: "rodrigo.tan@maritime.ph",
            mobile: "+63 920 412 8812",
            honorific: "Capt.",
            specialRequests: "Quiet corner near shore",
            facilities: [
                { name: "Cottage 1 Beachfront", price: 4200 },
                { name: "General Pool Access", price: 1200 }
            ],
            prices: { total: 5400 },
            status: "Arriving",
            paymentMethod: "Paid via GCash",
            nodeNumber: 1,
            rfidLinked: "7483",
            createdAt: "2026-10-06T07:30:00.000Z"
        },
        {
            reference: "CBLR-6643",
            checkinDate: "Today, 5:00 PM",
            duration: "1 Night",
            totalGuests: 4,
            adults: 4,
            children: 0,
            senior: 0,
            guestName: "Atty. Camille Verzosa",
            email: "camille.verzosa@law.ph",
            mobile: "+63 918 903 2145",
            honorific: "Atty.",
            specialRequests: "Late check-in requested",
            facilities: [
                { name: "Cottage 3 Sunset Bay", price: 4500 },
                { name: "Lighthouse KTV (Private Session)", price: 2200 }
            ],
            prices: { total: 6700 },
            status: "Arriving",
            paymentMethod: "BPI Direct Transfer",
            nodeNumber: 3,
            rfidLinked: "8821",
            createdAt: "2026-10-06T08:15:00.000Z"
        },
        {
            reference: "CBLR-9011",
            checkinDate: "Tomorrow, 10:00 AM",
            duration: "Full Day Event",
            totalGuests: 120,
            adults: 100,
            children: 20,
            senior: 0,
            guestName: "Dr. Noel Alcantara & Party",
            email: "noel.alcantara@medical.org",
            mobile: "+63 917 555 9811",
            honorific: "Dr.",
            specialRequests: "Banquet Gala sound check 8 AM",
            facilities: [
                { name: "Grand Event Pavilion", price: 35000 },
                { name: "Cottage 4 (Bridal Suite)", price: 5000 },
                { name: "Pool & Grounds Exclusive", price: 17000 }
            ],
            prices: { total: 57000 },
            status: "Confirmed",
            paymentMethod: "50% Bank Deposit",
            nodeNumber: 7,
            rfidLinked: "9011",
            createdAt: "2026-10-05T14:00:00.000Z"
        },
        {
            reference: "CBLR-5532",
            checkinDate: "Today, 11:00 AM",
            duration: "Day Leisure Pass",
            totalGuests: 4,
            adults: 4,
            children: 0,
            senior: 0,
            guestName: "Mateo Cruz",
            email: "mateo.cruz@gmail.com",
            mobile: "+63 939 123 7740",
            honorific: "Mr.",
            specialRequests: "Locker key rental",
            facilities: [
                { name: "Pool & Arched Bridge", price: 1200 }
            ],
            prices: { total: 1200 },
            status: "In Facility",
            paymentMethod: "Paid Maya Cashier",
            nodeNumber: 2,
            rfidLinked: "5532",
            createdAt: "2026-10-06T03:00:00.000Z"
        }
    ];

    // In-memory fallback if localStorage is disabled or throws
    const memoryStorage = {};

    function safeGetItem(key) {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                return window.localStorage.getItem(key);
            }
        } catch (e) {
            console.warn("[ResortDB] localStorage read failed, using memory fallback", e);
        }
        return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
    }

    function safeSetItem(key, val) {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.setItem(key, val);
                return;
            }
        } catch (e) {
            console.warn("[ResortDB] localStorage write failed, using memory fallback", e);
        }
        memoryStorage[key] = String(val);
    }

    function safeRemoveItem(key) {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn("[ResortDB] localStorage remove failed", e);
        }
        delete memoryStorage[key];
    }

    const ResortDB = {
        ADMIN_EMAIL: ADMIN_ACCOUNT.email,
        ADMIN_PASSWORD: ADMIN_ACCOUNT.password,

        /**
         * Initialize the database and ensure seed accounts exist
         * without wiping any existing registered user data.
         */
        init() {
            try {
                let users = this.getAllUsers();
                let updated = false;

                if (!Array.isArray(users) || users.length === 0) {
                    users = [...SEED_USERS];
                    updated = true;
                } else {
                    // Ensure admin and demo seed accounts are present
                    for (const seed of SEED_USERS) {
                        const exists = users.some(
                            u => u && u.email && u.email.toLowerCase() === seed.email.toLowerCase()
                        );
                        if (!exists) {
                            users.push(seed);
                            updated = true;
                        }
                    }
                }

                if (updated) {
                    this._saveUsers(users);
                }

                this.initReservations();

                safeSetItem(STORAGE_KEY_DB_VERSION, CURRENT_DB_VERSION);
                console.log(`[ResortDB] Built-in Database initialized with ${users.length} accounts.`);
            } catch (err) {
                console.error("[ResortDB] Initialization failed:", err);
            }
        },

        _saveUsers(users) {
            safeSetItem(STORAGE_KEY_USERS, JSON.stringify(users));
        },

        /**
         * Initialize seed reservations for Master Reservations and diorama
         */
        initReservations() {
            try {
                let reservations = [];
                const data = safeGetItem(STORAGE_KEY_RESERVATIONS);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed)) reservations = parsed;
                    } catch (e) {}
                }

                let updated = false;
                if (reservations.length === 0) {
                    reservations = [...SEED_RESERVATIONS];
                    updated = true;
                } else {
                    for (const seed of SEED_RESERVATIONS) {
                        const exists = reservations.some(
                            r => r && r.reference && r.reference.toUpperCase() === seed.reference.toUpperCase()
                        );
                        if (!exists) {
                            reservations.push(seed);
                            updated = true;
                        }
                    }
                }

                if (updated) {
                    this._saveReservations(reservations);
                }
            } catch (err) {
                console.error("[ResortDB] Reservation initialization failed:", err);
            }
        },

        _saveReservations(list) {
            safeSetItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(list));
        },

        /**
         * Retrieve all user records from database
         */
        getAllUsers() {
            try {
                const data = safeGetItem(STORAGE_KEY_USERS);
                if (!data) return [];
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed : [];
            } catch (err) {
                console.error("[ResortDB] Error reading users from storage:", err);
                return [];
            }
        },

        /**
         * Find a user by email (case-insensitive)
         */
        getUserByEmail(email) {
            if (!email || typeof email !== "string") return null;
            const normalized = email.trim().toLowerCase();
            const users = this.getAllUsers();
            return users.find(u => u && u.email && u.email.toLowerCase() === normalized) || null;
        },

        /**
         * Check if an email is registered in the database
         */
        isEmailRegistered(email) {
            return this.getUserByEmail(email) !== null;
        },

        /**
         * Check if an email corresponds to the Administrator
         */
        isAdmin(email) {
            if (!email || typeof email !== "string") return false;
            return email.trim().toLowerCase() === ADMIN_ACCOUNT.email.toLowerCase();
        },

        /**
         * Register a new user in the database
         */
        registerUser(userData) {
            if (!userData || !userData.email || !userData.password) {
                return {
                    success: false,
                    error: "MISSING_FIELDS",
                    message: "Email and password are required to register an account."
                };
            }

            const cleanEmail = userData.email.trim().toLowerCase();

            if (this.isEmailRegistered(cleanEmail)) {
                return {
                    success: false,
                    error: "EMAIL_EXISTS",
                    message: "An account with this email address already exists. Please sign in instead."
                };
            }

            const newUser = {
                id: "user-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
                fullName: (userData.fullName || cleanEmail.split("@")[0]).trim(),
                email: cleanEmail,
                phone: (userData.phone || "").trim(),
                password: userData.password,
                role: "guest",
                membershipTier: userData.membershipTier || "Sanctuary Member",
                subscribeOffers: Boolean(userData.subscribeOffers),
                createdAt: new Date().toISOString()
            };

            const users = this.getAllUsers();
            users.push(newUser);
            this._saveUsers(users);

            return {
                success: true,
                user: newUser,
                message: "Sanctuary account created successfully!"
            };
        },

        /**
         * Strict credential authentication against the database.
         * Returns success: true and user object, or success: false with specific error code.
         */
        authenticate(email, password) {
            if (!email || !password) {
                return {
                    success: false,
                    error: "EMPTY_CREDENTIALS",
                    message: "Please enter both your email address and password."
                };
            }

            const cleanEmail = email.trim().toLowerCase();

            // 1. Check Administrator credentials
            if (cleanEmail === ADMIN_ACCOUNT.email.toLowerCase()) {
                if (password === ADMIN_ACCOUNT.password) {
                    return {
                        success: true,
                        role: "admin",
                        user: ADMIN_ACCOUNT,
                        message: "Administrator authenticated successfully."
                    };
                } else {
                    return {
                        success: false,
                        error: "INVALID_PASSWORD",
                        message: "Incorrect password for administrator account."
                    };
                }
            }

            // 2. Lookup registered user in database
            const user = this.getUserByEmail(cleanEmail);

            if (!user) {
                return {
                    success: false,
                    error: "USER_NOT_FOUND",
                    message: "No registered account found with this email address. Please create an account first."
                };
            }

            // 3. Verify user password
            if (user.password !== password) {
                return {
                    success: false,
                    error: "INVALID_PASSWORD",
                    message: "Incorrect password for this registered account. Please try again or reset your password."
                };
            }

            return {
                success: true,
                role: user.role || "guest",
                user: user,
                message: "Authentication successful."
            };
        },

        /**
         * Update password for an existing registered account
         */
        updatePassword(email, newPassword) {
            if (!email || !newPassword) {
                return {
                    success: false,
                    error: "MISSING_DATA",
                    message: "Email and new password are required."
                };
            }

            const cleanEmail = email.trim().toLowerCase();
            const users = this.getAllUsers();
            const index = users.findIndex(u => u && u.email && u.email.toLowerCase() === cleanEmail);

            if (index === -1) {
                return {
                    success: false,
                    error: "USER_NOT_FOUND",
                    message: "No registered account found with this email address."
                };
            }

            users[index].password = newPassword;
            users[index].updatedAt = new Date().toISOString();
            this._saveUsers(users);

            return {
                success: true,
                message: "Password updated successfully."
            };
        },

        /**
         * Save active session state in storage
         */
        saveSession(user, rememberMe = false) {
            safeSetItem("isLoggedIn", "true");
            safeSetItem("rememberMe", rememberMe ? "true" : "false");

            const ONE_DAY = 24 * 60 * 60 * 1000;
            const THIRTY_DAYS = 30 * ONE_DAY;
            const expiry = Date.now() + (rememberMe ? THIRTY_DAYS : ONE_DAY);

            safeSetItem("sessionExpiry", expiry.toString());
            safeSetItem("loginTime", Date.now().toString());

            if (user.role === "admin") {
                safeSetItem("userRole", "admin");
                safeSetItem("adminEmail", user.email);
                safeSetItem("adminName", user.fullName || "Catherine");
                safeRemoveItem("guestEmail");
                safeRemoveItem("guestName");
                safeRemoveItem("guestPhone");
            } else {
                safeSetItem("userRole", "guest");
                safeSetItem("guestEmail", user.email);
                safeSetItem("guestName", user.fullName || "Guest");
                if (user.phone) {
                    safeSetItem("guestPhone", user.phone);
                }
                safeRemoveItem("adminEmail");
                safeRemoveItem("adminName");
            }
        },

        /**
         * Terminate active session
         */
        clearSession() {
            safeRemoveItem("isLoggedIn");
            safeRemoveItem("userRole");
            safeRemoveItem("guestEmail");
            safeRemoveItem("guestName");
            safeRemoveItem("guestPhone");
            safeRemoveItem("adminEmail");
            safeRemoveItem("adminName");
            safeRemoveItem("sessionExpiry");
            safeRemoveItem("rememberMe");
            safeRemoveItem("loginTime");
        },

        /**
         * Validate active session and expiration
         */
        isSessionValid() {
            const logged = safeGetItem("isLoggedIn") === "true";
            const expiry = safeGetItem("sessionExpiry");
            if (logged && expiry) {
                if (Date.now() > parseInt(expiry, 10)) {
                    this.clearSession();
                    return false;
                }
            }
            return logged;
        },

        /**
         * Retrieve reservation history (guarantees baseline seeds if empty)
         */
        getReservations() {
            try {
                const data = safeGetItem(STORAGE_KEY_RESERVATIONS);
                if (data) {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
                return [...SEED_RESERVATIONS];
            } catch (e) {
                console.warn("[ResortDB] Failed to load reservations, returning seeds", e);
                return [...SEED_RESERVATIONS];
            }
        },

        /**
         * Find reservation by booking reference code
         */
        findReservationByCode(code) {
            if (!code) return null;
            const clean = code.replace(/^#/, "").trim().toUpperCase();
            const list = this.getReservations();
            return list.find(r => {
                if (!r || !r.reference) return false;
                const ref = r.reference.toUpperCase();
                return ref === clean || ref.replace(/[^A-Z0-9]/g, "") === clean.replace(/[^A-Z0-9]/g, "");
            }) || null;
        },

        /**
         * Add a new reservation submitted by a guest or admin
         */
        addReservation(reservationData) {
            if (!reservationData) {
                return { success: false, error: "INVALID_DATA", message: "Reservation data is required." };
            }

            const cleanRef = (reservationData.reference || ("CBLR-" + Math.floor(100000 + Math.random() * 900000))).replace(/^#/, "").trim().toUpperCase();

            // Auto-assign available ESP32 diorama node (1-9)
            const nodeNumber = Number(reservationData.nodeNumber) || (Math.floor(Math.random() * 9) + 1);
            const rfidLinked = reservationData.rfidLinked || cleanRef.replace(/[^0-9]/g, "").slice(-4) || "8801";

            const newReservation = {
                reference: cleanRef,
                checkinDate: reservationData.checkinDate || "Today",
                duration: reservationData.duration || "Standard Stay",
                adults: Number(reservationData.adults) || 1,
                children: Number(reservationData.children) || 0,
                senior: Number(reservationData.senior) || 0,
                totalGuests: Number(reservationData.totalGuests) || (Number(reservationData.adults || 1) + Number(reservationData.children || 0) + Number(reservationData.senior || 0)),
                honorific: reservationData.honorific || "",
                guestName: (reservationData.guestName || "Valued Guest").trim(),
                email: (reservationData.email || "").trim(),
                mobile: (reservationData.mobile || "").trim(),
                specialRequests: (reservationData.specialRequests || "").trim(),
                facilities: Array.isArray(reservationData.facilities) ? reservationData.facilities : [],
                prices: reservationData.prices || { total: 0 },
                status: reservationData.status || "Pending Verification",
                paymentMethod: reservationData.paymentMethod || "Pending Verification",
                nodeNumber: nodeNumber,
                rfidLinked: rfidLinked,
                createdAt: reservationData.createdAt || new Date().toISOString()
            };

            const reservations = this.getReservations();
            // Prepend new reservation to appear at top of Master Reservations
            reservations.unshift(newReservation);
            this._saveReservations(reservations);

            // AUTO-UPDATE DIORAMA NAME:
            // Send the new guest's name directly to the ESP32 so it is ready
            // for the instant RFID tap bypass!
            if (window.DioramaLink) {
                window.DioramaLink.update("guest", {
                    name: newReservation.guestName,
                    reference: newReservation.reference,
                    checkedIn: false
                });
            }

            // Update currentReservation for the active guest session
            safeSetItem(STORAGE_KEY_CURRENT_RES, JSON.stringify(newReservation));

            // Broadcast real-time sync across other browser tabs/windows
            const syncTimestamp = Date.now().toString();
            safeSetItem("resort_reservation_sync", syncTimestamp);

            // Broadcast in current window
            try {
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("resort:reservation-added", {
                        detail: newReservation
                    }));
                }
            } catch (e) {}

            console.log(`[ResortDB] Reservation added: #${cleanRef} for ${newReservation.guestName}`);
            return {
                success: true,
                reservation: newReservation,
                message: "Reservation successfully recorded and synchronized with Resort Command."
            };
        },

        /**
         * Update reservation status (e.g. Confirmed, Cancelled, In Facility, Checked In, Checked Out)
         */
        updateReservationStatus(reference, newStatus) {
            if (!reference || !newStatus) {
                return { success: false, error: "MISSING_DATA" };
            }

            const clean = reference.replace(/^#/, "").trim().toUpperCase();
            const reservations = this.getReservations();
            const idx = reservations.findIndex(r => r && r.reference && r.reference.toUpperCase() === clean);

            if (idx === -1) {
                return { success: false, error: "NOT_FOUND", message: `Reservation #${reference} not found.` };
            }

            reservations[idx].status = newStatus;
            reservations[idx].updatedAt = new Date().toISOString();
            this._saveReservations(reservations);

            // Synchronize active currentReservation if same booking
            try {
                const currentData = safeGetItem(STORAGE_KEY_CURRENT_RES);
                if (currentData) {
                    const current = JSON.parse(currentData);
                    if (current && current.reference && current.reference.toUpperCase() === clean) {
                        current.status = newStatus;
                        safeSetItem(STORAGE_KEY_CURRENT_RES, JSON.stringify(current));
                    }
                }
            } catch (e) {
                console.warn("[ResortDB] Could not sync currentReservation", e);
            }

            // Broadcast cross-tab sync
            safeSetItem("resort_reservation_sync", Date.now().toString());

            try {
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("resort:reservation-updated", {
                        detail: { reference: clean, status: newStatus, reservation: reservations[idx] }
                    }));
                }
            } catch (e) {}

            return {
                success: true,
                reservation: reservations[idx],
                message: `Reservation #${clean} status updated to ${newStatus}.`
            };
        },

        /**
         * Remove reservation by reference
         */
        deleteReservation(reference) {
            if (!reference) return { success: false };
            const clean = reference.replace(/^#/, "").trim().toUpperCase();
            let reservations = this.getReservations();
            reservations = reservations.filter(r => !(r && r.reference && r.reference.toUpperCase() === clean));
            this._saveReservations(reservations);
            safeSetItem("resort_reservation_sync", Date.now().toString());
            return { success: true };
        },

        /**
         * Calculate summary metrics for Admin Master Reservations & Diorama
         */
        getReservationStats() {
            const list = this.getReservations();
            let total = list.length;
            let pending = 0;
            let active = 0;
            let cancelled = 0;
            let activeGuests = 0;
            let grossRevenue = 0;
            const cottagesBooked = new Set();

            for (const r of list) {
                const st = (r.status || "").toLowerCase();
                const isCancelled = st.includes("cancel");
                const isPending = st.includes("pending") || st.includes("hold");
                const isActive = st.includes("active") || st.includes("checked in") || st.includes("in facility") || st.includes("confirmed") || st.includes("arriving") || st.includes("expected");

                if (isCancelled) {
                    cancelled++;
                } else {
                    const price = r.prices && Number(r.prices.total) ? Number(r.prices.total) : 0;
                    grossRevenue += price;

                    if (isPending) {
                        pending++;
                    }
                    if (isActive) {
                        active++;
                        const guests = Number(r.totalGuests) || (Number(r.adults || 0) + Number(r.children || 0) + Number(r.senior || 0)) || 1;
                        activeGuests += guests;
                    }

                    // Check cottage occupancy
                    const facs = Array.isArray(r.facilities) ? r.facilities : [];
                    for (const f of facs) {
                        const name = (f.name || f.value || "").toLowerCase();
                        if (name.includes("cottage 1") || name.includes("cottage #1")) cottagesBooked.add(1);
                        else if (name.includes("cottage 2") || name.includes("cottage #2")) cottagesBooked.add(2);
                        else if (name.includes("cottage 3") || name.includes("cottage #3")) cottagesBooked.add(3);
                        else if (name.includes("cottage 4") || name.includes("cottage #4")) cottagesBooked.add(4);
                        else if (name.includes("cottage") || name.includes("buyout")) {
                            for (let i = 1; i <= 4; i++) {
                                if (!cottagesBooked.has(i)) {
                                    cottagesBooked.add(i);
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            const totalCottages = 4;
            const cottageCount = Math.min(cottagesBooked.size, totalCottages);
            const occupancyPct = Math.min(100, Math.max(25, Math.round((cottageCount / totalCottages) * 100)));

            return {
                total,
                pending,
                active,
                cancelled,
                grossRevenue,
                activeGuests: activeGuests || 12,
                cottageCount,
                totalCottages,
                occupancyPct
            };
        }
    };

    // Auto-initialize immediately
    ResortDB.init();

    // Export globally to window
    window.ResortDB = ResortDB;

})(typeof window !== "undefined" ? window : globalThis);
