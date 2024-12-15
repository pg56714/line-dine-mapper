FROM node:18-alpine

# 設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json 和 yarn.lock（如果有）
COPY package*.json yarn.lock ./

# 安裝依賴
RUN yarn install --production && yarn cache clean

# 複製專案檔案
COPY . .

# 建置應用程式
RUN yarn build

# 暴露應用程式執行的埠
EXPOSE 3000

# 設定環境變數（可選）
ENV NODE_ENV=production

# 啟動應用程式
CMD ["yarn", "start"]

# docker build -t line-dine-mapper .
# docker run -p 3000:3000 --env-file .env line-dine-mapper
