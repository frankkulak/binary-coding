#!/usr/bin/env sh

# abort on errors
set -e

# ensure version was updated everywhere
node ./scripts/validate-docs.cjs

# clean and regen docs
rm -rf ./docs-deploy/**
npm run docs:gen
cp -r ./docs/. ./docs-deploy

# add needed files
touch ./docs-deploy/.nojekyll
echo ".DS_Store" > ./docs-deploy/.gitignore

# navigate into the deploy output directory
cd ./docs-deploy

# create empty repo and commit all changes
git init
git add -A
git commit -m "Deploy."

# overwrite the prod branch
git push -f git@github.com:frankkulak/binary-coding.git HEAD:gh-pages

# navigate back
cd -
