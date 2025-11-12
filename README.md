# Rescat Storage

```
mkdir -p data
touch data/index.json
mkdir -p public/preview-bounding-box public/roi-face-cat public/result
```

# Files API — Docs (untuk Postman)

Layanan sederhana untuk **upload, list, dan hapus** file per bucket. Seluruh file statik diserve di `/files`.

---

## Base URL

* Lokal: `http://localhost:3000`
* Variabel Postman yang disarankan: `{{baseUrl}} = http://localhost:3000`

## Buckets yang diizinkan

Diset dari `.env` → `ALLOWED_BUCKETS`, contoh:

```
preview-bounding-box, roi-face-cat, result
```

## Autentikasi

Tidak ada (gunakan CORS whitelist dari `.env` bila dipanggil dari FE).

## Header umum

* `Accept: application/json`
* `Content-Type: application/json` (untuk request body JSON)
* **Upload**: `multipart/form-data` (otomatis oleh Postman saat pakai form-data)

## Format respons umum

```json
// sukses
{ "ok": true, ... }

// gagal
{ "ok": false, "error": "ERROR_CODE", "hint": "opsional" }
```

## Paging

* Query: `limit` (max 200), `cursor` (ms epoch dari `createdAt`).
* Respon list mengembalikan `nextCursor`.

---

## Endpoints

### 1) Upload satu file

**POST** `{{baseUrl}}/api/files`
Body (form-data):

* `file`: *File* (wajib)
* `bucket`: *Text* (opsional, default `preview-bounding-box`)

**Respons (200)**

```json
{
  "ok": true,
  "data": {
    "id": "uuid-v4",
    "bucket": "preview-bounding-box",
    "filename": "1731379999999-<uuid>.jpg",
    "originalName": "foto.jpg",
    "mime": "image/jpeg",
    "size": 12345,
    "createdAt": 1731379999999,
    "url": "http://localhost:3000/files/preview-bounding-box/1731379999999-<uuid>.jpg"
  }
}
```

**cURL**

```bash
curl -X POST "{{baseUrl}}/api/files" \
  -F "file=@/path/to/foto.jpg" \
  -F "bucket=preview-bounding-box"
```

---

### 2) List semua file (opsional filter bucket)

**GET** `{{baseUrl}}/api/files?bucket=preview-bounding-box&limit=50&cursor=1731379000000`

**Respons (200)**

```json
{
  "ok": true,
  "items": [ { "id": "...", "bucket": "...", "filename": "...", "createdAt": 1731379... } ],
  "nextCursor": 1731378...
}
```

---

### 3) List berdasarkan bucket (alias yang eksplisit)

**GET** `{{baseUrl}}/api/files/bucket/:bucket`
Contoh: `{{baseUrl}}/api/files/bucket/preview-bounding-box?limit=50`

**Respons (200)**

```json
{
  "ok": true,
  "bucket": "preview-bounding-box",
  "items": [ ... ],
  "nextCursor": null
}
```

---

### 4) Ambil detail file by **id**

**GET** `{{baseUrl}}/api/files/:id`

**Respons (200)**

```json
{
  "ok": true,
  "data": {
    "id": "...",
    "bucket": "...",
    "filename": "...",
    "url": "http://localhost:3000/files/<bucket>/<filename>",
    "createdAt": 1731379...
  }
}
```

---

### 5) Ambil detail file by **filename**

**GET** `{{baseUrl}}/api/files/by-name/:filename`
`filename` harus match pola aman:

```
^[0-9]{13}-[0-9a-f-]{36}\.[a-z0-9]+$
```

---

### 6) Hapus file by **filename**

**DELETE** `{{baseUrl}}/api/files/by-name/:filename`

**Respons (200)**

```json
{ "ok": true, "deleted": "1731379...-<uuid>.jpg" }
```

---

### 7) Hapus **selected** by **id[]**

**DELETE** `{{baseUrl}}/api/files/selected`
Body (raw JSON):

```json
{ "ids": ["<id-1>", "<id-2>"] }
```

**Respons (200)**

```json
{
  "ok": true,
  "requested": 2,
  "removed": 2,
  "missing": [],
  "items": [
    { "id": "<id-1>", "bucket": "preview-bounding-box", "filename": "...", "removedDisk": true },
    { "id": "<id-2>", "bucket": "roi-face-cat", "filename": "...", "removedDisk": true }
  ]
}
```

---

### 8) Kosongkan **bucket** (hapus semua isi bucket)

**DELETE** `{{baseUrl}}/api/files/bucket/:bucket`

**Respons (200)**

```json
{
  "ok": true,
  "bucket": "roi-face-cat",
  "count": 12,
  "items": [
    { "id": "...", "filename": "...", "removedDisk": true }
  ]
}
```

---

### 9) **Delete ALL** (semua bucket) — destruktif!

**DELETE** `{{baseUrl}}/api/files?confirm=yes`

**Respons (200)**

