import newrelic from 'newrelic';
import { InstrumentService, instrumentServiceClass, instrumentMethod } from '../src/instrumentService';
import type { LoggerLike } from '../src/types';

const newrelicMock = newrelic as unknown as {
  startSegment: jest.Mock;
  noticeError: jest.Mock;
};

describe('instrumentServiceClass', () => {
  beforeEach(() => {
    newrelicMock.startSegment.mockClear();
    newrelicMock.noticeError.mockClear();
  });

  it('同期メソッドが正常終了する場合、サービス名/メソッド名から成るセグメント名でstartSegmentが呼ばれる', () => {
    class Target {
      greet(name: string) {
        return `hello ${name}`;
      }
    }
    const Instrumented = instrumentServiceClass(Target, 'Target');
    const result = new Instrumented().greet('world');

    expect(result).toBe('hello world');
    expect(newrelicMock.startSegment).toHaveBeenCalledWith('Target/greet', true, expect.any(Function));
  });

  it('同期メソッドが例外を投げる場合、noticeErrorが1回呼ばれ、error.reportedがtrueになり、例外が再スローされる', () => {
    class Target {
      boom() {
        throw new Error('sync boom');
      }
    }
    const Instrumented = instrumentServiceClass(Target, 'Target');
    const instance = new Instrumented();

    let caught: unknown;
    try {
      instance.boom();
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as { reported?: boolean }).reported).toBe(true);
    expect(newrelicMock.noticeError).toHaveBeenCalledTimes(1);
  });

  it('Promiseを返す非同期メソッドが解決する場合、正しい値が返る', async () => {
    class Target {
      async fetch() {
        return 'ok';
      }
    }
    const Instrumented = instrumentServiceClass(Target, 'Target');
    const result = await new Instrumented().fetch();

    expect(result).toBe('ok');
    expect(newrelicMock.noticeError).not.toHaveBeenCalled();
  });

  it('非同期メソッドがrejectする場合、noticeErrorが1回呼ばれ、reported=trueが付与され、rejectionが伝播する', async () => {
    class Target {
      async fetch() {
        throw new Error('async boom');
      }
    }
    const Instrumented = instrumentServiceClass(Target, 'Target');
    const instance = new Instrumented();

    await expect(instance.fetch()).rejects.toThrow('async boom');
    expect(newrelicMock.noticeError).toHaveBeenCalledTimes(1);

    try {
      await instance.fetch();
    } catch (e) {
      expect((e as { reported?: boolean }).reported).toBe(true);
    }
  });

  it('ネストした計装済みメソッド呼び出しで同一Errorオブジェクトが複数階層を伝播する場合、noticeErrorは1回だけ呼ばれる', () => {
    class Target {
      post() {
        return this.executePost();
      }
      executePost() {
        throw new Error('nested boom');
      }
    }
    const Instrumented = instrumentServiceClass(Target, 'Target');
    const instance = new Instrumented();

    expect(() => instance.post()).toThrow('nested boom');
    expect(newrelicMock.noticeError).toHaveBeenCalledTimes(1);
  });

  it('別々の呼び出しで発生した別のErrorインスタンスはそれぞれ個別に報告される', () => {
    class Target {
      boom() {
        throw new Error('boom');
      }
    }
    const Instrumented = instrumentServiceClass(Target, 'Target');
    const instance = new Instrumented();

    expect(() => instance.boom()).toThrow();
    expect(() => instance.boom()).toThrow();

    expect(newrelicMock.noticeError).toHaveBeenCalledTimes(2);
  });

  it('constructor / _始まりのprivateメソッド / メソッドでないプロパティは計装対象から除外される', () => {
    class Target {
      value = 'not-a-method';
      _privateMethod() {
        return 'private';
      }
      publicMethod() {
        return 'public';
      }
    }
    const Instrumented = instrumentServiceClass(Target, 'Target');
    const instance = new Instrumented();

    instance.publicMethod();
    expect(newrelicMock.startSegment).toHaveBeenCalledWith('Target/publicMethod', true, expect.any(Function));

    newrelicMock.startSegment.mockClear();
    instance._privateMethod();
    expect(newrelicMock.startSegment).not.toHaveBeenCalled();
    expect(instance.value).toBe('not-a-method');
  });

  it('options.loggerを渡した場合はconsoleではなく渡したLoggerLikeが呼ばれ、渡さない場合はconsoleへフォールバックする', () => {
    const customLogger: LoggerLike = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    class Target {
      method() {
        return 'ok';
      }
    }

    instrumentServiceClass(Target, 'TargetWithLogger', { logger: customLogger });
    expect(customLogger.info).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();

    class Target2 {
      method() {
        return 'ok';
      }
    }
    instrumentServiceClass(Target2, 'TargetWithoutLogger');
    expect(infoSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
  });
});

describe('InstrumentService decorator', () => {
  beforeEach(() => {
    newrelicMock.startSegment.mockClear();
    newrelicMock.noticeError.mockClear();
  });

  it('デコレーターとして適用してもinstrumentServiceClassと同じ挙動になる', () => {
    @InstrumentService('DecoratedTarget')
    class Target {
      greet() {
        return 'hi';
      }
    }
    const result = new Target().greet();

    expect(result).toBe('hi');
    expect(newrelicMock.startSegment).toHaveBeenCalledWith('DecoratedTarget/greet', true, expect.any(Function));
  });
});

describe('instrumentMethod', () => {
  beforeEach(() => {
    newrelicMock.startSegment.mockClear();
    newrelicMock.noticeError.mockClear();
  });

  it('指定したメソッドのみを計装する', () => {
    const target = {
      greet: () => 'hi',
    };
    instrumentMethod(target, 'greet', 'ManualTarget');
    const result = target.greet();

    expect(result).toBe('hi');
    expect(newrelicMock.startSegment).toHaveBeenCalledWith('ManualTarget/greet', true, expect.any(Function));
  });

  it('メソッドでないプロパティを指定した場合は警告してスキップする', () => {
    const warnLogger: LoggerLike = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const target = { value: 'not-a-function' };
    instrumentMethod(target, 'value', 'ManualTarget', { logger: warnLogger });

    expect(warnLogger.warn).toHaveBeenCalled();
  });
});
