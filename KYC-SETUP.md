# Manual identity verification deployment

## What is implemented

Users submit their name, Thai ID number, ID front photo and selfie holding the ID. A privileged human reviewer reads the evidence and approves or rejects with a reason. This is **manual document review**, not biometric face matching, liveness detection, government database validation or an assurance that a document is authentic.

The old 1.5-second auto-approval, forced-failure toggle, fabricated AI confidence and local KYC queue are removed. No local/mock fallback exists in this KYC flow. Legacy `users.kycStatus` approvals are not imported into the new identity system. Existing users must submit again; other prototype modules still contain simulated behavior.

## Current activation status

Backend code is prepared but has NOT been deployed or tested against this Firebase project. GitHub Pages only serves the frontend. Until the following infrastructure is configured and live smoke tests pass, the form reports service unavailable and cannot verify anyone. Do not collect real documents before activation checks pass.

## Required infrastructure (project owner)

1. Use the existing Firebase project `project-flixo-app`. Confirm billing and Cloud Functions availability with the owner before enabling paid services. Install the official Firebase CLI and authenticate locally. Never commit service-account files or tokens.
2. Create a **named Firestore database** `flixo-kyc`, ideally near `asia-southeast1`. Deploy `kyc-private.rules` to that database ONLY. It denies every browser read/write; callable functions use the Admin SDK. Do not replace the existing app database's rules with this file.
3. Create a **dedicated private Cloud Storage bucket**, separate from existing application uploads. Enable uniform bucket-level access and enforced public access prevention. Give only the deployed functions service account object read/write/delete permissions. No `allUsers`, `allAuthenticatedUsers`, download tokens or public URLs. Do not configure a public bucket as `KYC_BUCKET`. Client Storage rules must deny all if the bucket is also registered with Firebase Storage.
4. Inside `kyc-functions`, run `npm install` and `npm test`. Dependencies need to be resolved and locked in the deployment environment; dependency installation was not performed during authoring. The included tests exercise function logic with in-memory infrastructure doubles, not a live Firebase project or security-rules emulator.
5. Create untracked `kyc-functions/.env.project-flixo-app` containing:

   ```env
   KYC_ENABLED=false
   KYC_BUCKET=YOUR_DEDICATED_PRIVATE_BUCKET_NAME
   ```

6. From the repo root deploy the isolated codebase and database rules:

   ```sh
   firebase deploy --project project-flixo-app --config firebase.kyc.json --only functions:kyc,firestore
   ```

   Ensure the functions service account can access the named database and private bucket. The scheduled cleanup requires Cloud Scheduler. Do not enable intake unless the cleanup job is deployed and healthy.
7. In a trusted Admin SDK environment, grant `kycAdmin: true` to the **Firebase Authentication UID** of the chosen reviewer, preserving existing claims:

   ```js
   const user = await getAuth().getUser(reviewerUid);
   await getAuth().setCustomUserClaims(reviewerUid, { ...user.customClaims, kycAdmin: true });
   ```

   A phone number typed into the old admin screen is not sufficient. Sign out and back in to refresh the token. The reviewer cannot approve their own application. Use two distinct test accounts.
8. Enable a real Firebase sign-in provider with verified email or phone. Anonymous, local/mock OTP sessions and unverified email tokens are rejected. This change does not turn the rest of the existing login simulator into production authentication.
9. Set `KYC_ENABLED=true`, redeploy, and run the checks below with synthetic fixtures only. Verify privacy wording, support/contact process and retention policy with the owner before collecting real IDs.

## Live acceptance checks (required; not yet run)

- Unauthenticated, anonymous and ordinary users cannot call reviewer endpoints.
- Direct client reads/writes of all documents in `flixo-kyc` fail, including statuses and audit records.
- Private bucket objects are inaccessible without server IAM credentials; no public token URLs exist.
- A real authenticated applicant submits readable test images; status stays pending across reloads.
- The privileged reviewer can open both images, approve/reject, and the applicant receives the real result (refresh or within 30 seconds while visible).
- Rejection requires a reason; resubmission works. Self-review, replay decisions, duplicate submission and concurrent approvals are rejected.
- Simulate upload/storage failure: no approval is recorded; evidence is cleaned and the applicant can retry.
- Run the cleanup in a test environment: expired pending requests become rejected; approved status remains approved; files and request PII are removed. Test pending requests cannot be approved after expiry.
- Check mobile 320/390px and desktop, keyboard navigation, cancel/reopen, invalid images, long names, and offline failure. Browser visual QA has not completed in this workspace.

## Data handling

Requests and audit data are accessed only through callable functions. Evidence never goes into the public user profile, `localStorage`, source control, public download links, or application logs. Server-side image decoding rejects malformed payloads and strips metadata by re-encoding. A checksum is only a typo check, not identity verification.

The daily cleanup removes request PII/photos after 30 days from submission (up to the next successful run). Each run processes up to 100 requests: monitor backlog and scale the schedule/batch processing before volume exceeds that capacity. Decision metadata and access/decision audit entries remain private; agree a retention/deletion process for these records before production. Existing legacy PII in `users` or `kycQueue` is not deleted automatically: inventory and migrate/remove it separately with owner authorization.

Canonical status is `flixo-kyc/statuses/{firebaseAuthUid}`. All future real-money/deal APIs MUST read this server-side; the existing marketplace still uses client-side gates and must not be treated as a secure financial service. Public partner KYC badges still use legacy profile fields and require migration before production; only the current account's KYC screen uses the new canonical status. The new workflow does not silently rewrite old account identity mappings.

## Reference patterns

- Stripe verification lifecycle: https://docs.stripe.com/identity/verification-sessions
- Stripe outcome handling: https://docs.stripe.com/identity/handle-verification-outcomes
- Sumsub guided verification: https://docs.sumsub.com/docs/about-web-sdk
- Firebase authenticated callables: https://firebase.google.com/docs/functions/callable
- Server-issued reviewer claims: https://firebase.google.com/docs/auth/admin/custom-claims

These informed staged collection, review and result states. No third-party verification provider is connected or claimed.
