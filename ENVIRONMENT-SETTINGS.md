# 🔧 Environment Settings untuk Dokploy

Panduan lengkap konfigurasi environment variables di Dokploy.

## 📋 Environment Variables yang Sudah Dikonfigurasi

Environment variables sudah di-set di [`docker-compose.yml`](docker-compose.yml:1), tapi kamu bisa override di Dokploy dashboard jika perlu.

### Service: `enowxai`

```yaml
TZ=UTC
```

| Variable | Default | Deskripsi | Wajib? |
|----------|---------|-----------|--------|
| `TZ` | `UTC` | Timezone untuk logs dan timestamps | ❌ Optional |

### Service: `enowxai-shim`

```yaml
SHIM_HOST=0.0.0.0
SHIM_PORT=1432
ENOWXAI_UPSTREAM=http://enowxai:1430/v1
SHIM_MAX_RETRIES=2
```

| Variable | Default | Deskripsi | Wajib? |
|----------|---------|-----------|--------|
| `SHIM_HOST` | `0.0.0.0` | Host binding untuk shim server | ✅ Required |
| `SHIM_PORT` | `1432` | Port untuk shim server | ✅ Required |
| `ENOWXAI_UPSTREAM` | `http://enowxai:1430/v1` | URL upstream enowxai proxy | ✅ Required |
| `SHIM_MAX_RETRIES` | `2` | Max retry untuk tool calls yang truncated | ❌ Optional |

## 🚀 Cara Set Environment di Dokploy

### Option 1: Gunakan Default (Recommended)

**Tidak perlu set apa-apa!** Environment variables sudah dikonfigurasi di [`docker-compose.yml`](docker-compose.yml:1).

Dokploy akan otomatis membaca dari file compose.

### Option 2: Override di Dokploy Dashboard

Jika kamu perlu custom values:

1. **Login ke Dokploy Dashboard**
2. **Pilih Project** → `enowxai-proxy`
3. **Pilih Service** → `enowxai-stack`
4. **Tab "Environment"** atau **"Settings"**
5. **Tambah/Edit Variables**:

```
TZ=Asia/Jakarta
SHIM_MAX_RETRIES=3
```

6. **Save & Redeploy**

### Option 3: Gunakan .env File (Advanced)

Buat file `.env` di root project:

```bash
# .env
TZ=Asia/Jakarta
SHIM_MAX_RETRIES=3
```

Update [`docker-compose.yml`](docker-compose.yml:1):

```yaml
services:
  enowxai:
    env_file:
      - .env
    environment:
      - TZ=${TZ:-UTC}
```

**⚠️ PENTING:** Jangan commit `.env` ke git! Tambahkan ke [`.gitignore`](.gitignore:1).

## 🔐 Environment Variables yang Mungkin Kamu Butuhkan

### Timezone

Jika kamu di Indonesia:

```yaml
TZ=Asia/Jakarta
```

Timezone lain:
- `Asia/Singapore`
- `America/New_York`
- `Europe/London`

### Retry Configuration

Jika sering dapat truncated responses, naikkan retry:

```yaml
SHIM_MAX_RETRIES=5
```

Default `2` sudah cukup untuk kebanyakan kasus.

### Custom Upstream (Advanced)

Jika kamu punya enowxai proxy di server lain:

```yaml
ENOWXAI_UPSTREAM=http://other-server:1430/v1
```

**⚠️ Hati-hati:** Ini akan break internal networking. Hanya gunakan jika kamu tahu apa yang kamu lakukan.

## 📝 Contoh Konfigurasi Lengkap di Dokploy

### Scenario 1: Default (Recommended)

**Tidak perlu set environment variables di Dokploy.**

Semua sudah dikonfigurasi di [`docker-compose.yml`](docker-compose.yml:1).

### Scenario 2: Custom Timezone

Di Dokploy Dashboard → Environment:

```
TZ=Asia/Jakarta
```

### Scenario 3: High Retry untuk Stability

Di Dokploy Dashboard → Environment:

```
TZ=Asia/Jakarta
SHIM_MAX_RETRIES=5
```

## 🔍 Cara Cek Environment Variables

### Di Dokploy Dashboard

1. Pilih service
2. Tab "Logs" atau "Terminal"
3. Jalankan:

```bash
env | grep -E "TZ|SHIM"
```

### Via Docker Command

Di server Dokploy:

```bash
# Cek enowxai service
docker exec enowxai-proxy env | grep TZ

# Cek shim service
docker exec enowxai-shim env | grep SHIM
```

## 🐛 Troubleshooting Environment

### Problem: Environment tidak apply

**Solution:**
1. Pastikan format benar (tidak ada spasi di sekitar `=`)
2. Redeploy service di Dokploy
3. Atau restart manual:

```bash
docker compose restart
```

### Problem: Timezone masih UTC

**Solution:**

Cek apakah `TZ` ter-set:

```bash
docker exec enowxai-proxy date
```

Jika masih UTC, set explicit di Dokploy dashboard:

```
TZ=Asia/Jakarta
```

### Problem: Shim tidak connect ke enowxai

**Solution:**

Cek `ENOWXAI_UPSTREAM`:

```bash
docker exec enowxai-shim env | grep UPSTREAM
```

Harus: `http://enowxai:1430/v1` (internal Docker network)

Jangan gunakan `localhost` atau `127.0.0.1`!

## 📊 Environment Variables Priority

Dokploy menggunakan priority order:

1. **Dokploy Dashboard Environment** (highest priority)
2. **docker-compose.yml environment**
3. **.env file** (if configured)
4. **Dockerfile ENV** (lowest priority)

Jika kamu set di Dokploy dashboard, itu akan override values di `docker-compose.yml`.

## ✅ Recommended Settings untuk Production

```yaml
# Service: enowxai
TZ=Asia/Jakarta  # Sesuaikan timezone kamu

# Service: enowxai-shim
SHIM_HOST=0.0.0.0  # Jangan ubah
SHIM_PORT=1432  # Jangan ubah
ENOWXAI_UPSTREAM=http://enowxai:1430/v1  # Jangan ubah
SHIM_MAX_RETRIES=2  # Atau 3-5 jika sering truncated
```

## 🎯 Summary

**Untuk deployment normal:**
- ✅ Tidak perlu set environment di Dokploy
- ✅ Semua sudah dikonfigurasi di [`docker-compose.yml`](docker-compose.yml:1)
- ✅ Langsung deploy saja!

**Untuk custom timezone:**
- Set `TZ=Asia/Jakarta` di Dokploy dashboard

**Untuk high stability:**
- Set `SHIM_MAX_RETRIES=5` di Dokploy dashboard

---

**Next:** Follow [`QUICK-START-DOKPLOY.md`](QUICK-START-DOKPLOY.md:1) untuk deploy!
