# notify-approval — Email Edge Function

Sends email to the technician when their work entry is approved or rejected.

## Setup (one-time)

### 1. Sign up for Resend
Go to https://resend.com and create a free account.  
Add and verify your sending domain (e.g. `workledger.my`).  
Copy your API key.

### 2. Set secrets in Supabase
```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set FROM_EMAIL=noreply@workledger.my
supabase secrets set APP_URL=https://app.workledger.my
```

### 3. Deploy the function
```bash
supabase functions deploy notify-approval
```

### 4. Verify
Make an approval in the app — check the technician's inbox and the Supabase Edge Function logs.

## How it works

- `approveWorkEntry()` and `rejectWorkEntry()` in `workEntryService.js` call this function **fire-and-forget** after saving to the DB
- A failed email **never** blocks the approval/rejection from completing
- The function looks up the technician's email from `user_profiles` using `created_by`
- Emails are sent via Resend's REST API with a clean branded HTML template
