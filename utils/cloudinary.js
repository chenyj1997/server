const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dbvzgpwkg',
  api_key: '177671128946657',
  api_secret: 'https://server-c752.onrender.com/' // 请替换为你的真实API Secret
});

module.exports = cloudinary;
