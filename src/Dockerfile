FROM node:12

# external port
# EXPOSE 3000

WORKDIR /usr/src/app/

# copy package.json, and package-lock.json if exists
COPY package.json package-lock.json* ./

RUN npm install
RUN npm cache clean --force

# Temp directory to store uploading attachment, deleted after sending email , and anyway when the container is destroyed
RUN mkdir uploads

COPY . . 

#CMD [ "node", "index.js" ]