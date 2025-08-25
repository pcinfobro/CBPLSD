# Hostinger VPS Deployment Guide

## Prerequisites on Hostinger VPS

1. **Install Node.js and npm:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Install PM2 globally:**
   ```bash
   sudo npm install -g pm2
   ```

3. **Install MongoDB (if not using MongoDB Atlas):**
   ```bash
   sudo apt-get install -y mongodb
   sudo systemctl start mongodb
   sudo systemctl enable mongodb
   ```

## Deployment Steps

1. **Upload your files to `/var/www/CBP/`**
   - You can use FTP, Git, or file manager provided by Hostinger

2. **Set up the application:**
   ```bash
   cd /var/www/CBP
   chmod +x deploy.sh
   chmod +x start-production.sh
   ./deploy.sh
   ```

3. **Configure environment variables:**
   ```bash
   nano .env
   ```
   Update the following important variables:
   - `DB_URL`: Your MongoDB connection string
   - `CLIENT_ID` & `CLIENT_SECRET`: Google OAuth credentials
   - `GOOGLE_CALLBACK_URL`: Your domain callback URL
   - `SESSION_SECRET`: A strong secret key
   - `EMAIL_USER` & `EMAIL_PASS`: Email configuration

4. **Start the application:**
   ```bash
   ./start-production.sh
   ```

5. **Configure Nginx (if using Nginx as reverse proxy):**
   ```bash
   sudo nano /etc/nginx/sites-available/cbp-app
   ```
   
   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Enable the site and restart Nginx:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/cbp-app /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Useful Commands

- Check application status: `pm2 status`
- View logs: `pm2 logs`
- Monitor application: `pm2 monit`
- Restart application: `pm2 restart cbp-app`
- Stop application: `pm2 stop cbp-app`

## SSL Certificate (Optional but Recommended)

Install Certbot for free SSL:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Security Considerations

1. **Firewall Configuration:**
   ```bash
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https
   sudo ufw enable
   ```

2. **Keep your system updated:**
   ```bash
   sudo apt update && sudo apt upgrade
   ```

3. **Regular backups of your database and application files**

## Troubleshooting

- If the app doesn't start, check logs: `pm2 logs`
- Check if port 3000 is available: `netstat -tlnp | grep 3000`
- Verify Node.js version: `node --version`
- Check MongoDB status: `sudo systemctl status mongodb`
