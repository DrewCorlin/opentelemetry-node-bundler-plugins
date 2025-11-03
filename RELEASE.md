To release changes first checkout the latest main branch and pull it

```bash
git checkout main
git pull
```

```bash
npx nx release --skip-publish
```

then

```bash
git push origin main
```

then push the tag

```bash
git push origin <tag>
```
