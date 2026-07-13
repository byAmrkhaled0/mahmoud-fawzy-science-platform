# V51 deployment

The V51 deployment script now:

1. Verifies the project.
2. Builds the static site.
3. Installs `functions` dependencies from the public npm registry.
4. Deploys Firebase Functions.
5. Deploys Firestore/Storage rules and indexes.
6. Pushes to GitHub only when the folder contains `.git`.

If you extracted the ZIP into a new folder, run:

```powershell
.\prepare-github-folder.ps1
```

Then open the newly created `mahmoud-fawzy-production-v51` folder and run:

```powershell
npm run deploy:production
```
