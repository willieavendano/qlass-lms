# Alpha Testing Plan

The first alpha target is a bounded full-workflow pilot with one real class and one unit.

## Entry criteria

- App is deployed on a dynamic host with HTTPS.
- Database backups are enabled.
- Demo import works before real Google OAuth import.
- Teacher/admin accounts are confirmed.
- Privacy notice and support contact are visible.
- Export/delete path is documented.

## Pilot shape

Run Qlass as the working hub for one class and one unit:

- stream announcements
- classwork creation
- assignment submissions
- teacher feedback and grades inside Qlass
- official school gradebook remains the system of record until reliability is proven

## Student-data minimization

Use only the data required for the workflow: names, school emails, class membership, submissions, grades/feedback, and necessary attachments. Avoid sensitive notes, behavior records, or unnecessary analytics during alpha.

## Success criteria

- Two-week pilot completes without data loss.
- At least five assignments are posted and submitted.
- At least 90% of expected submissions are completed successfully.
- Teacher can export a usable record of classwork and grades.
- Students report fewer than three blocking usability issues.

## Feedback loop

Track every issue as one of: data safety, login/access, import, submission, grading, AI quality, performance, or UX friction. Convert repeat issues into GitHub issues before expanding to another class.
