# Stage 1: Build the React/Vite frontend
FROM node:20-slim AS builder
WORKDIR /app

# کپی کردن فایل‌های پکیج برای استفاده از کش داکر
COPY package*.json ./
RUN npm install

# کپی کردن کل پروژه و ساخت نسخه Production فرانت‌اند
COPY . .
RUN npm run build

# Stage 2: Run the Node.js server
FROM node:20-slim
WORKDIR /app

# کپی کردن فایل‌های مورد نیاز برای اجرای سرور
COPY package*.json ./
RUN npm install --only=production

# کپی کردن فایل‌های کامپایل شده فرانت‌اند و فایل سرور
COPY --from=builder /app/dist ./dist
COPY server.js .

# ایجاد پوشه آپلود فایل‌های صوتی
RUN mkdir -p uploads

# تنظیم متغیرهای محیطی
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# دستور شروع به کار سرور
CMD ["node", "server.js"]
