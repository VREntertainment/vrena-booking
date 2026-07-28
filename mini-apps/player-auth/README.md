# VRena Player — Zalo Mini App

This customer-facing Mini App creates or signs in to a permanent VRena player
account using a Zalo-verified Vietnamese phone number. Email is not requested.

## Secure flow

1. The Mini App sends the current Zalo access token to
   `/api/zalo/player-auth`.
2. New players approve Zalo phone access once and accept VRena's Privacy Policy
   and Terms.
3. The server verifies the Zalo access token, decodes the one-time phone token
   with `ZALO_APP_SECRET`, and creates a normal Supabase Auth user plus a VRena
   profile.
4. The server returns a two-minute, single-use handoff URL. Only a SHA-256 hash
   of that opaque token is stored.
5. `/auth/zalo` consumes the handoff and establishes a standard persistent
   Supabase session before opening the existing VRena profile.

The Supabase service-role key and Zalo App Secret stay on the booking server.
The Mini App never receives either credential. Existing unlinked VRena accounts
are not silently taken over based only on a matching phone number.

## Local preview

```bash
npm install
npm run dev
```

Use `?preview=linked` to render the returning-player state without a Zalo mobile
runtime. The default local preview renders the new-player state.

## Build and deploy

```bash
npm run build
zmp login
zmp deploy
```

Set `VITE_API_BASE_URL` only when targeting a booking backend other than
`https://vrena-booking.vercel.app`.
