import { createHash } from 'crypto';
import { CollectAttributes, collectAttributesFromArgs, getAttributeCollectionConfig } from '../src/attributeCollection';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('CollectAttributes / getAttributeCollectionConfig', () => {
  it('文字列指定の属性は、そのまま属性名として使われ、hash指定なしで登録される', () => {
    class Target {
      fetchUser(_userId: string) {
        return _userId;
      }
    }
    CollectAttributes(['userId'])(Target.prototype, 'fetchUser');

    const config = getAttributeCollectionConfig(Target.prototype, 'fetchUser');
    expect(config).toEqual({ definitions: [{ name: 'userId', hash: false }], when: 'error' });
  });

  it('オブジェクト指定の属性はhashフラグを保持し、optionsを渡さない場合はwhen=errorになる', () => {
    class Target {
      fetchUser(_userId: string, _email: string) {
        return `${_userId}:${_email}`;
      }
    }
    CollectAttributes([{ name: 'userId' }, { name: 'email', hash: true }])(Target.prototype, 'fetchUser');

    const config = getAttributeCollectionConfig(Target.prototype, 'fetchUser');
    expect(config).toEqual({
      definitions: [
        { name: 'userId', hash: false },
        { name: 'email', hash: true },
      ],
      when: 'error',
    });
  });

  it('options.when=\'always\'を渡した場合はその値が登録される', () => {
    class Target {
      fetchUser(_userId: string) {
        return _userId;
      }
    }
    CollectAttributes(['userId'], { when: 'always' })(Target.prototype, 'fetchUser');

    expect(getAttributeCollectionConfig(Target.prototype, 'fetchUser')?.when).toBe('always');
  });

  it('登録されていないprototype/メソッド名の組み合わせではundefinedが返る', () => {
    class Target {
      untouched() {
        return undefined;
      }
    }
    expect(getAttributeCollectionConfig(Target.prototype, 'untouched')).toBeUndefined();
  });
});

describe('collectAttributesFromArgs', () => {
  it('定義の位置に対応する引数から属性オブジェクトを構築する', () => {
    const config = {
      definitions: [
        { name: 'userId', hash: false },
        { name: 'count', hash: false },
      ],
      when: 'error' as const,
    };

    const result = collectAttributesFromArgs(config, ['u-1', 3]);
    expect(result).toEqual({ userId: 'u-1', count: 3 });
  });

  it('hash: trueの属性はSHA-256のhex digestに変換される', () => {
    const config = {
      definitions: [{ name: 'email', hash: true }],
      when: 'error' as const,
    };

    const result = collectAttributesFromArgs(config, ['a@example.com']);
    expect(result).toEqual({ email: sha256('a@example.com') });
  });

  it('該当位置の引数がundefinedまたはnullの場合、その属性は出力に含まれない', () => {
    const config = {
      definitions: [
        { name: 'userId', hash: false },
        { name: 'optional', hash: false },
      ],
      when: 'error' as const,
    };

    const result = collectAttributesFromArgs(config, ['u-1', undefined]);
    expect(result).toEqual({ userId: 'u-1' });

    const resultWithNull = collectAttributesFromArgs(config, ['u-1', null]);
    expect(resultWithNull).toEqual({ userId: 'u-1' });
  });

  it('オブジェクト引数はJSON文字列化され、hash指定時はJSON文字列がハッシュ化される', () => {
    const config = {
      definitions: [
        { name: 'payload', hash: false },
        { name: 'hashedPayload', hash: true },
      ],
      when: 'error' as const,
    };

    const payload = { id: 1 };
    const result = collectAttributesFromArgs(config, [payload, payload]);
    expect(result.payload).toBe(JSON.stringify(payload));
    expect(result.hashedPayload).toBe(sha256(JSON.stringify(payload)));
  });
});
