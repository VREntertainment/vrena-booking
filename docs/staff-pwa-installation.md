# VRena Staff installation (online only)

Open https://booking.vre-vietnam.com/staff or the booking calendar in Chrome on the Samsung A26. Use the browser menu → Add to Home screen / Install app. The installed app is named **VRena Staff** and opens the existing staff console. Long-press its home-screen icon for **Staff console** and **Booking calendar** shortcuts (where supported).

Staff sign in through the existing authentication and MFA flow. Venue restrictions continue to apply. Calendar shortcuts omit dates and venues so the existing application selects the current week and permitted location.

This release adds only manifest metadata, existing-brand icons and launch shortcuts. It adds no service worker, cache, offline screens, background sync or queued bookings. The existing notification worker is unchanged. An internet connection remains necessary for all booking and staff operations.

The ordinary customer booking pages retain a separate **VRena Booking** manifest starting at /tickets.
