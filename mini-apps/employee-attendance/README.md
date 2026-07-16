# VRE HUB Zalo employee attendance

This Mini App is linked to the existing VRena HR tables. It verifies a Zalo user, links the account once to an active employee by the phone number already stored in HR, and writes clock-in/clock-out events to `public.staff_attendance_logs`.

## Security model

- The Zalo App Secret remains only in the Next.js server environment as `ZALO_APP_SECRET`.
- The Mini App sends the Zalo access token in the `Authorization` header and never receives a Supabase service key.
- Phone access is requested only when the employee explicitly chooses **Verify & link**. The one-time phone token expires after two minutes and is decoded server-side.
- Location access is requested only when an employee clocks in or out. The one-time Zalo location token is decoded server-side and the database accepts the action only inside an active workplace radius.
- Linked identities and audit events are service-role-only tables with RLS enabled.

## Configure the backend

1. Apply `supabase/migrations/20260716051802_zalo_employee_attendance.sql` and `supabase/migrations/20260716062016_zalo_attendance_geofence_settings.sql`.
2. Add `ZALO_APP_SECRET` to the Vercel/Next.js server environment. Use the secret of the parent Zalo App, not Mini App ID `2952410270374662395`.
3. Redeploy the Next.js app.
4. Ensure each employee has a unique phone number in **HR → Employees** (`personal_phone` or the linked app profile phone).

## Build the Mini App

```bash
cd mini-apps/employee-attendance
cp .env.example .env.production
npm install
npm run build
```

`VITE_API_BASE_URL` must be the HTTPS URL of the deployed Next.js app. Do not put the Zalo App Secret in any `VITE_` variable.

## Link and deploy to Zalo

Install the official CLI and authenticate with an Admin/Developer of the approved Mini App:

```bash
npm install -g zmp-cli
zmp init
zmp login
zmp deploy
```

When prompted by `zmp init`, enter Mini App ID `2952410270374662395` and choose **Using ZMP to deploy only**. For deployment, select the existing build folder `dist`.

Before publishing to employees, request/confirm the **Phone number** and **Location** Mini App permissions in Mini App Center, then submit the built version for review. The QR scanner permission is not required: the shared QR/link only opens the Mini App and employees clock in with fresh location proof. Zalo phone, location, and access-token flows must be tested inside the real Zalo app (or Device Mode), not only in a desktop browser simulator.
