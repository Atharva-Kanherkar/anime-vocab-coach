# Extension download

`animevocab-chrome-extension.zip` is built during deploy (see `.github/workflows/deploy.yml`) from the packed `extension/` folder. Do not commit the zip — it is ~17MB and regenerated on every production deploy.

Local build:

```bash
npm run pack
cp dist/anime-vocab-coach.zip web/public/downloads/animevocab-chrome-extension.zip
```
