import { stringifyArgsForTelemetry } from '../src/telemetryRedaction';

describe('stringifyArgsForTelemetry', () => {
  it('token/password/secret/emailを含むキー(大文字小文字混在含む)が[REDACTED]に置換される', () => {
    const result = stringifyArgsForTelemetry([
      { moodleToken: 'abc', Password: 'pw', userSecret: 's', email: 'a@example.com', name: 'ok' },
    ]);
    const parsed = JSON.parse(result);

    expect(parsed[0]).toEqual({
      moodleToken: '[REDACTED]',
      Password: '[REDACTED]',
      userSecret: '[REDACTED]',
      email: '[REDACTED]',
      name: 'ok',
    });
  });

  it('循環参照オブジェクトは[CIRCULAR]として安全に処理される', () => {
    const obj: Record<string, unknown> = { name: 'x' };
    obj.self = obj;

    const result = stringifyArgsForTelemetry([obj]);
    const parsed = JSON.parse(result);

    expect(parsed[0].self).toBe('[CIRCULAR]');
  });

  it('MAX_DEPTH(6)を超える深さのネストは[MAX_DEPTH]に切り詰められる', () => {
    let nested: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 10; i++) {
      nested = { child: nested };
    }

    const result = stringifyArgsForTelemetry([nested]);
    expect(result).toContain('[MAX_DEPTH]');
  });

  it('maxLength引数で出力文字列が切り詰められる', () => {
    const longArg = { data: 'x'.repeat(2000) };
    const result = stringifyArgsForTelemetry([longArg], 50);

    expect(result.length).toBe(50);
  });

  it('シリアライズ不能な値(BigInt等)で例外を投げず[UNSERIALIZABLE_ARGS]を返す', () => {
    const result = stringifyArgsForTelemetry([{ big: BigInt(10) }]);
    expect(result).toBe('[UNSERIALIZABLE_ARGS]');
  });
});
