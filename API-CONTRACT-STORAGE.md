# API Contract - ResCAT Storage Service

## Overview

**Base URL**: `http://localhost:8080` (configurable via `BASE_URL` environment variable)  
**Version**: 1.0.0  
**Protocol**: HTTP/1.1  
**Content-Type**: `application/json` (except for file uploads and static file serving)

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Rate Limiting](#rate-limiting)
3. [Error Handling](#error-handling)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
   - [Upload File](#1-upload-file)
   - [List All Files](#2-list-all-files)
   - [Get File by ID](#3-get-file-by-id)
   - [Get File by Filename](#4-get-file-by-filename)
   - [Get Files by Bucket](#5-get-files-by-bucket)
   - [Delete File by Filename](#6-delete-file-by-filename)
   - [Delete Selected Files (Batch)](#7-delete-selected-files-batch)
   - [Delete All Files in Bucket](#8-delete-all-files-in-bucket)
   - [Delete All Files](#9-delete-all-files)
   - [Access Static File](#10-access-static-file)
6. [Configuration](#configuration)
7. [Allowed Values](#allowed-values)

---

## Authentication & Authorization

**Current Status**: No authentication required (Public API)

> ⚠️ **Note**: All endpoints are currently public. Consider implementing authentication for production use.

---

## Rate Limiting

### Upload Endpoint Rate Limit

- **Endpoint**: `POST /api/files`
- **Window**: 60 seconds (1 minute)
- **Max Requests**: 30 requests per window
- **Headers Sent**:
  - `RateLimit-Limit`: Maximum number of requests
  - `RateLimit-Remaining`: Number of requests remaining
  - `RateLimit-Reset`: Time when the rate limit resets

### Other Endpoints

No rate limiting applied to other endpoints in current implementation.

---

## Error Handling

### Error Response Format

```json
{
  "ok": false,
  "error": "ERROR_CODE",
  "hint": "Optional hint message (for some errors)"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `EXT_NOT_ALLOWED` | 400 | File extension is not allowed |
| `BUCKET_NOT_ALLOWED` | 400 | Bucket name is not in the allowed list |
| `NO_FILE` | 400 | No file was uploaded |
| `BAD_NAME` | 400 | Filename format is invalid |
| `NO_IDS` | 400 | No IDs provided for batch operation |
| `CONFIRM_REQUIRED` | 400 | Confirmation parameter missing |
| `NOT_FOUND` | 404 | Resource not found |
| `FILE_TOO_LARGE` | 413 | File size exceeds maximum limit |

---

## Data Models

### FileMetadata Object

Represents metadata for an uploaded file.

```typescript
interface FileMetadata {
  id: string;              // UUID v4 format
  bucket: string;          // Bucket name (folder)
  filename: string;        // Generated filename: timestamp-uuid.ext
  originalName: string;    // Original uploaded filename
  mime: string;            // MIME type (e.g., "image/jpeg")
  size: number;            // File size in bytes
  createdAt: number;       // Unix timestamp in milliseconds
  url?: string;            // Public URL (included in responses)
}
```

**Example:**

```json
{
  "id": "e885901c-02af-4dc7-883b-1333bbf10f7c",
  "bucket": "original-photo",
  "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
  "originalName": "cat-image.png",
  "mime": "image/png",
  "size": 653132,
  "createdAt": 1765075391163,
  "url": "http://localhost:8080/files/original-photo/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png"
}
```

### Pagination Object

Used in list responses.

```typescript
interface PaginationResponse {
  data: FileMetadata[];    // Array of file metadata
  hasNext: boolean;        // Whether there are more items
  cursor?: string;         // Next cursor for pagination (if hasNext is true)
}
```

---

## API Endpoints

### 1. Upload File

Upload a single file to a specific bucket.

**Endpoint**: `POST /api/files`  
**Content-Type**: `multipart/form-data`  
**Rate Limited**: Yes (30 requests per minute)

#### Request

**Form Data Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | The file to upload |
| `bucket` | String | No | Target bucket name (default: `preview-bounding-box`) |

**Example (cURL)**:

```bash
curl -X POST http://localhost:8080/api/files \
  -F "file=@/path/to/cat.jpg" \
  -F "bucket=original-photo"
```

**Example (JavaScript/Fetch)**:

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('bucket', 'original-photo');

fetch('http://localhost:8080/api/files', {
  method: 'POST',
  body: formData
})
  .then(res => res.json())
  .then(data => console.log(data));
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "e885901c-02af-4dc7-883b-1333bbf10f7c",
    "bucket": "original-photo",
    "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.jpg",
    "originalName": "cat.jpg",
    "mime": "image/jpeg",
    "size": 653132,
    "createdAt": 1765075391163,
    "url": "http://localhost:8080/files/original-photo/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.jpg"
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid extension:

```json
{
  "ok": false,
  "error": "EXT_NOT_ALLOWED"
}
```

**400 Bad Request** - Invalid bucket:

```json
{
  "ok": false,
  "error": "BUCKET_NOT_ALLOWED"
}
```

**400 Bad Request** - No file:

```json
{
  "ok": false,
  "error": "NO_FILE"
}
```

**413 Payload Too Large** - File too large:

```json
{
  "ok": false,
  "error": "FILE_TOO_LARGE"
}
```

---

### 2. List All Files

Retrieve a paginated list of files, optionally filtered by bucket.

**Endpoint**: `GET /api/files`

#### Request

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `bucket` | String | No | - | Filter by bucket name |
| `limit` | Number | No | 50 | Number of items per page (max: 200) |
| `cursor` | String | No | - | Pagination cursor from previous response |

**Example Requests**:

```bash
# Get all files (first page)
GET /api/files

# Get files from specific bucket
GET /api/files?bucket=original-photo

# Get with custom limit
GET /api/files?limit=20

# Get next page using cursor
GET /api/files?cursor=1765075391163&limit=20

# Combine filters
GET /api/files?bucket=roi-face-cat&limit=10&cursor=1765075391163
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "e885901c-02af-4dc7-883b-1333bbf10f7c",
      "bucket": "original-photo",
      "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
      "originalName": "cat.png",
      "mime": "image/png",
      "size": 653132,
      "createdAt": 1765075391163,
      "url": "http://localhost:8080/files/original-photo/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png"
    },
    {
      "id": "ab369cb7-7be8-44e6-819d-44c0a2b8a8b1",
      "bucket": "original-photo",
      "filename": "1764920819521-8e098d92-35de-4834-a0da-3ced898fc93a.jpg",
      "originalName": "cat2.jpg",
      "mime": "image/jpeg",
      "size": 153342,
      "createdAt": 1764920819530,
      "url": "http://localhost:8080/files/original-photo/1764920819521-8e098d92-35de-4834-a0da-3ced898fc93a.jpg"
    }
  ],
  "hasNext": true,
  "cursor": "1764920819530"
}
```

**Response without more pages**:

```json
{
  "ok": true,
  "data": [
    // ... file objects
  ],
  "hasNext": false
}
```

#### Error Responses

**400 Bad Request** - Invalid bucket:

```json
{
  "ok": false,
  "error": "BUCKET_NOT_ALLOWED"
}
```

---

### 3. Get File by ID

Retrieve file metadata by unique ID.

**Endpoint**: `GET /api/files/:id`

#### Request

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | String (UUID) | Unique file identifier |

**Example**:

```bash
GET /api/files/e885901c-02af-4dc7-883b-1333bbf10f7c
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "e885901c-02af-4dc7-883b-1333bbf10f7c",
    "bucket": "original-photo",
    "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
    "originalName": "cat.png",
    "mime": "image/png",
    "size": 653132,
    "createdAt": 1765075391163,
    "url": "http://localhost:8080/files/original-photo/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png"
  }
}
```

#### Error Responses

**404 Not Found**:

```json
{
  "ok": false,
  "error": "NOT_FOUND"
}
```

---

### 4. Get File by Filename

Retrieve file metadata by filename.

**Endpoint**: `GET /api/files/by-name/:filename`

#### Request

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `filename` | String | Generated filename (format: `{timestamp}-{uuid}.{ext}`) |

**Filename Format**: Must match pattern `^[0-9]{13}-[0-9a-f-]{36}\.[a-z0-9]+$`

**Example**:

```bash
GET /api/files/by-name/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "e885901c-02af-4dc7-883b-1333bbf10f7c",
    "bucket": "original-photo",
    "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
    "originalName": "cat.png",
    "mime": "image/png",
    "size": 653132,
    "createdAt": 1765075391163,
    "url": "http://localhost:8080/files/original-photo/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png"
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid filename format:

```json
{
  "ok": false,
  "error": "BAD_NAME"
}
```

**404 Not Found**:

```json
{
  "ok": false,
  "error": "NOT_FOUND"
}
```

---

### 5. Get Files by Bucket

Retrieve paginated list of files from a specific bucket.

**Endpoint**: `GET /api/files/bucket/:bucket`

#### Request

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `bucket` | String | Bucket name |

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | Number | No | 50 | Number of items per page (max: 200) |
| `cursor` | String | No | - | Pagination cursor |

**Example**:

```bash
GET /api/files/bucket/original-photo
GET /api/files/bucket/roi-face-cat?limit=20
GET /api/files/bucket/result?limit=10&cursor=1764920819530
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "bucket": "original-photo",
  "data": [
    {
      "id": "e885901c-02af-4dc7-883b-1333bbf10f7c",
      "bucket": "original-photo",
      "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
      "originalName": "cat.png",
      "mime": "image/png",
      "size": 653132,
      "createdAt": 1765075391163,
      "url": "http://localhost:8080/files/original-photo/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png"
    }
  ],
  "hasNext": false
}
```

#### Error Responses

**400 Bad Request** - Invalid bucket:

```json
{
  "ok": false,
  "error": "BUCKET_NOT_ALLOWED"
}
```

---

### 6. Delete File by Filename

Delete a single file using its filename.

**Endpoint**: `DELETE /api/files/by-name/:filename`

#### Request

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `filename` | String | Generated filename |

**Example**:

```bash
DELETE /api/files/by-name/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "deleted": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png"
}
```

#### Error Responses

**400 Bad Request** - Invalid filename:

```json
{
  "ok": false,
  "error": "BAD_NAME"
}
```

**404 Not Found**:

```json
{
  "ok": false,
  "error": "NOT_FOUND"
}
```

---

### 7. Delete Selected Files (Batch)

Delete multiple files by their IDs in a single request.

**Endpoint**: `DELETE /api/files/selected`  
**Content-Type**: `application/json`

#### Request

**Body Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | String[] | Yes | Array of file IDs to delete |

**Example**:

```bash
DELETE /api/files/selected
Content-Type: application/json

{
  "ids": [
    "e885901c-02af-4dc7-883b-1333bbf10f7c",
    "ab369cb7-7be8-44e6-819d-44c0a2b8a8b1",
    "non-existent-id-123"
  ]
}
```

**JavaScript Example**:

```javascript
fetch('http://localhost:8080/api/files/selected', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ids: [
      'e885901c-02af-4dc7-883b-1333bbf10f7c',
      'ab369cb7-7be8-44e6-819d-44c0a2b8a8b1'
    ]
  })
});
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "requested": 3,
  "removed": 2,
  "missing": ["non-existent-id-123"],
  "items": [
    {
      "id": "e885901c-02af-4dc7-883b-1333bbf10f7c",
      "bucket": "original-photo",
      "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
      "removedDisk": true
    },
    {
      "id": "ab369cb7-7be8-44e6-819d-44c0a2b8a8b1",
      "bucket": "roi-face-cat",
      "filename": "1764920819521-8e098d92-35de-4834-a0da-3ced898fc93a.jpg",
      "removedDisk": true
    }
  ]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `requested` | Number | Total number of IDs requested for deletion |
| `removed` | Number | Number of files successfully removed from index |
| `missing` | String[] | Array of IDs that were not found in index |
| `items` | Object[] | Details of files that were deleted |
| `items[].removedDisk` | Boolean | Whether the physical file was removed from disk |

#### Error Responses

**400 Bad Request** - No IDs provided:

```json
{
  "ok": false,
  "error": "NO_IDS"
}
```

---

### 8. Delete All Files in Bucket

Empty a specific bucket (delete all files in a bucket).

**Endpoint**: `DELETE /api/files/bucket/:bucket`

#### Request

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `bucket` | String | Bucket name to empty |

**Example**:

```bash
DELETE /api/files/bucket/preview-bounding-box
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "bucket": "preview-bounding-box",
  "count": 5,
  "items": [
    {
      "id": "file-id-1",
      "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
      "removedDisk": true
    },
    {
      "id": "file-id-2",
      "filename": "1764920819521-8e098d92-35de-4834-a0da-3ced898fc93a.jpg",
      "removedDisk": true
    }
    // ... more items
  ]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `bucket` | String | Name of the bucket that was emptied |
| `count` | Number | Total number of files deleted |
| `items` | Object[] | Details of each deleted file |
| `items[].removedDisk` | Boolean | Whether the physical file was removed |

#### Error Responses

**400 Bad Request** - Invalid bucket:

```json
{
  "ok": false,
  "error": "BUCKET_NOT_ALLOWED"
}
```

---

### 9. Delete All Files

Delete all files from all buckets (nuclear option).

**Endpoint**: `DELETE /api/files`

⚠️ **DANGEROUS OPERATION** - This will delete ALL files from ALL buckets!

#### Request

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `confirm` | String | Yes | Must be exactly `yes` (case-insensitive) |

**Example**:

```bash
DELETE /api/files?confirm=yes
```

#### Success Response

**Status Code**: `200 OK`

```json
{
  "ok": true,
  "total": 50,
  "items": [
    {
      "id": "file-id-1",
      "bucket": "original-photo",
      "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
      "removedDisk": true
    },
    {
      "id": "file-id-2",
      "bucket": "roi-face-cat",
      "filename": "1764920819521-8e098d92-35de-4834-a0da-3ced898fc93a.jpg",
      "removedDisk": false
    }
    // ... all deleted files
  ]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `total` | Number | Total number of files deleted |
| `items` | Object[] | Details of all deleted files |
| `items[].bucket` | String | Bucket where the file was stored |
| `items[].removedDisk` | Boolean | Whether physical file was removed |

#### Error Responses

**400 Bad Request** - Missing confirmation:

```json
{
  "ok": false,
  "error": "CONFIRM_REQUIRED",
  "hint": "Add ?confirm=yes"
}
```

---

### 10. Access Static File

Retrieve the actual file content (image, PDF, etc.).

**Endpoint**: `GET /files/:bucket/:filename`

This endpoint serves the actual file content with appropriate headers for caching and content type.

#### Request

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `bucket` | String | Bucket name |
| `filename` | String | Generated filename |

**Example**:

```bash
GET /files/original-photo/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png
```

**HTML Image Tag**:

```html
<img src="http://localhost:8080/files/original-photo/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png" 
     alt="Cat photo">
```

#### Success Response

**Status Code**: `200 OK`

**Headers**:
- `Content-Type`: Appropriate MIME type (e.g., `image/jpeg`, `image/png`, `application/pdf`)
- `Cache-Control`: `public, max-age=31536000, immutable`
- `ETag`: File hash for caching
- `Content-Length`: File size in bytes

**Body**: Binary file content

#### Error Responses

**404 Not Found** - File doesn't exist:

Returns HTML 404 page or empty response depending on configuration.

---

## Configuration

### Environment Variables

The service is configured through environment variables, typically stored in a `.env` file:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | String | `8080` | Port number for the server |
| `BASE_URL` | String | `http://localhost:8080` | Base URL for generating file URLs |
| `UPLOAD_DIR_PUBLIC` | String | `public` | Directory path for storing uploaded files |
| `ALLOWED_BUCKETS` | String (CSV) | See below | Comma-separated list of allowed bucket names |
| `ALLOWED_EXT` | String (CSV) | `jpg,jpeg,png,webp,pdf` | Comma-separated list of allowed file extensions |
| `MAX_FILE_MB` | Number | `8` | Maximum file size in megabytes |
| `ALLOWED_ORIGINS` | String (CSV) | Empty | Comma-separated list of allowed CORS origins |

**Example `.env` file**:

```env
PORT=8080
BASE_URL=http://localhost:8080
UPLOAD_DIR_PUBLIC=public
ALLOWED_BUCKETS=preview-bounding-box,roi-face-cat,result,original-photo,right_eye_crop,remove-bg
ALLOWED_EXT=jpg,jpeg,png,webp,pdf
MAX_FILE_MB=8
ALLOWED_ORIGINS=http://localhost:3000,https://myapp.com
```

---

## Allowed Values

### Default Allowed Buckets

| Bucket Name | Purpose |
|-------------|---------|
| `preview-bounding-box` | Preview images with bounding box overlays from ML detection |
| `roi-face-cat` | Region of Interest - cropped cat face images |
| `result` | Final processed/classified images |
| `original-photo` | Original uploaded cat photos |
| `right_eye_crop` | Cropped images of cat's right eye |
| `remove-bg` | Images with background removed |

### Default Allowed File Extensions

| Extension | MIME Type | Description |
|-----------|-----------|-------------|
| `jpg` | `image/jpeg` | JPEG image |
| `jpeg` | `image/jpeg` | JPEG image (alternative extension) |
| `png` | `image/png` | PNG image with transparency support |
| `webp` | `image/webp` | WebP image format |
| `pdf` | `application/pdf` | PDF document |

---

## Database Schema

The service uses a simple JSON file (`data/index.json`) as a database for file metadata.

### File Index Structure

**File**: `data/index.json`  
**Format**: JSON Array

```json
[
  {
    "id": "e885901c-02af-4dc7-883b-1333bbf10f7c",
    "bucket": "original-photo",
    "filename": "1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png",
    "originalName": "cat-photo.png",
    "mime": "image/png",
    "size": 653132,
    "createdAt": 1765075391163
  },
  {
    "id": "ab369cb7-7be8-44e6-819d-44c0a2b8a8b1",
    "bucket": "right_eye_crop",
    "filename": "1764920819521-8e098d92-35de-4834-a0da-3ced898fc93a.jpg",
    "originalName": "cat-eye.jpg",
    "mime": "image/jpeg",
    "size": 153342,
    "createdAt": 1764920819530
  }
]
```

### Field Descriptions

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | UUID v4, Unique, Indexed | Unique identifier for the file |
| `bucket` | String | Must be in `ALLOWED_BUCKETS` | Bucket/folder name |
| `filename` | String | Pattern: `{timestamp}-{uuid}.{ext}`, Unique | Generated filename on disk |
| `originalName` | String | - | Original filename from upload |
| `mime` | String | Valid MIME type | Content type of the file |
| `size` | Number | > 0, < MAX_FILE_MB * 1024 * 1024 | File size in bytes |
| `createdAt` | Number | Unix timestamp (milliseconds) | Upload timestamp |

### Indexing Strategy

The application maintains in-memory indexes for fast lookups:

1. **ID Index**: `Map<string, FileMetadata>` - O(1) lookup by ID
2. **Filename Index**: `Map<string, FileMetadata>` - O(1) lookup by filename
3. **Bucket Index**: `Map<string, FileMetadata[]>` - O(1) lookup by bucket

---

## Filename Generation

### Format

```
{timestamp}-{uuid}.{extension}
```

### Components

| Component | Description | Example |
|-----------|-------------|---------|
| `timestamp` | Unix timestamp in milliseconds (13 digits) | `1765075391111` |
| `uuid` | UUID v4 (36 characters with hyphens) | `8993b505-1875-4d00-a03c-d41c2d456fd1` |
| `extension` | Original file extension (lowercase) | `png` |

### Example Filenames

```
1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png
1764920819521-8e098d92-35de-4834-a0da-3ced898fc93a.jpg
1765123456789-a1b2c3d4-5678-90ab-cdef-1234567890ab.webp
```

### Validation Regex

```regex
^[0-9]{13}-[0-9a-f-]{36}\.[a-z0-9]+$
```

---

## File System Structure

### Directory Layout

```
public/
├── preview-bounding-box/
│   ├── 1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png
│   └── ...
├── roi-face-cat/
│   ├── 1764920819521-8e098d92-35de-4834-a0da-3ced898fc93a.jpg
│   └── ...
├── result/
│   └── ...
├── original-photo/
│   └── ...
├── right_eye_crop/
│   └── ...
└── remove-bg/
    └── ...
```

Each bucket has its own subdirectory under the configured `UPLOAD_DIR_PUBLIC` (default: `public/`).

---

## CORS Configuration

### Allowed Origins

Configure allowed origins via `ALLOWED_ORIGINS` environment variable:

```env
ALLOWED_ORIGINS=http://localhost:3000,https://myapp.com,https://admin.myapp.com
```

### CORS Headers

**Preflight Response Headers**:
- `Access-Control-Allow-Origin`: Requesting origin (if whitelisted) or `*`
- `Access-Control-Allow-Methods`: `GET, POST, DELETE, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type, Authorization`
- `Access-Control-Max-Age`: `86400` (24 hours)

---

## Security Headers

Applied via Helmet.js middleware:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## Compression

Response compression is enabled for all text-based responses (JSON, HTML, etc.) to reduce bandwidth usage.

**Supported Algorithms**:
- gzip
- deflate
- br (Brotli)

---

## Logging

### Morgan Logging Format

```
:method :url :status :res[content-length] - :response-time ms
```

**Example Log Entries**:

```
POST /api/files 200 456 - 45.123 ms
GET /api/files?bucket=original-photo 200 1234 - 12.456 ms
DELETE /api/files/bucket/roi-face-cat 200 567 - 234.567 ms
```

---

## HTTP Status Codes Summary

| Status Code | Meaning | Usage |
|-------------|---------|-------|
| `200 OK` | Success | Successful GET, POST, DELETE operations |
| `400 Bad Request` | Client error | Invalid input, missing parameters, validation errors |
| `404 Not Found` | Resource not found | File or resource doesn't exist |
| `413 Payload Too Large` | File too large | File size exceeds `MAX_FILE_MB` |
| `429 Too Many Requests` | Rate limited | Upload rate limit exceeded |
| `500 Internal Server Error` | Server error | Unexpected server errors |

---

## Example Workflows

### Workflow 1: Upload and Retrieve Image

```javascript
// 1. Upload file
const formData = new FormData();
formData.append('file', imageFile);
formData.append('bucket', 'original-photo');

const uploadRes = await fetch('http://localhost:8080/api/files', {
  method: 'POST',
  body: formData
});

const uploadData = await uploadRes.json();
console.log('File ID:', uploadData.data.id);
console.log('File URL:', uploadData.data.url);

// 2. Display image
document.getElementById('myImage').src = uploadData.data.url;

// 3. Later, retrieve metadata
const metaRes = await fetch(`http://localhost:8080/api/files/${uploadData.data.id}`);
const metaData = await metaRes.json();
console.log('File metadata:', metaData.data);
```

### Workflow 2: List and Delete Files

```javascript
// 1. List files from specific bucket
const listRes = await fetch('http://localhost:8080/api/files/bucket/roi-face-cat?limit=20');
const listData = await listRes.json();

console.log(`Found ${listData.data.length} files`);

// 2. Select files to delete
const idsToDelete = listData.data.slice(0, 5).map(f => f.id);

// 3. Batch delete
const deleteRes = await fetch('http://localhost:8080/api/files/selected', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: idsToDelete })
});

const deleteData = await deleteRes.json();
console.log(`Deleted ${deleteData.removed} files`);
```

### Workflow 3: Pagination

```javascript
async function getAllFiles(bucket) {
  const allFiles = [];
  let cursor = null;
  
  do {
    const url = cursor 
      ? `http://localhost:8080/api/files?bucket=${bucket}&limit=50&cursor=${cursor}`
      : `http://localhost:8080/api/files?bucket=${bucket}&limit=50`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    allFiles.push(...data.data);
    cursor = data.hasNext ? data.cursor : null;
  } while (cursor);
  
  return allFiles;
}

// Usage
const allPhotos = await getAllFiles('original-photo');
console.log(`Total files: ${allPhotos.length}`);
```

---

## Testing Examples

### cURL Examples

```bash
# Upload file
curl -X POST http://localhost:8080/api/files \
  -F "file=@cat.jpg" \
  -F "bucket=original-photo"

# List files
curl "http://localhost:8080/api/files?bucket=original-photo&limit=10"

# Get file by ID
curl "http://localhost:8080/api/files/e885901c-02af-4dc7-883b-1333bbf10f7c"

# Get file by filename
curl "http://localhost:8080/api/files/by-name/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png"

# Delete file
curl -X DELETE "http://localhost:8080/api/files/by-name/1765075391111-8993b505-1875-4d00-a03c-d41c2d456fd1.png"

# Batch delete
curl -X DELETE http://localhost:8080/api/files/selected \
  -H "Content-Type: application/json" \
  -d '{"ids":["id1","id2","id3"]}'

# Empty bucket
curl -X DELETE "http://localhost:8080/api/files/bucket/preview-bounding-box"

# Delete all (DANGEROUS)
curl -X DELETE "http://localhost:8080/api/files?confirm=yes"
```

### Postman Collection

Import this JSON to test all endpoints:

```json
{
  "info": {
    "name": "ResCAT Storage API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:8080"
    }
  ],
  "item": [
    {
      "name": "Upload File",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/files",
        "body": {
          "mode": "formdata",
          "formdata": [
            {"key": "file", "type": "file"},
            {"key": "bucket", "value": "original-photo"}
          ]
        }
      }
    },
    {
      "name": "List Files",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/files?bucket=original-photo&limit=20"
      }
    },
    {
      "name": "Get File by ID",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/files/{{fileId}}"
      }
    }
  ]
}
```

---

## Performance Considerations

### Caching Strategy

1. **Static Files**: Cached with `Cache-Control: public, max-age=31536000, immutable`
2. **ETags**: Enabled for conditional requests
3. **Compression**: Automatic gzip/brotli for JSON responses

### Scalability Notes

**Current Limitations**:
- Single JSON file for metadata (not suitable for >10K files)
- No database indexing
- No distributed storage
- No transaction support

**Recommendations for Production**:
- Use PostgreSQL or MongoDB for metadata
- Implement proper indexing on `id`, `filename`, and `bucket`
- Use object storage (S3, MinIO) for files
- Add Redis for caching
- Implement proper transaction handling

---

## Changelog & Version History

### Version 1.0.0 (Current)

**Initial Release**
- Upload file with bucket support
- List files with pagination
- Get file by ID and filename
- Delete file operations (single, batch, bucket, all)
- Static file serving
- Rate limiting for uploads
- CORS and security headers
- Compression support

---

## Support & Contribution

**Repository**: [https://github.com/bayufadayan/rescat-storage](https://github.com/bayufadayan/rescat-storage)

**Issues**: Report bugs or request features via GitHub Issues

**License**: ISC

---

## Appendix: Complete Response Examples

### Upload Response (Full)

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bucket": "original-photo",
    "filename": "1765075391111-550e8400-e29b-41d4-a716-446655440000.jpg",
    "originalName": "my-cat-photo.jpg",
    "mime": "image/jpeg",
    "size": 1234567,
    "createdAt": 1765075391163,
    "url": "http://localhost:8080/files/original-photo/1765075391111-550e8400-e29b-41d4-a716-446655440000.jpg"
  }
}
```

### List Response (Full)

```json
{
  "ok": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "bucket": "original-photo",
      "filename": "1765075391111-550e8400-e29b-41d4-a716-446655440000.jpg",
      "originalName": "my-cat-photo.jpg",
      "mime": "image/jpeg",
      "size": 1234567,
      "createdAt": 1765075391163,
      "url": "http://localhost:8080/files/original-photo/1765075391111-550e8400-e29b-41d4-a716-446655440000.jpg"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "bucket": "original-photo",
      "filename": "1765075400000-660e8400-e29b-41d4-a716-446655440001.png",
      "originalName": "another-cat.png",
      "mime": "image/png",
      "size": 987654,
      "createdAt": 1765075400000,
      "url": "http://localhost:8080/files/original-photo/1765075400000-660e8400-e29b-41d4-a716-446655440001.png"
    }
  ],
  "hasNext": true,
  "cursor": "1765075400000"
}
```

### Batch Delete Response (Full)

```json
{
  "ok": true,
  "requested": 3,
  "removed": 2,
  "missing": ["non-existent-id-999"],
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "bucket": "original-photo",
      "filename": "1765075391111-550e8400-e29b-41d4-a716-446655440000.jpg",
      "removedDisk": true
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "bucket": "roi-face-cat",
      "filename": "1765075400000-660e8400-e29b-41d4-a716-446655440001.png",
      "removedDisk": true
    }
  ]
}
```

---

**Document Version**: 1.0  
**Last Updated**: December 19, 2024  
**Author**: ResCAT Development Team