```json
{
  "ok": true,
  "total": 34,
  "items": [
    { "id": "...", "bucket": "result", "filename": "...", "removedDisk": true }
  ]
}
```

---

### 10) Akses file statik (tanpa API)

**GET** `{{baseUrl}}/files/<bucket>/<filename>`
Contoh: `{{baseUrl}}/files/preview-bounding-box/1731379-<uuid>.jpg`

---

## Error Codes

* `BUCKET_NOT_ALLOWED` — bucket tidak ada di `ALLOWED_BUCKETS`
* `EXT_NOT_ALLOWED` — ekstensi tidak diizinkan
* `NO_FILE` — field `file` tidak dikirim
* `BAD_NAME` — format `filename` tidak valid
* `NOT_FOUND` — data tidak ditemukan
* `NO_IDS` — body `ids` kosong / tidak ada
* `CONFIRM_REQUIRED` — untuk delete-all wajib `?confirm=yes`
* HTTP `413` — file melebihi `MAX_FILE_MB`
* CORS `Not allowed by CORS` — origin tidak masuk whitelist

## Rate Limit

* Upload: **30 request/menit** (`/api/files` POST)

---

## Contoh cURL ringkas

**Upload**

```bash
curl -X POST "{{baseUrl}}/api/files" \
  -F "file=@/path/to/foto.jpg" \
  -F "bucket=preview-bounding-box"
```

**List by bucket**

```bash
curl "{{baseUrl}}/api/files/bucket/preview-bounding-box?limit=50"
```

**Delete selected**

```bash
curl -X DELETE "{{baseUrl}}/api/files/selected" \
  -H "Content-Type: application/json" \
  -d '{"ids":["<id-1>","<id-2>"]}'
```

**Empty bucket**

```bash
curl -X DELETE "{{baseUrl}}/api/files/bucket/roi-face-cat"
```

**Delete ALL**

```bash
curl -X DELETE "{{baseUrl}}/api/files?confirm=yes"
```

---

## Postman Collection (import JSON)

> Import JSON ini ke Postman → otomatis membuat request siap pakai.
> Setelah import, set `baseUrl` env var ke `http://localhost:3000`.

```json
{
  "info": {
    "name": "Files API (ResCat Content Service)",
    "_postman_id": "f3a9f7b2-8a7e-4c3d-9d1e-{{randomInt}}",
    "description": "Koleksi endpoint upload/list/delete file per bucket.",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:3000" },
    { "key": "bucket", "value": "preview-bounding-box" },
    { "key": "id", "value": "" },
    { "key": "filename", "value": "" },
    { "key": "id1", "value": "" },
    { "key": "id2", "value": "" }
  ],
  "item": [
    {
      "name": "Health",
      "request": { "method": "GET", "url": "{{baseUrl}}/" }
    },
    {
      "name": "Upload one (form-data)",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "formdata",
          "formdata": [
            { "key": "file", "type": "file", "src": "/absolute/path/to/file.jpg" },
            { "key": "bucket", "type": "text", "value": "{{bucket}}" }
          ]
        },
        "url": "{{baseUrl}}/api/files"
      }
    },
    {
      "name": "List (all or ?bucket=)",
      "request": {
        "method": "GET",
        "url": { "raw": "{{baseUrl}}/api/files?bucket={{bucket}}&limit=50", "host": ["{{baseUrl}}"], "path": ["api","files"], "query": [
          { "key": "bucket", "value": "{{bucket}}" },
          { "key": "limit", "value": "50" }
        ]}
      }
    },
    {
      "name": "List by bucket",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/files/bucket/{{bucket}}?limit=50"
      }
    },
    {
      "name": "Get by id",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/files/{{id}}"
      }
    },
    {
      "name": "Get by filename",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/files/by-name/{{filename}}"
      }
    },
    {
      "name": "Delete by filename",
      "request": {
        "method": "DELETE",
        "url": "{{baseUrl}}/api/files/by-name/{{filename}}"
      }
    },
    {
      "name": "Delete selected (ids[])",
      "request": {
        "method": "DELETE",
        "header": [{ "key": "Content-Type", "value": "application/json" }],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"ids\": [\"{{id1}}\", \"{{id2}}\"]\n}"
        },
        "url": "{{baseUrl}}/api/files/selected"
      }
    },
    {
      "name": "Empty bucket",
      "request": {
        "method": "DELETE",
        "url": "{{baseUrl}}/api/files/bucket/{{bucket}}"
      }
    },
    {
      "name": "Delete ALL (confirm=yes)",
      "request": {
        "method": "DELETE",
        "url": "{{baseUrl}}/api/files?confirm=yes"
      }
    },
    {
      "name": "Static file (preview)",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/files/{{bucket}}/{{filename}}"
      }
    }
  ]
}
```

> Tips: untuk request **Upload**, ganti nilai `src` dengan path file di komputermu. Untuk Windows, gunakan path absolut seperti `C:\\Users\\bayu\\Pictures\\kucing.jpg`.
