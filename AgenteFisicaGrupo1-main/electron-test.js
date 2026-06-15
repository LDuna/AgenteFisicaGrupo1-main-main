const { app } = require('electron');

app.whenReady().then(() => {
  console.log('ELECTRON IS WORKING');
  app.quit();
});
