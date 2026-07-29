---
name: release
description: このリポジトリ(@azumaxoid/newrelic-instrument-annotation)の新バージョンをリリースする。バージョンを上げてタグを切り、npm publishまで実行する。
whenToUse: "リリースして" "バージョンあげて" "publishして" "リリース作業して" のように、新バージョンの公開を依頼されたとき
---

# リリース手順

このリポジトリは以下の方式でリリースする。

- **Changesets** はバージョン番号の決定と `CHANGELOG.md` 生成の補助としてのみ使う。
- 実際の `npm publish` のトリガーは **`v*` 形式のGitタグをpushすること**(`.github/workflows/release.yml`参照)。
  `main` へのpushではpublishは走らない。
- npm publishはnpm Trusted Publishing(OIDC)経由で行われる。`NPM_TOKEN`等のSecretは不要。

## 手順

### 1. 作業ツリーを確認する

```bash
git status
```

未コミットの変更が残っている場合はユーザーに確認する。`main`ブランチであること、最新であることを確認する。

```bash
git checkout main
git pull origin main
```

### 2. Changesetを作成する

前回リリース以降の変更内容を `git log` で確認し、`.changeset/<わかりやすい名前>.md` を作成する。
バージョンの種別は [Semantic Versioning](https://semver.org/) に従って判断する(破壊的変更 → major、後方互換の機能追加 → minor、バグ修正 → patch)。

```markdown
---
"@azumaxoid/newrelic-instrument-annotation": minor
---

変更内容の要約(英語)。
```

### 3. バージョンを確定する

```bash
npx changeset version
```

これにより `package.json` のバージョンが更新され、`.changeset/*.md`(README以外)が消費されて削除され、`CHANGELOG.md` が更新される。差分を確認する。

### 4. ローカルでビルド・テストを確認する

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### 5. コミットする

```bash
git add -A
git commit -m "Release vX.Y.Z"
```

### 6. タグを作成してpushする

`package.json` の `version` フィールドと同じバージョンで、`v` プレフィックス付きのタグを作成する。

```bash
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 7. Release workflowの実行を確認する

```bash
gh run list --repo Azumaxoid/newrelic-instrument-annotation --limit 1
```

`completed / success` になるまで待つ(`gh run watch <run-id>` または Monitor ツールでポーリングする)。失敗した場合はログを確認する。

```bash
gh run view <run-id> --repo Azumaxoid/newrelic-instrument-annotation --log-failed
```

### 8. npm公開を確認する

```bash
curl -s "https://registry.npmjs.org/@azumaxoid/newrelic-instrument-annotation" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('versions:', list(data.get('versions', {}).keys()))
print('dist-tags:', data.get('dist-tags'))
"
```

`dist-tags.latest` が今回のバージョンになっていれば完了。GitHub Releaseも自動作成される(`gh release view vX.Y.Z --repo Azumaxoid/newrelic-instrument-annotation`で確認可)。

## トラブルシューティング

- **npm publishが `E404 Not Found` で失敗する**: npm Trusted Publisherの設定(https://www.npmjs.com/package/@azumaxoid/newrelic-instrument-annotation/access )で
  Organization/Repository/Workflow filename(`release.yml`、パスなし)が正しいか確認する。設定直後は反映に時間がかかることがあるため、少し待って再度タグをpushし直すと解決する場合がある(タグの削除→再作成→push: `git tag -d vX.Y.Z && git push origin --delete vX.Y.Z && git tag vX.Y.Z && git push origin vX.Y.Z`)。
- **npm publishが2FA関連の403で失敗する**: Trusted Publishingが機能していない。ワークフローに `permissions: id-token: write` があるか、`actions/setup-node` が `registry-url` を設定しているか確認する。
- **GitHub ActionsがPRを作成できないというエラー**: このリポジトリではCIがPRを自動作成する運用はしていない(タグpush方式のため発生しないはず)。発生した場合は `release.yml` の trigger が `main` へのpushに戻っていないか確認する。
