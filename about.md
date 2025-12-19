# About ResCAT Storage

## Deskripsi Aplikasi

**ResCAT Storage** adalah layanan penyimpanan file (file storage service) yang dibangun dengan Express.js untuk mengelola gambar dan file lainnya dalam sistem ResCAT. Aplikasi ini berfungsi sebagai backend storage yang menyediakan REST API untuk operasi upload, list, get, dan delete file dengan sistem bucket/folder terorganisir.

## Fitur Utama

### 1. **Upload File**
- Upload file dengan validasi ekstensi (jpg, jpeg, png, dll)
- Pembatasan ukuran file (konfigurasi melalui environment variable)
- Automatic file naming dengan timestamp dan UUID untuk menghindari konflik
- Metadata tracking untuk setiap file yang diupload

### 2. **Bucket Management**
- Organisasi file dalam bucket/folder yang berbeda:
  - `preview-bounding-box` - untuk preview hasil deteksi
  - `roi-face-cat` - untuk region of interest wajah kucing
  - `result` - untuk hasil akhir
  - `original-photo` - untuk foto asli
  - `right_eye_crop` - untuk crop mata kanan
- Validasi bucket sebelum operasi file

### 3. **File Operations**
- **List Files**: Mendapatkan daftar file dengan pagination (limit & cursor)
- **Get by ID**: Mengambil metadata file berdasarkan ID unik
- **Get by Filename**: Mengambil metadata file berdasarkan nama file
- **Delete**: Menghapus file individual atau batch delete
- **Empty Bucket**: Mengosongkan seluruh isi bucket tertentu

### 4. **Static File Serving**
- Semua file dapat diakses secara public melalui endpoint `/files/:bucket/:filename`
- Optimized caching dengan ETags dan immutable headers
- Response compression untuk performa lebih baik

### 5. **Security & Performance**
- CORS whitelist untuk domain tertentu
- Helmet.js untuk security headers
- Rate limiting untuk mencegah abuse
- Compression untuk response optimization
- Morgan logging untuk monitoring

## Teknologi Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js v5
- **File Upload**: Multer v2
- **Security**: Helmet, CORS, Rate Limiting
- **Performance**: Compression middleware
- **Logging**: Morgan

## Struktur Data

Setiap file yang diupload memiliki metadata:
```json
{
  "id": "unique-uuid",
  "bucket": "bucket-name",
  "filename": "timestamp-uuid.ext",
  "originalName": "nama-asli-file.jpg",
  "mime": "image/jpeg",
  "size": 1234567,
  "createdAt": 1703001234567,
  "url": "http://domain.com/files/bucket/filename"
}
```

## Use Case

Aplikasi ini digunakan dalam ekosistem ResCAT untuk:
1. Menyimpan foto kucing yang diupload user
2. Menyimpan hasil crop/ROI dari proses deteksi wajah dan mata kucing
3. Menyimpan preview bounding box hasil machine learning
4. Menyimpan hasil akhir klasifikasi/analisis

## API Endpoints

- `POST /api/files` - Upload file baru
- `GET /api/files` - List semua file (dengan filter bucket & pagination)
- `GET /api/files/:id` - Get file metadata by ID
- `GET /api/files/by-name/:filename` - Get file metadata by filename
- `DELETE /api/files/:id` - Delete file by ID
- `DELETE /api/files/by-name/:filename` - Delete file by filename
- `DELETE /api/files/batch` - Batch delete multiple files
- `DELETE /api/files/bucket/:bucket` - Empty specific bucket
- `GET /files/:bucket/:filename` - Access static file

## Konfigurasi

Aplikasi dikonfigurasi melalui environment variables (`.env`):
- `PORT` - Port server (default: 3000)
- `ALLOWED_BUCKETS` - Bucket yang diizinkan (comma-separated)
- `ALLOWED_EXT` - Ekstensi file yang diizinkan
- `MAX_FILE_MB` - Maksimal ukuran file dalam MB
- `UPLOAD_DIR_PUBLIC` - Directory untuk public files

## Repository

GitHub: [bayufadayan/rescat-storage](https://github.com/bayufadayan/rescat-storage)
