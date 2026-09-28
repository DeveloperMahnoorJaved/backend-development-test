# Backend Development Test (Next.js)

    npm install
    npm run dev      -> http://localhost:3000

## Flow
1. Instructions page  ->  2. Student details (Name, Roll No, Course)  ->  3. Test  ->  4. Result
- "Test" and "Result" tabs at the top. The Result tab is protected by a teacher password.
- Change the password in `app/config.js` (TEACHER_PASSWORD).
- Results are never deleted by the app. Same roll no cannot submit twice.
- Result tab has a "Download CSV" button.

## Where results are saved
- Always: in the browser (localStorage) of the device used for the test.
- All devices in one place: connect an Upstash Redis / Vercel KV database to the Vercel project
  (env vars UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL + KV_REST_API_TOKEN).
  The app then saves every result on the server automatically.

Edit questions in `app/questions.js` (correct answer always first).
