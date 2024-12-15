FROM node:18-alpine

# 設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json 和 yarn.lock
COPY package*.json yarn.lock ./

# 安裝所有依賴
RUN yarn install

# 複製專案檔案
COPY . .

# 建置應用程式
RUN yarn build

# 設定環境變數
ENV NODE_ENV=production

# 啟動應用程式
CMD ["yarn", "start"]

# docker build -t line-dine-mapper .
# docker run -p 8080:8080 --env-file .env line-dine-mapper
