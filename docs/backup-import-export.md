# Database backup — Export / Import flow

Yaad rakhne wali cheez: **backup = data only**. Schema (columns/tables) migrations se aati hai.

## Kahan se

**Settings** (owner only) → **Database backup** panel

- **Export database** → JSON file download (`gpos-backup-YYYY-mm-dd-….json`)
- **Import backup** → same file upload + confirm box mein `RESTORE`

API (owner token):

| Action | Method | Path |
|--------|--------|------|
| Export | `GET` | `/api/v1/settings/backup/export` |
| Import | `POST` | `/api/v1/settings/backup/import` (`file` + `confirm=RESTORE`) |

Code: `DatabaseBackupService`, `BackupController`.

---

## Export kya leta hai

Poori business DB rows (JSON):

- users, stores, settings
- products, categories, stock movements / write-offs
- customers + khata ledger
- vendors, contacts, purchases/GRN, payables, purchase returns
- sales, payments, sale returns
- expenses + categories
- till sessions, tasks, sync_log

**Skip** (noise / ephemeral):

- `cache`, `jobs`, `sessions`, `migrations`, `personal_access_tokens`

Format marker: `"format": "gpos_backup"`, `"version": 1`.

---

## Import — wipe, merge nahi

Jab import chalta hai:

1. Covered tables pe **purana data wipe**
2. File ke rows **insert**
3. End result ≈ **file jaisi DB** (local pe pehle jo tha, gayab)

Example: local 50 products, backup mein 200 → import ke baad **200**. Merge nahi.

Import ke baad **login tokens clear** → dobara login zaroori.

Confirm phrase (case-sensitive): `RESTORE`

---

## Zaroori step — migrate after import

Backup **schema update nahi** karti.

Agar code mein nayi column/table hai (jaise `sale_payments.reference_id`) lekin restore wali DB purani hai, to sale fail ho sakti hai:

```text
Undefined column: reference_id of relation sale_payments
```

**Har import ke baad** (local ya kahi bhi jahan yeh backend chalta ho):

```bash
cd backend
php artisan migrate --force
```

Pending migrations check:

```bash
php artisan migrate:status
```

---

## Typical flows

### A) Prod → local test

1. Prod Settings → **Export database** → `.json` save
2. Local frontend API = `http://localhost:8000/api/v1` (`.env.local`)
3. Local Settings → **Import backup** → `RESTORE`
4. Local: `php artisan migrate --force`
5. Dobara login (prod wale email/password — hashes backup mein aate hain)
6. Agar kisi user ka `store_id` null dikhe to store assign karo (rare edge)

### B) Local → prod (danger)

Sirf jab **sach mein** prod ko backup se replace karna ho.

1. Pehle prod pe **Export** lo (safety copy)
2. Import + `RESTORE`
3. Server pe: `php artisan migrate --force`
4. Sab users re-login

Galati se merge expect mat karna — **full replace** hai.

### C) Sirf schema / code update (data same)

Backup ki zaroorat nahi — normal deploy:

```bash
sudo bash /opt/gpos/deploy/update.sh
# andar migrate --force already hai
```

---

## Local vs prod API

| Environment | Frontend API base |
|-------------|-------------------|
| Local test | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1` in `frontend/.env.local` |
| Production | `/api/v1` (same host) |

Galat API pe login/backup dusri machine ki DB touch karega.

---

## Checklist (copy/paste)

```text
[ ] Export pehle lo (kisi bhi import se pehle)
[ ] Import = wipe + replace (merge nahi)
[ ] Confirm: RESTORE
[ ] Import ke baad: php artisan migrate --force
[ ] Dobara login
[ ] Sale / POS smoke test
```

---

## Related

- Deploy: [`DEPLOY.md`](./DEPLOY.md)
- Settings UI: `frontend/src/app/settings/page.tsx`
- Service: `backend/app/Support/DatabaseBackupService.php`
