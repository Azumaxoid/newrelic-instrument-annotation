import { createHash } from 'crypto';

/**
 * Declares one attribute to collect from a decorated method's arguments (by
 * position). A plain string uses that string as both the source lookup and
 * the New Relic attribute name with no hashing. `null` marks that position as
 * skipped (collected as nothing), which lets you skip a leading/middle
 * non-primitive argument (e.g. `session`) while still mapping later entries
 * positionally to their corresponding argument.
 *
 * @CollectAttributesが引数(位置順)から収集する属性を1件宣言する。
 * 文字列だけを渡した場合は、そのままNew Relic属性名として使われ、ハッシュ化は行われない。
 * `null`はその位置を「収集しない」ことを示すプレースホルダーで、先頭/中間の非プリミティブ引数
 * (例: `session`)をスキップしつつ、後続の宣言を対応する引数位置に正しく揃えるために使う。
 */
export type AttributeDefinition = string | { name: string; hash?: boolean } | null;

export type AttributeCollectionWhen = 'error' | 'always';

export interface CollectAttributesOptions {
  /**
   * `'error'` (default): attributes are attached only to the `noticeError`
   * call when the method throws/rejects.
   * `'always'`: attributes are also attached to the current transaction via
   * `newrelic.addCustomAttributes` on every call, in addition to `'error'`
   * behavior.
   *
   * `'error'`(デフォルト): メソッドが例外を投げた/rejectした場合のnoticeError呼び出しにのみ属性を付与する。
   * `'always'`: `'error'`の挙動に加えて、毎回の呼び出しで`newrelic.addCustomAttributes`により
   * 現在のトランザクションにも属性を付与する。
   */
  when?: AttributeCollectionWhen;
}

export interface NormalizedAttributeDefinition {
  name: string;
  hash: boolean;
}

export interface AttributeCollectionConfig {
  definitions: (NormalizedAttributeDefinition | null)[];
  when: AttributeCollectionWhen;
}

const attributeCollectionRegistry = new WeakMap<object, Map<string, AttributeCollectionConfig>>();

function normalizeDefinitions(attributes: AttributeDefinition[]): (NormalizedAttributeDefinition | null)[] {
  return attributes.map(attribute => {
    if (attribute === null) {
      return null;
    }
    return typeof attribute === 'string' ? { name: attribute, hash: false } : { name: attribute.name, hash: attribute.hash ?? false };
  });
}

/**
 * Method decorator that opts a method into explicit attribute collection.
 * Attributes are mapped positionally: the Nth entry in `attributes`
 * corresponds to the method's Nth argument.
 *
 * メソッドを明示的な属性収集の対象にするメソッドデコレーター。
 * `attributes`のN番目の要素が、メソッドのN番目の引数に対応する(位置ベースのマッピング)。
 *
 * @example
 * class UserService {
 *   @CollectAttributes(['userId', { name: 'email', hash: true }])
 *   async fetchUser(userId: string, email: string) { ... }
 * }
 *
 * @example Skipping a leading non-primitive argument with `null`
 * class UserService {
 *   @CollectAttributes([null, { name: 'email', hash: true }])
 *   async fetchUser(session: Session, email: string) { ... }
 * }
 */
export function CollectAttributes(attributes: AttributeDefinition[], options?: CollectAttributesOptions) {
  const definitions = normalizeDefinitions(attributes);
  const when: AttributeCollectionWhen = options?.when ?? 'error';

  return function (target: object, propertyKey: string | symbol): void {
    if (typeof propertyKey !== 'string') {
      return;
    }

    let methodConfigs = attributeCollectionRegistry.get(target);
    if (!methodConfigs) {
      methodConfigs = new Map();
      attributeCollectionRegistry.set(target, methodConfigs);
    }
    methodConfigs.set(propertyKey, { definitions, when });
  };
}

/**
 * Looks up the attribute collection config registered by `@CollectAttributes`
 * for a given prototype/method pair, if any.
 *
 * `@CollectAttributes`によって登録された属性収集設定を、prototype/メソッド名の組から取得する。
 */
export function getAttributeCollectionConfig(target: object, methodName: string): AttributeCollectionConfig | undefined {
  return attributeCollectionRegistry.get(target)?.get(methodName);
}

function toRawString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function normalizeAttributeValue(value: unknown): string | number | boolean {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return toRawString(value);
}

function hashAttributeValue(value: unknown): string {
  return createHash('sha256').update(toRawString(value)).digest('hex');
}

/**
 * Builds a New Relic attributes object from a method's argument list,
 * according to a normalized set of attribute definitions. Arguments that are
 * `undefined`/`null` at a definition's position are omitted.
 *
 * 属性定義の集合に従い、メソッドの引数リストからNew Relic属性オブジェクトを構築する。
 * 定義の位置にある引数が`undefined`/`null`の場合、その属性は出力から除外される。
 */
export function collectAttributesFromArgs(config: AttributeCollectionConfig, args: unknown[]): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  config.definitions.forEach((definition, index) => {
    if (definition === null) {
      return;
    }
    const rawValue = args[index];
    if (rawValue === undefined || rawValue === null) {
      return;
    }
    result[definition.name] = definition.hash ? hashAttributeValue(rawValue) : normalizeAttributeValue(rawValue);
  });
  return result;
}
