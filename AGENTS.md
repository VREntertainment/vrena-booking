<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Required device support
All present and future changes must preserve functionality and usable layouts on Windows/Chrome, macOS/Safari, iPhone/Safari, Samsung Galaxy A26 and Galaxy Fold (cover and unfolded screens).
Run the booking device matrix for UI changes, including staff console and calendar checks. Cover 320–412px phone widths, phone landscape, 768px unfolded layouts and desktop. Browser emulation is not a claim of physical-device testing.
Keep page-level horizontal overflow at zero; confine horizontal scrolling to explicit rails/tables/calendar. Keep primary touch controls at least 44px, input text readable without forced zoom, dialogs within the dynamic viewport, and sticky navigation clear of the app header.
Preserve venue isolation, capacity/payment rules, guest/account booking, localized copy and existing game metadata. Do not remove functionality to make a screen fit.
