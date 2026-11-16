# Notes for AI assistants working on this repo

## Writing UI text (Thai and English)

The owner has asked for this several times. Follow it on every change.

**Do not use "·" or "—" as separators** anywhere a user can see text:
translations in `server/public/assets/js/app.js`, fallback text in `server/views/**/*.ejs`,
strings built in page scripts, emails, PDFs, and Excel exports.

| Don't write | Write instead |
|---|---|
| `ดีมาก · 22 คำตอบ` | Two separate elements with a gap (or a pill + text). The layout does the separating. |
| `ไม่สามารถเก็บถาวรได้ — ผู้ขอที่…` | `ไม่สามารถเก็บถาวรได้ ผู้ขอที่…` (Thai: just a space, or a new sentence) |
| `Can't archive — this is the last…` | `Can't archive: this is the last…` or two sentences |
| `— เลือก —`, `— ไม่ระบุ —` | `เลือก`, `ไม่ระบุ` |
| `Claim Code: X · …` | Spacing or separate lines |

Still fine:
- Ranges such as `จันทร์-ศุกร์`, `09:00-15:00`, `1-5`.
- A lone `—` alone in an empty table cell, meaning "no value".
- `/` inside a label such as `ค้นหา / รายการทั้งหมด`.
- Dashes in code comments.

Before you finish a UI change, search the strings you added for `·` and ` — `.

## Other standing preferences
- Keep screens short and simple. The owner reacts badly to cluttered or "overflowing" layouts (`ล้น`, `รก`). Prefer fewer words, aligned rows, and one clear action.
- Buttons should match the existing buttons. Avoid tiny pill-shaped buttons that look different from the rest.
- Every user-facing string needs both `th` and `en`, kept in `TRANSLATIONS` in `app.js`.
- The owner commits and pushes themselves. Never run `git commit` or `git push`; hand them the commands.
