# @azumaxoid/newrelic-instrument-annotation

TypeScript のサービスクラスに New Relic APM の自動計装（メソッド単位のセグメントトレースとエラー通知）を  
デコレーターベースで適用するユーティリティです。

## 機能

- クラスのすべての公開メソッドを `newrelic.startSegment` で自動ラップ
- 同期メソッドと `Promise` を返すメソッドの両方に対応
- 例外発生時に自動で `newrelic.noticeError` を呼び出し
- 同一クラス内のインストルメント済みメソッドを入れ子で呼び出した場合（例: `post` → `executePost`）の重複レポートを防止
- メソッド引数はデフォルトでは属性として収集しない（エラー時も含む）。  
  特定の引数だけを明示的にオプトインするには `@CollectAttributes` デコレーターを使用する。  
  個別の引数には SHA-256 ハッシュ化オプションも指定可能。

## インストール

```bash
npm install @azumaxoid/newrelic-instrument-annotation
```

`newrelic`（New Relic Node.js エージェント）は `peerDependency` です。  
ホストアプリケーションにインストール済みの `newrelic` パッケージ（`^14.1.2`）を使用します。

## 使い方

### クラスデコレーター（`@InstrumentService`）

```typescript
import { InstrumentService } from '@azumaxoid/newrelic-instrument-annotation';

@InstrumentService('MyService')
class MyService {
  async fetchData(id: string) {
    // ...
  }
}
```

### ロガーの注入

デフォルトでは内部ログは `console` に出力されますが、任意のロガーを注入できます。  
`info`/`warn`/`error` メソッドを持つオブジェクト（`LoggerLike`）を使用できます。

```typescript
import { InstrumentService, LoggerLike } from '@azumaxoid/newrelic-instrument-annotation';

const myLogger: LoggerLike = {
  info: (msg, meta) => console.log('[INFO]', msg, meta),
  warn: (msg, meta) => console.warn('[WARN]', msg, meta),
  error: (msg, meta) => console.error('[ERROR]', msg, meta),
};

@InstrumentService('MyService', { logger: myLogger })
class MyService { /* ... */ }
```

### メソッド引数を属性として収集する（`@CollectAttributes`）

デフォルトではメソッド引数は New Relic に送信されません（エラー時も含む）。  
これはPII・シークレットが誤ってエラー属性に漏洩するリスクを避けるための意図的なデフォルト設計です。  
特定の引数をオプトインするにはメソッドに `@CollectAttributes` を付与します。  
エントリはメソッドの引数に**位置順**でマッピングされます。

**例**: ユーザーIDをハッシュ化してエラーと相関付ける（PII を露出しない）:

```typescript
class UserService {
  @CollectAttributes([{ name: 'userIdHash', hash: true }])
  async fetchUser(userId: string) {
    // ...
  }
}
```

```typescript
import { InstrumentService, CollectAttributes } from '@azumaxoid/newrelic-instrument-annotation';

@InstrumentService('UserService')
class UserService {
  @CollectAttributes(['userId', { name: 'email', hash: true }])
  async fetchUser(userId: string, email: string) {
    // ...
  }
}
```

- 文字列（例: `'userId'`）はそのまま属性名として使われ、ハッシュ化なし
- オブジェクト（`{ name: string, hash?: boolean }`）で属性名の変更とハッシュ化を指定可能
- `hash: true` を指定するとその値を SHA-256 16進数ダイジェストに置き換えて送信
- 宣言した位置の引数が `undefined`/`null` の場合は属性から省略される

デフォルト（`when: 'error'`）では、宣言した属性はメソッドが例外をスローした・`Promise` がリジェクトした場合の  
`noticeError` 呼び出し時にのみ付与されます。  
成功・失敗問わず毎回 `newrelic.addCustomAttributes` でトランザクションにも付与したい場合は `{ when: 'always' }` を渡します:

```typescript
class UserService {
  @CollectAttributes(['userId'], { when: 'always' })
  async fetchUser(userId: string) {
    // ...
  }
}
```

#### 先頭・中間の引数を `null` でスキップする

エントリは位置順にマッピングされるため、収集したくない引数（例: `session`）がある場合は  
その位置に `null` を渡すことで後続のエントリの位置ずれを防ぎます:

```typescript
class UserService {
  @CollectAttributes([null, { name: 'email', hash: true }])
  async fetchUser(session: Session, email: string) {
    // ...
  }
}
```

`null` はどの位置にも、連続して（`[null, null, 'criterianame']`）または中間に（`['attemptid', null, 'page']`）置くことができます。

### `stringifyArgsForTelemetry` を直接使う（マスキングユーティリティ）

`stringifyArgsForTelemetry` はスタンドアロンのマスキング＋シリアライズユーティリティです。  
計装ラッパーからは自動的に呼ばれなくなっているため、引数をログ/シリアライズしたい場所で直接使ってください。

```typescript
import { stringifyArgsForTelemetry } from '@azumaxoid/newrelic-instrument-annotation';

stringifyArgsForTelemetry([{ token: 'secret-value', name: 'ok' }]);
// => '[{"token":"[REDACTED]","name":"ok"}]'
```

## 動作の仕組み

- `constructor` または `_` で始まるメソッドは計装から除外されます
- エラーが報告されると、エラーオブジェクトに `reported = true` がセットされます。  
  ホストアプリケーションの最外層エラーハンドラーで `error.reported` を確認することで二重レポートを回避できます（このパッケージ自体はそのようなハンドラーの存在を前提としません）
- 同一の `Error` オブジェクトがネストしたインストルメント済みメソッド呼び出しを伝播する場合、  
  `WeakSet` により `noticeError` は最も内側のメソッドからのみ呼ばれます

## API リファレンス

- `InstrumentService(serviceName: string, options?: InstrumentServiceOptions)` — クラスデコレーター
- `instrumentServiceClass<T>(ServiceClass: T, serviceName: string, options?: InstrumentServiceOptions): T` — デコレーターの実体となる関数
- `instrumentMethod(target, methodName, serviceName, options?)` — 単一メソッドの手動計装
- `CollectAttributes(attributes: AttributeDefinition[], options?: CollectAttributesOptions)` — 特定の引数を属性収集にオプトインするメソッドデコレーター（位置マッピング・`null` スキップ・SHA-256 ハッシュ・`when: 'error' | 'always'`）
- `getAttributeCollectionConfig(target: object, methodName: string): AttributeCollectionConfig | undefined` — プロトタイプ/メソッドペアに登録された `@CollectAttributes` 設定を取得（外部の計装レイヤーからの再利用向け）
- `collectAttributesFromArgs(config: AttributeCollectionConfig, args: unknown[]): Record<string, string | number | boolean>` — 引数リストと解決済みコンフィグから属性オブジェクトを生成（外部の計装レイヤーからの再利用向け）
- `stringifyArgsForTelemetry(args: unknown[], maxLength?: number): string` — 引数マスキング＋JSON シリアライズ（スタンドアロンユーティリティ）
- `LoggerLike` / `InstrumentServiceOptions` — 型定義
- `AttributeDefinition` / `CollectAttributesOptions` / `AttributeCollectionWhen` / `AttributeCollectionConfig` / `NormalizedAttributeDefinition` — `@CollectAttributes` 用型定義

## コントリビュート

変更を加える際は [Changesets](https://github.com/changesets/changesets) を使用してください。

```bash
npx changeset
```

`.changeset/*.md` ファイルを含む PR が `main` にマージされると、CI が自動でバージョンバンプ PR を作成します。  
そのバンプ PR をマージすると新バージョンが npm に公開されます。

## ライセンス

MIT
