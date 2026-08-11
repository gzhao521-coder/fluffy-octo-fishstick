成长 PWA 部署与恢复说明

上传到 GitHub 仓库根目录的文件（5 个都要上传）：
  index.html
  sw.js
  manifest.webmanifest
  icon-192.png
  icon-512.png

线上地址：
  https://gzhao521-coder.github.io/fluffy-octo-fishstick/

2026-08-11 已升级 Service Worker 到 v14。
新版缓存更新失败时会保留旧版缓存作为备用，
不会再出现“更新一半导致白屏”的问题。
新版改成“优先使用手机里的离线缓存”，
只要成功打开过一次，之后即使 GitHub 很慢或连不上，
从主屏打开也会立即显示，不再一直转圈。
以后更新功能时，index.html 和 sw.js 必须一起上传，
否则手机上的旧缓存不会自动替换。

如果手机仍然一直显示“正在载入”：
1. 用手机浏览器打开：
   https://gzhao521-coder.github.io/fluffy-octo-fishstick/?v=20260811
2. 若还是旧页面，清除该网站的数据后再打开，
   或使用无痕/隐私窗口打开一次。
3. 如果手机主屏装的是旧版应用，删除后重新添加。
4. GitHub 打开缓慢时，可以先在普通浏览器里打开一次，
   等页面完全显示后再关闭，下次从主屏打开会走新缓存。
