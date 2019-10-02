import { createContext } from "@proc/context";
import { Writable } from "stream";
import { createLogger, Logger } from "./index";

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

describe("Contextual Logger", () => {
  const mockOutput = jest.fn();
  // here is a test stream for pino that calls out mock fn.
  const stream = ({
    [Symbol.for("pino.metadata")]: true,
    write(chunk: string | Buffer): void {
      // console.log("lastLevel", this.lastLevel);
      // console.log("lastMsg", this.lastMsg);
      // console.log("lastObj", this.lastObj);
      // console.log("lastLogger", this.lastLogger);
      // console.log("line", chunk);
      mockOutput({
        level: this.lastLevel,
        obj: this.lastObj,
        msg: this.lastMsg,
        line: chunk
      });
    }
  } as any) as Writable;

  const logAndGetOutput = (logger: Logger, msg: any, ...args: Array<any>) => {
    mockOutput.mockReset();
    logger.info(msg, ...args);
    expect(mockOutput).toBeCalled();
    return JSON.parse(mockOutput.mock.calls[0][0].line);
  };

  it("should create a logger", () => {
    const ctx = createContext();
    const getLogger = createLogger({ base: null }, stream);
    const log = getLogger(ctx);
    const arg = logAndGetOutput(log, "test");
    expect(arg.msg).toBe("test");
    // this is the real test of magic, inherited ctx id in logger.
    expect(arg.ctx).toBe(ctx.id);
    const child = ctx.child();
    const childLog = getLogger(child);
    const childArg = logAndGetOutput(childLog, "from child");
    expect(childArg.msg).toBe("from child");
    // this is the real test of magic.
    expect(childArg.ctx).toBe(child.id);
    child.done();
    ctx.done();
  });

  it("should be able to add properties to the child but really not create a child.", () => {
    const ctx = createContext();
    const child = ctx.child();
    const getLogger = createLogger({ base: null }, stream);

    const log = getLogger(ctx);
    const output1 = logAndGetOutput(log, "foo");
    expect(output1).not.toHaveProperty("testbind");
    log.bind({ testbind: "bindtest" });
    const output2 = logAndGetOutput(log, "foo");
    expect(output2).toEqual(expect.objectContaining({ testbind: "bindtest" }));
    const clog = getLogger(child);
    const output3 = logAndGetOutput(clog, "foo");
    expect(output3).not.toHaveProperty("testbind2"); // not added yet
    expect(output3).not.toHaveProperty("testbind"); // not inherited
    clog.bind({ testbind2: "child bind" });
    const output4 = logAndGetOutput(clog, "foo");
    expect(output4).toEqual(
      expect.objectContaining({ testbind2: "child bind" })
    );
    const output5 = logAndGetOutput(log, "foo");
    expect(output5).not.toHaveProperty("testbind2"); // not added to parent
  });
});
