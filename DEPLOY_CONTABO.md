# Deploy gestio_backend on Contabo (Ubuntu)

Step-by-step guide to host the **gestio_backend** AdonisJS API on a Contabo VPS running Ubuntu.

**Stack:** Node.js · AdonisJS 7 · MySQL · Nginx · PM2 · Let's Encrypt SSL

**API base path:** `/api/v1`  
**Health check:** `GET /health`

---

## What you need before starting

| Item | Notes |
|------|--------|
| Contabo VPS | Ubuntu 22.04 or 24.04 recommended |
| Domain name | e.g. `api.yourdomain.com` (optional but recommended for HTTPS) |
| Git repository | Code pushed to GitHub / GitLab |
| SSH client | Windows: PowerShell, PuTTY, or Windows Terminal |

Recommended VPS size for this project:

- **Minimum:** 2 vCPU, 4 GB RAM, 50 GB storage
- **Comfortable:** 4 vCPU, 8 GB RAM (your 6 vCPU / 12 GB plan is more than enough)

---

## Step 1 — Order and access your Contabo VPS

1. Log in to [Contabo](https://contabo.com) and order a **VPS** with **Ubuntu 22.04** or **24.04**.
2. Wait for the activation email with:
   - Server IP address
   - Root password (or SSH key instructions)
3. Open **Contabo Customer Control Panel** and note your VPS IP.

Connect from your computer:

```bash
ssh root@YOUR_SERVER_IP
```

Replace `YOUR_SERVER_IP` with the IP from Contabo (e.g. `ssh root@123.45.67.89`).

On first login, change the root password if prompted.

---

## Step 2 — Initial server security

Run these commands on the server as `root`.

### 2.1 Update the system

```bash
apt update && apt upgrade -y
```

### 2.2 Create a non-root user (recommended)

```bash
adduser deploy
usermod -aG sudo deploy
```

Copy your SSH access to the new user (if you use SSH keys):

```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

From now on, log in as:

```bash
ssh deploy@YOUR_SERVER_IP
```

Use `sudo` before admin commands below when logged in as `deploy`.

### 2.3 Configure firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Do **not** expose port `3333` publicly — Nginx will proxy to it internally.

---

## Step 3 — Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential
node -v   # should show v20.x
npm -v
```

`build-essential` is required for native Node modules (`better-sqlite3`, etc.).

---

## Step 4 — Install MySQL

```bash
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql
```

Secure MySQL:

```bash
sudo mysql_secure_installation
```

- Set a strong root password
- Remove anonymous users: **Yes**
- Disallow root login remotely: **Yes**
- Remove test database: **Yes**
- Reload privileges: **Yes**

### 4.1 Create database and user

```bash
sudo mysql -u root -p
```

Inside MySQL:

```sql
CREATE DATABASE gestio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gestio_user'@'localhost' IDENTIFIED BY 'CHANGE_THIS_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON gestio.* TO 'gestio_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Save the password — you will put it in `.env`.

---

## Step 5 — Install Nginx, PM2, and Git

```bash
sudo apt install -y nginx git
sudo npm install -g pm2
```

---

## Step 6 — Clone the project

```bash
sudo mkdir -p /var/www
sudo chown deploy:deploy /var/www
cd /var/www
git clone https://github.com/YOUR_USER/gestio_backend.git
cd gestio_backend
```

Replace the Git URL with your actual repository.

If the repo is private, set up a deploy key or use a personal access token.

---

## Step 7 — Generate secrets locally (on your PC)

On your **local machine**, in the project folder:

```bash
node ace generate:key
```

Copy the generated `APP_KEY` value.

---

## Step 8 — Create production `.env`

On the **server**, create the env file inside the project root (before build):

```bash
cd /var/www/gestio_backend
nano .env
```

Paste and adjust:

```env
# Node
TZ=UTC
NODE_ENV=production
PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info

# App
APP_NAME=gestio_backend
APP_KEY=paste_your_generated_app_key_here
APP_URL=https://api.yourdomain.com

# Auth
AUTH_TOKEN_EXPIRES_IN=7 days

# Session
SESSION_DRIVER=cookie

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=gestio_user
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
DB_DATABASE=gestio

# Rate limiter
LIMITER_STORE=database

# CORS — comma-separated frontend URLs (no trailing slash)
CORS_ORIGIN=https://your-frontend.com
```

Important:

- `HOST` must be `0.0.0.0` (not `localhost`)
- `APP_URL` must match your public API URL
- `CORS_ORIGIN` must list every frontend origin that calls the API

Save: `Ctrl+O`, Enter, `Ctrl+X`.

---

## Step 9 — Build the application

```bash
cd /var/www/gestio_backend
npm install
npm run build
```

AdonisJS outputs production files to the `build/` folder.

Install production dependencies inside `build/`:

```bash
cd build
npm ci --omit=dev
```

Copy `.env` into the build folder (required at runtime):

```bash
cp ../.env .env
```

---

## Step 10 — Run database migrations

Still inside `/var/www/gestio_backend/build`:

```bash
node ace migration:run --force
```

### Optional: seed initial data (first deploy only)

```bash
node ace db:seed
```

After seeding, **change default user passwords** from the app or database. Do not leave seed passwords in production.

---

## Step 11 — Start the API with PM2

```bash
cd /var/www/gestio_backend/build
pm2 start bin/server.js --name gestio-api
pm2 save
pm2 startup
```

Run the command that `pm2 startup` prints (it starts PM2 on boot).

Check status:

```bash
pm2 status
pm2 logs gestio-api
```

Test locally on the server:

```bash
curl http://127.0.0.1:3333/health
```

Expected response:

```json
{"status":"ok","database":"connected"}
```

---

## Step 12 — Point your domain to Contabo

In your domain registrar DNS panel, add:

| Type | Name | Value |
|------|------|--------|
| A | `api` | `YOUR_SERVER_IP` |

Wait 5–30 minutes for DNS propagation.

Verify:

```bash
ping api.yourdomain.com
```

---

## Step 13 — Configure Nginx reverse proxy

```bash
sudo nano /etc/nginx/sites-available/gestio-api
```

Paste (replace `api.yourdomain.com`):

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/gestio-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Test in browser or curl:

```bash
curl http://api.yourdomain.com/health
```

---

## Step 14 — Enable HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Follow prompts:

- Enter email
- Agree to terms
- Choose redirect HTTP → HTTPS: **Yes**

Certbot auto-renews. Test renewal:

```bash
sudo certbot renew --dry-run
```

Test HTTPS:

```bash
curl https://api.yourdomain.com/health
```

Update `.env` if needed so `APP_URL` uses `https://`.

After changing `.env`:

```bash
cd /var/www/gestio_backend/build
pm2 restart gestio-api
```

---

## Step 15 — Connect your frontend

Set your frontend API base URL to:

```
https://api.yourdomain.com/api/v1
```

Make sure `CORS_ORIGIN` in `.env` includes your frontend URL exactly, e.g.:

```env
CORS_ORIGIN=https://app.yourdomain.com,https://www.yourdomain.com
```

Restart after changes:

```bash
pm2 restart gestio-api
```

---

## Step 16 — Deploy updates (redeploy workflow)

When you push new code to Git:

```bash
cd /var/www/gestio_backend
git pull
npm install
npm run build
cd build
npm ci --omit=dev
cp ../.env .env
node ace migration:run --force
pm2 restart gestio-api
```

---

## Useful commands

| Task | Command |
|------|---------|
| View logs | `pm2 logs gestio-api` |
| Restart API | `pm2 restart gestio-api` |
| Stop API | `pm2 stop gestio-api` |
| MySQL status | `sudo systemctl status mysql` |
| Nginx status | `sudo systemctl status nginx` |
| Nginx test config | `sudo nginx -t` |
| Disk usage | `df -h` |
| Memory usage | `free -h` |

---

## Troubleshooting

### `502 Bad Gateway` from Nginx

- API is not running: `pm2 status`
- Wrong port: app must listen on `3333` with `HOST=0.0.0.0`
- Check logs: `pm2 logs gestio-api`

### `database: unreachable` on `/health`

- MySQL not running: `sudo systemctl start mysql`
- Wrong `DB_*` values in `.env`
- `.env` missing in `build/` folder

### CORS errors in browser

- Add frontend URL to `CORS_ORIGIN`
- No trailing slash on origins
- Restart: `pm2 restart gestio-api`

### App crashes after reboot

```bash
pm2 resurrect
# or re-run pm2 startup if needed
```

### Out of memory

- Check: `free -h`
- Consider adding swap or upgrading VPS

---

## Security checklist

- [ ] SSH: use key-based login, disable password auth when possible
- [ ] Firewall: only ports 22, 80, 443 open
- [ ] Strong MySQL password
- [ ] `APP_KEY` is unique and secret
- [ ] `.env` never committed to Git
- [ ] HTTPS enabled
- [ ] Default seed passwords changed after first login
- [ ] Contabo snapshots enabled for backups

---

## Optional: no domain (IP only)

You can test with the raw IP before buying a domain:

```env
APP_URL=http://YOUR_SERVER_IP
```

Use `http://YOUR_SERVER_IP/health` — but for production and frontend CORS, a real domain with HTTPS is strongly recommended.

---

## Quick reference — full first-time install

```bash
# On server (as deploy user)
cd /var/www/gestio_backend
npm install && npm run build
cd build && npm ci --omit=dev && cp ../.env .env
node ace migration:run --force
pm2 start bin/server.js --name gestio-api && pm2 save
```

Then configure Nginx + Certbot as above.

---

**Done.** Your API should be live at `https://api.yourdomain.com/api/v1`.
