const fs = require('fs');
const https = require('https');

const file = fs.createWriteStream("public/vendor/marzipano.js");
https.get("https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/master/vendor/marzipano.js", function(response) {
  response.pipe(file);
  file.on("finish", () => {
    file.close();
    console.log("Download Completed");
  });
});
