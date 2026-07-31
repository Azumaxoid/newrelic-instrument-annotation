const newrelicMock = {
  startSegment: jest.fn((_name: string, _record: boolean, handler: () => unknown) => handler()),
  noticeError: jest.fn(),
  addCustomAttributes: jest.fn(),
};

export default newrelicMock;
