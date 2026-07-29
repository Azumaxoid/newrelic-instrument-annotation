/**
 * instrumentService.ts が自動計装のエラー属性・スパン属性としてメソッド引数を
 * シリアライズする際に使う、機密情報マスキングユーティリティ。
 *
 * キー名ベースで再帰的に検出し、該当する値を `[REDACTED]` に置換する。
 * token/password/secret系のフィールド、およびemailを対象とする。
 */

const SENSITIVE_KEY_PATTERN = /token|password|secret|email/i

const REDACTED = '[REDACTED]'

const MAX_DEPTH = 6

function redactValue(value: unknown, depth: number, seen: Set<unknown>): unknown {
    if (value === null || typeof value !== 'object') {
        return value
    }
    if (depth >= MAX_DEPTH) {
        return '[MAX_DEPTH]'
    }
    if (seen.has(value)) {
        return '[CIRCULAR]'
    }
    seen.add(value)

    if (Array.isArray(value)) {
        return value.map(item => redactValue(item, depth + 1, seen))
    }

    const result: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(v, depth + 1, seen)
    }
    return result
}

/**
 * デコレーターの計装が送信するメソッド引数を、機密フィールドをマスキングした上でJSON文字列化する。
 * シリアライズに失敗した場合(循環参照以外の例外・BigInt等)は例外を投げずプレースホルダーを返す。
 */
export function stringifyArgsForTelemetry(args: unknown[], maxLength = 1000): string {
    try {
        const redacted = args.map(arg => redactValue(arg, 0, new Set()))
        return JSON.stringify(redacted).substring(0, maxLength)
    } catch {
        return '[UNSERIALIZABLE_ARGS]'
    }
}
