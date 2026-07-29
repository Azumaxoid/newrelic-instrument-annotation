# @azumaxoid/newrelic-instrument-annotation

TypeScriptのサービスクラスに、デコレーターベースでNew RelicのAPM自動計装(メソッド単位のセグメント計測 + エラー通知)を適用するユーティリティです。

## 特徴

- クラスの全publicメソッドを自動的に `newrelic.startSegment` でラップ
- 同期メソッド・Promiseを返す非同期メソッドの両方に対応
- 例外発生時に `newrelic.noticeError` を自動呼び出し
- 同一クラス内で計装済みメソッドが計装済みメソッドを呼ぶ場合(例: `post` → `executePost`)の、同一エラーの多重報告を防止
- メソッド引数を New Relic のエラー属性として送信する際、`token`/`password`/`secret`/`email` を含むキーを自動マスキング

## インストール

```bash
npm install @azumaxoid/newrelic-instrument-annotation
```

`newrelic`(New Relic Node.js agent)は `peerDependency` です。ホストアプリケーションに既にインストールされている `newrelic` パッケージ(`^14.1.2`)を利用します。

## 使い方

### クラスデコレーターとして (`@InstrumentService`)

```typescript
import { InstrumentService } from '@azumaxoid/newrelic-instrument-annotation';

@InstrumentService('MyService')
class MyService {
  async fetchData(id: string) {
    // ...
  }
}
```

### Logger注入

デフォルトでは内部ログを `console` に出力しますが、任意のロガーを注入できます。ロガーは `info`/`warn`/`error` メソッドを持つオブジェクト(`LoggerLike`)であれば何でも使えます。

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

### `stringifyArgsForTelemetry` の直接利用(マスキングのみ使いたい場合)

```typescript
import { stringifyArgsForTelemetry } from '@azumaxoid/newrelic-instrument-annotation';

stringifyArgsForTelemetry([{ token: 'secret-value', name: 'ok' }]);
// => '[{"token":"[REDACTED]","name":"ok"}]'
```

## 動作の詳細

- `constructor` および `_` で始まるメソッド名は計装対象から除外されます。
- 例外を報告した際、そのエラーオブジェクトに `reported = true` を設定します。ホストアプリケーションの最外周エラーハンドラーが `error.reported` を見て再報告を防ぐような実装と組み合わせて使うことを想定しています(このパッケージ自体はそのようなハンドラーに依存しません)。
- ネストした計装済みメソッド呼び出しで同一のErrorオブジェクトが複数階層を伝播する場合、`WeakSet` により最も内側の階層でのみ `noticeError` を呼び出します。

## API Reference

- `InstrumentService(serviceName: string, options?: InstrumentServiceOptions)` — クラスデコレーター
- `instrumentServiceClass<T>(ServiceClass: T, serviceName: string, options?: InstrumentServiceOptions): T` — デコレーターの下地となる関数
- `instrumentMethod(target, methodName, serviceName, options?)` — 単一メソッドの手動計装
- `stringifyArgsForTelemetry(args: unknown[], maxLength?: number): string` — 引数マスキング + JSON文字列化
- `LoggerLike` / `InstrumentServiceOptions` — 型定義

## Contributing

変更を行う場合は [Changesets](https://github.com/changesets/changesets) を使ってください。

```bash
npx changeset
```

PRに `.changeset/*.md` を含めてmainにマージすると、CIが自動でバージョンアップPRを作成し、それをマージすると npm へ自動publishされます。

## License

MIT
