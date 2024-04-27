const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");

const version = pkg.version;

(() => {
  // validating version in docs generator
  const regex = /docs\/v(?<v>.+)$/;
  const genVersion = regex.exec(pkg.scripts["docs:gen"]).groups.v;
  if (version !== genVersion)
    throw `docs:gen is targetting ${genVersion} instead of ${version}`;
})();

(() => {
  // validating version in docs index page
  const htmlPath = path.resolve(__dirname, "../docs/index.html");
  const htmlContent = fs.readFileSync(htmlPath).toString();
  const regex = /const versions = \[(?<vl>[^\]]+)\];/;
  const versionList = regex.exec(htmlContent).groups.vl;
  if (!versionList.includes(version))
    throw `docs/index.html does not include ${version} in versions`;
})();
